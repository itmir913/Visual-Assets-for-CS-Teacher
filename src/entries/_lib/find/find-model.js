/* 찾기 시뮬레이터의 **진리**.
 *
 * 뼈대는 선형 자료구조 쪽과 같다 — 연산이 화면을 직접 만지지 않고 이 기록기에 부탁하면
 * 부탁 한 번마다 **스냅샷이 한 장** 쌓이고, 재생·되감기·스크럽은 그 장을 되짚는 것뿐이다.
 * 「연산 한 번이 한 판」인 것도 같다. 앞 판이 끝난 상태를 물려받아 시작한다.
 *
 * **다른 것은 무엇을 세느냐다.** 이 페이지가 답하는 질문은 하나다 —
 * 「같은 자료에서 같은 값을 찾는데, 왜 어떤 방법은 값이 늘수록 느려지고 어떤 방법은
 * 그대로인가.」 그래서 세는 값을 셋으로 갈랐다.
 *
 *   `비교`  값을 대 본다                     순차는 n번, 이진은 log n번, 해시는 몇 번
 *   `접근`  칸이나 마디를 하나 들여다본다      대개 비교와 함께 가지만 체이닝에서 갈린다
 *   `계산`  해시 함수를 돌린다                **해시에서만 늘어난다**
 *
 * **`계산`이 이 페이지의 요점이다.** 순차와 이진은 「어디를 볼지」를 «보면서» 정하는데
 * 해시는 «계산해서» 정한다. 계산 한 번이 비교 n번을 대신하는 것 — 그것이 O(1)의 정체다.
 *
 * **담는 방식이 둘이라 상태도 둘이다.**
 *
 *   `array`  칸에 값이 죽 늘어서 있다. 순차·이진 탐색이 쓴다.
 *   `hash`   자리를 값에서 «계산해» 정한다. 계산이 겹치면(충돌) 처리 방식이 갈린다.
 *
 * **그림은 선형 자료구조 쪽 것을 물려받지 않았다.** 상태 모양은 거의 같지만 그려야 할
 * 것이 다르다 — 저쪽은 «상자가 미끄러지는 것»이 요점이라 원소를 계속 따라가는 데 공을
 * 들였는데, 찾기에서는 **아무것도 움직이지 않는다.** 대신 «버린 칸을 눕히는 것»과
 * «맞아떨어진 칸»이 요점이라, 그 둘을 못 그리면 페이지가 할 일을 못 한다.
 */

/** 원소 하나에 붙는 이름. **끝까지 변하지 않는다** — 화면이 같은 상자를 계속 따라가야
 *  옮겨 앉는 것이 «움직임»으로 보인다. */
let nextFindId = 1;

export function findItem(v) {
    return {v, id: nextFindId++};
}

/** 검사가 되풀이해 돌 때 id가 끝없이 커지지 않게 되돌린다. 화면에서는 부를 일이 없다. */
export function findResetIds() {
    nextFindId = 1;
}

/** 개방 주소법에서 뺀 자리에 남기는 **묘비**. 빈 칸과 구별해야 하는 까닭은 `find-ops.js`에. */
export const TOMB = '묘비';

/* ---------------------------------------------------------------
   처음 상태
   --------------------------------------------------------------- */

/** 칸에 값이 늘어선 상태. 순차·이진 탐색이 쓴다.
 *  **칸 수와 값 수가 늘 같다** — 찾기는 넣거나 빼지 않으므로 빈 칸이 생길 일이 없다. */
export function findArrayState(values = []) {
    const slots = values.map((v) => findItem(v));
    return {
        store: 'array',
        cap: slots.length,
        slots,
        size: slots.length,
        cursors: {},
    };
}

/**
 * 해시 테이블 상태.
 * @param {number} cap  칸 수. **소수로 두는 편이 낫지만 여기서는 학생이 나머지를 암산할
 *                      수 있도록 작고 둥근 수를 쓴다** — 왜 그런지는 등록부의 「화면 읽는 법」에.
 * @param {'chain'|'open'} mode 충돌을 어떻게 넘기는가
 */
export function findHashState(cap, values = [], mode = 'chain') {
    const st = {
        store: 'hash',
        mode,
        cap,
        /* 체이닝은 칸마다 «줄», 개방 주소법은 칸마다 «하나». 모양이 다르므로 만들 때 가른다. */
        buckets: Array.from({length: cap}, () => (mode === 'chain' ? [] : null)),
        size: 0,
        cursors: {},
        /** 방금 어느 칸을 계산해 냈는지. 화면이 「여기서부터 본다」를 그리는 데 쓴다. */
        home: null,
    };
    for (const v of values) findHashPut(st, v);
    return st;
}

/** 해시 함수. **나머지 연산 하나뿐이다** — 학생이 손으로 따라 할 수 있어야
 *  「계산해서 자리를 정한다」가 마술이 아니게 된다. */
export function findHash(v, cap) {
    return ((v % cap) + cap) % cap;
}

