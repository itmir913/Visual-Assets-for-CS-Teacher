// 다크 테마를 **진짜 브라우저에서 켜고** 글자가 읽히는지, 밝은 칸이 남지 않았는지 본다.
//
// 색의 짝은 `src/tailwind/theme.js`(유틸리티)와 `src/styles/_theme.css`(강의노트 <style>의 틀)가 준다.
// 둘 다 「어떤 색을 어떤 색으로」를 적는 표라서, 표에서 빠진 것 · 짝이 어긋난 것은 계산된 색을 봐야 드러난다.
//
// 토글을 다는 페이지(tools/vite/theme-pages.js — 강의노트 · 시뮬레이터 · 첫 화면)를 모두 띄워 셋을 본다.
//   1. **토글과 hero** — hero에 단추가 하나 있고, 누르면 테마가 뒤집히고 단추 이름도 따라 바뀐다.
//      다크에서 hero에는 짙은 막이 덮인다(안쪽 그림자라 글자는 늘 막 위에 온다).
//      `data-keep-color`를 단 요소는 다크에서도 필터 없이 라이트와 같은 색이다.
//   2. **글자 대비** — 보이는 글자마다 실제로 깔린 바탕과의 대비가 **WCAG AAA(본문 7 · 큰 글자 4.5)**를 넘는다.
//      다크는 AA로는 흐릿하다 — 어두운 바탕의 회색 글자는 수치보다 더 가라앉아 보인다.
//      같은 요소를 라이트에서도 재어 **다크가 만든 결함만** 건다. 라이트에서도 AAA 아래였고 다크가
//      그보다 나빠지지 않은 짝(과목 색 채움 위의 흰 글자 · 일부러 흐리게 둔 단계 표시 따위)은 라이트의
//      틀에서 온 것이라 이 검사의 몫이 아니다. 그 밖의 짝은 모두 다크에서 AAA를 넘어야 한다.
//   3. **밝은 칸** — 다크에서 밝은 바탕(상대 휘도 0.5 초과)이 넓게 남은 곳이 없다.
//
// **바탕은 조상을 거슬러 겹쳐 칠해 구한다.** 반투명 바탕(`bg-white/20` 따위)은 아래 칸과 섞이므로
// 불투명한 칸을 만날 때까지 올라가며 합성한다. 그림 바탕(그러데이션)을 만나면 색을 알 수 없어 건너뛴다 —
// hero가 그렇다. hero는 짙은 그러데이션에 흰 글자이고, 다크에서는 막을 덮어 더 짙어지기만 한다.
//
// **그림 필터가 걸린 칸(`data-figure` 따위) 속은 필터를 적용한 색으로 잰다** — 계산된 색은 화면의 색이 아니다.
// SVG 속 글자만은 보지 않는다(글자색이 `color`가 아니라 `fill`이다).
//
// 같은 (글자색, 바탕색, 자리)가 여러 번 나오면 한 줄로 묶는다 — 틀 하나가 어긋나면 수백 줄이 된다.
import {expect, test} from 'vitest';
import {label, openFrame, visible} from './_frame.mjs';
import {openSearch} from './_search.mjs';
import subjects from '/subjects.json';
import {hasThemeToggle} from '/tools/vite/theme-pages.js';

const W = 1366, H = 900;
const PARALLEL = 4;
const AAA = 7, AAA_LARGE = 4.5;
const AA = 4.5, AA_LARGE = 3;   // 그림 필터 속 글자
const BRIGHT = 0.5;          // 이보다 밝은 바탕이 다크에 남으면 걸린다
const BRIGHT_AREA = 4000;    // 그보다 작은 칸(점 · 막대 · 배지)은 강조색이라 둔다

// 토글을 다는 페이지 — 빌드와 같은 답(tools/vite/theme-pages.js)을 쓴다.
const PAGES = Object.keys(import.meta.glob(['/*.html', '/*/**/*.html', '!**/node_modules/**', '!/dist*/**', '!/tests/**']))
    .filter((p) => hasThemeToggle(subjects, p.slice(1)))
    .sort();

