/* 나란히 비교의 그림 — **세 가지를 나란히 놓는다.**
 *
 * 그림 자체는 새로 그리지 않는다. 두 줄은 칸 그림에, 한 줄은 해시 그림에 맡기고
 * 여기서는 **줄을 나누고 작업량을 옆에 적는 일**만 한다. 그림을 새로 그리면
 * 「같은 것을 나란히 놓았을 뿐」이라는 것이 흐려지고, 두 벌이 되어 어긋나기 시작한다.
 *
 * **넓은 화면에서는 격자로 편다** → simulator.css 의 `sim-lanes`. 순차와 이진은
 * 칸을 가로로 늘어놓아 납작하고 해시는 칸을 세로로 세워 길므로, 납작한 둘을 왼쪽에 쌓고
 * 긴 하나를 오른쪽에 세우면 두 칸의 높이가 맞는다. 셋을 위아래로 쌓으면
 * **세 번째 줄이 화면 밖으로 나가** 나란히 놓은 뜻이 없어진다.
 *
 * **표는 개수를 키워 가며 측정한 것이다.** 한 회차를 넘겨서는 «지금 이 개수»의 값만 보이는데,
 * 정작 가르칠 것은 「개수가 늘면 무엇이 늘고 무엇이 그대로인가」다. 그림과 다른 이야기라
 * **조작 칸으로 내보낸다** — 그림 아래에 두면 전체 화면에서 그림을 밀어낸다.
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

/**
 * @param {HTMLElement} host        그림이 들어갈 자리
 * @param {HTMLElement} measureHost 측정한 표가 들어갈 자리(조작 칸). 없으면 표를 그리지 않는다
 */
export function createFindRaceView(host, measureHost) {
    host.textContent = '';

    const lanesBox = raceBox('div', {});
    lanesBox.className = 'sim-lanes sim-lanes-2';
    /* **순차와 이진을 한 칸에 쌓는다.** 격자에 셋을 그냥 흘려 넣고 해시만 두 줄에
       걸치게 하면, 걸친 상자의 높이가 두 줄에 나뉘어 배어 **순차와 이진 사이에
       200px 짜리 빈 자리**가 생긴다. 상자를 하나 씌우면 그럴 일이 없고,
       좁은 화면에서 셋이 한 줄로 쌓이는 순서도 그대로다. */
    const leftCol = raceBox('div', {
        display: 'grid', gap: '0.75rem', alignContent: 'start', minWidth: '0',
    });
    lanesBox.appendChild(leftCol);
    host.appendChild(lanesBox);

    const lanes = [];
    for (const {kind, name} of [
        {kind: 'seq', name: '순차 탐색'},
        {kind: 'bin', name: '이진 탐색'},
        {kind: 'hash', name: '해시 테이블'},
    ]) {
        const wrap = raceBox('div', {
            border: '1px solid #e2e8f0', borderRadius: '12px',
            padding: '10px 12px', background: '#fff', minWidth: '0',
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
        /* **자리를 미리 잡아 두고 보이기만 껐다 켠다.** `display: none` 으로 두면
           끝난 줄에 배지가 «생겨나» 상자가 세로로 자란다. 2026-08-27에는 그것이 3px
           이었는데, 전체 화면에서 높이가 빠듯하니 **그 3px이 스크롤 막대를 불러**
           칸이 좁아지고 그림이 통째로 옆으로 밀렸다
           → src/styles/simulator.css 의 `scrollbar-gutter`. */
        const badge = raceBox('span', {
            fontWeight: '800', color: '#065f46', background: '#d1fae5',
            border: '1px solid #6ee7b7', borderRadius: '9999px',
            padding: '1px 10px', display: 'inline-block', visibility: 'hidden',
        }, '끝');
        head.appendChild(title);
        head.appendChild(tally);
        head.appendChild(badge);
        const stage = raceBox('div', {});
        wrap.appendChild(head);
        wrap.appendChild(stage);
        (kind === 'hash' ? lanesBox : leftCol).appendChild(wrap);

        lanes.push({
            kind,
            tally,
            badge,
            view: kind === 'hash' ? createFindHashView(stage) : createFindCellsView(stage),
        });
    }

    /* 표는 **조작 칸**에 둔다. 측정하는 것이 그림과 다른 이야기이므로 섞지 않고,
       그림 바로 아래에 두면 전체 화면에서 그림을 화면 밖으로 밀어낸다. */
    const table = document.createElement('table');
    if (measureHost) {
        measureHost.textContent = '';
        measureHost.appendChild(raceBox('p', {
            fontWeight: '700', color: '#0f172a', margin: '0 0 6px',
        }, '개수를 키워 가며 측정한 작업량 (비교 + 접근 + 계산)'));
        measureHost.appendChild(raceBox('p', {
            fontWeight: '600', color: '#64748b', margin: '0 0 6px', fontSize: '14px',
        }, '고르게 뽑은 여덟 값을 찾아 평균을 냈습니다. 해시 표의 칸 수는 값 수에 맞춰 늘렸습니다 '
            + '— 실제 해시 테이블도 값이 늘면 표를 새로 만들어 옮깁니다.'));
        const tableWrap = raceBox('div', {width: '100%', overflowX: 'auto'});
        /* **바닥 폭을 못박지 않는다.** 칸 글자를 전부 `nowrap` 으로 두었으므로
           표는 스스로 min-content 아래로 줄지 않는다 — 임의의 바닥을 더 얹으면
           그만큼 조작 칸에서 가로로 구를 뿐 읽기 좋아지지 않는다. */
        Object.assign(table.style, {width: '100%', borderCollapse: 'collapse'});
        tableWrap.appendChild(table);
        measureHost.appendChild(tableWrap);
    }

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
            if (measured && measureHost) paintTable(measured);
        },

        render(frame, prev, o = {}) {
            for (let k = 0; k < lanes.length; k++) {
                const lane = frame.lanes[k];
                lanes[k].view.render(lane.frame, prev ? prev.lanes[k].frame : null, o);
                const c = lane.frame.counts;
                lanes[k].tally.textContent =
                    `비교 ${c.compare} · 접근 ${c.access} · 계산 ${c.hash}`
                    + `  →  작업량 ${findWorkOf(c)}`;
                lanes[k].badge.style.visibility = lane.done ? 'visible' : 'hidden';
            }
        },

        resize() {
            for (const lane of lanes) lane.view.resize();
        },
    };
}
