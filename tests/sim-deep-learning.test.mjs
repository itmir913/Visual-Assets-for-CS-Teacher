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
//   - 경사 하강의 오차 함수 · 기울기 · 최저점 · 튕겨 나가는 경계를 **따로 짠 평균 제곱 오차 ·
//     중앙 차분 · 삼분 탐색 · 이계 차분**으로, 한 걸음의 새 w 를 옛 w − 학습률 × 기울기로 대조한다
//   - 순전파 · 갱신 탭의 신경망(파라미터 9개)을 **따로 짠 순전파와 중앙 차분 기울기**로 대조하고,
//     화면의 식 숫자 · 에포크 순서 · 계단 / 활성화 없음 / XOR 에 대한 설명 띠의 주장을 돌려서 확인한다
//   - 신경망 구조 탭의 노드 · 연결선 수, 결정 경계의 교차 엔트로피 기울기와 칠한 칸의 색,
//     과적합 그래프가 화면이 말하는 모양인지

import {test, expect} from 'vitest';
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
            // 결정 경계는 칸마다 fillRect 로 칠한다 — 그 칸의 색을 모형 출력과 대조하려고 적어 둔다.
            // 다른 캔버스는 적지 않는다(fill() 이 마지막 명령에 색을 다는 흉내가 흐트러진다).
            if (k === 'fillRect' && canvas.id === 'dbCanvas') {
                return (x, y, w, h) => t.ops.push({op: 'fillRect', x, y, w, h, fill: t._fill});
            }
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
    throw new Error('deep-learning: 검사를 더 진행할 수 없다');
}
/* `const` 로 선언된 것은 sandbox 의 속성이 되지 않는다. 밖에서 만질 수 있게 꺼내 둔다. */
const NAMES = ['gdSim', 'nnSim', 'fpSim', 'bpSim', 'dbSim', 'ofSim', 'relayout', 'switchTab',
    'netSim', 'NET_ACT', 'NET_DATA', 'TinyMLP', 'changeLayer', 'changeNeuron', 'changeInputNodes'];
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

/* ================================================================
   공용 — 씨앗을 고정한 난수, 중앙 차분, 화면 숫자 표기
   ================================================================ */

function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
/** 페이지도 같은 `Math` 를 쓴다(받침대가 바깥 것을 그대로 넘겼다). 잠깐 갈아 끼우고 되돌린다. */
function withSeed(seed, fn) {
    const orig = Math.random;
    Math.random = mulberry32(seed);
    try { return fn(); } finally { Math.random = orig; }
}
const cdiff = (f, x, h = 1e-6) => (f(x + h) - f(x - h)) / (2 * h);
const near = (a, b, tol) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
// 화면 숫자 — 빼기 기호와 자릿수까지 페이지가 쓰는 꼴로 적는다
const fmt = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const linesOf = (id) => el(id).children.map((c) => c.innerHTML);
const click = (id) => (el(id)._listeners.click || []).forEach((f) => f({target: el(id)}));

/* ================================================================
   5. 경사 하강 — 오차 함수 · 기울기 · 한 걸음 · 튕겨 나가는 경계
   ================================================================ */

