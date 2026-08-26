// 시뮬레이터 페이지를 **원문 그대로 node 에서 돌리는 받침대.**
//
// 페이지 원문을 **jsdom** 에 물리고, 인라인 `<script>` 를 문서에 놓인 차례대로 돌린 뒤
// `DOMContentLoaded` · `load` 까지 진짜로 보낸다. 캔버스 컨텍스트만은
// **그린 명령의 좌표를 적어 두는 가짜**다 — 픽셀 없이 그림을 기하로 따지려는 것이다.
//
// **손으로 만든 가짜 DOM 을 2026-08-26 에 버렸다.** 가짜는 물어보는 것마다 그럴듯한 값을
// 내놓지만 «진짜와 다르게» 내놓는다. `closest()` 가 늘 `null` 이라 위임해 받는 클릭이
// 통째로 죽어 있었고, `querySelectorAll` 은 아무 선택자에나 같은 것 열여섯 개를 내놓았다.
// **가짜가 조용히 헛돌면 검사는 초록인데 화면은 깨진다** — 실제로 그렇게 새어 나간
// 결함을 브라우저에서 잡았다.
//
// **공용 라이브러리는 진짜를 얹는다.** 진입점(`src/entries/simulator/…`)이 무엇을
// import 하는지 읽어서 그대로 평가한다 — 여기에 목록을 다시 적으면 낡는다.
// **d3 넷(`REAL_PACKAGES`)도 진짜로 얹는다.** 순수 계산과 DOM 조작뿐이라 jsdom 위에서
// 그대로 돌기 때문이다. 그래서 트리 뷰와 그래프 뷰가 이제 검사에서 실제로 그린다.
// 나머지 바깥 꾸러미(prismjs · chart.js · ml5 · mathjax)는 여전히 껍데기로 때운다 —
// 어느 페이지가 그런 처지인지는 `stubbed` 로 돌려주므로 **검사 쪽에서 반드시 밝힐 것.**
// 아무것도 안 하는 스텁을 통과로 읽으면 검사가 헛돈다.
//
// **여기서도 못 보는 것.** jsdom 에는 레이아웃이 없다. 글자 폭(`getComputedTextLength`)도
// 상자 크기도 진짜가 아니라 받침대가 쥔 값이거나 어림값이다.
// **겹침·넘침 같은 «실제 픽셀» 판정은 브라우저 몫이다.**
//
// **`defer` 를 지킨다.** 진입점은 실제로도 `defer` 라 body 끝 인라인 스크립트보다
// 늦게 돈다(→ `tools/vite/classic-scripts.js`). 여기서도 인라인을 먼저 돌린 뒤
// 라이브러리를 얹으면 순서 의존 버그가 잡힐 텐데, **그러면 대부분이 즉시 죽는다.**
// 그래서 라이브러리를 먼저 얹되, 인라인이 파싱 시점에 `window.*` 를 만지는지는
// `parseTimeGlobals` 로 따로 일러 준다.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {JSDOM} from 'jsdom';

/**
 * **바깥 꾸러미 가운데 진짜로 얹어 주는 것.**
 *
 * 예전에는 바깥 꾸러미를 하나라도 부르면 그 모듈을 통째로 껍데기로 때웠다. 그래서
 * `tree-view.js`·`graph-view.js`가 검사에서 **아무 일도 안 하는 빈 껍데기**였고,
 * 그 위에서 도는 코드는 무엇을 해도 통과했다 — 콜백에 엉뚱한 모양을 기대해도,
 * 그리는 길에 `throw`를 심어도 초록이었다.
 *
 * d3 넷은 **순수 계산과 DOM 조작뿐**이라 jsdom 위에서 그대로 돈다. 그래서 진짜를 얹는다.
 * 나머지(prismjs·chart.js·ml5·mathjax)는 브라우저 전용 API에 기대거나 무거워서
 * 여전히 `STUB_GLOBALS`로 때운다 — **어느 쪽인지는 `stubbed`가 알려 준다.**
 */
const REAL_PACKAGES = ['d3-selection', 'd3-hierarchy', 'd3-zoom', 'd3-transition'];

