// 시뮬레이터 화면을 **진짜 브라우저에서 재어** 겹침 · 넘침 · 닿지 않는 조작을 본다.
//
// jsdom 으로 도는 검사(`tests/sim-*.test.mjs`)는 상자 크기를 모른다. 그래서 「조작이 무대 안에
// 있는가」는 보아도 「화면 안에 들어오는가 · 서로 덮지 않는가」는 못 보았다. 여기서는 페이지를
// 폭을 정한 iframe 에 띄우고 Chromium 이 실제로 배치한 상자를 잰다.
//
//   1. 375px — 페이지가 가로로 넘치지 않는가 · 조작이 화면 오른쪽 밖으로 나가지 않는가
//   2. 평소 화면과 전체 화면 — 눈에 보이는 조작끼리 서로 덮지 않는가
//   3. 전체 화면(1366×768 · 1920×1080) — 무대가 가로로 넘치지 않는가 · 조작이 화면 가로 밖에 있지
//      않는가 · 화면 아래로 내려간 조작이 있다면 **무대가 스크롤되어 닿을 수 있는가**
//
// **「보이는 상자」는 조상이 잘라 낸 뒤의 상자다.** 스크롤되는 표 안의 버튼은 상자가 표 밖까지
// 뻗어 있어도 화면에는 잘려 보이지 않는다. 그대로 재면 아래 버튼과 «겹친다»는 헛경보가 난다
// (결정 트리의 삭제 버튼이 그랬다). 그래서 잘라 내는 조상마다 상자를 깎는다.
//
// **전체 화면은 `fs-on` 으로 켠다.** `requestFullscreen` 은 iframe 에서 거부된다. CSS 가
// `:is(:fullscreen, .fs-on)` 로 적혀 있으므로(→ `tests/sim-fullscreen.test.mjs` 가 지킨다)
// 클래스를 붙이고 무대를 화면에 못박으면 진짜 전체 화면과 같은 규칙이 든다.
//
// **그림이 화면을 넉넉히 쓰는가**는 여기서 판정하지 않는다. 기계가 한 줄로 자를 수 없어
// 찍어서 사람이 본다 → `shots.test.mjs`.
import {expect, test} from 'vitest';
import {SIM_PAGES, label, openFrame, resizeFrame, visible} from './_frame.mjs';

const CONTROLS = 'button, select, input:not([type=hidden]), textarea, a[href], [role=button], summary';
const NARROW = [375, 812];
const FULL = [[1366, 768], [1920, 1080]];

/** 조상이 잘라 낸 뒤 실제로 보이는 상자. 전혀 안 보이면 null. */
function clippedRect(el, win) {
    const r = el.getBoundingClientRect();
    let {left, top, right, bottom} = r;
    for (let p = el.parentElement; p; p = p.parentElement) {
        const cs = win.getComputedStyle(p);
        if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
            const c = p.getBoundingClientRect();
            if (cs.overflowX !== 'visible') { left = Math.max(left, c.left); right = Math.min(right, c.right); }
            if (cs.overflowY !== 'visible') { top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); }
        }
        if (cs.position === 'fixed') break;
    }
    return right - left > 1 && bottom - top > 1 ? {left, top, right, bottom} : null;
}

/** 가로로 스크롤되거나 잘라 내는 조상이 있는가 — 그 안에서 넘치는 것은 의도된 스크롤이다. */
function inScroller(el, win, stopAt) {
    for (let p = el.parentElement; p && p !== stopAt; p = p.parentElement) {
        if (win.getComputedStyle(p).overflowX !== 'visible') return true;
    }
    return false;
}

// 눈으로 숨긴 입력(`sr-only` — 1px 로 줄여 둔 체크박스)은 빼고 본다. 누르는 것은 그 옆의 label 이다.
const controlsIn = (root, win) => [...root.querySelectorAll(CONTROLS)]
    .filter((el) => visible(el, win) && !el.closest('.fs-float') && !el.classList.contains('sr-only'));

/** 보이는 조작끼리 겹친 쌍. 한쪽이 다른 쪽을 품으면 겹침이 아니다. */
function overlaps(ctrls, win) {
    const out = [];
    const rects = ctrls.map((el) => clippedRect(el, win));
    for (let i = 0; i < ctrls.length; i++) {
        for (let j = i + 1; j < ctrls.length; j++) {
            const a = rects[i], b = rects[j];
            if (!a || !b || ctrls[i].contains(ctrls[j]) || ctrls[j].contains(ctrls[i])) continue;
            const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (w > 2 && h > 2) out.push([ctrls[i], ctrls[j], Math.round(w * h)]);
        }
    }
    return out;
}

