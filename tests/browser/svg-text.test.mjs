// 강의노트 그림(SVG) 속 글자를 **진짜 브라우저에서 재어** 서로 겹치거나 너무 작게 그려지지 않는지 본다.
//
// 정적 검사(`check -- html`)는 `font-size` 숫자만 본다. 그런데 SVG 글자는 **그림이 실제로 그려지는
// 폭에 비례해** 줄어들고, 글자 상자의 폭은 글꼴이 정한다 — 둘 다 레이아웃이 끝나야 알 수 있다.
// 2026-09-25 에 197편을 손으로 실측해 그림 아홉을 고쳤다. 제목과 첫 표지가 포개진 것, 3열 칸에
// 눌려 16px 글자가 11.9px 로 그려진 순서도가 그렇다. 글자를 고칠 때마다 다시 생길 수 있어 검사로 세웠다.
//
// **ci 에 넣지 않는다**(2026-09-25 사용자 결정) — 다 재면 1~2분인데 SVG 를 고칠 때만 뜻이 있다.
// `npm run audit -- svg [폴더]` 가 정적 목록 뒤에 이것을 부른다. CLAUDE.md 가 SVG 를 고친 뒤에 돌리라고 적는다.
//
// **글자가 든 SVG 가 있는 페이지만 잰다.** 과목 폴더의 HTML 을 받아 본문에 `<svg` 와 `<text` 가
// 함께 있는 것만 iframe 에 띄운다. 폭은 1366 — 교실 화면에서 가장 흔한 폭이고, 좁은 화면의 SVG 는
// `min-width` 로 가로 스크롤되므로 글자 크기가 바뀌지 않는다.
//
// 판정은 둘뿐이다. 실측에서 헛경보 없이 결함만 잡은 것이다.
//   1. 한 그림 안에서 **글자끼리 겹침** — 두 글자 상자가 가로 2 · 세로 3(viewBox 단위)을 넘게 포갠다
//   2. **화면에 그려지는 글자가 12px 미만** — `font-size` × (그린 폭 ÷ viewBox 폭)
// 「글자가 상자를 뚫는가」는 넣지 않았다. 어느 도형이 그 글자의 상자인지 기계가 가리지 못해
// 네 바이트를 묶은 큰 칸 안의 글자를 한 바이트 칸 기준으로 걸었다.
//
// 닫힌 <details> · 숨긴 탭 속 그림은 그려지지 않아 잴 수 없다 — 건너뛴다.
import {expect, test} from 'vitest';
import {openFrame} from './_frame.mjs';
import subjects from '/subjects.json';

const W = 1366, H = 900;
const MIN_PX = 12;
const PARALLEL = 4;

// `npm run audit -- svg <폴더>` 가 폴더를 넘긴다. 없으면 과목 전체.
const DIRS = JSON.parse(import.meta.env.VITE_SVG_DIRS || '[]').map((d) => '/' + d.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '') + '/');
const PAGES = Object.keys(import.meta.glob(['/*/**/*.html', '!**/node_modules/**', '!/dist*/**', '!/simulator/**', '!/tests/**']))
    .filter((p) => subjects.subjects.some((s) => p.startsWith(`/${s.dir}/`)))
    .filter((p) => !DIRS.length || DIRS.some((d) => p.startsWith(d)))
    .sort();

/** 그림 하나를 잰다 — 걸린 것을 글로 돌려준다. */
function measureSvg(svg, win) {
    const out = [];
    const vb = svg.viewBox?.baseVal;
    if (!vb || !vb.width) return out;
    const r = svg.getBoundingClientRect();
    const sctm = svg.getCTM();
    if (!r.width || !sctm) return out;
    const scale = r.width / vb.width;
    const inv = sctm.inverse();
    // 글자 상자를 그림의 viewBox 좌표로 옮긴다 — <g transform> 안의 글자도 같은 자로 잰다.
    const box = (el) => {
        const b = el.getBBox(), m = inv.multiply(el.getCTM());
        return {x: m.a * b.x + m.c * b.y + m.e, y: m.b * b.x + m.d * b.y + m.f, w: b.width * m.a, h: b.height * m.d};
    };
    const name = (svg.getAttribute('aria-label') || '').slice(0, 30) || '(이름 없는 그림)';
    const texts = [...svg.querySelectorAll('text')]
        .map((t) => ({t, s: t.textContent.replace(/\s+/g, ' ').trim()}))
        .filter(({s}) => s)
        .map((o) => ({...o, ...box(o.t)}))
        .filter((o) => o.w > 0);
    for (const o of texts) {
        const px = parseFloat(win.getComputedStyle(o.t).fontSize) * scale;
        if (px < MIN_PX) out.push(`「${name}」 글자 「${o.s.slice(0, 20)}」가 ${px.toFixed(1)}px 로 그려진다`);
    }
    for (let i = 0; i < texts.length; i++) {
        for (let j = i + 1; j < texts.length; j++) {
            const a = texts[i], b = texts[j];
            if (a.t.contains(b.t) || b.t.contains(a.t)) continue;
            const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
            const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
            if (ox > 2 && oy > 3) out.push(`「${name}」 글자 「${a.s.slice(0, 15)}」와 「${b.s.slice(0, 15)}」가 겹친다`);
        }
    }
    return out;
}

test('강의노트 그림 속 글자가 겹치거나 12px 보다 작게 그려지지 않는다', async () => {
    // 글자가 든 SVG 가 있는 페이지만 고른다.
    const t0 = performance.now();
    const found = await Promise.all(PAGES.map(async (p) => {
        const html = await (await fetch(encodeURI(p))).text();
        return /<svg[\s>][\s\S]*?<text[\s>]/.test(html) ? p : null;
    }));
    const withText = found.filter(Boolean);
    const t1 = performance.now();
    expect(withText.length, '글자가 든 그림이 있는 페이지를 하나도 못 찾았다 — 검사가 헛돈다').toBeGreaterThan(0);

    const problems = [];
    let measured = 0;
    const queue = [...withText];
    const worker = async () => {
        while (queue.length) {
            const p = queue.shift();
            const {frame, win, doc} = await openFrame(encodeURI(p), W, H);
            for (const svg of doc.querySelectorAll('svg')) {
                if (!svg.querySelector('text') || !svg.getBoundingClientRect().width) continue;
                measured++;
                for (const m of measureSvg(svg, win)) problems.push(`${p.slice(1)} — ${m}`);
            }
            frame.remove();
        }
    };
    await Promise.all(Array.from({length: PARALLEL}, worker));
    console.log(`svg-text: 페이지 ${withText.length}/${PAGES.length} · 그림 ${measured} · 고르기 ${((t1 - t0) / 1000).toFixed(1)}초 · 재기 ${((performance.now() - t1) / 1000).toFixed(1)}초`);
    expect(measured, '잰 그림이 없다 — 레이아웃이 끝나기 전에 쟀다').toBeGreaterThan(0);
    expect(problems).toEqual([]);
}, 600_000);