/** 꾸러미 이름 → 그 모듈의 이름공간. 받침대가 뜰 때 한 번만 읽는다. */
const PKG = {};
for (const name of REAL_PACKAGES) PKG[name] = await import(name);

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 검사를 옛 판에 돌려 **실제로 실패하는지** 보려고 자리를 바꿀 수 있게 둔다.
    새 판에서 0건이 나오는 검사는 제대로 잡는 것인지 헛도는 것인지 구별되지 않는다. */
export const SIM_ROOT = process.env.SIM_ROOT || path.join(ROOT, 'simulator');
const LIB_DIR = path.join(ROOT, 'src', 'entries', '_lib');
const ENTRY_ROOT = path.join(ROOT, 'src', 'entries', 'simulator');

/** 바깥 의존이 있어 그대로 평가할 수 없는 라이브러리가 올리는 전역. */
const STUB_GLOBALS = {
    /* **트리 뷰와 그래프 뷰는 이제 진짜가 얹힌다**(`REAL_PACKAGES`). 여기 남겨 둔 껍데기는
       그것을 못 얹었을 때의 마지막 그물이다 — 진입점이 바뀌어 다시 못 얹게 되면
       페이지가 죽는 대신 `stubbed` 에 이름이 찍혀 **검사 출력이 그렇다고 말한다.** */
    createTreeView: () => stubObject(),
    createGraphView: () => stubObject(),
    Prism: {highlightAll() {}, highlightElement() {}, languages: {}},
    Chart: class {
        constructor() { this.data = {labels: [], datasets: [{data: []}, {data: []}]}; }
        update() {}
        resize() {}
        destroy() {}
    },
    MathJax: {typesetPromise: () => Promise.resolve(), typeset() {}},
    ml5: {},
    p5: class {},
};

function stubObject() {
    return new Proxy({}, {
        get: (t, k) => (k === 'then' ? undefined : (t[k] ??= () => stubObject())),
        has: () => true,
    });
}

/** 그린 명령의 좌표를 적어 두는 가짜 2D 컨텍스트. */
export function makeCtx(canvas) {
    if (canvas._ctx) return canvas._ctx;
    const t = {ops: [], canvas, transform: null};
    let cur = null;
    canvas._ctx = new Proxy(t, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'measureText') return (s) => ({width: String(s).length * 8});
            if (k === 'createLinearGradient' || k === 'createRadialGradient') {
                return () => ({addColorStop() {}});
            }
            if (k === 'getImageData') return (x, y, w, h) => ({data: new Uint8ClampedArray(w * h * 4), width: w, height: h});
            if (k === 'beginPath') return () => { cur = {op: 'path', pts: []}; t.ops.push(cur); };
            if (k === 'moveTo' || k === 'lineTo') return (x, y) => { if (cur) cur.pts.push([x, y]); };
            if (k === 'rect') return (x, y, w, h) => { if (cur) cur.rect = [x, y, w, h]; };
            if (k === 'arc') return (x, y, r) => t.ops.push({op: 'arc', x, y, r});
            if (k === 'stroke') return () => { if (cur) cur.style = t._stroke; };
            /* **`fillStyle` 은 `arc()` 뒤에 정해지는 일이 많다.** 그리는 시점에 색을 적으면
               전부 엉뚱한 색으로 기록되어, 찾는 도형을 하나도 못 찾고 그냥 통과한다. */
            if (k === 'fill') return () => { const last = t.ops.at(-1); if (last) last.fill = t._fill; };
            // **배율을 적어 둔다.** 「CSS 1픽셀이 실제 몇 픽셀로 그려지는가」가 곧 선명도다.
            if (k === 'setTransform') return (a, b, c, d, e, f) => { t.transform = [a, b, c, d, e, f]; };
            if (k === 'scale') return (x, y) => {
                const m = t.transform || [1, 0, 0, 1, 0, 0];
                t.transform = [m[0] * x, m[1], m[2], m[3] * y, m[4], m[5]];
            };
            if (typeof k === 'string') return () => {};
            return undefined;
        },
        set(t, k, v) {
            if (k === 'strokeStyle') t._stroke = v;
            if (k === 'fillStyle') t._fill = v;
            t[k] = v;
            return true;
        },
    });
    return canvas._ctx;
}

