/* 힙의 그림 — **트리와 배열을 나란히 두고 같은 색으로 묶는다.**
 *
 * 힙에서 학생이 가져가야 하는 것은 「부모가 자식보다 크다」가 아니라
 * **「이 트리에는 링크가 하나도 없다」**이다. 힙은 평범한 배열이고, 부모와 자식은
 * 자리 번호 계산(`(i−1)/2`, `2i+1`)으로만 이어져 있다. 트리만 그리면 학생은
 * 링크가 있다고 여기고, 배열만 그리면 왜 자리 번호가 그렇게 뛰는지 알 수 없다.
 * **둘을 잇는 것 자체가 수업 내용**이라 한 화면에 함께 둔다.
 *
 * 배열 줄은 새로 그리지 않고 `ds-view-cells.js`에 맡긴다 — 선형 자료구조 페이지에서
 * 쓰는 바로 그 그림이라, 두 벌을 만들면 「같은 배열이다」가 흐려진다.
 */

import {createDsCellsView, DS_COLORS} from './ds-view-cells.js';
import {svgEl} from './svg.js';

/* **파일 안에서만 쓰는 상수에도 앞머리를 붙인다.** 검사 받침대(`tools/_sim-harness.mjs`)는
   모듈을 한 자리에 모아 돌리므로, 트리 그림과 힙 그림이 같은 페이지에 함께 실리면
   `const R` 같은 이름이 두 번 선언되어 **페이지가 통째로 죽는다.** 묶는 도구는 이름을
   알아서 바꿔 주지만 받침대는 그러지 않는다 — 그리고 우리가 화면을 확인하는 것은
   받침대 쪽이다. */
const HEAP_R = 20;
const HEAP_LEVEL = 66;
const HEAP_TOP = 34;
const HEAP_SCALE_FLOOR = 0.66;
const HEAP_VALUE_FONT_PX = 15;
const HEAP_INDEX_FONT_PX = 12;

const heapLevelOf = (i) => Math.floor(Math.log2(i + 1));

