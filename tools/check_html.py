"""강의안 HTML 검증: 태그 중첩 + 최소 글자 크기(CSS·SVG) + 테이블 래퍼 + 제목·금지 요소.

    python tools/check_html.py                      # 저장소 전체 (CI가 쓰는 방식)
    python tools/check_html.py 인공지능기초/1-1-2.*.html   # 인자만 검사

위반이 하나라도 있으면 종료 코드 1로 끝난다(경고는 0).

**인자가 없으면 저장소 전체를 검사한다.** 예전에는 손대는 파일만 목록에 적는
방식이었는데, 그러면 손대지 않은 파일의 위반이 조용히 쌓인다. 실제로 그렇게
377건이 쌓인 채 발견됐다 — 검사가 CI 밖에 있으면 통과했다는 말에 뜻이 없다.
"""
import re
import sys
from html import unescape
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402
from subjects import STANDALONE, html_files  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# ── 검사에서 빼는 것 ─────────────────────────────────────────────────────────
# **경로를 여기 직접 적지 않는다.** subjects.json이 유일한 출처이므로 폴더가
# 옮겨져도 따라온다. 시뮬레이터를 다른 자리로 옮길 계획이 있어서 특히 중요하다.

# 글자 크기 규칙은 강의노트의 것이다 — CLAUDE.md: 「시뮬레이터의 조작 UI는
# 이 규칙의 범위 밖이다」. standalone은 강의노트가 아니므로 이 검사를 건너뛴다.
# (제목·태그 중첩·표 래퍼 같은 나머지 규칙은 그대로 적용한다.)
FONT_EXEMPT_DIRS = [s["dir"] for s in STANDALONE]

# 전면 재작성을 기다리느라 검사에서 빼 둘 폴더. 지금 고쳐도 파일명·번호 체계가
# 바뀌면서 버려질 때만 쓴다. 「프로그래밍(C)」와 「프로그래밍(Python)」이
# 2026-08-12에 재작성을 마치고 폴더째 사라져 목록이 비었다.
REWRITE_PENDING: list[str] = []

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


def style_len(style, prop):
    """인라인 style에서 길이 값을 px로 읽는다. 없으면 None."""
    m = re.search(prop + r"\s*:\s*([\d.]+)(px|rem)", style)
    if not m:
        return None
    return float(m.group(1)) * (1.0 if m.group(2) == "px" else 16.0)


def tw_min_w(cls):
    """Tailwind 임의값 클래스 `min-w-[480px]` · `min-w-[30rem]`을 px로 읽는다."""
    m = re.search(r"min-w-\[([\d.]+)(px|rem)\]", cls)
    if not m:
        return None
    return float(m.group(1)) * (1.0 if m.group(2) == "px" else 16.0)


class Checker(HTMLParser):
    """태그 중첩 · 테이블 래퍼 · SVG 글자 크기를 한 번의 파싱으로 검사한다."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []          # [(tag, line, attrs_dict)]
        self.nesting = []        # 위반: 중첩
        self.unwrapped = []      # 위반: overflow-x-auto 래퍼 없는 표
        self.wide_unwrapped = [] # 위반: min-width가 화면보다 넓은데 래퍼 없는 요소
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

        # min-width가 375px 화면 폭보다 넓은 요소는 어딘가에서 넘친다.
        # table은 위에서 이미 무조건 검사하므로 여기서는 그 외 태그만 본다.
        if tag != "table":
            mn = style_len(a.get("style") or "", "min-width")
            if mn is None:
                mn = tw_min_w(a.get("class") or "")
            if mn is not None and mn > RENDER_W:
                if not any("overflow-x-auto" in (p.get("class") or "")
                           for _, _, p in self.stack):
                    self.wide_unwrapped.append(
                        f"{line}행: <{tag}> min-width {mn:.0f}px > {RENDER_W:.0f}px")

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

        실제 그려지는 폭은 min-width·max-width에 좌우된다.
        min-width가 화면 폭보다 크면 SVG는 줄지 않고 래퍼가 가로로 스크롤된다.

        min-width는 SVG 자신뿐 아니라 **조상 요소**에도 붙는다.
        `<div class="min-w-[480px]"><svg class="w-full">` 처럼 래퍼가 폭을 잡아 주는
        형태가 흔한데, SVG의 style만 보면 줄어든다고 잘못 판정한다.
        그래서 조상의 인라인 style과 Tailwind `min-w-[…]` 클래스까지 함께 본다.
        (SVG가 `w-full`이 아니면 조상 폭이 그대로 전해지지 않지만,
        이 저장소의 SVG는 모두 `w-full`이므로 그 경우는 따지지 않는다.)
        """
        idx = None
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == "svg":
                idx = i
                break
        if idx is None:
            return 1.0

        a = self.stack[idx][2]
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

        drawn = RENDER_W
        mx = style_len(a.get("style") or "", "max-width")
        if mx is not None:
            drawn = min(drawn, mx)
        for _, _, anc in self.stack[:idx + 1]:
            mn = style_len(anc.get("style") or "", "min-width")
            if mn is None:
                mn = tw_min_w(anc.get("class") or "")
            if mn is not None:
                drawn = max(drawn, mn)
        return drawn / vb_w

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