function checkGdMath() {
    const lrEl = el('gdLr');
    const keepLr = lrEl.value;
    gd.mode = 'data';
    for (let s = 0; s < 60; s++) {
        withSeed(1000 + s, () => gd.newPoints());
        const pts = gd.points.map((p) => p.slice());
        // 따로 짠 오차 함수 — 평균((실젯값 − w×x)²)
        const L = (w) => pts.reduce((a, [x, y]) => a + (y - w * x) ** 2, 0) / pts.length;
        for (const w of [-2, 0, 0.7, 1.9, 3.3]) {
            if (!near(gd.loss(w), L(w), 1e-12)) { bad(`오차 함수 L(${w}) = ${gd.loss(w)} — 따로 구한 값 ${L(w)}`); return; }
            if (!near(gd.grad(w), cdiff(L, w), 1e-6)) { bad(`기울기(${w}) = ${gd.grad(w)} — 중앙 차분 ${cdiff(L, w)}`); return; }
        }
        // 가장 낮은 w — 삼분 탐색으로 따로 찾는다
        let lo = -20, hi = 20;
        for (let k = 0; k < 200; k++) {
            const a = lo + (hi - lo) / 3, b = hi - (hi - lo) / 3;
            if (L(a) < L(b)) hi = b; else lo = a;
        }
        if (Math.abs(gd.bestW() - (lo + hi) / 2) > 1e-6) bad(`가장 낮아지는 w ${gd.bestW()} — 삼분 탐색 ${(lo + hi) / 2}`);
        // 튕겨 나가는 경계 = 2 ÷ L'' — 이계 차분으로 구한다
        const L2 = (L(1 + 1e-3) - 2 * L(1) + L(1 - 1e-3)) / 1e-6;
        if (!near(gd.lrLimit(), 2 / L2, 1e-5)) bad(`튕겨 나가는 경계 ${gd.lrLimit()} — 2 ÷ L'' 는 ${2 / L2}`);

        // 페이지의 걸음으로 경계 양쪽을 걸어 본다 — 아래는 가까워지고 위는 멀어진다
        const best = gd.bestW(), lim = gd.lrLimit();
        for (const [k, 좁아짐] of [[0.97, true], [1.03, false]]) {
            lrEl.value = String(lim * k);
            gd.reset();
            const d0 = Math.abs(gd.w - best);
            for (let i = 0; i < 60; i++) gd.applyMove();
            const d1 = Math.abs(gd.w - best);
            if ((d1 < d0) !== 좁아짐) {
                bad(`학습률 = 경계×${k}: 60걸음 뒤 최저점과의 거리 ${d0.toFixed(3)} → ${d1.toFixed(3)} — ${좁아짐 ? '줄어야' : '늘어야'} 한다`);
            }
        }
    }

    // 한 걸음 표 — 새 w = 옛 w − 학습률 × (중앙 차분 기울기)
    withSeed(77, () => gd.newPoints());
    const pts = gd.points.map((p) => p.slice());
    const L = (w) => pts.reduce((a, [x, y]) => a + (y - w * x) ** 2, 0) / pts.length;
    lrEl.value = '0.05';
    gd.reset();
    const w0 = gd.w;
    for (let i = 0; i < 3; i++) gd.advance();          // 0 → 3단계, 아직 움직이지 않는다
    gd.renderAll();
    if (gd.w !== w0 || gd.steps !== 0) bad('3단계(기울기)까지 왔는데 w 가 벌써 움직였다');
    const f3 = linesOf('gdFormulaBody').join('\n');
    if (!f3.includes(fmt(cdiff(L, w0), 4))) bad(`기울기 단계의 식에 기울기 ${fmt(cdiff(L, w0), 4)} 가 없다`);
    const 방향 = cdiff(L, w0) > 0 ? '줄인다' : '키운다';
    if (!f3.includes(방향)) bad(`기울기 ${cdiff(L, w0).toFixed(3)} 인데 식이 「${방향}」고 말하지 않는다`);
    gd.advance();                                       // 4단계 — 여기서 움직인다
    const want = w0 - 0.05 * cdiff(L, w0);
    if (!near(gd.w, want, 1e-7)) bad(`한 걸음: w ${w0.toFixed(4)} → ${gd.w} — 옛 w − 학습률×기울기 는 ${want}`);
    if (!near(gd.moved, want - w0, 1e-7)) bad(`이동량 ${gd.moved} — ${want - w0} 여야 한다`);
    if (gd.steps !== 1 || !near(gd.prevLoss, L(w0), 1e-12)) bad(`한 걸음 뒤 걸음 수 ${gd.steps} · 옮기기 전 손실 ${gd.prevLoss}`);
    gd.renderAll();
    const f4 = linesOf('gdFormulaBody').join('\n');
    if (!f4.includes(fmt(want, 3))) bad(`이동 단계의 식에 새 w ${fmt(want, 3)} 가 없다`);
    gd.advance();                                       // 5단계 — 확인
    gd.renderAll();
    const f5 = linesOf('gdFormulaBody').join('\n');
    if (!f5.includes(L(want) < L(w0) ? '줄었다' : '늘었다')) bad('확인 단계가 손실이 준 쪽을 거꾸로 말한다');

    // 경계를 넘긴 한 걸음 — 손실이 늘고 화면이 그렇다고 말한다. 경계 아래(절반보다 위)는 건너뛰어도 준다.
    const lim = gd.lrLimit();
    for (const [k, 늘어남] of [[1.2, true], [0.8, false]]) {
        lrEl.value = String(lim * k);
        gd.reset();
        const before = gd.loss(gd.w);
        for (let i = 0; i < 5; i++) gd.advance();
        gd.renderAll();
        const after = gd.loss(gd.w);
        if ((after > before) !== 늘어남) bad(`학습률 = 경계×${k}: 손실 ${before.toFixed(3)} → ${after.toFixed(3)}`);
        const 말 = el('gdStepDesc').textContent.includes('오히려 늘었습니다');
        if (말 !== 늘어남) bad(`학습률 = 경계×${k}: 「오히려 늘었습니다」를 ${말 ? '말했다' : '말하지 않았다'}`);
    }

    // 발산 — 슬라이더 끝(0.3)은 경계보다 크다. 걷다 보면 튕겨 나갔다고 말해야 한다.
    lrEl.value = '0.3';
    gd.reset();
    for (let i = 0; i < 200 && !gd.blown; i++) gd.applyMove();
    gd.renderAll();
    if (!gd.blown) bad('학습률 0.3(경계보다 큼)으로 200걸음을 걸었는데 튕겨 나가지 않았다');
    if (!el('gdStepDesc').textContent.includes('발산')) bad('튕겨 나갔는데 설명 띠가 발산을 말하지 않는다');

    // 곡선 모드 — 도함수 · 가장 낮은 값 · 골짜기에 갇히는지
    gd.mode = 'curve';
    for (const [key, c] of Object.entries(gd.CURVES)) {
        const [a, b] = c.range;
        let bw = a, bl = Infinity;
        for (let i = 0; i <= 60000; i++) {
            const w = a + (b - a) * i / 60000;
            if (i % 600 === 0 && !near(c.df(w), cdiff(c.f, w), 1e-6)) { bad(`곡선 ${key}: f'(${w.toFixed(2)}) = ${c.df(w)} — 중앙 차분 ${cdiff(c.f, w)}`); break; }
            if (c.f(w) < bl) { bl = c.f(w); bw = w; }
        }
        if (Math.abs(bl - c.min) > 0.01) bad(`곡선 ${key}: 가장 낮은 값이 ${bl.toFixed(3)} 인데 min 은 ${c.min}`);
        gd.curveKey = key;
        if (Math.abs(gd.bestW() - bw) > 0.006) bad(`곡선 ${key}: 가장 낮아지는 w ${gd.bestW()} — 촘촘히 찾은 값 ${bw}`);
        if (c.lrLimit !== undefined) {
            const f2 = (c.f(1 + 1e-3) - 2 * c.f(1) + c.f(1 - 1e-3)) / 1e-6;
            if (!near(c.lrLimit, 2 / f2, 1e-5)) bad(`곡선 ${key}: 경계 ${c.lrLimit} — 2 ÷ f'' 는 ${2 / f2}`);
        }
    }
    // 오른쪽에서 출발한 hole 은 얕은 골짜기(w≈1.93)에 멈추고, 화면이 그렇다고 말한다
    lrEl.value = '0.05';
    gd.curveKey = 'hole';
    gd.reset();
    for (let i = 0; i < 400; i++) gd.applyMove();
    gd.phase = gd.maxPhase();
    gd.renderAll();
    const c = gd.CURVES.hole;
    if (!(Math.abs(c.df(gd.w)) < 0.01 && gd.w > 1)) bad(`hole: 400걸음 뒤 w=${gd.w.toFixed(3)} — 오른쪽 골짜기에서 멈춰야 한다`);
    if (!el('gdStepDesc').textContent.includes('얕은 골짜기')) bad('hole: 얕은 골짜기에 멈췄는데 설명 띠가 그렇게 말하지 않는다');
    gd.curveKey = 'bowl';
    gd.reset();
    for (let i = 0; i < 400; i++) gd.applyMove();
    gd.phase = gd.maxPhase();
    gd.renderAll();
    if (!el('gdStepDesc').textContent.includes('더 내려갈 데가 없어')) bad('bowl: 가장 낮은 곳에 멈췄는데 설명 띠가 그렇게 말하지 않는다');

    gd.mode = 'data';
    gd.curveKey = 'hole';
    lrEl.value = keepLr;
    gd.reset();
    console.log('  경사 하강 — 자료 60판의 오차 함수 · 기울기 · 최저점 · 경계, 한 걸음 표, 곡선 셋');
}

