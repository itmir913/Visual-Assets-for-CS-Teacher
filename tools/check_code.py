#!/usr/bin/env python3
"""강의노트가 끌어다 쓰는 소스 코드를 검사한다.

두 가지를 본다.

1. **마커가 가리키는 것이 실제로 있는가** — HTML의 `data-src="code/변수.py#선언"`이
   파일과 구역까지 맞는지. 빌드도 여기서 세우지만, 빌드를 돌리기 전에 알 수 있어야 한다.
2. **코드에 구문 오류가 없는가** — `.py`는 컴파일, `.c`는 `gcc -fsyntax-only`.
   동작까지 보지는 않는다. 오타를 잡는 것이 목적이다.

조각 모음처럼 홀로 서지 않는 파일은 맨 위 주석 프론트매터로 뺀다.

    # ---
    # check: none
    # ---

`---`를 그냥 첫 줄에 쓰면 `.c`가 컴파일되지 않으므로 주석 안에 넣는다.

사용법:
    python tools/check_code.py            # 저장소 전체
    python tools/check_code.py <경로> …    # 지정한 파일만
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
sys.path.insert(0, str(REPO_ROOT / ".github" / "scripts"))

from inject_code import InjectError, inject, read_directives  # noqa: E402

SKIP_DIRS = {".git", ".venv", "node_modules", "dist", "__pycache__"}
CODE_SUFFIXES = {".py", ".c"}


def walk(root: Path, suffixes: set[str]) -> list[Path]:
    out: list[Path] = []
    for p in root.rglob("*"):
        if p.suffix.lower() not in suffixes or not p.is_file():
            continue
        if any(part in SKIP_DIRS or part.startswith("dist-") for part in p.parts):
            continue
        out.append(p)
    return sorted(out)


def code_files(root: Path) -> list[Path]:
    """`code/` 폴더 안에 있는 소스만 대상으로 한다.

    도구 스크립트(tools/, .github/)까지 검사하지 않으려는 것이다.
    강의노트가 끌어다 쓰는 코드는 관례상 전부 `code/` 밑에 둔다.
    """
    return [p for p in walk(root, CODE_SUFFIXES) if "code" in p.parts]


def check_markers(root: Path) -> list[str]:
    errs: list[str] = []
    for p in walk(root, {".html"}):
        try:
            html = p.read_text(encoding="utf-8")
        except OSError as e:
            errs.append(f"{p.relative_to(root)}: 읽기 실패 — {e}")
            continue
        if "data-src" not in html:
            continue
        try:
            inject(html, p, repo_root=root)
        except InjectError as e:
            errs.append(f"{p.relative_to(root)}: {e}")
    return errs


def check_syntax(files: list[Path], root: Path) -> tuple[list[str], int, int]:
    errs: list[str] = []
    checked = skipped = 0
    has_gcc = shutil.which("gcc") is not None

    for p in files:
        rel = p.relative_to(root)
        try:
            directives = read_directives(p)
        except InjectError as e:
            errs.append(f"{rel}: {e}")
            continue
        if directives.get("check") == "none":
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

    if args.paths:
        files = [Path(p).resolve() for p in args.paths]
        marker_errs: list[str] = []
    else:
        files = code_files(REPO_ROOT)
        marker_errs = check_markers(REPO_ROOT)

    syntax_errs, checked, skipped = check_syntax(files, REPO_ROOT)
    errs = marker_errs + syntax_errs

    if errs:
        print(f"[check_code] 문제 {len(errs)}건")
        for e in errs:
            print(f"  {e}")
        return 1

    print(f"[check_code] 통과 — 구문 검사 {checked}개, 건너뜀 {skipped}개, "
          f"마커 오류 0건")
    return 0


if __name__ == "__main__":
    sys.exit(main())
