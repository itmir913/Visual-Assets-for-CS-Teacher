# -*- coding: utf-8 -*-
"""강의노트 HTML에서 '학생이 실제로 읽는 글자'만 뽑아낸다.

용도 — 서술 감사(Fable 등)에 넘길 입력을 만든다.
강의노트 HTML은 본문이 전체의 **12% 남짓**이고 나머지는 Tailwind 클래스와 SVG 좌표다.
원본을 통째로 넘기면 토큰의 88%를 감사와 무관한 마크업에 쓴다.
(2026-08-05 실측: 데이터과학 3-2 세 파일 254,368자 → 본문 29,717자)

**섹션 구조를 남기는 것이 핵심이다.** 태그만 벗기면 감사자가 지적을 어디에
붙여야 할지 알 수 없어 "어딘가에 오개념이 있다" 수준의 보고만 돌아온다.
그래서 h1/h2/h3와 section id를 마크다운 제목으로 살려 둔다.

사용법
    npm run prose -- "데이터과학/3-2-*.html"
    python .git/작업도구/extract_prose.py 인공지능기초/*.html -o out.md
    python .git/작업도구/extract_prose.py 데이터과학/*.html --stats   # 크기만 보고 싶을 때

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

    # 섹션 경계와 제목을 마크다운으로 살린다.
    body = SECTION.sub(lambda m: '\n\n@@SECTION %s@@\n' % m.group(1), body)
    body = HEADING.sub(lambda m: '\n\n@@H%s %s@@\n' % (m.group(1)[1], clean(m.group(2))), body)

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
