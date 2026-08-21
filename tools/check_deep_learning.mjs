// 딥러닝 시뮬레이터를 **페이지 원문 그대로 돌려 본다.**
//
// 인라인 `<script>` 를 통째로 떼어 내 `window.onload` 까지 실행하고, DOM 은 그 코드가
// 부르는 것만 흉내 낸다. 캔버스 컨텍스트는 **그린 명령의 좌표를 적어 두는 가짜**다 —
// 픽셀은 없지만 좌표는 남으므로, 그림을 기하로 따져 볼 수 있다.
//
// **판정은 코드의 식을 베끼지 않고 따로 구한다.** 접선이 맞는지는 시뮬레이터의 `grad()` 가
// 아니라 **그려진 곡선 자체의 중앙차분**과 대조해서 본다. 같은 식으로 두 번 세면
// 틀린 것도 맞다고 나온다.
//
// 못박는 것.
//   - 손실 곡선의 **접선은 늘 접점을 지난다.** 좌표 변환이 값을 천장·바닥에 가두면
//     곧게 뻗는 접선의 끝점이 눌려 기울기가 통째로 달라진다
//   - 접선의 화면 기울기는 **그려진 곡선의 기울기와 같다**
//   - 캔버스는 **언제나 제 부모와 같은 크기다.** 전체 화면을 드나든 뒤에도 그렇다.
//     캔버스 높이가 스크립트가 넣는 `--sim-stage-h` 에 매여 있어, 높이를 고치는 일과
//     캔버스를 재는 일의 **차례가 어긋나면 한 박자 늦은 크기로 굳는다**
//   - 열 때마다 뽑는 자료가 **그림 칸과 학습률 슬라이더의 약속을 지킨다**
//   - 곡선 모드의 곡선들이 **그림 칸의 세로를 충분히 쓴다.** 구간을 넓게 잡으면
//     양 끝의 높은 벽이 눈금을 다 먹고 정작 봐야 할 골짜기가 납작해진다

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = process.env.DL_HTML || path.join(ROOT, 'simulator', 'ai', 'deep-learning.html');

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 20) console.log('  ✗ ' + m);
};

/* ================================================================
   DOM 흉내
   ================================================================ */

const TABS = ['tab0', 'tab1', 'tabFwd', 'tabBwd', 'tab2', 'tab3'];
const CANVAS_OF = {tab0: 'gdCanvas', tab1: 'nnCanvas', tabFwd: 'fpCanvas', tabBwd: 'bpCanvas', tab2: 'dbCanvas'};
const DPR = 2;
const STAGE_W = 1200;       // 캔버스 부모의 가로. 창 높이와 무관하다
const NAV_H = 64, STAGE_TOP = 120, PAD_BOTTOM = 16;

let innerH = 900;
const cssVars = {};
const stageHeight = () => parseFloat(cssVars['--sim-stage-h'] || '560');

/** 페이지가 스테이지 높이를 구할 때 하는 뺄셈. **검사도 같은 값을 알고 있어야 한다.** */
const wantStage = (h) => Math.max(320, h - NAV_H - STAGE_TOP - PAD_BOTTOM - 12);

class El {
    constructor(id = '', tag = 'div') {
        this.id = id;
        this.tagName = tag;
        this.children = [];
        this.parentElement = null;
        this.dataset = {};
        this.hidden = false;
        this._classes = new Set();
        this._text = '';
        this._listeners = {};
        this.style = {setProperty: (k, v) => { cssVars[k] = v; }};
        this.value = '';
        this.min = '';
        this.max = '';
        this.step = '';
        this.offsetHeight = 0;
        this._rect = {top: 0, left: 0, width: 300, height: 200};
    }

    get classList() {
        const c = this._classes;
        return {add: (x) => c.add(x), remove: (x) => c.delete(x), contains: (x) => c.has(x)};
    }

    get className() { return [...this._classes].join(' '); }
    set className(v) { this._classes = new Set(String(v).split(/\s+/).filter(Boolean)); }

