"""강의안 HTML 검증: 태그 중첩 + 최소 글자 크기(CSS·SVG) + 테이블 래퍼.

검사할 파일은 아래 TARGETS에 직접 적는다. 인자를 주면 인자가 우선한다.
    python tools/check_html.py                      # TARGETS만 검사
    python tools/check_html.py 인공지능기초/1-1-2.*.html   # 인자만 검사

위반이 하나라도 있으면 종료 코드 1로 끝난다(경고는 0).
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# ── 검사 대상 ────────────────────────────────────────────────────────────────
# 지금 손대고 있는 파일만 남긴다. 글롭 가능. 끝난 파일은 지운다.
TARGETS = [
    "인공지능기초/1-1-2.인공지능의-원리.html",
]

# ── 기준값 ───────────────────────────────────────────────────────────────────
# 375px 화면에서 section-card 안쪽이 실제로 갖는 폭(브라우저 실측 340px).
# SVG 텍스트는 viewBox 폭에 맞춰 축소되므로 이 값으로 실효 크기를 환산한다.
RENDER_W = 340.0
MIN_PX = 12.0       # 이 아래는 위반
WARN_PX = 16.0      # 12~16px는 확인 필요

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


def is_decorative_icon(tag, cls):
    """글자가 아니라 장식인 요소(불릿용 Font Awesome 아이콘)인가."""
    return tag == "i" and "fa-" in cls


class Checker(HTMLParser):
    """태그 중첩 · 테이블 래퍼 · SVG 글자 크기를 한 번의 파싱으로 검사한다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, line, attrs_dict)]
        self.nesting = []        # 위반: 중첩
        self.unwrapped = []      # 위반: overflow-x-auto 래퍼 없는 표
        self.tables = 0
        self.svg_small = []      # 위반: SVG 실효 글자 크기 < MIN_PX
        self.svg_warn = []       # 경고: MIN_PX ~ WARN_PX
        self.css_small = []      # 위반: 인라인 style 글자 크기 < MIN_PX
        self.css_warn = []       # 경고: MIN_PX ~ WARN_PX

    # -- 공통 --------------------------------------------------------------
    def _inspect(self, tag, attrs):
        a = dict(attrs)
        line = self.getpos()[0]

        if tag == "table":
            self.tables += 1
            # 조상 중 overflow-x-auto 클래스를 가진 요소가 실제로 있는지 본다.
            if not any("overflow-x-auto" in (p.get("class") or "")
                       for _, _, p in self.stack):
                self.unwrapped.append(line)

        in_svg = self._in_svg()
        if "font-size" in a and in_svg:
            self._check_svg_font(line, a["font-size"])

        # 인라인 style의 font-size. 태그가 여러 줄에 걸쳐도 class를 함께 볼 수 있으므로
        # 아이콘 불릿(fa-…) 제외 판정이 줄 단위 검사보다 정확하다.
        m = re.search(r"font-size:\s*([\d.]+)(px|rem|em)", a.get("style") or "")
        if m and not is_decorative_icon(tag, a.get("class") or ""):
            val = float(m.group(1)) * (1.0 if m.group(2) == "px" else 16.0)
            if in_svg:
                self._check_svg_font(line, f"{val}px")
            else:
                self._record_css(line, f"{m.group(1)}{m.group(2)}", val)
        return a

    def _record_css(self, line, raw, px):
        if px >= WARN_PX:
            return
        msg = f"{line}행: font-size {raw} (≈{px:.0f}px)"
        (self.css_small if px < MIN_PX else self.css_warn).append(msg)

    def _in_svg(self):
        return any(t == "svg" for t, _, _ in self.stack)

    def _viewbox_scale(self):
        """가장 안쪽 svg의 viewBox 폭 기준 축소 비율. viewBox가 없으면 1.0.

        실제 그려지는 폭은 style의 min-width·max-width에 좌우된다.
        min-width가 화면 폭보다 크면 SVG는 줄지 않고 래퍼가 가로로 스크롤된다.
        """
        for tag, _, a in reversed(self.stack):
            if tag != "svg":
                continue
            vb = a.get("viewBox") or a.get("viewbox")
            if not vb:
                return 1.0
            parts = re.split(r"[\s,]+", vb.strip())
            if len(parts) != 4:
                return 1.0
            try:
                vb_w = float(parts[2])
            except ValueError:
                return 1.0
            if vb_w <= 0:
                return 1.0

            style = a.get("style") or ""

            def px(prop):
                m = re.search(prop + r"\s*:\s*([\d.]+)px", style)
                return float(m.group(1)) if m else None

            drawn = RENDER_W
            mx = px("max-width")
            if mx is not None:
                drawn = min(drawn, mx)
            mn = px("min-width")
            if mn is not None:
                drawn = max(drawn, mn)
            return drawn / vb_w
        return 1.0

    def _check_svg_font(self, line, raw):
        m = re.match(r"\s*([\d.]+)\s*(px|rem|em)?\s*$", str(raw))
        if not m:
            return
        val = float(m.group(1))
        unit = m.group(2)
        if unit == "rem" or unit == "em":
            val *= 16.0
        eff = val * self._viewbox_scale()
        msg = f"{line}행: SVG font-size {raw} → 375px에서 약 {eff:.1f}px"
        if eff < MIN_PX:
            self.svg_small.append(msg)
        elif eff < WARN_PX:
            self.svg_warn.append(msg)

    # -- HTMLParser 훅 ------------------------------------------------------
    def handle_startendtag(self, tag, attrs):
        self._inspect(tag, attrs)

    def handle_starttag(self, tag, attrs):
        a = self._inspect(tag, attrs)
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0], a))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.nesting.append(f"{self.getpos()[0]}행: </{tag}> 짝 없음")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
            return
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                unclosed = [f"<{t}>({ln}행)" for t, ln, _ in self.stack[i + 1:]]
                self.nesting.append(
                    f"{self.getpos()[0]}행: </{tag}> 앞에 닫히지 않은 태그 "
                    f"{', '.join(unclosed)}")
                del self.stack[i:]
                return
        self.nesting.append(f"{self.getpos()[0]}행: </{tag}> 짝 없음")


