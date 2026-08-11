#!/usr/bin/env python3
"""이 저장소가 무엇을 굽는가 — **한 곳에서만 정한다.**

목록 자체는 저장소 루트의 `subjects.json`에 있다. 파이썬 검사 도구와 Vite가
**같은 파일을 읽어야** 하기 때문에 JSON으로 두었다.

예전에는 과목 목록이 빌드와 두 감사 도구 **세 군데에 따로** 박혀 있었고 셋이
서로 달랐다. 「정보(고등학교)」를 추가할 때 빌드 쪽에만 넣어서 **25개 파일이
두 검사에서 통째로 빠진 채** 한동안 남아 있었다 — 검사를 통과했다는 말이
그 파일들에는 아무 의미가 없었다.

새 과목을 만들면 **`subjects.json`에 한 항목** 넣는다. 그러면 빌드도 검사도 함께 본다.
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

_CFG = json.loads((REPO_ROOT / "subjects.json").read_text(encoding="utf-8"))

# 강의노트 과목. dir / slug / theme
SUBJECTS: list[dict] = _CFG["subjects"]

# 강의노트는 아니지만 함께 배포되는 폴더 (시뮬레이터 등).
STANDALONE: list[dict] = _CFG["standalone"]

# 폴더에 속하지 않는 낱개 페이지.
PAGES: list[dict] = _CFG["files"]

# 재귀로 훑을 폴더 전부.
DIRS: list[str] = [u["dir"] for u in SUBJECTS + STANDALONE]

# 낱개 파일 전부.
FILES: list[str] = [p["path"] for p in PAGES]


def subject_of(rel_path: str | Path) -> dict | None:
    """상대 경로가 어느 과목에 속하는지. 어디에도 안 속하면 None."""
    parts = Path(rel_path).parts
    if not parts:
        return None
    return next((s for s in SUBJECTS if s["dir"] == parts[0]), None)


def html_files(root: Path | None = None) -> list[Path]:
    """DIRS + FILES에 해당하는 HTML 전부. 빌드와 검사가 같은 목록을 본다.

    **단위는 겹칠 수 있으므로 중복을 없앤다.** `인공지능기초/simulator`처럼
    standalone이 과목 폴더 **안에** 있으면 두 글롭이 같은 파일을 잡는다.
    없애지 않으면 그 파일들만 두 번 검사되고 「몇 개 봤다」는 수도 틀린다.
    """
    root = root or REPO_ROOT
    out: list[Path] = []
    seen: set[Path] = set()
    for d in DIRS:
        base = root / d
        if base.exists():
            for p in sorted(base.rglob("*.html")):
                if p not in seen:
                    seen.add(p)
                    out.append(p)
    for f in FILES:
        p = root / f
        if p.exists() and p not in seen:
            seen.add(p)
            out.append(p)
    return out
