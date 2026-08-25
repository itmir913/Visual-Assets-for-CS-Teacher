/* 선형 자료구조를 **실제로 돌려** 대조한다.
 *
 * 화면만 보고는 알아챌 수 없는 것들이 있다. 상자가 그럴듯하게 움직여도 링크가 끊겨
 * 있을 수 있고, 카드에 「O(1)」이라 적어 두고 실제로는 개수만큼 걸릴 수 있다.
 * **카드에 적힌 말과 화면에서 벌어지는 일이 어긋나는 것이 가장 나쁜 결함이다** —
 * 학생이 외우는 것은 카드이기 때문이다.
 *
 * **정답을 베끼지 않는다.** 기대값은 기록기가 내놓은 상태가 아니라 평범한 자바스크립트
 * 배열로 따로 구한다. 같은 코드로 두 번 구하면 아무것도 대조하지 못한다.
 */

import {
    DS_STRUCTS, DS_COMPARE, DS_CAP, DS_START, dsPlanOf,
} from '../src/entries/_lib/ds/ds-registry.js';
import {
    runDsOperation, dsStateFault, dsValues, dsArrayState, dsListState, dsResetIds,
} from '../src/entries/_lib/ds/ds-model.js';
import {buildDsCompare, measureDsWork, dsWorkOf} from '../src/entries/_lib/ds/ds-compare.js';
import {loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 40) console.log('  ✗ ' + m); };

dsResetIds();

/* ================================================================
   1. 자리로 넣고 빼는 구조 — **평범한 배열로 따로 구한 답과 맞춘다**
   ================================================================ */

/** 연산 하나가 «담긴 값»을 어떻게 바꾸는가. 기록기와 아무 상관 없이 계산한다. */
function oracle(opId, vals, {v, i}) {
    const out = [...vals];
    switch (opId) {
        case 'insert-front': return [v, ...out];
        case 'insert-back': return [...out, v];
        /* **범위 밖이면 아무 일도 없다.** 예전에는 말없이 끝으로 당겨 넣었는데,
           그것이 결함이라 고쳤다 → `ds-ops.js`의 `outOfRange`. */
        case 'insert-at': if (i > out.length) return out; out.splice(i, 0, v); return out;
        case 'remove-front': return out.slice(1);
        case 'remove-back': return out.slice(0, -1);
        case 'remove-at': if (i > out.length - 1) return out; out.splice(i, 1); return out;
        case 'read-at': case 'find': return out;
        default: return null;
    }
}

const POSITIONAL = ['array', 'slist', 'dlist'];
const ARGS = [{v: 55, i: 0}, {v: 61, i: 2}, {v: 7, i: 3}];
let posChecks = 0;