/** 계산된 색 → [r, g, b, a] (0~255, a는 0~1). `rgb()` · `rgba()` · `color(srgb …)` 셋을 받는다. */
function parse(c) {
    let m = c.match(/^rgba?\(([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\)$/);
    if (m) return [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : alpha(m[4])];
    m = c.match(/^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)(?: \/ ([\d.]+%?))?\)$/);
    if (m) return [m[1] * 255, m[2] * 255, m[3] * 255, m[4] === undefined ? 1 : alpha(m[4])];
    return null;
}
const alpha = (s) => (s.endsWith('%') ? parseFloat(s) / 100 : parseFloat(s));

/** 위 색을 아래 색 위에 칠한다. */
const over = (top, under) => {
    const a = top[3];
    return [0, 1, 2].map((i) => top[i] * a + under[i] * (1 - a)).concat(1);
};

const lum = ([r, g, b]) => {
    const ch = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

/**
 * 다크의 그림 필터(`invert(p) hue-rotate(θ)`, _theme.css 7절)를 색 하나에 적용한다 — 필터가 걸린 칸 안의
 * 계산된 색은 화면의 색이 아니므로, 화면에 실제로 보이는 색으로 바꿔서 잰다. 수식은 CSS Filter Effects 명세의 행렬이다.
 */
function applyFilter(filter, [r, g, b, a]) {
    const inv = Number((filter.match(/invert\(([\d.]+)\)/) || [])[1] ?? 0);
    const deg = Number((filter.match(/hue-rotate\(([-\d.]+)deg\)/) || [])[1] ?? 0);
    let [x, y, z] = [r, g, b].map((v) => v * (1 - 2 * inv) + 255 * inv);
    const t = (deg * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const m = [
        .213 + c * .787 - s * .213, .715 - c * .715 - s * .715, .072 - c * .072 + s * .928,
        .213 - c * .213 + s * .143, .715 + c * .285 + s * .140, .072 - c * .072 - s * .283,
        .213 - c * .213 - s * .787, .715 - c * .715 + s * .715, .072 + c * .928 + s * .072,
    ];
    const clamp = (v) => Math.max(0, Math.min(255, v));
    [x, y, z] = [m[0] * x + m[1] * y + m[2] * z, m[3] * x + m[4] * y + m[5] * z, m[6] * x + m[7] * y + m[8] * z].map(clamp);
    return [x, y, z, a];
}

/** 요소를 감싼 그림 필터(`invert` 가 든 filter)의 뿌리와 그 filter 값. 없으면 null. */
function filterOf(el, win) {
    for (let p = el; p; p = p.parentElement) {
        const f = win.getComputedStyle(p).filter;
        if (f && f.includes('invert')) return {root: p, filter: f};
    }
    return null;
}

/** 요소 뒤에 실제로 깔린 바탕(화면에 보이는 색). 그림 바탕을 만나면 null(알 수 없음). */
function backdrop(el, win) {
    const f = filterOf(el, win);
    const layers = [];
    for (let p = el; p; p = p.parentElement) {
        const cs = win.getComputedStyle(p);
        if (cs.backgroundImage !== 'none') return null;
        let c = parse(cs.backgroundColor);
        if (c && c[3] > 0) {
            if (f && f.root.contains(p)) c = applyFilter(f.filter, c);
            layers.push(c);
            if (c[3] >= 1) break;
        }
    }
    return layers.reverse().reduce((under, top) => over(top, under), [255, 255, 255, 1]);
}

/** 요소와 조상의 opacity를 곱한 값. */
function opacityOf(el, win) {
    let o = 1;
    for (let p = el; p; p = p.parentElement) o *= Number(win.getComputedStyle(p).opacity);
    return o;
}

const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
/** 걸린 자리를 사람이 찾을 수 있게 — 클래스 몇 개를 붙인 이름. */
const where = (el) => `<${el.tagName.toLowerCase()}${el.classList.length ? '.' + [...el.classList].slice(0, 4).join('.') : ''}>`;

/** 지금 테마에서 글자를 가진 요소마다 {el, r(대비), need, fg, bg}. 그리고 밝은 칸 목록. */
function measure(doc, win) {
    const texts = [], bright = [];
    const skip = (el) => el.closest('svg, .hero-gradient, [data-keep-color]');
    for (const el of doc.body.querySelectorAll('*')) {
        if (skip(el) || !visible(el, win)) continue;
        const cs = win.getComputedStyle(el);
        const bg = backdrop(el, win);
        if (!bg) continue;
        if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
            let fg = parse(cs.color);
            const f = fg && filterOf(el, win);
            if (f) fg = applyFilter(f.filter, fg);
            if (fg) {
                const shown = over([...fg.slice(0, 3), opacityOf(el, win) * fg[3]], bg);
                const size = parseFloat(cs.fontSize), bold = Number(cs.fontWeight) >= 700;
                const large = size >= 24 || (size >= 18.66 && bold);
                // 그림 필터 속 글자는 그림의 일부다 — 필터가 대비를 조금 깎으므로 AA로 본다.
                const need = f ? (large ? AA_LARGE : AA) : (large ? AAA_LARGE : AAA);
                texts.push({el, r: contrast(shown, bg), need, fg: shown, bg});
            }
        }
        const c = parse(cs.backgroundColor);
        if (c && c[3] > 0.5 && lum(bg) > BRIGHT) {
            const rect = el.getBoundingClientRect();
            if (rect.width * rect.height > BRIGHT_AREA) bright.push(`밝은 칸 ${hex(bg)} · ${where(el)}`);
        }
    }
    return {texts, bright};
}

/** 테마를 바꾼다. 카드 · 단추에 `transition` 이 걸려 있어, 그대로 두면 옮겨 가는 도중의 색을 잰다
 *  (기다리는 시간을 정해 두면 검사가 한꺼번에 돌아 CPU가 바쁠 때 어긋난다). 그래서 잴 frame 에서만
 *  전이를 끄고 곧바로 끝 색을 잰다. 애니메이션은 그대로 둔다 — 끄면 들어오며 나타나는 요소가
 *  처음 모양에 멈춘다. 화면의 CSS는 건드리지 않는다. */
function setTheme(doc, theme) {
    if (!doc.getElementById('dark-test-still')) {
        const s = doc.createElement('style');
        s.id = 'dark-test-still';
        s.textContent = '*,*::before,*::after{transition:none!important}';
        doc.head.append(s);
    }
    // 페이지가 실제로 쓰는 길(토글)로 바꾼다 — 스크립트가 <html>에 주는 색 체계 · 바탕까지 함께 바뀐다.
    if (doc.documentElement.dataset.theme !== theme) doc.querySelector('[data-theme-toggle]').click();
    doc.defaultView.getComputedStyle(doc.body).color;
}

/**
 * `prepare` 는 테마를 바꾼 **뒤마다** 돈다. 스크립트가 만드는 칸(첫 화면의 찾기 결과)을 다시 여는
 * 자리다 — `setTheme`이 테마 토글을 누르는데, 그 누름이 패널 바깥이라 결과가 접힌다.
 */
async function inspect(doc, win, prepare) {
    await setTheme(doc, 'light');
    await prepare?.();
    const light = new Map(measure(doc, win).texts.map((t) => [t.el, t]));
    await setTheme(doc, 'dark');
    await prepare?.();
    const {texts, bright} = measure(doc, win);
    const out = [...bright];
    for (const {el, r, need, fg, bg} of texts) {
        if (r >= need) continue;
        const before = light.get(el);
        // 라이트에서도 이 기준 아래였고 다크가 그보다 나빠지지 않았다 → 라이트의 틀에서 온 것
        // (과목 색 채움 위의 흰 글자 · 일부러 흐리게 둔 단계 표시 따위). 다크의 짝을 고쳐서 풀 일이 아니다.
        if (before && before.r < need && r >= before.r - 0.05) continue;
        out.push(`대비 ${r.toFixed(2)} < ${need}(라이트 ${before?.r.toFixed(2) ?? '?'}) — 글자 ${hex(fg)} / 바탕 ${hex(bg)} · ${where(el)}`);
    }
    return out;
}

/** 다크에서 hero에 짙은 막(안쪽 그림자)이 덮이는가. 테마를 잠시 다크로 바꿔 본다. */
function heroProblems(doc, win) {
    const root = doc.documentElement, was = root.dataset.theme;
    root.dataset.theme = 'dark';
    const shadow = win.getComputedStyle(doc.querySelector('header.hero-gradient')).boxShadow;
    root.dataset.theme = was;
    return shadow.includes('inset') ? [] : ['다크에서 hero에 짙은 막이 없다'];
}

/** 요소 뒤의 가장 가까운 불투명한 바탕(또는 그림 바탕)이 섬 `k` 안에 있는가. */
function ownBackdrop(el, k, win) {
    for (let p = el; p; p = p.parentElement) {
        const cs = win.getComputedStyle(p);
        const c = parse(cs.backgroundColor);
        if (cs.backgroundImage !== 'none' || (c && c[3] >= 1)) return k.contains(p);
    }
    return false;
}

/**
 * `data-keep-color`를 단 요소(색 자체가 내용인 그림 · 표)가 다크에서도 라이트와 같은 색인가.
 * 필터가 걸리지 않고, 안쪽 요소의 글자색 · 바탕색 · 채움색이 라이트 때와 하나도 다르지 않아야 하며,
 * 글자 뒤에 깔린 바탕이 섬 안에서 와야 한다.
 */
async function keepProblems(doc, win) {
    const keeps = [...doc.querySelectorAll('[data-keep-color]')];
    if (!keeps.length) return [];
    const PROPS = ['color', 'backgroundColor', 'fill', 'stroke'];
    const snap = () => keeps.map((k) => [k, ...k.querySelectorAll('*')].map((el) => {
        const cs = win.getComputedStyle(el);
        return PROPS.map((p) => cs[p]);
    }));
    await setTheme(doc, 'light');
    const light = snap();
    await setTheme(doc, 'dark');
    const dark = snap();
    const out = [];
    keeps.forEach((k, i) => {
        if (win.getComputedStyle(k).filter !== 'none') {
            out.push(`${where(k)}[data-keep-color]에 다크 필터가 걸렸다`);
            return;
        }
        // 섬은 글자색과 함께 **바탕도 스스로 가진다.** 글자 뒤의 불투명한 바탕이 섬 밖(카드)에서 오면
        // 라이트에서는 흰 카드라 안 보이다가 다크에서 짙은 카드가 비쳐 섬의 짙은 글자가 사라진다.
        // SVG 속 글자는 보지 않는다(글자색이 `fill`이고 바탕이 그림 안에 있다).
        const leak = [k, ...k.querySelectorAll('*')].find((el) => !el.closest('svg') && visible(el, win) &&
            [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && !ownBackdrop(el, k, win));
        if (leak) out.push(`${where(k)}[data-keep-color] 안 ${where(leak)}의 바탕이 섬 밖에서 온다 (섬 요소에 바탕 클래스를 단다)`);
        const els = [k, ...k.querySelectorAll('*')];
        const j = light[i].findIndex((v, n) => v.some((x, m) => x !== dark[i][n][m]));
        if (j < 0) return;
        const m = light[i][j].findIndex((x, n) => x !== dark[i][j][n]);
        // 바깥에서 물려받은 글자색이 흔한 까닭이다 — keep 요소에 글자색 클래스를 스스로 달면 풀린다.
        out.push(`${where(k)}[data-keep-color] 안 ${where(els[j])}의 ${PROPS[m]}이 다크에서 ${light[i][j][m]} → ${dark[i][j][m]}` +
            ' (바깥에서 물려받는 색이면 keep 요소에 글자색 클래스를 단다)');
    });
    await setTheme(doc, 'light');
    return out;
}

test('강의노트 · 시뮬레이터 · 첫 화면마다 hero에 토글이 하나 있고, 누르면 테마와 단추 이름이 바뀐다', async () => {
    expect(PAGES.length, '토글을 다는 페이지를 하나도 못 찾았다 — 검사가 헛돈다').toBeGreaterThan(0);
    const problems = [];
    const queue = [...PAGES];
    const worker = async () => {
        while (queue.length) {
            const p = queue.shift();
            const {frame, doc} = await openFrame(encodeURI(p), W, H);
            const btns = doc.querySelectorAll('[data-theme-toggle]');
            if (btns.length !== 1) problems.push(`${p.slice(1)} — 토글이 ${btns.length}개`);
            else if (!btns[0].closest('header.hero-gradient')) problems.push(`${p.slice(1)} — 토글이 hero 밖에 있다`);
            else {
                const root = doc.documentElement;
                const before = root.dataset.theme, name = btns[0].getAttribute('aria-label');
                btns[0].click();
                if (root.dataset.theme === before) problems.push(`${p.slice(1)} — 눌러도 테마가 그대로다`);
                if (btns[0].getAttribute('aria-label') === name) problems.push(`${p.slice(1)} — 눌러도 ${label(btns[0])} 이름이 그대로다`);
                // CSS가 오기 전의 첫 화면 — 스크립트가 <html>에 색 체계와 (다크면) 바탕을 곧바로 준다.
                for (let i = 0; i < 2; i++) {
                    const t = root.dataset.theme;
                    if (root.style.colorScheme !== t) problems.push(`${p.slice(1)} — ${t}인데 <html>의 color-scheme이 「${root.style.colorScheme}」다(CSS가 오기 전에 흰 바탕이 번쩍인다)`);
                    if ((t === 'dark') !== Boolean(root.style.backgroundColor)) problems.push(`${p.slice(1)} — ${t}인데 <html> 바탕이 「${root.style.backgroundColor}」다`);
                    if (i === 0) btns[0].click();
                }
                problems.push(...heroProblems(doc, frame.contentWindow).map((m) => `${p.slice(1)} — ${m}`));
                problems.push(...(await keepProblems(doc, frame.contentWindow)).map((m) => `${p.slice(1)} — ${m}`));
            }
            frame.remove();
        }
    };
    await Promise.all(Array.from({length: PARALLEL}, worker));
    expect(problems).toEqual([]);
}, 600_000);

test('다크에서 글자가 AAA 대비를 넘고 밝은 칸이 남지 않는다', async () => {
    const found = new Map();
    const queue = [...PAGES];
    const worker = async () => {
        while (queue.length) {
            const p = queue.shift();
            const {frame, win, doc} = await openFrame(encodeURI(p), W, H);
            // 첫 화면의 찾기 결과는 **스크립트가 만들고 패널은 접혀 있다** — 쳐서 열어 두지 않으면
            // 과목 칩 · 발췌 · 표시(<mark>)의 다크 짝을 이 검사가 한 번도 보지 못한다.
            const prepare = p === '/index.html' ? () => openSearch(doc) : undefined;
            for (const m of await inspect(doc, win, prepare)) {
                if (!found.has(m)) found.set(m, []);
                found.get(m).push(p.slice(1));
            }
            frame.remove();
        }
    };
    await Promise.all(Array.from({length: PARALLEL}, worker));
    const lines = [...found].map(([m, ps]) => `${m} — ${ps.length}쪽 (${ps[0]}${ps.length > 1 ? ' 외' : ''})`).sort();
    expect(lines).toEqual([]);
}, 600_000);
