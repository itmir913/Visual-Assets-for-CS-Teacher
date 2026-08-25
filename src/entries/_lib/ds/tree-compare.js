/* 비용 비교 — **같은 값을 이진 탐색 트리와 AVL 트리에 한꺼번에 넣는다.**
 *
 * 「최악에 O(n)」이라는 말은 외울 수 있지만, **오름차순으로 넣은 트리가 한 줄로
 * 늘어지는 것을 보기 전에는** 그 말이 무슨 뜻인지 서지 않는다. 그리고 그 최악은
 * 드문 일이 아니다 — 학번·날짜·번호는 대개 정렬된 채로 들어온다.
 *
 * 축은 선형 자료구조 페이지와 같은 잣대로 둔다 — **작업량(비교 + 이동 + 링크)**.
 * 같은 만큼 일했을 때 어디까지 갔는지를 보므로 먼저 끝난 쪽이 일을 덜 한 것이 된다.
 */

import {runTreeOperation, treeLinkedState, treeHeight} from './tree-model.js';

export const treeWorkOf = (counts) => counts.compare + counts.move + counts.link;

/** 표에서 개수를 키워 가며 재는 자리. */
export const TREE_MEASURE_SIZES = [4, 8, 16, 32, 64];

/**
 * 두 트리에 같은 연산을 물려 작업량을 한 칸씩 나란히 넘길 수 있는 장을 만든다.
 *
 * @param {object} op     비용 비교의 연산(`pair`에 두 벌이 들어 있다)
 * @param {object} states `{bst, avl}`
 */
export function buildTreeCompare(op, states, arg) {
    const runs = [
        {
            kind: 'bst',
            name: '이진 탐색 트리',
            out: runTreeOperation({...op, ...op.pair.bst}, states.bst, arg),
        },
        {
            kind: 'avl',
            name: 'AVL 트리',
            out: runTreeOperation({...op, ...op.pair.avl}, states.avl, arg),
        },
    ].map((r) => {
        const work = r.out.frames.map((f) => treeWorkOf(f.counts));
        return {...r, work, total: work[work.length - 1] || 0};
    });

    const maxWork = Math.max(1, ...runs.map((r) => r.total));
    const cursor = runs.map(() => 0);
    const frames = [];

    for (let t = 0; t <= maxWork; t++) {
        const lanes = runs.map((r, k) => {
            while (cursor[k] + 1 < r.out.frames.length && r.work[cursor[k] + 1] <= t) cursor[k]++;
            return {
                kind: r.kind,
                name: r.name,
                frame: r.out.frames[cursor[k]],
                done: t >= r.total,
                finishedWork: r.total,
                height: treeHeight(r.out.frames[cursor[k]].state),
            };
        });
        const finished = lanes.filter((l) => l.done).length;
        frames.push({
            lanes,
            counts: {compare: 0, move: 0, link: 0},
            say: finished === 0
                ? '두 트리에 **같은 값을 같은 차례로** 넣습니다. 작업량(비교 + 이동 + 링크)을'
                  + ' 똑같이 나눠 주므로 **먼저 끝난 쪽이 일을 덜 한 것**입니다.'
                : (finished < 2
                    ? `${lanes.find((l) => l.done).name} 쪽이 먼저 끝났습니다.`
                    : closingLine(runs, lanes)),
        });
    }

    return {frames, runs};
}

function closingLine(runs, lanes) {
    const hb = lanes[0].height;
    const ha = lanes[1].height;
    if (hb === ha) {
        return '둘 다 끝났습니다. **이번에는 높이가 같습니다** — '
            + '넣는 차례가 좋으면 이진 탐색 트리도 잘 자랍니다.';
    }
    return `둘 다 끝났습니다. **높이가 ${hb} 대 ${ha}입니다.** `
        + `AVL 트리는 돌리는 값을 치르고 높이를 ${ha}로 눌러 두었습니다`
        + `(그 값이 작업량 ${runs[1].total} 대 ${runs[0].total}입니다).`;
}

/**
 * **장을 남기지 않고 개수를 키워 가며 높이만 잰다.**
 * 한 판을 넘겨서는 볼 수 없는 것 — 개수가 늘 때 두 트리의 높이가 어떻게 갈리는가 — 을 본다.
 *
 * @param {object} ops `{bstInsert, avlInsert}` — 등록부의 「넣기」 두 벌
 * @returns {{sizes:number[], rows:object[]}}
 */
export function measureTreeHeight(ops, sizes = TREE_MEASURE_SIZES) {
    const rows = [];
    for (const [orderId, orderName] of [['asc', '오름차순으로 넣기'], ['shuffle', '섞어서 넣기']]) {
        const bst = [];
        const avl = [];
        for (const n of sizes) {
            const values = orderId === 'asc'
                ? Array.from({length: n}, (_, i) => i + 1)
                : shuffled(n);
            bst.push(heightAfter(ops.bstInsert, values, false));
            avl.push(heightAfter(ops.avlInsert, values, true));
        }
        rows.push({orderId, orderName, bst, avl});
    }
    return {sizes, rows};
}

/** 값을 차례로 넣은 뒤의 트리 높이. **화면과 같은 연산을 쓴다** —
 *  표만 따로 계산하면 화면에서 벌어지는 일과 어긋날 수 있다. */
function heightAfter(insertOp, values, balanced) {
    let state = treeLinkedState([], {balanced});
    for (const v of values) state = runTreeOperation(insertOp, state, {v}).state;
    return treeHeight(state);
}

/** 늘 같은 차례로 섞는다. **씨앗을 못박는다** — 볼 때마다 표가 달라지면 견줄 수가 없다. */
function shuffled(n) {
    const a = Array.from({length: n}, (_, i) => i + 1);
    let seed = 20260826;
    for (let i = a.length - 1; i > 0; i--) {
        seed = (seed * 1103515245 + 12345) >>> 0;
        const j = seed % (i + 1);
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}