    // 진짜 DOM 은 문자열로 바꾼다. 스텁이 안 바꾸면 라벨 검사가 **가짜로 실패**한다.
    get textContent() { return this._text; }
    set textContent(v) { this._text = String(v); }
    get innerText() { return this._text; }
    set innerText(v) { this._text = String(v); }
    set innerHTML(v) { if (v === '') this.children = []; this._html = String(v); }
    get innerHTML() { return this._html || ''; }

    /* 캔버스를 재는 쪽이 `clientWidth`/`clientHeight` 를 쓴다 — 테두리를 포함하는
       `getBoundingClientRect()` 와 달라야 하므로 따로 흉내 낸다. */
    get clientWidth() { return this.getBoundingClientRect().width; }
    get clientHeight() { return this.getBoundingClientRect().height; }

    appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
    addEventListener(t, f) { (this._listeners[t] ||= []).push(f); }
    getBoundingClientRect() { return this._rect; }
    getContext() { return makeCtx(this); }
    querySelectorAll(sel) { return queryAll(sel); }
    querySelector(sel) { return queryAll(sel)[0] || null; }

    get width() { return this._w || 0; }
    set width(v) { this._w = v; }
    get height() { return this._h || 0; }
    set height(v) { this._h = v; }
}

/** 그린 명령의 좌표를 적어 두는 가짜 컨텍스트. */
function makeCtx(canvas) {
    if (canvas._ctx) return canvas._ctx;
    const target = {ops: [], canvas};
    let cur = null;
    canvas._ctx = new Proxy(target, {
        get(t, k) {
            if (k in t) return t[k];
            if (k === 'measureText') return (s) => ({width: String(s).length * 8});
            if (k === 'beginPath') return () => { cur = {op: 'path', pts: []}; t.ops.push(cur); };
            if (k === 'moveTo' || k === 'lineTo') return (x, y) => { if (cur) cur.pts.push([x, y]); };
            if (k === 'rect') return (x, y, w, h) => { if (cur) cur.rect = [x, y, w, h]; };
            if (k === 'arc') return (x, y, r) => t.ops.push({op: 'arc', x, y, r});
            if (k === 'stroke') return () => { if (cur) cur.style = t._stroke; };
            /* **`fillStyle` 은 `arc()` 뒤에 정해지는 일이 많다.** 그리는 시점에 색을 적으면
               전부 엉뚱한 색으로 기록되어, 찾는 도형을 하나도 못 찾고 그냥 통과한다. */
            if (k === 'fill') return () => { const last = t.ops.at(-1); if (last) last.fill = t._fill; };
            if (typeof k === 'string') return () => {};
            return undefined;
        },
        set(t, k, v) {
            if (k === 'strokeStyle') t._stroke = v;
            if (k === 'fillStyle') t._fill = v;
            t[k] = v;
            return true;
        }
    });
    return canvas._ctx;
}

const byId = new Map();
const el = (id) => {
    if (!byId.has(id)) byId.set(id, new El(id, id.toLowerCase().includes('canvas') ? 'canvas' : 'div'));
    return byId.get(id);
};

function queryAll(sel) {
    if (sel === '.tab-content') return TABS.map(el);
    if (sel === '.tab-btn') return TABS.map((t) => el('btn-' + t));
    if (sel === '.sticky-nav') return [el('__nav')];
    if (sel === '.tab-content.active .sim-stage') {
        const t = TABS.map(el).find((e) => e._classes.has('active'));
        return t ? [el('__stage-' + t.id)] : [];
    }
    if (sel === '#gdModeBtns button[data-mode]') return el('gdModeBtns').children;
    if (sel === '#fpActBtns button[data-act]') return el('fpActBtns').children;
    return [];
}

const winListeners = {};
const docListeners = {};

