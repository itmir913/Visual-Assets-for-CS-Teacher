#!/usr/bin/env python3
"""`simulator/index.html`을 **루트 `index.html`에서 만들어 낸다.**

시뮬레이터만 담은 입구가 따로 있어야 그 주소만 떼어 심의를 받을 수 있다.
그런데 같은 화면을 두 벌 손으로 관리하면 **한쪽이 조용히 낡는다** — 낡아도
아무도 빨간불을 켜 주지 않으므로, 틀린 줄 모른 채 몇 달이 간다.

그래서 손으로 쓰지 않는다. 루트 `index.html` 하나만 고치고 여기서 굽는다.

    npm run gen:sim-index     다시 굽는다 (index.html을 고쳤으면 이것)
    npm run check:sim-index   구운 결과와 저장소의 파일이 같은지 본다 (`npm run check`가 부른다)

**굽는 것을 저장소에 담는 까닭** — `npm run dev`가 소스 폴더를 그대로 서빙하고
Vite도 디스크의 `simulator/**/*.html`을 훑어 입력을 정한다. 파일이 없으면
개발 서버에서 열리지 않고 빌드 입력에도 안 잡힌다.

여기서 하는 일은 아래 다섯뿐이다. **하나라도 자기 자리를 못 찾으면 죽는다** —
루트가 바뀌었는데 조용히 반쪽짜리를 굽는 것이 이 도구가 막으려는 바로 그 일이다.

덤으로 **아무 데서도 링크되지 않는 시뮬레이터**를 찾는다. 새 시뮬레이터를 만들고
`index.html`에 걸지 않으면 학생에게 가는 길이 없는데, **화면은 멀쩡해 보인다** —
없는 것은 눈에 띄지 않기 때문이다.
"""
from __future__ import annotations

import argparse
import difflib
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "tools"))

from logs import get_logger  # noqa: E402

SRC = "index.html"
OUT = "simulator/index.html"

# 남길 섹션. 루트 index.html의 `<section id="...">`와 같아야 한다.
KEEP_ID = "simulator"

BANNER = """<!-- ┌──────────────────────────────────────────────────────────────────────┐
     │ 이 파일은 루트 index.html에서 **만들어 낸 것이다. 손으로 고치지 않는다.**   │
     │ 고칠 곳은 index.html이고, 고친 뒤 `npm run gen:sim-index`를 돌린다.    │
     │ `npm run check`가 어긋남을 잡으므로 손으로 고친 것은 CI에서 되돌아온다.   │
     └──────────────────────────────────────────────────────────────────────┘ -->
"""

SECTION_RE = re.compile(
    r'\n    <!--[^\n]*-->\n    <section class="scroll-mt-24" id="(?P<id>[\w-]+)">'
    r'.*?\n    </section>\n',
    re.DOTALL,
)
NAV_LINK_RE = re.compile(
    r'\n *<a class="[^"]*"\n *href="#(?P<id>[\w-]+)" data-target="(?P=id)">[^<]*</a>'
)
SIM_HREF_RE = re.compile(r'href="simulator/')
# 머리말의 「시뮬레이터 모아보기」 버튼. **여기서는 제 페이지를 가리키게 된다.**
SHORTCUT_RE = re.compile(r'\n *<a id="simulator-shortcut".*?</a>', re.DOTALL)
SHORTCUT_NOTE_RE = re.compile(r'\n *<!-- 시뮬레이터만 모은 입구.*?-->', re.DOTALL)
# 루트를 기준으로 적힌 주소. 한 단 안에서 보려면 앞에 한 단을 더 붙여야 한다.
# **하나씩 못박는다.** 루트 푸터에 링크가 하나 더 붙었는데 여기 안 적으면
# 입구에서만 죽는 주소가 되는데, 그건 아무도 안 눌러 보는 자리다.
ROOT_HREFS = [
    ('href="./THIRD-PARTY-NOTICES.txt"', 'href="../THIRD-PARTY-NOTICES.txt"'),
    ('href="privacy/index.html"', 'href="../privacy/index.html"'),
]

# **일부러** index.html에 걸지 않는 시뮬레이터. 지금은 없다.
# 적을 때는 왜 안 거는지도 함께 적는다 — 안 적으면 「빠뜨린 것」과 구별되지 않는다.
UNLINKED_OK: set[str] = set()


class Stale(RuntimeError):
    """루트 index.html이 이 도구가 아는 모양이 아니다."""


def _sub_once(pattern: re.Pattern, repl: str, text: str, what: str) -> str:
    out, n = pattern.subn(repl, text)
    if n != 1:
        raise Stale(f"{what}: {n}곳을 찾았다 (1곳이어야 한다)")
    return out