/** 무대를 전체 화면처럼 켠다. */
async function enterFull(frame, stage, w, h) {
    await resizeFrame(frame, w, h);
    stage.classList.add('fs-on');
    stage.style.cssText += ';position:fixed;inset:0;z-index:2147483647;margin:0';
    frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('resize'));
    await new Promise((r) => setTimeout(r, 400));
}
function leaveFull(frame, stage) {
    stage.classList.remove('fs-on', 'fs-drawer-open');
    stage.style.position = stage.style.inset = stage.style.zIndex = stage.style.margin = '';
    frame.contentWindow.dispatchEvent(new frame.contentWindow.Event('resize'));
}

export async function measure(page) {
    const found = [];
    const {frame, win, doc} = await openFrame(page, ...NARROW);
    try {
        // 1. 375px
        const root = doc.documentElement;
        const over = root.scrollWidth - root.clientWidth;
        if (over > 1) {
            const wide = [...doc.body.querySelectorAll('*')].filter((el) => visible(el, win)
                && el.getBoundingClientRect().right > root.clientWidth + 1 && !inScroller(el, win, doc.body));
            const top = wide.filter((el) => !wide.includes(el.parentElement)).slice(0, 3).map(label).join(', ');
            found.push(['375 넘침', `페이지가 가로로 ${over}px 넘친다 — ${top}`]);
        }
        const narrow = controlsIn(doc.body, win);
        for (const el of narrow) {
            const r = el.getBoundingClientRect();
            if (r.right > root.clientWidth + 1 && !inScroller(el, win, doc.body)) {
                found.push(['375 밖', `${label(el)} 가 화면 오른쪽 밖(${Math.round(r.right)}px)에 있다`]);
            }
        }
        for (const [a, b, area] of overlaps(narrow, win)) found.push(['375 겹침', `${label(a)} 와 ${label(b)} 가 겹친다(${area}px²)`]);

        // 2·3. 전체 화면 — 지금 보이는 무대마다
        const stages = [...doc.querySelectorAll('.fs-stage')].filter((s) => visible(s, win));
        for (const stage of stages) {
            for (const [w, h] of FULL) {
                await enterFull(frame, stage, w, h);
                const sx = stage.scrollWidth - stage.clientWidth;
                if (sx > 1) found.push([`전체 ${w} 넘침`, `무대 #${stage.id} 가 가로로 ${sx}px 넘친다`]);
                const ctrls = controlsIn(stage, win);
                for (const [a, b, area] of overlaps(ctrls, win)) found.push([`전체 ${w} 겹침`, `${label(a)} 와 ${label(b)} 가 겹친다(${area}px²)`]);
                for (const el of ctrls) {
                    const r = el.getBoundingClientRect();
                    if ((r.right > w + 1 || r.left < -1) && !inScroller(el, win, stage)) {
                        found.push([`전체 ${w} 밖`, `${label(el)} 가 화면 가로 밖(${Math.round(r.left)}~${Math.round(r.right)})에 있다`]);
                    }
                }
                // **닿을 수 있는가는 실제로 스크롤해 보고 판정한다.** 화면 아래에 있어도 무대나
                // 안쪽 칸이 스크롤되면 누를 수 있다. 스크롤해도 화면 안에 보이지 않으면 없는 조작이다.
                for (const el of ctrls) {
                    const in화면 = (c) => c && c.top >= -1 && c.bottom <= h + 1 && c.left >= -1 && c.right <= w + 1;
                    if (in화면(clippedRect(el, win))) continue;
                    // `scrollIntoView` 는 사람이 못 굴리는 `overflow: hidden` 상자까지 굴린다.
                    // 굴러간 상자가 모두 사람이 굴릴 수 있는(auto · scroll) 것일 때만 닿는다고 본다.
                    const chain = [];
                    for (let p = el.parentElement; p; p = p.parentElement) chain.push([p, p.scrollTop, p.scrollLeft]);
                    el.scrollIntoView({block: 'nearest', inline: 'nearest'});
                    const 못굴림 = chain.some(([p, t, l]) => (p.scrollTop !== t || p.scrollLeft !== l)
                        && !['auto', 'scroll'].includes(win.getComputedStyle(p)[p.scrollTop !== t ? 'overflowY' : 'overflowX']));
                    const c = clippedRect(el, win);
                    if (못굴림 || !in화면(c)) {
                        found.push([`전체 ${w} 닿지 않음`, `${label(el)} 가 스크롤해도 화면 안에 들어오지 않는다`
                            + (c ? `(${Math.round(c.top)}~${Math.round(c.bottom)}px)` : '(잘려 보이지 않는다)')]);
                    }
                }
                for (const p of [stage, ...stage.querySelectorAll('*')]) if (p.scrollTop) p.scrollTop = 0;
                leaveFull(frame, stage);
            }
        }
    } finally {
        frame.remove();
    }
    return found;
}

for (const page of SIM_PAGES) {
    test(page.replace('/simulator/', ''), async () => {
        const found = await measure(page);
        expect(found.map(([k, m]) => `[${k}] ${m}`)).toEqual([]);
    });
}
