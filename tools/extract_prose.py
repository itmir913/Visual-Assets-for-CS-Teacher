# -*- coding: utf-8 -*-
"""강의노트 HTML에서 '학생이 실제로 읽는 글자'만 뽑아낸다.

용도 — 서술 감사(Fable 등)에 넘길 입력을 만든다.
강의노트 HTML은 **본문이 5분의 1 남짓**이고 나머지는 Tailwind 클래스와 SVG 좌표다.
원본을 통째로 넘기면 토큰의 대부분을 감사와 무관한 마크업에 쓴다.
**비율은 파일마다 다르니 짐작하지 말고 `--stats`로 잰다.**

**섹션 구조를 남기는 것이 핵심이다.** 태그만 벗기면 감사자가 지적을 어디에
붙여야 할지 알 수 없어 "어딘가에 오개념이 있다" 수준의 보고만 돌아온다.
그래서 h1/h2/h3와 section id를 마크다운 제목으로 살려 둔다.

사용법
    npm run prose -- "데이터과학/3-2-*.html"
    npm run prose -- "인공지능기초/*.html" -o out.md
    npm run prose -- "데이터과학/*.html" --stats   # 크기만 보고 싶을 때

주의 — 추출본에는 **표의 열 구조와 그림이 남지 않는다.**
"두 산점도를 나란히 놓아 비교시킨다" 같은 시각 장치는 감사 범위에서 빠진다.
서술만 볼 때 쓰는 도구이고, 레이아웃 점검은 브라우저 실측으로 따로 한다.
"""
import argparse
import glob
import io
import os
import re
import sys

# 본문이 아닌 덩어리. SVG는 통째로 버리되 aria-label만 살린다(그림 설명은 서술이다).
DROP = re.compile(r'(?s)<head\b.*?</head>|<style\b.*?</style>|<script\b.*?</script>|<!--.*?-->')
SVG = re.compile(r'(?s)<svg\b([^>]*)>.*?</svg>')
ARIA = re.compile(r'aria-label="([^"]*)"')
HEADING = re.compile(r'(?s)<(h[1-3])\b[^>]*>(.*?)</\1>')
SECTION = re.compile(r'<section\b[^>]*\bid="([^"]+)"')
SUMMARY = re.compile(r'(?s)<summary\b[^>]*>(.*?)</summary>')
TAG = re.compile(r'<[^>]+>')
# 퀴즈 해설은 onclick 속성 안에 있다. 학생이 읽는 글이라 태그를 벗기기 전에 꺼낸다.
QUIZ = re.compile(r"(?s)<button\b[^>]*?checkAnswer\(this,\s*(true|false),\s*'((?:[^'\\]|\\.)*)'\)[^>]*>")

ENTITIES = {
    '&middot;': '·', '&mdash;': '—', '&ndash;': '–', '&minus;': '−',
    '&ldquo;': '“', '&rdquo;': '”', '&lsquo;': '‘', '&rsquo;': '’',
    '&sup2;': '²', '&times;': '×', '&divide;': '÷', '&approx;': '≈',
    '&radic;': '√', '&rarr;': '→', '&larr;': '←', '&hellip;': '…',
    '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
}


def unescape(s):
    for k, v in ENTITIES.items():
        s = s.replace(k, v)
    return re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), s)


def clean(s):
    """태그를 벗기고 공백을 정리한다."""
    return re.sub(r'[ \t]+', ' ', unescape(TAG.sub(' ', s))).strip()


def _padded(make, anchor=None):
    """원래 덩어리가 먹던 줄바꿈을 채워 줄 번호를 원문과 맞춘다.

    `anchor`는 남길 글이 원문에서 시작하는 자리를 돌려준다. 그 앞의 줄바꿈을 글 앞에
    두어야 여러 줄에 걸친 `<button`의 해설이 해설이 적힌 줄에 선다.
    """
    def repl(m):
        s = make(m)
        whole = m.group(0)
        cut = anchor(m) - m.start() if anchor else 0
        pre = whole[:cut].count('\n')
        return '\n' * pre + s + '\n' * (whole.count('\n') - pre - s.count('\n'))
    return repl


def _aria_at(m):
    a = ARIA.search(m.group(0))
    return m.start() + (a.start() if a else 0)