for (const id of POSITIONAL) {
    const struct = DS_STRUCTS.find((s) => s.id === id);
    for (const start of [[], [9], [...DS_START], Array.from({length: DS_CAP}, (_, k) => k + 1)]) {
        for (const op of struct.ops) {
            for (const arg of ARGS) {
                const state = struct.makeState(start);
                const out = runDsOperation(op, state, arg);
                posChecks++;

                const fault = dsStateFault(out.state);
                if (fault) {
                    bad(`${struct.name} · ${op.name} (n=${start.length}) — 상태가 성하지 않다: ${fault}`);
                    continue;
                }

                let want = oracle(op.id, start, arg);
                // 칸이 꽉 찬 배열에는 더 넣지 못한다. **그때는 그대로여야 한다.**
                if (id === 'array' && want && want.length > DS_CAP) want = [...start];

                const got = dsValues(out.state);
                if (want && got.join(',') !== want.join(',')) {
                    bad(`${struct.name} · ${op.name} (n=${start.length}, ${JSON.stringify(arg)}) — `
                        + `[${got.join(' ')}]이 나왔다. 있어야 할 것 [${want.join(' ')}]`);
                }

                /* **담는 방식이 세는 값을 정한다.** 연결 리스트가 원소를 옮기거나
                   배열이 링크를 고치면 이 페이지가 가르치려는 대비가 통째로 무너진다. */
                if (out.state.store === 'list' && out.counts.move !== 0) {
                    bad(`${struct.name} · ${op.name} — 연결 리스트인데 원소를 ${out.counts.move}번 옮겼다`);
                }
                if (out.state.store === 'array' && out.counts.link !== 0) {
                    bad(`${struct.name} · ${op.name} — 배열인데 링크를 ${out.counts.link}번 고쳤다`);
                }

                /* 장마다 원소가 성한지. 옮기다 흘리면 화면에서 상자가 사라진다. */
                for (let k = 0; k < out.frames.length; k++) {
                    const st = out.frames[k].state;
                    const live = st.store === 'array'
                        ? st.slots.filter(Boolean).length
                        : st.nodes.length;
                    const lo = Math.min(start.length, got.length);
                    const hi = Math.max(start.length, got.length);
                    if (live < lo || live > hi) {
                        bad(`${struct.name} · ${op.name} — ${k}번째 장에 원소가 ${live}개다`
                            + ` (${lo}~${hi} 사이여야 한다)`);
                        break;
                    }
                }

                /* **처음 장은 손대기 전 모습이어야 한다.** 없으면 되감기를 끝까지 해도
                   연산 전을 볼 수 없다. */
                const first = dsValues(out.frames[0].state);
                if (first.join(',') !== [...start].join(',')) {
                    bad(`${struct.name} · ${op.name} — 0번 장이 이미 손댄 뒤다`
                        + ` ([${first.join(' ')}] · 처음 [${start.join(' ')}])`);
                }
                if (!out.frames[0].say.trim()) bad(`${struct.name} · ${op.name} — 0번 장에 설명이 없다`);
                const last = out.frames[out.frames.length - 1];
                if (!last.say.trim()) bad(`${struct.name} · ${op.name} — 끝 장에 설명이 없다`);
            }
        }
    }
}
console.log(`자리로 넣고 빼는 구조 셋 — ${posChecks}판을 돌려 평범한 배열로 구한 답과 맞췄다`);

/* ================================================================
   2. 쓰는 규칙이 정해진 구조 — **규칙 그대로 흉내 낸 모형과 맞춘다**

   스택이 후입선출인지, 큐가 선입선출인지는 «담긴 차례»로만 확인할 수 있다.
   그래서 평범한 배열로 같은 규칙을 흉내 내고, 연산을 무작위로 섞어 물린 뒤
   양쪽에 남은 것을 견준다. 원형 큐는 **자리가 끝을 지나 돌아간 뒤**가 요점이므로
   칸 수보다 많이 넣고 빼도록 일부러 길게 돌린다.
   ================================================================ */

/** 흉내 모형. 배열 하나로 규칙만 지킨다 — 기록기와 겹치는 코드가 없다. */
function mirrorOf(structId) {
    const a = [];
    return {
        apply(opId, v) {
            switch (opId) {
                case 'push': case 'enqueue': case 'push-back':
                    a.push(v); break;
                case 'push-front':
                    a.unshift(v); break;
                case 'pop':          // 스택에만 있는 이름이다
                    a.pop(); break;
                case 'dequeue': case 'pop-front':
                    a.shift(); break;
                case 'pop-back':
                    a.pop(); break;
                default: break;   // 들여다보기만 하는 연산은 아무것도 바꾸지 않는다
            }
        },
        /** 화면이 내놓는 차례로 맞춰 준다. 리스트로 담은 스택은 꼭대기가 앞에 온다. */
        values(kind) {
            return kind === 'stack-list' ? [...a].reverse() : [...a];
        },
        get size() { return a.length; },
    };
}

const ADT = [
    {id: 'stack', impls: ['array', 'list']},
    {id: 'queue', impls: ['array', 'list']},
    {id: 'deque', impls: ['array', 'list']},
    {id: 'ring', impls: [null]},
];

let adtChecks = 0;
let seed = 12345;
const rnd = () => {
    seed = (seed * 1103515245 + 12345) >>> 0;
    return seed / 4294967296;
};

