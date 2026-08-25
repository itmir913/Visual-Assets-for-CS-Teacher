/* 선형 자료구조 시뮬레이터의 **진리**.
 *
 * 정렬과 뼈대는 같다 — 연산이 화면을 직접 만지지 않고 이 기록기에 부탁하면,
 * 부탁 한 번마다 **스냅샷이 한 장** 쌓인다. 재생·되감기·스크럽은 그 장을 되짚는 것뿐이다.
 *
 * **다른 것이 하나 있다. 정렬은 「자료를 주면 끝까지 도는」 것이고
 * 자료구조는 「연산 한 번이 한 판」이다.** 그래서 이 기록기는 빈 상태에서 시작하지 않고
 * **앞 판이 끝난 상태를 물려받아** 시작한다. 판이 끝나면 그 끝 상태가 다음 판의 시작이다.
 * 되감기는 «지금 연산» 안에서만 된다 — 연산을 무르는 것이 아니라 그 연산이 어떻게
 * 이루어지는지를 앞뒤로 훑는 것이다.
 *
 * **담는 방식이 둘이라 상태도 둘이다.**
 *
 *   `array`  칸이 «미리 정해진 수»만큼 있고 원소는 그 안에 앉는다.
 *            앞에 넣으려면 뒤엣것을 전부 밀어야 한다 — 그 밀기가 곧 비용이다.
 *   `list`   마디가 각자 떨어져 있고 **링크로만** 이어진다. 넣고 빼는 것은 링크를
 *            고쳐 쓰는 일이라 싸지만, k번째를 보려면 처음부터 링크를 따라가야 한다.
 *
 * **세는 값이 셋이다.** 하나로 뭉뚱그리면 두 방식의 차이가 사라진다 —
 * 연결 리스트의 「이동 0」과 배열의 「링크 0」은 각각 그 방식의 성질 그 자체다.
 *
 *   `접근`  칸이나 마디를 하나 들여다본다
 *   `이동`  원소를 다른 «칸»으로 옮긴다              배열 쪽에서만 늘어난다
 *   `링크`  링크 하나를 고쳐 쓴다                    리스트 쪽에서만 늘어난다
 */

/** 원소 하나에 붙는 이름. **끝까지 변하지 않는다** — 화면이 같은 상자를 계속 따라가야
 *  넣고 빼는 것이 «움직임»으로 보인다. */
let nextItemId = 1;

export function dsItem(v) {
    return {v, id: nextItemId++};
}

/** 검사가 되풀이해 돌 때 id가 끝없이 커지지 않게 되돌린다. 화면에서는 부를 일이 없다. */
export function dsResetIds() {
    nextItemId = 1;
}

/* ---------------------------------------------------------------
   처음 상태
   --------------------------------------------------------------- */

/** 칸이 정해진 수만큼 있는 상태. 배열 · 스택 · 큐 · 덱 · 원형 큐가 쓴다. */
export function dsArrayState(cap, values = [], extra = {}) {
    const slots = Array.from({length: cap}, () => null);
    values.forEach((v, i) => { slots[i] = dsItem(v); });
    return {
        store: 'array',
        cap,
        slots,
        size: values.length,
        cursors: {},
        ...extra,
    };
}

/** 마디가 링크로 이어진 상태. 단일 · 이중 연결 리스트가 쓴다.
 *  `nodes`의 «차례»는 화면에 놓는 차례일 뿐이고, 이어짐을 정하는 것은 `next`·`prev`다.
 *
 *  **꼬리 포인터를 두는지가 따로 있다.** 단일 연결 리스트에 꼬리 포인터가 없으면
 *  「뒤에 넣기」가 O(n)이 되는데, **그 차이가 이 페이지에서 가르칠 것 가운데 하나**라
 *  구조마다 정할 수 있어야 한다. 없으면 `tail`은 늘 `null`이고 연산은 그것을 쓸 수 없다. */
export function dsListState(values = [], {doubly = false, hasTail = doubly} = {}) {
    const nodes = values.map((v) => ({...dsItem(v), next: null, prev: null, floating: false}));
    for (let i = 0; i < nodes.length; i++) {
        nodes[i].next = i + 1 < nodes.length ? nodes[i + 1].id : null;
        if (doubly) nodes[i].prev = i > 0 ? nodes[i - 1].id : null;
    }
    return {
        store: 'list',
        doubly,
        hasTail,
        nodes,
        head: nodes.length ? nodes[0].id : null,
        tail: hasTail && nodes.length ? nodes[nodes.length - 1].id : null,
        size: nodes.length,
        cursors: {},
    };
}

