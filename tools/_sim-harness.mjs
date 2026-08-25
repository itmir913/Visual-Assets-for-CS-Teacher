// 시뮬레이터 페이지를 **원문 그대로 node 에서 돌리는 받침대.**
//
// 인라인 `<script>` 를 통째로 떼어 내 DOM 을 흉내 낸 샌드박스에서 실행하고,
// `DOMContentLoaded` · `load` 까지 진짜 차례대로 보낸다. 캔버스 컨텍스트는
// **그린 명령의 좌표를 적어 두는 가짜**라 픽셀 없이 그림을 기하로 따질 수 있다.
//
// **공용 라이브러리는 진짜를 얹는다.** 진입점(`src/entries/simulator/…`)이 무엇을
// import 하는지 읽어서 그대로 평가한다 — 여기에 목록을 다시 적으면 낡는다.
// 다만 **d3 같은 바깥 의존이 있는 것은 얹지 못하고 가짜로 때운다.** 어느 페이지가
// 그런 처지였는지는 `stubbed` 로 돌려주므로, 검사 쪽에서 반드시 밝힐 것 —
// 아무것도 안 하는 스텁을 통과로 읽으면 검사가 헛돈다.
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

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** 검사를 옛 판에 돌려 **실제로 실패하는지** 보려고 자리를 바꿀 수 있게 둔다.
    새 판에서 0건이 나오는 검사는 제대로 잡는 것인지 헛도는 것인지 구별되지 않는다. */
export const SIM_ROOT = process.env.SIM_ROOT || path.join(ROOT, 'simulator');
const LIB_DIR = path.join(ROOT, 'src', 'entries', '_lib');
const ENTRY_ROOT = path.join(ROOT, 'src', 'entries', 'simulator');

