/* 칸으로 담는 구조의 그림 — 배열 · 스택 · 큐 · 덱 · 원형 큐.
 *
 * **원소 하나가 상자 하나다.** 자리마다 상자를 다시 그리는 것이 아니라 같은 상자를
 * 계속 따라가며 자리만 바꾼다. 그래서 미는 것과 당기는 것이 **움직임으로** 보인다.
 * 이 그림에서 학생이 가져가야 하는 것이 바로 그 「밀린다」이므로,
 * 상자를 지웠다 새로 그리면 이 페이지는 할 일을 못 한 것이 된다.
 *
 * **자리는 백분율로 잡는다.** 상자 폭을 측정해 굳혀 두면 창 크기가 바뀔 때 그 값이 낡는데,
 * 백분율이면 브라우저가 알아서 다시 잡는다 — 전체 화면을 드나들어도 어긋날 수 없다.
 *
 * **줄로 놓는 것과 동그랗게 놓는 것이 같은 코드다.** 원형 큐는 「배열이라서 생긴 문제를
 * 배열 안에서 푸는 것」이라, 칸을 다루는 코드가 두 벌이면 그 「같은 배열이다」가 흐려진다.
 * 다른 것은 자리를 정하는 함수 하나뿐이다.
 */

/** 색이 곧 상태다. **범례도 이 표를 읽어 만든다** — 화면과 범례가 어긋날 수 없게. */
export const DS_COLORS = {
    idle: {bg: '#bfdbfe', line: '#60a5fa', text: '#1e3a8a'},
    focus: {bg: '#fde68a', line: '#f59e0b', text: '#78350f'},
    moving: {bg: '#fecdd3', line: '#f43f5e', text: '#881337'},
    newborn: {bg: '#a7f3d0', line: '#10b981', text: '#064e3b'},
    doomed: {bg: '#e2e8f0', line: '#94a3b8', text: '#475569'},
};

/** 커서 이름을 화면에 낼 말로. 여기 없는 것은 이름 그대로 낸다.
 *  **쓰이지 않는 이름을 남겨 두지 않는다** — 범례에 있는데 화면에 한 번도 안 나오면
 *  학생이 「아직 못 본 무언가가 있다」고 여기며 찾는다. */
const CURSOR_LABEL = {
    i: 'i', p: 'p', q: 'q', front: 'front', rear: 'rear', top: 'top', bottom: '바닥',
};

const CURSOR_TONE = {
    front: '#0f766e', rear: '#b45309', top: '#7c3aed', bottom: '#475569',
    i: '#0f172a', p: '#0f172a', q: '#475569',
};

