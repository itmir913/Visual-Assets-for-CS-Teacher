/* 트리를 **실제로 돌려** 대조한다.
 *
 * 트리는 눈으로 봐서는 성한지 알기가 특히 어렵다. 그림이 그럴듯해도 부모 링크가
 * 어긋나 있거나, 회전 뒤 크기 차례가 깨져 있거나, AVL이라면서 균형이 무너져 있을 수 있다.
 * **카드에 적힌 말과 화면에서 벌어지는 일이 어긋나는 것이 가장 나쁜 결함이다.**
 *
 * **정답을 베끼지 않는다.** 기대값은 트리가 내놓은 것이 아니라 평범한 배열을
 * 정렬해 따로 구한다. 같은 코드로 두 번 구하면 아무것도 대조하지 못한다.
 */

import {
    TREE_STRUCTS, TREE_COMPARE, TREE_START, TREE_INSERT_OPS, HEAP_CAP,
} from '../src/entries/_lib/ds/tree-registry.js';
import {
    runTreeOperation, treeStateFault, treeInorder, treeValues, treeHeight,
    treeLinkedState, treeResetIds,
} from '../src/entries/_lib/ds/tree-model.js';
import {bstBuild, avlBuild, heapBuild, bstOps, avlOps, heapOps} from '../src/entries/_lib/ds/tree-ops.js';
import {buildTreeCompare, measureTreeHeight, treeWorkOf} from '../src/entries/_lib/ds/tree-compare.js';
import {loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 40) console.log('  ✗ ' + m); };

treeResetIds();

let seed = 20260826;
const rnd = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
};

/** 겹치지 않는 값 `n`개. */
function distinct(n, max = 99) {
    const seen = new Set();
    while (seen.size < n) seen.add(Math.floor(rnd() * max) + 1);
    return [...seen];
}

/* ================================================================
   1. 이진 탐색 트리 · AVL 트리 — **평범한 배열로 구한 답과 맞춘다**
   ================================================================ */

const LINKED = [
    {id: 'bst', name: '이진 탐색 트리', build: bstBuild, ops: bstOps, balanced: false},
    {id: 'avl', name: 'AVL 트리', build: avlBuild, ops: avlOps, balanced: true},
];

/** AVL 트리의 높이 상한. n개를 담은 AVL 트리는 이보다 깊을 수 없다 —
 *  **트리에게 묻지 않고 수식으로 따로 구한다.** */
const avlBound = (n) => (n === 0 ? 0 : Math.floor(1.4405 * Math.log2(n + 2) - 0.3277) + 1);

let linkedChecks = 0;

