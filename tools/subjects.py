#!/usr/bin/env python3
"""이 저장소에 어떤 강의노트가 있는가 — **한 곳에서만 정한다.**

예전에는 과목 목록이 `build_site.py`·`audit_pre.py`·`audit_svg_maxwidth.py`
**세 군데에 따로** 박혀 있었고 셋이 서로 달랐다. 「정보(고등학교)」를 추가할 때
빌드 쪽에만 넣어서 **25개 파일이 두 검사에서 통째로 빠진 채** 한동안 남아 있었다.
검사를 통과했다는 말이 그 파일들에는 아무 의미가 없었다.

새 과목을 만들면 **아래 DIRS에 한 줄** 넣는다. 그러면 빌드도 검사도 함께 본다.
"""
from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# 강의노트가 들어 있는 폴더. 하위 폴더까지 재귀로 훑는다.
DIRS = [
    "인공지능기초",
    "데이터과학",
    "정보(고등학교)",
    "프로그래밍(Python)",
    "프로그래밍(C)",
    "simulator/ai",
]

# 폴더에 속하지 않는 낱개 파일.
FILES = ["index.html"]


def html_files(root: Path | None = None) -> list[Path]:
    """DIRS + FILES에 해당하는 HTML 전부. 빌드와 검사가 같은 목록을 본다."""
    root = root or REPO_ROOT
    out: list[Path] = []
    for d in DIRS:
        base = root / d
        if base.exists():
            out.extend(sorted(base.rglob("*.html")))
    for f in FILES:
        p = root / f
        if p.exists():
            out.append(p)
    return out
