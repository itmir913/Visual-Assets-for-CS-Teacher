#!/usr/bin/env python3
"""첫 화면(`index.html`)과 강의노트가 **서로를 놓치지 않았는지** 본다.

    1. `index.html`이 거는 저장소 안 주소가 **실제로 있는 파일인지**
    2. 과목 폴더의 강의노트 가운데 **`index.html`이 한 번도 걸지 않은 것이 있는지**

강의노트 이름을 바꾸면 첫 화면의 링크가 함께 바뀌어야 한다. 한쪽만 바뀌어도 빌드는
멀쩡히 끝나고 화면도 멀쩡해 보인다 — 끊긴 링크는 **누르기 전에는 모르고**, 걸리지
않은 강의노트는 **학생에게 가는 길이 없는데 아무도 알려 주지 않는다.**

시뮬레이터 쪽 고아는 `gen_simulator_index.py --check`가 본다. 여기서는 과목 폴더만 본다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path
from urllib.parse import unquote

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "tools"))

from logs import get_logger  # noqa: E402
from subjects import SUBJECTS  # noqa: E402

INDEX = "index.html"
HREF_RE = re.compile(r'\bhref="([^"]+)"')

# 소스에는 없고 빌드가 굽는 파일. 산출물에 있는지는 `check_dist.py`가 본다.
BUILT = {"THIRD-PARTY-NOTICES.txt"}

# 일부러 첫 화면에 걸지 않는 강의노트. **왜 걸지 않는지와 함께** 적는다.
UNLINKED_OK: dict[str, str] = {}


def local_targets(html: str) -> list[str]:
    """저장소 안을 가리키는 href — 바깥 주소 · 같은 문서 안 앵커 · mailto 는 뺀다."""
    out = []
    for href in HREF_RE.findall(html):
        if re.match(r"[a-z][a-z0-9+.-]*:", href, re.I) or href.startswith(("#", "//")):
            continue
        path = unquote(href.split("#", 1)[0].split("?", 1)[0])
        if path:
            out.append(path)
    return out


def main() -> int:
    log = get_logger("check_index_links")
    bad: list[str] = []

    html = (REPO_ROOT / INDEX).read_text(encoding="utf-8")
    linked: set[Path] = set()
    targets = local_targets(html)
    for t in targets:
        p = (REPO_ROOT / t.lstrip("/")).resolve()
        if p.is_dir():
            p = p / "index.html"
        if not p.exists() and p.name not in BUILT:
            bad.append(f"{INDEX}: 없는 파일을 건다 (href=\"{t}\")")
        linked.add(p)

    notes = 0
    for s in SUBJECTS:
        for p in sorted((REPO_ROOT / s["dir"]).rglob("*.html")):
            rel = p.relative_to(REPO_ROOT).as_posix()
            notes += 1
            if p.resolve() not in linked and rel not in UNLINKED_OK:
                bad.append(f"{rel}: {INDEX}에서 가는 링크가 없다"
                           f" (일부러 그렇다면 check_index_links.py의 UNLINKED_OK에 까닭과 함께 적는다)")
    for rel in sorted(UNLINKED_OK):
        if not (REPO_ROOT / rel).exists():
            bad.append(f"UNLINKED_OK에 적힌 파일이 없다: {rel}")
        elif (REPO_ROOT / rel).resolve() in linked:
            bad.append(f"UNLINKED_OK에 적혔는데 {INDEX}가 건다 — 목록에서 뺀다: {rel}")

    for b in bad:
        log.error("  ✗ " + b)
    log.info(f"완료 — 링크 {len(targets)}, 강의노트 {notes}, 위반 {len(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
