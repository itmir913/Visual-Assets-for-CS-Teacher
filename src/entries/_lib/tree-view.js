// 시뮬레이터들이 **함께 쓰는 트리 렌더러**.
//
// 예전에는 트리를 그리는 시뮬레이터마다 라이브러리가 달랐다 — n-queen만 d3로 직접
// 그렸고 나머지 셋은 vis-network를 썼다. 같은 개념(상태 공간 트리)이 페이지마다 다른
// 모양으로 나오는 것도 문제였지만, vis-network는 통짜 번들이라 **쓰지도 않는 물리 엔진과
// 클러스터링까지 함께 실렸다.** 그래서 n-queen이 쓰던 그리기 코드를 이 모듈로 뽑아
// 넷이 나눠 쓴다.
//
// **d3 서브모듈만 골라 받는다.** `import * as d3 from 'd3'`는 안 쓴다 — 통짜로 받으면
// 여기서 안 쓰는 것까지 번들에 들어간다. 링크 곡선은 `d3-shape`의 `linkVertical`과 같은
// 모양을 손으로 그려 그 패키지도 뺐다.
import {select} from 'd3-selection';
import {hierarchy, tree as treeLayout} from 'd3-hierarchy';
import {zoom as d3zoom, zoomIdentity} from 'd3-zoom';
import 'd3-transition';   // selection.transition() 을 쓰려면 곁불로 한 번 실어야 한다.
import {TextMeasurer} from './text-measure.js';

/**
 * 기본값. 부르는 쪽이 필요한 것만 덮어쓴다.
 *
 * 길이 단위는 전부 px다. `label`이 배열을 돌려주면 여러 줄로 그린다.
 */
const DEFAULTS = {
    // --- 모양 ---
    shape: () => 'circle',        // 'circle' | 'box' | 'ellipse'
    radius: 16,                   // circle 반지름
    fontSize: 13,
    lineHeight: 1.35,
    padX: 12,                     // box·ellipse 좌우 여백
    padY: 8,                      // box·ellipse 상하 여백
    boxRadius: 6,                 // box 모서리 둥글기
    minBoxWidth: 0,

    // --- 배치 ---
    // 세로 간격을 정하는 길이 둘. **`levelGap`을 주면 그쪽이 이긴다.**
    levelSeparation: 80,          // 층과 층의 **중심 사이** 거리
    levelGap: null,               // 위층 상자 아래끝과 아래층 상자 위끝의 **빈 틈**
    siblingGap: 20,               // 이웃 노드 사이에 최소로 띄울 가로 여백

    // --- 내용 ---
    label: (d) => String(d.id),
    nodeStyle: () => ({}),        // {fill, stroke, strokeWidth, textColor, fontWeight}
    linkStyle: () => ({}),        // {stroke, strokeWidth}
    edgeLabel: () => null,        // 링크 가운데 적을 글자
    edgeLabelColor: '#64748b',
    edgeLabelSize: 12,

    // --- 화살표 ---
    arrow: false,
    arrowColor: '#cbd5e1',

    // --- 화면 ---
    minScale: 0.05,
    maxScale: 4,
    fitPadding: 40,
    maxFitScale: 1.2,
    focusScale: 1.2,
    viewMode: 'fit',              // 'fit' | 'track' | 'free'
    duration: 250,
};

// **글자를 재는 자는 그래프 뷰와 함께 쓴다.** 상자 폭을 글자로 정하는 일은 두 뷰가 같다.

/**
 * 트리 뷰 하나를 만든다.
 *
 * @param {HTMLElement|string} container  그릴 자리. 문자열이면 CSS 선택자로 본다.
 * @param {object} options               위 DEFAULTS 참고
 * @returns {TreeView}
 */
export function createTreeView(container, options = {}) {
    return new TreeView(container, options);
}