def style_block_font_sizes(src):
    """<style> 블록 안의 font-size를 px로 환산해 (위반, 경고)로 나눈다.

    인라인 style은 Checker가 본다(태그·클래스를 함께 봐야 장식 아이콘을 걸러 낼 수 있다).
    """
    bad, warn = [], []
    pat = re.compile(r"font-size:\s*([\d.]+)(px|rem|em)")
    for block in re.finditer(r"<style[^>]*>(.*?)</style>", src, re.S | re.I):
        base_line = src[:block.start(1)].count("\n") + 1
        body = block.group(1)
        for m in pat.finditer(body):
            px = float(m.group(1)) * (1.0 if m.group(2) == "px" else 16.0)
            if px >= WARN_PX:
                continue
            line = base_line + body[:m.start()].count("\n")
            entry = f"{line}행: {m.group(0)} (≈{px:.0f}px)"
            (bad if px < MIN_PX else warn).append(entry)
    return bad, warn


def check(path: Path) -> tuple[int, int]:
    """(위반 수, 경고 수)를 돌려준다."""
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    print(f"=== {path.name} ({len(lines)}행) ===")
    violations = warnings = 0

    c = Checker()
    c.feed(src)
    for t, ln, _ in c.stack:
        c.nesting.append(f"{ln}행: <{t}> 닫히지 않음")

    def by_line(items):
        return sorted(items, key=lambda s: int(re.match(r"(\d+)행", s).group(1)))

    def report(label, bad, warn=()):
        nonlocal violations, warnings
        bad, warn = by_line(bad), by_line(warn)
        violations += len(bad)
        warnings += len(warn)
        if bad:
            print(f"  [{label}] 위반 {len(bad)}건")
            for b in bad:
                print("   -", b)
        elif warn:
            print(f"  [{label}] OK (확인 필요 {len(warn)}건)")
        else:
            print(f"  [{label}] OK")
        for w in warn:
            print("   ? ", w)

    report("태그 중첩", c.nesting)

    # Tailwind 소형 크기 클래스
    tw = [f"{i}행: {m.group(0)}"
          for i, ln in enumerate(lines, 1)
          for m in re.finditer(r"\btext-(sm|xs)\b|text-\[(0?\.\d+rem|\d{1,2}px)\]", ln)]
    css_bad, css_warn = style_block_font_sizes(src)
    report("글자 크기(CSS)", tw + css_bad + c.css_small, css_warn + c.css_warn)

    report("글자 크기(SVG)", c.svg_small, c.svg_warn)

    if c.unwrapped:
        violations += len(c.unwrapped)
        print(f"  [테이블 래퍼] {c.tables}개 중 미포장 {c.unwrapped}")
    else:
        print(f"  [테이블 래퍼] {c.tables}개 중 전부 OK")

    return violations, warnings


def resolve(patterns):
    """상대 경로는 현재 디렉터리 → 저장소 루트 순으로 찾는다. 글롭 가능."""
    out = []
    for p in patterns:
        path = Path(p)
        if any(ch in p for ch in "*?["):
            if path.is_absolute():
                matched = sorted(path.parent.glob(path.name))
            else:
                matched = sorted(Path.cwd().glob(p)) or sorted(ROOT.glob(p))
            if not matched:
                print(f"!! 일치하는 파일 없음: {p}", file=sys.stderr)
            out += matched
        else:
            for cand in ([path] if path.is_absolute() else [Path.cwd() / p, ROOT / p]):
                if cand.exists():
                    out.append(cand)
                    break
            else:
                print(f"!! 파일 없음: {p}", file=sys.stderr)
    return out


def main():
    patterns = sys.argv[1:] or TARGETS
    if not patterns:
        print("검사할 파일이 없다. tools/check_html.py의 TARGETS를 채우거나 "
              "인자로 파일을 넘겨라.", file=sys.stderr)
        return 2

    files = resolve(patterns)
    if not files:
        return 2

    total_v = total_w = 0
    for f in files:
        v, w = check(f)
        total_v += v
        total_w += w

    print(f"--- {len(files)}개 파일: 위반 {total_v}건, 확인 필요 {total_w}건 ---")
    return 1 if total_v else 0


if __name__ == "__main__":
    sys.exit(main())