const sandbox = {
    console, Math, JSON, Date, Number, String, Array, Object, isFinite, parseFloat, parseInt,
    setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame: (f) => setTimeout(f, 0),
    getComputedStyle: () => ({paddingBottom: PAD_BOTTOM + 'px'}),
    Chart: class {
        constructor() { this.data = {labels: [], datasets: [{data: []}, {data: []}]}; }
        update() {}
        resize() {}
        destroy() {}
    },
    document: {
        documentElement: new El('__root'),
        getElementById: el,
        createElement: (tag) => new El('', tag),
        querySelector: (s) => queryAll(s)[0] || null,
        querySelectorAll: (s) => queryAll(s),
        addEventListener: (t, f) => { (docListeners[t] ||= []).push(f); },
        fullscreenElement: null,
    },
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.devicePixelRatio = DPR;
sandbox.scrollY = 0;
sandbox.scrollTo = () => {};
sandbox.matchMedia = () => ({matches: true, addEventListener() {}, addListener() {}});
sandbox.addEventListener = (t, f) => { (winListeners[t] ||= []).push(f); };
sandbox.dispatchEvent = (e) => { (winListeners[e.type] || []).forEach((f) => f(e)); };
sandbox.Event = class { constructor(type) { this.type = type; } };
// 상자가 자라는 것을 지켜보는 쪽은 흉내 내지 않는다 — 이 받침대는 크기를 직접 흔든다.
sandbox.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
Object.defineProperty(sandbox, 'innerHeight', {get: () => innerH});

// 캔버스 부모 — 가로는 고정, 세로는 스테이지 높이를 따른다(실제 CSS 관계와 같다)
for (const id of [...Object.values(CANVAS_OF), 'fpActCanvas']) {
    const c = el(id);
    const parent = new El('__p-' + id);
    parent.getBoundingClientRect = () => ({top: 0, left: 0, width: STAGE_W, height: stageHeight()});
    c.parentElement = parent;
    c.getBoundingClientRect = () => ({top: 0, left: 0, width: 120, height: 80});
}
el('__nav').offsetHeight = NAV_H;
el('simulator')._rect = {top: 0, left: 0, width: STAGE_W, height: 800};
for (const t of TABS) {
    const st = el('__stage-' + t);
    st._rect = {top: STAGE_TOP, left: 0, width: STAGE_W, height: 500};
    st.parentElement = el(t);
}
el('tab0').classList.add('active');
el('gdLr').value = '0.05';
el('bpLr').value = '0.5';
el('dbNeuronSlider').value = '4';
el('dbNoiseSlider').value = '1.1';
el('ofComplexSlider').value = '5';

/* ================================================================
   페이지 원문을 돌린다
   ================================================================ */

/* **공용 라이브러리도 진짜를 얹는다.** 페이지가 `window.fitCanvas` 로 캔버스를 재므로,
   여기서 가짜를 끼우면 라이브러리가 고장 나도 검사가 통과한다. */
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'entries', '_lib', 'canvas-dpr.js'), 'utf8'),
    sandbox, {filename: 'canvas-dpr.js'});

const html = fs.readFileSync(PAGE, 'utf8');
const inline = html.match(/<script>([\s\S]*?)<\/script>/);
if (!inline) {
    console.log('  ✗ 인라인 <script> 를 찾지 못했다');
    process.exit(1);
}
/* `const` 로 선언된 것은 sandbox 의 속성이 되지 않는다. 밖에서 만질 수 있게 꺼내 둔다. */
const NAMES = ['gdSim', 'nnSim', 'fpSim', 'bpSim', 'dbSim', 'ofSim', 'relayout', 'switchTab'];
const expose = ';window.__ = {};' + NAMES.map((n) => 'try{window.__.' + n + '=' + n + ';}catch(e){}').join('');

vm.runInContext(inline[1] + expose, sandbox, {filename: 'deep-learning.inline.js'});
sandbox.onload();

const S = sandbox.__;
const gd = S.gdSim;
const gdOps = el('gdCanvas')._ctx.ops;

/* ================================================================
   1. 접선이 접점을 지나는가
   ================================================================ */

function distToLine([x, y], [x1, y1], [x2, y2]) {
    return Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) / Math.hypot(x2 - x1, y2 - y1);
}

