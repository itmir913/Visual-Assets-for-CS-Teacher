/* 나란히 놓기의 그림 — **세 가지를 위에서 아래로 세운다.**
 *
 * 그림 자체는 새로 그리지 않는다. 위 두 줄은 칸 그림에, 아래 한 줄은 해시 그림에 맡기고
 * 여기서는 **줄을 나누고 작업량을 옆에 적는 일**만 한다. 그림을 새로 그리면
 * 「같은 것을 나란히 놓았을 뿐」이라는 것이 흐려지고, 두 벌이 되어 어긋나기 시작한다.
 *
 * **표는 개수를 키워 가며 잰 것이다.** 한 판을 넘겨서는 «지금 이 개수»의 값만 보이는데,
 * 정작 가르칠 것은 「개수가 늘면 무엇이 늘고 무엇이 그대로인가」다.
 */

import {createFindCellsView} from './find-view-cells.js';
import {createFindHashView} from './find-view-hash.js';
import {findWorkOf} from './find-compare.js';

const RACE_TONE = {
    seq: '#b45309',
    bin: '#1d4ed8',
    hash: '#7c3aed',
};

function raceBox(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

export function createFindRaceView(host) {
    host.textContent = '';

    const lanes = [];
    for (const {kind, name} of [
        {kind: 'seq', name: '순차 탐색'},
        {kind: 'bin', name: '이진 탐색'},
        {kind: 'hash', name: '해시 테이블'},
    ]) {
        const wrap = raceBox('div', {
            border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '10px 12px', marginBottom: '12px', background: '#fff',
        });
        const head = raceBox('div', {
            display: 'flex', flexWrap: 'wrap', alignItems: 'baseline',
            gap: '10px', marginBottom: '6px',
        });
        const title = raceBox('span', {
            fontWeight: '900', color: RACE_TONE[kind], fontSize: '15px',
        }, name);
        const tally = raceBox('span', {
            fontWeight: '700', color: '#475569', fontVariantNumeric: 'tabular-nums',
        });
        const badge = raceBox('span', {
            fontWeight: '800', color: '#065f46', background: '#d1fae5',
            border: '1px solid #6ee7b7', borderRadius: '9999px',
            padding: '1px 10px', display: 'none',
        }, '끝');
        head.appendChild(title);
        head.appendChild(tally);
        head.appendChild(badge);
        const stage = raceBox('div', {});
        wrap.appendChild(head);
        wrap.appendChild(stage);
        host.appendChild(wrap);

        lanes.push({
            kind,
            tally,
            badge,
            view: kind === 'hash' ? createFindHashView(stage) : createFindCellsView(stage),
        });
    }

    /* 표는 그림 아래에 둔다. **재는 것이 그림과 다른 이야기**이므로 섞지 않는다. */
    const tableNote = raceBox('p', {
        fontWeight: '700', color: '#0f172a', margin: '4px 0 6px',
    }, '개수를 키워 가며 측정한 작업량 (비교 + 접근 + 계산)');
    const tableHint = raceBox('p', {
        fontWeight: '600', color: '#64748b', margin: '0 0 6px', fontSize: '14px',
    }, '고르게 뽑은 여덟 값을 찾아 평균을 냈습니다. 해시 표의 칸 수는 값 수에 맞춰 늘렸습니다 '
        + '— 실제 해시 테이블도 값이 늘면 표를 새로 만들어 옮깁니다.');
    const tableWrap = raceBox('div', {width: '100%', overflowX: 'auto'});
    const table = document.createElement('table');
    Object.assign(table.style, {width: '100%', borderCollapse: 'collapse', minWidth: '420px'});
    tableWrap.appendChild(table);
    host.appendChild(tableNote);
    host.appendChild(tableHint);
    host.appendChild(tableWrap);

    function paintTable(measured) {
        table.textContent = '';
        const head = document.createElement('tr');
        for (const label of ['찾는 방법', ...measured.sizes.map((n) => `${n}개`)]) {
            const th = document.createElement('th');
            Object.assign(th.style, {
                textAlign: label === '찾는 방법' ? 'left' : 'right',
                padding: '6px 8px', borderBottom: '2px solid #cbd5e1',
                fontWeight: '800', color: '#475569', whiteSpace: 'nowrap',
            });
            th.textContent = label;
            head.appendChild(th);
        }
        table.appendChild(head);

        for (const row of measured.rows) {
            const tr = document.createElement('tr');
            const who = document.createElement('td');
            Object.assign(who.style, {
                padding: '6px 8px', fontWeight: '800', color: RACE_TONE[row.kind],
                borderBottom: '1px solid #e2e8f0', whiteSpace: 'nowrap',
            });
            who.textContent = row.name;
            tr.appendChild(who);

            for (let k = 0; k < measured.sizes.length; k++) {
                const mine = row.work[k];
                /* **그 개수에서 가장 싼 쪽만 도드라지게 한다.** 셋을 다 굵게 하면
                   아무것도 강조하지 않은 것과 같다. */
                const best = Math.min(...measured.rows.map((r) => r.work[k]));
                const td = document.createElement('td');
                Object.assign(td.style, {
                    padding: '6px 8px', textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    fontWeight: mine === best ? '900' : '600',
                    color: mine === best ? '#065f46' : '#475569',
                    borderBottom: '1px solid #e2e8f0',
                });
                td.textContent = String(mine);
                tr.appendChild(td);
            }
            table.appendChild(tr);
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
                lanes[k].tally.textContent =
                    `비교 ${c.compare} · 접근 ${c.access} · 계산 ${c.hash}`
                    + `  →  작업량 ${findWorkOf(c)}`;
                lanes[k].badge.style.display = lane.done ? 'inline-block' : 'none';
            }
        },

        resize() {
            for (const lane of lanes) lane.view.resize();
        },
    };
}
