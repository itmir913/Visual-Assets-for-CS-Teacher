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

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


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
                    self._check_svg(node)
                return

    def _check_svg(self, node):
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
        has_max = re.search(r"max-width\s*:", style) is not None
        m = re.search(r"min-width\s*:\s*([\d.]+)(px|rem)", style)
        min_w = None
        if m:
            min_w = float(m.group(1)) * (1.0 if m.group(2) == "px" else 16.0)
        if not has_max:
            self.flagged.append((line, vb_w, min_w))


def scan_file(path):
    text = open(path, encoding="utf-8").read()
    p = SvgScanner()
    try:
        p.feed(text)
    except Exception as e:
        print(f"  [파싱 오류] {e}")
        return []
    return p.flagged


def main():
    targets = sys.argv[1:] or ["인공지능기초", "데이터과학", "프로그래밍(Python)",
                                "프로그래밍(C)", "simulator"]
    files = []
    for t in targets:
        files += glob.glob(f"{t}/**/*.html", recursive=True)
    files = sorted(set(files))

    total_files = 0
    total_svgs = 0
    for f in files:
        flagged = scan_file(f)
        if not flagged:
            continue
        total_files += 1
        total_svgs += len(flagged)
        print(f"\n=== {f} ===")
        for line, vb_w, min_w in flagged:
            minw_s = f"{min_w:g}px" if min_w is not None else "없음"
            print(f"  {line}행: viewBox 폭 {vb_w:g}, min-width={minw_s}, max-width 없음")

    print(f"\n--- {len(files)}개 파일 검사, {total_files}개 파일에 max-width 없는 글자 SVG 총 {total_svgs}건 ---")


if __name__ == "__main__":
    main()