export function createTreeHeapView(host) {
    host.textContent = '';

    const scroller = document.createElement('div');
    Object.assign(scroller.style, {width: '100%', overflowX: 'auto', overflowY: 'hidden', marginBottom: '10px'});
    const arrayHost = document.createElement('div');
    const banner = document.createElement('div');
    Object.assign(banner.style, {
        fontWeight: '700', color: '#9f1239', background: '#fff1f2',
        border: '1px solid #fecdd3', borderRadius: '8px',
        padding: '8px 12px', marginTop: '10px', display: 'none',
    });
    host.appendChild(scroller);
    host.appendChild(arrayHost);
    host.appendChild(banner);

    const arr = createDsCellsView(arrayHost, {layout: 'row'});

    let svg = null;
    let gIndex = null;
    let gEdges = null;
    let items = new Map();   // id → {g, circle, label, last}
    let cap = 15;
    let levels = 4;
    let vbW = 520;
    let vbH = 300;

    /** 자리 `i`의 화면 좌표. **자리 번호가 곧 자리다** — 링크가 없다는 뜻이다. */
    function xy(i) {
        const L = heapLevelOf(i);
        const posInLevel = i - (Math.pow(2, L) - 1);
        return {
            x: (vbW * (posInLevel + 0.5)) / Math.pow(2, L),
            y: HEAP_TOP + L * HEAP_LEVEL,
        };
    }

    function build(frames) {
        scroller.textContent = '';
        items = new Map();
        const st = frames[0].state;
        cap = st.cap;
        levels = heapLevelOf(cap - 1) + 1;
        vbW = Math.max(420, Math.pow(2, levels - 1) * 62);
        vbH = HEAP_TOP + (levels - 1) * HEAP_LEVEL + HEAP_R + 20;

        svg = svgEl('svg', {
            viewBox: `0 0 ${vbW} ${vbH}`,
            style: `width:100%;height:auto;display:block;margin:0 auto;`
                + `max-width:${vbW}px;min-width:${Math.round(vbW * HEAP_SCALE_FLOOR)}px`,
        });
        gEdges = svgEl('g', {});
        gIndex = svgEl('g', {'text-anchor': 'middle', 'font-weight': 700, fill: '#94a3b8'});
        svg.appendChild(gEdges);

        const seen = new Map();
        for (const f of frames) {
            for (const it of f.state.slots) if (it && !seen.has(it.id)) seen.set(it.id, it);
        }
        for (const [id, it] of seen) {
            const g = svgEl('g', {});
            const circle = svgEl('circle', {
                cx: 0, cy: 0, r: HEAP_R,
                fill: DS_COLORS.idle.bg, stroke: DS_COLORS.idle.line, 'stroke-width': 2,
            });
            const label = svgEl('text', {
                x: 0, y: 5, 'text-anchor': 'middle',
                fill: DS_COLORS.idle.text, 'font-weight': 800,
            });
            label.textContent = String(it.v);
            g.appendChild(circle);
            g.appendChild(label);
            svg.appendChild(g);
            items.set(id, {g, circle, label, last: {}});
        }

        /* **마디마다 배열 자리를 적어 둔다.** 트리와 배열을 잇는 것이 이 그림의 요점인데,
           번호가 없으면 「어느 마디가 몇 번 칸인가」를 눈으로 셀 수밖에 없다. */
        for (let i = 0; i < cap; i++) {
            const p = xy(i);
            const t = svgEl('text', {x: p.x, y: p.y - HEAP_R - 5});
            t.textContent = String(i);
            gIndex.appendChild(t);
        }
        svg.appendChild(gIndex);
        scroller.appendChild(svg);
    }

    function put(rec, el, name, value) {
        const key = name + '@' + (el === rec.g ? 'g' : 'c');
        if (rec.last[key] === value) return;
        rec.last[key] = value;
        if (name === 'transform' || name === 'transition') el.style[name] = value;
        else el.setAttribute(name, value);
    }

    return {
        setup(frames) {
            build(frames);
            arr.setup(frames);
        },

        render(frame, prev, o = {}) {
            arr.render(frame, prev, o);
            if (!svg) return;

            const st = frame.state;
            const m = frame.marks;
            const focus = new Set(m.focus);
            const moving = new Set(m.moving);

            const scale = (svg.clientWidth || vbW) / vbW;
            const valueFont = Math.round(HEAP_VALUE_FONT_PX / scale);
            gIndex.setAttribute('font-size', Math.round(HEAP_INDEX_FONT_PX / scale));

            // 가지 — **자리 번호로 이어 그린다.** 링크를 읽는 것이 아니다.
            gEdges.textContent = '';
            for (let i = 1; i < st.size; i++) {
                const p = xy(Math.floor((i - 1) / 2));
                const c = xy(i);
                gEdges.appendChild(svgEl('line', {
                    x1: p.x, y1: p.y + HEAP_R, x2: c.x, y2: c.y - HEAP_R,
                    stroke: '#94a3b8', 'stroke-width': 2,
                }));
            }

            const at = new Map();
            st.slots.forEach((it, i) => { if (it && i < st.size) at.set(it.id, i); });

            for (const [id, rec] of items) {
                const i = at.get(id);
                if (i === undefined) {
                    put(rec, rec.g, 'opacity', '0');
                    continue;
                }
                const tone = moving.has(i) ? DS_COLORS.moving
                    : focus.has(i) ? DS_COLORS.focus
                        : DS_COLORS.idle;
                const p = xy(i);
                put(rec, rec.g, 'opacity', '1');
                put(rec, rec.circle, 'fill', tone.bg);
                put(rec, rec.circle, 'stroke', tone.line);
                rec.label.setAttribute('fill', tone.text);
                rec.label.setAttribute('font-size', valueFont);
                put(rec, rec.g, 'transition', o.animate ? `transform ${o.ms}ms ease` : 'none');
                put(rec, rec.g, 'transform', `translate(${p.x}px, ${p.y}px)`);
            }

            // 아직 안 쓴 자리의 번호는 흐리게 — 트리가 어디까지 찼는지가 보여야 한다.
            [...gIndex.children].forEach((t, i) => {
                t.setAttribute('opacity', i < st.size ? '1' : '0.3');
            });

            if (m.banner) {
                banner.style.display = 'block';
                banner.textContent = m.banner.replace(/\*\*/g, '');
            } else {
                banner.style.display = 'none';
            }
        },

        resize() { arr.resize(); },
    };
}
