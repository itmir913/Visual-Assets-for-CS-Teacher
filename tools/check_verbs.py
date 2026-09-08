#!/usr/bin/env python3
"""어색한 순우리말 동사를 잡는다 — **저장소 전체를 돈다.**

    python tools/check_verbs.py            # 저장소 전부 (CI가 쓰는 방식)
    python tools/check_verbs.py <파일>…    # 짚은 파일만
    python tools/check_verbs.py --report   # 위반을 세기만 하고 종료 코드 0

위반이 하나라도 있으면 종료 코드 1.

**왜 필요한가.** 「지도를 폈습니다」·「노드를 펼칩니다」는 뜻이 통하지만
한국어를 모어로 쓰는 사람에게 **매우 어색하게 들린다.** 학생이 읽는 화면이고,
같은 개념을 교과서는 「전개」·「확장」·「생성」이라는 한자어로 부른다.
풀어 쓴 말은 뜻이 통해도 **교과서의 그 개념과 이어지지 않는다.**

**왜 `grep`으로는 안 되는가.** 한국어 동사는 활용한다. 「펼치다」를 찾으면
`펼칩니다`·`펼쳤다`·`펼쳐`·`펼칠`이 다 빠지고, 「펴다」는 `폈습니다`로 줄어
사전꼴이 글자 하나도 남지 않는다. **찾을 것은 사전꼴이 아니라 활용형 전부다.**

**어간이 아니라 「어간 + 어미」로 찾는다.** 어간만 보면 엉뚱한 낱말이 걸린다 —
`편`은 「편집·편의·한 편」이고 `핀`은 「핀」이다. 그래서 활용형마다 **뒤따르는
어미까지** 함께 못박고, 앞에 한글이 붙은 자리(딴 낱말의 한가운데)는 뺀다.

**주석도 본다.** 주석에 남아 있으면 다음 사람이 그 말을 따라 쓴다 →
`check_sim_terms.py`가 같은 까닭으로 그렇게 한다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

SUFFIXES = {".html", ".js", ".mjs", ".py", ".css", ".md"}

# 저장소 것이 아니거나 사람이 쓴 글이 아닌 자리.
SKIP_DIRS = {"node_modules", "dist", ".git", ".idea", "public", ".github"}

# **아직 손질하지 않아 검사에서 빼 두는 자리.** 비어 있는 것이 목표다.
# 강의노트가 「노드를 펼친다」를 탐색 단원 전체에서 쓰고 있어, 고치는 것은 곧
# 그 단원의 용어를 「확장」으로 바꾸는 일이다. 강의노트는 사용자가 파일 단위로
# 확인하고 넘어가는 것이라 → CLAUDE.md 「커밋 규칙」, 여기에 담아 두고 함께 뺀다.
# `--report`로 부르면 이 목록까지 세어 준다. **뺄 때는 이 줄도 함께 지운다.**
PENDING = [
    "인공지능기초",
    "정보(고등학교)",
    "프로그래밍",
]

# ── 활용형 ───────────────────────────────────────────────────────────────────
# (이름, 활용형 정규식, 쓸 말).
#
# **활용형을 하나하나 적는다.** 한국어 활용을 일반적으로 풀어내는 물건을 여기
# 두지 않는다 — 잡을 동사가 몇 개뿐인데 형태소 분석기를 들이면, 검사가 왜
# 걸렸는지 아무도 설명할 수 없게 된다. 낱말을 하나 더 막을 때 **활용형을 손으로
# 적어 넣는 수고가 곧 그 낱말이 정말 어색한지 다시 보는 자리**다.
#
# 지금 막는 것은 「펴다·펼치다」 한 갈래다(2026-09-08 사용자 확정).
#   펴다   — 펴고 · 펴서 · 펴는 · 펴야 · 펴 · 폈다 · 폈습니다 · 폅니다 · 펼 (수)
#   펼치다 — 펼치고 · 펼쳐 · 펼쳤다 · 펼친 · 펼칠 · 펼침 · 펼칩니다
#   (「피다」의 과거도 `폈`이라 같은 그물에 걸린다. 이 저장소에는 그 뜻으로
#    쓰는 자리가 없으므로 갈라 두지 않는다.)
VERBS = [
    ("펴다·펼치다",
     r"(?<![가-힣])("
     r"폈[다습어으지는던을고]"          # 폈다 · 폈습니다 · 폈으면 · 폈는지
     r"|폅니다"
     r"|펴[고서는며야지도]"             # 펴고 · 펴서 · 펴는 · 펴야
     r"|펴(?=[\s.,)」』\"'])"           # 「가운데를 펴 본다」처럼 홀로 선 것
     r"|펼[치쳐친칠침칩]"               # 펼치고 · 펼쳐 · 펼친 · 펼칠 · 펼침
     r"|펼(?=\s)"                       # 「펼 수 있다」
     r")",
     "전개하다 · 확장하다 · 생성하다"),
]

# 그 줄에 이 표시가 있으면 넘어간다. **규칙을 설명하려면 막은 말을 적어야 한다.**
SKIP_LINE = "verbs: 예시"

RULES = [(이름, re.compile(pat), 쓸말) for 이름, pat, 쓸말 in VERBS]


def _line_of(src: str, pos: int) -> int:
    return src.count("\n", 0, pos) + 1


def under(path: Path, dirs: list[str]) -> bool:
    rel = path.resolve().relative_to(ROOT).as_posix()
    return any(rel == d or rel.startswith(d + "/") for d in dirs)


def scope(include_pending: bool = False) -> list[Path]:
    """저장소 안의 사람이 쓴 글 전부."""
    out = []
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file() or p.suffix not in SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts):
            continue
        if not include_pending and under(p, PENDING):
            continue
        out.append(p)
    return out


def check(path: Path, log, level="error") -> int:
    # **이 파일은 자기 그물에 걸린다.** 활용형을 여기 적어 두었기 때문이다.
    # 고치는 쪽을 잡으면 검사가 자기 발등을 찍는다 →
    # `check_sim_terms.py`가 `josa.js`를 빼 두는 것과 같은 까닭.
    if path.resolve() == Path(__file__).resolve():
        return 0

    src = path.read_text(encoding="utf-8")
    shown = path.relative_to(ROOT).as_posix()
    bad: list[tuple[int, str]] = []
    lines = src.splitlines()

    for 이름, pat, 쓸말 in RULES:
        for m in pat.finditer(src):
            line = _line_of(src, m.start())
            # **막은 말을 «예로 들어야» 하는 줄이 있다** — 규칙을 적어 둔 문서가
            # 그렇다. 파일을 통째로 빼면 그 파일의 나머지가 영영 안 보이므로,
            # 빼는 단위를 줄로 둔다. 지시어를 적는 것 자체가 「일부러 썼다」는 표시다.
            if SKIP_LINE in lines[line - 1]:
                continue
            bad.append((line, f"「{이름}」 — 「{쓸말}」로 쓴다 :: {m.group(0)}"))

    for line, msg in sorted(bad):
        getattr(log, level)("%s:%d %s", shown, line, msg)
    if not bad:
        log.debug("%s OK", shown)
    return len(bad)


def main() -> int:
    argv = sys.argv[1:]
    report = "--report" in argv
    args = [a for a in argv if a not in ("-v", "--verbose", "--report")]
    log = get_logger("check_verbs", len(args) != len(argv) - report or bool(args))

    if args:
        files = [Path(a).resolve() for a in args]
    else:
        files = scope(include_pending=report)
    if not files:
        log.error("검사할 파일이 없다")
        return 2

    total = sum(check(f, log, "warning" if report else "error") for f in files)
    if report:
        log.info("훑어보기 — 파일 %d(빼 둔 자리까지), 걸린 것 %d", len(files), total)
        return 0
    log.info("완료 — 파일 %d, 위반 %d, 빼 둔 자리 %d", len(files), total, len(PENDING))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