/* ================================================================
   6. 순전파 · 역전파 — 따로 짠 순전파와 중앙 차분 기울기로 대조
   ================================================================ */

const ACT = {
    sigmoid: (z) => 1 / (1 + Math.exp(-z)),
    relu: (z) => Math.max(0, z),
    step: (z) => (z >= 0 ? 1 : 0),
    none: (z) => z,
};
// 파라미터 9개를 한 줄로 — [w11 w21 b1 w12 w22 b2 u1 u2 b3]
const flat = (n) => [n.w1[0][0], n.w1[1][0], n.b1[0], n.w1[0][1], n.w1[1][1], n.b1[1], n.w2[0], n.w2[1], n.b2];
function myForward(p, x, act) {
    const f = ACT[act];
    const z1 = [x[0] * p[0] + x[1] * p[1] + p[2], x[0] * p[3] + x[1] * p[4] + p[5]];
    const a1 = z1.map(f);
    const z2 = a1[0] * p[6] + a1[1] * p[7] + p[8];
    return {z1, a1, z2, a2: ACT.sigmoid(z2)};
}
const myLoss = (p, x, y, act) => (myForward(p, x, act).a2 - y) ** 2;
function numGrad(p, x, y, act) {
    return p.map((_, k) => cdiff((v) => { const q = p.slice(); q[k] = v; return myLoss(q, x, y, act); }, p[k]));
}