for (const spec of ADT) {
    const struct = DS_STRUCTS.find((s) => s.id === spec.id);
    for (const implId of spec.impls) {
        const plan = dsPlanOf(struct, implId);
        const kind = spec.id === 'stack' && implId === 'list' ? 'stack-list' : spec.id;
        let state = struct.makeState([], implId);
        const mirror = mirrorOf(spec.id);

        for (let step = 0; step < 120; step++) {
            const op = plan.ops[Math.floor(rnd() * plan.ops.length)];
            const v = Math.floor(rnd() * 90) + 5;
            const out = runDsOperation(op, state, {v, i: 0});
            adtChecks++;

            const fault = dsStateFault(out.state);
            if (fault) {
                bad(`${struct.name}(${implId || '-'}) · ${op.name} ${step}걸음 — 상태가 성하지 않다: ${fault}`);
                break;
            }

            /* **꽉 찼거나 비어 있어 아무 일도 못 한 판은 모형에도 물리지 않는다.**
               그것을 모르고 물리면 이후가 통째로 어긋나 진짜 결함이 묻힌다. */
            const blocked = out.frames.some((f) => f.marks.banner);
            if (!blocked) mirror.apply(op.id, v);

            const got = dsValues(out.state).join(',');
            const want = mirror.values(kind).join(',');
            if (got !== want) {
                bad(`${struct.name}(${implId || '-'}) · ${op.name} ${step}걸음 — `
                    + `[${got}]이 담겼다. 규칙대로면 [${want}]`);
                break;
            }
            state = out.state;
        }

        /* **원형 큐는 자리가 실제로 돌아야 한다.** 돌지 않으면 그냥 배열 큐다. */
        if (spec.id === 'ring') {
            let ring = struct.makeState([]);
            const enq = plan.ops.find((o) => o.id === 'enqueue');
            const deq = plan.ops.find((o) => o.id === 'dequeue');
            /* **「0으로 돌아왔는가」를 봐야 한다.** 예전에는 `front === 0`인 순간이
               있으면 통과였는데, front는 0에서 시작하므로 **자리를 아예 안 옮기는
               구현도 통과했다.** 0을 떠난 «뒤에» 다시 0이 되는 것을 본다. */
            let left = false;
            let wrapped = false;
            const seenFronts = new Set();
            for (let k = 0; k < DS_CAP * 2; k++) {
                ring = runDsOperation(enq, ring, {v: k + 1, i: 0}).state;
                ring = runDsOperation(deq, ring, {v: 0, i: 0}).state;
                seenFronts.add(ring.front);
                if (ring.front !== 0) left = true;
                else if (left) wrapped = true;
            }
            if (!wrapped) {
                bad('원형 큐 — 칸 수보다 많이 넣고 뺐는데 front가 0을 떠났다 돌아오지 않았다'
                    + ` (지나온 자리 ${[...seenFronts].sort((a, b) => a - b).join(',')})`);
            }
            if (seenFronts.size < DS_CAP) {
                bad(`원형 큐 — front가 자리 ${seenFronts.size}곳만 지났다 (칸이 ${DS_CAP}개인데)`);
            }
        }
    }
}
console.log(`쓰는 규칙이 정해진 구조 넷 — ${adtChecks}걸음을 흉내 모형과 걸음마다 맞췄다`);

/* ================================================================
   3. **카드에 적은 값이 참인가** — 개수를 키워 가며 실제로 재 본다

   「앞에 넣기는 O(n)」이라고 적어 두고 실제로는 상수만큼 걸리거나, 「O(1)」이라
   적어 두고 개수만큼 걸리면 학생이 외우는 것이 거짓이 된다. 사람이 적은 말이므로
   기계가 붙든다.
   ================================================================ */

const GROW_SIZES = [8, 16, 32, 64];
let costChecks = 0;

/** 연산 하나를 크기별로 돌려 작업량만 잰다. 장은 남기지 않아도 되지만
 *  기록기가 늘 남기므로 그대로 두고 세는 값만 쓴다. */
function workAt(op, makeState, n) {
    const values = Array.from({length: n}, (_, k) => ((k * 37) % 90) + 5);
    const arg = {v: 55, i: Math.floor(n / 2)};
    return dsWorkOf(runDsOperation(op, makeState(values, n), arg).counts);
}

