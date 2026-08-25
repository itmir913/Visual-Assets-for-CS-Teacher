/* 막대뷰 — 정렬 시뮬레이터의 기본 그림.
 *
 * **알갱이 하나가 상자 하나다.** 자리(인덱스)마다 상자를 다시 그리는 것이 아니라,
 * 같은 상자를 계속 따라가며 왼쪽 위치만 바꾼다. 그래서 맞바꿈과 밀기가
 * **움직임으로** 보이고, 값이 같은 둘도 서로 구별된다.
 *
 * **자리는 백분율로 잡는다.** 상자 폭을 재지 않으므로 창 크기가 바뀌어도 다시 그릴 일이
 * 없고, 전체 화면을 드나들어도 어긋나지 않는다 — 재서 굳혀 두면 그 자리가 낡는다.
 *
 * 구간 띠(`ranges`)와 보조 칸(`aux`)까지 여기서 함께 그린다. 나눠서 푸는 정렬도
 * 결국 같은 막대를 쓰므로, 뷰를 둘로 가르면 막대 다루는 코드가 두 벌이 된다.
 */

/** 색이 곧 상태다. **범례도 이 표를 읽어 만든다** — 화면과 범례가 어긋날 수 없게. */
export const SORT_COLORS = {
    idle: {bg: '#bfdbfe', bar: '#60a5fa', text: '#1e3a8a'},
    compare: {bg: '#fde68a', bar: '#f59e0b', text: '#78350f'},
    moving: {bg: '#fecdd3', bar: '#f43f5e', text: '#881337'},
    done: {bg: '#a7f3d0', bar: '#10b981', text: '#064e3b'},
    pivot: {bg: '#ddd6fe', bar: '#8b5cf6', text: '#4c1d95'},
    held: {bg: '#fbcfe8', bar: '#ec4899', text: '#831843'},
};

/** 자리 번호와 값 글자를 언제까지 내놓을지. 이보다 촘촘하면 글자가 겹쳐 읽을 수 없다. */
const LABEL_MAX_N = 36;
const INDEX_MAX_N = 24;

