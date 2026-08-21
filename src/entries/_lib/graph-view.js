// 시뮬레이터들이 **함께 쓰는 그래프 렌더러**.
//
// 트리 렌더러(`tree-view.js`)와 짝을 이룬다. 둘을 나눈 이유는 하나다 —
// **트리 렌더러는 사이클이 있는 그래프를 그릴 수 없다.** `d3-hierarchy`의 배치는
// 부모가 하나뿐인 자료에만 쓸 수 있고, 그래프는 그 가정이 처음부터 깨진다.
//
// **자리는 여기서 계산하지 않는다. 데이터가 좌표를 들고 온다.**
// 힘 기반 배치(d3-force)를 쓰지 않는 이유는 번들 크기가 아니라 수업이다 —
// 노드가 계속 흔들리면 **직선거리 휴리스틱 h(n)이 매 순간 바뀐다.** 지도는 가만히
// 있어야 「여기서 목표까지 자로 잰 거리」라는 말이 성립한다.
//
// **d3 서브모듈만 골라 받는다.** 여기서 새로 받는 것은 없다 — 트리 뷰가 이미 쓰는
// `d3-selection`·`d3-zoom`·`d3-transition` 셋으로 끝난다.
import {pointer, select} from 'd3-selection';
import {zoom as d3zoom, zoomIdentity} from 'd3-zoom';
import 'd3-transition';   // selection.transition() 을 쓰려면 곁불로 한 번 실어야 한다.
import {TextMeasurer} from './text-measure.js';

/**
 * 기본값. 부르는 쪽이 필요한 것만 덮어쓴다.
 *
 * 길이 단위는 전부 px다. `label`이 배열을 돌려주면 여러 줄로 그린다.
 */
export const GRAPH_VIEW_DEFAULTS = {
    // --- 노드 모양 ---
    shape: () => 'box',           // 'circle' | 'box'
    radius: 18,                   // circle 반지름
    fontSize: 14,
    lineHeight: 1.35,
    padX: 12,
    padY: 7,
    boxRadius: 8,
    minBoxWidth: 44,
    label: (n) => String(n.id),
    nodeStyle: () => ({}),        // {fill, stroke, strokeWidth, textColor, fontWeight, fontSize}

    // --- 간선 ---
    edgeStyle: () => ({}),        // {stroke, strokeWidth, dash, opacity}
    edgeLabel: () => null,        // 간선 가운데 적을 글자(비용)
    edgeLabelColor: '#0f766e',
    edgeLabelSize: 13,
    edgeLabelBg: '#ffffff',
    gapFromNode: 4,               // 간선 끝과 노드 테두리 사이 틈
    // 같은 두 노드를 잇는 간선이 둘일 때(A→B 와 B→A) 서로 겹치지 않게 벌리는 정도.
    // **방향 그래프에서 이것이 0이면 두 화살표가 한 줄에 포개져 하나로 보인다.**
    curveOffset: 24,
    arrowSize: 9,

    // --- 화면 ---
    draggable: false,
    minScale: 0.15,
    maxScale: 4,
    fitPadding: 48,
    maxFitScale: 1.4,
    focusScale: 1.25,
    viewMode: 'fit',              // 'fit' | 'track' | 'free'
    duration: 250,
};

/**
 * 그래프 뷰 하나를 만든다.
 *
 * @param {HTMLElement|string} container  그릴 자리. 문자열이면 CSS 선택자로 본다.
 * @param {object} options                위 GRAPH_VIEW_DEFAULTS 참고
 * @returns {GraphView}
 */
export function createGraphView(container, options = {}) {
    return new GraphView(container, options);
}