for (const struct of DS_STRUCTS) {
    for (const implId of (struct.impls ? struct.impls.map((i) => i.id) : [null])) {
        const plan = dsPlanOf(struct, implId);
        for (const op of plan.ops) {
            if (!op.cost) { bad(`${struct.name} · ${op.name} — 드는 값이 적혀 있지 않다`); continue; }

            const makeState = (values, n) => {
                if (struct.id === 'ring') {
                    return dsArrayState(n + 2, values, {ring: true, front: 0, rear: values.length});
                }
                if (dsPlanOf(struct, implId).view === 'list' || struct.id === 'slist' || struct.id === 'dlist') {
                    const opts = struct.id === 'dlist' ? {doubly: true}
                        : struct.id === 'slist' ? {doubly: false, hasTail: false}
                            : (struct.listOpts || {doubly: false, hasTail: true});
                    return dsListState(values, opts);
                }
                /* **칸을 넉넉히 잡는다.** 꽉 차서 못 넣는 판을 재면 값이 상수가 되어
                   「O(n)이라 적었는데 안 자란다」는 헛된 결함이 뜬다. */
                return dsArrayState(n + 2, values);
            };

            const sample = makeState([1, 2, 3], 3);
            const claim = op.cost(sample);
            const small = workAt(op, makeState, GROW_SIZES[0]);
            const big = workAt(op, makeState, GROW_SIZES[GROW_SIZES.length - 1]);
            costChecks++;

            const ratio = big / Math.max(1, small);
            if (claim === 'O(1)' && ratio > 2) {
                bad(`${struct.name}(${implId || '-'}) · ${op.name} — O(1)이라 적어 두었는데 `
                    + `개수를 8→64로 키우니 작업량이 ${small}→${big}으로 늘었다`);
            }
            if (claim === 'O(n)' && ratio < 3) {
                bad(`${struct.name}(${implId || '-'}) · ${op.name} — O(n)이라 적어 두었는데 `
                    + `개수를 8→64로 키워도 작업량이 ${small}→${big}밖에 안 된다`);
            }
        }
    }
}
console.log(`드는 값 ${costChecks}가지 — 개수를 8에서 64로 키워 가며 적어 둔 것과 맞췄다`);

/* **카드의 비용 표에 적힌 표기가 실제 연산에 있는 것인가.**
   어느 연산도 O(log n)이 아닌데 표에 O(log n)이 적혀 있으면, 그 말은 어디서도
   뒷받침되지 않는 채로 학생에게 간다. */
for (const struct of [...DS_STRUCTS, DS_COMPARE]) {
    const seen = new Set();
    for (const implId of (struct.impls ? struct.impls.map((i) => i.id) : [null])) {
        for (const op of dsPlanOf(struct, implId).ops) {
            if (!op.cost) continue;
            for (const st of [
                dsArrayState(20, [1, 2, 3]),
                dsListState([1, 2, 3], {doubly: false, hasTail: false}),
                dsListState([1, 2, 3], {doubly: false, hasTail: true}),
                dsListState([1, 2, 3], {doubly: true}),
            ]) seen.add(op.cost(st));
        }
    }
    for (const [, big] of struct.costRows.map((r) => [r[0], r[1]])) {
        for (const token of big.match(/O\([^)]*\)/g) || []) {
            if (!seen.has(token)) {
                bad(`${struct.name} — 비용 표에 ${token}이 적혀 있는데 그런 연산이 하나도 없다`);
            }
        }
    }
}
console.log('비용 표의 표기가 실제 연산에 있는 것인지 대조했다');

/* ================================================================
   4. 비용 비교 — **먼저 끝난 쪽이 정말 일을 덜 했는가**

   화면이 그렇게 말한다. 그 말이 참이려면 끝나는 차례가 작업량의 차례와 같아야 한다.
   **작업량을 비교 자신에게 묻지 않는다** — 그러면 축을 무엇으로 바꾸든 늘 통과하는
   순환 논리가 된다. 기대값은 두 구조를 따로 돌려 구한다.
   ================================================================ */

