// 첫 화면의 전 과목 찾기를 **진짜 브라우저에서 쳐 본다.**
//
// 다른 검사가 이 자리를 보지 못한다 — 결과 줄은 스크립트가 만들고, 패널은 두 글자 미만이면 접혀
// 있다. `check -- layout`은 시뮬레이터만 돌고, `check -- prose`는 과목 폴더만 본다. 여기서 본다.
//
//   1. 폰 폭(375px)에서 가로로 넘치지 않는다 — **학생이 복습하는 화면이 폰이다**
//   2. 글자가 본문 크기 이상이다(교실 뒷자리 기준)
//   3. 결과 줄이 그 절로 가고, 새 탭에서 열린다
//   4. 띄어쓰기를 눈감는다 — 「기계 학습」으로 「기계학습」을 찾는다
//   5. 과목 칩으로 좁히면 그 과목만 남는다
//   6. 질의가 HTML로 들어가지 않는다 — 글자는 글자로만
//   7. 두 글자 미만이거나 바깥을 누르면 **화면에서** 접힌다(속성이 아니라 계산된 display를 본다)
//   8. ↓ 로 첫 줄에 들어간다
import {expect, test} from 'vitest';
import {openFrame, visible} from './_frame.mjs';
import {QUERY, SPACED, openSearch} from './_search.mjs';

const PAGE = '/index.html';
const PHONE = [375, 720];
const DESK = [1366, 900];
const MIN_PX = 16;

test('폰 폭에서 찾기 칸과 결과가 가로로 넘치지 않고 글자가 본문 크기 이상이다', async () => {
    const {frame, win, doc} = await openFrame(PAGE, ...PHONE);
    const {list} = await openSearch(doc);
    expect(list.children.length, `「${QUERY}」로 찾은 것이 없다`).toBeGreaterThan(0);

    const problems = [];
    // **숨긴 것이 정말 안 보이는가.** `[hidden]`은 브라우저 기본 스타일이라 페이지 CSS의
    // `display` 선언에 진다 — 속성만 보면 숨긴 줄 알지만 화면에는 그대로 남는다.
    for (const id of ['search-clear', 'search-results', 'search-more']) {
        const el = doc.getElementById(id);
        if (el.hasAttribute('hidden') && win.getComputedStyle(el).display !== 'none') {
            problems.push(`#${id}: hidden인데 display가 ${win.getComputedStyle(el).display}다 — 화면에 남는다`);
        }
    }
    const root = doc.documentElement;
    if (root.scrollWidth > root.clientWidth + 1) {
        problems.push(`문서가 가로로 넘친다: ${root.scrollWidth} > ${root.clientWidth}`);
    }
    const band = doc.getElementById('site-search');
    for (const el of band.querySelectorAll('*')) {
        if (!visible(el, win)) continue;
        const r = el.getBoundingClientRect();
        // 과목 칩 줄은 **스스로 옆으로 구르는 칸**이다 — 그 안에서 넘치는 것은 괜찮다(좁은 화면의 칩 줄과 같은 몸짓).
        if (!el.closest('.search-scope') && (r.left < -1 || r.right > PHONE[0] + 1)) {
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
    expect(shown.includes('<img')).toBe(false);   // 찾은 것이 없으므로 글자로도 남지 않는다
}, 300_000);

test('두 글자 미만이면 패널을 닫고, 바깥을 누르면 접히고, ↓ 로 첫 줄에 들어간다', async () => {
    const {frame, win, doc} = await openFrame(PAGE, ...DESK);
    const {input, list} = await openSearch(doc);
    expect(list.hidden).toBe(false);

    // 바깥 누름 — 폰에서 목록이 화면을 거의 덮으므로 닫는 길이 Esc 하나뿐이면 빠져나올 수 없다.
    // **화면에서 사라졌는지를 본다**(속성만 보면 CSS가 이겨도 통과한다).
    doc.querySelector('header.hero-gradient h1').click();
    expect(win.getComputedStyle(list).display, '바깥을 눌러도 결과가 화면에 남는다').toBe('none');
    input.focus();
    expect(win.getComputedStyle(list).display, '칸을 다시 눌러도 결과가 돌아오지 않는다').not.toBe('none');

    input.focus();
    input.dispatchEvent(new win.KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    const first = list.children[0].querySelector('a');
    expect(doc.activeElement, '↓ 를 눌러도 첫 줄로 가지 않는다').toBe(first);
    expect(list.children[0].getAttribute('aria-selected')).toBe('true');

    input.value = '편';
    input.dispatchEvent(new win.Event('input', {bubbles: true}));
    await new Promise((r) => setTimeout(r, 600));
    expect(win.getComputedStyle(list).display, '한 글자인데 패널이 열려 있다').toBe('none');
    expect(input.getAttribute('aria-expanded')).toBe('false');
    frame.remove();
}, 300_000);