function checkNet() {
    const net = S.netSim;
    const keep = {act: net.act, dsKey: net.dsKey};
    let n = 0;
    for (const act of ['sigmoid', 'relu', 'step', 'none']) {
        for (const ds of ['and', 'xor', 'cat']) {
            for (let s = 0; s < 8; s++) {
                net.act = act; net.dsKey = ds; net.sampleIdx = 0;
                withSeed(3000 + s, () => net.newWeights());
                for (let i = 0; i < net.rows().length; i++) {
                    net.sampleIdx = i;
                    net.recompute();
                    const [x, y] = net.sample();
                    const p = flat(net.net);
                    const my = myForward(p, x, act);
                    const fw = net.fw;
                    if (![0, 1].every((j) => near(fw.z1[j], my.z1[j], 1e-12) && near(fw.a1[j], my.a1[j], 1e-12)) ||
                        !near(fw.z2, my.z2, 1e-12) || !near(fw.a2, my.a2, 1e-12)) {
                        bad(`순전파(${act}·${ds}·${i}): z·a 가 따로 구한 값과 다르다`); return;
                    }
                    if (!near(net.loss(fw.a2, y), myLoss(p, x, y, act), 1e-12)) { bad(`손실(${act}·${ds}·${i})이 (예측−정답)² 이 아니다`); return; }
                    // 꺾이는 곳 바로 옆은 중앙 차분이 양쪽에 걸친다 — 비켜 간다
                    if ((act === 'relu' || act === 'step') && my.z1.some((z) => Math.abs(z) < 1e-4)) continue;
                    const g = net.grad;
                    const got = [g.dw1[0][0], g.dw1[1][0], g.db1[0], g.dw1[0][1], g.dw1[1][1], g.db1[1], g.dw2[0], g.dw2[1], g.db2];
                    const want = numGrad(p, x, y, act);
                    const k = got.findIndex((v, k2) => Math.abs(v - want[k2]) > 1e-6);
                    if (k >= 0) { bad(`역전파(${act}·${ds}·${i}): ${k}번째 파라미터 기울기 ${got[k]} — 중앙 차분 ${want[k]}`); return; }
                    // 한 걸음 — 새 값 = 옛 값 − 학습률 × 기울기
                    const lr = 0.7;
                    net.applyUpdate(lr);
                    const after = flat(net.net);
                    const k3 = after.findIndex((v, k2) => Math.abs(v - (p[k2] - lr * want[k2])) > 1e-6);
                    if (k3 >= 0) { bad(`갱신(${act}·${ds}·${i}): ${k3}번째 파라미터 ${after[k3]} — 옛 값 − 학습률×기울기 는 ${p[k3] - lr * want[k3]}`); return; }
                    n++;
                }
            }
        }
    }
    // 활성화 함수 정의 — 페이지 표와 교과서 정의
    const A = S.NET_ACT;
    for (const z of [-3, -0.5, 0.4, 2.5]) {
        for (const key of Object.keys(ACT)) {
            if (!near(A[key].f(z), ACT[key](z), 1e-12)) bad(`${A[key].label}(${z}) = ${A[key].f(z)} — 정의대로면 ${ACT[key](z)}`);
            if (!near(A[key].df(z, A[key].f(z)), cdiff(ACT[key], z), 1e-6)) bad(`${A[key].label} 의 기울기(${z}) 가 중앙 차분과 다르다`);
        }
    }
    // 데이터 — AND 와 XOR 의 정답 표
    const truth = {and: (a, b) => a & b, xor: (a, b) => a ^ b};
    for (const [k, f] of Object.entries(truth)) {
        for (const [[a, b], y] of S.NET_DATA[k].rows) if (f(a, b) !== y) bad(`${k} 표: (${a}, ${b}) 의 정답이 ${y} 다`);
    }
    net.act = keep.act; net.dsKey = keep.dsKey; net.sampleIdx = 0;
    net.newWeights();
    console.log('  순전파 · 역전파 · 한 걸음 — ' + n + '건(활성화 넷 × 자료 셋 × 초기값 여덟)');
}

/* ================================================================
   7. 순전파 탭의 식 · 갱신 탭의 식 · 에포크 · 화면의 주장
   ================================================================ */