/* ================================================================
   진입점에서 시작해 **상대경로 import 를 따라간다.**

   예전에는 진입점에 적힌 `_lib/…` 이름을 **한 겹만** 훑어 얹었다. 시뮬레이터 한 장이
   인라인 스크립트 하나로 되어 있던 동안에는 그것으로 충분했지만, **페이지를 모듈로
   쪼개면 알맹이가 통째로 검사 밖으로 빠진다** — 뜨기만 하면 통과가 되어 검사가 헛돈다.

   ES 모듈을 진짜로 돌리는 대신, **같은 문맥에 차례로 풀어 놓고 이름으로 잇는다.**
   의존을 먼저 얹으므로 `export` 한 이름이 이미 그 문맥에 있고, `import` 문은 필요한
   자리에만 별명을 만들어 주는 한 줄로 바뀐다.

   **여기서 오는 한계 둘을 밝혀 둔다.**
     - 모듈 둘이 같은 이름을 top-level 로 선언하면 뒤엣것이 「already been declared」로
       죽는다. 진짜 모듈이라면 각자의 방이 있으니 괜찮았을 것이다. **조용히 틀리지 않고
       시끄럽게 죽으므로** 그대로 둔다 — 시뮬레이터 쪽에서 이름을 겹치지 않게 짓는다.
     - 바깥 꾸러미(d3·prismjs·chart.js)를 부르는 모듈은 여전히 못 얹는다. 그 모듈을
       import 하던 쪽에는 `STUB_GLOBALS` 의 껍데기를 대신 물려준다.
   ================================================================ */

/** 한 줄짜리 `import` 문. 저장소의 진입점과 `_lib` 은 전부 이 꼴이다.
 *
 * **뒤에 붙은 한 줄 주석까지 받는다.** 없이 두었더니 `import 'd3-transition';   // …` 한 줄이
 * 안 잡혀, 그 파일이 통째로 「못 얹는 것」으로 떨어졌다. **주석 하나가 검사 범위를 갈랐다.** */
const IMPORT_RE = /^[ \t]*import\s+(?:([^'"]*?)\s+from\s+)?(['"])([^'"]+)\2;?[ \t]*(?:\/\/.*)?$/gm;

/** 모듈이 내보내는 이름들 — `import * as ns` 를 물려주려면 이것이 필요하다. */
function exportNames(src) {
    const names = new Set();
    for (const m of src.matchAll(/^[ \t]*export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) {
        names.add(m[1]);
    }
    for (const m of src.matchAll(/^[ \t]*export\s*\{([^}]*)\}/gm)) {
        for (const piece of m[1].split(',')) {
            const t = piece.trim();
            if (!t) continue;
            const as = t.split(/\s+as\s+/);
            names.add((as[1] || as[0]).trim());
        }
    }
    return [...names].filter((n) => n !== 'default');
}

/** `{a, b as c}` · `X` · `* as ns` 를 갈라 놓는다. */
function splitClause(clause) {
    const out = {named: [], def: null, ns: null};
    let rest = clause.trim();
    const braced = rest.match(/\{([^}]*)\}/);
    if (braced) {
        for (const piece of braced[1].split(',')) {
            const t = piece.trim();
            if (!t) continue;
            const [orig, local] = t.split(/\s+as\s+/).map((x) => x.trim());
            out.named.push([orig, local || orig]);
        }
        rest = rest.replace(braced[0], '').replace(/,\s*$/, '').trim();
    }
    const ns = rest.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)/);
    if (ns) { out.ns = ns[1]; rest = ''; }
    rest = rest.replace(/,\s*$/, '').trim();
    if (/^[A-Za-z_$][\w$]*$/.test(rest)) out.def = rest;
    return out;
}

const defaultVar = (file) => '__default__' + path.basename(file).replace(/\W/g, '_');

/**
 * 진입점의 import 그래프를 훑어 **의존 먼저** 늘어놓는다.
 * @returns {{order: string[], stubbed: string[], status: Map<string,string>}}
 */
