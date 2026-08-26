/* 비용 비교의 그림 — **두 트리를 위아래로 나란히 놓는다.**
 *
 * 그림 자체는 새로 그리지 않고 트리 그림에 맡긴다. 여기서는 줄을 나누고
 * **높이와 작업량을 옆에 적는 일**만 한다.
 *
 * **높이를 크게 적어 둔다.** 이 탭에서 비교하는 것이 결국 높이이기 때문이다 —
 * 작업량 숫자만 있으면 「왜 그만큼 들었는가」가 그림과 이어지지 않는다.
 */

import {createTreeLinkedView} from './tree-view-linked.js';
import {treeWorkOf} from './tree-compare.js';

function box(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

const LANE = {
    bst: {name: '이진 탐색 트리', tone: '#1d4ed8'},
    avl: {name: 'AVL 트리', tone: '#7c3aed'},
};

export function createTreeCompareView(host) {
    host.textContent = '';

    const lanes = [];
    for (const kind of ['bst', 'avl']) {
        const wrap = box('div', {
            border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '10px 12px', marginBottom: '12px', background: '#fff',
        });
        const head = box('div', {
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '10px', marginBottom: '6px',
        });
        const title = box('span', {
            fontWeight: '900', color: LANE[kind].tone, fontSize: '15px',
        }, LANE[kind].name);
        const height = box('span', {
            fontWeight: '900', color: '#0f172a', fontSize: '15px',
            fontVariantNumeric: 'tabular-nums',
        });
        const tally = box('span', {
            fontWeight: '700', color: '#475569', fontVariantNumeric: 'tabular-nums',
        });
        const badge = box('span', {
            fontWeight: '800', color: '#065f46', background: '#d1fae5',
            border: '1px solid #6ee7b7', borderRadius: '9999px',
            padding: '1px 10px', display: 'none',
        }, '끝');
        head.appendChild(title);
        head.appendChild(height);
        head.appendChild(tally);
        head.appendChild(badge);
        const stage = box('div', {});
        wrap.appendChild(head);
        wrap.appendChild(stage);
        host.appendChild(wrap);

        lanes.push({
            kind, height, tally, badge,
            view: createTreeLinkedView(stage, {showBalance: kind === 'avl'}),
        });
    }

    const tableNote = box('p', {
        fontWeight: '700', color: '#0f172a', margin: '4px 0 6px',
    }, '개수를 키워 가며 측정한 트리 높이');
    const tableWrap = box('div', {width: '100%', overflowX: 'auto'});
    const table = document.createElement('table');
    Object.assign(table.style, {width: '100%', borderCollapse: 'collapse', minWidth: '480px'});
    tableWrap.appendChild(table);
    host.appendChild(tableNote);
    host.appendChild(tableWrap);

    function paintTable(measured) {
        table.textContent = '';
        const head = document.createElement('tr');
        for (const label of ['넣는 순서', '트리', ...measured.sizes.map((n) => `${n}개`)]) {
            const th = document.createElement('th');
            Object.assign(th.style, {
                textAlign: label.endsWith('개') ? 'right' : 'left',
                padding: '6px 8px', borderBottom: '2px solid #cbd5e1',
                fontWeight: '800', color: '#475569', whiteSpace: 'nowrap',
            });
            th.textContent = label;
            head.appendChild(th);
        }
        table.appendChild(head);

        for (const row of measured.rows) {
            for (const kind of ['bst', 'avl']) {
                const tr = document.createElement('tr');
                if (kind === 'bst') {
                    const td = document.createElement('td');
                    Object.assign(td.style, {
                        padding: '6px 8px', fontWeight: '800', color: '#0f172a',
                        borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                    });
                    td.rowSpan = 2;
                    td.textContent = row.orderName;
                    tr.appendChild(td);
                }
                const who = document.createElement('td');
                Object.assign(who.style, {
                    padding: '6px 8px', fontWeight: '700', color: LANE[kind].tone,
                    borderBottom: kind === 'avl' ? '1px solid #e2e8f0' : 'none',
                    whiteSpace: 'nowrap',
                });
                who.textContent = kind === 'bst' ? '이진 탐색' : 'AVL';
                tr.appendChild(who);

                for (let k = 0; k < measured.sizes.length; k++) {
                    const mine = row[kind][k];
                    const other = row[kind === 'bst' ? 'avl' : 'bst'][k];
                    const td = document.createElement('td');
                    Object.assign(td.style, {
                        padding: '6px 8px', textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: mine < other ? '900' : '600',
                        color: mine < other ? '#065f46' : '#475569',
                        borderBottom: kind === 'avl' ? '1px solid #e2e8f0' : 'none',
                    });
                    td.textContent = String(mine);
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
        }
    }

    return {
        setup(frames, measured) {
            for (let k = 0; k < lanes.length; k++) {
                lanes[k].view.setup(frames.map((f) => f.lanes[k].frame));
            }
            if (measured) paintTable(measured);
        },

        render(frame, prev, o = {}) {
            for (let k = 0; k < lanes.length; k++) {
                const lane = frame.lanes[k];
                lanes[k].view.render(lane.frame, prev ? prev.lanes[k].frame : null, o);
                const c = lane.frame.counts;
                lanes[k].height.textContent = `높이 ${lane.height}`;
                lanes[k].tally.textContent =
                    `비교 ${c.compare} · 이동 ${c.move} · 링크 ${c.link}`
                    + `  →  작업량 ${treeWorkOf(c)}`;
                lanes[k].badge.style.display = lane.done ? 'inline-block' : 'none';
            }
        },

        resize() { for (const lane of lanes) lane.view.resize(); },
    };
}