for (const spec of LINKED) {
    for (const start of [[], [42], [...TREE_START], [10, 20, 30, 40, 50, 60, 70], distinct(12)]) {
        for (const arg of [{v: 45}, {v: 5}, {v: 95}, {v: start[0] ?? 1}]) {
            let state = spec.build(start);
            const before = treeInorder(state);

            // 세워 놓은 것부터 성한가.
            const buildFault = treeStateFault(state);
            if (buildFault) {
                bad(`${spec.name} — 세운 트리가 성하지 않다(n=${start.length}): ${buildFault}`);
                continue;
            }
            const wantBuild = [...new Set(start)].sort((a, b) => a - b);
            if (before.join(',') !== wantBuild.join(',')) {
                bad(`${spec.name} — 세운 트리의 중위 순회가 [${before.join(' ')}]이다. `
                    + `있어야 할 것 [${wantBuild.join(' ')}]`);
            }
            if (spec.balanced && treeHeight(state) > avlBound(start.length)) {
                bad(`${spec.name} — n=${start.length}인데 높이가 ${treeHeight(state)}다`
                    + ` (상한 ${avlBound(start.length)})`);
            }

            for (const op of spec.ops) {
                const out = runTreeOperation(op, state, arg);
                linkedChecks++;

                const fault = treeStateFault(out.state);
                if (fault) {
                    bad(`${spec.name} · ${op.name}(${arg.v}, n=${start.length}) — 성하지 않다: ${fault}`);
                    break;
                }

                /* **기대값을 배열로 따로 구한다.** 넣으면 값이 하나 늘고, 빼면 하나 줄고,
                   찾기와 순회는 그대로다 — 어느 쪽이든 **늘 오름차순**이어야 한다. */
                const now = new Set(treeInorder(state));
                let want = [...now];
                if (op.id === 'insert') want = [...new Set([...now, arg.v])];
                if (op.id === 'remove') want = [...now].filter((x) => x !== arg.v);
                want.sort((a, b) => a - b);

                const got = treeInorder(out.state);
                if (got.join(',') !== want.join(',')) {
                    bad(`${spec.name} · ${op.name}(${arg.v}) — 중위 순회가 [${got.join(' ')}]이다. `
                        + `있어야 할 것 [${want.join(' ')}]`);
                }

                /* **찾기의 비교 횟수는 트리 높이를 넘을 수 없다.** 넘으면 「한 번 견줄 때마다
                   반대쪽 가지를 통째로 버린다」가 거짓이 된다. */
                if (op.id === 'search' && out.counts.compare > Math.max(1, treeHeight(state))) {
                    bad(`${spec.name} · 찾기(${arg.v}) — 높이가 ${treeHeight(state)}인데 `
                        + `${out.counts.compare}번 견주었다`);
                }

                if (spec.balanced && treeHeight(out.state) > avlBound(out.state.size)) {
                    bad(`${spec.name} · ${op.name}(${arg.v}) — n=${out.state.size}인데 `
                        + `높이가 ${treeHeight(out.state)}다 (상한 ${avlBound(out.state.size)})`);
                }

                /* **순회가 내놓은 차례가 맞는가.** 세 순회를 여기서 따로 계산해 맞춘다. */
                if (['pre', 'in', 'post'].includes(op.id)) {
                    const want2 = walkOrder(state, op.id);
                    const emitted = out.state.emitted;
                    if (emitted.join(',') !== want2.join(',')) {
                        bad(`${spec.name} · ${op.name} — [${emitted.join(' ')}]을 내놓았다. `
                            + `있어야 할 것 [${want2.join(' ')}]`);
                    }
                }

                if (!out.frames[0].say.trim()) bad(`${spec.name} · ${op.name} — 0번 장에 설명이 없다`);
                if (!out.frames[out.frames.length - 1].say.trim()) {
                    bad(`${spec.name} · ${op.name} — 끝 장에 설명이 없다`);
                }
                state = out.state;
            }
        }
    }
}

/** 순회 차례를 **따로** 구한다. 시뮬레이터의 순회 코드를 쓰지 않는다. */
function walkOrder(s, kind) {
    const byId = new Map(s.nodes.map((n) => [n.id, n]));
    const out = [];
    const go = (id) => {
        if (id === null || id === undefined) return;
        const nd = byId.get(id);
        if (!nd) return;
        if (kind === 'pre') out.push(nd.v);
        go(nd.left);
        if (kind === 'in') out.push(nd.v);
        go(nd.right);
        if (kind === 'post') out.push(nd.v);
    };
    go(s.root);
    return out;
}

console.log(`이진 탐색 트리·AVL 트리 — ${linkedChecks}판을 돌려 배열로 구한 답과 맞췄다`);

/* ================================================================
   2. 회전이 **크기 차례를 지키는가**

   회전은 자리를 바꾸는 일이므로, 잘못 짜면 그림은 반듯해지는데 이진 탐색 트리가
   아니게 된다. 「자리가 바뀌어도 차례는 그대로」라고 화면이 말하므로 그 말을 붙든다.
   ================================================================ */

let rotateChecks = 0;
for (let trial = 0; trial < 40; trial++) {
    const values = distinct(2 + Math.floor(rnd() * 14));
    let state = treeLinkedState([], {balanced: true});
    const soFar = [];
    for (const v of values) {
        const out = runTreeOperation(avlOps[0], state, {v});
        soFar.push(v);
        rotateChecks++;
        const want = [...soFar].sort((a, b) => a - b);
        const got = treeInorder(out.state);
        if (got.join(',') !== want.join(',')) {
            bad(`회전 — ${v}을(를) 넣은 뒤 차례가 [${got.join(' ')}]이 되었다. `
                + `있어야 할 것 [${want.join(' ')}]`);
            break;
        }
        const fault = treeStateFault(out.state);
        if (fault) { bad(`회전 — ${v}을(를) 넣은 뒤 성하지 않다: ${fault}`); break; }
        state = out.state;
    }
}
console.log(`회전 ${rotateChecks}판 — 돌린 뒤에도 크기 차례가 그대로인지 대조했다`);

