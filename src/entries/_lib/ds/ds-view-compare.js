/* 비용 비교의 그림 — **두 구조를 위아래로 나란히 놓는다.**
 *
 * 그림 자체는 새로 그리지 않는다. 위 줄은 칸 그림에, 아래 줄은 마디 그림에 맡기고
 * 여기서는 **줄을 나누고 작업량을 옆에 적는 일**만 한다. 그림을 새로 그리면
 * 「같은 구조를 나란히 놓았을 뿐」이라는 것이 흐려지고, 두 벌이 되어 어긋나기 시작한다.
 *
 * **표는 개수를 키워 가며 잰 것이다.** 한 판을 넘겨서는 «지금 이 개수»의 값만 보이는데,
 * 정작 가르칠 것은 「개수가 늘면 어떻게 벌어지는가」다.
 */

import {createDsCellsView} from './ds-view-cells.js';
import {createDsListView} from './ds-view-list.js';
import {dsWorkOf} from './ds-compare.js';

function box(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

const LANE_TITLE = {
    array: {name: '배열', tone: '#1d4ed8'},
    list: {name: '단일 연결 리스트', tone: '#0f766e'},
};

export function createDsCompareView(host) {
    host.textContent = '';

    const lanes = [];
    for (const kind of ['array', 'list']) {
        const wrap = box('div', {
            border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '10px 12px', marginBottom: '12px', background: '#fff',
        });
        const head = box('div', {
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '10px', marginBottom: '6px',
        });
        const title = box('span', {
            fontWeight: '900', color: LANE_TITLE[kind].tone, fontSize: '15px',
        }, LANE_TITLE[kind].name);
        const tally = box('span', {
            fontWeight: '700', color: '#475569',
            fontVariantNumeric: 'tabular-nums',
        });
        const badge = box('span', {
            fontWeight: '800', color: '#065f46', background: '#d1fae5',
            border: '1px solid #6ee7b7', borderRadius: '9999px',
            padding: '1px 10px', display: 'none',
        }, '끝');
        head.appendChild(title);
        head.appendChild(tally);
        head.appendChild(badge);
        const stage = box('div', {});
        wrap.appendChild(head);
        wrap.appendChild(stage);
        host.appendChild(wrap);

        lanes.push({
            kind,
            tally,
            badge,
            view: kind === 'array' ? createDsCellsView(stage, {layout: 'row'}) : createDsListView(stage),
        });
    }

    /* 표는 그림 아래에 둔다. **재는 것이 그림과 다른 이야기**이므로 섞지 않는다. */
    const tableNote = box('p', {
        fontWeight: '700', color: '#0f172a', margin: '4px 0 6px',
    }, '개수를 키워 가며 잰 작업량 (접근 + 이동 + 링크)');
    const tableWrap = box('div', {width: '100%', overflowX: 'auto'});
    const table = document.createElement('table');
    Object.assign(table.style, {width: '100%', borderCollapse: 'collapse', minWidth: '480px'});
    tableWrap.appendChild(table);
    host.appendChild(tableNote);
    host.appendChild(tableWrap);

    function paintTable(measured, currentOpId) {
        table.textContent = '';
        const head = document.createElement('tr');
        for (const label of ['연산', '구조', ...measured.sizes.map((n) => `${n}개`)]) {
            const th = document.createElement('th');
            Object.assign(th.style, {
                textAlign: label === '연산' || label === '구조' ? 'left' : 'right',
                padding: '6px 8px', borderBottom: '2px solid #cbd5e1',
                fontWeight: '800', color: '#475569', whiteSpace: 'nowrap',
            });
            th.textContent = label;
            head.appendChild(th);
        }
        table.appendChild(head);

        for (const row of measured.rows) {
            const on = row.op.id === currentOpId;
            for (const kind of ['array', 'list']) {
                const tr = document.createElement('tr');
                if (kind === 'array') {
                    const td = document.createElement('td');
                    Object.assign(td.style, {
                        padding: '6px 8px', fontWeight: '800',
                        color: on ? '#0f172a' : '#64748b',
                        borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
                        background: on ? '#fffbeb' : 'transparent',
                    });
                    td.rowSpan = 2;
                    td.textContent = row.op.name;
                    tr.appendChild(td);
                }
                const who = document.createElement('td');
                Object.assign(who.style, {
                    padding: '6px 8px', fontWeight: '700',
                    color: LANE_TITLE[kind].tone,
                    borderBottom: kind === 'list' ? '1px solid #e2e8f0' : 'none',
                    whiteSpace: 'nowrap',
                    background: on ? '#fffbeb' : 'transparent',
                });
                who.textContent = kind === 'array' ? '배열' : '리스트';
                tr.appendChild(who);

                for (let k = 0; k < measured.sizes.length; k++) {
                    const mine = row[kind][k];
                    const other = row[kind === 'array' ? 'list' : 'array'][k];
                    const td = document.createElement('td');
                    Object.assign(td.style, {
                        padding: '6px 8px', textAlign: 'right',
                        fontVariantNumeric: 'tabular-nums',
                        fontWeight: mine < other ? '900' : '600',
                        color: mine < other ? '#065f46' : '#475569',
                        borderBottom: kind === 'list' ? '1px solid #e2e8f0' : 'none',
                        background: on ? '#fffbeb' : 'transparent',
                    });
                    td.textContent = String(mine);
                    tr.appendChild(td);
                }
                table.appendChild(tr);
            }
        }
    }

    return {
        /**
         * @param {object[]} frames 나란히 놓은 장
         * @param {object} measured `measureDsWork`가 잰 것
         * @param {string} currentOpId 지금 고른 연산. 표에서 그 줄을 도드라지게 한다
         */
        setup(frames, measured, currentOpId) {
            for (let k = 0; k < lanes.length; k++) {
                lanes[k].view.setup(frames.map((f) => f.lanes[k].frame));
            }
            if (measured) paintTable(measured, currentOpId);
        },

        render(frame, prev, o = {}) {
            for (let k = 0; k < lanes.length; k++) {
                const lane = frame.lanes[k];
                lanes[k].view.render(lane.frame, prev ? prev.lanes[k].frame : null, o);
                const c = lane.frame.counts;
                lanes[k].tally.textContent =
                    `접근 ${c.access} · 이동 ${c.move} · 링크 ${c.link}`
                    + `  →  작업량 ${dsWorkOf(c)}`;
                lanes[k].badge.style.display = lane.done ? 'inline-block' : 'none';
            }
        },

        resize() {
            for (const lane of lanes) lane.view.resize();
        },
    };
}
