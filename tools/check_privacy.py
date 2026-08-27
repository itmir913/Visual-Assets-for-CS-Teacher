#!/usr/bin/env python3
"""개인정보 처리방침이 **아직 참인지** 본다.

`privacy/index.html`은 바깥에 내놓는 정본이고, 그 안에는 코드에 매인 단정이 넷 있다.

    제4조  브라우저 저장소에 아무것도 남기지 않는다
    제7조  바깥으로 나가는 요청은 밝힌 것뿐이다
    제8조  카메라를 쓰는 시뮬레이터는 컴퓨터 비전 하나뿐이다
    (링크) 첫 화면과 시뮬레이터 입구에서 이 방침으로 가는 길이 있다

**산문은 고쳐도 CI가 보지 않으므로 조용히 거짓이 된다.** 시뮬레이터 하나에
`localStorage` 한 줄을 넣는 순간 방침이 틀린 말이 되는데, 화면은 멀쩡하고
검사는 초록이고 아무도 그 문서를 다시 읽지 않는다. 그래서 여기서 기계가 지킨다.

**여기서 빨간불이 나면 둘 중 하나를 골라야 한다** — 그 코드를 되돌리거나,
방침을 고치고 시행일을 새로 적거나. 검사를 느슨하게 푸는 것은 답이 아니다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "tools"))

from logs import get_logger  # noqa: E402
from subjects import html_files  # noqa: E402

POLICY = "privacy/index.html"

# 제4조 — 「쿠키를 심지 않고 브라우저 저장소에 자료를 남기지 않는다」.
STORAGE_RE = re.compile(r"\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b")

# 제7조 — 소스가 스스로 부르는 바깥 요청. 방침의 표에 적힌 것과 같아야 한다.
FETCH_RE = re.compile(r"""fetch\(\s*['"]https?://([^/'"]+)""")
ALLOWED_FETCH_HOSTS = {
    # 첫 화면과 시뮬레이터 입구가 「오프라인 묶음이 언제 만들어졌는지」를 묻는다.
    "api.github.com",
}

# 제8조 — 카메라를 켜는 페이지. **하나뿐이라는 것이 방침의 단정이다.**
CAMERA_RE = re.compile(r"\bgetUserMedia\b|\bcreateCapture\s*\(")
CAMERA_PAGES = {"simulator/ai/computer-vision-ml5.html"}

# 방침으로 가는 길을 두어야 하는 입구.
ENTRANCES = {
    "index.html": "privacy/index.html",
    "simulator/index.html": "../privacy/index.html",
}


def main() -> int:
    log = get_logger("check_privacy")
    bad: list[str] = []

    if not (REPO_ROOT / POLICY).exists():
        log.error(f"✗ {POLICY}이 없다. 사이트가 방침 없이 나간다")
        return 1

    files = [p for p in html_files()] + sorted((REPO_ROOT / "src/entries").rglob("*.js"))
    cameras: set[str] = set()

    for p in files:
        rel = p.relative_to(REPO_ROOT).as_posix()
        src = p.read_text(encoding="utf-8")

        for m in STORAGE_RE.finditer(src):
            bad.append(f"{rel}: 「{m.group(1)}」 — 방침 제4조가 "
                       f"「브라우저 저장소에 자료를 남기지 않는다」고 못박았다")

        for m in FETCH_RE.finditer(src):
            if m.group(1) not in ALLOWED_FETCH_HOSTS:
                bad.append(f"{rel}: 밝히지 않은 바깥 요청 {m.group(1)} — 방침 제7조의 표에 적거나, "
                           f"괜찮다면 check_privacy.py의 ALLOWED_FETCH_HOSTS에 적는다")

        if CAMERA_RE.search(src):
            cameras.add(rel)

    for rel in sorted(cameras - CAMERA_PAGES):
        bad.append(f"{rel}: 카메라를 쓴다 — 방침 제8조는 컴퓨터 비전 하나뿐이라고 적었다")
    for rel in sorted(CAMERA_PAGES - cameras):
        bad.append(f"{rel}: 카메라를 쓰지 않게 되었다 — 방침 제8조를 그대로 두면 없는 것을 설명한다")

    for rel, href in sorted(ENTRANCES.items()):
        page = REPO_ROOT / rel
        if not page.exists():
            bad.append(f"{rel}이 없다 — 방침으로 가는 길을 둘 자리다")
        elif f'href="{href}"' not in page.read_text(encoding="utf-8"):
            bad.append(f"{rel}: 개인정보 처리방침 링크가 없다 (href=\"{href}\")")

    for b in bad:
        log.error("  ✗ " + b)
    log.info(f"완료 — 파일 {len(files)}, 위반 {len(bad)}")
    return 1 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
