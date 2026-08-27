/* 비교 기반 탐색의 그림 — 칸이 한 줄로 늘어서고 그 위에 이름표가 붙는다.
 *
 * **찾기에서는 값이 움직이지 않는다.** 선형 자료구조 쪽 칸 그림은 상자를 계속 따라가며
 * 자리만 바꾸는 데 공을 들였는데, 여기서는 그럴 일이 없다 — 자료는 가만히 있고
 * **보는 눈만 움직인다.** 그래서 훨씬 단순하다. 대신 다른 것에 공을 들인다.
 *
 * **버린 칸을 회색으로 눕히는 것이 이 페이지의 핵심 장면이다.** 이진 탐색이 빠른 까닭은
 * 「빨리 봐서」가 아니라 「안 보고 버려서」인데, 그 «안 봄»은 아무 일도 일어나지 않는 일이라
 * 그리지 않으면 화면에 나타나지 않는다. 8칸이 4칸, 2칸, 1칸으로 줄어드는 것이 눈에
 * 쌓여야 O(log n)이 숫자가 아니라 그림이 된다.
 */

/** 색이 곧 상태다. **범례도 이 표를 읽어 만든다** — 화면과 범례가 어긋날 수 없게. */
export const FIND_COLORS = {
    idle: {bg: '#dbeafe', line: '#93c5fd', text: '#1e3a8a'},
    focus: {bg: '#fde68a', line: '#f59e0b', text: '#78350f'},
    hit: {bg: '#a7f3d0', line: '#10b981', text: '#064e3b'},
    ruled: {bg: '#f1f5f9', line: '#e2e8f0', text: '#cbd5e1'},
};

/** 커서 이름을 화면에 낼 말로. 여기 없는 것은 이름 그대로 낸다. */
const FIND_CURSOR_LABEL = {
    i: 'i', lo: 'lo', hi: 'hi', mid: 'mid',
};

const FIND_CURSOR_TONE = {
    i: '#0f172a', lo: '#0f766e', hi: '#b45309', mid: '#7c3aed',
};