/** 그려진 폴리라인에서 x=px 언저리의 화면 기울기를 중앙차분으로 구한다. */
function drawnSlopeAt(poly, px, half = 12) {
    const yAt = (x) => {
        for (let i = 1; i < poly.length; i++) {
            const [xa, ya] = poly[i - 1], [xb, yb] = poly[i];
            if ((x >= xa && x <= xb) || (x >= xb && x <= xa)) return ya + (yb - ya) * (x - xa) / (xb - xa);
        }
        return null;
    };
    const a = yAt(px - half), b = yAt(px + half);
    return (a === null || b === null) ? null : (b - a) / (2 * half);
}

function checkTangent() {
    let n = 0, worst = 0, worstSlope = 0, overflowed = 0;

    const sweep = (label, ws) => {
        for (const w of ws) {
            gd.w = w;
            gdOps.length = 0;
            gd.draw();
            const paths = gdOps.filter((o) => o.op === 'path');
            const tangent = paths.find((p) => p.style === '#f59e0b');
            const curve = paths.filter((p) => p.style === '#6366f1').at(-1);
            const dot = gdOps.filter((o) => o.op === 'arc' && o.fill === '#e11d48').at(-1);
            if (!tangent || !curve || !dot) {
                bad(label + ' w=' + w.toFixed(2) + ' — 접선·곡선·점 중 그려지지 않은 것이 있다');
                continue;
            }
            n++;

            const d = distToLine([dot.x, dot.y], tangent.pts[0], tangent.pts[1]);
            worst = Math.max(worst, d);
            if (d > 0.5) bad(label + ' w=' + w.toFixed(2) + ' — 접선이 접점에서 ' + d.toFixed(2) + 'px 벗어났다');

            const ts = (tangent.pts[1][1] - tangent.pts[0][1]) / (tangent.pts[1][0] - tangent.pts[0][0]);
            const cs = drawnSlopeAt(curve.pts, dot.x);
            if (cs !== null) {
                const rel = Math.abs(ts - cs) / Math.max(1, Math.abs(cs));
                worstSlope = Math.max(worstSlope, rel);
                if (rel > 0.12) {
                    bad(label + ' w=' + w.toFixed(2) + ' — 접선 기울기 ' + ts.toFixed(3) +
                        ' 가 그려진 곡선 ' + cs.toFixed(3) + ' 과 어긋난다');
                }
            }

            /* 접선이 그림 칸을 넘어갔다면 **잘라 낼 상자가 잡혀 있어야 한다.**
               가두는 대신 자르기로 한 것이 이 검사의 요점이다. */
            const clip = paths.filter((p) => p.rect).at(-1);
            const [, ry, , rh] = clip ? clip.rect : [0, -1e9, 0, 2e9];
            if (tangent.pts.some(([, y]) => y < ry - 0.01 || y > ry + rh + 0.01)) {
                overflowed++;
                if (!clip) bad(label + ' w=' + w.toFixed(2) + ' — 접선이 그림 칸을 넘는데 clip 상자가 없다');
            }
        }
    };

    gd.mode = 'data';
    gd.phase = 3;
    sweep('자료', Array.from({length: 60}, (_, i) => gd.bestW() - 3 + i * 0.1));
    for (const key of Object.keys(gd.CURVES)) {
        gd.mode = 'curve';
        gd.curveKey = key;
        gd.phase = 0;
        const [lo, hi] = gd.CURVES[key].range;
        sweep('곡선:' + key, Array.from({length: 60}, (_, i) => lo + (hi - lo) * i / 59));
    }
    console.log('  접선 ' + n + '건 — 접점 최대 이탈 ' + worst.toFixed(4) + 'px, ' +
        '그려진 곡선과 기울기 차이 최대 ' + (worstSlope * 100).toFixed(1) + '%, ' +
        '칸을 넘어 잘린 접선 ' + overflowed + '건');

    // **잘릴 일이 한 번도 없으면 이 검사는 아무것도 지키지 않는다.**
    if (overflowed === 0) bad('접선이 그림 칸을 넘는 자리가 하나도 없다 — 검사가 헛돌고 있다');
}