/* ================================================================
   3. 힙 — **꺼내면 큰 것부터 나오는가**

   힙이 약속하는 것은 그것 하나다. 배열로 담았든 무엇이든, 계속 꺼냈을 때
   내림차순이 나오지 않으면 힙이 아니다. 기대값은 넣은 값을 그냥 정렬해 구한다.
   ================================================================ */

let heapChecks = 0;
for (let trial = 0; trial < 30; trial++) {
    const values = distinct(1 + Math.floor(rnd() * HEAP_CAP));
    let state = heapBuild(values, HEAP_CAP);
    heapChecks++;

    const fault = treeStateFault(state);
    if (fault) { bad(`힙 — 세운 힙이 성하지 않다: ${fault}`); continue; }

    const pulled = [];
    let guard = 0;
    while (state.size > 0 && guard++ < HEAP_CAP + 2) {
        const top = state.slots[0].v;
        const out = runTreeOperation(heapOps[1], state, {});
        const f = treeStateFault(out.state);
        if (f) { bad(`힙 — 꺼낸 뒤 성하지 않다: ${f}`); break; }
        /* **꺼낸 값이 실제로 그때의 최댓값인가.** 화면은 「가장 큰 값」이라고 말한다. */
        const wasMax = Math.max(...treeValues(state));
        if (top !== wasMax) bad(`힙 — 뿌리가 ${top}인데 그때의 최댓값은 ${wasMax}였다`);
        pulled.push(top);
        state = out.state;
    }
    const want = [...values].sort((a, b) => b - a);
    if (pulled.join(',') !== want.join(',')) {
        bad(`힙 — 꺼낸 차례가 [${pulled.join(' ')}]이다. 있어야 할 것 [${want.join(' ')}]`);
    }
}

/* **꽉 찬 힙에 더 넣으면 막아야 한다.** */
{
    let full = heapBuild(distinct(HEAP_CAP), HEAP_CAP);
    const out = runTreeOperation(heapOps[0], full, {v: 100});
    if (out.state.size !== HEAP_CAP) bad(`힙 — 꽉 찼는데 더 들어갔다(${out.state.size}개)`);
    if (!out.frames.some((f) => f.marks.banner)) bad('힙 — 꽉 찼는데 아무 말도 하지 않았다');
}

/* **힙의 「값 찾기」는 비교를 실제로 세어야 한다.** 「하나씩 다 봐야 합니다」라고 말해
   놓고 세는 값이 0이면, 화면의 숫자가 그 말을 뒷받침하지 못한다. */
{
    const values = distinct(HEAP_CAP);
    const state = heapBuild(values, HEAP_CAP);
    const missing = runTreeOperation(heapOps[2], state, {v: 100});
    if (missing.counts.compare !== HEAP_CAP) {
        bad(`힙 · 값 찾기 — 없는 값을 찾는데 ${missing.counts.compare}번만 견주었다`
            + ` (${HEAP_CAP}칸을 다 봐야 한다)`);
    }
}
console.log(`힙 ${heapChecks}판 — 꺼낸 차례가 내림차순인지, 꽉 찬 것을 막는지 대조했다`);

/* ================================================================
   4. **카드에 적은 값이 참인가**
   ================================================================ */

/* 「찾기」의 비교 횟수가 높이를 넘지 않는다는 것은 위에서 판마다 보았다.
   여기서는 **개수를 키웠을 때 실제로 그렇게 자라는지**를 본다. */
const GROW = [8, 16, 32, 64];
function searchWorkAt(build, ops, n) {
    const values = Array.from({length: n}, (_, i) => ((i * 37) % 97) + 1);
    const uniq = [...new Set(values)].slice(0, n);
    const state = build(uniq);
    const op = ops.find((o) => o.id === 'search');
    return runTreeOperation(op, state, {v: uniq[uniq.length - 1]}).counts.compare;
}

for (const spec of LINKED) {
    /* **재는 크기를 다 쓴다.** 양 끝만 보면 가운데가 어떻게 자랐는지 알 수 없다. */
    const seen = GROW.map((n) => searchWorkAt(spec.build, spec.ops, n));
    for (let k = 1; k < GROW.length; k++) {
        /* 개수를 두 배로 키웠는데 견주는 횟수가 두 배 넘게 늘면 log n이 아니다.
           (log n이면 두 배마다 «1»씩 는다 — 여유를 두어 2배로 잡는다.) */
        if (seen[k] > Math.max(2, seen[k - 1] * 2)) {
            bad(`${spec.name} · 찾기 — 개수를 ${GROW[k - 1]}→${GROW[k]}로 키우니 `
                + `견주는 횟수가 ${seen[k - 1]}→${seen[k]}이 되었다`);
        }
    }
    console.log(`  ${spec.name} 찾기의 견주는 횟수 — `
        + GROW.map((n, k) => `${n}개 ${seen[k]}`).join(' · '));
}