function findBox(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

export function createFindCellsView(host) {
    let cap = 0;
    let cells = [];   // {slot, inner, mark}

    host.textContent = '';

    const stage = findBox('div', {position: 'relative', width: '100%'});
    /* 넘침을 **그림 상자가 받아 낸다.** 페이지가 통째로 가로로 넘치는 것과 다르다. */
    const scroller = findBox('div', {width: '100%', overflowX: 'auto', overflowY: 'hidden'});
    const field = findBox('div', {position: 'relative', width: '100%', height: '116px'});
    const banner = findBox('div', {
        fontWeight: '700', color: '#9f1239', background: '#fff1f2',
        border: '1px solid #fecdd3', borderRadius: '8px',
        padding: '8px 12px', marginTop: '10px', display: 'none',
    });

    scroller.appendChild(field);
    stage.appendChild(scroller);
    stage.appendChild(banner);
    host.appendChild(stage);

    /* **남는 자리에 맞춰 그림을 통째로 키운다.** 이 그림은 칸 높이도 글자도 px 로
       못박혀 있어, 전체 화면에서는 1500×350짜리 칸 한가운데에 116px 짜리 띠만 남는다.
       `zoom` 은 `transform: scale` 과 달리 **자리를 실제로 차지하므로** 가운데 정렬과
       스크롤이 저절로 맞고, 글자는 벡터로 다시 그려져 흐려지지 않는다.
       천장을 두는 것은 칸이 두어 개뿐일 때 숫자만 커다랗게 뜨는 것을 막으려는 것이다. */
    const NAT_H = 116;
    const ZOOM_MAX = 2.6;

    function refit() {
        const availW = host.clientWidth || 0;
        const availH = host.clientHeight || 0;
        if (!availW || !availH || !cap) return;
        const k = Math.min(availW / Math.max(100, cap * 48), availH / NAT_H, ZOOM_MAX);
        /* **올림이 아니라 버림이다.** 반올림하면 배율이 남는 자리보다 커질 수 있어,
           원형 큐에서 714px 짜리 그림이 712px 상자에 앉아 2px 스크롤바가 생겼다. */
        field.style.zoom = k > 1.02 ? String(Math.floor(k * 100) / 100) : '';
    }

    return {
        /**
         * 칸을 만든다.
         * @param {object[]} frames 스냅샷 열 전체
         */
        setup(frames) {
            const st = frames[0].state;
            cap = st.cap;
            field.textContent = '';
            cells = [];
            /* 칸 하나에 바닥을 두고 그만큼 폭을 잡는다. 좁은 화면에서는 이 상자가
               가로로 스크롤되고 페이지는 375px 안에 그대로 있다. */
            Object.assign(field.style, {
                width: `${Math.max(100, cap * 48)}px`,
                minWidth: '100%',
                height: '116px',
            });

            for (let i = 0; i < cap; i++) {
                const slot = findBox('div', {
                    position: 'absolute',
                    left: `${(i * 100) / cap}%`,
                    top: '0',
                    width: `${100 / cap}%`,
                    padding: '0 3px',
                    boxSizing: 'border-box',
                });
                const mark = findBox('div', {
                    height: '20px',
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '800',
                    lineHeight: '1.1',
                    whiteSpace: 'nowrap',
                });
                const inner = findBox('div', {
                    width: '100%',
                    height: '58px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxSizing: 'border-box',
                    border: '2px solid',
                    borderRadius: '8px',
                    fontWeight: '800',
                    fontSize: '15px',
                    transition: 'background-color .18s, border-color .18s, color .18s',
                });
                const idx = findBox('div', {
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '700',
                    color: '#94a3b8',
                    marginTop: '2px',
                }, String(i));

                slot.appendChild(mark);
                slot.appendChild(inner);
                slot.appendChild(idx);
                field.appendChild(slot);
                cells.push({slot, inner, mark});
            }

            refit();
        },

        /** 한 장을 그린다. **움직이는 것이 없으므로 `animate`는 쓰지 않는다.** */
        render(frame) {
            const st = frame.state;
            const m = frame.marks;
            const focus = new Set(m.focus || []);
            const hit = new Set(m.hit || []);
            const ruled = new Set(m.ruled || []);

            for (let i = 0; i < cap; i++) {
                const it = st.slots[i];
                const c = cells[i];
                let tone = FIND_COLORS.idle;
                if (hit.has(i)) tone = FIND_COLORS.hit;
                else if (focus.has(i)) tone = FIND_COLORS.focus;
                else if (ruled.has(i)) tone = FIND_COLORS.ruled;

                c.inner.textContent = it ? String(it.v) : '';
                c.inner.style.background = tone.bg;
                c.inner.style.borderColor = tone.line;
                c.inner.style.color = tone.text;
                /* 버린 칸은 **글자까지 흐려야** 「여기는 이제 안 본다」가 읽힌다.
                   테두리만 흐리면 학생은 그저 색이 바랜 칸으로 본다. */
                c.inner.style.textDecoration = ruled.has(i) && !hit.has(i) ? 'line-through' : 'none';
            }

            // 커서 이름표. 한 칸에 여럿이 겹칠 수 있다 — lo와 hi가 같은 칸을 가리키는 것이
            // 「남은 칸이 하나」라는 뜻이라, 겹쳐 보이는 것 자체가 정보다.
            const perSlot = new Map();
            for (const [name, at] of Object.entries(st.cursors || {})) {
                if (typeof at !== 'number' || at < 0 || at >= cap) continue;
                if (!perSlot.has(at)) perSlot.set(at, []);
                perSlot.get(at).push(name);
            }
            for (let i = 0; i < cap; i++) {
                const names = perSlot.get(i) || [];
                cells[i].mark.textContent = '';
                for (const name of names) {
                    const tag = findBox('span', {
                        color: FIND_CURSOR_TONE[name] || '#0f172a',
                        marginRight: '4px',
                    }, FIND_CURSOR_LABEL[name] || name);
                    cells[i].mark.appendChild(tag);
                }
            }

            if (m.banner) {
                banner.textContent = String(m.banner).replace(/\*\*/g, '').replace(/`/g, '');
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        },

        /** 자리는 백분율이라 그대로지만, **남는 자리에 맞춘 배율은 다시 잡는다.** */
        resize() { refit(); },
    };
}
