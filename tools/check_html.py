"""강의안 HTML 검증: 태그 중첩 + 최소 글자 크기 + 테이블 래퍼."""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr"}


class Checker(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.errors = []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append((tag, self.getpos()[0]))

    def handle_endtag(self, tag):
        if tag in VOID:
            return
        if not self.stack:
            self.errors.append(f"{self.getpos()[0]}행: </{tag}> 짝 없음")
            return
        if self.stack[-1][0] == tag:
            self.stack.pop()
        else:
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    unclosed = [f"<{t}>({ln}행)" for t, ln in self.stack[i + 1:]]
                    self.errors.append(
                        f"{self.getpos()[0]}행: </{tag}> 앞에 닫히지 않은 태그 {', '.join(unclosed)}")
                    del self.stack[i:]
                    break
            else:
                self.errors.append(f"{self.getpos()[0]}행: </{tag}> 짝 없음")


def check(path: Path):
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    print(f"=== {path.name} ({len(lines)}행) ===")

    c = Checker()
    c.feed(src)
    for t, ln in c.stack:
        c.errors.append(f"{ln}행: <{t}> 닫히지 않음")
    if c.errors:
        print("  [태그 중첩] 오류")
        for e in c.errors:
            print("   -", e)
    else:
        print("  [태그 중첩] OK")

    # 최소 글자 크기: text-sm/xs 및 임의 소형 크기 금지
    bad = []
    for i, ln in enumerate(lines, 1):
        for m in re.finditer(r"\btext-(sm|xs)\b|text-\[(0?\.\d+rem|\d{1,2}px)\]", ln):
            bad.append(f"{i}행: {m.group(0)}")
    print(f"  [글자 크기] {'OK' if not bad else '위반 ' + str(len(bad)) + '건'}")
    for b in bad:
        print("   -", b)

    # font-size 인라인 중 1rem 미만 (아이콘 불릿 0.5rem은 장식이라 허용)
    small = []
    for i, ln in enumerate(lines, 1):
        for m in re.finditer(r"font-size:\s*([\d.]+)rem", ln):
            if float(m.group(1)) < 1.0 and "fa-circle" not in ln:
                small.append(f"{i}행: {m.group(0)}")
    if small:
        print("  [인라인 font-size] 확인 필요")
        for s in small:
            print("   -", s)

    # 테이블 overflow-x-auto 래퍼
    tables = [i for i, ln in enumerate(lines, 1) if "<table" in ln]
    unwrapped = []
    for t in tables:
        window = "\n".join(lines[max(0, t - 6):t])
        if "overflow-x-auto" not in window:
            unwrapped.append(t)
    print(f"  [테이블 래퍼] {len(tables)}개 중 "
          f"{'전부 OK' if not unwrapped else '미포장 ' + str(unwrapped)}")


for arg in sys.argv[1:]:
    check(Path(arg))
