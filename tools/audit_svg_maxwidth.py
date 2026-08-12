"""SVG 글자가 데스크톱에서 한없이 커지는 파일을 찾는다.

`<svg viewBox="..." class="w-full">`는 부모 컨테이너 폭에 맞춰 늘어난다.
`min-width`(모바일에서 줄어들지 않게 하는 바닥)만 있고 `max-width`(데스크톱에서
커지지 않게 하는 천장)가 없으면, 화면이 넓어질수록 `<text font-size="...">`가
viewBox 대비 비율만큼 계속 커진다.

이 스크립트는 글자(<text font-size="...">)가 있는 SVG 중 `max-width`가 없는
것을 찾아 파일별로 보고한다. 수정은 하지 않는다 — 각 SVG의 실제 배치 폭(그리드
칼럼 등)에 따라 적절한 max-width 값이 다르므로 사람이 정해야 한다.

사용법:
    python tools/audit_svg_maxwidth.py                # 저장소 전체
    python tools/audit_svg_maxwidth.py 인공지능기초    # 디렉터리 지정
"""
import re
import sys
import glob
from html.parser import HTMLParser
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402
from subjects import html_files  # noqa: E402

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}

# Tailwind의 폭 천장 클래스. max-w-full·max-w-none은 천장 구실을 못 하므로 뺀다.
# 끝에 \b를 쓰면 안 된다 — `max-w-[200px]`는 `]` 다음이 공백이라 경계가 서지 않아
# 통째로 안 잡힌다. 대신 클래스 구분자가 오는지를 본다.
MAXW_CLASS_RE = re.compile(
    r"(?:^|\s)max-w-(?:\[[^\]]+\]|xs|sm|md|lg|\d?xl|screen-\w+|prose|fit|min|max)(?=\s|$)"
)

# 폭·높이가 값으로 박혀 있으면(%가 아니면) 아예 늘어나지 않는다.
FIXED_LEN_RE = re.compile(r"^\s*[\d.]+\s*(px)?\s*$")


class SvgScanner(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []  # [(tag, line, attrs)]
        self.flagged = []  # [(svg_line, viewbox_w, min_width, has_text)]
        self._svg_has_text = {}

    def handle_starttag(self, tag, attrs):
        line = self.getpos()[0]
        a = dict(attrs)
        self.stack.append((tag, line, a))

        if tag == "text" and "font-size" in a:
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == "svg":
                    self._svg_has_text[id(self.stack[i])] = True
                    break

        if tag in VOID:
            self.stack.pop()

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                node = self.stack[i]
                del self.stack[i:]
                if tag == "svg" and self._svg_has_text.get(id(node)):
                    self._check_svg(node, self.stack[:])
                return

    def _check_svg(self, node, ancestors):
        _, line, a = node
        vb = a.get("viewBox") or a.get("viewbox")
        if not vb:
            return
        parts = re.split(r"[\s,]+", vb.strip())
        if len(parts) != 4:
            return
        try:
            vb_w = float(parts[2])
        except ValueError:
            return

        style = a.get("style") or ""
        cls = a.get("class") or ""

        # 글자가 한없이 커지지 않게 막는 방법은 폭 천장만이 아니다.
        # 높이가 묶여도 preserveAspectRatio 때문에 확대 배율이 함께 묶인다.
        # 폭을 묶는 것과 높이를 묶는 것을 구분한다. 높이로 묶으면 그림은 편지지처럼
        # 남는 자리가 생기는데, preserveAspectRatio 기본값이 그것을 이미 가운데 놓는다.
        # 그래서 가운데 정렬을 따로 챙겨야 하는 것은 **폭 천장이 있을 때뿐**이다.
        why = width_capped = None
        if FIXED_LEN_RE.match(a.get("width") or ""):
            why = width_capped = "width 속성 고정"
        elif re.search(r"max-width\s*:", style):
            why = width_capped = "style max-width"
        elif MAXW_CLASS_RE.search(cls):
            why = width_capped = f"Tailwind {MAXW_CLASS_RE.search(cls).group(0).strip()}"
        elif FIXED_LEN_RE.match(a.get("height") or ""):
            why = "height 속성 고정"
        elif re.search(r"max-height\s*:", style):
            why = "style max-height"
        elif "h-full" in cls.split() or re.search(r"\bheight\s*:", style):
            # 높이가 고정된 조상 안에서 h-full이면 배율이 그 높이로 묶인다.
            for _t, _l, pa in ancestors:
                if re.search(r"\bheight\s*:\s*[\d.]+(px|rem|vh)", pa.get("style") or ""):
                    why = "높이 고정 조상"
                    break

        m = re.search(r"min-width\s*:\s*([\d.]+)(px|rem)", style)
        min_w = float(m.group(1)) * (1.0 if m.group(2) == "px" else 16.0) if m else None

        if why:
            if not width_capped:
                return
            # 폭 천장은 있는데 가운데 정렬이 없으면 좁아진 그림이 왼쪽에 붙는다.
            centered = ("mx-auto" in cls.split()
                        or re.search(r"margin\s*:\s*[^;]*auto|margin-inline\s*:", style)
                        or any("items-center" in (pa.get("class") or "")
                               or "justify-center" in (pa.get("class") or "")
                               or "text-center" in (pa.get("class") or "")
                               for _t, _l, pa in ancestors[-3:]))
            if not centered:
                self.flagged.append((line, vb_w, min_w, "정렬", why))
            return

        self.flagged.append((line, vb_w, min_w, "천장", None))


def scan_file(path, log):
    text = open(path, encoding="utf-8").read()
    p = SvgScanner()
    try:
        p.feed(text)
    except Exception as e:
        log.error("%s [파싱 오류] %s", path, e)
        return []
    return p.flagged


def main():
    argv = [a for a in sys.argv[1:] if a not in ("-v", "--verbose")]
    log = get_logger("audit_svg", len(argv) != len(sys.argv[1:]) or bool(argv))

    if argv:
        files = []
        for t in argv:
            files += glob.glob(f"{t}/**/*.html", recursive=True)
        files = sorted(set(files))
    else:
        # 과목 목록은 tools/subjects.py가 혼자 정한다. 여기 따로 적어 두었을 때
        # 「정보(고등학교)」가 빠진 채로 남아 검사 대상에서 통째로 새어 나갔다.
        files = [str(p) for p in html_files()]

    total_files = 0
    counts = {"천장": 0, "정렬": 0}
    for f in files:
        flagged = scan_file(f, log)
        if not flagged:
            log.debug("%s OK", f)
            continue
        total_files += 1
        for line, vb_w, min_w, kind, why in flagged:
            counts[kind] += 1
            minw_s = f"{min_w:g}px" if min_w is not None else "없음"
            if kind == "천장":
                log.warning("%s:%s [천장 없음] viewBox 폭 %g, min-width=%s "
                            "— 화면이 넓어질수록 글자가 계속 커진다", f, line, vb_w, minw_s)
            else:
                log.warning("%s:%s [가운데 정렬 없음] viewBox 폭 %g, 천장=%s "
                            "— 좁아진 그림이 왼쪽에 붙는다", f, line, vb_w, why)

    log.info("완료 — 파일 %d, 걸린 파일 %d, 천장 없음 %d, 가운데 정렬 없음 %d",
             len(files), total_files, counts["천장"], counts["정렬"])
    # 판정 기준은 이 파일 맨 위 주석에 적어 두었다. 걸릴 때마다 되풀이해 찍지 않는다.


if __name__ == "__main__":
    main()
