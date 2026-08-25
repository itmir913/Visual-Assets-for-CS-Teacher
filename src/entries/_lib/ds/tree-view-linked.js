/* 링크로 이은 트리의 그림 — 이진 탐색 트리와 AVL 트리.
 *
 * **자리는 트리 «모양»에서 나온다.** 중위 순회 차례가 가로 자리, 깊이가 세로 자리다.
 * 이렇게 두면 왼쪽 자식은 반드시 왼쪽에, 오른쪽 자식은 반드시 오른쪽에 그려진다 —
 * 「왼쪽은 작고 오른쪽은 크다」가 **배치 자체로** 지켜지므로 그림이 규칙을 어길 수 없다.
 *
 * **회전은 움직여 그린다.** AVL에서 학생이 가져가야 하는 것은 「돌린다」는 말이 아니라
 * 마디들이 실제로 자리를 바꾸며 **높이가 줄어드는 장면**이다. 정적인 그림 두 장으로는
 * 무엇이 어디로 갔는지 따라갈 수 없다. 그래서 마디마다 무리(`<g>`)를 하나씩 두고
 * 자리만 바꾼다 — 지웠다 다시 그리면 움직임이 사라진다.
 */

import {svgEl} from './svg.js';

const R = 21;            // 마디 반지름
const SLOT = 62;         // 중위 차례 한 칸의 가로 폭
const LEVEL = 74;        // 한 층의 세로 폭
const TOP = 42;
const PAD_X = 26;
const FLOAT_GAP = 60;    // 아직 매달리지 않은 마디를 얼마나 아래에 둘지

const SCALE_FLOOR = 0.66;
const VALUE_FONT_PX = 15;
const SMALL_FONT_PX = 13;

export const TREE_TONES = {
    idle: {bg: '#bfdbfe', line: '#60a5fa', text: '#1e3a8a'},
    focus: {bg: '#fde68a', line: '#f59e0b', text: '#78350f'},
    moving: {bg: '#fecdd3', line: '#f43f5e', text: '#881337'},
    newborn: {bg: '#a7f3d0', line: '#10b981', text: '#064e3b'},
    doomed: {bg: '#e2e8f0', line: '#94a3b8', text: '#475569'},
};

/** 중위 차례와 깊이를 한꺼번에 구한다. **자리를 정하는 유일한 곳이다.** */
export function treeLayout(st) {
    const byId = new Map(st.nodes.map((n) => [n.id, n]));
    const pos = new Map();
    let order = 0;
    let deepest = 0;
    const walk = (id, depth) => {
        if (id === null || id === undefined) return;
        const nd = byId.get(id);
        if (!nd) return;
        walk(nd.left, depth + 1);
        pos.set(id, {col: order++, depth});
        deepest = Math.max(deepest, depth);
        walk(nd.right, depth + 1);
    };
    walk(st.root, 0);
    return {pos, cols: Math.max(1, order), levels: deepest + 1};
}

/**
 * @param {HTMLElement} host 그림이 들어갈 빈 상자
 * @param {object} opts `showBalance` — 균형 인수를 마디 옆에 적을지(AVL)
 */