FA_VERSION = "6.7.2"   # Font Awesome은 이 버전으로 통일한다


def _line_of(src, pos):
    return src[:pos].count("\n") + 1


def _plain(s):
    """사람에게 보여 줄 형태. 태그·엔티티를 풀고 공백을 하나로 줄인다."""
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def _text_key(s):
    """제목 비교용 열쇠. 태그·엔티티를 풀고 글자와 숫자만 남긴다.

    파일명은 공백을 `-`로 적고, 본문은 `&middot;`처럼 엔티티를 쓰기도 한다.
    구분 기호를 전부 떼어 내야 네 곳을 같은 기준으로 비교할 수 있다.
    """
    s = unescape(re.sub(r"<[^>]+>", " ", s))
    return re.sub(r"[^0-9A-Za-z가-힣]", "", s)


def title_rules(path: Path, src: str):
    """제목이 파일명·<title>·<h1> 세 곳에서 같은지, h1에 <br>이 없는지.

    **nav 제목은 대조하지 않는다.** nav 바는 폭이 좁아 줄여 적는 것이 관행이다
    (`회귀 분석으로 행복 요건 찾기` → `회귀로 행복 요건 찾기`). 줄인 것인지
    어긋난 것인지는 기계가 가릴 수 없으므로 아예 보지 않는다.

    파일명은 두 꼴을 받는다 — `번호.제목.html`(중단원이 있는 과목)과
    `01-제목.html`(중단원이 없는 문법 노트). 둘 다 아니면 대조를 건너뛴다.
    """
    bad = []

    m_title = re.search(r"<title>(.*?)</title>", src, re.S | re.I)
    m_h1 = re.search(r"<h1[^>]*>(.*?)</h1>", src, re.S | re.I)
    if not m_h1:
        return bad
    h1_line = _line_of(src, m_h1.start())

    if "<br" in m_h1.group(1):
        bad.append(f"{h1_line}행: <h1> 안에 <br> — 제목은 한 줄로 쓰고 "
                   f"줄바꿈은 브라우저에 맡긴다")

    names = {}
    if m_title:
        names["title"] = m_title.group(1)
    names["h1"] = m_h1.group(1)

    stem = path.stem                      # "1-2-1.사물-인터넷이란-무엇인가"
    if "." in stem:
        names["파일명"] = stem.split(".", 1)[1]
    elif re.match(r"^\d+-", stem):        # "01-변수와-자료형"
        names["파일명"] = stem.split("-", 1)[1]

    keys = {k: _text_key(v) for k, v in names.items()}
    ref = keys["h1"]
    diff = [k for k in ("파일명", "title") if k in keys and keys[k] != ref]
    if diff:
        shown = " / ".join(f"{k}={_plain(names[k])}"
                           for k in ("h1", "파일명", "title") if k in names)
        bad.append(f"{h1_line}행: 제목이 어긋난다 ({', '.join(diff)}) — {shown}")
    return bad


# 쓰지 않기로 한 낱말과 그 자리에 쓸 말.
#
# **한 번 고친 말이 다시 기어들어 오는 것을 막으려고 둔다.** 사람이 기억으로 지키면
# 새 파일을 쓸 때마다 다시 새어 나온다 — 실제로 「견주다」는 한 번 전부 바꾼 뒤
# 새 시뮬레이터를 쓰면서 열몇 곳이 다시 들어왔다.
#
# 낱말을 더할 때는 **어간이 활용형까지 걸리도록** 적는다. 「견주다」는 견주·견줄·
# 견준·견줍·견줘·견줌으로 갈라지므로 끝 음절을 묶어 준다.
#
# 여기 걸리는 것은 화면에 나오는 글만이 아니라 **주석과 코드의 문자열까지**다.
# 일부러 그렇게 둔다 — 주석에 남아 있으면 다음 사람이 그 말을 따라 쓴다.
BANNED_WORDS = [
    (r"견[주줄준줍줘줌]", "견주다", "비교하다"),
]


