#!/usr/bin/env python3
"""빌드 **산출물**을 검사한다. 소스가 아니라 `dist/`를 본다.

소스 검사(`check_html.py`·`check_dynamic_classes.py`·`check_code.py`)와 역할이 다르다.
여기서 보는 것들은 **빌드가 저지를 수 있는 실수**라서 소스만 봐서는 알 수 없다.

1. **`.docx` 다운로드 링크** — `.docx`는 저장소에 없고 빌드가 만든다.
   생성기 쪽 파일명과 강의노트의 링크가 어긋나면 이 검사가 유일한 방어선이다.
   **양쪽을 다 본다** — 링크가 가리키는 파일이 있는지, 그리고 만들어 놓고
   아무도 가리키지 않는 파일이 있는지.
2. **로컬화되지 않은 CDN 참조** — 하나라도 남으면 CDN을 막는 학교망에서 깨진다.
3. **태그 중첩** — 주입·치환이 구조를 망가뜨리지 않았는지 마지막으로 확인한다.
4. **CSS가 가리키는 자산이 실제로 있는지** — 빌드가 글꼴을 깎아 이름을 다시 매기므로
   (`tools/vite/subset-icon-font.js`), 참조 고치기를 한 군데라도 빠뜨리면 404가 난다.
   아이콘은 안 그려져도 페이지가 멀쩡해 보여서 **눈으로는 못 잡는다.**
5. **모듈 스크립트가 남아 있지 않은지, 스크립트가 가리키는 파일이 있는지** —
   `<script type="module">`은 `file://`에서 CORS로 통째로 막힌다. 릴리즈 zip을 풀어
   연 사람에게만 깨진 화면이 가므로 **사이트만 보아서는 알 수 없다.**
   빌드가 평범한 스크립트로 바꾸어 놓는다 → `tools/vite/classic-scripts.js`.
6. **제3자 오픈소스 라이선스 고지** — 번들에 들어간 패키지의 저작권 표시와 라이선스
   전문이 산출물에 함께 나가는지. **오프라인 zip은 명백한 재배포**라서, 고지가 빠지면
   사이트는 멀쩡해 보이는 채로 남의 라이선스를 어긴 배포본이 나간다
   → `tools/vite/third-party-notices.js`.

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
from logs import get_logger  # noqa: E402

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
NOTICE_FILE = "THIRD-PARTY-NOTICES.txt"
# 고지 생성기가 전문을 못 찾았을 때 적는 문구. 이것이 보이면 고지가 반쪽이다.
NOTICE_MISSING_MARK = "라이선스 전문 파일을 동봉하지 않았습니다"
CDN_RE = re.compile(r"https://(?:cdn|unpkg|cdnjs)[a-zA-Z0-9./_-]*")
URL_RE = re.compile(r"""url\(\s*['"]?([^'")]+)['"]?\s*\)""")
MODULE_SCRIPT_RE = re.compile(r'<script[^>]*type="module"')
SCRIPT_SRC_RE = re.compile(r'<script[^>]*src="([^"]+)"')


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


def check_third_party_notices(root: Path, files: list[Path]) -> list[str]:
    """제3자 오픈소스 라이선스 고지가 산출물과 함께 나가는지 본다.

    MIT·ISC·BSD·Apache·OFL·CC-BY는 하나같이 재배포본에 저작권 표시와 라이선스
    전문을 함께 넣으라고 요구한다. 빌드가 만들어 둔다
    → `tools/vite/third-party-notices.js`.
    """
    notice = root / NOTICE_FILE
    if not notice.is_file():
        return [f"제3자 라이선스 고지가 없다: {NOTICE_FILE}"
                f" (tools/vite/third-party-notices.js가 굽는다)"]

    bad: list[str] = []
    text = notice.read_text(encoding="utf-8")

    # 식별자만 적고 전문이 빠지면 「전문을 함께 배포하라」를 지킨 것이 아니다.
    n = text.count(NOTICE_MISSING_MARK)
    if n:
        bad.append(f"라이선스 전문이 빠진 패키지가 {n}개 있다: {NOTICE_FILE}")

    # 아무도 가리키지 않으면 있으나 마나다. 받는 사람이 찾을 수 있어야 한다.
    if not any(NOTICE_FILE in h.read_text(encoding="utf-8") for h in files):
        bad.append(f"아무 페이지도 고지를 링크하지 않는다: {NOTICE_FILE}")

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


def check_scripts(files: list[Path]) -> tuple[list[str], int]:
    """스크립트가 **어디서 열어도** 실행될 모양인지 본다.

    모듈 스크립트는 `file://`에서 출처가 `null`이라 CORS로 막힌다. 사이트에서는
    멀쩡하고 릴리즈 zip에서만 깨지므로, 여기서 막지 않으면 아무도 모른 채 나간다.
    """
    bad: list[str] = []
    total = 0
    for h in files:
        html = h.read_text(encoding="utf-8")
        if MODULE_SCRIPT_RE.search(html):
            bad.append(f"모듈 스크립트가 남았다(file://에서 막힌다): {h}")
        for m in SCRIPT_SRC_RE.finditer(html):
            src = m.group(1)
            if src.startswith(("http://", "https://", "//", "data:")):
                continue
            total += 1
            if not (h.parent / src).exists():
                bad.append(f"스크립트가 없는 파일을 가리킨다: {h} -> {src}")
    return bad, total


def check_asset_refs(root: Path) -> tuple[list[str], int]:
    """CSS의 url()이 가리키는 로컬 파일이 실제로 있는지 본다."""
    bad: list[str] = []
    total = 0
    for css in sorted(root.rglob("*.css")):
        for ref in URL_RE.findall(css.read_text(encoding="utf-8", errors="ignore")):
            if ref.startswith(("data:", "http:", "https:", "//", "#")):
                continue
            total += 1
            target = (root / ref.lstrip("/")) if ref.startswith("/") else (css.parent / ref)
            if not target.exists():
                bad.append(f"CSS가 없는 파일을 가리킨다: {css} -> {ref}")
    return bad, total


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("dist", nargs="?", default="dist", help="검사할 산출물 폴더 (기본 dist)")
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
    notice_bad = check_third_party_notices(root, files)
    nest_bad = check_nesting(files)
    ref_bad, ref_total = check_asset_refs(root)
    script_bad, script_total = check_scripts(files)

    log.debug("HTML %d개, docx 링크 %d건, CSS 자산 참조 %d건, 스크립트 %d건",
              len(files), docx_total, ref_total, script_total)
    errs = docx_bad + cdn_bad + nest_bad + ref_bad + script_bad + notice_bad
    for e in errs:
        log.error("%s", e)
    log.info("완료 — HTML %d, docx 링크 %d, CSS 자산 참조 %d, 스크립트 %d, 문제 %d",
             len(files), docx_total, ref_total, script_total, len(errs))
    return 1 if errs else 0


if __name__ == "__main__":
    sys.exit(main())