/* ================================================================
   2. 캔버스가 언제나 제 부모와 같은 크기인가
   ================================================================ */

function fireFullscreenChange() {
    /* 실제 차례 — 공통 모듈(`_lib/fullscreen.js`)이 먼저 등록되어 resize 를 쏘고,
       그 뒤에 페이지의 핸들러가 돈다. */
    sandbox.dispatchEvent(new sandbox.Event('resize'));
    (docListeners['fullscreenchange'] || []).forEach((f) => f({}));
}

function checkCanvasSize() {
    let n = 0;
    const look = (label, tab) => {
        n++;
        const want = stageHeight() * DPR;
        const got = el(CANVAS_OF[tab]).height;
        if (got !== want) bad(label + ' — 캔버스 높이 ' + got + ', 부모 ' + want);
    };

    for (const tab of Object.keys(CANVAS_OF)) {
        S.switchTab(TABS.indexOf(tab));

        innerH = 900;
        sandbox.dispatchEvent(new sandbox.Event('resize'));
        if (stageHeight() !== wantStage(900)) {
            bad(tab + ' — 스테이지 높이가 ' + stageHeight() + ', 기대값 ' + wantStage(900));
        }
        look(tab + ' 평상시', tab);

        sandbox.document.fullscreenElement = el(tab);
        innerH = 1080;
        fireFullscreenChange();
        look(tab + ' 전체 화면 안', tab);

        /* 전체 화면 해제. **이 순간 `innerHeight` 는 아직 전체 화면 값이다** — 크롬이
           창 크기를 되돌리기 전에 `fullscreenchange` 를 보내는 일이 있다.
           진짜 resize 는 조금 뒤에 옛 창 크기로 온다. */
        sandbox.document.fullscreenElement = null;
        fireFullscreenChange();
        innerH = 900;
        sandbox.dispatchEvent(new sandbox.Event('resize'));
        look(tab + ' 전체 화면 해제 뒤', tab);

        innerH = 700;
        sandbox.dispatchEvent(new sandbox.Event('resize'));
        look(tab + ' 창 줄이기', tab);
    }
    S.switchTab(0);
    console.log('  캔버스 크기 ' + n + '건 — 탭 ' + Object.keys(CANVAS_OF).length + '개 × 상황 4가지');
}

/* ================================================================
   3. 열 때마다 뽑는 자료
   ================================================================ */

function checkPoints(rounds = 20000) {
    const LR_MAX = 0.3;                 // 자료 모드의 학습률 슬라이더 끝
    let lo = Infinity, hi = -Infinity, limLo = Infinity, limHi = -Infinity, gapMin = Infinity;
    const seen = new Set();
    gd.mode = 'data';

    if (typeof gd.newPoints !== 'function') {
        bad('자료를 새로 뽑는 newPoints() 가 없다 — 열 때마다 같은 점이 찍힌다');
        return;
    }

    for (let i = 0; i < rounds; i++) {
        gd.newPoints();
        const p = gd.points;
        seen.add(JSON.stringify(p));
        if (p.length !== 3) { bad('자료가 ' + p.length + '개다'); break; }
        for (const [x, y] of p) {
            if (x <= 0 || x > 4.4) bad('x=' + x + ' 가 그림 칸(0~4.4) 밖이다');
            if (y <= 0 || y > 6.4) bad('y=' + y + ' 가 그림 칸(0~6.4) 밖이다');
            // 소수 한 자리 — 식에 긴 숫자가 늘어지면 읽을 수 없다
            if (Math.abs(x * 10 - Math.round(x * 10)) > 1e-9) bad('x=' + x + ' 가 소수 한 자리가 아니다');
            if (Math.abs(y * 10 - Math.round(y * 10)) > 1e-9) bad('y=' + y + ' 가 소수 한 자리가 아니다');
            lo = Math.min(lo, y);
            hi = Math.max(hi, y);
        }
        for (let k = 1; k < p.length; k++) gapMin = Math.min(gapMin, p[k][0] - p[k - 1][0]);

        /* **화면이 약속한 발산을 학생이 만들어 볼 수 있어야 한다.** 경계가 슬라이더 끝보다
           크면 안내문이 「0.36보다 크면 튕겨 나갑니다」라고 적어 놓고도 그 값을 고를 수가 없다. */
        const lim = gd.lrLimit();
        limLo = Math.min(limLo, lim);
        limHi = Math.max(limHi, lim);
        if (!(lim > 0.01 && lim < LR_MAX)) {
            bad('튕겨 나가는 경계 ' + lim.toFixed(3) + ' 가 학습률 슬라이더(0.005~' + LR_MAX + ') 밖이다');
        }
    }
    if (gapMin < 0.3) bad('가장 가까운 두 점의 x 간격이 ' + gapMin.toFixed(2) + ' — 점이 겹쳐 보인다');
    if (seen.size < rounds * 0.9) bad(rounds + '판 중 서로 다른 자료가 ' + seen.size + '가지뿐이다');
    console.log('  자료 ' + rounds + '판 — y ' + lo.toFixed(1) + '~' + hi.toFixed(1) +
        ', 발산 경계 ' + limLo.toFixed(3) + '~' + limHi.toFixed(3) +
        ', x 최소 간격 ' + gapMin.toFixed(2) + ', 서로 다른 자료 ' + seen.size + '가지');
}

