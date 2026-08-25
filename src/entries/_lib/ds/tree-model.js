/* 트리 시뮬레이터의 **진리**. 선형 자료구조와 같은 뼈대다 —
 * 연산이 화면을 직접 만지지 않고 이 기록기에 부탁하면 부탁 한 번마다 스냅샷이 한 장 쌓이고,
 * 판이 끝나면 그 끝 상태가 다음 판의 시작이 된다 → `ds-model.js`
 *
 * **담는 방식이 둘이다. 그리고 그 둘이 다른 것이 이 페이지의 알맹이다.**
 *
 *   `linked`  마디가 링크로 이어진다. 이진 탐색 트리와 AVL 트리가 쓴다.
 *             모양이 자료에 따라 달라지므로 **어떤 모양이 되었는지가 곧 성능**이다.
 *   `heap`    **평범한 배열이다.** 부모와 자식을 링크가 아니라 «자리 번호 계산»으로 잇는다
 *             (부모 `(i-1)/2`, 자식 `2i+1`·`2i+2`). 힙을 트리로만 그리면 학생은
 *             링크가 있다고 여기는데, 실제로 힙은 링크를 하나도 쓰지 않는다.
 *             그래서 트리와 배열을 **한 화면에 나란히** 두고 같은 색으로 묶는다.
 *
 * **세는 값이 셋이다.**
 *
 *   `비교`  두 값을 대 본다              — 트리에서는 이것이 곧 «내려간 깊이»다
 *   `이동`  원소를 다른 «칸»으로 옮긴다  — 힙 쪽에서만 늘어난다
 *   `링크`  링크 하나를 고쳐 쓴다        — 이진 탐색 트리·AVL 쪽에서만 늘어난다
 */

let nextNodeId = 1;

export function treeResetIds() {
    nextNodeId = 1;
}

/* ---------------------------------------------------------------
   처음 상태
   --------------------------------------------------------------- */

/** 링크로 이은 트리. **값을 하나씩 넣어 만든다** — 넣는 차례가 모양을 정하기 때문이다. */
export function treeLinkedState(values = [], {balanced = false} = {}) {
    const s = {
        kind: 'linked',
        balanced,
        nodes: [],
        root: null,
        size: 0,
        cursors: {},
        emitted: [],
    };
    for (const v of values) treePlainInsert(s, v);
    return s;
}

/** 화면 밖에서 트리를 세울 때 쓴다. **기록을 남기지 않는다** — 처음 상태를 만들거나
 *  검사가 기대값을 따로 구할 때만 부른다. 회전은 하지 않으므로 AVL의 처음 상태는
 *  값을 넣은 차례 그대로의 모양이 된다.
 *
 *  **같은 값은 넣지 않는다.** 화면의 연산(`bstInsert`)이 그렇게 막으므로 여기서만
 *  다르게 굴면, 이 함수를 쓰는 날 두 곳이 어긋난 트리를 만든다. */
export function treePlainInsert(s, v) {
    if (byId(s, s.root) && treeInorder(s).includes(v)) return null;
    const nd = {id: nextNodeId++, v, left: null, right: null, parent: null, height: 1, floating: false};
    s.nodes.push(nd);
    s.size++;
    if (s.root === null) { s.root = nd.id; return nd; }
    let at = byId(s, s.root);
    for (;;) {
        const side = v < at.v ? 'left' : 'right';
        if (at[side] === null) {
            at[side] = nd.id;
            nd.parent = at.id;
            break;
        }
        at = byId(s, at[side]);
    }
    treeRefreshHeights(s);
    return nd;
}

/** 배열로 담는 힙. `cap`은 칸 수 — 배열이라는 것을 화면에서 감추지 않는다. */
export function heapState(values = [], cap = 15) {
    const slots = Array.from({length: cap}, () => null);
    values.forEach((v, i) => { slots[i] = {id: nextNodeId++, v}; });
    return {
        kind: 'heap',
        cap,
        slots,
        size: values.length,
        cursors: {},
        emitted: [],
    };
}