/* **오름차순으로 넣으면 이진 탐색 트리는 한 줄이 되어야 하고 AVL은 아니어야 한다.**
   이 페이지가 가르치려는 것이 바로 이것이라, 참이 아니면 페이지가 거짓말을 한다. */
const measured = measureTreeHeight(TREE_INSERT_OPS);
const ascRow = measured.rows.find((r) => r.orderId === 'asc');
const shuffleRow = measured.rows.find((r) => r.orderId === 'shuffle');
measured.sizes.forEach((n, k) => {
    if (ascRow.bst[k] !== n) {
        bad(`비용 표 — 오름차순으로 ${n}개를 넣었는데 이진 탐색 트리 높이가 ${ascRow.bst[k]}다`
            + ' (한 줄이면 개수와 같아야 한다)');
    }
    if (ascRow.avl[k] > avlBound(n)) {
        bad(`비용 표 — 오름차순 ${n}개에서 AVL 높이가 ${ascRow.avl[k]}다 (상한 ${avlBound(n)})`);
    }
    if (n >= 8 && !(ascRow.avl[k] < ascRow.bst[k])) {
        bad(`비용 표 — 오름차순 ${n}개에서 AVL이 더 낮지 않다`
            + ` (이진 탐색 ${ascRow.bst[k]} · AVL ${ascRow.avl[k]})`);
    }
    /* **섞어 넣으면 오름차순보다 낮아야 한다.** 예전에는 `높이 > n`을 보았는데,
       높이는 마디 수를 넘을 수 없으므로 **정의상 걸릴 수 없는 줄**이었다. */
    if (n >= 8 && !(shuffleRow.bst[k] < ascRow.bst[k])) {
        bad(`비용 표 — ${n}개에서 섞어 넣은 높이(${shuffleRow.bst[k]})가 `
            + `오름차순(${ascRow.bst[k]})보다 낮지 않다`);
    }
});

/* **「섞어 넣으면 이진 탐색 트리도 충분히 반듯하다」**고 화면이 말한다.
   재어 보니 오름차순과 다를 바 없다면 그 말이 거짓이 된다. */
const bigK = measured.sizes.length - 1;
if (!(shuffleRow.bst[bigK] < ascRow.bst[bigK] / 2)) {
    bad(`비용 표 — 섞어 넣은 높이(${shuffleRow.bst[bigK]})가 오름차순(${ascRow.bst[bigK]})의 `
        + '절반보다 낮지 않다. 「섞이면 그냥도 반듯하다」가 거짓이 된다');
}
console.log(`비용 표 — 개수 ${measured.sizes.join('·')}에서 높이가 적은 대로 자라는지 대조했다`);

/* ================================================================
   5. 비용 비교 — 먼저 끝난 쪽이 정말 일을 덜 했는가
   ================================================================ */