def banned_rules(src: str):
    """소스만 보고 잡히는 금지 요소들. 전부 CLAUDE.md의 규칙이다."""
    bad = []

    for pattern, 쓴말, 쓸말 in BANNED_WORDS:
        for m in re.finditer(pattern, src):
            bad.append(f"{_line_of(src, m.start())}행: 「{쓴말}」 — 「{쓸말}」로 쓴다")

    # <sup>/<sub>은 브라우저가 0.83em으로 줄여 text-base 문단에서 12~13.5px이 된다.
    # 소스에 text-sm이 없으므로 글자 크기 검사로는 통과한다.
    for m in re.finditer(r"<su[pb]\b", src):
        bad.append(f"{_line_of(src, m.start())}행: {m.group(0)}> — "
                   f"제곱은 &sup2; 문자로, 아래첨자는 문장을 고쳐 없앤다")

    # list-inside는 마커가 콘텐츠 박스 안에 그려져 들여쓰기가 무너진다.
    for m in re.finditer(r"\blist-inside\b", src):
        bad.append(f"{_line_of(src, m.start())}행: list-inside — "
                   f"list-outside와 pl-5 이상을 쓴다")

    # Font Awesome 버전 고정.
    for m in re.finditer(r"font-awesome/([\d.]+)/", src):
        if m.group(1) != FA_VERSION:
            bad.append(f"{_line_of(src, m.start())}행: Font Awesome "
                       f"{m.group(1)} — {FA_VERSION}으로 통일한다")
    return bad


def under(path: Path, dirs) -> bool:
    """저장소 기준 상대 경로가 dirs 중 하나 아래에 있는가."""
    try:
        rel = path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return False
    return any(rel == d or rel.startswith(d.rstrip("/") + "/") for d in dirs)


def _at(shown: str, item: str) -> str:
    """「232행: …」에서 앞의 줄 번호를 떼어 `파일:232` 꼴로 만든다."""
    m = re.match(r"(\d+)행", item)
    return f"{shown}:{m.group(1)}" if m else shown


def _msg(item: str) -> str:
    """줄 번호를 뗀 나머지. 줄 번호는 앞에 이미 붙였다."""
    return re.sub(r"^\d+행:\s*", "", item)


def check(path: Path, log) -> tuple[int, int]:
    """(위반 수, 경고 수)를 돌려준다."""
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    try:
        shown = path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        shown = path.name
    log.debug("%s (%d행)", shown, len(lines))
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
        for b in bad:
            log.error("%s [%s] %s", _at(shown, b), label, _msg(b))
        if not bad and not warn:
            log.debug("  [%s] OK", label)
        for w in warn:
            log.warning("%s [%s] %s", _at(shown, w), label, _msg(w))

    report("태그 중첩", c.nesting)

    if under(path, FONT_EXEMPT_DIRS):
        log.debug("  [글자 크기] 건너뜀 — 강의노트가 아니다(조작 UI)")
    else:
        # Tailwind 소형 크기 클래스
        tw = [f"{i}행: {m.group(0)}"
              for i, ln in enumerate(lines, 1)
              for m in re.finditer(r"\btext-(sm|xs)\b|text-\[(0?\.\d+rem|\d{1,2}px)\]", ln)]
        css_bad, css_warn = style_block_font_sizes(src)
        report("글자 크기(CSS)", tw + css_bad + c.css_small, css_warn + c.css_warn)

        report("글자 크기(SVG)", c.svg_small, c.svg_warn)

    if c.unwrapped:
        violations += len(c.unwrapped)
        log.error("%s [테이블 래퍼] %d개 중 미포장 %s", shown, c.tables, c.unwrapped)
    else:
        log.debug("  [테이블 래퍼] %d개 중 전부 OK", c.tables)

    report("고정폭 래퍼", c.wide_unwrapped)
    report("제목 일치", title_rules(path, src))
    report("금지 요소", banned_rules(src))

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
                get_logger("check_html").error("일치하는 파일 없음: %s", p)
            out += matched
        else:
            for cand in ([path] if path.is_absolute() else [Path.cwd() / p, ROOT / p]):
                if cand.exists():
                    out.append(cand)
                    break
            else:
                get_logger("check_html").error("파일 없음: %s", p)
    return out


def main():
    args = [a for a in sys.argv[1:] if a not in ("-v", "--verbose")]
    # 파일을 짚어 부르면 그 파일의 항목별 결과를 보여 준다 → tools/logs.py
    verbose = len(args) != len(sys.argv[1:]) or bool(args)
    log = get_logger("check_html", verbose)
    patterns = args
    skipped = 0
    if patterns:
        # 인자로 짚었으면 그대로 검사한다 — 재작성 대기 파일도 봐 준다.
        files = resolve(patterns)
    else:
        # 인자가 없으면 subjects.json이 아는 전부. CI가 이 길로 온다.
        files = html_files()
        keep = [f for f in files if not under(f, REWRITE_PENDING)]
        skipped = len(files) - len(keep)
        files = keep
    if not files:
        return 2

    total_v = total_w = 0
    for f in files:
        v, w = check(f, log)
        total_v += v
        total_w += w

    tail = f", 재작성 대기 건너뜀 {skipped}" if skipped else ""
    log.info("완료 — 파일 %d, 위반 %d, 확인 필요 %d%s",
             len(files), total_v, total_w, tail)
    return 1 if total_v else 0


if __name__ == "__main__":
    sys.exit(main())
