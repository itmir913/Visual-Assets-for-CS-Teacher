/* 비용 비교의 그림 — **두 구조를 나란히 놓는다.**
 *
 * 그림 자체는 새로 그리지 않는다. 한 줄은 칸 그림에, 다른 줄은 노드 그림에 맡기고
 * 여기서는 **줄을 나누고 작업량을 옆에 적는 일**만 한다. 그림을 새로 그리면
 * 「같은 구조를 나란히 놓았을 뿐」이라는 것이 흐려지고, 두 벌이 되어 어긋나기 시작한다.
 *
 * **넓은 화면에서는 두 줄을 옆으로 편다** → simulator.css 의 `sim-lanes`.
 * 위아래로 쌓으면 둘째 줄을 보려고 스크롤해야 하는데, 그러면 나란히 놓은 뜻이 없다.
 *
 * **표는 개수를 키워 가며 측정한 것이다.** 한 회차를 넘겨서는 «지금 이 개수»의 값만 보이는데,
 * 정작 가르칠 것은 「개수가 늘면 어떻게 벌어지는가」다. 그리고 **그림과 다른 이야기**라
 * 조작 칸으로 내보낸다 — 그림 아래에 두면 전체 화면에서 그림을 밀어낸다.
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

/**
 * @param {HTMLElement} host        그림이 들어갈 자리
 * @param {HTMLElement} measureHost 측정한 표가 들어갈 자리(조작 칸). 없으면 표를 그리지 않는다
 */
export function createDsCompareView(host, measureHost) {
    host.textContent = '';

    const lanesBox = box('div', {});
    lanesBox.className = 'sim-lanes sim-lanes-2';
    host.appendChild(lanesBox);

    const lanes = [];
    for (const kind of ['array', 'list']) {
        const wrap = box('div', {
            border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '10px 12px', background: '#fff', minWidth: '0',
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
        lanesBox.appendChild(wrap);

        lanes.push({
            kind,
            tally,
            badge,
            view: kind === 'array' ? createDsCellsView(stage, {layout: 'row'}) : createDsListView(stage),
        });
    }

    /* 표는 **조작 칸**에 둔다. 측정하는 것이 그림과 다른 이야기이므로 섞지 않고,
       그림 바로 아래에 두면 전체 화면에서 그림을 화면 밖으로 밀어낸다. */
    const table = document.createElement('table');
    if (measureHost) {
        measureHost.textContent = '';
        measureHost.appendChild(box('p', {
            fontWeight: '700', color: '#0f172a', margin: '0 0 6px',
        }, '개수를 키워 가며 측정한 작업량 (접근 + 이동 + 링크)'));
        const tableWrap = box('div', {width: '100%', overflowX: 'auto'});
        /* **바닥 폭을 못박지 않는다.** 칸 글자를 전부 `nowrap` 으로 두었으므로
           표는 스스로 min-content 아래로 줄지 않는다 — 임의의 바닥을 더 얹으면
           그만큼 조작 칸에서 가로로 구를 뿐 읽기 좋아지지 않는다. */
        Object.assign(table.style, {width: '100%', borderCollapse: 'collapse'});
        tableWrap.appendChild(table);
        measureHost.appendChild(tableWrap);
    }

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
         * @param {object} measured `measureDsWork`가 측정한 것
         * @param {string} currentOpId 지금 고른 연산. 표에서 그 줄을 도드라지게 한다
         */
        setup(frames, measured, currentOpId) {
            for (let k = 0; k < lanes.length; k++) {
                lanes[k].view.setup(frames.map((f) => f.lanes[k].frame));
            }
            if (measured && measureHost) paintTable(measured, currentOpId);
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