/** 세지 않고 넣는다. **처음 상태를 만들 때만 쓴다** — 연산으로 넣는 것은 `find-ops.js`다. */
function findHashPut(st, v) {
    const h = findHash(v, st.cap);
    if (st.mode === 'chain') {
        if (st.buckets[h].some((it) => it.v === v)) return;
        st.buckets[h].push(findItem(v));
        st.size += 1;
        return;
    }
    for (let k = 0; k < st.cap; k++) {
        const at = (h + k) % st.cap;
        const cell = st.buckets[at];
        if (cell && cell !== TOMB && cell.v === v) return;
        if (!cell || cell === TOMB) {
            st.buckets[at] = findItem(v);
            st.size += 1;
            return;
        }
    }
}

export function findCloneState(s) {
    if (s.store === 'array') {
        return {
            ...s,
            slots: s.slots.map((it) => (it ? {...it} : null)),
            cursors: {...s.cursors},
        };
    }
    return {
        ...s,
        buckets: s.buckets.map((b) => {
            if (Array.isArray(b)) return b.map((it) => ({...it}));
            return b === TOMB || b === null ? b : {...b};
        }),
        cursors: {...s.cursors},
    };
}

/* ---------------------------------------------------------------
   기록기
   --------------------------------------------------------------- */

export function createFindRecorder(state) {
    const s = findCloneState(state);
    const frames = [];
    const counts = {compare: 0, access: 0, hash: 0};

    let note = '';
    let focus = [];        // 지금 들여다보는 칸
    let hit = [];          // 값이 맞아떨어진 칸
    let hitPos = null;     // 사슬에서 맞아떨어진 마디의 자리(체이닝에서만)
    let ruled = [];        // 방금 «버린» 자리 — 이진 탐색이 반씩 지워 가는 것을 보인다
    let banner = null;     // 판 전체에 붙는 말

    function snap(act) {
        frames.push({
            state: findCloneState(s),
            act,
            marks: {
                focus: [...focus],
                hit: [...hit],
                hitPos,
                ruled: [...ruled],
                banner,
            },
            counts: {...counts},
            say: note,
        });
        /* 한 장짜리 표시는 그리고 나면 끈다. 다음 장까지 남으면 어디를 보라는 건지 흐려진다.
           **`ruled`와 `hit`은 끄지 않는다.**
           `ruled` — 이진 탐색이 버린 자리는 그 판이 끝날 때까지 버려진 채로 있어야
             「반씩 줄어든다」가 눈에 쌓인다.
           `hit`   — 찾아낸 칸이 한 장만 반짝이고 꺼지면, 판을 다 돌린 뒤 **어디서 찾았는지가
             화면에 남지 않는다.** 맺음말은 「4번에서 찾았습니다」라고 하는데 그 4번이
             다른 칸과 똑같아 보이는 것이다. 찾은 것은 찾은 채로 둔다. */
        focus = [];
    }

    const rec = {
        get size() { return s.size; },
        get cap() { return s.cap; },
        get state() { return s; },
        get mode() { return s.mode; },

        say(text) { note = text; return rec; },
        flag(text) { banner = text; return rec; },
        clearFlag() { banner = null; return rec; },

        cursor(name, at) {
            if (at === null || at === undefined) delete s.cursors[name];
            else s.cursors[name] = at;
            return rec;
        },
        clearCursors() { s.cursors = {}; return rec; },

        /** 아무 일도 없지만 한 장 남긴다. 설명만 바뀌는 자리에 쓴다. */
        mark(kind = 'mark') { snap({kind}); return rec; },

        /* ---- 칸(배열) ---- */

        /** 세지 않고 들여다본다. 연산이 조건을 따지는 중간 계산에 쓴다. */
        peek: (i) => s.slots[i],

        /**
         * 칸 하나를 들여다보고 **값을 대 본다.** 찾기에서 실제로 일어나는 일은 이것이다.
         * @returns {-1|0|1} 칸의 값이 target보다 작으면 -1, 같으면 0, 크면 1
         */
        probe(i, target) {
            counts.access += 1;
            counts.compare += 1;
            focus = [i];
            const it = s.slots[i];
            const cmp = it.v === target ? 0 : (it.v < target ? -1 : 1);
            if (cmp === 0) hit = [i];
            snap({kind: 'probe', i, cmp});
            return cmp;
        },

        /** 이진 탐색이 반을 **버린다.** 세지 않는다 — 버리는 것은 공짜이고,
         *  공짜라는 것이야말로 이진 탐색이 빠른 까닭이다. */
        ruleOut(from, to) {
            for (let i = from; i <= to; i++) if (i >= 0 && i < s.cap) ruled.push(i);
            snap({kind: 'rule-out', from, to});
            return rec;
        },

        /* ---- 해시 ---- */

        /** 해시 함수를 돌린다. **이 페이지에서 가장 중요한 한 줄이다.** */
        hashOf(v) {
            counts.hash += 1;
            const h = findHash(v, s.cap);
            s.home = h;
            focus = [h];
            snap({kind: 'hash', v, h});
            return h;
        },

        /** 칸 하나를 들여다본다. 값을 대 보지는 않는다 — 비었는지 보는 것도 «접근»이다. */
        visit(i) {
            counts.access += 1;
            focus = [i];
            snap({kind: 'visit', i});
            return s.buckets[i];
        },

        /** 사슬이나 칸의 값을 **대 본다.** */
        test(i, target, chainPos = null) {
            counts.compare += 1;
            focus = [i];
            const cell = s.buckets[i];
            const it = chainPos === null ? cell : cell[chainPos];
            const same = !!it && it !== TOMB && it.v === target;
            if (same) { hit = [i]; hitPos = chainPos; }
            snap({kind: 'test', i, chainPos, same});
            return same;
        },

        /** 칸에 값을 **놓는다.** */
        place(i, v, chainPos = null) {
            counts.access += 1;
            const it = findItem(v);
            if (chainPos === null) s.buckets[i] = it;
            else s.buckets[i].push(it);
            s.size += 1;
            hit = [i];
            hitPos = chainPos;
            snap({kind: 'place', i, v});
            return it;
        },

        /** 칸을 **비운다.** 개방 주소법은 묘비를 남긴다 — 까닭은 `find-ops.js`에. */
        erase(i, chainPos = null, tomb = false) {
            counts.access += 1;
            if (chainPos === null) s.buckets[i] = tomb ? TOMB : null;
            else s.buckets[i].splice(chainPos, 1);
            s.size -= 1;
            focus = [i];
            /* **지운 자리의 「찾던 값」 표시를 끈다.** `hit`은 판이 끝날 때까지 남기는
               것이 규칙인데, 빼기에서는 그 규칙이 거꾸로 문다 — 사슬에서 마디를 빼면
               **뒷값이 그 자리로 당겨 앉아**, 찾던 값이 아닌 것이 초록으로 남는다.
               찾아 놓고 지운 값은 이미 화면에 없으므로 가리킬 것도 없다. */
            hit = [];
            hitPos = null;
            snap({kind: 'erase', i, tomb});
            return rec;
        },

        setHome(h) { s.home = h; return rec; },
    };

    return {
        rec,
        begin(text) { note = text; snap({kind: 'begin'}); },
        finish(text) {
            note = text;
            focus = [];
            snap({kind: 'end'});
            return {frames, counts: {...counts}, state: s};
        },
    };
}