let raceChecks = 0;
for (const op of DS_COMPARE.ops) {
    for (const start of [[], [...DS_START], [3, 1, 4, 1, 5, 9, 2]]) {
        const states = {
            array: dsArrayState(DS_CAP, start),
            list: dsListState(start, {doubly: false, hasTail: false}),
        };
        const arg = {v: 55, i: 2};
        const trueWork = {
            array: dsWorkOf(runDsOperation(op.pair.array, states.array, arg).counts),
            list: dsWorkOf(runDsOperation(op.pair.list, states.list, arg).counts),
        };
        const built = buildDsCompare(op, states, arg);
        const {frames} = built;
        raceChecks++;

        const doneAt = (k) => frames.findIndex((f) => f.lanes[k].done);
        const a = doneAt(0);
        const b = doneAt(1);
        if (a < 0 || b < 0) {
            bad(`비용 비교 · ${op.name} (n=${start.length}) — 끝나지 않는 줄이 있다`);
            continue;
        }
        if (built.blocked) continue;   // 무른 판에는 등수가 없다
        if (trueWork.array < trueWork.list && a > b) {
            bad(`비용 비교 · ${op.name} (n=${start.length}) — 배열이 일을 덜 했는데(작업량 `
                + `${trueWork.array} < ${trueWork.list}) 늦게 끝난다`);
        }
        if (trueWork.list < trueWork.array && b > a) {
            bad(`비용 비교 · ${op.name} (n=${start.length}) — 리스트가 일을 덜 했는데(작업량 `
                + `${trueWork.list} < ${trueWork.array}) 늦게 끝난다`);
        }
        const lastSay = frames[frames.length - 1].say;
        /* 막혀서 무른 판은 «끝났다»가 아니라 **왜 아무 일도 없었는지**를 말해야 한다. */
        const wantWord = built.blocked ? '할 수 없' : '끝났습니다';
        if (!lastSay.includes(wantWord)) {
            bad(`비용 비교 · ${op.name} — 끝 장의 말이 「${wantWord}」을 담지 않았다: ${lastSay.slice(0, 34)}`);
        }
    }
}

/* **화면이 못박은 전제 — 「같은 값을 담고 있고 같은 연산을 한꺼번에 받습니다」.**
 *
 * 이 말이 참이 아니면 그 아래 작업량 비교가 통째로 뜻을 잃는다. 실제로 배열은 칸이
 * 꽉 차면 더 못 넣는데 리스트는 계속 들어가, **두 줄이 갈라진 채로 견주고 있었다.**
 * 게다가 아무 일도 못 한 배열이 작업량 0으로 「일을 덜 했다」가 되었다.
 * 말로만 고칠 수 있는 자리가 아니므로 검사가 붙든다. */
{
    let pairState = {
        array: dsArrayState(DS_CAP, [...DS_START]),
        list: dsListState([...DS_START], {doubly: false, hasTail: false}),
    };
    let sameChecks = 0;
    for (let step = 0; step < 60; step++) {
        const op = DS_COMPARE.ops[step % DS_COMPARE.ops.length];
        const built = buildDsCompare(op, pairState, {v: 40 + (step % 50), i: 1});
        sameChecks++;
        if (!built.blocked) {
            pairState = {array: built.runs[0].out.state, list: built.runs[1].out.state};
        }
        const a = dsValues(pairState.array).join(',');
        const l = dsValues(pairState.list).join(',');
        if (a !== l) {
            bad(`비용 비교 ${step}걸음 (${op.name}) — 두 줄의 담긴 것이 갈라졌다. `
                + `배열 [${a}] · 리스트 [${l}]`);
            break;
        }
        /* **막힌 판이 「일을 덜 했다」로 끝나면 안 된다.** */
        if (built.blocked) {
            const say = built.frames[built.frames.length - 1].say;
            if (say.includes('일을 덜 했')) {
                bad(`비용 비교 ${step}걸음 (${op.name}) — 아무 일도 못 했는데 이겼다고 말한다`);
            }
        }
    }
    console.log(`비용 비교 ${sameChecks}걸음 — 두 줄이 늘 같은 것을 담고 있는지 대조했다`);
}
console.log(`비용 비교 ${raceChecks}판 — 끝나는 차례가 작업량의 차례와 같은지 대조했다`);

