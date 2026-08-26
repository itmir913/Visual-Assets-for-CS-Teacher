/* 해시 표의 그림 — 칸을 **세로로** 세우고 값을 오른쪽에 놓는다.
 *
 * **왜 세로인가.** 칸이 열 개인데 가로로 늘어놓으면 375px에서 한 칸이 32px이 되어
 * 두 자리 숫자도 빠듯하다. 게다가 체이닝은 한 칸에 여럿이 연결되므로 가로로는 답이 없다.
 * 세로로 세우면 사슬이 오른쪽으로 자라고, 길어지면 그 줄만 가로로 스크롤된다.
 *
 * **두 방식이 같은 그림을 쓴다.** 체이닝이든 개방 주소법이든 «칸 열 개짜리 표»인 것은
 * 같고 값이 어디 앉느냐만 다르다. 그림을 두 벌로 두면 학생이 서로 다른 두 자료구조로
 * 읽는데, 실제로 다른 것은 **충돌을 만났을 때의 처신 하나뿐**이다.
 */

import {TOMB} from './find-model.js';
import {FIND_COLORS} from './find-view-cells.js';

const HASH_ROW_H = 34;

function hashBox(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

export function createFindHashView(host) {
    let cap = 0;
    let rows = [];   // {line, idx, home, cells}

    host.textContent = '';

    const stage = hashBox('div', {position: 'relative', width: '100%'});
    const scroller = hashBox('div', {width: '100%', overflowX: 'auto'});
    const table = hashBox('div', {minWidth: '300px'});
    const foot = hashBox('div', {
        marginTop: '10px', fontWeight: '700', color: '#475569', fontSize: '14px',
    });
    const banner = hashBox('div', {
        fontWeight: '700', color: '#9f1239', background: '#fff1f2',
        border: '1px solid #fecdd3', borderRadius: '8px',
        padding: '8px 12px', marginTop: '10px', display: 'none',
    });

    scroller.appendChild(table);
    stage.appendChild(scroller);
    stage.appendChild(foot);
    stage.appendChild(banner);
    host.appendChild(stage);

    /** 값 상자 하나. 사슬의 노드도 칸에 앉은 값도 같은 모양으로 그린다. */
    function valueBox(text, tone, dashed = false) {
        return hashBox('div', {
            minWidth: '40px',
            height: '26px',
            padding: '0 8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxSizing: 'border-box',
            border: `2px ${dashed ? 'dashed' : 'solid'}`,
            borderColor: tone.line,
            background: tone.bg,
            color: tone.text,
            borderRadius: '6px',
            fontWeight: '800',
            fontSize: '14px',
            whiteSpace: 'nowrap',
        }, text);
    }

    return {
        setup(frames) {
            const st = frames[0].state;
            cap = st.cap;
            table.textContent = '';
            rows = [];

            for (let i = 0; i < cap; i++) {
                const line = hashBox('div', {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    height: `${HASH_ROW_H}px`,
                    borderTop: i === 0 ? '1px solid #e2e8f0' : 'none',
                    borderBottom: '1px solid #e2e8f0',
                });
                /* 칸 번호가 곧 해시값이다. **번호를 크게 두는 데 뜻이 있다** —
                   학생이 값의 일의 자리와 이 번호를 눈으로 맞춰 봐야 한다. */
                const idx = hashBox('div', {
                    width: '34px',
                    flex: '0 0 34px',
                    textAlign: 'right',
                    fontWeight: '800',
                    fontSize: '14px',
                    color: '#64748b',
                }, String(i));
                const home = hashBox('div', {
                    width: '14px',
                    flex: '0 0 14px',
                    textAlign: 'center',
                    fontWeight: '900',
                    fontSize: '13px',
                    color: '#f59e0b',
                }, '');
                const cells = hashBox('div', {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    minWidth: '0',
                });
                line.appendChild(idx);
                line.appendChild(home);
                line.appendChild(cells);
                table.appendChild(line);
                rows.push({line, idx, home, cells});
            }
        },

        render(frame) {
            const st = frame.state;
            const m = frame.marks;
            const focus = new Set(m.focus || []);
            const hit = new Set(m.hit || []);

            for (let i = 0; i < cap; i++) {
                const r = rows[i];
                const b = st.buckets[i];
                r.cells.textContent = '';
                r.line.style.background = focus.has(i) ? '#fffbeb' : 'transparent';
                /* 계산으로 나온 칸에 **화살표**를 세운다. 「여기서부터 본다」가
                   글이 아니라 그림으로 있어야 한다. */
                r.home.textContent = st.home === i ? '▶' : '';

                if (Array.isArray(b)) {
                    if (b.length === 0) {
                        r.cells.appendChild(hashBox('div', {
                            color: '#cbd5e1', fontWeight: '700', fontSize: '14px',
                        }, '비어 있음'));
                    } else {
                        b.forEach((it, j) => {
                            if (j > 0) {
                                r.cells.appendChild(hashBox('div', {
                                    color: '#94a3b8', fontWeight: '900', fontSize: '13px',
                                }, '→'));
                            }
                            const on = hit.has(i) && m.hitPos === j;
                            r.cells.appendChild(valueBox(String(it.v),
                                on ? FIND_COLORS.hit : (focus.has(i) ? FIND_COLORS.focus : FIND_COLORS.idle)));
                        });
                    }
                } else if (b === TOMB) {
                    /* **묘비는 빈 칸과 달라 보여야 한다.** 같아 보이면 「왜 여기서 안 멈추지」가
                       설명되지 않는다. 점선으로 그려 「자리는 비었지만 지나온 흔적은 남았다」를 낸다. */
                    r.cells.appendChild(valueBox('묘비', FIND_COLORS.ruled, true));
                } else if (b === null) {
                    r.cells.appendChild(hashBox('div', {
                        color: '#cbd5e1', fontWeight: '700', fontSize: '14px',
                    }, '비어 있음'));
                } else {
                    r.cells.appendChild(valueBox(String(b.v),
                        hit.has(i) ? FIND_COLORS.hit : (focus.has(i) ? FIND_COLORS.focus : FIND_COLORS.idle)));
                }
            }

            /* **적재율을 늘 띄워 둔다.** 충돌이 잦아지는 것이 「운이 나빠서」가 아니라
               「얼마나 찼느냐」 때문임을 수로 보여 주는 자리다. */
            const load = cap ? (st.size / cap) : 0;
            foot.textContent = `담긴 값 ${st.size}개 · 칸 ${cap}개 · 적재율 ${load.toFixed(2)}`;

            if (m.banner) {
                banner.textContent = String(m.banner).replace(/\*\*/g, '').replace(/`/g, '');
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        },

        resize() {},
    };
}