export function createTreeLinkedView(host, opts = {}) {
    host.textContent = '';
    const showBalance = opts.showBalance === true;

    const scroller = document.createElement('div');
    Object.assign(scroller.style, {width: '100%', overflowX: 'auto', overflowY: 'hidden'});
    const emitted = document.createElement('div');
    Object.assign(emitted.style, {
        fontWeight: '800', color: '#0f172a', marginTop: '8px',
        fontVariantNumeric: 'tabular-nums', minHeight: '1.5em',
    });
    const banner = document.createElement('div');
    Object.assign(banner.style, {
        fontWeight: '700', color: '#9f1239', background: '#fff1f2',
        border: '1px solid #fecdd3', borderRadius: '8px',
        padding: '8px 12px', marginTop: '10px', display: 'none',
    });
    host.appendChild(scroller);
    host.appendChild(emitted);
    host.appendChild(banner);

    let svg = null;
    let gEdges = null;
    let gMarks = null;
    let nodes = new Map();   // id → {g, circle, label, tag, last}
    let vbW = 560;
    let vbH = 300;

    function build(frames) {
        scroller.textContent = '';
        nodes = new Map();

        /* **이 판에서 가장 넓고 가장 깊을 때에 맞춰 폭과 높이를 잡는다.**
           장마다 크기가 바뀌면 그림 상자가 늘었다 줄었다 하며 아래 단추가 움직인다. */
        let cols = 1;
        let levels = 1;
        for (const f of frames) {
            const L = treeLayout(f.state);
            cols = Math.max(cols, L.cols);
            levels = Math.max(levels, L.levels);
        }
        vbW = Math.max(420, PAD_X * 2 + cols * SLOT);
        vbH = TOP + (levels - 1) * LEVEL + FLOAT_GAP + R + 24;

        svg = svgEl('svg', {
            viewBox: `0 0 ${vbW} ${vbH}`,
            style: `width:100%;height:auto;display:block;margin:0 auto;`
                + `max-width:${vbW}px;min-width:${Math.round(vbW * SCALE_FLOOR)}px`,
        });
        gEdges = svgEl('g', {});
        gMarks = svgEl('g', {'font-weight': 700});
        svg.appendChild(gEdges);

        const seen = new Map();
        for (const f of frames) for (const nd of f.state.nodes) if (!seen.has(nd.id)) seen.set(nd.id, nd);
        for (const [id, nd] of seen) nodes.set(id, buildNode(nd));

        svg.appendChild(gMarks);
        scroller.appendChild(svg);
    }

    function buildNode(nd) {
        const g = svgEl('g', {});
        const circle = svgEl('circle', {
            cx: 0, cy: 0, r: R,
            fill: TREE_TONES.idle.bg, stroke: TREE_TONES.idle.line, 'stroke-width': 2,
        });
        const label = svgEl('text', {
            x: 0, y: 5, 'text-anchor': 'middle', fill: TREE_TONES.idle.text, 'font-weight': 800,
        });
        label.textContent = String(nd.v);
        /* 균형 인수는 **마디 오른쪽 위**에 붙인다. AVL에서 회전이 언제 일어나는지는
           이 수를 봐야만 알 수 있어, 없으면 회전이 갑자기 일어나는 것처럼 보인다. */
        const tag = svgEl('text', {
            x: R + 2, y: -R + 4, 'text-anchor': 'start', fill: '#7c3aed', 'font-weight': 800,
        });
        g.appendChild(circle);
        g.appendChild(label);
        if (showBalance) g.appendChild(tag);
        svg.appendChild(g);
        return {g, circle, label, tag, last: {}};
    }

    function put(rec, el, name, value) {
        const key = name + '@' + (el === rec.g ? 'g' : el === rec.circle ? 'c' : 't');
        if (rec.last[key] === value) return;
        rec.last[key] = value;
        if (name === 'transform' || name === 'transition') el.style[name] = value;
        else el.setAttribute(name, value);
    }

    const xy = (p) => ({x: PAD_X + (p.col + 0.5) * SLOT, y: TOP + p.depth * LEVEL});

    return {
        setup(frames) { build(frames); },

        render(frame, prev, o = {}) {
            if (!svg) return;
            const st = frame.state;
            const m = frame.marks;
            const focus = new Set(m.focus);
            const moving = new Set(m.moving);
            const {pos} = treeLayout(st);

            const scale = (svg.clientWidth || vbW) / vbW;
            const valueFont = Math.round(VALUE_FONT_PX / scale);
            const smallFont = Math.round(SMALL_FONT_PX / scale);
            gMarks.setAttribute('font-size', smallFont);

            /* 높이는 «지금 상태»에서 다시 잰다. 마디에 적힌 `height`를 믿으면
               높이를 아직 안 고친 중간 장에서 균형 인수가 엉뚱하게 나온다. */
            const byId = new Map(st.nodes.map((n) => [n.id, n]));
            const realH = new Map();
            const measure = (id) => {
                if (id === null || id === undefined) return 0;
                const nd = byId.get(id);
                if (!nd) return 0;
                const h = 1 + Math.max(measure(nd.left), measure(nd.right));
                realH.set(id, h);
                return h;
            };
            measure(st.root);

            // 가지를 먼저 깔아야 마디 뒤로 간다.
            gEdges.textContent = '';
            for (const nd of st.nodes) {
                const p = pos.get(nd.id);
                if (!p) continue;
                const a = xy(p);
                for (const side of ['left', 'right']) {
                    const cid = nd[side];
                    if (cid === null || cid === undefined) continue;
                    const cp = pos.get(cid);
                    if (!cp) continue;
                    const b = xy(cp);
                    const hot = m.linkFix.some((l) => l.from === nd.id && l.side === side);
                    gEdges.appendChild(svgEl('line', {
                        x1: a.x, y1: a.y + R, x2: b.x, y2: b.y - R,
                        stroke: hot ? '#e11d48' : '#94a3b8',
                        'stroke-width': hot ? 3.5 : 2,
                    }));
                }
            }

            gMarks.textContent = '';
            /* 뿌리 포인터. **비었을 때도 낸다** — 사라지면 「그림이 덜 그려졌다」로 읽힌다. */
            const rootPos = st.root !== null && st.root !== undefined ? pos.get(st.root) : null;
            const rootHot = m.linkFix.some((l) => l.from === null);
            const rx = rootPos ? xy(rootPos).x : PAD_X + SLOT / 2;
            const rootLabel = svgEl('text', {
                x: rx, y: 16, 'text-anchor': 'middle', fill: '#0f766e',
            });
            rootLabel.textContent = '뿌리';
            gMarks.appendChild(rootLabel);
            if (rootPos) {
                gEdges.appendChild(svgEl('line', {
                    x1: rx, y1: 22, x2: rx, y2: TOP - R - 2,
                    stroke: rootHot ? '#e11d48' : '#94a3b8', 'stroke-width': rootHot ? 3.5 : 2,
                }));
            } else {
                const none = svgEl('text', {x: rx, y: 40, 'text-anchor': 'middle', fill: '#94a3b8'});
                none.textContent = '∅';
                gMarks.appendChild(none);
            }

            /* **달릴 자리를 점선 동그라미로 미리 보여 준다.** 「여기가 빈자리입니다」를
               글로만 말하면 어디를 보라는 것인지 알 수 없다. */
            if (m.spot) {
                const pp = pos.get(m.spot.parent);
                if (pp) {
                    const a = xy(pp);
                    const dx = m.spot.side === 'left' ? -SLOT * 0.6 : SLOT * 0.6;
                    gMarks.appendChild(svgEl('circle', {
                        cx: a.x + dx, cy: a.y + LEVEL, r: R,
                        fill: 'none', stroke: '#10b981', 'stroke-width': 2, 'stroke-dasharray': '5 4',
                    }));
                }
            }

            let floatCount = 0;
            for (const [id, rec] of nodes) {
                const nd = byId.get(id);
                if (!nd) { put(rec, rec.g, 'opacity', '0'); continue; }
                const p = pos.get(id);

                let tone = TREE_TONES.idle;
                if (m.doomed === id) tone = TREE_TONES.doomed;
                else if (m.newborn === id) tone = TREE_TONES.newborn;
                else if (moving.has(id)) tone = TREE_TONES.moving;
                else if (focus.has(id)) tone = TREE_TONES.focus;

                put(rec, rec.g, 'opacity', '1');
                put(rec, rec.circle, 'fill', tone.bg);
                put(rec, rec.circle, 'stroke', tone.line);
                put(rec, rec.circle, 'stroke-dasharray', nd.floating || m.doomed === id ? '5 4' : 'none');
                rec.label.setAttribute('fill', tone.text);
                rec.label.setAttribute('font-size', valueFont);
                rec.label.textContent = String(nd.v);

                if (showBalance) {
                    rec.tag.setAttribute('font-size', smallFont);
                    if (p) {
                        const lh = nd.left === null ? 0 : (realH.get(nd.left) || 0);
                        const rh = nd.right === null ? 0 : (realH.get(nd.right) || 0);
                        const b = lh - rh;
                        rec.tag.textContent = b > 0 ? `+${b}` : String(b);
                        rec.tag.setAttribute('fill', Math.abs(b) > 1 ? '#e11d48' : '#7c3aed');
                    } else {
                        rec.tag.textContent = '';
                    }
                }

                /* 아직 매달리지 않은 마디는 **줄 아래에** 따로 띄운다. */
                const at = p ? xy(p) : {
                    x: PAD_X + (0.5 + floatCount++) * SLOT,
                    y: vbH - R - 12,
                };
                put(rec, rec.g, 'transition', o.animate ? `transform ${o.ms}ms ease` : 'none');
                put(rec, rec.g, 'transform', `translate(${at.x}px, ${at.y}px)`);
            }

            emitted.textContent = st.emitted.length
                ? `훑은 차례:  ${st.emitted.join('  ·  ')}`
                : '';

            if (m.banner) {
                banner.style.display = 'block';
                banner.textContent = m.banner.replace(/\*\*/g, '').replace(/`/g, '');
            } else {
                banner.style.display = 'none';
            }
        },

        resize() {},
    };
}