function box(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

/**
 * @param {HTMLElement} host 그림이 들어갈 빈 상자
 * @param {object} opts `layout` — `'row'`(줄) 또는 `'ring'`(동그라미)
 */
export function createDsCellsView(host, opts = {}) {
    const layout = opts.layout === 'ring' ? 'ring' : 'row';
    const isRing = layout === 'ring';
    /* **끝이 어디인지 늘 붙여 두는 이름표.** 스택의 「맨 위」, 큐의 「front·rear」처럼
       연산이 끝난 뒤에도 남아 있어야 하는 것이다 — 연산이 만드는 커서(i·p)는 회차가
       끝나면 지워지므로 그것으로는 낼 수가 없다. 구조가 정해서 넘겨준다. */
    const endMarks = typeof opts.endMarks === 'function' ? opts.endMarks : null;

    let cap = 1;
    let cells = [];        // 자리마다 하나씩. 늘 그 자리에 있는 «빈 칸»
    let items = new Map(); // id → {el, last}
    let marks = [];        // 자리마다 하나씩. 커서 이름표

    host.textContent = '';

    const stage = box('div', {position: 'relative', width: '100%'});
    /* 넘침을 **그림 상자가 받아 낸다.** 페이지가 통째로 가로로 넘치는 것과 다르다 —
       칸이 열 개인데 375px이면 한 칸이 32px이라 두 자리 숫자가 겨우 들어간다. */
    const scroller = box('div', {width: '100%', overflowX: 'auto', overflowY: 'hidden'});
    const field = box('div', {position: 'relative', width: '100%'});
    const banner = box('div', {
        fontWeight: '700', color: '#9f1239', background: '#fff1f2',
        border: '1px solid #fecdd3', borderRadius: '8px',
        padding: '8px 12px', marginTop: '10px', display: 'none',
    });

    scroller.appendChild(field);
    stage.appendChild(scroller);
    stage.appendChild(banner);
    host.appendChild(stage);

    /* ---- 자리 정하기. **줄과 동그라미가 갈리는 유일한 곳이다.** ---- */

    /** 칸 하나의 폭(백분율). 동그라미는 지름이 아니라 칸 크기를 못박는다. */
    const RING_CELL = 17;   // 지름 대비 칸 폭(%)
    const RING_R = 36;      // 가운데에서 칸까지(%)

    function placeCell(el, i) {
        if (!isRing) {
            Object.assign(el.style, {
                left: `${(i * 100) / cap}%`,
                top: '0%',
                width: `${100 / cap}%`,
                height: '100%',
                transform: 'none',
            });
            return;
        }
        // 12시에서 시작해 시계 방향. 인덱스가 도는 순서가 눈에 보여야 한다.
        const th = (i / cap) * Math.PI * 2 - Math.PI / 2;
        Object.assign(el.style, {
            left: `${50 + RING_R * Math.cos(th)}%`,
            top: `${50 + RING_R * Math.sin(th)}%`,
            width: `${RING_CELL}%`,
            height: `${RING_CELL}%`,
            transform: 'translate(-50%, -50%)',
        });
    }

    function fieldMetrics() {
        if (isRing) {
            /* 동그라미는 **폭과 높이가 같아야** 찌그러지지 않는다. 칸이 열 개일 때
               지름 300px 아래로 내려가면 칸이 51px이 되어 두 자리 숫자가 빠듯하다. */
            const d = Math.max(300, Math.min(420, host.clientWidth || 360));
            return {width: `${d}px`, height: `${d}px`, margin: '0 auto'};
        }
        /* 줄은 **칸 하나에 바닥을 두고** 그만큼 폭을 잡는다. 좁은 화면에서는 이 상자가
           가로로 스크롤되고, 페이지는 375px 안에 그대로 있다. */
        return {width: `${Math.max(100, cap * 46)}px`, minWidth: '100%', height: '132px', margin: '0'};
    }

    function makeItem(item) {
        const el = box('div', {
            position: 'absolute',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '8px',
            border: '2px solid transparent',
            fontWeight: '800',
            fontSize: '15px',
            transition: 'none',
            zIndex: '2',
        });
        field.appendChild(el);
        return {el, last: {}};
    }

    /** 같은 값을 두 번 쓰지 않는다. 스크럽할 때 속성 쓰기가 그림을 무겁게 한다. */
    function put(rec, key, value) {
        if (rec.last[key] === value) return;
        rec.last[key] = value;
        rec.el.style[key] = value;
    }

    return {
        /**
         * 칸과 원소 상자를 만든다.
         * @param {object[]} frames 스냅샷 열 전체
         */
        setup(frames) {
            const first = frames[0];
            const st = first.state;
            cap = st.cap;

            field.textContent = '';
            Object.assign(field.style, fieldMetrics());
            cells = [];
            marks = [];
            items = new Map();

            for (let i = 0; i < cap; i++) {
                const slot = box('div', {
                    position: 'absolute',
                    boxSizing: 'border-box',
                    padding: isRing ? '0' : '0 3px',
                    zIndex: '1',
                });
                const inner = box('div', {
                    width: '100%',
                    height: isRing ? '100%' : '58px',
                    marginTop: isRing ? '0' : '30px',
                    boxSizing: 'border-box',
                    border: '2px dashed #cbd5e1',
                    borderRadius: '8px',
                    background: '#f8fafc',
                });
                const idx = box('div', {
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#94a3b8',
                    marginTop: '2px',
                }, String(i));
                const mark = box('div', {
                    position: 'absolute',
                    left: '0',
                    right: '0',
                    top: isRing ? '-18px' : '4px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '800',
                    lineHeight: '1.1',
                    whiteSpace: 'nowrap',
                    zIndex: '3',
                });
                slot.appendChild(inner);
                if (!isRing) slot.appendChild(idx);
                slot.appendChild(mark);
                placeCell(slot, i);
                field.appendChild(slot);
                cells.push({slot, inner, idx});
                marks.push(mark);
            }

            if (isRing) {
                // 동그라미 한가운데에 인덱스를 적어 준다 — 칸 옆에 적을 자리가 없다.
                for (let i = 0; i < cap; i++) {
                    const th = (i / cap) * Math.PI * 2 - Math.PI / 2;
                    const tag = box('div', {
                        position: 'absolute',
                        left: `${50 + (RING_R - 12) * Math.cos(th)}%`,
                        top: `${50 + (RING_R - 12) * Math.sin(th)}%`,
                        transform: 'translate(-50%, -50%)',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#94a3b8',
                    }, String(i));
                    field.appendChild(tag);
                }
            }

            // 이 회차에 나오는 원소를 미리 다 만들어 둔다. 나중에 나타나는 것도 자리만 비워 둔다.
            const seen = new Map();
            for (const f of frames) {
                for (const it of f.state.slots) if (it && !seen.has(it.id)) seen.set(it.id, it);
            }
            for (const [id, it] of seen) {
                const rec = makeItem(it);
                rec.el.textContent = String(it.v);
                items.set(id, rec);
            }
        },

        /**
         * 한 장을 그린다.
         * @param {object} frame  그릴 장
         * @param {object} prev   앞 장(없으면 null)
         * @param {object} o      `{animate, ms}` — 움직여 그릴지는 **부르는 쪽이 정한다**
         */
        render(frame, prev, o = {}) {
            const st = frame.state;
            const m = frame.marks;
            const focus = new Set(m.focus);
            const moving = new Set(m.moving);

            // 칸 테두리 — 지금 보는 칸만 도드라지게.
            for (let i = 0; i < cap; i++) {
                const on = focus.has(i);
                cells[i].inner.style.borderColor = on ? DS_COLORS.focus.line : '#cbd5e1';
                cells[i].inner.style.background = on ? '#fffbeb' : '#f8fafc';
            }

            // 커서 이름표. **자리마다 여럿이 겹칠 수 있다** — front와 rear가 같은 칸을 가리키는
            // 것이 원형 큐에서는 「비었다」와 「꽉 찼다」를 가르는 자리다.
            const perSlot = new Map();
            const cursors = {...st.cursors};
            if (st.ring) {
                cursors.front = st.front;
                cursors.rear = st.rear;
            }
            if (endMarks) {
                for (const {at, name} of endMarks(st)) {
                    if (typeof at === 'number' && at >= 0 && at < cap) cursors[name] = at;
                }
            }
            for (const [name, at] of Object.entries(cursors)) {
                if (typeof at !== 'number' || at < 0 || at >= cap) continue;
                if (!perSlot.has(at)) perSlot.set(at, []);
                perSlot.get(at).push(name);
            }
            for (let i = 0; i < cap; i++) {
                const names = perSlot.get(i) || [];
                marks[i].textContent = '';
                for (const name of names) {
                    const tag = box('span', {
                        color: CURSOR_TONE[name] || '#0f172a',
                        marginRight: '4px',
                    }, CURSOR_LABEL[name] || name);
                    marks[i].appendChild(tag);
                }
            }

            // 원소 상자.
            const here = new Map();
            st.slots.forEach((it, i) => { if (it) here.set(it.id, i); });

            for (const [id, rec] of items) {
                const at = here.get(id);
                if (at === undefined) {
                    put(rec, 'opacity', '0');
                    put(rec, 'transform', 'scale(.7)');
                    continue;
                }
                const tone = moving.has(at) ? DS_COLORS.moving
                    : focus.has(at) ? DS_COLORS.focus
                        : DS_COLORS.idle;
                put(rec, 'opacity', '1');
                put(rec, 'background', tone.bg);
                put(rec, 'borderColor', tone.line);
                put(rec, 'color', tone.text);
                /* **움직임은 여기서만 켠다.** 되감기와 스크럽은 아무 데로나 뛰므로
                   트랜지션을 켜 두면 화면이 뒤늦게 따라오다 끝값을 잃는다. */
                put(rec, 'transition', o.animate ? `left ${o.ms}ms ease, top ${o.ms}ms ease` : 'none');

                if (!isRing) {
                    put(rec, 'left', `calc(${(at * 100) / cap}% + 3px)`);
                    put(rec, 'width', `calc(${100 / cap}% - 6px)`);
                    put(rec, 'top', '30px');
                    put(rec, 'height', '58px');
                    put(rec, 'transform', 'none');
                } else {
                    const th = (at / cap) * Math.PI * 2 - Math.PI / 2;
                    put(rec, 'left', `${50 + RING_R * Math.cos(th)}%`);
                    put(rec, 'top', `${50 + RING_R * Math.sin(th)}%`);
                    put(rec, 'width', `${RING_CELL}%`);
                    put(rec, 'height', `${RING_CELL}%`);
                    put(rec, 'transform', 'translate(-50%, -50%)');
                }
            }

            if (m.banner) {
                banner.style.display = 'block';
                banner.textContent = m.banner.replace(/\*\*/g, '').replace(/`/g, '');
            } else {
                banner.style.display = 'none';
            }
        },

        /** 창 크기가 바뀌면 동그라미의 지름을 다시 잡는다. 줄은 백분율이라 할 일이 없다. */
        resize() {
            Object.assign(field.style, fieldMetrics());
        },
    };
}