export const byId = (s, id) => s.nodes.find((n) => n.id === id) || null;

export function treeCloneState(s) {
    if (s.kind === 'heap') {
        return {
            ...s,
            slots: s.slots.map((it) => (it ? {...it} : null)),
            cursors: {...s.cursors},
            emitted: [...s.emitted],
        };
    }
    return {
        ...s,
        nodes: s.nodes.map((n) => ({...n})),
        cursors: {...s.cursors},
        emitted: [...s.emitted],
    };
}

/** 마디 높이를 다시 잰다. AVL은 이 값으로 균형 인수를 낸다. */
export function treeRefreshHeights(s) {
    const walk = (id) => {
        if (id === null) return 0;
        const nd = byId(s, id);
        if (!nd) return 0;
        nd.height = 1 + Math.max(walk(nd.left), walk(nd.right));
        return nd.height;
    };
    walk(s.root);
}

/** 균형 인수 — 왼쪽 높이 빼기 오른쪽 높이. AVL은 이 값이 −1·0·1이어야 한다. */
export function balanceOf(s, nd) {
    const h = (id) => (id === null ? 0 : (byId(s, id)?.height ?? 0));
    return h(nd.left) - h(nd.right);
}

/** 트리 높이. **찾기에 드는 값이 곧 이 수**라, 화면이 늘 보여 준다. */
export function treeHeight(s) {
    if (s.kind === 'heap') return s.size === 0 ? 0 : Math.floor(Math.log2(s.size)) + 1;
    const nd = byId(s, s.root);
    return nd ? nd.height : 0;
}

/** 중위 순회로 값을 뽑는다. **이진 탐색 트리라면 오름차순이어야 한다** —
 *  검사가 이것으로 트리가 성한지 본다. */
export function treeInorder(s) {
    const out = [];
    const walk = (id) => {
        if (id === null) return;
        const nd = byId(s, id);
        if (!nd) return;
        walk(nd.left);
        out.push(nd.v);
        walk(nd.right);
    };
    walk(s.root);
    return out;
}

/** 담긴 값 — 구조와 상관없이 «무엇이 들어 있는가». 탭을 옮길 때 이 값을 물려준다. */
export function treeValues(s) {
    if (s.kind === 'heap') return s.slots.filter(Boolean).slice(0, s.size).map((it) => it.v);
    return treeInorder(s);
}

/**
 * 상태가 성한가 — **화면에 보이는 것과 실제로 이어진 것이 같은가.**
 * @returns {string|null} 어긋난 것이 있으면 그 까닭, 성하면 `null`
 */
export function treeStateFault(s) {
    if (s.kind === 'heap') {
        const filled = s.slots.filter(Boolean).length;
        if (filled !== s.size) return `칸에 든 것이 ${filled}개인데 크기는 ${s.size}이다`;
        /* **힙은 «빈틈이 없어야» 한다.** 완전 이진 트리라는 성질이 곧 「배열로 담을 수
           있다」의 근거라, 가운데가 비면 트리 그림과 배열이 어긋난다. */
        for (let i = 0; i < s.size; i++) if (!s.slots[i]) return `${i}번 칸이 비었다`;
        for (let i = 1; i < s.size; i++) {
            const p = Math.floor((i - 1) / 2);
            if (s.slots[p].v < s.slots[i].v) {
                return `${p}번(${s.slots[p].v})이 자식 ${i}번(${s.slots[i].v})보다 작다`;
            }
        }
        return null;
    }

    const ids = new Set(s.nodes.map((n) => n.id));
    if (ids.size !== s.nodes.length) return '같은 이름의 마디가 둘 있다';

    const seen = new Set();
    let bad = null;
    const walk = (id, parent, lo, hi) => {
        if (id === null || bad) return 0;
        if (seen.has(id)) { bad = '같은 마디가 두 번 매달려 있다'; return 0; }
        seen.add(id);
        const nd = byId(s, id);
        if (!nd) { bad = `없는 마디(${id})를 가리킨다`; return 0; }
        if (nd.parent !== parent) { bad = `${nd.v}의 부모 링크가 어긋났다`; return 0; }
        if (nd.v < lo || nd.v > hi) { bad = `${nd.v}가 이진 탐색 트리의 자리를 벗어났다`; return 0; }
        const lh = walk(nd.left, id, lo, nd.v);
        const rh = walk(nd.right, id, nd.v, hi);
        const h = 1 + Math.max(lh, rh);
        if (nd.height !== h) { bad = `${nd.v}의 높이가 ${nd.height}로 적혀 있는데 실제로는 ${h}이다`; }
        if (s.balanced && Math.abs(lh - rh) > 1) {
            bad = `${nd.v}의 균형 인수가 ${lh - rh}다. AVL 트리는 −1·0·1이어야 한다`;
        }
        return h;
    };
    walk(s.root, null, -Infinity, Infinity);
    if (bad) return bad;

    // 떠 있는 마디는 아직 매달리지 않은 것이라 줄 밖에 있는 것이 정상이다.
    const settled = s.nodes.filter((n) => !n.floating).length;
    if (seen.size !== settled) return `매달린 마디가 ${seen.size}개인데 떠 있지 않은 마디는 ${settled}개다`;
    if (seen.size !== s.size) return `매달린 마디가 ${seen.size}개인데 크기는 ${s.size}이다`;
    return null;
}

