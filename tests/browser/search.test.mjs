// 첫 화면의 전 과목 찾기를 **진짜 브라우저에서 열고 쳐 본다.**
//
// 다른 검사가 이 자리를 보지 못한다 — 모달은 닫혀 있고 결과 줄은 스크립트가 만든다.
// `check -- layout`은 시뮬레이터만 돌고, `check -- prose`는 과목 폴더만 본다. 여기서 본다.
//
//   1. 폰 폭(375px)에서 가로로 넘치지 않는다 — **학생이 복습하는 화면이 폰이다**
//   2. 글자가 본문 크기 이상이다(교실 뒷자리 기준)
//   3. 결과 줄이 그 절로 가고, 새 탭에서 열린다
//   4. 띄어쓰기를 눈감는다 — 「기계 학습」으로 「기계학습」을 찾는다
//   5. 과목 칩으로 좁히면 그 과목만 남는다
//   6. 질의가 HTML로 들어가지 않는다 — 글자는 글자로만
//   7. 열면 입력에 포커스가 가고 뒤 본문이 잠긴다 · 닫으면 단추로 돌아오고 잠금이 풀린다 · 질의는 남는다
//   8. 찾기 단추가 토글과도 hero의 글자와도 겹치지 않는다
//
// **이 검사가 보지 못하는 것** — 포커스 가두기(네이티브 `<dialog>`의 몫이고, 합성 Tab은 브라우저의
// 포커스 이동을 일으키지 않아 잴 수 없다) · 뒤 본문이 실제로 굴러가지 않는지(`overflow: hidden`은
// 프로그램 스크롤을 막지 않는다. 선언이 **스크롤 주인에 닿았는지**까지만 본다) · `::backdrop`의 다크 짝 ·
// iOS의 `dvh` · 키보드 · 터치 스크롤. 그것들은 실측에서만 보인다.
import {expect, test} from 'vitest';
import {openFrame, visible} from './_frame.mjs';
import {QUERY, SPACED, openModal, openSearch} from './_search.mjs';

const PAGE = '/index.html';
const PHONE = [375, 720];
const DESK = [1366, 900];
const MIN_PX = 16;

test('폰 폭에서 모달이 가로로 넘치지 않고 글자가 본문 크기 이상이다', async () => {
    const {frame, win, doc} = await openFrame(PAGE, ...PHONE);
    const {list} = await openSearch(doc);
    expect(list.children.length, `「${QUERY}」로 찾은 것이 없다`).toBeGreaterThan(0);

    const problems = [];
    // **숨긴 것이 정말 안 보이는가.** `[hidden]`과 닫힌 `<dialog>`는 브라우저 기본 스타일이라
    // 페이지 CSS의 `display` 선언에 진다 — 속성만 보면 숨긴 줄 알지만 화면에는 그대로 남는다.
    for (const id of ['search-clear', 'search-results', 'search-more', 'search-empty']) {
        const el = doc.getElementById(id);
        if (el.hasAttribute('hidden') && win.getComputedStyle(el).display !== 'none') {
            problems.push(`#${id}: hidden인데 display가 ${win.getComputedStyle(el).display}다 — 화면에 남는다`);
        }
    }
    const root = doc.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) {
        problems.push(`문서가 가로로 넘친다: ${root.scrollWidth} > ${root.clientWidth}`);
    }
    for (const el of doc.getElementById('site-search').querySelectorAll('*')) {
        if (!visible(el, win)) continue;
        const r = el.getBoundingClientRect();
        if (r.left < -1 || r.right > PHONE[0] + 1) {
            problems.push(`칸이 화면을 벗어난다: <${el.tagName.toLowerCase()}.${[...el.classList].join('.')}> ${Math.round(r.left)}~${Math.round(r.right)}`);
        }
        const px = parseFloat(win.getComputedStyle(el).fontSize);
        if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && px < MIN_PX) {
            problems.push(`글자가 작다 ${px}px: <${el.tagName.toLowerCase()}.${[...el.classList].join('.')}>`);
        }
    }
    frame.remove();
    expect(problems).toEqual([]);
}, 300_000);