let raceChecks = 0;
for (const op of TREE_COMPARE.ops) {
    for (const start of [[], [...TREE_START], [10, 20, 30, 40]]) {
        const states = {bst: bstBuild(start), avl: avlBuild(start)};
        const arg = {v: 55};
        const trueWork = {
            bst: treeWorkOf(runTreeOperation({...op, ...op.pair.bst}, states.bst, arg).counts),
            avl: treeWorkOf(runTreeOperation({...op, ...op.pair.avl}, states.avl, arg).counts),
        };
        const built = buildTreeCompare(op, states, arg);
        const {frames} = built;
        raceChecks++;

        const doneAt = (k) => frames.findIndex((f) => f.lanes[k].done);
        const a = doneAt(0);
        const b = doneAt(1);
        if (a < 0 || b < 0) { bad(`비용 비교 · ${op.name} — 끝나지 않는 줄이 있다`); continue; }

        /* **끝나는 차례를 작업량과 대 보는 것은 뜻이 없다.**
         *
         * 배지는 `done: t >= r.total`로 붙고 장은 `t = 0…maxWork`로 만든다. 그러니
         * 「끝 배지가 붙는 장 번호」는 **정의상 작업량과 같은 수**이고, 그것을 작업량과
         * 견주는 판정은 `x < y && x > y`가 되어 **닿을 수 없는 가지**였다. 실제로 장을
         * 넘기는 규칙을 통째로 없애 놓아도 검사가 「전부 통과」를 냈다.
         *
         * 그래서 견줄 것을 바꾼다 — **「같은 작업량만큼씩 나눠 준다」는 규칙 자체**다.
         * 어느 장에서든 각 줄이 보이는 것은 «그때까지 한 일이 t 이하인 마지막 장»이어야 한다.
         * 이것이 참이라야 「먼저 끝난 쪽이 일을 덜 했다」가 비로소 뜻을 가진다. */
        for (let t = 0; t < frames.length; t++) {
            for (let k = 0; k < 2; k++) {
                const runFrames = built.runs[k].out.frames;
                const shown = runFrames.indexOf(frames[t].lanes[k].frame);
                if (shown < 0) {
                    bad(`비용 비교 · ${op.name} ${t}장 — 그 줄에 없는 장을 보이고 있다`);
                    break;
                }
                if (treeWorkOf(runFrames[shown].counts) > t) {
                    bad(`비용 비교 · ${op.name} ${t}장 — 아직 ${t}만큼 일하지 않았는데 `
                        + `작업량 ${treeWorkOf(runFrames[shown].counts)}짜리 장을 보인다`);
                    break;
                }
                const next = runFrames[shown + 1];
                if (next && treeWorkOf(next.counts) <= t) {
                    bad(`비용 비교 · ${op.name} ${t}장 — ${t}만큼 일했는데 다음 장`
                        + `(작업량 ${treeWorkOf(next.counts)})으로 넘어가지 않았다`);
                    break;
                }
            }
        }
        /* 끝 장은 두 줄 다 «그 줄의 마지막 장»이어야 한다. */
        for (let k = 0; k < 2; k++) {
            const runFrames = built.runs[k].out.frames;
            if (frames[frames.length - 1].lanes[k].frame !== runFrames[runFrames.length - 1]) {
                bad(`비용 비교 · ${op.name} — ${k === 0 ? '이진 탐색' : 'AVL'} 줄이 끝까지 가지 않았다`);
            }
        }
        /* 배지가 붙는 차례와 실제 작업량의 차례가 같아야 한다(같은 값이면 아무 쪽이나 좋다). */
        if (trueWork.bst !== trueWork.avl) {
            const first = trueWork.bst < trueWork.avl ? 0 : 1;
            if ((first === 0 ? a : b) > (first === 0 ? b : a)) {
                bad(`비용 비교 · ${op.name} — 일을 덜 한 쪽에 「끝」이 늦게 붙는다`);
            }
        }
        // 두 줄 다 성해야 한다.
        for (const lane of frames[frames.length - 1].lanes) {
            const f = treeStateFault(lane.frame.state);
            if (f) bad(`비용 비교 · ${op.name} — ${lane.name} 쪽이 성하지 않다: ${f}`);
        }
    }
}
console.log(`비용 비교 ${raceChecks}판 — 나눠 주는 규칙과 끝나는 차례를 대조했다`);

/* ================================================================
   AVL 빼기의 **연쇄 회전**

   카드는 「뺄 때의 펴기 · O(log n)곳 · 뿌리까지 올라가며 봐야 한다」고 한다.
   그런데 앞 절들은 마디 열몇 개짜리 트리에 빼기를 한 번씩만 걸어, **한 번 돌고 멈추어도
   통과했다.** 실제로 `avlRebalanceUp`이 첫 회전 뒤 곧바로 멈추게 고쳐 놓고 돌렸더니
   검사가 「전부 통과」를 냈다 — 카드가 내세우는 바로 그 성질이 검증되지 않고 있었다.

   그래서 **깊은 트리에서 여러 번 뺀다.** 곁들여 한 번의 빼기가 두 곳 이상 편 판이
   실제로 나오는지도 센다. 나오지 않으면 이 절 자체가 헛돈 것이므로 그것도 결함이다.
   ================================================================ */

