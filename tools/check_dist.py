#!/usr/bin/env python3
"""빌드 **산출물**을 검사한다. 소스가 아니라 `dist/`를 본다.

소스 검사(`check_html.py`·`check_dynamic_classes.py`·`check_code.py`)와 역할이 다르다.
여기서 보는 셋은 **빌드가 저지를 수 있는 실수**라서 소스만 봐서는 알 수 없다.

1. **`.docx` 다운로드 링크** — `.docx`는 저장소에 없고 빌드가 만든다.
   생성기 쪽 파일명과 강의노트의 링크가 어긋나면 이 검사가 유일한 방어선이다.
   **양쪽을 다 본다** — 링크가 가리키는 파일이 있는지, 그리고 만들어 놓고
   아무도 가리키지 않는 파일이 있는지.
2. **로컬화되지 않은 CDN 참조** — 하나라도 남으면 CDN을 막는 학교망에서 깨진다.
3. **태그 중첩** — 주입·치환이 구조를 망가뜨리지 않았는지 마지막으로 확인한다.

사용법:
    python tools/check_dist.py            # dist/
    python tools/check_dist.py <경로>      # 다른 산출물 폴더
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "tools"))

from check_html import Checker  # noqa: E402
from logs import get_logger, github_annotation  # noqa: E402

DOCX_HREF_RE = re.compile(r'href="([^"]+\.docx)"')

# 강의노트가 **일부러** 링크하지 않는 양식. 수행평가용이라 학생 화면에 나오면 안 된다.
# 링크가 없으면 「누가 이 파일을 지켜 주는가」가 사라지므로 여기에 적어 검사가 지키게 한다.
#
# 이 표는 두 방향으로 작동한다.
#   · 여기 없는데 아무도 안 가리키면  → 링크를 빠뜨린 것이다
#   · 여기 있는데 안 만들어졌으면      → 이름이나 자리가 바뀐 것이다. **주소가 죽는다**
# 뒤쪽이 진짜 이유다. 링크가 없으니 이름을 바꿔도 아무 데서도 티가 나지 않는다.
UNLINKED_OK = {
    "인공지능기초/실습/docx/수행평가-양식.docx",
    "프로그래밍/실습/docx/수행평가-양식.py.docx",
    "프로그래밍/실습/docx/수행평가-양식.c.docx",
}
CDN_RE = re.compile(r"https://(?:cdn|unpkg|cdnjs)[a-zA-Z0-9./_-]*")


def check_docx_links(files: list[Path]) -> tuple[list[str], int]:
    bad: list[str] = []
    total = 0
    for h in files:
        for m in DOCX_HREF_RE.finditer(h.read_text(encoding="utf-8")):
            total += 1
            if not (h.parent / m.group(1)).resolve().exists():
                bad.append(f"깨진 다운로드 링크: {h} -> {m.group(1)}")
    return bad, total


def check_orphan_docx(root: Path, files: list[Path]) -> list[str]:
    """만들어 놓고 아무 강의노트도 가리키지 않는 .docx를 찾는다."""
    linked: set[Path] = set()
    for h in files:
        for m in DOCX_HREF_RE.finditer(h.read_text(encoding="utf-8")):
            linked.add((h.parent / m.group(1)).resolve())

    bad: list[str] = []
    built = {d.resolve(): d.relative_to(root).as_posix() for d in root.rglob("*.docx")}
    for abs_path, rel in sorted(built.items(), key=lambda kv: kv[1]):
        if abs_path not in linked and rel not in UNLINKED_OK:
            bad.append(f"아무도 링크하지 않는 양식: {rel}"
                       f" (일부러 그렇다면 check_dist.py의 UNLINKED_OK에 적는다)")
    for rel in sorted(UNLINKED_OK):
        if (root / rel).resolve() not in built:
            bad.append(f"UNLINKED_OK에 적힌 양식이 만들어지지 않았다: {rel}"
                       f" (이름이나 자리가 바뀌었다면 주소가 죽는다)")
    return bad


def check_cdn(files: list[Path]) -> list[str]:
    bad: list[str] = []
    for h in files:
        found = sorted(set(CDN_RE.findall(h.read_text(encoding="utf-8"))))
        if found:
            bad.append(f"로컬화되지 않은 CDN 참조: {h} -> {', '.join(found[:3])}")
    return bad


def check_nesting(files: list[Path]) -> list[str]:
    bad: list[str] = []
    for h in files:
        c = Checker()
        c.feed(h.read_text(encoding="utf-8"))
        problems = list(c.nesting) + [f"{ln}행: <{t}> 닫히지 않음" for t, ln, _ in c.stack]
        for p in problems:
            bad.append(f"태그 중첩 위반: {h} -> {p}")
    return bad


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dist", nargs="?", default="dist", help="검사할 산출물 폴더 (기본 dist)")
    parser.add_argument("--github", action="store_true", help="::error:: 형식으로 출력 (Actions용)")
    parser.add_argument("-v", "--verbose", action="store_true", help="세부 수치까지 보인다")
    args = parser.parse_args()

    log = get_logger("check_dist", args.verbose)

    root = Path(args.dist)
    if not root.is_dir():
        log.error("산출물 폴더가 없다: %s", root)
        return 2

    files = sorted(root.rglob("*.html"))
    if not files:
        log.error("%s에 HTML이 하나도 없다", root)
        return 2

    docx_bad, docx_total = check_docx_links(files)
    docx_bad += check_orphan_docx(root, files)
    cdn_bad = check_cdn(files)
    nest_bad = check_nesting(files)

    log.debug("HTML %d개, docx 링크 %d건", len(files), docx_total)
    errs = docx_bad + cdn_bad + nest_bad
    for e in errs:
        if args.github:
            print(github_annotation("error", e))
        else:
            log.error("%s", e)
    log.info("완료 — HTML %d, docx 링크 %d, 문제 %d", len(files), docx_total, len(errs))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
