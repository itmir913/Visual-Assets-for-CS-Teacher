/* 막대뷰 — 정렬 시뮬레이터의 기본 그림.
 *
 * **원소 하나가 상자 하나다.** 자리(인덱스)마다 상자를 다시 그리는 것이 아니라,
 * 같은 상자를 계속 따라가며 왼쪽 위치만 바꾼다. 그래서 교환과 이동이
 * **움직임으로** 보이고, 값이 같은 둘도 서로 구별된다.
 *
 * **자리는 백분율로 잡는다.** 상자 폭을 측정해 굳혀 두면 창 크기가 바뀔 때 그 값이 낡는데,
 * 백분율이면 브라우저가 알아서 다시 잡는다 — 전체 화면을 드나들어도 어긋날 수 없다.
 * 폭을 측정하는 곳은 딱 한 군데, **글자를 낼 수 있는지 정할 때**뿐이고 그것도 그릴 때마다
 * 다시 측정한다. 자리와 달리 글자는 백분율로 정할 수가 없다.
 *
 * 구간 띠(`ranges`)와 임시 배열(`aux`)까지 여기서 함께 그린다. 나눠서 푸는 정렬도
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

/* **글자를 낼지 말지는 원소 수가 아니라 한 칸의 실제 폭이 정한다.**
   처음에는 `n <= 36`처럼 개수로 갈랐는데, 그러면 같은 24개라도 데스크톱에서는 넉넉하고
   375px에서는 한 칸이 13px이라 숫자가 서로 겹쳐 **읽을 수 없는 얼룩**이 되었다.
   폭은 창 크기에 따라 달라지므로 **그릴 때마다 다시 측정한다** — 한 번 측정해 굳혀 두면
   창을 줄였을 때 그 값이 낡는다. */
const SLOT_FOR_VALUE = 20;   // 이만큼은 되어야 값 숫자가 들어간다
const SLOT_FOR_DUP = 32;     // 겹친 값의 처음 자리(`5·3`)까지 붙이려면 더 넓어야 한다
const SLOT_FOR_INDEX = 26;   // 인덱스 줄

/* **그림 상자의 높이는 한 판이 시작될 때 정해 놓고 끝까지 붙든다.**
   구간 띠와 임시 배열 칸은 단계에 따라 나타났다 사라지는데, 그때마다 상자가 늘었다
   줄었다 하면 **그 아래에 있는 단추가 아래위로 움직인다.** 넘기는 동작은 같은 자리를
   되풀이해 누르는 일이라, 단추가 움직이면 조작이 통째로 어긋난다.
   그래서 이 판에서 «가장 높이 필요한 만큼»을 미리 재어 자리를 비워 둔다 —
   쓰지 않는 단계에서는 그냥 빈 자리로 남는다. */
const RANGE_LEVEL_H = 12;    // 구간 띠 한 층
const RANGE_GAP = 6;
const AUX_H = 76;            // 임시 배열 칸
const AUX_GAP = 10;
const STRIP_HEAD = 36;       // 칸 줄의 이름표와 테두리
const STRIP_ITEM_H = 15;     // 칸에 쌓이는 원소 한 줄
const STRIP_MAX_SHOWN = 12;  // 이보다 많이 쌓이면 나머지는 「+N」으로 줄인다
const INDEX_H = 20;          // 인덱스·커서 줄. 늘 비워 둔다 — 커서는 거의 모든 판에 있다