export class TreeView {
    constructor(container, options = {}) {
        const el = typeof container === 'string' ? document.querySelector(container) : container;
        if (!el) throw new Error(`tree-view: 컨테이너를 찾지 못했다 — ${container}`);

        this.el = el;
        this.opt = {...DEFAULTS, ...options};
        this.root = null;                 // 부르는 쪽이 쥐고 있는 트리 객체
        this.viewMode = this.opt.viewMode;
        this.activeId = null;
        this._handlers = {nodeclick: []};
        this._sizes = new Map();          // id -> {w, h}

        // SVG는 컨테이너를 꽉 채운다. 컨테이너에 position 이 없으면 여기서 준다 —
        // 없으면 absolute 인 SVG 가 엉뚱한 조상에 붙는다.
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';

        select(el).selectAll('svg.tree-view').remove();

        this.svg = select(el).append('svg')
            .attr('class', 'tree-view')
            .attr('width', '100%')
            .attr('height', '100%')
            .style('position', 'absolute')
            .style('top', '0')
            .style('left', '0')
            .style('display', 'block')
            .style('cursor', 'grab');

        this.measurer = new TextMeasurer(this.svg.node());

        if (this.opt.arrow) this._defineArrow();

        this.g = this.svg.append('g');

        this.zoom = d3zoom()
            .scaleExtent([this.opt.minScale, this.opt.maxScale])
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

        this.layout = treeLayout()
            // nodeSize 의 가로를 1 로 두면 separation() 이 돌려주는 값이 곧 px 간격이 된다.
            // 폭이 제각각인 상자를 겹치지 않게 놓으려면 이 방법뿐이다.
            .nodeSize([1, this.opt.levelSeparation])
            .separation((a, b) => this._halfW(a) + this._halfW(b) + this.opt.siblingGap);

        this._observeResize();
    }

    /* ============================================================
       바깥에서 부르는 것들
       ============================================================ */

    /** 그릴 트리를 갈아 끼운다. `{id, children: []}` 꼴이면 된다. */
    setData(root) {
        this.root = root;
        this._sizes.clear();
        return this;
    }

    /** 화면을 다시 그린다. 데이터 객체를 고친 뒤 부른다. */
    update(duration = this.opt.duration) {
        if (!this.root) return this;

        const root = hierarchy(this.root);
        this._sizes.clear();
        this._layout(root);

        this._drawLinks(root, duration);
        this._drawEdgeLabels(root, duration);
        this._drawNodes(root, duration);

        if (this.viewMode === 'fit') this.fit(duration);
        else if (this.viewMode === 'track' && this.activeId != null) this.focus(this.activeId, duration);

        return this;
    }

    /** 트리 전체가 화면에 들어오도록 맞춘다. */
    fit(duration = 500) {
        const box = this._viewport();
        if (!box || !this.root) return this;

        const root = hierarchy(this.root);
        this._layout(root);

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        root.each(d => {
            const {w, h} = this._size(d);
            minX = Math.min(minX, d.x - w / 2);
            maxX = Math.max(maxX, d.x + w / 2);
            minY = Math.min(minY, d.y - h / 2);
            maxY = Math.max(maxY, d.y + h / 2);
        });

        if (!Number.isFinite(minX)) return this;

        const treeW = Math.max(maxX - minX, 1);
        const treeH = Math.max(maxY - minY, 1);
        const pad = box.width < 640 ? this.opt.fitPadding / 2 : this.opt.fitPadding;

        const scale = Math.min(
            (box.width - pad * 2) / treeW,
            (box.height - pad * 2) / treeH,
            this.opt.maxFitScale,
        );

        const tx = box.width / 2 - ((minX + maxX) / 2) * scale;
        const ty = pad - minY * scale;

        this._applyTransform(tx, ty, scale, duration);
        return this;
    }