/** 바깥 의존이 있어 그대로 평가할 수 없는 라이브러리가 올리는 전역. */
const STUB_GLOBALS = {
    /* d3 를 쓰는 뷰는 그대로 얹을 수 없다. **무엇을 물어도 함수를 내놓는 껍데기**로 둔다 —
       메서드 이름을 여기 베껴 적으면 진짜가 바뀔 때 조용히 낡는다. */
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

export function makeElementClass(state) {
    return class El {
        constructor(id = '', tag = 'div') {
            this.id = id;
            this.tagName = String(tag).toUpperCase();
            this.children = [];
            this._parent = undefined;
            this._depth = 0;
            this.dataset = {};
            this.hidden = false;
            this.disabled = false;
            this.checked = false;
            this.value = '';
            this.min = '';
            this.max = '';
            this.step = '';
            this.offsetHeight = 0;
            this.offsetWidth = 0;
            this._classes = new Set();
            this._text = '';
            this._html = '';
            this._listeners = {};
            this.style = new Proxy({setProperty: (k, v) => { state.cssVars[k] = v; }}, {
                get: (t, k) => (k in t ? t[k] : ''),
                set: (t, k, v) => { t[k] = v; return true; },
            });
        }

        /* **부모가 없는 요소는 없다.** 캔버스를 재는 쪽이 `parentElement.clientWidth` 를
           쓰므로, 스텁이 null 을 주면 페이지가 그 자리에서 죽는다. 물어보면 만들어 준다.
           깊이를 재서 두 칸 위는 body 로 끊는다 — 무한히 이어지면 조상을 훑는 코드가 돈다. */
        get parentElement() {
            if (this._parent === undefined) {
                if (this._depth >= 2) { this._parent = null; }
                else {
                    this._parent = new El('__box-' + (this.id || this.tagName), 'div');
                    this._parent._depth = this._depth + 1;
                    this._parent.children.push(this);
                }
            }
            return this._parent;
        }

        set parentElement(v) { this._parent = v; }

        get parentNode() { return this.parentElement; }

        get classList() {
            const c = this._classes;
            return {
                add: (...x) => x.forEach((v) => c.add(v)),
                remove: (...x) => x.forEach((v) => c.delete(v)),
                toggle: (v, on) => (on === undefined ? (c.has(v) ? c.delete(v) : c.add(v)) : (on ? c.add(v) : c.delete(v))),
                contains: (v) => c.has(v),
                /* 브라우저에 있는 것은 다 있어야 한다 — 없으면 **페이지가 멀쩡한데**
                   검사가 죽는다. 실제로 `classList.replace` 가 없어 여섯 건이 헛나왔다. */
                replace: (o, n) => (c.has(o) ? (c.delete(o), c.add(n), true) : false),
                item: (i) => [...c][i] ?? null,
                get length() { return c.size; },
            };
        }

        get className() { return [...this._classes].join(' '); }
        set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }

        /* 진짜 DOM 은 문자열로 바꾼다. 스텁이 안 바꾸면 라벨 검사가 **가짜로 실패**한다.
           **`textContent`·`innerHTML` 을 넣으면 자식이 통째로 갈린다.** 예전에는 빈
           문자열을 넣은 `innerHTML` 만 자식을 비웠는데, `textContent = ''` 로 상자를
           비우는 페이지에서는 **자식이 지워지지 않고 계속 쌓였다** — 다시 그릴 때마다
           불어나 받침대가 메모리를 다 쓰고 죽었고, 그리기 전에는 개수를 세는 검사가
           엉뚱한 값을 봤다. 진짜 DOM 과 다르게 굴면 검사가 없느니만 못하다. */
        get textContent() { return this._text; }
        set textContent(v) { this._setText(String(v)); }
        get innerText() { return this._text; }
        set innerText(v) { this._setText(String(v)); }
        get innerHTML() { return this._html; }

        /* **`innerHTML` 을 넣으면 `textContent` 도 따라 바뀐다.** 진짜 DOM 이 그렇다.
           둘을 따로 들고 있었더니, 굵은 글씨를 넣으려고 `innerHTML` 로 쓰는 자리에서
           **검사가 빈 글자를 보고 「글이 안 나왔다」고 헛짚었다.**
           태그를 걷어 내고 엔티티 몇 개만 되돌린다 — 파서를 흉내 낼 일은 아니다. */
        set innerHTML(v) {
            this._html = String(v);
            this.children = [];
            this._text = this._html
                .replace(/<[^>]*>/g, '')
                .replace(/&nbsp;/g, ' ')
                .replace(/&lt;/g, '<')
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&');
        }

        _setText(v) {
            this._text = v;
            this._html = v;
            this.children = [];
        }

        /* 상자 크기. **`clientWidth` 와 `getBoundingClientRect()` 는 다른 값이다** —
           rect 는 테두리까지 세고 소수로 나온다. 캔버스를 재는 쪽이 어느 것을 쓰는지가
           실제로 문제가 됐으므로 따로 흉내 낸다. */
        getBoundingClientRect() {
            const {w, h} = state.box;
            return {top: 0, left: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0};
        }

        get clientWidth() { return Math.round(state.box.w); }
        get clientHeight() { return Math.round(state.box.h); }

        /* 진짜 DOM 에 있는 것은 다 있어야 한다 — 없으면 **페이지가 멀쩡한데** 검사가 죽는다.
           `firstChild` 가 없어 겨루기 뷰가 그 자리에서 넘어졌다.
           (진짜 DOM 은 글자 마디도 세지만 이 받침대는 요소만 담는다.) */
        get firstChild() { return this.children[0] ?? null; }

        get lastChild() { return this.children[this.children.length - 1] ?? null; }

        get firstElementChild() { return this.children[0] ?? null; }

        get lastElementChild() { return this.children[this.children.length - 1] ?? null; }

        appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
        removeChild(c) { this.children = this.children.filter((x) => x !== c); return c; }
        insertBefore(c) { return this.appendChild(c); }
        remove() { if (this.parentElement) this.parentElement.removeChild(this); }
        setAttribute(k, v) { if (k.startsWith('data-')) this.dataset[k.slice(5)] = String(v); else this[k] = v; }
        getAttribute(k) { return k in this ? this[k] : null; }
        removeAttribute(k) { delete this[k]; }
        addEventListener(t, f) { (this._listeners[t] ||= []).push(f); }
        removeEventListener(t, f) { this._listeners[t] = (this._listeners[t] || []).filter((g) => g !== f); }
        dispatchEvent(e) { (this._listeners[e.type] || []).forEach((f) => f(e)); return true; }
        click() { this.dispatchEvent({type: 'click', target: this, preventDefault() {}, stopPropagation() {}}); }
        focus() {}
        blur() {}
        closest() { return null; }
        contains() { return false; }
        querySelectorAll(sel) { return state.queryAll ? state.queryAll(sel) : []; }
        querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
        getContext() { return makeCtx(this); }
        toDataURL() { return 'data:,'; }

        get width() { return this._w || 0; }
        set width(v) { this._w = v; }
        get height() { return this._h || 0; }
        set height(v) { this._h = v; }
    };
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

/** 한 줄짜리 `import` 문. 저장소의 진입점과 `_lib` 은 전부 이 꼴이다. */
const IMPORT_RE = /^[ \t]*import\s+(?:([^'"]*?)\s+from\s+)?(['"])([^'"]+)\2;?[ \t]*$/gm;

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
            else bare = true;          // 바깥 꾸러미 — 이 파일은 못 얹는다
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
    const state = {box: {w: opts.box?.w ?? 800, h: opts.box?.h ?? 600}, cssVars: {}, queryAll: null};
    const El = makeElementClass(state);

    const byId = new Map();
    const el = (id) => {
        if (!byId.has(id)) byId.set(id, new El(id, /canvas/i.test(id) ? 'canvas' : 'div'));
        return byId.get(id);
    };

    const winListeners = {};
    const docListeners = {};
    const errors = [];

    /* **선택자에는 요소를 몇 개쯤 내놓는다.** 빈 배열만 돌려주면 카드·칸을 훑는 UI 코드가
       통째로 건너뛰어, 페이지가 「돌았다」고 나오면서 실은 아무것도 안 한 것이 된다.
       같은 선택자에는 같은 요소를 준다 — 매번 새로 만들면 상태를 얹는 코드가 어긋난다.
       **이것은 진짜 DOM 이 아니다.** 개수에 기대는 판정을 이 받침대 위에서 하지 말 것. */
    const POOL = 16;
    const queryCache = new Map();
    const queryAll = (sel) => {
        const own = opts.selectors?.(sel, el);
        if (own) return own;
        if (!queryCache.has(sel)) {
            queryCache.set(sel, Array.from({length: POOL}, (_, i) => new El('__q' + queryCache.size + '_' + i)));
        }
        return queryCache.get(sel);
    };
    state.queryAll = queryAll;

    const doc = {
        documentElement: new El('__root'),
        body: new El('__body', 'body'),
        head: new El('__head', 'head'),
        getElementById: el,
        createElement: (tag) => new El('', tag),
        createElementNS: (ns, tag) => new El('', tag),
        createTextNode: (t) => ({nodeValue: String(t)}),
        querySelector: (s) => queryAll(s)[0] || null,
        querySelectorAll: (s) => queryAll(s),
        getElementsByClassName: () => [],
        getElementsByTagName: () => [],
        addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); },
        removeEventListener: () => {},
        fullscreenElement: null,
        fullscreenEnabled: true,
        exitFullscreen: () => Promise.resolve(),
        readyState: 'loading',
        hidden: false,
    };

    const sandbox = {
        console: {log() {}, warn() {}, error(...a) { errors.push(a.join(' ')); }, info() {}, debug() {}},
        Math, JSON, Date, Number, String, Boolean, Array, Object, Map, Set, Promise, Error, RegExp,
        isFinite, isNaN, parseFloat, parseInt, Infinity, NaN, undefined,
        Uint8ClampedArray, Float32Array, Float64Array, Int32Array,
        setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
        requestAnimationFrame: (f) => setTimeout(() => { try { f(performance.now()); } catch (e) { errors.push(String(e)); } }, 0),
        cancelAnimationFrame: clearTimeout,
        performance,
        getComputedStyle: () => new Proxy({}, {get: () => '0px'}),
        document: doc,
        navigator: {userAgent: 'node', mediaDevices: {getUserMedia: () => Promise.reject(new Error('no camera'))}},
        localStorage: {getItem: () => null, setItem() {}, removeItem() {}},
        alert() {},
        fetch: () => Promise.reject(new Error('no network')),
        ...STUB_GLOBALS,
        ...(opts.globals || {}),
    };
    sandbox.__stub = stubObject;   // 못 얹은 모듈에서 오는 이름을 물려줄 때 쓴다
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    sandbox.self = sandbox;
    sandbox.devicePixelRatio = dpr;
    sandbox.innerWidth = 1280;
    Object.defineProperty(sandbox, 'innerHeight', {get: () => opts.innerHeight?.() ?? 900, configurable: true});
    sandbox.scrollX = 0;
    sandbox.scrollY = 0;
    sandbox.scrollTo = () => {};
    sandbox.matchMedia = () => ({matches: false, addEventListener() {}, addListener() {}});
    sandbox.addEventListener = (t, f) => { (winListeners[t] ||= []).push(f); };
    sandbox.removeEventListener = () => {};
    sandbox.dispatchEvent = (e) => { (winListeners[e.type] || []).forEach((f) => f(e)); return true; };
    sandbox.Event = class { constructor(type) { this.type = type; } };
    // 상자가 자라는 것을 지켜보는 쪽은 흉내 내지 않는다 — 이 받침대는 크기를 직접 흔든다.
    sandbox.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
    sandbox.CustomEvent = sandbox.Event;

    vm.createContext(sandbox);

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

    const html = fs.readFileSync(path.join(SIM_ROOT, name + '.html'), 'utf8');

    /* **마크업에 적힌 초기값을 실어 준다.** 슬라이더의 `value="8"` 같은 것을 빼먹으면
       `parseInt('')` 가 NaN 이 되어 페이지가 엉뚱한 자리에서 죽는다 —
       **페이지 잘못이 아닌데 검사가 잘못이라고 소리치는** 가장 흔한 원인이다. */
    for (const m of html.matchAll(/<(input|select|textarea|option)\b([^>]*)>/g)) {
        const attrs = m[2];
        const id = attrs.match(/\bid="([^"]*)"/)?.[1];
        if (!id) continue;
        const node = el(id);
        for (const key of ['value', 'min', 'max', 'step', 'type']) {
            // 문자열 안의 `'\b'` 는 **백스페이스 문자**다. 낱말 경계로 쓰려면 두 번 적는다.
            const v = attrs.match(new RegExp('\\b' + key + '="([^"]*)"'))?.[1];
            if (v !== undefined) node[key] = v;
        }
        if (/\bchecked\b/.test(attrs)) node.checked = true;
    }

    /* `<select>` 는 태그에 `value` 가 없다. **고른 `<option>` 의 값이 곧 select 의 값**이다.
       이것을 빼먹으면 `parseInt(select.value)` 가 NaN 이 되어 페이지가 엉뚱하게 죽는다. */
    for (const m of html.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/g)) {
        const id = m[1].match(/\bid="([^"]*)"/)?.[1];
        if (!id) continue;
        const options = [...m[2].matchAll(/<option\b([^>]*)>/g)];
        const picked = options.find((o) => /\bselected\b/.test(o[1])) || options[0];
        const v = picked?.[1].match(/\bvalue="([^"]*)"/)?.[1];
        if (v !== undefined) el(id).value = v;
    }

    // ---- 페이지의 인라인 스크립트를 전부, 문서에 놓인 차례대로 ----
    const blocks = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]);
    for (const [i, code] of blocks.entries()) {
        try {
            vm.runInContext(code, sandbox, {filename: `${name}.inline${i}.js`});
        } catch (e) {
            errors.push(`인라인 스크립트 ${i}: ${e.message}`);
        }
    }

    const fire = (type, list) => {
        for (const f of list[type] || []) {
            try { f({type, target: sandbox}); } catch (e) { errors.push(`${type}: ${e.message}`); }
        }
    };

    const lifecycle = () => {
        doc.readyState = 'interactive';
        fire('DOMContentLoaded', docListeners);
        doc.readyState = 'complete';
        fire('load', winListeners);
        if (typeof sandbox.onload === 'function') {
            try { sandbox.onload(); } catch (e) { errors.push(`onload: ${e.message}`); }
        }
    };

    return {
        sandbox, doc, el, byId, errors, stubbed, state, dpr, blocks,
        lifecycle,
        setBox: (w, h) => { state.box.w = w; state.box.h = h; },
        fireResize: () => fire('resize', winListeners),
        fireFullscreenChange: (target) => {
            /* 실제 차례 — 공통 모듈(`_lib/fullscreen.js`)이 먼저 등록되어 resize 를 쏘고,
               그 뒤에 페이지의 핸들러가 돈다. */
            doc.fullscreenElement = target || null;
            fire('resize', winListeners);
            fire('fullscreenchange', docListeners);
        },
        canvases: () => [...byId.values()].filter((e) => e.tagName === 'CANVAS' && e._ctx),
        /* 페이지 안에서 이름을 풀어 본다. `let`·`const` 로 선언한 것은 sandbox 의 속성이
           되지 않으므로, 이름이 있는지 보려면 **그 문맥에서 평가해야** 한다. */
        evalInPage: (expr) => {
            try { return vm.runInContext(expr, sandbox, {filename: 'probe.js'}); } catch { return undefined; }
        },
    };
}