function checkNetTabs() {
    const net = S.netSim, fp = S.fpSim, bp = S.bpSim;
    net.act = 'sigmoid'; net.dsKey = 'cat'; net.sampleIdx = 2;
    withSeed(41, () => net.newWeights());
    bp.onNetReset();
    const [x, y] = net.sample();
    const my = myForward(flat(net.net), x, 'sigmoid');

    // 순전파 탭 — 2단계의 z 둘, 3단계의 a 둘, 6단계의 예측
    fp.phase = 2; fp.renderAll();
    const f2 = linesOf('fpFormulaBody').join('\n');
    for (const z of my.z1) if (!f2.includes('text-white">' + fmt(z) + '<')) bad(`순전파 2단계 식에 z ${fmt(z)} 가 없다`);
    fp.phase = 3; fp.renderAll();
    const f3 = linesOf('fpFormulaBody').join('\n');
    for (const a of my.a1) if (!f3.includes('text-white">' + fmt(a, 3) + '<')) bad(`순전파 3단계 식에 a ${fmt(a, 3)} 가 없다`);
    fp.phase = 6; fp.renderAll();
    const f6 = linesOf('fpFormulaBody').join('\n');
    if (!f6.includes('text-white">' + fmt(my.a2, 3) + '<')) bad(`순전파 6단계에 예측 ${fmt(my.a2, 3)} 가 없다`);
    if (!el('fpStepDesc').textContent.includes('예측 ' + fmt(my.a2, 3) + ' / 정답 ' + y)) bad('순전파 6단계 설명 띠의 예측 · 정답이 다르다');
    fp.phase = 0; fp.renderAll();

    // 갱신 탭 — 버튼으로 한 단계씩. 0단계 손실, 1단계 출력 몫, 4단계에서 고친다.
    const want = numGrad(flat(net.net), x, y, 'sigmoid');
    const dz2 = 2 * (my.a2 - y) * my.a2 * (1 - my.a2);
    bp.renderAll();
    if (!linesOf('bpFormulaBody').join('\n').includes(fmt((my.a2 - y) ** 2, 4))) bad('갱신 0단계 손실이 (예측−정답)² 이 아니다');
    click('bpBtnNext');
    const b1 = linesOf('bpFormulaBody').join('\n');
    if (!b1.includes('text-white">' + fmt(dz2, 4) + '<')) bad(`갱신 1단계 출력 몫이 ${fmt(dz2, 4)} 가 아니다`);
    if (!b1.includes(fmt(want[6], 4))) bad(`갱신 1단계 u₁ 기울기가 중앙 차분 ${fmt(want[6], 4)} 와 다르다`);
    click('bpBtnNext'); click('bpBtnNext');
    const b3 = linesOf('bpFormulaBody').join('\n');
    if (!b3.includes(fmt(want[0], 4)) || !b3.includes(fmt(want[3], 4))) bad('갱신 3단계 w₁₁ · w₁₂ 기울기가 중앙 차분과 다르다');
    if (net.steps !== 0) bad('3단계까지 왔는데 벌써 고쳤다');
    const before = flat(net.net);
    click('bpBtnNext');
    if (net.steps !== 1) bad('4단계로 넘어갔는데 고치지 않았다');
    const after = flat(net.net);
    const names = ['w₁₁', 'w₂₁', 'b₁', 'w₁₂', 'w₂₂', 'b₂', 'u₁', 'u₂', 'b₃'];
    const top2 = names.map((nm, k) => [nm, Math.abs(after[k] - before[k])]).sort((p, q) => q[1] - p[1]).slice(0, 2).map((e) => e[0]);
    const b4 = linesOf('bpFormulaBody');
    for (const nm of top2) if (!b4.some((l) => l.includes('>' + nm + '<'))) bad(`갱신 4단계가 가장 많이 바뀐 ${nm} 을 보이지 않는다`);
    const 단계4산수 = (lines, 뜻) => {
        for (const l of lines.slice(1, 3)) {
            const m = l.replace(/<[^>]+>/g, '').replace(/−/g, '-').match(/= (-?[\d.]+) - ([\d.]+)×\(?(-?[\d.]+)\)? = (-?[\d.]+)/);
            if (!m) { bad(`갱신 4단계${뜻} 줄을 읽지 못했다: ` + l); continue; }
            const [, was, lr, g, now] = m.map(Number);
            if (Math.abs(was - lr * g - now) > 2e-3) bad(`갱신 4단계${뜻}: ${was} − ${lr}×${g} 가 ${now} 가 아니다`);
        }
    };
    단계4산수(b4, '');
    // 고친 뒤 학습률 조절기를 움직여도 식은 이번 갱신에 쓴 학습률을 보여야 산수가 맞는다
    {
        const lrEl = el('bpLr'), 쓴것 = lrEl.value;
        lrEl.value = '2.5';
        (lrEl._listeners.input || []).forEach((f) => f({target: lrEl}));
        bp.renderAll();
        단계4산수(linesOf('bpFormulaBody'), '(갱신 뒤 학습률을 바꿈)');
        lrEl.value = 쓴것;
        (lrEl._listeners.input || []).forEach((f) => f({target: lrEl}));
    }

    // 에포크 — 이미 고친 데이터를 한 에포크 안에서 연달아 다시 고치지 않는다
    const log = [];
    const orig = net.applyUpdate;
    net.applyUpdate = function (lr) { log.push(this.sampleIdx); return orig.call(this, lr); };
    click('bpBtnEpoch');
    click('bpBtnNext'); click('bpBtnSample');
    click('bpBtnEpoch'); click('bpBtnEpoch');
    net.applyUpdate = orig;
    const seq = [2, ...log];                      // 4단계에서 고친 데이터 2 가 맨 앞이다
    const rows = net.rows().length;
    for (let i = 1; i < seq.length; i++) {
        if (seq[i] !== (seq[i - 1] + 1) % rows) { bad(`에포크: 고친 데이터 순서 ${seq.join(',')} — 차례대로 한 번씩 돌아야 한다`); break; }
    }
    if (net.steps !== 1 + log.length) bad(`갱신 횟수 ${net.steps} — 실제로 고친 것은 ${1 + log.length}번`);
    if (net.epoch !== Math.floor(net.steps / rows)) bad(`에포크 ${net.epoch} — 갱신 ${net.steps}번이면 ${Math.floor(net.steps / rows)}`);
    if (el('bpEpoch').textContent !== String(net.epoch)) bad('화면의 에포크가 실제와 다르다');
    if (el('bpAcc').textContent !== net.correctCount() + ' / ' + rows) bad('화면의 맞힌 수가 실제와 다르다');

    // 화면의 주장 — 계단이면 은닉층 쪽 여섯은 그대로, 활성화 없음이면 XOR 손실이 0.25 아래로 가지 않는다
    const lrEl = el('bpLr'), keepLr = lrEl.value;
    net.act = 'step'; net.dsKey = 'xor'; net.sampleIdx = 0;
    withSeed(5, () => net.newWeights());
    bp.onNetReset();
    const s0 = flat(net.net);
    for (let e = 0; e < 200; e++) bp.runEpoch();
    const s1 = flat(net.net);
    if (s0.slice(0, 6).some((v, k) => v !== s1[k])) bad('계단: 은닉층으로 들어가는 파라미터가 바뀌었다 — 화면은 한 번도 안 바뀐다고 말한다');
    if (s0.slice(6).every((v, k) => v === s1[6 + k])) bad('계단: 출력 뉴런의 세 개도 바뀌지 않았다 — 화면은 이 셋만 배운다고 말한다');
    bp.renderAll();
    if (!el('bpStepDesc').textContent.includes('계단 함수는 어디서나 기울기가 0')) bad('계단을 골랐는데 설명 띠가 그 까닭을 말하지 않는다');

    let 가장낮음 = Infinity, 풂 = 0;
    for (const lr of ['0.5', '3']) {
        lrEl.value = lr;
        for (let s = 0; s < 6; s++) {
            net.act = 'none'; net.dsKey = 'xor'; net.sampleIdx = 0;
            withSeed(600 + s, () => net.newWeights());
            bp.onNetReset();
            for (let e = 0; e < 1500; e++) bp.runEpoch();
            가장낮음 = Math.min(가장낮음, net.meanLoss());
            if (net.correctCount() === 4) 풂++;
        }
    }
    if (가장낮음 < 0.24) bad(`활성화 없음 · XOR: 평균 손실이 ${가장낮음.toFixed(4)} 까지 내려갔다 — 화면은 0.25 근처에서 멈춘다고 말한다`);
    if (풂) bad(`활성화 없음 · XOR: ${풂}판이 넷 다 맞혔다 — 직선 하나로는 나눌 수 없다`);
    bp.renderAll();
    if (!el('bpStepDesc').textContent.includes('직선 하나로 나눌 수 없')) bad('활성화 없음 · XOR 인데 설명 띠가 그 까닭을 말하지 않는다');

    // 반대편 — 꺾이는 활성화 함수는 XOR 를 풀 수 있고, 활성화 없음도 AND(직선 하나로 나뉜다)는 푼다
    const 푸는가 = (act, ds) => {
        for (let s = 0; s < 12; s++) {
            lrEl.value = ['0.5', '1', '3'][s % 3];
            net.act = act; net.dsKey = ds; net.sampleIdx = 0;
            withSeed(900 + s, () => net.newWeights());
            bp.onNetReset();
            for (let e = 0; e < bp.AUTO_MAX_EPOCH && !net.solved(); e++) bp.runEpoch();
            if (net.solved()) return true;
        }
        return false;
    };
    if (!푸는가('sigmoid', 'xor')) bad('시그모이드 · XOR: 열두 판 모두 풀지 못했다 — 은닉층이 있으면 풀 수 있어야 한다');
    if (!푸는가('relu', 'xor')) bad('ReLU · XOR: 열두 판 모두 풀지 못했다');
    if (!푸는가('none', 'and')) bad('활성화 없음 · AND: 열두 판 모두 풀지 못했다 — 직선 하나로 나뉘는 문제다');

    lrEl.value = keepLr;
    net.act = 'sigmoid'; net.dsKey = 'and'; net.sampleIdx = 0;
    net.newWeights();
    bp.onNetReset();
    fp.phase = 0; fp.renderAll();
    console.log('  순전파 · 갱신 탭의 식, 에포크 순서, 계단 · 활성화 없음 · XOR 의 주장');
}