let chainChecks = 0;
let deepestChain = 0;
for (let trial = 0; trial < 25; trial++) {
    const values = distinct(24 + Math.floor(rnd() * 12));
    let state = avlBuild(values);
    const remove = avlOps.find((o) => o.id === 'remove');
    const left = [...values];
    while (left.length > 2) {
        const pick = left.splice(Math.floor(rnd() * left.length), 1)[0];
        const out = runTreeOperation(remove, state, {v: pick});
        chainChecks++;
        const fault = treeStateFault(out.state);
        if (fault) {
            bad(`AVL 빼기 연쇄 — ${pick}을(를) 뺀 뒤 성하지 않다: ${fault}`
                + ` (넣은 차례 ${values.join(' ')})`);
            break;
        }
        if (treeHeight(out.state) > avlBound(out.state.size)) {
            bad(`AVL 빼기 연쇄 — n=${out.state.size}인데 높이가 ${treeHeight(out.state)}다`);
            break;
        }
        // 한 번의 빼기가 몇 곳을 폈는가 — 「돌립니다」 장을 센다.
        const spins = out.frames.filter((f) => f.act.kind === 'rotate').length;
        deepestChain = Math.max(deepestChain, spins);
        state = out.state;
    }
}
if (deepestChain < 2) {
    bad(`AVL 빼기 연쇄 — 한 번의 빼기가 두 번 넘게 돈 판이 하나도 없다(최대 ${deepestChain}번).`
        + ' 연쇄를 태우지 못했으므로 이 절이 헛돈다');
}
console.log(`AVL 빼기 ${chainChecks}판 — 깊은 트리에서 이어 빼며 균형이 지켜지는지 보았다`
    + ` (한 판에서 가장 많이 돈 횟수 ${deepestChain})`);

/* ================================================================
   6. 페이지를 띄워 **트리마다 실제로 눌러 본다**
   ================================================================ */

const page = loadSim('cs/tree', {box: {w: 900, h: 700}});
page.lifecycle();
for (const e of page.errors) bad(`페이지를 띄우다가 — ${e}`);

const SICK = /NaN|Infinity|undefined/;

function screenSick(sim) {
    for (const el of sim.texts()) {
        for (const v of [el.text, el.html]) {
            if (typeof v === 'string' && SICK.test(v)) return `#${el.id}: ${v.slice(0, 50)}`;
        }
    }
    return null;
}

/** 화면에 **보이는** 마디 수. `opacity="0"`으로 물려 둔 것은 세지 않는다. */
function visibleNodes(sim) {
    let n = 0;
    const walk = (el) => {
        const 이름 = (x) => String(x.tagName).toUpperCase();
        if (이름(el) === 'G' && [...(el.children || [])].some((c) => 이름(c) === 'CIRCLE')) {
            if (String(el.getAttribute('opacity')) !== '0') n++;
        }
        for (const c of el.children || []) walk(c);
    };
    for (const c of sim.el('view-host').children) walk(c);
    return n;
}

/* **태그 이름은 대문자로 맞춰 센다.** 진짜 DOM 에서 HTML 요소의 `tagName` 은 대문자인데
   **SVG 요소는 소문자 그대로다**(`svg` · `g` · `circle`). 손으로 만든 스텁은 무엇이든
   대문자로 돌려주었기 때문에, jsdom 으로 갈아 끼우자 `tally.CIRCLE` 이 통째로 비어
   「거의 그려지지 않았다」가 우수수 났다 — 그림은 멀쩡한데 세는 쪽이 틀린 것이었다. */
function drawn(sim) {
    const tally = {};
    const walk = (el) => {
        const 이름 = String(el.tagName).toUpperCase();
        tally[이름] = (tally[이름] || 0) + 1;
        for (const c of el.children || []) walk(c);
    };
    for (const c of sim.el('view-host').children) walk(c);
    return tally;
}