    /** 특정 노드를 화면 가운데 위쪽에 놓는다. 탐색을 따라가며 볼 때 쓴다. */
    focus(id, duration = 500) {
        const box = this._viewport();
        if (!box || !this.root) return this;

        const root = hierarchy(this.root);
        this._layout(root);

        let target = null;
        root.each(d => {
            if (d.data.id === id) target = d;
        });
        if (!target) return this;

        const scale = this.opt.focusScale;
        const tx = box.width / 2 - target.x * scale;
        const ty = box.height / 3.5 - target.y * scale;

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

    /** 'track' 모드에서 따라갈 노드 */
    setActive(id) {
        this.activeId = id;
        return this;
    }

    /** 'nodeclick' | 'viewmode' */
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
        this.g.selectAll('*').remove();
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

    /**
     * 배치를 계산한다. `levelGap`을 준 뷰는 세로 자리를 다시 매긴다.
     *
     * `d3.tree()`의 층 간격은 **중심 사이 거리**라서, 상자가 높아지면 그만큼 틈이 줄어든다.
     * 여러 줄짜리 상자를 쓰는 트리에서는 **간선이 상자에 가려 안 보일 만큼** 좁아진다.
     * 그래서 층마다 가장 높은 상자를 찾아, **상자와 상자 사이의 빈 틈**이 늘 같도록 다시 매긴다.
     * 원처럼 크기가 일정한 노드만 쓰는 뷰는 `levelSeparation` 그대로 두면 되므로 건드리지 않는다.
     */
    _layout(root) {
        this.layout(root);
        if (!(this.opt.levelGap > 0)) return root;

        const maxH = [];
        root.each(d => {
            const h = this._size(d).h;
            if (!(maxH[d.depth] >= h)) maxH[d.depth] = h;
        });

        const yOf = [0];
        for (let i = 1; i < maxH.length; i++) {
            yOf[i] = yOf[i - 1] + maxH[i - 1] / 2 + this.opt.levelGap + maxH[i] / 2;
        }
        root.each(d => { d.y = yOf[d.depth]; });
        return root;
    }

    _viewport() {
        const width = this.el.clientWidth;
        const height = this.el.clientHeight;
        // 숨은 탭 안에서는 0이 나온다. 그 상태로 맞추면 배율이 터지므로 건너뛴다.
        if (!width || !height) return null;
        return {width, height};
    }

    _applyTransform(tx, ty, scale, duration) {
        const t = zoomIdentity.translate(tx, ty).scale(scale);
        duration = this._effDuration(duration);
        if (duration > 0) {
            // **여기에는 `interrupt`/`cancel` 핸들러를 달지 않는다.** 노드에는 `_move` 가
            // 그것을 다는데(끊겨도 끝값을 넣으려고), 화면 이동에 같은 것을 달면 무한 재귀에 빠진다 —
            // `zoom.transform` 이 안에서 `selection.interrupt()` 를 부르고, d3 는 **핸들러를 부른
            // 뒤에야** 스케줄을 지운다. 그래서 핸들러 안에서 `zoom.transform` 을 다시 부르면
            // 아직 안 지워진 같은 스케줄을 또 깨운다.
            //
            // 달 필요도 없다. 화면 이동은 끊겨도 다음 `fit`·`focus` 가 그 자리에서 이어받고,
            // 애니메이션이 아예 못 도는 경우(화면이 안 그려질 때)는 위에서 길이를 0으로 깎아
            // 곧바로 찍는다.
            this.svg.transition().duration(duration).call(this.zoom.transform, t);
        } else {
            this.svg.call(this.zoom.transform, t);
        }
    }

    /** 노드 하나가 차지하는 크기. 라벨을 재서 정하고 갱신 한 번 동안 캐시한다. */
    _size(d) {
        const id = d.data.id;
        const hit = this._sizes.get(id);
        if (hit) return hit;

        const shape = this.opt.shape(d.data);
        let size;

        if (shape === 'circle') {
            const r = this._radius(d.data);
            size = {w: r * 2, h: r * 2, r, shape};
        } else {
            const lines = this._lines(d.data);
            const style = this.opt.nodeStyle(d.data) || {};
            const fs = style.fontSize || this.opt.fontSize;
            const bold = style.fontWeight === 'bold' || style.fontWeight === 700;

            let textW = 0;
            for (const line of lines) {
                textW = Math.max(textW, this.measurer.width(line.text, fs, line.bold ?? bold));
            }

            const padX = shape === 'ellipse' ? this.opt.padX * 1.6 : this.opt.padX;
            const padY = shape === 'ellipse' ? this.opt.padY * 1.5 : this.opt.padY;

            const w = Math.max(textW + padX * 2, this.opt.minBoxWidth);
            const h = lines.length * fs * this.opt.lineHeight + padY * 2;
            size = {w, h, shape, lines, fontSize: fs};
        }

        this._sizes.set(id, size);
        return size;
    }

    _halfW(d) {
        return this._size(d).w / 2;
    }

    _halfH(d) {
        return this._size(d).h / 2;
    }

    _radius(data) {
        const r = this.opt.radius;
        return typeof r === 'function' ? r(data) : r;
    }

    /**
     * 라벨을 줄 단위로 푼다. 줄마다 `{text, bold}` 꼴로 맞춰 돌려준다.
     *
     * 부르는 쪽은 문자열('한 줄' 또는 줄바꿈이 든 여러 줄)이나 배열을 줄 수 있고,
     * 배열의 원소는 문자열이거나 `{text, bold}` 다. **줄마다 굵기를 달리 줄 수 있어야**
     * 「이름은 굵게, 값은 보통」인 상자를 그릴 수 있다.
     */
    _lines(data) {
        const label = this.opt.label(data);
        const raw = Array.isArray(label) ? label : String(label ?? '').split('\n');
        return raw.map(line => (
            line && typeof line === 'object'
                ? {text: String(line.text ?? ''), bold: !!line.bold}
                : {text: String(line ?? ''), bold: null}   // null = 노드 기본값을 따른다
        ));
    }

    /**
     * 속성 하나를 옮긴다. **트랜지션이 끊겨도 최종값은 반드시 들어간다.**
     *
     * d3 트랜지션은 다음 트랜지션에 밀리면 **끝값을 넣지 않고 버린다.** 탐색이 빠르게 돌면
     * 갱신 간격(15ms)이 화면 프레임(약 17ms)보다 짧아, 새 트랜지션이 한 번도 못 그린 채
     * 다음 것에 밀리는 일이 이어진다. 그러면 노드가 **처음 놓인 자리에 영영 멈춘다** —
     * 실제로 n-queen 이 그렇게 겹쳐 있었다. 밀릴 때 목표값을 그대로 찍어 그것을 막는다.
     *
     * **`interrupt` 와 `cancel` 을 둘 다 들어야 한다.** d3 는 이미 그리기 시작한 것만
     * `interrupt` 로 알리고, **시작도 못 한 채 밀린 것은 `cancel`** 로 알린다. 여기서 문제가
     * 되는 쪽은 후자다 — `interrupt` 만 듣고 있으면 아무것도 잡히지 않는다.
     */
    /**
     * 실제로 쓸 애니메이션 길이.
     *
     * **화면이 그려지지 않는 동안에는 0으로 깎는다.** 브라우저 탭이 뒤로 가 있으면
     * `requestAnimationFrame` 이 아예 안 돌고, d3 트랜지션은 그 위에 얹혀 있어 **시작도 끝도
     * 하지 못한 채 멈춘다.** 그 상태에서 자리를 트랜지션에 맡기면 노드가 처음 놓인 곳에
     * 굳어 서로 겹친다. 어차피 안 보이는 동안의 애니메이션은 값이 없으니 곧바로 찍는다.
     */
    _effDuration(duration) {
        if (typeof document !== 'undefined' && document.hidden) return 0;
        return duration;
    }

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

    _linkPath(s, t) {
        const y0 = s.y + this._halfH(s);
        const y1 = t.y - this._halfH(t) - (this.opt.arrow ? 8 : 0);
        const mid = (y0 + y1) / 2;
        // d3-shape 의 linkVertical() 과 같은 3차 베지에. 그 패키지를 받지 않으려고 직접 쓴다.
        return `M${s.x},${y0}C${s.x},${mid} ${t.x},${mid} ${t.x},${y1}`;
    }

    _defineArrow() {
        this.svg.append('defs').append('marker')
            .attr('id', 'tree-view-arrow')
            .attr('viewBox', '0 0 10 10')
            .attr('refX', 9).attr('refY', 5)
            .attr('markerWidth', 5).attr('markerHeight', 5)
            .attr('orient', 'auto-start-reverse')
            .append('path')
            .attr('d', 'M0,0 L10,5 L0,10 z')
            .attr('fill', this.opt.arrowColor);
    }

    _drawLinks(root, duration) {
        const key = d => d.target.data.id;
        const stroke = d => (this.opt.linkStyle(d.target.data, d.source.data) || {}).stroke || '#cbd5e1';
        const width = d => (this.opt.linkStyle(d.target.data, d.source.data) || {}).strokeWidth || 2;

        const links = this.g.selectAll('path.tv-link').data(root.links(), key);

        links.exit().remove();

        const entered = links.enter().insert('path', 'g.tv-node')
            .attr('class', 'tv-link')
            .attr('fill', 'none')
            // 새 링크는 부모 자리에서 자라나게 한다. 갑자기 튀어나오면 어디서 뻗었는지 안 보인다.
            .attr('d', d => this._linkPath(d.source, d.source));

        if (this.opt.arrow) entered.attr('marker-end', 'url(#tree-view-arrow)');

        const all = entered.merge(links);

        // 색과 굵기는 **곧바로** 넣는다. 트랜지션에 실으면 안 된다 — `_move` 주석 참고.
        all.attr('stroke', stroke).attr('stroke-width', width);

        this._move(all, 'd', d => this._linkPath(d.source, d.target), duration);
    }

    _drawEdgeLabels(root, duration) {
        const hasLabel = root.links().filter(d => this.opt.edgeLabel(d.target.data, d.source.data));
        const sel = this.g.selectAll('text.tv-edge-label')
            .data(hasLabel, d => d.target.data.id);

        sel.exit().remove();

        sel.enter().append('text')
            .attr('class', 'tv-edge-label')
            .attr('text-anchor', 'middle')
            .attr('dy', '0.35em')
            .attr('font-size', this.opt.edgeLabelSize)
            .attr('font-weight', '700')
            .attr('fill', this.opt.edgeLabelColor)
            .attr('x', d => d.source.x)
            .attr('y', d => d.source.y)
            .merge(sel)
            .text(d => this.opt.edgeLabel(d.target.data, d.source.data));

        // 자리만 옮긴다 — 글자는 위에서 곧바로 넣었다.
        const all = this.g.selectAll('text.tv-edge-label');
        this._move(all, 'x', d => (d.source.x + d.target.x) / 2, duration);
        this._move(all, 'y',
            d => (d.source.y + this._halfH(d.source) + d.target.y - this._halfH(d.target)) / 2, duration);
    }

    _drawNodes(root, duration) {
        const nodes = this.g.selectAll('g.tv-node').data(root.descendants(), d => d.data.id);

        nodes.exit().remove();

        const enter = nodes.enter().append('g')
            .attr('class', 'tv-node')
            .attr('transform', d => {
                const from = d.parent || d;
                return `translate(${from.x},${from.y})`;
            })
            .style('cursor', this._handlers.nodeclick.length ? 'pointer' : null)
            .on('click', (event, d) => this._emit('nodeclick', d.data.id, d.data, event));

        // 모양은 노드마다 다를 수 있으므로 들어올 때 그 모양의 도형을 하나 만든다.
        enter.each((d, i, g) => {
            const {shape} = this._size(d);
            const node = select(g[i]);
            if (shape === 'circle') node.append('circle').attr('class', 'tv-shape');
            else if (shape === 'ellipse') node.append('ellipse').attr('class', 'tv-shape');
            else node.append('rect').attr('class', 'tv-shape');
        });

        const all = enter.merge(nodes);

        // **움직임만 트랜지션에 싣는다.** 크기와 색은 아래에서 곧바로 넣는다 —
        // 트랜지션에 실으면 끊겼을 때 통째로 사라진다(`_move` 주석).
        this._move(all, 'transform', d => `translate(${d.x},${d.y})`, duration);

        all.each((d, i, g) => {
            const node = select(g[i]);
            const size = this._size(d);
            const style = this.opt.nodeStyle(d.data) || {};

            const shape = node.select('.tv-shape')
                .attr('fill', style.fill || '#ffffff')
                .attr('stroke', style.stroke || '#cbd5e1')
                .attr('stroke-width', style.strokeWidth || 2);

            if (size.shape === 'circle') {
                shape.attr('r', size.r);
            } else if (size.shape === 'ellipse') {
                shape.attr('rx', size.w / 2).attr('ry', size.h / 2);
            } else {
                shape.attr('x', -size.w / 2).attr('y', -size.h / 2)
                    .attr('width', size.w).attr('height', size.h)
                    .attr('rx', this.opt.boxRadius);
            }

            this._drawLabel(node, d, size, style);
        });
    }

    _drawLabel(node, d, size, style) {
        const lines = size.lines || this._lines(d.data);
        const fs = size.fontSize || style.fontSize || this.opt.fontSize;
        const color = style.textColor || '#1e293b';
        const step = fs * this.opt.lineHeight;
        // 여러 줄이면 가운데를 기준으로 위아래로 펼친다.
        const top = -((lines.length - 1) * step) / 2;

        const texts = node.selectAll('text.tv-label').data(lines);

        texts.exit().remove();

        texts.enter().append('text')
            .attr('class', 'tv-label')
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
     * 컨테이너 크기가 바뀌면 화면을 다시 맞춘다.
     *
     * 탭을 켜거나 전체 화면에 들어갈 때 컨테이너가 커지는데, 그때 다시 맞추지 않으면
     * 트리가 구석에 조그맣게 남는다. 부르는 쪽마다 손으로 걸게 하면 빠뜨리므로 여기서 본다.
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

export default createTreeView;