/* **표가 실제로 가르치려는 것을 보이는가.** 「앞에 넣기는 리스트가 싸고 k번째 읽기는
   배열이 싸다」가 이 페이지의 요점인데, 재어 보니 그렇지 않다면 표가 거짓말을 한다. */
const measured = measureDsWork(DS_COMPARE.ops);
const lastCol = measured.sizes.length - 1;
for (const row of measured.rows) {
    const arr = row.array[lastCol];
    const lst = row.list[lastCol];
    const expectCheaper = {
        'insert-front': 'list', 'insert-back': 'array',
        'remove-front': 'list', 'remove-back': 'array', 'read-at': 'array',
    }[row.op.id];
    if (!expectCheaper) continue;
    const cheaper = arr < lst ? 'array' : 'list';
    if (cheaper !== expectCheaper) {
        bad(`비용 표 · ${row.op.name} — ${measured.sizes[lastCol]}개에서 `
            + `${expectCheaper === 'array' ? '배열' : '리스트'}이 싸야 하는데 `
            + `배열 ${arr} · 리스트 ${lst}이 나왔다`);
    }
}
console.log(`비용 표 — 개수 ${measured.sizes.join('·')}에서 어느 쪽이 싼지 대조했다`);

/* ================================================================
   5. 페이지를 띄워 **구조마다 실제로 눌러 본다**

   위쪽 검사는 계산만 본다. 그런데 구조마다 그림이 다르고(마디 그림·동그라미·나란히
   놓기), 그 화면을 만드는 코드는 계산이 성해도 죽을 수 있다.
   ================================================================ */

const page = loadSim('cs/linear', {box: {w: 900, h: 700}});
page.lifecycle();
for (const e of page.errors) bad(`페이지를 띄우다가 — ${e}`);

const SICK = /NaN|Infinity|undefined/;

function screenSick(sim) {
    for (const el of sim.byId.values()) {
        for (const v of [el._text, el._html]) {
            if (typeof v === 'string' && SICK.test(v)) return `#${el.id}: ${v.slice(0, 50)}`;
        }
    }
    return null;
}

/** `#view-host` 아래에 무엇이 몇 개 그려졌는지 센다. */
function drawn(sim) {
    const tally = {};
    const walk = (el) => {
        tally[el.tagName] = (tally[el.tagName] || 0) + 1;
        for (const c of el.children || []) walk(c);
    };
    for (const c of sim.el('view-host').children) walk(c);
    return tally;
}

const pageRows = [];
for (const group of [...page.el('group-tabs').children]) {
    group.click();
    for (const chip of [...page.el('struct-tabs').children]) {
        const structName = chip.textContent;
        chip.click();

        const implButtons = [...page.el('impl-buttons').children];
        const impls = implButtons.length ? implButtons : [null];
        for (const implBtn of impls) {
            if (implBtn) implBtn.click();
            const implName = implBtn ? implBtn.textContent : '-';

            for (const opBtn of [...page.el('ops-host').children]) {
                const opName = opBtn.textContent;
                const before = page.errors.length;
                opBtn.click();
                page.el('btn-last').click();

                for (const e of page.errors.slice(before)) {
                    bad(`${structName}/${implName} · ${opName} — ${e}`);
                }
                const sick = screenSick(page);
                if (sick) bad(`${structName}/${implName} · ${opName} — 화면에 성하지 않은 값: ${sick}`);
                if (!page.el('say').textContent.trim()) {
                    bad(`${structName}/${implName} · ${opName} — 설명이 비었다`);
                }
                if (!page.el('btn-next').disabled) {
                    bad(`${structName}/${implName} · ${opName} — 「끝으로」를 눌렀는데 `
                        + '「앞으로」가 아직 살아 있다');
                }
            }

            const tally = drawn(page);
            const drawnCount = (tally.DIV || 0) + (tally.G || 0) + (tally.RECT || 0);
            if (drawnCount < 4) {
                bad(`${structName}/${implName} — 그림이 거의 그려지지 않았다 (${JSON.stringify(tally)})`);
            }
            pageRows.push(`${structName}/${implName}: ${JSON.stringify(tally)}`);
        }
    }
}
console.log('페이지를 띄워 구조·담는 방식·연산을 모두 눌러 보았다');
for (const r of pageRows) console.log('  ' + r);