const pageRows = [];
for (const group of [...page.el('group-tabs').children]) {
    group.click();
    for (const chip of [...page.el('struct-tabs').children]) {
        const name = chip.textContent;
        chip.click();
        for (const opBtn of [...page.el('ops-host').children]) {
            const opName = opBtn.textContent;
            const before = page.errors.length;
            opBtn.click();
            page.el('btn-last').click();
            for (const e of page.errors.slice(before)) bad(`${name} · ${opName} — ${e}`);
            const sick = screenSick(page);
            if (sick) bad(`${name} · ${opName} — 화면에 성하지 않은 값: ${sick}`);
            if (!page.el('say').textContent.trim()) bad(`${name} · ${opName} — 설명이 비었다`);
            if (!page.el('btn-next').disabled) {
                bad(`${name} · ${opName} — 「끝으로」를 눌렀는데 「앞으로」가 아직 살아 있다`);
            }
        }
        const tally = drawn(page);
        const marks = (tally.CIRCLE || 0) + (tally.G || 0);
        if (marks < 3) bad(`${name} — 트리가 거의 그려지지 않았다 (${JSON.stringify(tally)})`);

        /* **개수까지 맞춰 본다.** 동그라미는 `setup()`에서 다 만들어지므로 «몇 개
           그렸나»만으로는 `render()`가 아무 일도 안 해도 통과한다. 화면에 «보이는»
           마디 수가 담긴 값의 개수와 같은지를 본다 — 그것은 render 가 정하는 값이다. */
        const shown = visibleNodes(page);
        const size = Number(page.el('size-label').textContent.replace(/[^\d]/g, '')) || 0;
        if (name !== '나란히 놓기' && shown !== size) {
            bad(`${name} — 화면에 보이는 마디가 ${shown}개인데 담긴 값은 ${size}개다`);
        }
        pageRows.push(`${name}: 보이는 마디 ${shown}/${size} · ${JSON.stringify(tally)}`);
    }
}
console.log('페이지를 띄워 트리·연산을 모두 눌러 보았다');
for (const r of pageRows) console.log('  ' + r);

/* **자료를 갈아 끼우는 단추가 실제로 자료를 바꾸는가.** */
for (const [id, label] of [
    ['btn-ascend', '오름차순으로 세우기'],
    ['btn-random', '새 자료'],
    ['btn-reset', '처음 자료로'],
    ['btn-clear', '비우기'],
]) {
    const before = page.errors.length;
    page.el(id).click();
    for (const e of page.errors.slice(before)) bad(`${label} — 죽었다: ${e}`);
    const size = page.el('size-label').textContent;
    if (!size.trim()) bad(`${label} — 담긴 개수가 비었다`);
    if (id === 'btn-clear' && size !== '0개') bad(`비우기 — 눌렀는데 ${size}가 남았다`);
    if (id === 'btn-ascend' && size === '0개') bad('오름차순으로 세우기 — 눌렀는데 비어 있다');
}

/* **오름차순으로 세우면 높이가 개수와 같아야 한다**(이진 탐색 트리에서).
   화면이 「한 줄로 늘어집니다」라고 말하는 바로 그 자리다. */
{
    const groups = [...page.el('group-tabs').children];
    groups[0].click();
    const chips = [...page.el('struct-tabs').children];
    chips.find((c) => c.textContent === '이진 탐색 트리').click();
    page.el('btn-ascend').click();
    const h = page.el('height-label').textContent;
    const n = page.el('size-label').textContent.replace('개', '');
    if (h !== n) {
        bad(`오름차순으로 세운 이진 탐색 트리의 높이가 ${h}다(담긴 값 ${n}개). 한 줄이면 같아야 한다`);
    }
    chips.find((c) => c.textContent === 'AVL 트리').click();
    const ah = Number(page.el('height-label').textContent);
    if (!(ah < Number(n))) {
        bad(`같은 자료로 세운 AVL 트리의 높이가 ${ah}다(담긴 값 ${n}개). 더 낮아야 한다`);
    }
}

/* **직접 넣기로 막아야 할 값을 넣어 본다.** */
for (const [raw, why] of [
    ['-3 5 8', '음수'],
    ['1 2 300', '천장을 넘는 값'],
    ['5 5 7', '겹치는 값'],
    ['가나다', '숫자가 아닌 것'],
]) {
    const before = page.errors.length;
    /* **앞 판이 남긴 문구를 지우고 본다.** 안 지우면 이번 판이 조용히 통과해도
       앞의 빨간 글씨가 가려 준다 — 검사가 헛돈다. */
    page.el('input-error').textContent = ' ';
    page.el('input-text').value = raw;
    page.el('btn-apply-input').click();
    for (const e of page.errors.slice(before)) bad(`직접 넣기(${why}) — 죽었다: ${e}`);
    if (!page.el('input-error').textContent.trim()) {
        bad(`직접 넣기(${why}) — 막아야 하는데 아무 말도 하지 않았다`);
    }
}
console.log('직접 넣기 — 막아야 할 값 넷을 넣어 보았다');

console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
