/* 힙 정렬 전용 그림 — **트리와 배열을 나란히 두고 같은 색으로 묶는다.**
 *
 * 힙 정렬에서 학생이 가져가야 하는 것은 정렬 절차가 아니라
 * 「이 1차원 배열이 사실은 완전 이진 트리다」이다. 그래서 둘을 따로 보여 주면 안 된다 —
 * 트리만 보면 그것이 배열이라는 것을 놓치고, 배열만 보면 인덱스가 왜 2i+1로
 * 껑충 뛰는지 알 수 없다. **둘을 잇는 것 자체가 수업 내용**이라 한 화면에 함께 둔다.
 *
 * 막대는 새로 그리지 않고 `sort-view-array.js`에 맡긴다. 트리만 얹는다.
 */

import {createSortArrayView, SORT_COLORS} from './sort-view-array.js';

/** 이보다 많으면 트리를 그리지 않는다. 5층이 넘으면 노드가 글자보다 좁아져 아무것도 안 보인다. */
export const HEAP_TREE_MAX_N = 31;

const SVG_NS = 'http://www.w3.org/2000/svg';
const LEVEL_H = 76;

/* **SVG 글자는 그리는 폭에 비례해 줄어든다.** viewBox 720짜리를 405px에 그리면
   배율이 0.5625가 되어 `font-size="12"`가 화면에서 **6.75px**로 앉는다 — 읽을 수가 없다.
   막을 길은 둘뿐이다.

     1. **그리는 폭에 바닥을 둔다.** 아래로는 줄지 않게 하고, 좁으면 상자 안에서
        가로로 스크롤한다(페이지가 넘치는 것과 다르다).
     2. **배율의 역수를 글자에 곱한다.** 그러면 화면 글자 크기가 폭과 상관없이 일정하다.
        도형은 그대로 비례해 줄어야 하므로 글자에만 건다.

   둘 다 한다. 1만 하면 넓은 화면에서 글자가 커지고, 2만 하면 노드 동그라미가
   글자보다 작아진다. */
const TREE_SCALE_FLOOR = 0.62;
const NODE_FONT_PX = 14;
const INDEX_FONT_PX = 11;

function svgEl(tag, attrs) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
}

const levelOf = (i) => Math.floor(Math.log2(i + 1));

