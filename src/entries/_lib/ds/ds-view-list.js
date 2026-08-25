/* 마디로 담는 구조의 그림 — 단일 · 이중 연결 리스트, 그리고 그것으로 만든 스택 · 큐 · 덱.
 *
 * **마디를 「값 칸 + 링크 칸」으로 그린다.** 링크를 마디 밖의 화살표로만 그리면
 * 링크가 «마디 안에 들어 있는 값»이라는 것이 드러나지 않는다. 학생이 「다음 마디를
 * 가리키는 것도 결국 저장된 값 하나」임을 보아야 `p = p.next`가 무슨 말인지 선다.
 *
 * **비어 있는 링크에는 빗금을 친다.** 아무것도 안 그리면 「아직 안 그린 것」과
 * 「가리킬 것이 없는 것」이 구별되지 않는다.
 *
 * **마디를 늘어놓은 자리는 읽기 좋으라고 정한 것이지 메모리의 자리가 아니다.**
 * 그래서 넣고 뺄 때 다른 마디가 «미끄러지게» 그리지 않는다 — 미끄러지면 배열의
 * 「밀기」와 똑같아 보여, 이 페이지가 가르치려는 대비가 통째로 무너진다.
 * 움직여 그리는 것은 **새로 만든 마디가 줄에 들어앉는 순간 하나뿐**이다.
 */

import {DS_COLORS} from './ds-view-cells.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* 마디 하나의 크기. 두 자리 숫자와 링크 칸이 들어갈 만큼은 되어야 한다. */
const NH = 50;
const GAP = 46;
const ROW_Y = 82;        // 줄에 매달린 마디의 윗변
const FLOAT_Y = 168;     // 아직 매달리지 않은 마디
const PAD_X = 30;
const VB_H = 244;

/* **글자는 그리는 폭에 비례해 줄어든다.** 좁은 화면에서 배율이 내려가도 글자가
   읽히게 두 가지를 함께 한다 — 폭에 바닥을 두고(그 아래로는 상자 안에서 가로 스크롤),
   배율의 역수를 글자에 곱한다. 도형은 그대로 비례해 줄어야 하므로 글자에만 건다. */
const SCALE_FLOOR = 0.66;
const VALUE_FONT_PX = 15;
const SMALL_FONT_PX = 13;

let uid = 0;

function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
}

/**
 * @param {HTMLElement} host 그림이 들어갈 빈 상자
 */