/* ================================================================
   4. 곡선이 그림 칸의 세로를 얼마나 쓰는가
   ================================================================ */

function checkCurveHeight() {
    for (const key of Object.keys(gd.CURVES)) {
        gd.mode = 'curve';
        gd.curveKey = key;
        gd.reset();
        gdOps.length = 0;
        gd.draw();
        const paths = gdOps.filter((o) => o.op === 'path');
        const curve = paths.filter((p) => p.style === '#6366f1').at(-1);
        const axis = paths.filter((p) => p.style === '#cbd5e1').at(-1);
        if (!curve || !axis) { bad(key + ' — 곡선이나 축이 그려지지 않았다'); continue; }

        const H = Math.max(...axis.pts.map((p) => p[1])) - Math.min(...axis.pts.map((p) => p[1]));
        const ys = curve.pts.map((p) => p[1]);
        const bot = Math.max(...ys), top = Math.min(...ys);
        /* 화면 좌표는 위아래가 뒤집혀 있다 — y 가 클수록 아래(값이 낮다).
           그러니 언덕 꼭대기는 화면 y 의 국소 **최소**다. */
        let hill = null;
        for (let i = 1; i < ys.length - 1; i++) {
            if (ys[i] < ys[i - 1] && ys[i] < ys[i + 1]) hill = hill === null ? ys[i] : Math.min(hill, ys[i]);
        }
        const use = (bot - top) / H;
        const relief = hill === null ? null : (bot - hill) / H;
        if (use < 0.7) bad(key + ' — 곡선이 그림 칸 세로의 ' + (use * 100).toFixed(0) + '% 밖에 쓰지 않는다');
        if (relief !== null && relief < 0.4) {
            bad(key + ' — 골짜기와 언덕의 높이차가 ' + (relief * 100).toFixed(0) +
                '% 뿐이다. 구간(range)을 좁혀야 한다');
        }
        console.log('  곡선 ' + key + ' — 세로 점유 ' + (use * 100).toFixed(0) + '%, 골짜기↔언덕 ' +
            (relief === null ? '(언덕 없음)' : (relief * 100).toFixed(0) + '%'));
    }

    // 선택지가 줄면 학생이 볼 지형이 줄어든다. 셋은 지킨다.
    if (Object.keys(gd.CURVES).length < 3) bad('곡선 선택지가 셋보다 적다');
}

/* ================================================================ */
console.log('딥러닝 시뮬레이터를 페이지 원문 그대로 돌린다');
checkTangent();
checkCanvasSize();
checkPoints();
checkCurveHeight();
console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