/* ---------------------------------------------------------------
   기록기
   --------------------------------------------------------------- */

export function createTreeRecorder(state) {
    const s = treeCloneState(state);
    const frames = [];
    const counts = {compare: 0, move: 0, link: 0};

    let note = '';
    let focus = [];
    let moving = [];
    let linkFix = [];
    let newborn = null;
    let doomed = null;
    let banner = null;
    let spot = null;      // 「여기에 달릴 자리」 표시 {parent, side}

    function snap(act) {
        frames.push({
            state: treeCloneState(s),
            act,
            marks: {
                focus: [...focus],
                moving: [...moving],
                linkFix: linkFix.map((l) => ({...l})),
                newborn,
                doomed,
                banner,
                spot: spot ? {...spot} : null,
            },
            counts: {...counts},
            say: note,
        });
        focus = [];
        moving = [];
        linkFix = [];
    }

    const rec = {
        get size() { return s.size; },
        get cap() { return s.cap; },
        get root() { return s.root; },
        get state() { return s; },
        node: (id) => byId(s, id),

        say(text) { note = text; return rec; },
        flag(text) { banner = text; return rec; },
        clearFlag() { banner = null; return rec; },
        mark(kind = 'mark') { snap({kind}); return rec; },
        spotAt(parent, side) { spot = parent === null ? null : {parent, side}; return rec; },

        cursor(name, id) {
            if (id === null || id === undefined) delete s.cursors[name];
            else s.cursors[name] = id;
            return rec;
        },

        /** 순회가 내놓는 값. 화면 아래에 차례로 쌓인다. */
        emit(v) { s.emitted = [...s.emitted, v]; return rec; },
        clearEmitted() { s.emitted = []; return rec; },

        /* ---- 링크로 이은 트리 ---- */

        /** 마디 하나를 들여다보며 값을 견준다. **트리에서는 이 횟수가 곧 내려간 깊이다.** */
        compareAt(id, v) {
            counts.compare++;
            focus = [id];
            s.cursors.p = id;
            const nd = byId(s, id);
            const d = v - nd.v;
            snap({kind: 'compare', id, v, result: d});
            return d;
        },

        /** 값을 견주지 않고 지나가기만 한다. 순회가 쓴다. */
        visit(id) {
            focus = [id];
            s.cursors.p = id;
            snap({kind: 'visit', id});
            return byId(s, id);
        },

        newNode(v) {
            const nd = {id: nextNodeId++, v, left: null, right: null, parent: null, height: 1, floating: true};
            s.nodes.push(nd);
            newborn = nd.id;
            snap({kind: 'new-node', id: nd.id});
            return nd;
        },

        /** 링크 하나를 고쳐 쓴다. `parentId`가 `null`이면 뿌리 포인터다. */
        link(parentId, childId, side) {
            counts.link++;
            if (parentId === null) {
                s.root = childId;
                if (childId !== null) byId(s, childId).parent = null;
            } else {
                byId(s, parentId)[side] = childId;
                if (childId !== null) byId(s, childId).parent = parentId;
            }
            linkFix = [{from: parentId, to: childId, side}];
            snap({kind: 'link', from: parentId, to: childId, side});
            return rec;
        },

        settle(id) {
            const nd = byId(s, id);
            nd.floating = false;
            newborn = null;
            spot = null;
            moving = [id];
            s.size++;
            treeRefreshHeights(s);
            snap({kind: 'settle', id});
            return rec;
        },

        doom(id) { doomed = id; focus = [id]; snap({kind: 'doom', id}); return rec; },

        dropNode(id) {
            s.nodes = s.nodes.filter((n) => n.id !== id);
            s.size--;
            doomed = null;
            treeRefreshHeights(s);
            snap({kind: 'drop-node', id});
            return rec;
        },

        /** 값만 맞바꾼다. 마디는 제자리에 둔다 — **이진 탐색 트리의 「두 자식 지우기」**가
         *  실제로 하는 일이 이것이라, 링크를 다시 얽는 것으로 그리면 오히려 어렵다. */
        swapValues(idA, idB) {
            counts.move += 2;
            const a = byId(s, idA);
            const b = byId(s, idB);
            const t = a.v;
            a.v = b.v;
            b.v = t;
            moving = [idA, idB];
            snap({kind: 'swap-values', a: idA, b: idB});
            return rec;
        },

        refreshHeights() { treeRefreshHeights(s); return rec; },

        /* ---- 배열로 담는 힙 ---- */

        heapAt: (i) => s.slots[i],

        /** 힙에서 두 «칸»을 맞바꾼다. 링크가 아니라 **이동**이다. */
        heapSwap(i, j) {
            counts.move += 2;
            const t = s.slots[i];
            s.slots[i] = s.slots[j];
            s.slots[j] = t;
            moving = [i, j];
            snap({kind: 'heap-swap', i, j});
            return rec;
        },

        /** 힙의 두 칸을 견준다. */
        heapCompare(i, j) {
            counts.compare++;
            focus = [i, j];
            const d = s.slots[i].v - s.slots[j].v;
            snap({kind: 'heap-compare', i, j, result: d});
            return d;
        },

        /** 칸 하나의 값과 찾는 값을 견준다. **세지 않으면 「힙은 찾기가 O(n)」이
         *  화면의 숫자로 뒷받침되지 않는다** — 말만 남고 근거가 없어진다. */
        heapCompareValue(i, v) {
            counts.compare++;
            focus = [i];
            const d = s.slots[i].v - v;
            snap({kind: 'heap-compare-value', i, v, result: d});
            return d;
        },

        heapWrite(i, v) {
            counts.move++;
            s.slots[i] = {id: nextNodeId++, v};
            moving = [i];
            snap({kind: 'heap-write', i});
            return rec;
        },

        heapClear(i) {
            const gone = s.slots[i];
            s.slots[i] = null;
            snap({kind: 'heap-clear', i});
            return gone;
        },

        heapSetSize(n) { s.size = n; return rec; },
        heapFocus(list) { focus = [...list]; snap({kind: 'heap-focus'}); return rec; },
    };

    return {
        rec,
        begin(first) {
            note = first;
            snap({kind: 'start'});
            return rec;
        },
        finish(last) {
            note = last;
            s.cursors = {};
            spot = null;
            snap({kind: 'finish'});
            return {frames, counts: {...counts}, state: treeCloneState(s)};
        },
    };
}

/**
 * 연산 하나를 처음부터 끝까지 돌려 스냅샷 열을 얻는다.
 */
export function runTreeOperation(op, state, arg) {
    const {rec, begin, finish} = createTreeRecorder(state);
    begin(op.opening ? op.opening(rec, arg) : '연산을 시작합니다.');
    const closing = op.run(rec, arg);
    return finish(closing || '연산이 끝났습니다.');
}