/* **연산을 눌러도 그림 상자의 높이가 흔들리면 안 된다.**
   단계를 넘길 때 상자가 늘었다 줄었다 하면 그 아래 단추가 아래위로 움직이고,
   그러면 같은 자리를 거듭해 누를 수가 없다. */
/* **높이를 어디에 적었든 찾아낸다.**
 *
 * 예전에는 `el.style.height`만 보았다. 그런데 마디 그림은 SVG 크기를 `style` **속성
 * 문자열**로 주므로(`width:100%;min-width:…`) 그 자리가 비어 있었고, 여덟 탭 가운데
 * 다섯에서 **이 검사가 아무것도 재지 않았다.** 재는 것이 없는 검사는 초록불이
 * 무슨 뜻인지 알 수 없다 — 속성 문자열과 viewBox 까지 함께 본다. */
function heightMap(sim) {
    const out = new Map();
    const walk = (el, path) => {
        if (el.style.position === 'absolute') return;
        const h = el.style.height || '';
        if (h) out.set(path, h);
        /* **문자열일 때만 본다.** 받침대의 `style`은 평소에 프록시 객체이고,
           그것을 문자열로 바꾸려 들면 그 자리에서 죽는다. `setAttribute('style', …)`로
           통째로 써 넣은 SVG만 문자열이 된다 — 우리가 재려는 것이 바로 그것이다. */
        if (typeof el.style === 'string' && el.style) out.set(path + '@style', el.style);
        if (typeof el.viewBox === 'string' && el.viewBox) out.set(path + '@viewBox', el.viewBox);
        (el.children || []).forEach((c, i) => walk(c, `${path}/${i}`));
    };
    sim.el('view-host').children.forEach((c, i) => walk(c, String(i)));
    return out;
}

let heightWatched = 0;
for (const group of [...page.el('group-tabs').children]) {
    group.click();
    for (const chip of [...page.el('struct-tabs').children]) {
        const structName = chip.textContent;
        chip.click();
        /* **담는 방식을 첫째 것으로 되돌린다.** 앞 절이 마지막으로 누른 것이 그대로
           남아 있어, 스택·큐·덱까지 마디 그림으로 재고 있었다. */
        const firstImpl = page.el('impl-buttons').children[0];
        if (firstImpl) firstImpl.click();
        const opBtn = page.el('ops-host').children[0];
        if (!opBtn) continue;
        opBtn.click();
        page.el('btn-first').click();
        const before = heightMap(page);
        if (before.size === 0) {
            bad(`${structName} — 높이를 잰 상자가 하나도 없다. 이 검사가 헛돈다`);
        }
        heightWatched += before.size;
        let moved = null;
        for (let k = 0; k < 200 && !moved; k++) {
            if (page.el('btn-next').disabled) break;
            page.el('btn-next').click();
            const now = heightMap(page);
            for (const [path, h] of before) {
                if (now.get(path) !== h) {
                    moved = `${k + 1}단계 · ${path}: ${h} → ${now.get(path) || '(사라짐)'}`;
                    break;
                }
            }
        }
        if (moved) {
            bad(`${structName} — 단계를 넘기는 동안 상자 높이가 바뀌었다(${moved}). 단추가 움직인다`);
        }
    }
}
console.log(`단계를 넘기는 동안 상자 ${heightWatched}곳의 높이가 흔들리지 않는지 보았다`);

/* **직접 넣기로 막아야 할 값을 넣어 본다.** 막는 것은 한 곳뿐인데 그 가드가
   검사에 걸려 있지 않으면 깨져도 아무도 모른다. */
for (const [raw, why] of [
    ['-3 5 8', '음수'],
    ['1 2 300', '천장을 넘는 값'],
    ['1,2,3,4,5,6,7,8,9,10,11,12', '칸보다 많은 개수'],
    ['가나다', '숫자가 아닌 것'],
]) {
    const before = page.errors.length;
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