/** 연산 하나를 돌려 스냅샷 열을 얻는다. */
export function runFindOperation(op, state, arg) {
    const {rec, begin, finish} = createFindRecorder(state);
    begin(op.opening ? op.opening(rec, arg) : '연산을 시작합니다.');
    const closing = op.run(rec, arg);
    return finish(closing || '연산이 끝났습니다.');
}

/* ---------------------------------------------------------------
   성한가 — 화면에 보이는 것과 실제로 담긴 것이 같은가
   --------------------------------------------------------------- */

export function findStateFault(s) {
    if (s.store === 'array') {
        if (s.slots.length !== s.cap) return `칸이 ${s.slots.length}개다(정해 둔 것 ${s.cap}개)`;
        const filled = s.slots.filter(Boolean).length;
        if (filled !== s.size) return `값이 ${filled}개인데 크기는 ${s.size}이다`;
        return null;
    }

    if (s.buckets.length !== s.cap) return `칸이 ${s.buckets.length}개다(정해 둔 것 ${s.cap}개)`;
    let n = 0;
    for (let i = 0; i < s.cap; i++) {
        const b = s.buckets[i];
        if (s.mode === 'chain') {
            if (!Array.isArray(b)) return `${i}번 칸이 줄이 아니다`;
            for (const it of b) {
                /* **체이닝은 자리가 곧 해시값이다.** 여기가 어긋나면 화면은 그럴듯한데
                   찾기가 엉뚱한 칸을 뒤지게 된다 — 눈으로는 못 잡는다. */
                if (findHash(it.v, s.cap) !== i) return `${i}번에 있는 ${it.v}의 해시값이 ${findHash(it.v, s.cap)}이다`;
            }
            n += b.length;
        } else {
            if (Array.isArray(b)) return `${i}번 칸에 줄이 들어 있다(개방 주소법인데)`;
            if (b && b !== TOMB) n += 1;
        }
    }
    if (n !== s.size) return `값이 ${n}개인데 크기는 ${s.size}이다`;
    return null;
}

/** 담긴 값을 뽑는다. 탭을 옮길 때 자료를 물려주는 데 쓴다. */
export function findValues(s) {
    if (s.store === 'array') return s.slots.filter(Boolean).map((it) => it.v);
    const out = [];
    for (const b of s.buckets) {
        if (Array.isArray(b)) out.push(...b.map((it) => it.v));
        else if (b && b !== TOMB) out.push(b.v);
    }
    return out;
}
