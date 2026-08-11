#!/usr/bin/env python3
"""없어진 이름을 산문이 아직 부르고 있는지 본다.

문서와 주석은 CI가 보지 않으므로 **조용히 거짓이 된다.** 그중 기계가 잡을 수 있는
유형은 하나뿐이다 — **지운 이름을 산문이 그대로 부르는 것.**
(`tools/README.md`가 없어진 `TARGETS` 배열을 가리키던 것이 그 예다.)

의미만 거짓이 된 문장은 여기서 안 잡힌다. 그건 읽어서 대조하는 수밖에 없다.
그래서 이 검사는 **넓게 훑지 않고 좁게 확실한 것만** 본다.

무엇을 「없어진 이름」으로 보는가 — 정밀도를 위해 둘로 한정한다.

1. **정의가 지워진 이름** — `NAME = …`, `def name(`, `const name =`, `function name(`
   꼴로 **선언되던 줄이 사라졌고**, 지금 트리의 코드 어디에도 그 이름이 없는 것.
2. **지워진 파일의 경로.**

둘 다 「지금 코드에 없다」를 확인한 뒤에야 산문을 뒤진다. 이름을 옮겨 심었을 뿐이면
지금 트리에서 발견되므로 보고하지 않는다.

사용법:
    python tools/check_stale_refs.py                 # HEAD~1..HEAD
    python tools/check_stale_refs.py <범위>           # 예: 3.1.0..HEAD
    python tools/check_stale_refs.py --since 3.1.0   # <범위>와 같다

찾은 것이 있으면 종료 코드 1.
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# 산문 — 사람이 읽는 글이 들어 있는 파일. 강의노트 HTML은 보지 않는다
# (거기 적힌 이름은 학생에게 보여 주는 코드지 이 저장소의 식별자가 아니다).
PROSE_GLOBS = ["*.md", "docs/*.md", "tools/*.py", "tools/*.md", "tools/vite/*.js",
               "tools/docx/*.js", "tools/docx/*.md", "src/**/*.js", "src/**/*.css",
               "vite.config.js", ".github/workflows/*.yml", ".gitignore", ".npmrc"]

# 코드 — 「지금도 살아 있는가」를 확인할 자리.
CODE_GLOBS = ["*.py", "*.js", "*.json", "*.css", "*.yml", "*.xml", "*.html"]
CODE_SKIP = {"node_modules", "dist", ".git", ".venv", "__pycache__"}

# 선언 꼴. 이 모양으로 사라진 줄에서만 이름을 거둔다.
DECL = [
    re.compile(r"^\s*([A-Z][A-Z0-9_]{2,})\s*(?::[^=]+)?="),      # PY 상수: TARGETS = [...]
    re.compile(r"^\s*def\s+([A-Za-z_][A-Za-z0-9_]{2,})\s*\("),   # def foo(
    re.compile(r"^\s*class\s+([A-Za-z_][A-Za-z0-9_]{2,})\b"),    # class Foo
    re.compile(r"^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]{2,})\s*="),
    re.compile(r"^\s*(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]{2,})\s*\("),
]

# 산문에서 이 이름을 부르는 꼴. 백틱·따옴표 안이거나 낱말 경계가 선 것.
def mentions(name: str) -> re.Pattern:
    return re.compile(r"(?<![\w./-])" + re.escape(name) + r"(?![\w-])")


def git(*args: str) -> str:
    p = subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                       text=True, encoding="utf-8", errors="replace")
    if p.returncode != 0:
        sys.exit(f"[check_stale_refs] git {' '.join(args)} 실패:\n{p.stderr.strip()}")
    return p.stdout


def iter_files(globs: list[str]) -> list[Path]:
    out: list[Path] = []
    for g in globs:
        for p in ROOT.glob(g):
            if p.is_file() and not any(part in CODE_SKIP for part in p.parts):
                out.append(p)
    return sorted(set(out))


def removed_names(rng: str) -> set[str]:
    """범위 안에서 **선언이 사라진** 이름."""
    names: set[str] = set()
    for line in git("diff", "-U0", rng, "--", "*.py", "*.js").splitlines():
        if not line.startswith("-") or line.startswith("---"):
            continue
        body = line[1:]
        for pat in DECL:
            m = pat.match(body)
            if m:
                names.add(m.group(1))
    return names


def removed_paths(rng: str) -> set[str]:
    """범위 안에서 지워진 파일 중 **지금도 없는** 것의 경로와 파일명.

    파일명까지 보는 이유 — 산문은 `build_site.py`처럼 이름만 부르는 일이 잦다.
    다만 **같은 이름의 파일이 어딘가 살아 있으면 이름은 빼야 한다.**
    `.github/scripts/package.json`이 지워졌다고 루트 `package.json`을 부르는
    문장을 전부 잡으면 검사가 못 쓸 물건이 된다.
    """
    live_names = {p.name for p in ROOT.rglob("*")
                  if p.is_file() and not any(part in CODE_SKIP for part in p.parts)}
    out: set[str] = set()
    for rel in git("diff", "--diff-filter=D", "--name-only", rng).splitlines():
        rel = rel.strip()
        if not rel or (ROOT / rel).exists():
            continue
        out.add(rel)
        if Path(rel).name not in live_names:
            out.add(Path(rel).name)
    return out


def strip_comments(text: str, suffix: str) -> str:
    """주석과 독스트링을 지운다.

    **이것이 이 검사의 핵심이다.** 주석 안에 남은 이름은 「살아 있다」가 아니라
    바로 그 낡은 서술이다. 지우지 않으면 `check_html.py`의 독스트링에 남은
    「예전에는 TARGETS에…」가 그 이름을 살아 있는 것으로 만들어 버린다.
    """
    if suffix == ".py":
        text = re.sub(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'', " ", text)
        return re.sub(r"#.*", " ", text)
    if suffix in (".js", ".css", ".xml", ".html"):
        text = re.sub(r"/\*[\s\S]*?\*/|<!--[\s\S]*?-->", " ", text)
        return re.sub(r"(?<!:)//.*", " ", text)
    if suffix in (".yml", ".yaml", ".npmrc", ".gitignore"):
        return re.sub(r"#.*", " ", text)
    return text


def alive_in_code(names: set[str]) -> set[str]:
    """지금 트리의 **코드**에 아직 있는 이름. 주석 안의 언급은 세지 않는다."""
    if not names:
        return set()
    alive: set[str] = set()
    pats = {n: mentions(n) for n in names}
    for p in iter_files(CODE_GLOBS) + iter_files([f"{d}/**/{g}" for d in
                                                  ("tools", "src", ".github", ".idea")
                                                  for g in CODE_GLOBS]):
        try:
            text = strip_comments(p.read_text(encoding="utf-8", errors="replace"), p.suffix)
        except OSError:
            continue
        for n, pat in pats.items():
            if n not in alive and pat.search(text):
                alive.add(n)
    return alive


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("range", nargs="?", help="git 범위 (기본 HEAD~1..HEAD)")
    ap.add_argument("--since", help="<범위>를 `<since>..HEAD`로 준다")
    args = ap.parse_args()

    rng = args.range or (f"{args.since}..HEAD" if args.since else "HEAD~1..HEAD")

    gone = removed_names(rng) | removed_paths(rng)
    if not gone:
        print(f"[check_stale_refs] {rng}: 사라진 선언·파일이 없다")
        return 0

    dead = gone - alive_in_code(gone)
    if not dead:
        print(f"[check_stale_refs] {rng}: 사라진 이름 {len(gone)}개, "
              f"전부 지금 코드에 아직 있다(옮겨 심었다)")
        return 0

    hits: list[str] = []
    pats = {n: mentions(n) for n in dead}
    # 자기 자신은 뺀다 — 이 파일의 설명이 예시로 드는 이름까지 잡으면 늘 시끄럽다.
    for p in (f for f in iter_files(PROSE_GLOBS) if f != Path(__file__).resolve()):
        try:
            lines = p.read_text(encoding="utf-8", errors="replace").splitlines()
        except OSError:
            continue
        rel = p.relative_to(ROOT).as_posix()
        for i, line in enumerate(lines, 1):
            for n, pat in pats.items():
                if pat.search(line):
                    hits.append(f"  {rel}:{i}  «{n}» — {line.strip()[:90]}")

    print(f"[check_stale_refs] {rng}: 없어진 이름 {len(dead)}개 "
          f"({', '.join(sorted(dead)[:8])}{' …' if len(dead) > 8 else ''})")
    if not hits:
        print("[check_stale_refs] 통과 — 산문이 부르는 곳 없음")
        return 0

    print(f"[check_stale_refs] 산문이 아직 부른다 — {len(hits)}곳")
    for h in hits:
        print(h)
    print("고치거나 지운다. 지난 일을 적은 문장(「예전에는 ~였다」)이면 그대로 두어도 된다.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