def prose_text(src):
    """학생이 읽는 글만 남기되 **줄 번호는 원문 그대로** 둔다 — 검사가 위반 자리를 짚도록.

    `extract`와 같은 판단(무엇이 본문인가)을 쓴다. 다른 점은 줄을 합치지 않는 것뿐이다.
    태그는 빈 문자열로 걷어 낸다 — 공백으로 바꾸면 태그가 끊은 낱말(「짚<b>어</b>」)이
    둘로 갈라져 검사를 빠져나간다.
    """
    body = DROP.sub(_padded(lambda m: ''), src)
    body = SVG.sub(_padded(lambda m: ' ' + (ARIA.search(m.group(1)).group(1)
                                           if ARIA.search(m.group(1)) else '') + ' ', _aria_at), body)
    body = QUIZ.sub(_padded(lambda m: ' ' + m.group(2) + ' ', lambda m: m.start(2)), body)
    body = TAG.sub(_padded(lambda m: ''), body)
    return re.sub(r'[ \t]+', ' ', unescape(body))


def extract(path):
    src = io.open(path, encoding='utf-8').read()
    raw_len = len(src)

    body = DROP.sub(' ', src)
    # 그림은 버리되 대체 텍스트는 남긴다 — 도해 설명도 감사 대상이다.
    body = SVG.sub(lambda m: '\n[그림] ' + (ARIA.search(m.group(1)).group(1)
                                            if ARIA.search(m.group(1)) else '(설명 없음)') + '\n',
                   body)
    # details 의 summary 는 접혀 있어도 학생이 보는 글이다. 표시를 남긴다.
    body = SUMMARY.sub(lambda m: '\n[접기] ' + clean(m.group(1)) + '\n', body)

    body = QUIZ.sub(lambda m: '\n[해설 %s] %s\n' % ('O' if m.group(1) == 'true' else 'X', m.group(2)), body)

    # 섹션 경계와 제목을 마크다운으로 살린다.
    body = SECTION.sub(lambda m: '\n\n@@SECTION %s@@\n' % m.group(1), body)
    body = HEADING.sub(lambda m: '\n\n@@H%s %s@@\n' % (m.group(1)[1], clean(m.group(2))), body)

    # 태그는 줄을 나누기 «전에» 벗긴다. 여러 줄에 걸친 여는 태그를 줄마다 벗기면
    # 닫는 꺾쇠를 못 만나 클래스 목록이 본문으로 새어 나온다.
    body = TAG.sub(' ', body)

    out, cur_sec = [], None
    for chunk in re.split(r'\n', body):
        sec = re.match(r'@@SECTION (.+)@@', chunk.strip())
        if sec:
            cur_sec = sec.group(1)
            continue
        h = re.match(r'@@H(\d) (.*)@@', chunk.strip())
        if h:
            tag = ' `#%s`' % cur_sec if (h.group(1) == '2' and cur_sec) else ''
            out.append('\n%s %s%s\n' % ('#' * (int(h.group(1)) + 1), h.group(2), tag))
            continue
        t = clean(chunk)
        if t:
            out.append(t)

    text = re.sub(r'\n{3,}', '\n\n', '\n'.join(out)).strip()
    return text, raw_len


def main():
    p = argparse.ArgumentParser(description='강의노트 HTML에서 본문 서술만 추출한다.')
    p.add_argument('paths', nargs='+', help='HTML 파일 또는 글롭')
    p.add_argument('-o', '--out', help='결과를 쓸 파일 (없으면 표준 출력)')
    p.add_argument('--stats', action='store_true', help='크기만 보고 본문은 출력하지 않는다')
    args = p.parse_args()

    files = []
    for pat in args.paths:
        files.extend(sorted(glob.glob(pat)) or ([pat] if os.path.exists(pat) else []))
    if not files:
        sys.exit('대상 파일이 없다.')

    parts, tot_raw, tot_txt = [], 0, 0
    for f in files:
        text, raw = extract(f)
        tot_raw += raw
        tot_txt += len(text)
        parts.append('\n\n' + '=' * 70 + '\n# %s\n' % os.path.basename(f) + '=' * 70 + '\n\n' + text)
        print('%-46s 원본 %7s자 → 본문 %6s자 (%4.1f%%)'
              % (os.path.basename(f)[:46], format(raw, ','), format(len(text), ','), len(text) / raw * 100),
              file=sys.stderr)

    print('-' * 80, file=sys.stderr)
    print('합계 %s개  원본 %s자 → 본문 %s자 (%.1f%%)   토큰 어림 ≈ %s (한국어 1.5자/토큰)'
          % (len(files), format(tot_raw, ','), format(tot_txt, ','),
             tot_txt / tot_raw * 100, format(int(tot_txt / 1.5), ',')), file=sys.stderr)

    if args.stats:
        return
    body = ''.join(parts).strip()
    if args.out:
        io.open(args.out, 'w', encoding='utf-8').write(body)
        print('→ %s 에 썼다.' % args.out, file=sys.stderr)
    else:
        sys.stdout.write(body)


if __name__ == '__main__':
    main()
