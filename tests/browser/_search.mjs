// 첫 화면의 찾기 칸을 **실제로 쳐서** 결과가 뜨게 한다.
//
// 결과 줄은 스크립트가 만든다 — 띄워 놓기만 하면 패널이 접혀 있어 어느 검사도 그 줄을 보지 못한다
// (다크 검사도 「보이는 글자」만 잰다). 그래서 다크 검사와 찾기 검사가 이 길 하나로 패널을 연다.
//
// 색인은 개발 서버가 즉석에서 만들어 준다(tools/vite/search-index.js). 가짜 색인을 꽂지 않는 까닭은
// **학생이 받는 것과 같은 색인**을 보고 싶기 때문이다 — 질의도 강의노트에 실제로 있는 말을 쓴다.

/** 강의노트 본문에 있는 말. 제목이 아니라 본문에서만 맞는 것을 고른다(본문 조각까지 받는지 보려고). */
export const QUERY = '편향';

/** 띄어쓰기가 갈리는 말 — 색인은 붙여 적고 질의는 띄어 친다. */
export const SPACED = '기계 학습';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * `q`를 쳐서 결과가 다 뜰 때까지 기다린다. `{input, list, status, chips}`를 돌려준다.
 * 과목 조각은 `<script>`로 받아 오므로 **도착할 때마다 다시 그린다** — 「찾는 중」이 사라질 때까지 본다.
 */
export async function openSearch(doc, q = QUERY, {timeout = 15000} = {}) {
    const win = doc.defaultView;
    const input = doc.getElementById('search-input');
    const list = doc.getElementById('search-results');
    const status = doc.getElementById('search-status');
    if (!input || !list || !status) throw new Error('첫 화면에 찾기 칸이 없다');
    if (doc.getElementById('site-search').hasAttribute('hidden')) {
        throw new Error('찾기 칸이 숨은 채다 — 머리 색인이 오지 않았다(tools/vite/search-index.js)');
    }
    input.value = q;
    input.dispatchEvent(new win.Event('input', {bubbles: true}));
    const until = Date.now() + timeout;
    while (Date.now() < until) {
        await sleep(100);
        if (list.children.length && !status.textContent.includes('찾는 중')) break;
    }
    return {input, list, status, chips: [...doc.getElementById('search-scope').children]};
}
