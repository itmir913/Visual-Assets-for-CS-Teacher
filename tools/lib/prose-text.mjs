// 강의노트 HTML 에서 「학생이 실제로 읽는 글자」만 남긴다.
//
// `npm run prose`(서술 감사에 넘길 입력 만들기)와 `check -- prose`(물러난 말 검사)가 **같은
// 판단**을 쓴다 — 두 도구가 서로 다른 본문을 보면 추출해 읽은 것과 검사한 것이 어긋난다.

// 본문이 아닌 덩어리. SVG 는 통째로 버리되 aria-label 만 살린다(그림 설명은 서술이다).
export const DROP = /<head\b[\s\S]*?<\/head>|<style\b[\s\S]*?<\/style>|<script\b[\s\S]*?<\/script>|<!--[\s\S]*?-->/g;
export const SVG = /<svg\b([^>]*)>[\s\S]*?<\/svg>/g;
export const ARIA = /aria-label="([^"]*)"/;
export const TAG = /<[^>]+>/g;
// 퀴즈 해설은 onclick 속성 안에 있다. 학생이 읽는 글이라 태그를 벗기기 전에 꺼낸다.
export const QUIZ = /<button\b[^>]*?checkAnswer\(this,\s*(true|false),\s*'((?:[^'\\]|\\.)*)'\)[^>]*>/g;

const ENTITIES = [
    ['&middot;', '·'], ['&mdash;', '—'], ['&ndash;', '–'], ['&minus;', '−'],
    ['&ldquo;', '“'], ['&rdquo;', '”'], ['&lsquo;', '‘'], ['&rsquo;', '’'],
    ['&sup2;', '²'], ['&times;', '×'], ['&divide;', '÷'], ['&approx;', '≈'],
    ['&radic;', '√'], ['&rarr;', '→'], ['&larr;', '←'], ['&hellip;', '…'],
    ['&nbsp;', ' '], ['&amp;', '&'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'],
];

/** 자주 쓰는 개체만 푼다. 목록 밖의 이름 개체는 그대로 둔다(읽는 사람이 알아본다). */
export function unescape(s) {
    for (const [k, v] of ENTITIES) s = s.split(k).join(v);
    return s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

/** 태그를 벗기고 공백을 정리한다. */
export const clean = (s) => unescape(s.replace(TAG, ' ')).replace(/[ \t]+/g, ' ').trim();

const count = (s) => (s.match(/\n/g) || []).length;

/**
 * 원래 덩어리가 먹던 줄바꿈을 채워 줄 번호를 원문과 맞춘다.
 * `anchor` 는 남길 글이 원문에서 시작하는 자리(덩어리 안의 거리)를 돌려준다. 그 앞의 줄바꿈을
 * 글 앞에 두어야 여러 줄에 걸친 `<button` 의 해설이 해설이 적힌 줄에 선다.
 */
function padded(make, anchor) {
    return (...args) => {
        const whole = args[0];
        const s = make(...args);
        const cut = anchor ? anchor(...args) : 0;
        const pre = count(whole.slice(0, cut));
        return '\n'.repeat(pre) + s + '\n'.repeat(count(whole) - pre - count(s));
    };
}

/**
 * 학생이 읽는 글만 남기되 **줄 번호는 원문 그대로** 둔다 — 검사가 위반 자리를 짚도록.
 * 태그는 빈 문자열로 걷어 낸다 — 공백으로 바꾸면 태그가 끊은 낱말(「짚<b>어</b>」)이
 * 둘로 갈라져 검사를 빠져나간다.
 */
export function proseText(src) {
    let body = src.replace(DROP, padded(() => ''));
    body = body.replace(SVG, padded(
        (whole, attrs) => { const a = attrs.match(ARIA); return ' ' + (a ? a[1] : '') + ' '; },
        (whole) => { const a = whole.match(ARIA); return a ? a.index : 0; }));
    body = body.replace(QUIZ, padded(
        (whole, ok, text) => ' ' + text + ' ',
        (whole, ok, text) => whole.indexOf(text, whole.indexOf('checkAnswer'))));
    body = body.replace(TAG, padded(() => ''));
    return unescape(body).replace(/[ \t]+/g, ' ');
}
