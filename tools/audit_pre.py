"""모든 강의노트에서 <pre>/<code> 가로 넘침 위험을 정적 점검한다.

<pre>는 기본 white-space:pre 라서 긴 줄이 줄바꿈되지 않고 화면 밖으로 나간다.
방어 수단은 셋 중 하나 이상:
  (a) CSS 에서 pre 에 white-space: pre-wrap (+ word-break/overflow-wrap)
  (b) pre 를 overflow-x-auto 컨테이너로 감싸기 (넘치되 그 안에서 스크롤)
  (c) pre 자체에 overflow-x-auto
"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from subjects import REPO_ROOT as ROOT, html_files  # noqa: E402

rows = []
for path in html_files():
    src = path.read_text(encoding="utf-8", errors="replace")
    pres = [m.start() for m in re.finditer(r"<pre\b", src)]
    if not pres:
        continue

    style = "\n".join(re.findall(r"<style[^>]*>(.*?)</style>", src, re.S))
    # (a) CSS 에서 pre 에 pre-wrap 지정?
    css_wrap = bool(re.search(r"(^|[,{\s])pre\b[^{}]*\{[^}]*white-space:\s*pre-wrap", style, re.S)) \
        or bool(re.search(r"white-space:\s*pre-wrap", style))
    css_pre_overflow = bool(re.search(r"(^|[,{\s])pre\b[^{}]*\{[^}]*overflow-x:\s*auto", style, re.S))

    # (b)/(c) 각 <pre> 별로 래퍼/자체 클래스 확인
    risky = 0
    for p in pres:
        tag = src[p:src.find(">", p) + 1]
        before = src[max(0, p - 400):p]
        wrapped = "overflow-x-auto" in before.split("</div>")[-1] or "overflow-auto" in before.split("</div>")[-1]
        self_ok = "overflow-x-auto" in tag or "whitespace-pre-wrap" in tag or "break-all" in tag
        if not (wrapped or self_ok):
            risky += 1

    rows.append((str(path.relative_to(ROOT)), len(pres), risky,
                 css_wrap, css_pre_overflow))

print(f"{'파일':<52} {'pre':>4} {'위험':>4}  CSS방어")
print("-" * 88)
bad = 0
for name, n, risky, cw, co in rows:
    guard = []
    if cw:
        guard.append("pre-wrap")
    if co:
        guard.append("overflow-x")
    ok = cw or co or risky == 0
    if not ok:
        bad += 1
    mark = "  " if ok else "⚠ "
    print(f"{mark}{name:<50} {n:>4} {risky:>4}  {','.join(guard) or '없음'}")

print("-" * 88)
print(f"<pre> 사용 파일 {len(rows)}개 중 방어 수단 없는 파일 {bad}개")
