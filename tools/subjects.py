#!/usr/bin/env python3
"""이 저장소에 어떤 강의노트가 있는가 — **한 곳에서만 정한다.**

목록 자체는 저장소 루트의 `subjects.json`에 있다. 파이썬 검사·빌드와
Vite가 **같은 파일을 읽어야** 하기 때문에 JSON으로 두었다.

예전에는 과목 목록이 `build_site.py`·`audit_pre.py`·`audit_svg_maxwidth.py`
**세 군데에 따로** 박혀 있었고 셋이 서로 달랐다. 「정보(고등학교)」를 추가할 때
빌드 쪽에만 넣어서 **25개 파일이 두 검사에서 통째로 빠진 채** 한동안 남아 있었다.
검사를 통과했다는 말이 그 파일들에는 아무 의미가 없었다.

새 과목을 만들면 **`subjects.json`에 한 줄** 넣는다. 그러면 빌드도 검사도 함께 본다.
"""
from __future__ import annotations

import json
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

_CFG = json.loads((REPO_ROOT / "subjects.json").read_text(encoding="utf-8"))

# 과목 정보 전체. dir / slug / theme / vite
SUBJECTS: list[dict] = _CFG["subjects"]

# 강의노트가 들어 있는 폴더. 하위 폴더까지 재귀로 훑는다.
# 자체 완결형(simulator)도 빌드·검사 대상이라는 점에서는 같으므로 함께 넣는다.
DIRS: list[str] = [s["dir"] for s in SUBJECTS] + list(_CFG["standalone"])

# 폴더에 속하지 않는 낱개 파일.
FILES: list[str] = list(_CFG["files"])


def subject_of(rel_path: str | Path) -> dict | None:
    """상대 경로가 어느 과목에 속하는지. 어디에도 안 속하면 None."""
    parts = Path(rel_path).parts
    if not parts:
        return None
    return next((s for s in SUBJECTS if s["dir"] == parts[0]), None)


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