/** 상태를 깊이 베낀다. 스냅샷은 이것으로 만든다 — 얕게 베끼면 **뷰가 배열을 참조로
 *  붙들어** 뒤 장을 그린 뒤 앞 장이 함께 바뀐다. 그래프 탐색에서 한 번 데인 자리다. */
export function dsCloneState(s) {
    if (s.store === 'array') {
        return {
            ...s,
            slots: s.slots.map((it) => (it ? {...it} : null)),
            cursors: {...s.cursors},
        };
    }
    return {
        ...s,
        nodes: s.nodes.map((nd) => ({...nd})),
        cursors: {...s.cursors},
    };
}

/* ---------------------------------------------------------------
   기록기
   --------------------------------------------------------------- */

/**
 * @param {object} state 앞 판이 끝난 상태. **이 함수는 원본을 건드리지 않는다.**
 * @returns `{rec, begin, finish}`. 연산은 `run(rec, ...)` 안에서 `rec`만 쓴다.
 */
export function createDsRecorder(state) {
    const s = dsCloneState(state);
    const frames = [];
    const counts = {access: 0, move: 0, link: 0};

    let note = '';
    let focus = [];        // 지금 들여다보는 칸·마디
    let moving = [];       // 방금 움직인 것
    let linkFix = [];      // 방금 고쳐 쓴 링크 [{from, to, dir}]
    let newborn = null;    // 아직 매달리지 않은 새 마디
    let doomed = null;     // 곧 사라질 칸·마디
    let banner = null;     // 「꽉 찼습니다」처럼 판 전체에 붙는 말

    function snap(act) {
        frames.push({
            state: dsCloneState(s),
            act,
            marks: {
                focus: [...focus],
                moving: [...moving],
                linkFix: linkFix.map((l) => ({...l})),
                newborn,
                doomed,
                banner,
            },
            counts: {...counts},
            say: note,
        });
        /* 한 장짜리 표시는 그리고 나면 끈다. 다음 장까지 남으면 어디를 보라는 건지 흐려진다.
           **`newborn`과 `doomed`는 끄지 않는다** — 그 마디가 화면에 있는 동안 내내
           「아직 안 매달린 것」·「곧 사라질 것」이어야 하고, 치우는 것은 연산이 정한다. */
        focus = [];
        moving = [];
        linkFix = [];
    }

    const rec = {
        get size() { return s.size; },
        get cap() { return s.cap; },
        get state() { return s; },

        /** 설명 한 줄. 지금부터 쌓이는 장에 붙는다. */
        say(text) { note = text; return rec; },
        /** 판 전체에 붙는 말. 「꽉 찼습니다」처럼 **연산이 아무 일도 못 한** 자리에 쓴다. */
        flag(text) { banner = text; return rec; },
        clearFlag() { banner = null; return rec; },

        /** 커서(head·top·front·i 같은 것)를 옮긴다. 화면에 이름표로 뜬다. */
        cursor(name, at) {
            if (at === null || at === undefined) delete s.cursors[name];
            else s.cursors[name] = at;
            return rec;
        },
        clearCursors() { s.cursors = {}; return rec; },

        /** 아무 일도 없지만 한 장 남긴다. 설명만 바뀌는 자리에 쓴다. */
        mark(kind = 'mark') { snap({kind}); return rec; },

        /* ---- 칸(배열) ---- */

        /** 칸 하나를 들여다본다. **인덱스로 바로 짚는 것이라 몇 번째든 한 번이다** —
         *  이것이 배열의 성질이고, 리스트의 `walk`와 나란히 놓았을 때 뜻이 산다. */
        at(i) {
            counts.access++;
            focus = [i];
            snap({kind: 'at', i});
            return s.slots[i];
        },
        /** 세지 않고 들여다본다. 연산이 조건을 따지는 중간 계산에 쓴다. */
        peek: (i) => s.slots[i],

        /** 칸에 원소를 **쓴다.** */
        write(i, item) {
            counts.access++;
            counts.move++;
            s.slots[i] = item;
            moving = [i];
            snap({kind: 'write', i});
            return rec;
        },

        /** 칸의 원소를 옆 칸으로 **민다.** 넣고 빼는 값이 아니라 **밀려나는 값**이
         *  배열의 비용이라, 한 칸씩 한 장으로 남긴다. */
        shift(from, to) {
            counts.access += 2;
            counts.move++;
            s.slots[to] = s.slots[from];
            s.slots[from] = null;
            moving = [to];
            focus = [from];
            snap({kind: 'shift', from, to});
            return rec;
        },

        /** 칸을 **비운다.** */
        clear(i) {
            counts.access++;
            const gone = s.slots[i];
            s.slots[i] = null;
            focus = [i];
            snap({kind: 'clear', i});
            return gone;
        },

        setSize(v) { s.size = v; return rec; },

        /* ---- 마디(연결 리스트) ---- */

        nodeById: (id) => s.nodes.find((nd) => nd.id === id) || null,
        nodeAt: (pos) => s.nodes[pos] || null,
        posOf: (id) => s.nodes.findIndex((nd) => nd.id === id),
        get nodes() { return s.nodes; },
        get head() { return s.head; },
        get tail() { return s.tail; },

        /** 새 마디를 만든다. **아직 아무 데도 매달려 있지 않다** — 화면에서는 줄 아래
         *  따로 떠 있다. 링크를 걸기 «전»의 이 상태를 보여 주는 것이 요점이다. */
        newNode(v, pos) {
            const nd = {...dsItem(v), next: null, prev: null, floating: true};
            s.nodes.splice(pos, 0, nd);
            newborn = nd.id;
            snap({kind: 'new-node', id: nd.id});
            return nd;
        },

        /** 링크 하나를 고쳐 쓴다. **자료구조에서 실제로 일어나는 일은 이것뿐이다.**
         *  `fromId`가 `null`이면 머리·꼬리 포인터를 고쳐 쓰는 것이고, 그것도 한 번으로 센다. */
        link(fromId, toId, dir = 'next') {
            counts.link++;
            if (fromId === null) {
                if (dir === 'next') s.head = toId; else s.tail = toId;
            } else {
                const nd = rec.nodeById(fromId);
                nd[dir] = toId;
            }
            linkFix = [{from: fromId, to: toId, dir}];
            snap({kind: 'link', from: fromId, to: toId, dir});
            return rec;
        },

        /** 마디를 줄에 **내려놓는다.** 링크가 다 걸린 뒤라야 부른다. */
        settle(id) {
            const nd = rec.nodeById(id);
            nd.floating = false;
            newborn = null;
            moving = [id];
            snap({kind: 'settle', id});
            return rec;
        },

        /** 링크를 **따라간다.** 마디 하나를 지나는 것이 한 번이다 —
         *  k번째에 닿으려면 k번 걸리는 것이 곧 연결 리스트의 비용이다. */
        walk(id, name = 'p') {
            counts.access++;
            s.cursors[name] = id;
            focus = [id];
            snap({kind: 'walk', id});
            return rec.nodeById(id);
        },

        /** 곧 떼어 낼 마디로 찍는다. 아직 지우지는 않는다. */
        doom(id) {
            doomed = id;
            focus = [id];
            snap({kind: 'doom', id});
            return rec;
        },

        /** 마디를 **없앤다.** 링크를 다 돌려 놓은 뒤에 부른다. */
        dropNode(id) {
            const nd = rec.nodeById(id);
            s.nodes = s.nodes.filter((x) => x.id !== id);
            doomed = null;
            snap({kind: 'drop-node', id});
            return nd;
        },
    };

    return {
        rec,
        /** **손대기 전 모습으로 한 장 시작한다.** 없으면 0단계가 이미 「첫 걸음을 뗀 뒤」라,
         *  되감기를 끝까지 해도 연산 전 모습을 볼 수 없다.
         *  @param {string} first 0번 장에 붙일 설명. */
        begin(first) {
            note = first;
            snap({kind: 'start'});
            return rec;
        },
        finish(last) {
            note = last;
            /** **커서를 지우고 끝낸다.** 연산이 끝났는데 `p`가 어딘가를 가리키고 있으면
             *  다음 연산의 0번 장이 이미 지저분하다. */
            s.cursors = {};
            snap({kind: 'finish'});
            return {
                frames,
                counts: {...counts},
                state: dsCloneState(s),
            };
        },
    };
}

