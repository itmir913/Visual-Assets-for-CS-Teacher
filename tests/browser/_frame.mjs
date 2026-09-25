// 페이지를 **폭을 정한 iframe** 에 띄우는 받침대. 진짜 브라우저(Chromium)가 레이아웃을 한다.
//
// iframe 은 테스트와 같은 Vite 서버에서 페이지를 받으므로 개발 서버에서 보는 것과 같은 HTML ·
// CSS 가 붙는다. 창 크기를 바꾸는 대신 iframe 크기를 바꾼다 — 한 테스트에서 폭 여럿을 잴 수 있다.

/** 시뮬레이터 페이지 전부. 새 페이지를 만들면 저절로 딸려 온다(입구 index.html 은 뺀다). */
export const SIM_PAGES = Object.keys(import.meta.glob('/simulator/**/*.html'))
    .filter((p) => !p.endsWith('/index.html'))
    .sort();

/** `url` 을 `w`×`h` iframe 에 띄우고 load 뒤 한숨 돌린 다음 `{frame, win, doc}` 를 돌려준다. */
export async function openFrame(url, w, h) {
    const frame = document.createElement('iframe');
    frame.style.cssText = `width:${w}px;height:${h}px;border:0;display:block`;
    document.body.append(frame);
    await new Promise((ok, no) => {
        const t = setTimeout(() => no(new Error(`${url}: 20초 안에 뜨지 않았다`)), 20000);
        frame.onload = () => { clearTimeout(t); ok(); };
        frame.src = url;
    });
    const win = frame.contentWindow, doc = frame.contentDocument;
    // 글꼴과 지연 스크립트(load 뒤의 첫 그리기)를 기다린다.
    await doc.fonts?.ready;
    await new Promise((r) => setTimeout(r, 400));
    return {frame, win, doc};
}

/** iframe 크기를 바꾸고 레이아웃이 따라올 때까지 기다린다. */
export async function resizeFrame(frame, w, h) {
    frame.style.width = `${w}px`;
    frame.style.height = `${h}px`;
    frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('resize'));
    await new Promise((r) => setTimeout(r, 300));
}

/** 보이는 요소인가 — 크기가 있고 숨겨지지 않았다. */
export function visible(el, win) {
    const cs = win.getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    /* **닫힌 <details> 속은 그려지지 않는데 상자는 남는다**(Chromium 이 content-visibility 로
       감춘다). 그대로 두면 아래 형제와 「겹친다」고 헛경보가 난다 — 선형 자료구조의
       「직접 입력」이 연산 칸 바로 위로 옮겨 온 뒤 처음 드러났다. */
    const shut = el.closest('details:not([open])');
    if (shut && !el.closest('summary')) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && !el.closest('[hidden], .hidden');
}

/** 사람이 알아볼 수 있는 이름 — 오류 메시지에 쓴다. */
export function label(el) {
    const t = (el.getAttribute('aria-label') || el.textContent || el.id || el.tagName).replace(/\s+/g, ' ').trim();
    return `<${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}> 「${t.slice(0, 24)}」`;
}