export class GraphView {
    constructor(container, options = {}) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) throw new Error(`graph-view: 컨테이너를 찾지 못했다 — ${container}`);

        this.el = el;
        this.opt = {...GRAPH_VIEW_DEFAULTS, ...options};
        this.nodes = [];
        this.edges = [];
        this.nodeById = new Map();
        this.viewMode = this.opt.viewMode;
        this.activeId = null;
        this._handlers = {nodeclick: [], edgeclick: [], canvasclick: []};
        this._sizes = new Map();
        this._drag = null;
        this._draggedAt = 0;
        // 고치는 중인가. 노드를 끌 수 있는지와 화면을 끌 수 있는지를 함께 정한다.
        this.editing = !!this.opt.draggable;

        // SVG는 컨테이너를 꽉 채운다. 컨테이너에 position 이 없으면 여기서 준다 —
        // 없으면 absolute 인 SVG 가 엉뚱한 조상에 붙는다.
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

        select(el).selectAll('svg.graph-view').remove();

        this.svg = select(el).append('svg')
            .attr('class', 'graph-view')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('display', 'block')
            .style('touch-action', 'none')
            .style('cursor', 'grab');

        this.measurer = new TextMeasurer(this.svg.node());

        this.g = this.svg.append('g');

        // 빈 자리를 누른 것을 알아내려면 받아 줄 면이 있어야 한다. 줌과 함께 움직여야
        // 좌표를 그래프 좌표로 바로 읽을 수 있으므로 `g` 안에 둔다.
        this.surface = this.g.append('rect')
            .attr('class', 'gv-surface')
            .attr('x', -1e5).attr('y', -1e5)
            .attr('width', 2e5).attr('height', 2e5)
            .attr('fill', 'transparent')
            .on('click', (event) => {
                const [x, y] = pointer(event, this.g.node());
                this._emit('canvasclick', x, y, event);
            });

        // 층을 나눠 둔다. 간선이 늘 노드 밑에 깔리게 하려면 이 방법뿐이다 —
        // 그리는 순서에 맡기면 노드를 다시 그릴 때 위아래가 뒤집힌다.
        this.layerEdges = this.g.append('g').attr('class', 'gv-layer-edges');
        this.layerLabels = this.g.append('g').attr('class', 'gv-layer-edge-labels');
        this.layerNodes = this.g.append('g').attr('class', 'gv-layer-nodes');

        this.zoom = d3zoom()
            .scaleExtent([this.opt.minScale, this.opt.maxScale])
            // **고치는 동안에는 화면을 끌어 옮기지 않는다.** 노드를 끌려는 손짓이
            // 캔버스 이동으로 새어 나가, 노드가 제자리에 붙어 있는 것처럼 보인다.
            // 휠 확대는 그대로 둔다 — 그것 때문에 헷갈리는 일은 없다.
            //
            // 뒤의 한 줄은 d3-zoom 의 기본 거르개와 같다. **거르개를 주는 순간 기본값이
            // 통째로 밀려나므로 함께 적어 두어야 한다.**
            .filter((event) => {
                if (this.editing && (event.type === 'mousedown' || event.type === 'touchstart')) return false;
                return (!event.ctrlKey || event.type === 'wheel') && !event.button;
            })
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
                // 사람이 직접 끌거나 굴리면 '자유 이동'으로 넘긴다.
                // 그러지 않으면 다음 갱신 때 화면이 도로 튕겨 돌아간다.
                const src = event.sourceEvent;
                if (src && (src.type === 'mousemove' || src.type === 'wheel' || src.type === 'touchmove')) {
                    if (this.viewMode !== 'free') {
                        this.viewMode = 'free';
                        this._emitViewMode();
                    }
                }
            });

        this.svg.call(this.zoom);

        this._observeResize();
    }

    /* ============================================================
       바깥에서 부르는 것들
       ============================================================ */

    /**
     * 그릴 그래프를 갈아 끼운다.
     *
     * @param {{nodes: Array, edges: Array}} data
     *   nodes: `{id, x, y, ...}` — **좌표는 부르는 쪽이 정한다.**
     *   edges: `{id, a, b, directed}` — `directed`는 셋 중 하나다.
     *     `false`(방향 없음) · `true`(a에서 b로만) · `'both'`(양쪽 다, 화살촉이 양끝에).
     *     **양방향을 화살표 둘로 나눠 그리지 않는다** — 선이 배로 늘어 지도가 지저분해진다.
     */
    setData(data) {
        this.nodes = (data && data.nodes) || [];
        this.edges = (data && data.edges) || [];
        this.nodeById = new Map(this.nodes.map(n => [n.id, n]));
        this._sizes.clear();
        return this;
    }

    /** 화면을 다시 그린다. 데이터 객체를 고친 뒤 부른다. */
    update(duration = this.opt.duration) {
        this._sizes.clear();
        this._layoutEdges();

        this._drawEdges(duration);
        this._drawEdgeLabels(duration);
        this._drawNodes(duration);

        if (this.viewMode === 'fit') this.fit(duration);
        else if (this.viewMode === 'track' && this.activeId != null) this.focus(this.activeId, duration);

        return this;
    }

    /** 그래프 전체가 화면에 들어오도록 맞춘다. */
    fit(duration = 500) {
        const box = this._viewport();
        if (!box || this.nodes.length === 0) return this;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        for (const n of this.nodes) {
            const {w, h} = this._size(n);
            minX = Math.min(minX, n.x - w / 2);
            maxX = Math.max(maxX, n.x + w / 2);
            minY = Math.min(minY, n.y - h / 2);
            maxY = Math.max(maxY, n.y + h / 2);
        }
        if (!Number.isFinite(minX)) return this;

        const gw = Math.max(maxX - minX, 1);
        const gh = Math.max(maxY - minY, 1);
        const pad = box.width < 640 ? this.opt.fitPadding / 2 : this.opt.fitPadding;

        const scale = Math.min(
            (box.width - pad * 2) / gw,
            (box.height - pad * 2) / gh,
            this.opt.maxFitScale,
        );

        // 트리와 달리 그래프는 위아래로도 가운데에 놓는다. 뿌리가 없어 위쪽에 붙일 이유가 없다.
        const tx = box.width / 2 - ((minX + maxX) / 2) * scale;
        const ty = box.height / 2 - ((minY + maxY) / 2) * scale;

        this._applyTransform(tx, ty, scale, duration);
        return this;
    }

    /** 특정 노드를 화면 가운데에 놓는다. 탐색을 따라가며 볼 때 쓴다. */
    focus(id, duration = 500) {
        const box = this._viewport();
        const target = this.nodeById.get(id);
        if (!box || !target) return this;

        const scale = this.opt.focusScale;
        const tx = box.width / 2 - target.x * scale;
        const ty = box.height / 2 - target.y * scale;

        this._applyTransform(tx, ty, scale, duration);
        return this;
    }

    /** 'fit' | 'track' | 'free' */
    setViewMode(mode, duration = 500) {
        this.viewMode = mode;
        if (mode === 'fit') this.fit(duration);
        else if (mode === 'track' && this.activeId != null) this.focus(this.activeId, duration);
        return this;
    }

    /**
     * 고치는 중인지 알린다. **노드 끌기와 화면 끌기는 함께 갈 수 없다.**
     *
     * 둘 다 켜 두면 노드를 끌려는 손짓이 캔버스 이동으로 새어 나간다. 그래서 하나를
     * 켜면 다른 하나를 끈다 — 고치는 중이면 노드가 끌리고 화면은 가만히 있는다.
     */
    setEditing(on) {
        this.editing = !!on;
        this.opt.draggable = !!on;
        this.svg.style('cursor', on ? 'default' : 'grab');
        this.layerNodes.selectAll('g.gv-node').style('cursor', on ? 'move' : 'pointer');
        return this;
    }

    /** 'track' 모드에서 따라갈 노드 */
    setActive(id) {
        this.activeId = id;
        return this;
    }

    /** 'nodeclick' | 'edgeclick' | 'canvasclick' | 'nodedrag' | 'nodedragend' | 'viewmode' */
    on(event, fn) {
        (this._handlers[event] ||= []).push(fn);
        return this;
    }

    /** 컨테이너 크기가 바뀐 뒤 화면을 다시 맞춘다. 탭을 켜거나 전체 화면에 들어갈 때 부른다. */
    resize(duration = 0) {
        if (this.viewMode === 'fit') this.fit(duration);
        else if (this.viewMode === 'track' && this.activeId != null) this.focus(this.activeId, duration);
        return this;
    }

    /** 그린 것을 전부 지운다(데이터는 그대로). */
    clear() {
        this.layerEdges.selectAll('*').remove();
        this.layerLabels.selectAll('*').remove();
        this.layerNodes.selectAll('*').remove();
        this._sizes.clear();
        return this;
    }

    destroy() {
        if (this._ro) this._ro.disconnect();
        this.svg.remove();
    }

    /* ============================================================
       속으로만 쓰는 것들
       ============================================================ */

    _emit(event, ...args) {
        (this._handlers[event] || []).forEach(fn => fn(...args));
    }

    _emitViewMode() {
        this._emit('viewmode', this.viewMode);
    }

    _viewport() {
        const width = this.el.clientWidth;
        const height = this.el.clientHeight;
        // 숨은 탭 안에서는 0이 나온다. 그 상태로 맞추면 배율이 터지므로 건너뛴다.
        if (!width || !height) return null;
        return {width, height};
    }

    /**
     * 실제로 쓸 애니메이션 길이.
     *
     * **화면이 그려지지 않는 동안에는 0으로 깎는다.** 브라우저 탭이 뒤로 가 있으면
     * `requestAnimationFrame`이 아예 안 돌고, d3 트랜지션은 그 위에 얹혀 있어 시작도 끝도
     * 하지 못한 채 멈춘다. 어차피 안 보이는 동안의 애니메이션은 값이 없으니 곧바로 찍는다.
     */
    _effDuration(duration) {
        if (typeof document !== 'undefined' && document.hidden) return 0;
        return duration;
    }

    _applyTransform(tx, ty, scale, duration) {
        const t = zoomIdentity.translate(tx, ty).scale(scale);
        duration = this._effDuration(duration);
        if (duration > 0) {
            // **여기에는 `interrupt`/`cancel` 핸들러를 달지 않는다.** `zoom.transform`이 안에서
            // `selection.interrupt()`를 부르는데, d3는 **핸들러를 부른 뒤에야** 스케줄을 지운다.
            // 그래서 핸들러 안에서 `zoom.transform`을 다시 부르면 무한 재귀에 빠진다.
            this.svg.transition().duration(duration).call(this.zoom.transform, t);
        } else {
            this.svg.call(this.zoom.transform, t);
        }
    }

    /**
     * 속성 하나를 옮긴다. **트랜지션이 끊겨도 최종값은 반드시 들어간다.**
     *
     * d3 트랜지션은 다음 트랜지션에 밀리면 **끝값을 넣지 않고 버린다.** 탐색이 빠르게 돌면
     * 갱신 간격이 화면 프레임보다 짧아, 새 트랜지션이 한 번도 못 그린 채 다음 것에 밀리는
     * 일이 이어진다. 그러면 노드가 처음 놓인 자리에 영영 멈춘다.
     *
     * **`interrupt`와 `cancel`을 둘 다 들어야 한다.** d3는 이미 그리기 시작한 것만
     * `interrupt`로 알리고, **시작도 못 한 채 밀린 것은 `cancel`**로 알린다.
     */
    _move(selection, name, target, duration) {
        duration = this._effDuration(duration);
        if (!(duration > 0)) {
            selection.attr(name, target);
            return;
        }
        selection.transition().duration(duration)
            .attr(name, target)
            .on('interrupt cancel', function () {
                select(this).attr(name, target(this.__data__));
            });
    }

    /** 노드 하나가 차지하는 크기. 라벨을 재서 정하고 갱신 한 번 동안 캐시한다. */
    _size(node) {
        const hit = this._sizes.get(node.id);
        if (hit) return hit;

        const shape = this.opt.shape(node);
        let size;

        if (shape === 'circle') {
            const r = typeof this.opt.radius === 'function' ? this.opt.radius(node) : this.opt.radius;
            size = {w: r * 2, h: r * 2, r, shape};
        } else {
            const lines = this._lines(node);
            const style = this.opt.nodeStyle(node) || {};
            const fs = style.fontSize || this.opt.fontSize;
            const bold = style.fontWeight === 'bold' || style.fontWeight === 700;

            let textW = 0;
            for (const line of lines) {
                textW = Math.max(textW, this.measurer.width(line.text, fs, line.bold ?? bold));
            }

            const w = Math.max(textW + this.opt.padX * 2, this.opt.minBoxWidth);
            const h = lines.length * fs * this.opt.lineHeight + this.opt.padY * 2;
            size = {w, h, shape, lines, fontSize: fs};
        }

        this._sizes.set(node.id, size);
        return size;
    }

    /**
     * 라벨을 줄 단위로 푼다. 줄마다 `{text, bold}` 꼴로 맞춰 돌려준다.
     *
     * 부르는 쪽은 문자열이나 배열을 줄 수 있고, 배열의 원소는 문자열이거나 `{text, bold}`다.
     * **줄마다 굵기를 달리 줄 수 있어야** 「이름은 굵게, g·h·f는 보통」인 상자를 그릴 수 있다.
     */
    _lines(node) {
        const label = this.opt.label(node);
        const raw = Array.isArray(label) ? label : String(label ?? '').split('\n');
        return raw.map(line => (
            line && typeof line === 'object'
                ? {text: String(line.text ?? ''), bold: !!line.bold}
                : {text: String(line ?? ''), bold: null}   // null = 노드 기본값을 따른다
        ));
    }

    /**
     * 간선마다 휘는 정도를 정한다.
     *
     * **같은 두 노드를 잇는 간선이 둘이면(A→B 와 B→A) 반대로 휘게 한다.** 안 그러면 두
     * 화살표가 한 줄에 포개져 「일방통행이 양쪽에 다 있다」는 것이 보이지 않는다.
     * 하나뿐이면 곧게 긋는다 — 굽은 선은 거리를 오해하게 만드니 필요할 때만 굽힌다.
     */
    _layoutEdges() {
        const pairCount = new Map();
        for (const e of this.edges) {
            const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
            pairCount.set(key, (pairCount.get(key) || 0) + 1);
        }
        const seen = new Map();
        for (const e of this.edges) {
            const key = e.a < e.b ? `${e.a}|${e.b}` : `${e.b}|${e.a}`;
            if (pairCount.get(key) < 2) {
                e._bend = 0;
            } else {
                const n = seen.get(key) || 0;
                seen.set(key, n + 1);
                // 첫째는 한쪽으로, 둘째는 반대쪽으로.
                e._bend = (n === 0 ? 1 : -1) * this.opt.curveOffset;
            }
        }
    }

    /**
     * 간선 하나의 기하를 계산한다.
     *
     * 끝점은 **노드 도형의 테두리**에서 멈춘다. 중심끼리 이으면 화살촉이 상자 안에 파묻혀
     * 어느 쪽으로 가는 간선인지 안 보인다.
     */
    _geom(e) {
        const A = this.nodeById.get(e.a);
        const B = this.nodeById.get(e.b);
        if (!A || !B) return null;

        const mx = (A.x + B.x) / 2;
        const my = (A.y + B.y) / 2;
        const dx = B.x - A.x, dy = B.y - A.y;
        const len = Math.hypot(dx, dy) || 1;

        // 제어점은 두 점의 가운데에서 선의 법선 방향으로 밀어낸다.
        const nx = -dy / len, ny = dx / len;
        const bend = e._bend || 0;
        const cx = mx + nx * bend * 2;
        const cy = my + ny * bend * 2;

        // 끝점을 깎을 방향은 **제어점 쪽**이다. 굽은 선에서 중심 방향으로 깎으면 어긋난다.
        const p0 = this._boundary(A, cx - A.x, cy - A.y);
        const p1 = this._boundary(B, cx - B.x, cy - B.y);

        return {p0, p1, cx, cy, bend};
    }

    /** 노드 중심에서 (dx,dy) 방향으로 나갈 때 테두리를 뚫는 점. */
    _boundary(node, dx, dy) {
        const size = this._size(node);
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const gap = this.opt.gapFromNode;

        if (size.shape === 'circle') {
            const r = size.r + gap;
            return {x: node.x + ux * r, y: node.y + uy * r};
        }
        // 상자는 광선-사각형 교차. 가로·세로 중 먼저 닿는 쪽이 이긴다.
        const hw = size.w / 2 + gap, hh = size.h / 2 + gap;
        const tx = Math.abs(ux) < 1e-6 ? Infinity : hw / Math.abs(ux);
        const ty = Math.abs(uy) < 1e-6 ? Infinity : hh / Math.abs(uy);
        const t = Math.min(tx, ty);
        return {x: node.x + ux * t, y: node.y + uy * t};
    }

    /**
     * 비용 숫자를 놓을 자리.
     *
     * 곡선 한가운데가 첫 후보지만, **간선이 짧으면 그 자리가 노드 상자에 물린다.**
     * 노드는 라벨보다 위에 그려지므로 물리는 순간 숫자가 가려져 안 보인다.
     * 그래서 상자에 물리면 **선을 따라 조금씩 비켜 가며** 비는 자리를 찾는다.
     * 끝까지 못 찾으면 선 옆으로 밀어낸다 — 가려지느니 선에서 떨어지는 편이 낫다.
     *
     * @param {object} gm  `_geom()` 결과
     * @param {object} e   간선
     * @param {number} hw  숫자판 반너비
     * @param {number} hh  숫자판 반높이
     */
    _labelPoint(gm, e, hw, hh) {
        if (!gm) return {x: 0, y: 0};

        const ends = [this.nodeById.get(e.a), this.nodeById.get(e.b)].filter(Boolean);
        const clear = (x, y) => ends.every(n => {
            const s = this._size(n);
            return Math.abs(x - n.x) >= s.w / 2 + hw || Math.abs(y - n.y) >= s.h / 2 + hh;
        });

        const at = (t) => {
            const u = 1 - t;
            return {
                x: u * u * gm.p0.x + 2 * u * t * gm.cx + t * t * gm.p1.x,
                y: u * u * gm.p0.y + 2 * u * t * gm.cy + t * t * gm.p1.y,
            };
        };

        for (const t of [0.5, 0.56, 0.44, 0.62, 0.38, 0.68, 0.32]) {
            const p = at(t);
            if (clear(p.x, p.y)) return p;
        }

        // 마지막 수단 — 선의 법선 방향으로 밀어낸다.
        const mid = at(0.5);
        const dx = gm.p1.x - gm.p0.x, dy = gm.p1.y - gm.p0.y;
        const len = Math.hypot(dx, dy) || 1;
        const push = hh * 2 + 10;
        return {x: mid.x + (-dy / len) * push, y: mid.y + (dx / len) * push};
    }

    _path(gm) {
        if (!gm) return 'M0,0';
        if (!gm.bend) return `M${gm.p0.x},${gm.p0.y}L${gm.p1.x},${gm.p1.y}`;
        return `M${gm.p0.x},${gm.p0.y}Q${gm.cx},${gm.cy} ${gm.p1.x},${gm.p1.y}`;
    }

    /**
     * 화살촉 하나. 마커를 쓰지 않고 직접 그린다 — 간선마다 색을 달리 주려면 이 편이 낫다.
     *
     * @param {object} gm   `_geom()`이 돌려준 기하
     * @param {boolean} atA 참이면 a쪽 끝에 그린다(양방향 간선의 반대쪽 화살촉)
     */
    _arrowPath(gm, atA = false) {
        if (!gm) return null;
        const tip = atA ? gm.p0 : gm.p1;
        const from = gm.bend ? {x: gm.cx, y: gm.cy} : (atA ? gm.p1 : gm.p0);
        const dx = tip.x - from.x, dy = tip.y - from.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const s = this.opt.arrowSize;
        const baseX = tip.x - ux * s, baseY = tip.y - uy * s;
        const w = s * 0.42;
        return `M${tip.x},${tip.y}L${baseX - uy * w},${baseY + ux * w}L${baseX + uy * w},${baseY - ux * w}Z`;
    }

    _drawEdges(duration) {
        const sel = this.layerEdges.selectAll('g.gv-edge').data(this.edges, d => d.id);
        sel.exit().remove();

        const enter = sel.enter().append('g')
            .attr('class', 'gv-edge')
            .style('cursor', this._handlers.edgeclick.length ? 'pointer' : null)
            .on('click', (event, d) => {
                event.stopPropagation();
                this._emit('edgeclick', d.id, d, event);
            });

        // 굵은 투명 선을 하나 깔아 둔다. 실선만으로는 손가락으로 누르기에 너무 가늘다.
        enter.append('path').attr('class', 'gv-edge-hit')
            .attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 14);
        enter.append('path').attr('class', 'gv-edge-line').attr('fill', 'none');
        enter.append('path').attr('class', 'gv-edge-arrow');
        enter.append('path').attr('class', 'gv-edge-arrow-back');

        const all = enter.merge(sel);

        all.each((d) => {
            d._gm = this._geom(d);
        });

        const style = (d) => this.opt.edgeStyle(d) || {};

        // 색·굵기는 **곧바로** 넣는다. 트랜지션에 실으면 밀렸을 때 통째로 사라진다.
        all.select('path.gv-edge-line')
            .attr('stroke', d => style(d).stroke || '#94a3b8')
            .attr('stroke-width', d => style(d).strokeWidth || 2.5)
            .attr('stroke-dasharray', d => style(d).dash || null)
            .attr('opacity', d => (style(d).opacity == null ? 1 : style(d).opacity));

        all.select('path.gv-edge-arrow')
            .attr('fill', d => (d.directed ? (style(d).stroke || '#94a3b8') : 'none'))
            .attr('d', d => (d.directed ? this._arrowPath(d._gm) : null));

        // 양방향 간선은 반대쪽 끝에도 화살촉을 하나 더 단다.
        all.select('path.gv-edge-arrow-back')
            .attr('fill', d => (d.directed === 'both' ? (style(d).stroke || '#94a3b8') : 'none'))
            .attr('d', d => (d.directed === 'both' ? this._arrowPath(d._gm, true) : null));

        this._move(all.select('path.gv-edge-line'), 'd', d => this._path(d._gm), duration);
        all.select('path.gv-edge-hit').attr('d', d => this._path(d._gm));
    }

    _drawEdgeLabels(duration) {
        const labelled = this.edges.filter(e => {
            const t = this.opt.edgeLabel(e);
            return t !== null && t !== undefined && t !== '';
        });

        const sel = this.layerLabels.selectAll('g.gv-edge-label').data(labelled, d => d.id);
        sel.exit().remove();

        const enter = sel.enter().append('g').attr('class', 'gv-edge-label')
            .attr('pointer-events', 'none');
        enter.append('rect').attr('class', 'gv-edge-label-bg').attr('rx', 4);
        enter.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('font-weight', '700');

        const all = enter.merge(sel);
        const fs = this.opt.edgeLabelSize;

        all.select('text')
            .attr('font-size', fs)
            .attr('fill', this.opt.edgeLabelColor)
            .text(d => String(this.opt.edgeLabel(d)));

        // 글자 뒤에 흰 판을 깐다. 간선 위에 그냥 얹으면 선과 겹쳐 숫자를 못 읽는다.
        // **판 크기를 여기서 재 두었다가 자리를 정할 때 쓴다** — 얼마나 큰지 알아야
        // 노드 상자에 물리는지 판정할 수 있다.
        all.select('rect')
            .attr('fill', this.opt.edgeLabelBg)
            .attr('opacity', 0.92)
            .each((d, i, g) => {
                const w = this.measurer.width(String(this.opt.edgeLabel(d)), fs, true) + 8;
                const h = fs + 5;
                d._labelHalf = {w: w / 2, h: h / 2};
                select(g[i]).attr('x', -w / 2).attr('y', -h / 2).attr('width', w).attr('height', h);
            });

        this._move(all, 'transform', d => {
            const gm = d._gm || this._geom(d);
            const half = d._labelHalf || {w: 10, h: 9};
            const p = this._labelPoint(gm, d, half.w, half.h);
            return `translate(${p.x},${p.y})`;
        }, duration);
    }

    _drawNodes(duration) {
        const sel = this.layerNodes.selectAll('g.gv-node').data(this.nodes, d => d.id);
        sel.exit().remove();

        const enter = sel.enter().append('g')
            .attr('class', 'gv-node')
            .attr('transform', d => `translate(${d.x},${d.y})`)
            .on('click', (event, d) => {
                event.stopPropagation();
                // 방금 끌어 놓은 것이라면 클릭으로 치지 않는다. 노드를 옮길 때마다
                // 목표가 바뀌어 버리면 편집을 할 수가 없다.
                if (Date.now() - this._draggedAt < 250) return;
                this._emit('nodeclick', d.id, d, event);
            });

        enter.each((d, i, g) => {
            const {shape} = this._size(d);
            const node = select(g[i]);
            if (shape === 'circle') node.append('circle').attr('class', 'gv-shape');
            else node.append('rect').attr('class', 'gv-shape');
        });

        this._enableDrag(enter);

        const all = enter.merge(sel);

        // 커서는 갱신할 때마다 지금 상태에 맞춘다. 들어올 때만 정하면 고치기를 켠 뒤에
        // 새로 그려진 노드와 이미 있던 노드의 커서가 서로 달라진다.
        all.style('cursor', this.opt.draggable ? 'move' : 'pointer');

        // **움직임만 트랜지션에 싣는다.** 크기와 색은 아래에서 곧바로 넣는다.
        this._move(all, 'transform', d => `translate(${d.x},${d.y})`, duration);

        all.each((d, i, g) => {
            const node = select(g[i]);
            const size = this._size(d);
            const style = this.opt.nodeStyle(d) || {};

            const shape = node.select('.gv-shape')
                .attr('fill', style.fill || '#ffffff')
                .attr('stroke', style.stroke || '#cbd5e1')
                .attr('stroke-width', style.strokeWidth || 2);

            if (size.shape === 'circle') {
                shape.attr('r', size.r);
            } else {
                shape.attr('x', -size.w / 2).attr('y', -size.h / 2)
                    .attr('width', size.w).attr('height', size.h)
                    .attr('rx', this.opt.boxRadius);
            }

            this._drawLabel(node, d, size, style);
        });
    }

    _drawLabel(node, d, size, style) {
        const lines = size.lines || this._lines(d);
        const fs = size.fontSize || style.fontSize || this.opt.fontSize;
        const color = style.textColor || '#1e293b';
        const step = fs * this.opt.lineHeight;
        // 여러 줄이면 가운데를 기준으로 위아래로 펼친다.
        const top = -((lines.length - 1) * step) / 2;

        const texts = node.selectAll('text.gv-label').data(lines);
        texts.exit().remove();

        texts.enter().append('text')
            .attr('class', 'gv-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('pointer-events', 'none')
            .merge(texts)
            .attr('font-size', fs)
            .attr('font-weight', line => (line.bold === null ? (style.fontWeight || '700') : (line.bold ? '700' : '400')))
            .attr('y', (line, i) => top + i * step)
            .attr('fill', color)
            .text(line => line.text);
    }

    /**
     * 노드를 끌어 옮긴다.
     *
     * **d3-drag를 받지 않는다.** 포인터 이벤트 셋이면 되는 일이라 패키지를 하나 더 받을
     * 이유가 없다. 누른 자리에서 줌 팬으로 새지 않도록 `stopPropagation`을 먼저 한다.
     */
    _enableDrag(sel) {
        const self = this;
        // **`mousedown`·`touchstart` 도 함께 막는다.** d3-zoom 이 듣는 것은 `pointerdown`이
        // 아니라 이 둘이라, `pointerdown` 만 막아서는 노드를 끌어도 캔버스가 따라 움직인다.
        sel.on('mousedown touchstart', function (event) {
            if (self.opt.draggable) event.stopPropagation();
        });

        sel.on('pointerdown', function (event, d) {
            if (!self.opt.draggable) return;
            event.stopPropagation();
            try {
                this.setPointerCapture(event.pointerId);
            } catch { /* 포인터 캡처가 없는 환경이면 그냥 넘어간다 */
            }
            const [px, py] = pointer(event, self.g.node());
            self._drag = {id: d.id, dx: d.x - px, dy: d.y - py, moved: false};
        }).on('pointermove', function (event) {
            if (!self._drag) return;
            const [px, py] = pointer(event, self.g.node());
            self._drag.moved = true;
            self._emit('nodedrag', self._drag.id, px + self._drag.dx, py + self._drag.dy);
        }).on('pointerup pointercancel', function (event) {
            if (!self._drag) return;
            try {
                this.releasePointerCapture(event.pointerId);
            } catch { /* 위와 같다 */
            }
            const drag = self._drag;
            self._drag = null;
            if (drag.moved) {
                self._draggedAt = Date.now();
                self._emit('nodedragend', drag.id);
            }
        });
    }

    /**
     * 컨테이너 크기가 바뀌면 화면을 다시 맞춘다.
     *
     * 탭을 켜거나 전체 화면에 들어갈 때 컨테이너가 커지는데, 그때 다시 맞추지 않으면
     * 그래프가 구석에 조그맣게 남는다. 부르는 쪽마다 손으로 걸게 하면 빠뜨리므로 여기서 본다.
     */
    _observeResize() {
        if (typeof ResizeObserver !== 'function') return;
        let timer = null;
        this._ro = new ResizeObserver(() => {
            if (this.viewMode === 'free') return;
            clearTimeout(timer);
            timer = setTimeout(() => this.resize(200), 120);
        });
        this._ro.observe(this.el);
    }
}

export default createGraphView;