function moduleGraph(entryFile) {
    const order = [];
    const stubbed = [];
    const status = new Map();          // 파일 → 'ok' | 'stub'

    const visit = (file) => {
        if (status.has(file)) return status.get(file);
        if (!fs.existsSync(file)) { status.set(file, 'stub'); return 'stub'; }
        status.set(file, 'stub');      // 순환 import 에 빠지지 않게 먼저 찍어 둔다
        const src = fs.readFileSync(file, 'utf8');
        let bare = false;
        for (const m of src.matchAll(IMPORT_RE)) {
            const spec = m[3];
            if (spec.startsWith('.')) visit(path.resolve(path.dirname(file), spec));
            // **진짜로 얹어 주는 꾸러미는 못 얹을 까닭이 아니다.**
            else if (!(spec in PKG)) bare = true;
        }
        if (bare) { stubbed.push(path.basename(file)); return 'stub'; }
        status.set(file, 'ok');
        order.push(file);
        return 'ok';
    };

    visit(entryFile);
    return {order, stubbed, status};
}

/** 모듈 하나를 이 문맥에서 돌 수 있는 평범한 스크립트로 바꾼다. 못 바꾸면 `null`. */
function plainScript(file, status) {
    let src = fs.readFileSync(file, 'utf8');

    src = src.replace(IMPORT_RE, (whole, clause, q, spec) => {
        /* **진짜로 얹어 주는 바깥 꾸러미.** 받침대가 이미 읽어 두었으므로 그 이름공간에서
           꺼내 쓰기만 하면 된다. 곁불 import(`import 'd3-transition'`)도 여기서 끝난다 —
           읽는 것만으로 `selection.prototype`에 붙는 종류라, 우리가 읽어 둔 것이 곧 그것이다. */
        if (!spec.startsWith('.') && spec in PKG) {
            if (!clause) return '';
            const {named, def, ns} = splitClause(clause);
            /* **`const` 가 아니라 `var` 로 푼다.** 이 받침대는 모듈을 한 스코프에 모아
               돌리므로, 트리 뷰와 그래프 뷰가 둘 다 `select` 를 가져다 쓰면
               `const` 로는 「already been declared」로 죽는다. 같은 꾸러미에서 꺼낸
               같은 이름은 **값도 같으므로** 다시 선언되어도 달라질 것이 없다.
               (저장소 모듈끼리 이름이 겹치는 것은 여전히 시끄럽게 죽는다 — 그건 그대로 둔다.) */
            const out = [];
            const src꾸러미 = `__pkg[${JSON.stringify(spec)}]`;
            if (ns) out.push(`var ${ns} = ${src꾸러미};`);
            if (def) out.push(`var ${def} = ${src꾸러미}.default;`);
            for (const [orig, local] of named) out.push(`var ${local} = ${src꾸러미}.${orig};`);
            return out.join('\n');
        }

        const dep = spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null;
        const stub = !dep || status.get(dep) !== 'ok';
        if (!clause) return '';                         // 곁불 import — 이미 얹혔거나 못 얹는다
        const {named, def, ns} = splitClause(clause);
        const out = [];
        if (ns) {
            out.push(`const ${ns} = ` + (stub ? '__stub()'
                : `{${exportNames(fs.readFileSync(dep, 'utf8')).join(', ')}}`) + ';');
        }
        if (def) out.push(`const ${def} = ` + (stub ? '__stub()' : defaultVar(dep)) + ';');
        for (const [orig, local] of named) {
            /* **못 얹은 모듈에서 오는 이름은 껍데기로 물려준다.** `STUB_GLOBALS` 에
               같은 이름이 있으면 그것을 쓴다 — d3 뷰가 그렇게 얹혀 있다. */
            if (stub) out.push(`const ${local} = (globalThis.${orig} !== undefined ? globalThis.${orig} : __stub());`);
            else if (orig !== local) out.push(`const ${local} = ${orig};`);
        }
        return out.join('\n');
    });

    src = src
        .replace(/^[ \t]*export\s+default\s+/m, `var ${defaultVar(file)} = `)
        .replace(/^[ \t]*export\s+(?=(?:const|let|var|function|class|async)\b)/gm, '')
        .replace(/^[ \t]*export\s*\{[^}]*\};?[ \t]*$/gm, '');

    // 여러 줄에 걸친 import·export 가 남았으면 손대지 않는다. 어설프게 고치면 조용히 틀린다.
    if (/^[ \t]*(?:import|export)\b/m.test(src)) return null;
    return src;
}