def build(src: str) -> str:
    """루트 index.html의 원문을 받아 simulator/index.html의 원문을 돌려준다."""
    # 1. 시뮬레이터 말고 다른 과목 섹션을 뺀다.
    ids = [m.group("id") for m in SECTION_RE.finditer(src)]
    if KEEP_ID not in ids:
        raise Stale(f'섹션 id="{KEEP_ID}"를 못 찾았다 (찾은 것: {ids})')
    if len(ids) < 2:
        raise Stale(f"섹션이 {len(ids)}개뿐이다 — 뺄 것이 없다면 이 도구가 필요 없다")
    out = SECTION_RE.sub(lambda m: m.group(0) if m.group("id") == KEEP_ID else "", src)

    # 2. 그 섹션들을 가리키던 nav 링크도 함께 뺀다. 남는 것 하나는 그대로 둔다.
    nav_ids = [m.group("id") for m in NAV_LINK_RE.finditer(out)]
    if sorted(nav_ids) != sorted(ids):
        raise Stale(f"nav 링크와 섹션이 짝이 안 맞는다: nav={nav_ids} 섹션={ids}")
    out = NAV_LINK_RE.sub(lambda m: m.group(0) if m.group("id") == KEEP_ID else "", out)

    # 3. 제 페이지를 가리키게 되는 바로가기 버튼은 뺀다.
    out = _sub_once(SHORTCUT_RE, "", out, "머리말의 시뮬레이터 바로가기")
    out = _sub_once(SHORTCUT_NOTE_RE, "", out, "그 버튼에 달린 주석")

    # 4. 링크는 한 단 안에서 본 주소가 된다. `simulator/cs/…` → `cs/…`
    out, n = SIM_HREF_RE.subn('href="', out)
    if n == 0:
        raise Stale("시뮬레이터 링크를 하나도 못 찾았다")

    # 5. 루트를 기준으로 적힌 주소는 한 단 올라간다.
    for src_href, dst_href in ROOT_HREFS:
        if out.count(src_href) != 1:
            raise Stale(f"{src_href}: {out.count(src_href)}곳을 찾았다 (1곳이어야 한다)")
        out = out.replace(src_href, dst_href)

    # **제목은 손대지 않는다.** `<title>`은 `<h1>`과 같아야 한다는 규칙이 있고
    # (check_html의 「제목 일치」), hero의 `<h1>`은 사이트 이름이라 바꿀 것이 아니다.
    # 그래서 탭 이름이 루트와 같다 — 주소로 구별한다.

    return out.replace("<!DOCTYPE html>\n", "<!DOCTYPE html>\n" + BANNER, 1)


def unlinked_simulators(root: Path, page: str) -> list[str]:
    """`simulator/` 안에 있는데 그 입구가 가리키지 않는 페이지."""
    linked = {m for m in re.findall(r'href="([\w./-]+\.html)"', page)}
    bad = []
    for p in sorted((root / "simulator").rglob("*.html")):
        rel = p.relative_to(root / "simulator").as_posix()
        if rel == "index.html" or rel in UNLINKED_OK:
            continue
        if rel not in linked:
            bad.append(f"아무도 링크하지 않는 시뮬레이터: simulator/{rel}"
                       f" (일부러 그렇다면 gen_simulator_index.py의 UNLINKED_OK에 적는다)")
    for rel in sorted(UNLINKED_OK):
        if not (root / "simulator" / rel).exists():
            bad.append(f"UNLINKED_OK에 적힌 시뮬레이터가 없다: simulator/{rel}")
    return bad


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--check", action="store_true",
                    help="쓰지 않고 저장소의 파일과 같은지만 본다")
    args = ap.parse_args()
    log = get_logger("gen:sim-index" if not args.check else "check:sim-index")

    src = (REPO_ROOT / SRC).read_text(encoding="utf-8")
    try:
        made = build(src)
    except Stale as e:
        log.error(f"✗ {SRC}이 이 도구가 아는 모양이 아니다 — {e}")
        log.error(f"  {SRC}을 고쳤다면 tools/gen_simulator_index.py의 규칙도 함께 고친다.")
        return 1

    bad = unlinked_simulators(REPO_ROOT, made)

    target = REPO_ROOT / OUT
    if args.check:
        have = target.read_text(encoding="utf-8") if target.exists() else ""
        if have != made:
            log.error(f"✗ {OUT}이 {SRC}과 어긋난다. `npm run gen:sim-index`로 다시 굽는다.")
            diff = difflib.unified_diff(have.splitlines(), made.splitlines(),
                                        fromfile=OUT, tofile=f"{SRC}에서 구운 것", lineterm="")
            for line in list(diff)[:40]:
                log.error("  " + line)
            bad.append("어긋남")
    else:
        target.write_text(made, encoding="utf-8")
        log.info(f"{OUT} — {len(made.splitlines())}줄")

    for b in bad:
        log.error("  ✗ " + b)
    if bad:
        return 1
    log.info(f"✓ {OUT}: {SRC}과 같다. 링크가 빠진 시뮬레이터도 없다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
