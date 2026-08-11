#!/usr/bin/env python3
"""강의노트가 끌어다 쓰는 소스 코드에 구문 오류가 없는지 본다.

`.py`는 컴파일해 보고, `.c`는 `gcc -fsyntax-only`로 본다. **동작까지 보지는 않는다.**
오타를 잡는 것이 목적이다.

조각 모음처럼 홀로 서지 않는 파일은 맨 위 주석 프론트매터로 뺀다.

    # ---
    # check: none
    # ---

`---`를 그냥 첫 줄에 쓰면 `.c`가 컴파일되지 않으므로 주석 안에 넣는다.

**마커(`data-src`)가 가리키는 파일과 구역이 실제로 있는지는 빌드가 본다** —
`tools/vite/inject-code.js`가 못 찾으면 빌드를 세운다. 같은 검사를 두 곳에 두면
둘이 어긋나므로 여기서는 하지 않는다.

사용법:
    npm run check:code            # 저장소 전체
    npm run check:code -- <경로>   # 지정한 파일만
"""
from __future__ import annotations

import argparse
import py_compile
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

SKIP_DIRS = {".git", ".venv", "node_modules", "dist", "__pycache__"}
CODE_SUFFIXES = {".py", ".c"}
COMMENT_PREFIX = {".py": "#", ".c": "//"}


def code_files(root: Path) -> list[Path]:
    """`code/` 폴더 안에 있는 소스만 대상으로 한다.

    도구 스크립트(tools/, build/)까지 검사하지 않으려는 것이다.
    강의노트가 끌어다 쓰는 코드는 관례상 전부 `code/` 밑에 둔다.
    """
    out: list[Path] = []
    for p in root.rglob("*"):
        if p.suffix.lower() not in CODE_SUFFIXES or not p.is_file():
            continue
        if any(part in SKIP_DIRS or part.startswith("dist-") for part in p.parts):
            continue
        if "code" in p.parts:
            out.append(p)
    return sorted(out)


def directives(path: Path) -> dict[str, str]:
    """맨 위 주석 프론트매터의 지시자를 읽는다. 없으면 빈 사전."""
    pfx = COMMENT_PREFIX[path.suffix.lower()]
    fence = f"{pfx} ---"
    lines = path.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != fence:
        return {}
    out: dict[str, str] = {}
    for raw in lines[1:]:
        if raw.strip() == fence:
            return out
        body = raw.strip()
        if body.startswith(pfx):
            body = body[len(pfx):].strip()
            if ":" in body:
                k, v = body.split(":", 1)
                out[k.strip()] = v.strip()
    raise ValueError(f"프론트매터가 `{fence}`로 닫히지 않았다")


def check_syntax(files: list[Path], root: Path) -> tuple[list[str], int, int]:
    errs: list[str] = []
    checked = skipped = 0
    has_gcc = shutil.which("gcc") is not None

    for p in files:
        rel = p.relative_to(root)
        try:
            meta = directives(p)
        except ValueError as e:
            errs.append(f"{rel}: {e}")
            continue
        if meta.get("check") == "none":
            skipped += 1
            continue

        if p.suffix.lower() == ".py":
            with tempfile.TemporaryDirectory() as tmp:
                try:
                    py_compile.compile(str(p), cfile=str(Path(tmp) / "x.pyc"), doraise=True)
                    checked += 1
                except py_compile.PyCompileError as e:
                    errs.append(f"{rel}: {e.msg.strip()}")
        else:
            if not has_gcc:
                skipped += 1
                continue
            proc = subprocess.run(
                ["gcc", "-fsyntax-only", str(p)],
                capture_output=True, text=True, encoding="utf-8", errors="replace",
            )
            if proc.returncode != 0:
                errs.append(f"{rel}:\n{proc.stderr.strip()}")
            else:
                checked += 1

    if not has_gcc and any(p.suffix.lower() == ".c" for p in files):
        print("[check_code] 알림: gcc가 없어 .c 구문 검사를 건너뛴다 (CI에서는 검사된다)")
    return errs, checked, skipped


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("paths", nargs="*", help="검사할 파일 (없으면 저장소 전체)")
    args = parser.parse_args()

    files = [Path(p).resolve() for p in args.paths] if args.paths else code_files(REPO_ROOT)
    errs, checked, skipped = check_syntax(files, REPO_ROOT)

    if errs:
        print(f"[check_code] 문제 {len(errs)}건")
        for e in errs:
            print(f"  {e}")
        return 1

    print(f"[check_code] 통과 — 구문 검사 {checked}개, 건너뜀 {skipped}개")
    return 0


if __name__ == "__main__":
    sys.exit(main())