/**
 * 페이지 하나를 띄운다.
 *
 * @param {string} name  `simulator/` 아래의 확장자 없는 경로 (예: 'ai/supervised-svm').
 *                       **하위 폴더까지 붙인 이름이다** — 진입점(`src/entries/simulator/`)이
 *                       같은 결로 갈라져 있어 한쪽만 폴더를 떼면 라이브러리를 못 찾는다.
 * @param {object} opts  {dpr, box, selectors, globals}
 */
export function loadSim(name, opts = {}) {
    const dpr = opts.dpr ?? 2;
    const state = {box: {w: opts.box?.w ?? 800, h: opts.box?.h ?? 600}, cssVars: {}};
    const errors = [];

    /* ---- 진짜 DOM ----
       페이지 원문을 jsdom 에 그대로 물린다. `outside-only` 라 페이지의 `<script>` 는
       jsdom 이 돌리지 않는다 — **차례를 우리가 쥐어야** 하기 때문이다(진입점이 `defer`다).

       **손으로 만든 가짜 DOM 을 버린 까닭.** 가짜는 물어보는 것마다 그럴듯한 값을
       내놓지만 «진짜와 다르게» 내놓는다. `closest()` 가 늘 `null` 이라 위임해 받는 클릭이
       통째로 죽어 있었고, `querySelectorAll` 은 아무 선택자에나 같은 것 열여섯 개를
       내놓았다. **가짜가 조용히 헛돌면 검사는 초록인데 화면은 깨진다.** */
    const html = fs.readFileSync(path.join(SIM_ROOT, name + '.html'), 'utf8');
    const dom = new JSDOM(html, {
        runScripts: 'outside-only',
        url: 'http://localhost/',
        pretendToBeVisual: true,      // requestAnimationFrame 을 갖춘다
    });
    const sandbox = dom.getInternalVMContext();
    const doc = dom.window.document;

    /* ---- jsdom 에 없는 것 ----
       **레이아웃과 캔버스가 없다.** 그래서 크기는 받침대가 쥐고 흔들고, 캔버스 컨텍스트는
       그린 명령을 적어 두는 가짜를 그대로 쓴다. **없는 것을 밝혀 두는 것이 검사의 절반이다** —
       글자 폭·상자 겹침 같은 «실제 픽셀» 판정은 여기서 할 수 없다(브라우저 몫이다). */
    const W = dom.window;
    const proto = W.Element.prototype;
    Object.defineProperty(proto, 'clientWidth', {get() { return Math.round(state.box.w); }, configurable: true});
    Object.defineProperty(proto, 'clientHeight', {get() { return Math.round(state.box.h); }, configurable: true});
    Object.defineProperty(proto, 'offsetWidth', {get() { return Math.round(state.box.w); }, configurable: true});
    Object.defineProperty(proto, 'offsetHeight', {get() { return Math.round(state.box.h); }, configurable: true});
    proto.getBoundingClientRect = function () {
        const {w, h} = state.box;
        return {top: 0, left: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0};
    };
    proto.scrollIntoView = function () {};
    // SVG 글자 재기는 jsdom 에 없다. `TextMeasurer` 가 0 을 보면 어림값으로 넘어간다.
    W.SVGElement.prototype.getBBox = function () { return {x: 0, y: 0, width: 0, height: 0}; };

    /* **`viewBox` 도 jsdom 에 없다.** `d3-zoom` 이 `hasAttribute('viewBox')` 로 갈래를 타고
       곧바로 `svg.viewBox.baseVal` 을 읽어서, 없으면 그 자리에서 죽는다.
       적혀 있는 값을 그대로 풀어 준다 — 없으면 0 넷이다. */
    /* `width`·`height` 도 마찬가지다. viewBox 가 없는 SVG 에서 `d3-zoom` 은
       `svg.width.baseVal.value` 로 넘어간다 — 그쪽도 jsdom 에 없다.
       받침대가 쥔 상자 크기를 돌려준다. */
    for (const 축 of ['width', 'height']) {
        Object.defineProperty(W.SVGSVGElement.prototype, 축, {
            get() { return {baseVal: {value: 축 === 'width' ? state.box.w : state.box.h}}; },
            configurable: true,
        });
    }

    Object.defineProperty(W.SVGSVGElement.prototype, 'viewBox', {
        get() {
            const n = (this.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
            const v = (i) => (Number.isFinite(n[i]) ? n[i] : 0);
            return {baseVal: {x: v(0), y: v(1), width: v(2), height: v(3)}};
        },
        configurable: true,
    });

    W.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(this); };
    W.HTMLCanvasElement.prototype.toDataURL = () => 'data:,';

    // 전체 화면은 jsdom 에 없다. 받침대가 직접 흔든다 → `fireFullscreenChange`
    doc.exitFullscreen = () => Promise.resolve();
    Object.defineProperty(doc, 'fullscreenEnabled', {value: true, configurable: true});
    proto.requestFullscreen = function () { return Promise.resolve(); };

    /* ---- 창에 얹는 것 ---- */
    W.console = {log() {}, warn() {}, error(...a) { errors.push(a.join(' ')); }, info() {}, debug() {}};
    W.devicePixelRatio = dpr;
    W.innerWidth = 1280;
    Object.defineProperty(W, 'innerHeight', {get: () => opts.innerHeight?.() ?? 900, configurable: true});
    W.matchMedia = () => ({matches: false, addEventListener() {}, addListener() {}, removeEventListener() {}});
    // 상자가 자라는 것을 지켜보는 쪽은 흉내 내지 않는다 — 이 받침대는 크기를 직접 흔든다.
    W.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    W.fetch = () => Promise.reject(new Error('no network'));
    W.alert = () => {};
    W.scrollTo = () => {};
    Object.defineProperty(W.navigator, 'mediaDevices', {
        value: {getUserMedia: () => Promise.reject(new Error('no camera'))}, configurable: true,
    });

    /* **d3 는 이 창 «바깥»에서 돈다.** 우리가 node 로 읽어 들인 모듈이라 그 전역은
       node 의 것이다. 그런데 `d3-zoom` 은 `node instanceof SVGElement` 로 갈래를 타므로,
       그 이름이 node 전역에 없으면 **`SVGElement is not defined` 로 죽는다.**
       지금 띄운 창의 생성자를 node 전역에 놓아 준다 — 받침대는 한 번에 한 장만 띄우므로
       뒤엣것이 앞엣것을 덮어도 문제가 없다. */
    for (const 이름 of ['SVGElement', 'Element', 'Node', 'HTMLElement', 'MouseEvent', 'CustomEvent']) {
        if (W[이름]) globalThis[이름] = W[이름];
    }

    for (const [k, v] of Object.entries(STUB_GLOBALS)) W[k] = v;
    for (const [k, v] of Object.entries(opts.globals || {})) W[k] = v;
    W.__stub = stubObject;      // 못 얹은 모듈에서 오는 이름을 물려줄 때 쓴다
    W.__pkg = PKG;              // 진짜로 얹어 주는 바깥 꾸러미

    /* **없는 id 를 물으면 만들어 준다.** 받침대가 흔들려고 쓰는 이름(`__fs` 따위)이
       페이지에는 없기 때문이다. 페이지에 있는 id 는 당연히 진짜 요소가 나온다. */
    const el = (id) => {
        let found = doc.getElementById(id);
        if (!found) {
            found = doc.createElement('div');
            found.id = id;
            doc.body.appendChild(found);
        }
        return found;
    };


    /* ---- 진입점의 import 그래프를 의존 먼저 얹는다 ----
       바깥 꾸러미에 기대는 모듈만 껍데기로 때우고, 나머지는 **진짜로 돌린다** —
       그래야 알고리즘과 모델 같은 계산 알맹이가 가짜가 아닌 진짜로 검사에 걸린다.
       **진입점 자신도 얹는다.** `window.X = X` 가 거기 있어서, 빼놓으면 페이지가
       실제로 쓰는 `window.X` 가 이 받침대에서만 비어 있게 된다. */
    const entryFile = path.join(ENTRY_ROOT, name + '.js');
    const {order, stubbed, status} = fs.existsSync(entryFile)
        ? moduleGraph(entryFile)
        : {order: [], stubbed: [], status: new Map()};
    for (const file of order) {
        const code = plainScript(file, status);
        if (code === null) { stubbed.push(path.basename(file)); continue; }
        try {
            vm.runInContext(code, sandbox, {filename: path.relative(ROOT, file)});
        } catch (e) {
            errors.push(`모듈 ${path.relative(ROOT, file)}: ${e.message}`);
        }
    }

    /* **마크업의 초기값을 손으로 실어 주던 자리가 없어졌다.**
       `value="8"`·`checked`·고른 `<option>` 을 정규식으로 긁어 스텁에 옮겨 담던 코드였다.
       jsdom 이 문서를 진짜로 파싱하므로 그런 값은 처음부터 제자리에 있다. */

    // ---- 페이지의 인라인 스크립트를 전부, 문서에 놓인 차례대로 ----
    const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const [i, code] of blocks.entries()) {
        try {
            vm.runInContext(code, sandbox, {filename: `${name}.inline${i}.js`});
        } catch (e) {
            errors.push(`인라인 스크립트 ${i}: ${e.message}`);
        }
    }

    /* **사건은 진짜로 쏜다.** 예전에는 등록된 함수를 우리가 들고 있다가 손으로 불렀는데,
       그러면 `preventDefault`·버블링·`e.target` 이 전부 흉내였다. 이제 jsdom 이 나른다.
       다만 페이지가 던진 예외는 검사에 보여야 하므로 여기서 잡아 둔다. */
    const fire = (target, type) => {
        try { target.dispatchEvent(new W.Event(type)); } catch (e) { errors.push(`${type}: ${e.message}`); }
    };
    W.addEventListener('error', (e) => errors.push(String(e.error?.message || e.message)));

    const lifecycle = () => {
        Object.defineProperty(doc, 'readyState', {value: 'interactive', configurable: true});
        fire(doc, 'DOMContentLoaded');
        Object.defineProperty(doc, 'readyState', {value: 'complete', configurable: true});
        fire(W, 'load');
        if (typeof W.onload === 'function') {
            try { W.onload(); } catch (e) { errors.push(`onload: ${e.message}`); }
        }
    };

    /** id 가 붙은 요소를 전부. 화면에 무엇이 찍혔는지 훑을 때 쓴다. */
    const idElements = () => [...doc.querySelectorAll('[id]')];

    return {
        sandbox, doc, window: W, el, errors, stubbed, state, dpr, blocks,
        lifecycle,
        setBox: (w, h) => { state.box.w = w; state.box.h = h; },
        fireResize: () => fire(W, 'resize'),
        fireFullscreenChange: (target) => {
            /* 실제 차례 — 공통 모듈(`_lib/fullscreen.js`)이 먼저 등록되어 resize 를 쏘고,
               그 뒤에 페이지의 핸들러가 돈다. */
            Object.defineProperty(doc, 'fullscreenElement', {value: target || null, configurable: true});
            fire(W, 'resize');
            fire(doc, 'fullscreenchange');
        },
        idElements,
        /**
         * 화면에 찍힌 글자. **`byId` 를 훑어 `_text`·`_html` 을 읽던 자리를 대신한다** —
         * 그 둘은 손으로 만든 스텁의 속살이었고 진짜 DOM 에는 없다.
         */
        texts: () => idElements().map((e) => ({
            id: e.id,
            text: e.textContent || '',
            html: e.innerHTML || '',
            value: typeof e.value === 'string' ? e.value : '',
        })),
        canvases: () => [...doc.querySelectorAll('canvas')].filter((c) => c._ctx),
        /* 페이지 안에서 이름을 풀어 본다. `let`·`const` 로 선언한 것은 창의 속성이
           되지 않으므로, 이름이 있는지 보려면 **그 문맥에서 평가해야** 한다. */
        evalInPage: (expr) => {
            try { return vm.runInContext(expr, sandbox, {filename: 'probe.js'}); } catch { return undefined; }
        },
    };
}