/* ================================================================
   8. 신경망 구조 — 층 · 뉴런 수를 바꾸면 노드와 연결선이 그만큼인가
   ================================================================ */

function checkStructure() {
    const ops = el('nnCanvas')._ctx.ops;
    let L = 2, N = 4, I = 2;                       // 페이지가 처음 여는 값
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const moves = [['changeLayer', 1], ['changeNeuron', -1], ['changeInputNodes', 3], ['changeLayer', 10],
        ['changeNeuron', 10], ['changeInputNodes', -10], ['changeLayer', -10], ['changeNeuron', -10], ['changeInputNodes', 10]];
    for (const [fn, d] of moves) {
        ops.length = 0;
        S[fn](d);
        if (fn === 'changeLayer') L = clamp(L + d, 1, 5);
        if (fn === 'changeNeuron') N = clamp(N + d, 2, 8);
        if (fn === 'changeInputNodes') I = clamp(I + d, 2, 8);
        const sizes = [I, ...Array(L).fill(N), 1];
        const edges = sizes.slice(1).reduce((a, s, k) => a + s * sizes[k], 0);
        const got = ops.filter((o) => o.op === 'path' && o.style === 'rgba(148, 163, 184, 0.3)').length;
        const arcs = ops.filter((o) => o.op === 'arc');
        const by = (c) => arcs.filter((a) => a.fill === c).length;
        const tag = `${fn}(${d}) → 입력 ${I} · 은닉 ${L}×${N}`;
        if (got !== edges) bad(`${tag}: 연결선 ${got}개 — 층마다 곱해 더하면 ${edges}개`);
        if (by('#3b82f6') !== I || by('#10b981') !== 1 || by('#6366f1') !== L * N) {
            bad(`${tag}: 입력 ${by('#3b82f6')} · 은닉 ${by('#6366f1')} · 출력 ${by('#10b981')} 개를 그렸다`);
        }
        if (el('layerCountDisplay').innerText !== String(L) && fn === 'changeLayer') bad(`${tag}: 은닉층 수 표시가 ${el('layerCountDisplay').innerText}`);
        if (el('neuronCountDisplay').innerText !== String(N) && fn === 'changeNeuron') bad(`${tag}: 뉴런 수 표시가 ${el('neuronCountDisplay').innerText}`);
        if (el('inputNodesDisplay').innerText !== String(I) && fn === 'changeInputNodes') bad(`${tag}: 입력 노드 수 표시가 ${el('inputNodesDisplay').innerText}`);
    }
    S.changeLayer(2 - L); S.changeNeuron(4 - N); S.changeInputNodes(2 - I);
    console.log('  신경망 구조 — 버튼 ' + moves.length + '번, 끝값에서 멈추는지까지');
}