function sortMakeBox(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

/**
 * @param {HTMLElement} host 그림이 들어갈 빈 상자
 * @returns 뷰. `setup()` 으로 알갱이를 만들고 `render()` 로 한 장을 그린다.
 */
export function createSortArrayView(host) {
    let bars = new Map();      // id → {wrap, fill, label}
    let n = 0;
    let maxValue = 1;
    let dupIds = new Set();    // 값이 겹치는 알갱이. 겹칠 때만 처음 자리를 적어 준다
    let showLabels = true;
    let showIndex = true;

    const stage = sortMakeBox('div', {position: 'relative', width: '100%'});
    const rangeRow = sortMakeBox('div', {position: 'relative', height: '0px', marginBottom: '0px'});
    const heldRow = sortMakeBox('div', {position: 'relative', height: '0px'});
    const barsRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '260px'});
    const indexRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '0px'});
    const auxRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '0px'});

    host.textContent = '';
    stage.appendChild(rangeRow);
    stage.appendChild(heldRow);
    stage.appendChild(barsRow);
    stage.appendChild(indexRow);
    stage.appendChild(auxRow);
    host.appendChild(stage);

    const slotLeft = (i) => `${(i * 100) / n}%`;
    const slotWidth = () => `${100 / n}%`;

    function makeBar(item) {
        const wrap = sortMakeBox('div', {
            position: 'absolute',
            bottom: '0',
            left: slotLeft(0),
            width: slotWidth(),
            height: '100%',
            padding: '0 2px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            alignItems: 'stretch',
        });
        const fill = sortMakeBox('div', {
            borderRadius: '4px 4px 2px 2px',
            border: '1px solid transparent',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            overflow: 'hidden',
            boxSizing: 'border-box',
        });
        const label = sortMakeBox('div', {
            fontSize: '11px',
            fontWeight: '700',
            lineHeight: '1.1',
            paddingBottom: '2px',
            whiteSpace: 'nowrap',
        });
        fill.appendChild(label);
        wrap.appendChild(fill);
        barsRow.appendChild(wrap);
        return {wrap, fill, label, item};
    }

    return {
        /**
         * 알갱이 상자를 만든다. 자료가 바뀔 때마다 한 번.
         * @param {{v:number,id:number}[]} items 처음 배열
         */
        setup(items) {
            barsRow.textContent = '';
            heldRow.textContent = '';
            indexRow.textContent = '';
            auxRow.textContent = '';
            rangeRow.textContent = '';
            bars = new Map();
            n = items.length;
            maxValue = Math.max(1, ...items.map((it) => it.v));
            showLabels = n <= LABEL_MAX_N;
            showIndex = n <= INDEX_MAX_N;

            /* **값이 겹치는 알갱이만 처음 자리를 달아 준다.** 겹치지 않으면 쓸데없는
               숫자가 하나 더 붙을 뿐이지만, 겹칠 때는 이 번호가 곧 안정 정렬의 증거다 —
               같은 값끼리 번호가 오름차순으로 남아 있으면 앞뒤가 지켜진 것이다. */
            const seen = new Map();
            for (const it of items) seen.set(it.v, (seen.get(it.v) || 0) + 1);
            dupIds = new Set(items.filter((it) => seen.get(it.v) > 1).map((it) => it.id));

            for (const it of items) bars.set(it.id, makeBar(it));

            if (showIndex) {
                indexRow.style.height = '20px';
                for (let i = 0; i < n; i++) {
                    indexRow.appendChild(sortMakeBox('div', {
                        position: 'absolute',
                        left: slotLeft(i),
                        width: slotWidth(),
                        textAlign: 'center',
                        fontSize: '10px',
                        color: '#94a3b8',
                        paddingTop: '3px',
                    }, String(i)));
                }
            } else {
                indexRow.style.height = '0px';
            }
        },

        /**
         * 한 장을 그린다.
         * @param frame 스냅샷
         * @param prev  바로 앞 장(안 쓰지만 규약을 맞춘다)
         * @param opts  `{animate, ms}` — **움직여 그릴지는 재생기가 정한다.**
         *              여기서 추측하면 되감기 때 어긋난다.
         */
        render(frame, prev, {animate = false, ms = 300} = {}) {
            const dur = animate ? Math.min(220, Math.round(ms * 0.55)) : 0;
            const marks = frame.marks;
            const cmp = new Set((marks.compare || []).filter((x) => x !== null));
            const moving = new Set(marks.moving);
            const done = new Set(marks.done);

            const place = new Map();      // id → 자리
            frame.a.forEach((it, i) => { if (it) place.set(it.id, i); });

            for (const [id, bar] of bars) {
                const i = place.get(id);
                const inAux = !place.has(id);
                const isHeld = marks.held && marks.held.item.id === id;

                if (i === undefined && !isHeld) {
                    // 보조 칸으로 떠 간 알갱이. 주 배열 자리에서는 흐리게 남겨 둔다.
                    bar.wrap.style.opacity = inAux ? '0.25' : '0';
                    continue;
                }

                let tone = SORT_COLORS.idle;
                if (isHeld) tone = SORT_COLORS.held;
                else if (moving.has(i)) tone = SORT_COLORS.moving;
                else if (cmp.has(i)) tone = SORT_COLORS.compare;
                else if (marks.pivot === i) tone = SORT_COLORS.pivot;
                else if (done.has(i)) tone = SORT_COLORS.done;

                const at = isHeld ? marks.held.from : i;
                bar.wrap.style.opacity = '1';
                bar.wrap.style.left = slotLeft(at);
                bar.wrap.style.width = slotWidth();
                bar.wrap.style.transition = dur ? `left ${dur}ms ease, transform ${dur}ms ease` : 'none';
                // 들어올린 것은 줄에서 살짝 띄운다. 「빠져 있다」가 한눈에 보여야 한다.
                bar.wrap.style.transform = isHeld ? 'translateY(-14px)' : 'translateY(0)';

                bar.fill.style.height = `${Math.max(6, (bar.item.v / maxValue) * 100)}%`;
                bar.fill.style.background = tone.bg;
                bar.fill.style.borderColor = tone.bar;
                bar.label.style.color = tone.text;
                bar.label.textContent = showLabels
                    ? (dupIds.has(id) ? `${bar.item.v}·${id}` : String(bar.item.v))
                    : '';
            }

            this.renderRanges(frame);
            this.renderAux(frame, dur);
            this.renderCursors(frame);
        },

        /** 나뉜 구간을 막대 위에 띠로 얹는다. 「지금 어디를 보고 있는가」가 층으로 보인다. */
        renderRanges(frame) {
            rangeRow.textContent = '';
            const list = frame.ranges || [];
            if (!list.length) { rangeRow.style.height = '0px'; rangeRow.style.marginBottom = '0px'; return; }

            const depth = Math.max(...list.map((r) => r.depth || 0)) + 1;
            rangeRow.style.height = `${depth * 12}px`;
            rangeRow.style.marginBottom = '6px';
            for (const r of list) {
                rangeRow.appendChild(sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(r.lo),
                    width: `${((r.hi - r.lo + 1) * 100) / n}%`,
                    top: `${(r.depth || 0) * 12}px`,
                    height: '8px',
                    padding: '0 2px',
                    boxSizing: 'border-box',
                }, '')).appendChild(sortMakeBox('div', {
                    height: '100%',
                    borderRadius: '3px',
                    background: r.state === 'merged' ? '#6ee7b7' : r.state === 'right' ? '#c4b5fd' : '#93c5fd',
                }));
            }
        },

        /** 보조 칸. **제자리 정렬이 아니라는 것을 글이 아니라 그림으로** 말한다. */
        renderAux(frame, dur) {
            auxRow.textContent = '';
            const blocks = frame.aux;
            if (!blocks || !blocks.length) { auxRow.style.height = '0px'; return; }
            auxRow.style.height = '76px';
            auxRow.style.marginTop = '10px';

            for (const b of blocks) {
                const wrap = sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(b.base),
                    width: `${(Math.max(1, b.items.length) * 100) / n}%`,
                    top: '0',
                    height: '70px',
                    border: '1px dashed #94a3b8',
                    borderRadius: '6px',
                    background: '#f8fafc',
                    boxSizing: 'border-box',
                });
                wrap.appendChild(sortMakeBox('div', {
                    position: 'absolute',
                    top: '-9px',
                    left: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    color: '#475569',
                    background: '#f8fafc',
                    padding: '0 3px',
                }, b.label));

                b.items.forEach((it, k) => {
                    const cell = sortMakeBox('div', {
                        position: 'absolute',
                        bottom: '4px',
                        left: `${(k * 100) / Math.max(1, b.items.length)}%`,
                        width: `${100 / Math.max(1, b.items.length)}%`,
                        padding: '0 2px',
                        boxSizing: 'border-box',
                        transition: dur ? `left ${dur}ms ease` : 'none',
                    });
                    cell.appendChild(sortMakeBox('div', {
                        height: `${Math.max(8, (it.v / maxValue) * 52)}px`,
                        background: '#e0e7ff',
                        border: '1px solid #818cf8',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: '700',
                        color: '#3730a3',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    }, b.items.length <= LABEL_MAX_N ? String(it.v) : ''));
                    wrap.appendChild(cell);
                });
                auxRow.appendChild(wrap);
            }
        },

        /** i·j·k 같은 커서를 자리 번호 줄에 이름표로 세운다. */
        renderCursors(frame) {
            for (const old of [...indexRow.children]) {
                if (old.dataset && old.dataset.cursor) indexRow.removeChild(old);
            }
            const cursors = frame.marks.cursors || {};
            const names = Object.keys(cursors);
            indexRow.style.height = showIndex ? '20px' : (names.length ? '20px' : '0px');
            for (const name of names) {
                const el = sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(cursors[name]),
                    width: slotWidth(),
                    textAlign: 'center',
                    fontSize: '10px',
                    fontWeight: '800',
                    color: '#be123c',
                    top: '0',
                }, name);
                el.setAttribute('data-cursor', name);
                indexRow.appendChild(el);
            }
        },

        /** 막대 줄의 높이. 전체 화면에서 남는 높이를 넘겨받을 때 쓴다. */
        setHeight(px) { barsRow.style.height = `${px}px`; },
    };
}
