// 첫 화면의 찾기 모달을 **실제로 열어 쳐서** 결과가 뜨게 한다.
//
// 모달은 닫혀 있고 결과 줄은 스크립트가 만든다 — 띄워 놓기만 하면 어느 검사도 그 줄을 보지 못한다
// (다크 검사도 「보이는 글자」만 잰다). 그래서 다크 검사와 찾기 검사가 이 길 하나로 연다.
//
// 색인은 개발 서버가 즉석에서 만들어 준다(tools/vite/search-index.js). 가짜 색인을 꽂지 않는 까닭은
// **학생이 받는 것과 같은 색인**을 보고 싶기 때문이다 — 질의도 강의노트에 실제로 있는 말을 쓴다.

/** 강의노트 본문에 있는 말. 제목이 아니라 본문에서만 맞는 것을 고른다(본문 조각까지 받는지 보려고). */
export const QUERY = '편향';

/** 띄어쓰기가 갈리는 말 — 색인은 붙여 적고 질의는 띄어 친다. */
export const SPACED = '기계 학습';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** 모달을 연다(이미 열려 있으면 그대로 둔다 — 열린 `<dialog>`에 다시 열면 죽는다). */
export function openModal(doc) {
    const dlg = doc.getElementById('site-search');
    const opener = doc.getElementById('search-open');
    if (!dlg || !opener) throw new Error('첫 화면에 찾기 단추나 모달이 없다');
    // **단추의 `hidden`으로 색인 도착을 본다** — 모달은 닫혀 있는 것이 정상이라 그쪽으로는 알 수 없다.
    if (opener.hasAttribute('hidden')) {
        throw new Error('찾기 단추가 숨은 채다 — 머리 색인이 오지 않았다(tools/vite/search-index.js)');
    }
    if (!dlg.open) opener.click();
    return dlg;
}

/**
 * 모달을 열고 `q`를 쳐서 결과가 다 뜰 때까지 기다린다. `{dlg, input, list, status, chips}`를 돌려준다.
 * 과목 조각은 `<script>`로 받아 오므로 **도착할 때마다 다시 그린다** — 「찾는 중」이 사라질 때까지 본다.
 */
export async function openSearch(doc, q = QUERY, {timeout = 15000} = {}) {
    const win = doc.defaultView;
    const dlg = openModal(doc);
    const input = doc.getElementById('search-input');
    const list = doc.getElementById('search-results');
    const status = doc.getElementById('search-status');
    input.value = q;
    input.dispatchEvent(new win.Event('input', {bubbles: true}));
    const until = Date.now() + timeout;
    while (Date.now() < until) {
        await sleep(100);
        if (list.children.length && !status.textContent.includes('검색하는 중')) break;
    }
    return {dlg, input, list, status, chips: [...doc.getElementById('search-scope').children]};
}