/**
 * 연산 하나를 처음부터 끝까지 돌려 스냅샷 열을 얻는다.
 *
 * @param {object} op    등록부의 연산
 * @param {object} state 앞 판이 끝난 상태
 * @param {*}      arg   연산이 받는 값(넣을 값 · 자리 번호). 없으면 `null`
 */
export function runDsOperation(op, state, arg) {
    const {rec, begin, finish} = createDsRecorder(state);
    begin(op.opening ? op.opening(rec, arg) : '연산을 시작합니다.');
    const closing = op.run(rec, arg);
    return finish(closing || '연산이 끝났습니다.');
}

/**
 * 상태가 성한가 — **화면에 보이는 것과 실제로 이어진 것이 같은가.**
 *
 * 링크를 고치다 한 줄만 빠뜨려도 화면에서는 그럴듯해 보이는데 줄이 끊겨 있거나
 * 고리가 되어 있다. 눈으로는 못 잡는 자리라 검사가 붙든다.
 *
 * @returns {string|null} 어긋난 것이 있으면 그 까닭, 성하면 `null`
 */
export function dsStateFault(s) {
    if (s.store === 'array') {
        const filled = s.slots.filter(Boolean).length;
        if (s.slots.length !== s.cap) return `칸이 ${s.slots.length}개다(정해 둔 것 ${s.cap}개)`;
        if (filled !== s.size) return `원소가 ${filled}개인데 크기는 ${s.size}이다`;
        return null;
    }

    const byId = new Map(s.nodes.map((nd) => [nd.id, nd]));
    if (byId.size !== s.nodes.length) return '같은 이름의 마디가 둘 있다';

    // 떠 있는 마디는 줄에 없는 것이 정상이다. 줄만 따로 세어 본다.
    const settled = s.nodes.filter((nd) => !nd.floating);
    const chain = [];
    let at = s.head;
    let guard = 0;
    while (at !== null && at !== undefined) {
        if (guard++ > s.nodes.length + 2) return '링크가 고리를 이룬다';
        const nd = byId.get(at);
        if (!nd) return `링크가 없는 마디(${at})를 가리킨다`;
        chain.push(nd);
        at = nd.next;
    }
    if (chain.length !== settled.length) {
        return `줄에 매달린 마디가 ${chain.length}개인데 떠 있지 않은 마디는 ${settled.length}개다`;
    }
    if (chain.length !== s.size) return `줄이 ${chain.length}개인데 크기는 ${s.size}이다`;
    if (s.hasTail) {
        if (chain.length && s.tail !== chain[chain.length - 1].id) return '꼬리 포인터가 마지막 마디를 가리키지 않는다';
        if (!chain.length && s.tail !== null) return '비었는데 꼬리 포인터가 남아 있다';
    } else if (s.tail !== null) {
        return '꼬리 포인터를 두지 않기로 한 구조인데 값이 들어 있다';
    }
    if (!chain.length && s.head !== null) return '비었는데 머리 포인터가 남아 있다';

    if (s.doubly) {
        for (let i = 0; i < chain.length; i++) {
            const want = i === 0 ? null : chain[i - 1].id;
            if (chain[i].prev !== want) return `${i}번째 마디의 되돌아가는 링크가 어긋났다`;
        }
    }
    return null;
}