test('결과 줄은 그 절을 가리키고 새 탭에서 열린다', async () => {
    const {frame, doc} = await openFrame(PAGE, ...DESK);
    const {list} = await openSearch(doc);
    const problems = [];
    let withAnchor = 0, withMark = 0;
    for (const li of list.children) {
        const a = li.querySelector('a');
        if (!a) { problems.push('결과 줄에 링크가 없다'); continue; }
        const href = a.getAttribute('href');
        if (!/\.html(#.+)?$/.test(href)) problems.push(`결과가 강의노트를 가리키지 않는다: ${href}`);
        if (href.includes('#')) withAnchor++;
        if (a.target !== '_blank' || !a.rel.includes('noopener')) {
            problems.push(`결과가 새 탭에서 열리지 않는다: ${href} (target=${a.target} rel=${a.rel})`);
        }
        if (a.querySelector('mark')) withMark++;
    }
    if (!withAnchor) problems.push('앵커(#절)를 가진 결과가 하나도 없다 — 누르면 파일 맨 위로 간다');
    if (!withMark) problems.push('발췌에 표시(<mark>)된 결과가 하나도 없다 — 본문 조각을 받지 못했다');
    frame.remove();
    expect(problems).toEqual([]);
}, 300_000);

test('띄어쓰기를 눈감는다 — 띄어 쳐도 붙여 적은 말을 찾는다', async () => {
    const {frame, doc} = await openFrame(PAGE, ...DESK);
    const {list} = await openSearch(doc, SPACED);
    expect(list.children.length, `「${SPACED}」로 찾은 것이 없다 — 붙여 적은 말을 놓친다`).toBeGreaterThan(0);
    frame.remove();
}, 300_000);

test('과목 칩으로 좁히면 그 과목만 남는다', async () => {
    const {frame, doc} = await openFrame(PAGE, ...DESK);
    const {list, chips} = await openSearch(doc);
    const chip = chips.find((c) => c.dataset.scope === 'informatics');
    chip.click();
    await new Promise((r) => setTimeout(r, 1500));
    const hrefs = [...list.children].map((li) => li.querySelector('a').getAttribute('href'));
    const stray = hrefs.filter((h) => !h.startsWith('정보'));
    frame.remove();
    expect(stray, '고른 과목 밖의 결과가 남았다').toEqual([]);
    expect(chip.getAttribute('aria-pressed')).toBe('true');
}, 300_000);

test('질의가 HTML로 들어가지 않는다', async () => {
    const {frame, doc} = await openFrame(PAGE, ...DESK);
    const {list} = await openSearch(doc, '<img src=x onerror=1>');
    const injected = list.querySelector('img');
    const shown = list.textContent;
    frame.remove();
    expect(injected, '질의가 요소로 들어갔다 — 글자는 textContent 로만 넣는다').toBe(null);
    expect(shown.includes('<img')).toBe(false);
}, 300_000);

test('열면 포커스와 잠금이 가고, 닫으면 단추로 돌아오며 질의가 남는다', async () => {
    const {frame, win, doc} = await openFrame(PAGE, ...PHONE);
    const opener = doc.getElementById('search-open');
    const root = doc.documentElement;

    // 열기 전 — 닫힌 <dialog>가 화면에서 사라져 있고, 잠금도 걸려 있지 않다.
    const dlg = doc.getElementById('site-search');
    expect(win.getComputedStyle(dlg).display, '닫힌 모달이 화면에 남는다').toBe('none');
    const before = win.getComputedStyle(root).overflowY;

    const {input, list} = await openSearch(doc);
    expect(dlg.open, '모달이 열리지 않았다').toBe(true);
    expect(doc.activeElement, '열었는데 입력에 포커스가 가지 않는다').toBe(input);
    // **잠금은 스크롤 주인(`html`)에 걸려야 한다** — `body`에 걸면 `overflow-y: scroll`인 html 때문에
    // 아무 일도 하지 않는다. 여기서 보는 것은 「선언이 닿았는가」까지다.
    expect(win.getComputedStyle(root).overflowY, '모달을 열었는데 스크롤 주인이 잠기지 않았다').toBe('hidden');

    const found = list.children.length;
    // 가장 새기 쉬운 길(Esc)로 닫아 본다.
    input.dispatchEvent(new win.KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    dlg.close();   // 합성 Esc는 브라우저의 기본 닫기를 일으키지 않는다 — 같은 길(close)을 직접 탄다
    expect(dlg.open).toBe(false);
    // `close` 이벤트는 **큐에 실려** 돈다(`close()` 호출 중에 바로 돌지 않는다) — 한 틱 기다린다.
    await new Promise((r) => setTimeout(r, 50));
    expect(win.getComputedStyle(root).overflowY, '닫았는데 잠금이 풀리지 않았다 — 첫 화면이 영영 구르지 않는다').toBe(before);

    // 다시 열면 질의와 결과가 그대로다.
    openModal(doc);
    expect(input.value, '닫았다 열었더니 질의가 지워졌다').toBe(QUERY);
    expect(list.children.length, '닫았다 열었더니 결과가 사라졌다').toBe(found);
    expect(doc.activeElement).toBe(input);
    dlg.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(doc.activeElement, '닫았는데 포커스가 연 단추로 돌아오지 않는다').toBe(opener);
    frame.remove();
}, 300_000);

test('찾기 단추가 토글과도 hero의 글자와도 겹치지 않는다', async () => {
    const {frame, win, doc} = await openFrame(PAGE, ...PHONE);
    const hit = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    const problems = [];
    for (const [w, h] of [PHONE, DESK]) {
        frame.style.width = `${w}px`;
        frame.style.height = `${h}px`;
        await new Promise((r) => setTimeout(r, 300));
        const opener = doc.getElementById('search-open');
        openModal(doc);                       // 색인이 와서 단추가 보이는지까지 함께 본다
        doc.getElementById('site-search').close();
        const btn = opener.getBoundingClientRect();
        const toggle = doc.querySelector('[data-theme-toggle]').getBoundingClientRect();
        if (hit(btn, toggle)) problems.push(`${w}px — 찾기 단추가 테마 토글과 겹친다`);
        // hero의 **글자**와 겹치는지 본다(상자가 아니라 줄 상자로 잰다 — 가운데 정렬이라 상자는 폭 전체다).
        for (const el of doc.querySelectorAll('header.hero-gradient h1, header.hero-gradient p, header.hero-gradient span')) {
            if (!visible(el, win) || el.closest('a') || el === opener) continue;
            const range = doc.createRange();
            range.selectNodeContents(el);
            for (const line of range.getClientRects()) {
                if (hit(btn, line)) {
                    problems.push(`${w}px — 찾기 단추가 hero의 글자와 겹친다: 「${el.textContent.trim().slice(0, 20)}」`);
                    break;
                }
            }
        }
    }
    frame.remove();
    expect(problems).toEqual([]);
}, 300_000);