export function createDsListView(host) {
    host.textContent = '';

    /* 좁은 화면에서는 **이 상자 안에서** 가로로 스크롤한다. 페이지가 통째로 넘치는 것과
       다르다 — 마디가 열 개면 아무리 줄여도 375px에 들어갈 수가 없다. */
    const scroller = document.createElement('div');
    Object.assign(scroller.style, {width: '100%', overflowX: 'auto', overflowY: 'hidden'});
    const banner = document.createElement('div');
    Object.assign(banner.style, {
        fontWeight: '700', color: '#9f1239', background: '#fff1f2',
        border: '1px solid #fecdd3', borderRadius: '8px',
        padding: '8px 12px', marginTop: '10px', display: 'none',
    });
    host.appendChild(scroller);
    host.appendChild(banner);

    let svg = null;
    let gLinks = null;      // 링크는 장마다 새로 그린다
    let gSmall = null;      // 이름표 글자
    let nodes = new Map();  // id → {g, rect, cells, label, last}
    let doubly = false;
    let vbW = 720;
    let nw = 96;            // 마디 폭. 이중이면 칸이 하나 더 붙는다
    let arrowId = '';
    let hotArrowId = '';

    /** 마디의 왼쪽 위 x. **자리는 프레임의 마디 차례가 정한다.** */
    const nodeX = (pos) => PAD_X + pos * (nw + GAP);

    /** 링크 칸의 가로 범위. 단일은 오른쪽 칸 하나, 이중은 양쪽 끝 칸. */
    function linkCell(dir) {
        const w = doubly ? 30 : 34;
        return dir === 'next' ? {x: nw - w, w} : {x: 0, w};
    }

    function buildNode(item) {
        const g = svgEl('g', {});
        const rect = svgEl('rect', {
            x: 0, y: 0, width: nw, height: NH, rx: 8,
            fill: DS_COLORS.idle.bg, stroke: DS_COLORS.idle.line, 'stroke-width': 2,
        });
        g.appendChild(rect);

        // 값 칸과 링크 칸을 가르는 선. **링크도 마디에 «담긴» 값이라는 표시다.**
        const seps = [];
        const nextCell = linkCell('next');
        seps.push(svgEl('line', {
            x1: nextCell.x, y1: 0, x2: nextCell.x, y2: NH,
            stroke: DS_COLORS.idle.line, 'stroke-width': 1.5,
        }));
        if (doubly) {
            const prevCell = linkCell('prev');
            seps.push(svgEl('line', {
                x1: prevCell.w, y1: 0, x2: prevCell.w, y2: NH,
                stroke: DS_COLORS.idle.line, 'stroke-width': 1.5,
            }));
        }
        for (const s of seps) g.appendChild(s);

        /* **값 글자를 마디 무리 «안»에 넣는다.** 밖에 두고 자리를 따로 옮기면,
           마디가 미끄러지는 동안 글자만 먼저 가 있어 상자와 글자가 따로 논다. */
        const valueX = doubly ? (linkCell('prev').w + linkCell('next').x) / 2 : linkCell('next').x / 2;
        const label = svgEl('text', {
            x: valueX, y: NH / 2 + 5, 'text-anchor': 'middle',
            fill: DS_COLORS.idle.text, 'font-weight': 800,
        });
        label.textContent = String(item.v);
        g.appendChild(label);

        svg.appendChild(g);
        return {g, rect, seps, label, last: {}};
    }

    function put(rec, el, name, value) {
        const key = name + '@' + (el === rec.g ? 'g' : 'r');
        if (rec.last[key] === value) return;
        rec.last[key] = value;
        if (name === 'transform' || name === 'transition') {
            el.style[name === 'transform' ? 'transform' : 'transition'] = value;
        } else {
            el.setAttribute(name, value);
        }
    }

    /** 화살표 하나. `hot`이면 방금 고쳐 쓴 링크다. */
    function arrow(d, {hot = false, dashed = false} = {}) {
        return svgEl('path', {
            d,
            fill: 'none',
            stroke: hot ? '#e11d48' : '#64748b',
            'stroke-width': hot ? 3 : 2,
            'stroke-dasharray': dashed ? '5 4' : 'none',
            'marker-end': `url(#${hot ? hotArrowId : arrowId})`,
        });
    }

    function build(frames) {
        scroller.textContent = '';
        nodes = new Map();
        uid += 1;
        arrowId = `ds-arrow-${uid}`;
        hotArrowId = `ds-arrow-hot-${uid}`;

        const first = frames[0].state;
        doubly = first.doubly === true;
        nw = doubly ? 116 : 96;

        /* 이 판에서 마디가 가장 많을 때에 맞춰 폭을 잡는다. 장마다 폭이 바뀌면
           그림 상자가 늘었다 줄었다 하며 **아래 단추가 아래위로 움직인다.** */
        let maxNodes = 1;
        for (const f of frames) maxNodes = Math.max(maxNodes, f.state.nodes.length);
        vbW = Math.max(560, PAD_X * 2 + maxNodes * (nw + GAP) - GAP);

        svg = svgEl('svg', {
            viewBox: `0 0 ${vbW} ${VB_H}`,
            style: `width:100%;height:auto;display:block;margin:0 auto;`
                + `max-width:${vbW}px;min-width:${Math.round(vbW * SCALE_FLOOR)}px`,
        });

        const defs = svgEl('defs');
        for (const [id, color] of [[arrowId, '#64748b'], [hotArrowId, '#e11d48']]) {
            const marker = svgEl('marker', {
                id, viewBox: '0 0 10 10', refX: 9, refY: 5,
                markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse',
            });
            marker.appendChild(svgEl('path', {d: 'M 0 0 L 10 5 L 0 10 z', fill: color}));
            defs.appendChild(marker);
        }
        svg.appendChild(defs);

        gLinks = svgEl('g', {});
        gSmall = svgEl('g', {'font-weight': 700});
        svg.appendChild(gLinks);

        // 이 판에 나오는 마디를 미리 다 만들어 둔다.
        const seen = new Map();
        for (const f of frames) {
            for (const nd of f.state.nodes) if (!seen.has(nd.id)) seen.set(nd.id, nd);
        }
        for (const [id, nd] of seen) nodes.set(id, buildNode(nd));

        svg.appendChild(gSmall);
        scroller.appendChild(svg);
    }

    /** 머리·꼬리 포인터와 커서 이름표. 장마다 새로 그린다. */
    function paintLabels(frame, posOf) {
        gSmall.textContent = '';
        const st = frame.state;
        const hot = frame.marks.linkFix.filter((l) => l.from === null);

        /* 머리와 꼬리가 **같은 마디를 가리키는 일이 흔하다**(마디가 하나일 때).
           같은 자리에 겹쳐 찍히지 않게 좌우로 조금 벌려 둔다. */
        const pointer = (name, targetId, dir, tone, dx) => {
            const pos = targetId !== null && targetId !== undefined ? posOf.get(targetId) : undefined;
            /* **가리킬 것이 없어도 이름표는 낸다.** 머리 포인터가 사라지면 학생은
               「비었다」가 아니라 「그림이 덜 그려졌다」로 읽는다. */
            const x = (pos === undefined ? PAD_X + nw / 2 : nodeX(pos) + nw / 2) + dx;
            const y = 26;
            const label = svgEl('text', {x, y, 'text-anchor': 'middle', fill: tone});
            label.textContent = name;
            gSmall.appendChild(label);

            const isHot = hot.some((l) => l.dir === dir);
            if (pos === undefined) {
                const slash = svgEl('text', {
                    x, y: y + 20, 'text-anchor': 'middle', fill: isHot ? '#e11d48' : '#94a3b8',
                });
                slash.textContent = '∅';
                gSmall.appendChild(slash);
            } else {
                const ty = st.nodes[pos].floating ? FLOAT_Y : ROW_Y;
                gLinks.appendChild(arrow(`M ${x} ${y + 8} L ${x} ${ty - 6}`, {hot: isHot}));
            }
        };

        pointer('head', st.head, 'next', '#0f766e', st.hasTail ? -22 : 0);
        if (st.hasTail) pointer('tail', st.tail, 'prev', '#b45309', 22);

        // 훑어가는 커서(p·q)는 마디 아래에 붙인다.
        for (const [name, id] of Object.entries(st.cursors)) {
            const pos = posOf.get(id);
            if (pos === undefined) continue;
            const nd = st.nodes[pos];
            const t = svgEl('text', {
                x: nodeX(pos) + nw / 2,
                y: (nd.floating ? FLOAT_Y : ROW_Y) + NH + 18,
                'text-anchor': 'middle',
                fill: '#0f172a',
            });
            t.textContent = name;
            gSmall.appendChild(t);
        }
    }

    function paintLinks(frame, posOf) {
        gLinks.textContent = '';
        const st = frame.state;
        const fixes = frame.marks.linkFix;

        for (let pos = 0; pos < st.nodes.length; pos++) {
            const nd = st.nodes[pos];
            const y0 = nd.floating ? FLOAT_Y : ROW_Y;

            for (const dir of doubly ? ['next', 'prev'] : ['next']) {
                const cell = linkCell(dir);
                const cx = nodeX(pos) + cell.x + cell.w / 2;
                const cy = y0 + (dir === 'next' ? NH * 0.34 : NH * 0.7);
                const targetId = nd[dir];
                const isHot = fixes.some((l) => l.from === nd.id && l.dir === dir);

                if (targetId === null || targetId === undefined) {
                    /* 빗금 — **가리킬 것이 없다**는 뜻. 안 그리면 「아직 안 그린 것」과
                       구별되지 않는다. */
                    gLinks.appendChild(svgEl('line', {
                        x1: nodeX(pos) + cell.x + 5, y1: y0 + NH - 6,
                        x2: nodeX(pos) + cell.x + cell.w - 5, y2: y0 + 6,
                        stroke: isHot ? '#e11d48' : '#94a3b8',
                        'stroke-width': isHot ? 3 : 2,
                    }));
                    continue;
                }

                const tp = posOf.get(targetId);
                if (tp === undefined) continue;
                const tNd = st.nodes[tp];
                const ty = (tNd.floating ? FLOAT_Y : ROW_Y) + NH / 2;
                const tx = tp > pos ? nodeX(tp) : nodeX(tp) + nw;
                /* 아직 매달리지 않은 마디를 가리키는 링크는 **구부려** 그린다.
                   곧게 그으면 다른 마디를 뚫고 지나간다. */
                const bend = Math.abs(ty - cy) > 20 || Math.abs(tp - pos) > 1;
                const d = bend
                    ? `M ${cx} ${cy} C ${cx} ${(cy + ty) / 2}, ${tx + (tp > pos ? -26 : 26)} ${ty}, ${tx} ${ty}`
                    : `M ${cx} ${cy} L ${tx} ${cy}`;
                gLinks.appendChild(arrow(d, {hot: isHot, dashed: st.nodes[pos].floating}));
            }
        }
    }

    return {
        setup(frames) {
            build(frames);
        },

        render(frame, prev, o = {}) {
            if (!svg) return;
            const st = frame.state;
            const m = frame.marks;
            const focus = new Set(m.focus);
            const moving = new Set(m.moving);

            /* **배율을 그릴 때마다 다시 재고 글자에 역수를 곱한다.** 한 번 재어 굳혀 두면
               창을 줄였을 때 그 값이 낡는다. 무리에 한 번만 걸면 마디마다 쓰지 않아도 된다. */
            const scale = (svg.clientWidth || vbW) / vbW;
            const valueFont = Math.round(VALUE_FONT_PX / scale);
            gSmall.setAttribute('font-size', Math.round(SMALL_FONT_PX / scale));

            const posOf = new Map();
            st.nodes.forEach((nd, i) => posOf.set(nd.id, i));

            for (const [id, rec] of nodes) {
                const pos = posOf.get(id);
                if (pos === undefined) {
                    put(rec, rec.g, 'opacity', '0');
                    continue;
                }
                const nd = st.nodes[pos];
                let tone = DS_COLORS.idle;
                if (m.doomed === id) tone = DS_COLORS.doomed;
                else if (m.newborn === id) tone = DS_COLORS.newborn;
                else if (moving.has(id)) tone = DS_COLORS.moving;
                else if (focus.has(id)) tone = DS_COLORS.focus;

                put(rec, rec.g, 'opacity', '1');
                put(rec, rec.rect, 'fill', tone.bg);
                put(rec, rec.rect, 'stroke', tone.line);
                put(rec, rec.rect, 'stroke-dasharray', nd.floating || m.doomed === id ? '6 4' : 'none');
                rec.label.setAttribute('fill', tone.text);
                for (const s of rec.seps) s.setAttribute('stroke', tone.line);

                /* **움직여 그리는 것은 줄에 들어앉는 마디 하나뿐이다.** 다른 마디까지
                   미끄러지게 하면 배열의 「밀기」와 똑같아 보인다 — 여기서는 아무것도
                   밀리지 않는다는 것이 요점이므로, 자리가 바뀌는 것은 소리 없이 바꾼다. */
                const animate = o.animate && moving.has(id);
                put(rec, rec.g, 'transition', animate ? `transform ${o.ms}ms ease` : 'none');
                put(rec, rec.g, 'transform',
                    `translate(${nodeX(pos)}px, ${nd.floating ? FLOAT_Y : ROW_Y}px)`);
                rec.label.setAttribute('font-size', valueFont);
            }

            paintLinks(frame, posOf);
            paintLabels(frame, posOf);

            if (m.banner) {
                banner.style.display = 'block';
                banner.textContent = m.banner.replace(/\*\*/g, '');
            } else {
                banner.style.display = 'none';
            }
        },

        resize() {},
    };
}