/** 줄에 매달린 차례대로 값을 뽑는다. **`nodes` 차례가 아니라 링크를 따라간다** —
 *  둘이 어긋나는 것이야말로 잡아야 할 결함이라, 여기서 링크를 믿어야 대조가 뜻을 가진다. */
export function dsValues(s) {
    if (s.store === 'array') {
        /* **원형 큐는 칸 차례로 읽으면 안 된다.** 자리 번호가 끝을 지나 돌아온 뒤에는
           칸에 놓인 차례와 줄을 선 차례가 다르다 — front에서 개수만큼 돌며 읽어야
           실제로 나올 차례가 나온다. 칸 차례로 읽으면 넣은 순서가 뒤바뀐 채로
           다른 구조에 옮겨 가고, 그러면 탭을 옮겼을 뿐인데 자료가 달라진다. */
        if (s.ring) {
            const out = [];
            for (let k = 0; k < s.size; k++) {
                const it = s.slots[(s.front + k) % s.cap];
                if (it) out.push(it.v);
            }
            return out;
        }
        return s.slots.filter(Boolean).map((it) => it.v);
    }
    const byId = new Map(s.nodes.map((nd) => [nd.id, nd]));
    const out = [];
    let at = s.head;
    let guard = 0;
    while (at !== null && at !== undefined && guard++ <= s.nodes.length + 2) {
        const nd = byId.get(at);
        if (!nd) break;
        out.push(nd.v);
        at = nd.next;
    }
    return out;
}