export function createSortHeapView(host) {
    host.textContent = '';

    const treeBox = document.createElement('div');
    /* 좁은 화면에서는 **이 상자 안에서** 가로로 스크롤한다. 페이지가 통째로 넘치는 것과
       다르다 — 넘침을 그림 상자가 받아 내므로 본문은 375px 안에 그대로 있다. */
    Object.assign(treeBox.style, {width: '100%', marginBottom: '10px', overflowX: 'auto'});
    const note = document.createElement('div');
    Object.assign(note.style, {
        fontWeight: '600', color: '#64748b', padding: '10px 0', display: 'none',
    });
    const arrayHost = document.createElement('div');
    host.appendChild(treeBox);
    host.appendChild(note);
    host.appendChild(arrayHost);

    const arr = createSortArrayView(arrayHost);

    let n = 0;
    let svg = null;
    let treeW = 0;
    let gValue = null;     // 값 글자를 모아 둔 그룹. 크기를 여기 한 번만 건다
    let gIndex = null;     // 배열 인덱스
    let nodes = [];        // 자리별 {circle, label, index}

    function buildTree() {
        treeBox.textContent = '';
        nodes = [];
        svg = null;
        if (n > HEAP_TREE_MAX_N) {
            note.style.display = 'block';
            note.textContent = `원소가 ${n}개라 트리는 그리지 않습니다`
                + `(${HEAP_TREE_MAX_N}개까지). 트리와 배열이 같은 것이라는 점은`
                + ` 개수를 줄여 확인해 보세요.`;
            return;
        }
        note.style.display = 'none';

        const levels = levelOf(n - 1) + 1;
        /* **맨 위 노드의 인덱스가 들어갈 자리를 남긴다.** 번호는 동그라미 위에 적는데,
           첫 층을 상자 맨 위 가까이 두었더니 그 글자만 상자 밖으로 잘려
           **루트 노드에만 번호가 없었다.** 트리와 배열을 잇는 것이 이 그림의 요점인데
           하필 0번이 빠진 셈이다. */
        const height = levels * LEVEL_H + 42;
        /* 층수에 맞춰 그림 폭을 정한다. 노드 하나에 90은 줘야 두 자리 숫자가 들어간다.
           층이 적은데 폭만 넓으면 동그라미들이 허허벌판에 흩어진다. */
        treeW = Math.min(720, Math.max(300, Math.pow(2, levels - 1) * 90));
        const cell = treeW / Math.pow(2, levels - 1);
        const r = Math.min(26, cell * 0.42);

        svg = svgEl('svg', {
            viewBox: `0 0 ${treeW} ${height}`,
            /* 폭 천장·바닥·가운데 정렬을 함께 준다. 천장이 없으면 넓은 화면에서 도형만
               과하게 커지고, 바닥이 없으면 좁은 화면에서 노드가 글자보다 작아지며,
               정렬이 없으면 좁아진 그림이 왼쪽에 붙는다. */
            style: `width:100%;height:auto;display:block;margin:0 auto;`
                + `max-width:${treeW}px;min-width:${Math.round(treeW * TREE_SCALE_FLOOR)}px`,
        });

        const at = (i) => {
            const L = levelOf(i);
            const pos = i - (Math.pow(2, L) - 1);
            return {x: (treeW * (pos + 0.5)) / Math.pow(2, L), y: 52 + L * LEVEL_H};
        };

        // 선을 먼저 깔아야 노드 뒤로 간다
        for (let i = 1; i < n; i++) {
            const p = at(Math.floor((i - 1) / 2));
            const c = at(i);
            svg.appendChild(svgEl('line', {
                x1: p.x, y1: p.y, x2: c.x, y2: c.y,
                stroke: '#cbd5e1', 'stroke-width': 2,
            }));
        }

        gValue = svgEl('g', {'text-anchor': 'middle', 'font-weight': 800});
        gIndex = svgEl('g', {'text-anchor': 'middle', 'font-weight': 700, fill: '#94a3b8'});

        for (let i = 0; i < n; i++) {
            const p = at(i);
            const circle = svgEl('circle', {
                cx: p.x, cy: p.y, r,
                fill: SORT_COLORS.idle.bg, stroke: SORT_COLORS.idle.bar, 'stroke-width': 2,
            });
            const label = svgEl('text', {
                x: p.x, y: p.y + r * 0.34,
                fill: SORT_COLORS.idle.text,
            });
            /* **노드마다 배열 자리를 적어 둔다.** 트리와 배열을 잇는 것이 이 그림의 요점인데,
               번호가 없으면 「어느 노드가 몇 번 칸인가」를 눈으로 셀 수밖에 없다. */
            const index = svgEl('text', {x: p.x, y: p.y - r - 5});
            index.textContent = String(i);
            svg.appendChild(circle);
            gValue.appendChild(label);
            gIndex.appendChild(index);
            nodes.push({circle, label, index});
        }

        svg.appendChild(gValue);
        svg.appendChild(gIndex);
        treeBox.appendChild(svg);
    }

    function paintTree(frame) {
        if (!svg) return;

        /* **배율을 그릴 때마다 다시 측정하고 글자에 역수를 곱한다.** 한 번 측정해 굳혀 두면
           창을 줄였을 때 그 값이 낡는다. 그룹(`<g>`)에 한 번만 걸면 노드마다 쓰지 않아도 된다. */
        // 1을 넘지 않게 눌러 둔다 — 커질 때는 글자도 함께 커져야 한다.
        const scale = Math.min(1, (svg.clientWidth || treeW) / treeW);
        gValue.setAttribute('font-size', Math.round(NODE_FONT_PX / scale));
        gIndex.setAttribute('font-size', Math.round(INDEX_FONT_PX / scale));
        const marks = frame.marks;
        const cmp = new Set((marks.compare || []).filter((x) => x !== null));
        const moving = new Set(marks.moving);
        const done = new Set(marks.done);

        /* 힙에 남은 구간은 알고리즘이 알려 준다. 뷰가 `done`의 개수로 짐작하면
           힙을 만드는 동안(아직 확정이 하나도 없을 때)과 구별되지 않는다. */
        const band = (frame.ranges || []).find((r) => r.state === 'heap');
        const heapSize = band ? band.hi + 1 : (done.size >= n ? 0 : n);

        for (let i = 0; i < n; i++) {
            const item = frame.a[i];
            const node = nodes[i];
            let tone = SORT_COLORS.idle;
            if (moving.has(i)) tone = SORT_COLORS.moving;
            else if (cmp.has(i)) tone = SORT_COLORS.compare;
            else if (done.has(i)) tone = SORT_COLORS.done;

            node.circle.setAttribute('fill', tone.bg);
            node.circle.setAttribute('stroke', tone.bar);
            node.label.setAttribute('fill', tone.text);
            node.label.textContent = item ? String(item.v) : '';

            /* **힙에서 빠져나간 노드는 흐리게 둔다.** 지우면 트리 모양이 무너져
               「완전 이진 트리」라는 그림 자체가 사라지고, 그대로 두면 아직 힙에
               속한 것처럼 보인다. 남기되 물러나 있게 한다. */
            const out = i >= heapSize;
            node.circle.setAttribute('opacity', out ? 0.35 : 1);
            node.label.setAttribute('opacity', out ? 0.35 : 1);
            node.index.setAttribute('opacity', out ? 0.35 : 1);
        }
    }

    return {
        setup(frames) {
            n = ((frames[0] && frames[0].a) || []).length;
            arr.setup(frames);
            buildTree();
        },
        render(frame, prev, opts) {
            arr.render(frame, prev, opts);
            paintTree(frame);
        },
        setHeight(px) { arr.setHeight(px); },
    };
}
