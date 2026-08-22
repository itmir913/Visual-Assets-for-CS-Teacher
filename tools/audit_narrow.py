"""375px에서 «본문 글자가 실제로 몇 px 폭에 놓이는가»를 계산한다.

    python tools/audit_narrow.py                 # 저장소 전체
    python tools/audit_narrow.py 데이터과학/1-1-1.*.html
    python tools/audit_narrow.py --limit 260     # 기준을 바꿔 본다

브라우저를 띄우지 않는다. 조상들의 좌우 여백과, flex·grid 형제가 먼저 가져가는
폭을 차례로 빼서 «남는 폭»을 낸다. md:·lg: 접두사가 붙은 클래스는 375px에서
적용되지 않으므로 보지 않는다.

**이것은 감사이지 검사가 아니다.** 추정이라 몇 px씩 어긋나고, `ci`에 넣으면
글을 조금 늘렸다는 이유로 빨간불이 된다. 되돌아오면 안 되는 두 자리
(.section-card 여백 · <main> 여백)만 `check_html.py`가 지킨다.

셈이 틀리기 쉬운 자리를 셋 밟았고, 셋 다 여기 반영되어 있다.
  - 폭이 안 적힌 flex 형제를 «자란다»고 보면 뱃지 한 칸짜리 열이 절반을 가져간다
    → flex-1·grow가 붙은 것만 자란다고 본다
  - `!p-6`은 .section-card의 여백을 «지운다». 둘 다 빼면 시뮬레이터가 헛걸린다
  - 아이콘 칸은 폭 클래스가 제 몸이 아니라 안쪽 <span>에 붙어 있기도 하다
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

VIEWPORT = 375.0
SPACING = 4.0        # Tailwind 한 칸 = 0.25rem
NARROW = 200.0       # 이 아래면 본문이 토막 난다
MIN_CHARS = 80       # 이만큼은 되어야 «본문»이다

TAG = re.compile(r"<(/?)(div|section|main|article|aside|li|td|th|p|h[1-6])\b([^>]*)>", re.I)
CLS = re.compile(r'class="([^"]*)"')
VOID = re.compile(r"/>\s*$")

PAD = re.compile(r"(?<![-\w:])!?p([xlr]?)-(\d+(?:\.\d+)?)\b")
GAP = re.compile(r"(?<![-\w:])(?:gap|gap-x|space-x)-(\d+(?:\.\d+)?)\b")
WID = re.compile(r"(?<![-\w:])w-(\d+(?:\.\d+)?)\b")
COLS = re.compile(r"(?<![-\w:])grid-cols-(\d+)\b")
MAXW = re.compile(r"(?<![-\w:])max-w-(\w+)\b")
GROW = re.compile(r"(?<![-\w:])(?:flex-1|grow|basis-0|w-full|flex-auto)\b")
BANG_PAD = re.compile(r"!p[xlr]?-\d")

MAXW_PX = {"xs": 320, "sm": 384, "md": 448, "lg": 512, "xl": 576, "2xl": 672,
           "3xl": 768, "4xl": 896, "5xl": 1024, "6xl": 1152, "7xl": 1280,
           "prose": 656, "full": 1e9, "none": 1e9}


def h_padding(cls: str) -> float:
    """좌우로 먹는 여백의 합."""
    total = 0.0
    for side, n in PAD.findall(cls):
        v = float(n) * SPACING
        total += v * 2 if side in ("", "x") else v
    return total


def fixed_w(cls: str):
    m = WID.search(cls)
    return float(m.group(1)) * SPACING if m else None


def strip_tags(s: str) -> str:
    return re.sub(r"<[^>]+>", "", s)


def card_padding(src: str) -> float:
    """.section-card가 좁은 화면에서 실제로 쓰는 좌우 여백(한쪽)."""
    m = re.search(r"\.section-card\s*\{[^}]*padding:\s*([^;]+);", src)
    if not m:
        return 0.0
    v = m.group(1).strip()
    c = re.match(r"clamp\(\s*([\d.]+)rem", v)
    if c:
        return float(c.group(1)) * 16
    f = re.match(r"([\d.]+)rem", v)
    return float(f.group(1)) * 16 if f else 0.0


def main_padding(src: str) -> float:
    m = re.search(r'<main\s[^>]*class="([^"]*)"', src)
    if not m:
        return 0.0
    return h_padding(m.group(1)) / 2


def scan(path: Path, limit=NARROW, min_chars=MIN_CHARS):
    """[(폭, 행, 까닭, 글머리)] — 폭이 좁은 순서가 아니라 문서 순서로 낸다."""
    src = path.read_text(encoding="utf-8", errors="replace")
    i0 = src.find("<main")
    if i0 < 0:
        return []
    body, head_lines = src[i0:], src[:src.find("<main")].count("\n")
    card_pad, main_px = card_padding(src), main_padding(src)

    nodes, st = [], []
    for m in TAG.finditer(body):
        if m.group(1):
            while st:
                i = st.pop()
                if nodes[i][2] == m.group(2).lower():
                    nodes[i] = nodes[i][:5] + (m.start(),)
                    break
            continue
        if VOID.search(m.group(3)):
            continue
        c = CLS.search(m.group(3))
        nodes.append((st[-1] if st else -1, c.group(1) if c else "",
                      m.group(2).lower(), m.start(), m.end(), len(body)))
        st.append(len(nodes) - 1)

    kids = {}
    for i, n in enumerate(nodes):
        kids.setdefault(n[0], []).append(i)

    css_w = {}
    for m in re.finditer(r"\.([\w-]+)\s*\{([^}]*)\}", src[:i0]):
        wm = re.search(r"(?<!-)width:\s*([\d.]+)(px|rem)", m.group(2))
        if wm:
            css_w[m.group(1)] = float(wm.group(1)) * (16 if wm.group(2) == "rem" else 1)

    def intrinsic(i):
        """자라지 않는 칸이 차지하는 폭. 못 알아내면 뱃지 한 칸(44px)으로 본다."""
        own = fixed_w(nodes[i][1])
        if own is not None:
            return own
        for c in nodes[i][1].split():
            if c in css_w:
                return css_w[c]
        best, stack = 0.0, list(kids.get(i, []))
        while stack:
            j = stack.pop()
            w = fixed_w(nodes[j][1])
            if w:
                best = max(best, w)
            for c in nodes[j][1].split():
                if c in css_w:
                    best = max(best, css_w[c])
            stack += kids.get(j, [])
        return best if best > 4 else 44.0

    width = {}

    def inner(i):
        if i in width:
            return width[i]
        p, cls = nodes[i][0], nodes[i][1]
        avail = inner(p) if p >= 0 else VIEWPORT
        if p >= 0:
            pcls, sibs = nodes[p][1], kids.get(p, [])
            gm = GAP.search(pcls)
            gap = float(gm.group(1)) * SPACING if gm else 0.0
            cm = COLS.search(pcls)
            is_row = "flex" in pcls.split() and "flex-col" not in pcls.split()
            if cm:
                n = int(cm.group(1))
                avail = (avail - gap * (n - 1)) / n
            elif is_row and len(sibs) > 1:
                mine = fixed_w(cls)
                if mine is not None:
                    avail = mine
                else:
                    grow = [s for s in sibs if GROW.search(nodes[s][1])]
                    if grow and i in grow:
                        taken = sum(intrinsic(s) for s in sibs if s not in grow)
                        avail = (avail - taken - gap * (len(sibs) - 1)) / len(grow)
                    elif grow:
                        avail = intrinsic(i)
                    else:
                        taken = sum((fixed_w(nodes[s][1]) or 0.0) for s in sibs if s != i)
                        flex = [s for s in sibs if fixed_w(nodes[s][1]) is None]
                        avail -= taken + gap * (len(sibs) - 1)
                        if len(flex) > 1:
                            avail /= len(flex)
        own = fixed_w(cls)
        if own is not None and not (p >= 0 and "flex" in nodes[p][1].split()):
            avail = min(avail, own)
        mm = MAXW.search(cls)
        if mm and mm.group(1) in MAXW_PX:
            avail = min(avail, MAXW_PX[mm.group(1)])
        avail -= h_padding(cls)
        if "section-card" in cls.split() and not BANG_PAD.search(cls):
            avail -= card_pad * 2
        if nodes[i][2] == "main":
            avail = VIEWPORT - main_px * 2
        width[i] = max(avail, 0.0)
        return width[i]

    out = []
    for i, n in enumerate(nodes):
        _, cls, tag, s, e, close = n
        own = strip_tags(re.sub(r"<(div|section|ul|ol|table|svg|pre)\b.*", "",
                                body[e:close], flags=re.S))
        own = re.sub(r"\s+", " ", own).strip()
        if len(own) < min_chars:
            continue
        w = inner(i)
        if w >= limit:
            continue
        # 아이콘을 옆에 세운 가로 배치가 좁혔는가, 여백이 겹쳐 좁아졌는가
        why, j = "여백", i
        while j >= 0:
            pj = nodes[j][0]
            if pj < 0:
                break
            if "flex" in nodes[pj][1].split() and "flex-col" not in nodes[pj][1].split():
                if any(fixed_w(nodes[s][1]) and fixed_w(nodes[s][1]) >= 24
                       for s in kids.get(pj, []) if s != j):
                    why = "아이콘"
                    break
            j = pj
        out.append((round(w), body[:s].count("\n") + 1 + head_lines, why, own[:40]))
    return out


def resolve(patterns):
    if not patterns:
        return sorted(p for p in ROOT.rglob("*.html")
                      if "dist" not in p.parts and "node_modules" not in p.parts)
    files = []
    for pat in patterns:
        hit = sorted(ROOT.glob(pat)) or ([Path(pat)] if Path(pat).exists() else [])
        files += hit
    return files


def main():
    log = get_logger("audit_narrow")
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    limit = NARROW
    if "--limit" in sys.argv:
        limit = float(sys.argv[sys.argv.index("--limit") + 1])
        args = [a for a in args if a != str(int(limit)) and a != str(limit)]

    files = resolve(args)
    total = 0
    for p in files:
        rows = scan(p, limit=limit)
        if not rows:
            continue
        total += len(rows)
        rel = p.relative_to(ROOT) if p.is_absolute() else p
        for w, line, why, text in sorted(rows):
            log.warning("%s:%d [%s] 본문 폭 %dpx :: 「%s」", rel, line, why, w, text)
    log.info("audit_narrow: 완료 — 파일 %d, %.0fpx 미만 %d곳", len(files), limit, total)


if __name__ == "__main__":
    main()