function sortMakeBox(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

/**
 * @param {HTMLElement} host 그림이 들어갈 빈 상자
 * @returns 뷰. `setup()` 으로 원소를 만들고 `render()` 로 한 장을 그린다.
 */
export function createSortArrayView(host) {
    let bars = new Map();      // id → {wrap, fill, label}
    let n = 0;
    let maxValue = 1;
    let dupIds = new Set();    // 값이 겹치는 원소. 겹칠 때만 처음 자리를 적어 준다
    let holes = [];            // 자리마다 하나씩. 원소가 빠진 칸에만 켠다
    let slotPx = 40;           // 한 칸의 실제 폭. **그릴 때마다 다시 측정한다**

    const stage = sortMakeBox('div', {position: 'relative', width: '100%'});
    const rangeRow = sortMakeBox('div', {position: 'relative', height: '0px', marginBottom: '0px'});
    const heldRow = sortMakeBox('div', {position: 'relative', height: '0px'});
    const barsRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '260px'});
    const indexRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '0px'});
    const auxRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '0px'});
    const stripRow = sortMakeBox('div', {position: 'relative', width: '100%', height: '0px'});

    host.textContent = '';
    stage.appendChild(rangeRow);
    stage.appendChild(heldRow);
    stage.appendChild(barsRow);
    stage.appendChild(indexRow);
    stage.appendChild(auxRow);
    stage.appendChild(stripRow);
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
        /* `last`는 **마지막으로 실제로 써 넣은 값**이다. n=1000이면 한 장을 그릴 때마다
           속성을 6천 번 쓰게 되는데(측정해 보니 70ms), 그중 대부분은 앞 장과 같은 값이다.
           같은 값을 다시 쓰지 않는 것만으로 스크럽이 눈에 띄게 가벼워진다. */
        return {wrap, fill, label, item, last: {}};
    }

    return {
        /**
         * 원소 상자를 만들고 **이 판에서 쓸 높이를 미리 정한다.**
         * @param {object[]} frames 스냅샷 열 전체. 첫 장에서 원소를 얻고,
         *                          나머지는 «가장 높이 필요한 만큼»을 재는 데 쓴다.
         */
        setup(frames) {
            const items = (frames[0] && frames[0].a) || [];
            barsRow.textContent = '';
            heldRow.textContent = '';
            indexRow.textContent = '';
            auxRow.textContent = '';
            rangeRow.textContent = '';
            bars = new Map();
            n = items.length;
            maxValue = Math.max(1, ...items.map((it) => it.v));

            /* **값이 겹치는 원소만 처음 자리를 달아 준다.** 겹치지 않으면 쓸데없는
               숫자가 하나 더 붙을 뿐이지만, 겹칠 때는 이 번호가 곧 안정 정렬의 증거다 —
               같은 값끼리 번호가 오름차순으로 남아 있으면 앞뒤가 지켜진 것이다. */
            const seen = new Map();
            for (const it of items) seen.set(it.v, (seen.get(it.v) || 0) + 1);
            dupIds = new Set(items.filter((it) => seen.get(it.v) > 1).map((it) => it.id));

            /* **빈칸을 눈에 보이게 그린다.** 「그 자리가 빈칸이 됩니다」라고 적어 놓고
               화면에는 막대가 그대로 있으면 글과 그림이 어긋난다 —
               학생이 믿는 것은 그림이다. 막대보다 **먼저** 깔아 뒤에 둔다. */
            holes = [];
            for (let i = 0; i < n; i++) {
                const hole = sortMakeBox('div', {
                    position: 'absolute',
                    bottom: '0',
                    left: slotLeft(i),
                    width: slotWidth(),
                    height: '34px',
                    padding: '0 2px',
                    boxSizing: 'border-box',
                    display: 'none',
                });
                hole.appendChild(sortMakeBox('div', {
                    height: '100%',
                    border: '2px dashed #f9a8d4',
                    borderRadius: '4px',
                    background: '#fdf2f8',
                    boxSizing: 'border-box',
                }));
                barsRow.appendChild(hole);
                holes.push(hole);
            }

            for (const it of items) {
                const bar = makeBar(it);
                /* **높이는 여기서 한 번만 정한다.** 값과 최댓값이 정해지면 끝인데
                   장마다 다시 쓸 이유가 없다. 천장을 88%로 두는 것은 임시 저장한 막대가
                   줄 위로 떠야 하고, 가장 큰 막대가 모서리에 붙으면 잘려 보이기 때문이다. */
                bar.fill.style.height = `${Math.max(6, (it.v / maxValue) * 88)}%`;
                bars.set(it.id, bar);
            }

            /* 인덱스는 **늘 만들어 두고** 보일지는 그릴 때 정한다.
               창을 줄였다 늘였다 할 때마다 다시 만들 이유가 없다. */
            for (let i = 0; i < n; i++) {
                const num = sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(i),
                    width: slotWidth(),
                    textAlign: 'center',
                    fontSize: '10px',
                    color: '#94a3b8',
                    paddingTop: '3px',
                }, String(i));
                num.setAttribute('data-num', String(i));
                indexRow.appendChild(num);
            }

            /* **여기서 한 판의 높이를 못박는다.** 한 장씩 보며 정하면 단계마다 상자가
               움직이므로, 전체를 훑어 가장 높은 값을 찾아 그 자리를 비워 둔다. */
            let depth = 0;
            let hasAux = false;
            let stripKind = null;
            let stripStack = 0;
            for (const f of frames) {
                for (const r of f.ranges || []) depth = Math.max(depth, (r.depth || 0) + 1);
                if (f.aux && f.aux.length) hasAux = true;
                if (f.strip) {
                    stripKind = f.strip.kind;
                    for (const c of f.strip.cells) {
                        stripStack = Math.max(stripStack, Math.min(c.items.length, STRIP_MAX_SHOWN));
                    }
                }
            }
            rangeRow.style.height = depth ? `${depth * RANGE_LEVEL_H}px` : '0px';
            rangeRow.style.marginBottom = depth ? `${RANGE_GAP}px` : '0px';
            auxRow.style.height = hasAux ? `${AUX_H}px` : '0px';
            auxRow.style.marginTop = hasAux ? `${AUX_GAP}px` : '0px';
            indexRow.style.height = `${INDEX_H}px`;
            /* 칸 줄도 같은 규칙 — 이 판에서 가장 높이 쌓이는 만큼을 미리 비워 둔다.
               「개수만 세는」 줄은 숫자 한 줄이면 되므로 쌓임을 세지 않는다. */
            const stripH = !stripKind ? 0
                : STRIP_HEAD + (stripKind === 'count' ? STRIP_ITEM_H + 4 : stripStack * STRIP_ITEM_H + 4);
            stripRow.style.height = `${stripH}px`;
            stripRow.style.marginTop = stripH ? '12px' : '0px';
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

            /* **여기서 다시 측정한다.** 창 크기·전체 화면·좁은 화면이 모두 한 칸의 폭을 바꾸고,
               글자를 낼 수 있는지는 오직 그 폭이 정한다. */
            slotPx = (barsRow.clientWidth || 600) / Math.max(1, n);
            const showValue = slotPx >= SLOT_FOR_VALUE;
            const showDup = slotPx >= SLOT_FOR_DUP;
            const labelPx = Math.max(9, Math.min(15, Math.round(slotPx * 0.34)));
            const cmp = new Set((marks.compare || []).filter((x) => x !== null));
            const moving = new Set(marks.moving);
            const done = new Set(marks.done);

            const place = new Map();      // id → 자리
            frame.a.forEach((it, i) => { if (it) place.set(it.id, i); });

            for (let i = 0; i < holes.length; i++) {
                holes[i].style.display = frame.a[i] ? 'none' : 'block';
            }

            for (const [id, bar] of bars) {
                const i = place.get(id);
                const isHeld = marks.held && marks.held.item.id === id;

                if (i === undefined && !isHeld) {
                    /* 임시 배열으로 옮겨 간 원소. **주 배열 쪽에는 아무것도 남기지 않는다.**
                       흐리게 남겨 두었더니 같은 자리에 그려지는 「빈칸」 점선과 겹쳐
                       칸이 빈 것인지 아닌지가 되레 헷갈렸다. 빈칸 점선과 임시 배열의
                       막대, 둘이면 어디로 갔는지 말하기에 충분하다. */
                    if (bar.last.opacity !== '0') { bar.wrap.style.opacity = '0'; bar.last.opacity = '0'; }
                    continue;
                }

                /* **피벗이 「지금 비교하는 것」보다 앞선다.** 퀵 정렬은 구간의 모든 칸을
                   피벗과 비교하므로, 비교 색이 이기면 피벗은 언제나 노랑이 되어
                   보라색이 화면에 한 번도 나타나지 않는다 —
                   **범례에만 있고 화면에 없는 색이 생긴다.** 피벗은 그 구간 내내
                   피벗이므로 제 색을 지키고, 짝이 되는 칸만 노랑으로 뜬다. */
                let tone = SORT_COLORS.idle;
                if (isHeld) tone = SORT_COLORS.held;
                else if (moving.has(i)) tone = SORT_COLORS.moving;
                else if (marks.pivot === i) tone = SORT_COLORS.pivot;
                else if (cmp.has(i)) tone = SORT_COLORS.compare;
                else if (done.has(i)) tone = SORT_COLORS.done;

                const at = isHeld ? marks.held.from : i;
                const left = slotLeft(at);
                const trans = dur ? `left ${dur}ms ease, transform ${dur}ms ease` : 'none';
                // 임시 저장한 원소는 줄에서 살짝 띄운다. 「빠져 있다」가 한눈에 보여야 한다.
                const lift = isHeld ? 'translateY(-30px)' : 'translateY(0)';
                const L0 = bar.last;
                if (L0.opacity !== '1') { bar.wrap.style.opacity = '1'; L0.opacity = '1'; }
                if (L0.left !== left) { bar.wrap.style.left = left; L0.left = left; }
                if (L0.width !== n) { bar.wrap.style.width = slotWidth(); L0.width = n; }
                if (L0.trans !== trans) { bar.wrap.style.transition = trans; L0.trans = trans; }
                if (L0.lift !== lift) { bar.wrap.style.transform = lift; L0.lift = lift; }

                const text = !showValue ? ''
                    : (showDup && dupIds.has(id) ? `${bar.item.v}·${id}` : String(bar.item.v));
                const L = bar.last;
                if (L.tone !== tone) {
                    bar.fill.style.background = tone.bg;
                    bar.fill.style.borderColor = tone.bar;
                    bar.label.style.color = tone.text;
                    L.tone = tone;
                }
                if (L.labelPx !== labelPx) { bar.label.style.fontSize = `${labelPx}px`; L.labelPx = labelPx; }
                if (L.text !== text) { bar.label.textContent = text; L.text = text; }
            }

            this.renderRanges(frame);
            this.renderAux(frame, dur);
            this.renderStrip(frame);
            this.renderCursors(frame);
        },

        /** 나뉜 구간을 막대 위에 띠로 얹는다. 「지금 어디를 보고 있는가」가 층으로 보인다. */
        renderRanges(frame) {
            // **높이는 `setup`이 정해 두었다.** 여기서 다시 손대면 단추가 움직인다.
            rangeRow.textContent = '';
            const list = frame.ranges || [];
            for (const r of list) {
                rangeRow.appendChild(sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(r.lo),
                    width: `${((r.hi - r.lo + 1) * 100) / n}%`,
                    top: `${(r.depth || 0) * RANGE_LEVEL_H}px`,
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

        /** 임시 배열. **제자리 정렬이 아니라는 것을 글이 아니라 그림으로** 말한다. */
        renderAux(frame, dur) {
            // 높이는 `setup`이 정해 두었다. 쓰지 않는 단계에서는 빈 자리로 남는다.
            auxRow.textContent = '';
            const blocks = frame.aux;
            if (!blocks || !blocks.length) return;

            for (const b of blocks) {
                const wrap = sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(b.base),
                    width: `${(Math.max(1, b.items.length) * 100) / n}%`,
                    top: '0',
                    height: `${AUX_H - 6}px`,
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
                    // 이미 꺼내 쓴 칸은 물러나 있게 한다. 지우지는 않는다 —
                    // 지우면 남은 것들이 앞으로 밀려 「어디까지 썼는지」가 사라진다.
                    const spent = k < (b.used || 0);
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
                        background: spent ? '#f1f5f9' : '#e0e7ff',
                        border: `1px ${spent ? 'dashed' : 'solid'} ${spent ? '#cbd5e1' : '#818cf8'}`,
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontWeight: '700',
                        // 다 쓴 칸도 값은 읽히게 둔다 — 「사라졌다」가 아니라 「가져다 썼다」다.
                        color: spent ? '#94a3b8' : '#3730a3',
                        display: 'flex',
                        alignItems: 'flex-end',
                        justifyContent: 'center',
                        overflow: 'hidden',
                    }, slotPx >= SLOT_FOR_VALUE ? String(it.v) : ''));
                    wrap.appendChild(cell);
                });
                auxRow.appendChild(wrap);
            }
        },

        /** **값으로 자리를 정하는 칸 줄.**
         *  분배 정렬이 「원소끼리 대 보는」 대신 무엇을 하는지가 이 줄에 다 있다 —
         *  칸의 이름이 곧 값이고, 원소는 자기 값이 적힌 칸으로 곧장 간다. */
        renderStrip(frame) {
            // 높이는 `setup`이 잡아 두었다. 여기서 손대면 단추가 움직인다.
            stripRow.textContent = '';
            const strip = frame.strip;
            if (!strip) return;

            const cells = strip.cells;
            const w = 100 / Math.max(1, cells.length);
            const box = sortMakeBox('div', {
                position: 'absolute', inset: '0',
                border: '1px dashed #94a3b8', borderRadius: '8px',
                background: '#f8fafc', boxSizing: 'border-box',
            });
            box.appendChild(sortMakeBox('div', {
                position: 'absolute', top: '-9px', left: '8px',
                fontSize: '10px', fontWeight: '700', color: '#475569',
                background: '#f8fafc', padding: '0 4px', whiteSpace: 'nowrap',
            }, strip.label));

            cells.forEach((c, k) => {
                const on = strip.focus === c.key;
                const cell = sortMakeBox('div', {
                    position: 'absolute', top: '6px', bottom: '4px',
                    left: `${k * w}%`, width: `${w}%`,
                    padding: '0 2px', boxSizing: 'border-box',
                    display: 'flex', flexDirection: 'column', alignItems: 'stretch',
                });
                cell.appendChild(sortMakeBox('div', {
                    textAlign: 'center', fontSize: '10px', fontWeight: '800',
                    color: on ? '#be123c' : '#94a3b8', lineHeight: '14px',
                }, String(c.key)));

                const body = sortMakeBox('div', {
                    flex: '1 1 auto',
                    border: `1px solid ${on ? '#f43f5e' : '#cbd5e1'}`,
                    background: on ? '#fff1f2' : '#ffffff',
                    borderRadius: '4px',
                    display: 'flex', flexDirection: 'column-reverse',
                    alignItems: 'stretch', overflow: 'hidden',
                });

                if (strip.kind === 'count') {
                    body.appendChild(sortMakeBox('div', {
                        textAlign: 'center', fontWeight: '800',
                        fontSize: '12px', lineHeight: `${STRIP_ITEM_H}px`,
                        color: c.count ? '#0f172a' : '#cbd5e1',
                    }, String(c.count)));
                } else {
                    /* **아래에서 위로 쌓는다.** 먼저 넣은 것이 아래에 남아 있어야
                       「넣은 차례 그대로 꺼낸다」가 눈에 보인다. */
                    const shown = c.items.slice(0, STRIP_MAX_SHOWN);
                    shown.forEach((it) => {
                        body.appendChild(sortMakeBox('div', {
                            textAlign: 'center', fontSize: '10px', fontWeight: '700',
                            lineHeight: `${STRIP_ITEM_H - 1}px`,
                            color: '#3730a3', background: '#e0e7ff',
                            borderTop: '1px solid #c7d2fe',
                        }, String(it.v)));
                    });
                    if (c.items.length > STRIP_MAX_SHOWN) {
                        body.appendChild(sortMakeBox('div', {
                            textAlign: 'center', fontSize: '9px', fontWeight: '800',
                            lineHeight: `${STRIP_ITEM_H - 1}px`, color: '#64748b',
                        }, `+${c.items.length - STRIP_MAX_SHOWN}`));
                    }
                }

                cell.appendChild(body);
                box.appendChild(cell);
            });

            stripRow.appendChild(box);
        },

        /** i·j·k 같은 커서를 인덱스 줄에 이름표로 세운다. */
        renderCursors(frame) {
            for (const old of [...indexRow.children]) {
                if (old.dataset && old.dataset.cursor) indexRow.removeChild(old);
            }
            const cursors = frame.marks.cursors || {};
            const names = Object.keys(cursors);
            /* **한 자리에 커서가 둘 이상 설 수 있다.** 선택 정렬은 훑기를 시작할 때
               `i`와 `최솟값`이 같은 칸을 가리키는데, 따로 그리면 두 이름표가 같은 자리에
               겹쳐 **읽을 수 없는 얼룩**이 된다. 자리별로 묶어 한 줄로 잇는다. */
            const atSlot = new Map();
            for (const name of names) {
                const i = cursors[name];
                if (!atSlot.has(i)) atSlot.set(i, []);
                atSlot.get(i).push(name);
            }

            const showNum = slotPx >= SLOT_FOR_INDEX;
            for (const el of indexRow.children) {
                if (!el.dataset || el.dataset.num === undefined) continue;
                // 커서가 선 칸의 번호는 감춘다. 겹쳐 놓으면 둘 다 못 읽는다.
                el.style.display = (showNum && !atSlot.has(Number(el.dataset.num))) ? 'block' : 'none';
            }
            // **커서는 번호를 감춰도 남긴다** — 지금 어디를 보고 있는지가 번호보다 중요하다.
            // 줄 높이는 `setup`이 잡아 두었다. 비어 있어도 접지 않는다.

            for (const [i, group] of atSlot) {
                const text = group.join('·');
                const el = sortMakeBox('div', {
                    position: 'absolute',
                    left: slotLeft(i),
                    width: slotWidth(),
                    textAlign: 'center',
                    // 이름을 이어 붙이면 칸보다 길어질 수 있다. 넘쳐도 가운데를 지키게 둔다.
                    fontSize: slotPx >= SLOT_FOR_INDEX ? '11px' : '10px',
                    fontWeight: '800',
                    color: '#be123c',
                    whiteSpace: 'nowrap',
                    top: '0',
                }, text);
                el.setAttribute('data-cursor', text);
                indexRow.appendChild(el);
            }
        },

        /** 막대 줄의 높이. 전체 화면에서 남는 높이를 넘겨받을 때 쓴다. */
        setHeight(px) { barsRow.style.height = `${px}px`; },
    };
}