/* ================================================================
   9. 결정 경계 — 역전파 기울기, 칠한 칸이 모형 출력인가, 학습이 되는가
   ================================================================ */

function checkBoundary() {
    const db = S.dbSim;
    // 교차 엔트로피 손실의 기울기 — 한 표본으로 학습률 1 한 걸음을 걸으면 옛 값 − 새 값 이 기울기다
    const bce = (m, x, y) => { const p = m.predict(x[0], x[1]); return -(y * Math.log(p + 1e-7) + (1 - y) * Math.log(1 - p + 1e-7)); };
    for (let s = 0; s < 20; s++) {
        const m = withSeed(70 + s, () => new S.TinyMLP(3 + (s % 4)));
        const x = [Math.sin(s) * 0.8, Math.cos(s * 1.7) * 0.8], y = s % 2;
        const params = [];
        for (let j = 0; j < m.hn; j++) params.push([m.w1[0], j], [m.w1[1], j], [m.b1, j], [m.w2, j]);
        params.push([m, 'b2']);
        const want = params.map(([o, k]) => cdiff((v) => { const keep = o[k]; o[k] = v; const l = bce(m, x, y); o[k] = keep; return l; }, o[k]));
        const before = params.map(([o, k]) => o[k]);
        const lossBefore = bce(m, x, y);
        const ret = m.train([x], [y], 1);
        if (!near(ret, lossBefore, 1e-9)) bad(`결정 경계: train 이 돌려준 손실 ${ret} — 고치기 전 교차 엔트로피 ${lossBefore}`);
        const k = params.findIndex(([o, key], i) => Math.abs((before[i] - o[key]) - want[i]) > 1e-5);
        if (k >= 0) { bad(`결정 경계 역전파(씨앗 ${s}): ${k}번째 파라미터의 기울기가 중앙 차분 ${want[k]} 과 다르다`); break; }
    }

    // 자료 — 안쪽(반지름 2.5 안)이 1. 노이즈만큼만 경계를 넘는다.
    const noise = parseFloat(el('dbNoiseSlider').value);
    withSeed(8, () => db.resetModel());
    if (db.dataX.length !== 100) bad(`결정 경계: 자료가 ${db.dataX.length}개`);
    // 같은 씨앗으로 노이즈 넣기 전의 반지름을 되살려 부류 규칙(반지름 2.5 안이 1)을 그대로 본다.
    // 점 하나에 난수 넷 — 반지름, 각도, 노이즈 둘. 그 뒤에 모형이 가중치를 뽑는다.
    {
        const rnd = mulberry32(8);
        for (let i = 0; i < 100; i++) {
            const r = rnd() * 5;
            rnd(); rnd(); rnd();
            if (db.dataY[i] !== (r < 2.5 ? 1 : 0)) { bad(`결정 경계: 노이즈 전 반지름 ${r.toFixed(2)} 인 점의 부류가 ${db.dataY[i]}`); break; }
        }
    }
    for (let i = 0; i < db.dataX.length; i++) {
        const r = Math.hypot(db.dataX[i][0], db.dataX[i][1]) * 5, slack = noise * Math.SQRT1_2 + 1e-9;
        if (db.dataY[i] === 1 ? r > 2.5 + slack : r < 2.5 - slack) { bad(`결정 경계: 반지름 ${r.toFixed(2)} 인 점의 부류가 ${db.dataY[i]}`); break; }
    }
    const myMean = () => db.dataX.reduce((a, x, i) => a + bce(db.mlp, x, db.dataY[i]), 0) / db.dataX.length;
    if (!near(db.currentLoss(), myMean(), 1e-12)) bad('결정 경계: 학습 전 손실이 교차 엔트로피 평균이 아니다');
    if (el('dbLossDisplay').innerText !== myMean().toFixed(4)) bad('결정 경계: 화면의 학습 전 손실이 실제와 다르다');

    // 학습이 되는가 — 뉴런 8, 노이즈 0.5 에서 오래 돌리면 거의 다 맞힌다
    const keepN = el('dbNeuronSlider').value, keepNoise = el('dbNoiseSlider').value;
    el('dbNeuronSlider').value = '8'; el('dbNoiseSlider').value = '0.5';
    withSeed(9, () => db.resetModel());
    const l0 = db.currentLoss();
    for (let e = 0; e < 1500; e++) db.mlp.train(db.dataX, db.dataY, 0.1);
    const acc = db.dataX.filter((x, i) => (db.mlp.predict(x[0], x[1]) >= 0.5 ? 1 : 0) === db.dataY[i]).length;
    if (!(db.currentLoss() < l0 * 0.5)) bad(`결정 경계: 1500 에포크 뒤 손실 ${db.currentLoss().toFixed(3)} — 처음 ${l0.toFixed(3)} 에서 반도 줄지 않았다`);
    if (acc < 90) bad(`결정 경계: 1500 에포크 뒤 100개 중 ${acc}개만 맞혔다`);

    // 칠한 칸 — 색에서 되읽은 출력이 그 칸 «가운데»의 모형 출력과 같은가
    const ops = el('dbCanvas')._ctx.ops;
    ops.length = 0;
    db.draw();
    const W = db.logicalWidth, H = db.logicalHeight;
    const cells = ops.filter((o) => o.op === 'fillRect');
    if (cells.length !== 900) bad(`결정 경계: 칠한 칸이 ${cells.length}개`);
    let worst = 0;
    for (const c of cells) {
        const r = Number(/rgba\(([-\d.e]+)/.exec(c.fill)[1]);
        const p = (249 - r) / (249 - 59);
        const cx = c.x + (W / 30) / 2, cy = c.y + (H / 30) / 2;
        worst = Math.max(worst, Math.abs(p - db.mlp.predict(cx / W * 2 - 1, -(cy / H * 2 - 1))));
    }
    if (worst > 1e-9) bad(`결정 경계: 칠한 색이 칸 가운데의 모형 출력과 최대 ${worst.toExponential(2)} 어긋난다`);
    // 점 — 부류 1 은 파랑(모형 출력 1 쪽 색), 자리는 칠한 판과 같은 좌표계
    const dots = ops.filter((o) => o.op === 'arc');
    for (let i = 0; i < dots.length; i++) {
        const [x, y] = db.dataX[i];
        if (Math.abs(dots[i].x - (x + 1) / 2 * W) > 1e-9 || Math.abs(dots[i].y - (-y + 1) / 2 * H) > 1e-9) { bad('결정 경계: 점 자리가 칠한 판과 다른 좌표계다'); break; }
        if (dots[i].fill !== (db.dataY[i] === 1 ? '#2563eb' : '#ea580c')) { bad('결정 경계: 점 색이 부류와 다르다'); break; }
    }
    el('dbNeuronSlider').value = keepN; el('dbNoiseSlider').value = keepNoise;
    db.resetModel();
    console.log(`  결정 경계 — 역전파 20판, 1500 에포크 뒤 ${acc}/100, 칠한 칸과 모형 출력 최대 차 ${worst.toExponential(1)}`);
}

/* ================================================================
   10. 과적합 그래프 — 지어낸 값이지만 화면이 말하는 모양이어야 한다
   ================================================================ */

function checkOverfit() {
    const of = S.ofSim;
    const keepSI = sandbox.setInterval;
    // 차례대로 다 그리게 한다 — 받침대는 시간을 기다리지 않는다
    sandbox.setInterval = (f) => { for (let i = 0; i < 40; i++) f(); return 0; };
    const run = (c, seed) => {
        el('ofComplexSlider').value = String(c);
        withSeed(seed, () => of.runSim());
        const [t, v] = of.chart.data.datasets.map((d) => d.data);
        return {t, v};
    };
    for (let s = 0; s < 10; s++) {
        const hi = run(5, 50 + s);
        if (hi.t.length !== 101 || hi.v.length !== 101) { bad(`과적합: 점이 ${hi.t.length} · ${hi.v.length}개`); break; }
        const vMin = Math.min(...hi.v), at = hi.v.indexOf(vMin);
        if (hi.t[100] > 0.1) bad(`과적합(매우 높음): 훈련 오차가 끝에서 ${hi.t[100].toFixed(3)} — 0에 가깝게 줄어야 한다`);
        if (!(hi.v[100] - vMin > 0.4 && at > 10 && at < 90)) bad(`과적합(매우 높음): 검증 오차가 ${at}회에서 바닥을 찍고 끝에서 ${(hi.v[100] - vMin).toFixed(3)} 만큼만 솟았다`);
        if (Math.max(...hi.v, ...hi.t) > 2.0) bad('과적합(매우 높음): 값이 y축 상한 2.0 을 넘는다');
        const lo = run(1, 80 + s);
        if (lo.v[100] - Math.min(...lo.v) > 0.08) bad('과적합(매우 낮음): 검증 오차가 다시 솟는다 — 화면은 나란히 내려간다고 말한다');
        if (lo.v.some((v, i) => Math.abs(v - lo.t[i]) > 0.15)) bad('과적합(매우 낮음): 두 선이 벌어진다');
    }
    sandbox.setInterval = keepSI;
    el('ofComplexSlider').value = '5';
    console.log('  과적합 그래프 — 복잡도 양 끝 10판씩');
}

/* ================================================================ */
console.log('딥러닝 시뮬레이터를 페이지 원문 그대로 돌린다');
checkTangent();
checkCanvasSize();
checkPoints();
checkCurveHeight();
checkGdMath();
checkNet();
checkNetTabs();
checkStructure();
checkBoundary();
checkOverfit();
console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
test('deep-learning', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
