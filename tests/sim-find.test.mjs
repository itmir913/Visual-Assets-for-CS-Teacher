import {test, expect} from 'vitest';
/* 찾기 시뮬레이터를 **실제로 돌려** 대조한다.
 *
 * 화면만 보고는 알아챌 수 없는 것들이 있다. 칸이 그럴듯하게 물들어도 엉뚱한 자리를
 * 짚고 있을 수 있고, 카드에 「O(1)」이라 적어 두고 실제로는 개수만큼 걸릴 수 있다.
 * **카드에 적힌 말과 화면에서 벌어지는 일이 어긋나는 것이 가장 나쁜 결함이다** —
 * 학생이 외우는 것은 카드이기 때문이다.
 *
 * **정답을 베끼지 않는다.** 기대값은 시뮬레이터가 내놓은 것이 아니라 평범한 배열과
 * `Map`으로 따로 구한다. 같은 코드로 두 번 구하면 아무것도 대조하지 못한다.
 */

import {
    runFindOperation, findArrayState, findHashState, findStateFault, findValues,
    findHash, findResetIds, TOMB,
} from '../src/entries/_lib/find/find-model.js';
import {
    FIND_SEQ_OPS, FIND_BIN_OPS, FIND_CHAIN_OPS, FIND_OPEN_OPS,
} from '../src/entries/_lib/find/find-ops.js';
import {FIND_STRUCTS, FIND_HASH_CAP, FIND_START} from '../src/entries/_lib/find/find-registry.js';
import {
    buildFindRace, makeFindRaceStates, measureFindWork, findWorkOf,
} from '../src/entries/_lib/find/find-compare.js';
import {loadSim} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 40) console.log('  ✗ ' + m); };

findResetIds();

/** 반복할 수 있는 난수. 씨앗이 같으면 같은 자료가 나와야 결함을 다시 볼 수 있다. */
let seed = 20260826;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = (n, max) => {
    const s = new Set();
    while (s.size < n) s.add(1 + Math.floor(rnd() * max));
    return [...s];
};

/** 마지막 장에서 «찾았다고 표시한 자리». 화면이 실제로 물들인 칸이다. */
const hitAt = (out) => {
    const h = out.frames[out.frames.length - 1].marks.hit;
    return h && h.length ? h[0] : -1;
};

/* ================================================================
   1. 순차·이진 탐색 — **평범한 배열로 따로 구한 답과 맞춘다**
   ================================================================ */

let scanChecks = 0;

for (let round = 0; round < 60; round++) {
    const n = 1 + Math.floor(rnd() * 12);
    const vals = pick(n, 99).sort((a, b) => a - b);
    const state = findArrayState(vals);

    // 있는 값 전부와, 없는 값 몇 개
    const targets = [...vals, ...pick(3, 99).filter((x) => !vals.includes(x))];

    for (const t of targets) {
        const want = vals.indexOf(t);          // ← 정답. 시뮬레이터와 무관하게 구한다.

        for (const [who, op] of [['순차', FIND_SEQ_OPS[0]], ['이진', FIND_BIN_OPS[0]]]) {
            const out = runFindOperation(op, state, t);
            scanChecks++;

            const got = hitAt(out);
            if (got !== want) bad(`${who} 탐색이 ${t}을(를) ${got}번이라 했다(정답 ${want}번, 자료 ${vals})`);

            const fault = findStateFault(out.state);
            if (fault) bad(`${who} 탐색 뒤 상태가 성하지 않다 — ${fault}`);

            /* **찾기는 담긴 것을 바꾸지 않는다.** 커서를 옮기다 값을 건드리면
               다음 판이 다른 자료 위에서 돌아 아무 말도 못 하게 된다. */
            const after = findValues(out.state);
            if (after.join() !== vals.join()) bad(`${who} 탐색이 자료를 바꿨다 — ${vals} → ${after}`);

            // 계산은 해시에서만 늘어난다.
            if (out.counts.hash !== 0) bad(`${who} 탐색이 해시를 ${out.counts.hash}번 돌렸다`);
        }

        /* ---- 세는 값이 카드의 약속을 지키는가 ---- */

        const seq = runFindOperation(FIND_SEQ_OPS[0], state, t);
        // 순차는 «앞에서부터 하나씩». 있으면 자리+1번, 없으면 전부.
        const wantSeq = want >= 0 ? want + 1 : n;
        if (seq.counts.compare !== wantSeq) {
            bad(`순차 탐색의 비교가 ${seq.counts.compare}번이다(${wantSeq}번이어야 한다, ${t} in ${vals})`);
        }

        const bin = runFindOperation(FIND_BIN_OPS[0], state, t);
        // 이진은 한 번에 반이 준다. ⌈log2(n+1)⌉을 넘을 수 없다.
        const ceil = Math.ceil(Math.log2(n + 1));
        if (bin.counts.compare > ceil) {
            bad(`이진 탐색이 ${bin.counts.compare}번 비교했다(${n}개면 ${ceil}번을 넘을 수 없다)`);
        }
    }
}

/* **정렬되어 있으면 절대 놓치지 않는다.** 이 한 줄이 이진 탐색 탭의 약속 전부다. */
for (let round = 0; round < 40; round++) {
    const vals = pick(1 + Math.floor(rnd() * 12), 99).sort((a, b) => a - b);
    const state = findArrayState(vals);
    for (const t of vals) {
        if (hitAt(runFindOperation(FIND_BIN_OPS[0], state, t)) < 0) {
            bad(`정렬된 자료에서 이진 탐색이 ${t}을(를) 놓쳤다 — ${vals}`);
        }
        scanChecks++;
    }
}

/* **흐트러뜨리면 놓칠 수 있다. 그때 왜 놓쳤는지 말해 주는가.**
   놓치는 것 자체는 결함이 아니라 가르칠 거리다. 결함은 «아무 말 없이» 놓치는 것이다. */
let missSeen = 0;
for (let round = 0; round < 200 && missSeen < 5; round++) {
    const vals = pick(8, 99);                       // 정렬하지 않는다
    const state = findArrayState(vals);
    for (const t of vals) {
        const out = runFindOperation(FIND_BIN_OPS[0], state, t);
        if (hitAt(out) >= 0) continue;
        missSeen++;
        const banner = out.frames[out.frames.length - 1].marks.banner;
        if (!banner || !/정렬/.test(banner)) {
            bad(`흐트러진 자료에서 ${t}을(를) 놓쳤는데 까닭을 말하지 않는다 — ${banner}`);
        }
        break;
    }
}
if (missSeen === 0) bad('흐트러진 자료로 이진 탐색을 200판 돌렸는데 한 번도 놓치지 않았다 — 검사가 헛돈 것이다');

console.log(`  순차·이진 ${scanChecks}판 — 답·상태·세는 값을 배열로 따로 구해 맞췄다`
    + ` · 흐트러져 놓친 판 ${missSeen}건은 모두 까닭을 밝혔다`);

/* ================================================================
   2. 해시 테이블 — **`Map`으로 따로 구한 답과 맞춘다**
   ================================================================ */

let hashChecks = 0;

for (const mode of ['chain', 'open']) {
    const OPS = mode === 'chain' ? FIND_CHAIN_OPS : FIND_OPEN_OPS;
    const [put, find, remove] = OPS;

    for (let round = 0; round < 40; round++) {
        const cap = FIND_HASH_CAP;
        let state = findHashState(cap, [], mode);
        const truth = new Set();                    // ← 정답. 시뮬레이터와 무관하다.

        for (let step = 0; step < 40; step++) {
            const v = 1 + Math.floor(rnd() * 40);
            const r = rnd();

            if (r < 0.55) {
                const full = mode === 'open' && truth.size >= cap && !truth.has(v);
                const out = runFindOperation(put, state, v);
                state = out.state;
                if (!full) truth.add(v);
                if (out.counts.hash !== 1) bad(`[${mode}] 삽입이 해시를 ${out.counts.hash}번 돌렸다`);
            } else if (r < 0.8) {
                const out = runFindOperation(remove, state, v);
                state = out.state;
                truth.delete(v);
                if (out.counts.hash !== 1) bad(`[${mode}] 삭제가 해시를 ${out.counts.hash}번 돌렸다`);
            } else {
                const out = runFindOperation(find, state, v);
                const got = hitAt(out) >= 0;
                if (got !== truth.has(v)) {
                    bad(`[${mode}] ${v}이(가) ${got ? '있다' : '없다'}는데 실제로는 ${truth.has(v) ? '있다' : '없다'}`);
                }
                if (out.counts.hash !== 1) bad(`[${mode}] 찾기가 해시를 ${out.counts.hash}번 돌렸다`);
            }
            hashChecks++;

            const fault = findStateFault(state);
            if (fault) bad(`[${mode}] 상태가 성하지 않다 — ${fault}`);

            if (state.size !== truth.size) {
                bad(`[${mode}] 담긴 값이 ${state.size}개인데 실제로는 ${truth.size}개다`);
            }
        }

        /* **묘비가 제 몫을 하는가 — 이 검사가 개방 주소법 절의 알맹이다.**
           빼면서 그냥 비우면, 그 칸을 넘어 밀려나 있던 값이 «있는데 없다»가 된다.
           남은 값을 전부 다시 찾아 보는 것 말고는 이 결함을 잡을 길이 없다. */
        for (const v of truth) {
            if (hitAt(runFindOperation(find, state, v)) < 0) {
                bad(`[${mode}] 넣어 둔 ${v}을(를) 찾지 못한다 — 빼면서 길이 끊겼다`);
            }
            hashChecks++;
        }
    }
}

/* **체이닝은 자리가 곧 해시값이어야 한다.** 화면에서는 그럴듯해 보이는 자리라 눈으로 못 잡는다. */
{
    let st = findHashState(FIND_HASH_CAP, [], 'chain');
    for (const v of pick(9, 99)) st = runFindOperation(FIND_CHAIN_OPS[0], st, v).state;
    st.buckets.forEach((b, i) => {
        for (const it of b) {
            if (findHash(it.v, st.cap) !== i) bad(`체이닝: ${it.v}이(가) ${i}번에 있다(해시값 ${findHash(it.v, st.cap)})`);
        }
    });
}

/* **개방 주소법은 한 칸에 하나뿐이고, 묘비는 빈 칸과 다른 것이어야 한다.** */
{
    let st = findHashState(FIND_HASH_CAP, [10, 20, 30, 40], 'open');
    st = runFindOperation(FIND_OPEN_OPS[2], st, 10).state;
    if (st.buckets[0] !== TOMB) bad('개방 주소법: 뺀 자리에 묘비가 서지 않았다');
    for (const v of [20, 30, 40]) {
        if (hitAt(runFindOperation(FIND_OPEN_OPS[1], st, v)) < 0) {
            bad(`개방 주소법: 묘비 뒤의 ${v}을(를) 찾지 못한다`);
        }
    }
}

console.log(`  해시 ${hashChecks}판 — 담긴 것을 Set으로 따로 들고 맞췄다`
    + ' · 빼고 난 뒤 남은 값을 전부 다시 찾아 묘비가 길을 잇는지 보았다');

/* ================================================================
   3. 카드에 적은 O 표기를 **실제로 잰다**
   ================================================================ */

{
    const {sizes, rows} = measureFindWork([8, 16, 32, 64, 128, 256]);
    const of = (kind) => rows.find((r) => r.kind === kind).work;

    const seq = of('seq');
    const bin = of('bin');
    const hash = of('hash');

    /* 순차는 개수를 그대로 탄다. 개수가 두 배가 되면 작업량도 두 배 언저리여야 한다. */
    for (let k = 1; k < sizes.length; k++) {
        const ratio = seq[k] / seq[k - 1];
        if (ratio < 1.7 || ratio > 2.3) {
            bad(`순차 탐색이 O(n)이 아니다 — ${sizes[k - 1]}→${sizes[k]}개에서 ${ratio.toFixed(2)}배`);
        }
    }
    /* 이진은 개수가 두 배가 되어도 «한 걸음»만 는다. 배로 늘면 로그가 아니다. */
    for (let k = 1; k < sizes.length; k++) {
        if (bin[k] > bin[k - 1] * 1.5 + 2) {
            bad(`이진 탐색이 O(log n)이 아니다 — ${sizes[k - 1]}→${sizes[k]}개에서 ${bin[k - 1]}→${bin[k]}`);
        }
    }
    /* 해시는 개수를 타지 않는다. 표를 값 수에 맞춰 키우는 한 그래야 한다. */
    for (let k = 1; k < sizes.length; k++) {
        if (hash[k] > hash[0] * 1.6 + 1) {
            bad(`해시가 O(1)이 아니다 — ${sizes[0]}개에서 ${hash[0]}, ${sizes[k]}개에서 ${hash[k]}`);
        }
    }
    /* **셋이 실제로 갈라지는가.** 나란히 놓는 뜻이 여기 있다. 가장 큰 개수에서
       순차가 이진보다, 이진이 해시보다 넉넉히 비싸지 않으면 표가 아무 말도 못 한다. */
    const last = sizes.length - 1;
    if (!(seq[last] > bin[last] * 3)) bad(`${sizes[last]}개에서 순차(${seq[last]})가 이진(${bin[last]})과 벌어지지 않았다`);
    if (!(bin[last] > hash[last])) bad(`${sizes[last]}개에서 이진(${bin[last]})이 해시(${hash[last]})보다 싸다`);

    console.log(`  O 표기 — 순차 ${seq.join('→')} · 이진 ${bin.join('→')} · 해시 ${hash.join('→')}`
        + ` (${sizes.join('·')}개)`);
}

/* ================================================================
   4. 나란히 비교 — **장 나누는 규칙 자체를 본다**
   ================================================================ */

{
    let raceChecks = 0;
    for (let round = 0; round < 30; round++) {
        const vals = pick(2 + Math.floor(rnd() * 10), 99).sort((a, b) => a - b);
        const states = makeFindRaceStates(vals);
        const target = rnd() < 0.7 ? vals[Math.floor(rnd() * vals.length)] : 1 + Math.floor(rnd() * 99);
        const race = buildFindRace(states, target);

        /* **끝나는 장 번호를 작업량과 대 보지 않는다.** 그것은 정의상 같은 수라
           무엇을 해도 통과하는 순환 논리다. 비교할 것은 «규칙 자체»다 —
           어느 장에서든 각 줄이 보이는 것이 「그때까지 한 일이 t 이하인 마지막 장」인가. */
        const prev = [0, 0, 0];
        race.frames.forEach((f, t) => {
            f.lanes.forEach((lane, k) => {
                const w = findWorkOf(lane.frame.counts);
                if (w > t) bad(`t=${t}에서 ${lane.name}이(가) ${w}만큼 일했다(t를 넘었다)`);
                if (w < prev[k]) bad(`t=${t}에서 ${lane.name}의 작업량이 ${prev[k]}에서 ${w}로 줄었다`);
                prev[k] = w;
                if (lane.done !== (t >= lane.finishedWork)) {
                    bad(`t=${t}에서 ${lane.name}의 「끝」이 ${lane.done}이다(총 ${lane.finishedWork})`);
                }
                raceChecks++;
            });
        });

        /* **세 줄이 같은 값을 담고 있어야 한다.** 이것이 깨지면 비교가 통째로 뜻을 잃는다. */
        for (const kind of ['seq', 'bin', 'hash']) {
            const got = findValues(race.runs.find((r) => r.kind === kind).out.state).slice().sort((a, b) => a - b);
            if (got.join() !== vals.join()) bad(`나란히 비교의 ${kind} 줄이 다른 값을 담고 있다 — ${got}`);
        }
    }
    console.log(`  나란히 비교 ${raceChecks}건 — 장마다 「t 이하인 마지막 장」 규칙과 세 줄의 담긴 값을 보았다`);
}

/* ================================================================
   5. 등록부가 화면과 어긋나지 않는가
   ================================================================ */

{
    for (const s of FIND_STRUCTS) {
        const opsOf = s.impls ? s.impls.flatMap((i) => i.ops) : s.ops;
        if (!opsOf.length) bad(`${s.name}에 연산이 하나도 없다`);
        if (!(s.readNotes || []).length) bad(`${s.name}에 「화면 읽는 법」이 없다`);
        if (!s.costRows.length) bad(`${s.name}에 비용표가 없다`);
        /* **배지의 뜻이 비어 있으면 색만 보고 짐작하게 된다.** */
        for (const f of s.facts || []) {
            if (!f.hint) bad(`${s.name}의 배지 「${f.text}」에 뜻이 없다`);
        }
    }
    /* 처음 자료는 정렬되어 있어야 한다 — 이진 탐색 탭이 그것을 전제로 연다. */
    const sorted = FIND_START.every((v, i) => i === 0 || FIND_START[i - 1] < v);
    if (!sorted) bad(`처음 자료가 정렬되어 있지 않다 — ${FIND_START}`);
    /* 처음 자료에 충돌이 하나라도 있어야 해시 탭이 가르칠 것을 보여 준다. */
    const homes = FIND_START.map((v) => findHash(v, FIND_HASH_CAP));
    if (new Set(homes).size === homes.length) {
        bad('처음 자료에 해시 충돌이 하나도 없다 — 해시 탭이 충돌을 보여 주지 못한다');
    }
}

/* ================================================================
   6. 페이지를 통째로 띄워 본다
   ================================================================ */

{
    const page = loadSim('cs/search', {box: {w: 900, h: 700}});
    page.lifecycle();
    for (const e of page.errors) bad(`페이지를 띄우다가 — ${e}`);

    const SICK = /NaN|Infinity|undefined/;
    for (const el of page.texts()) {
        for (const v of [el.text, el.html]) {
            if (typeof v === 'string' && SICK.test(v)) bad(`#${el.id}에 ${v.slice(0, 40)}`);
        }
    }
    /* 조사를 손으로 적어 둔 자리가 남아 있지 않은가 → `_lib/josa.js` */
    for (const el of page.texts()) {
        for (const v of [el.text, el.html]) {
            if (typeof v === 'string' && /이\(가\)|을\(를\)|은\(는\)|와\(과\)/.test(v)) {
                bad(`#${el.id}에 조사가 손으로 적혀 있다 — ${v.slice(0, 40)}`);
            }
        }
    }
    console.log('  페이지 — 띄우고 조작 줄을 붙이는 동안 죽지 않았다');
}

/* ================================================================
   7. 순차·이진 — **걸음 하나하나를 교과서 정의와 맞춘다**
   ================================================================
   1절은 답과 비교 횟수의 상한만 보았다. 여기서는 «어느 칸을 어떤 차례로 보았는가»를
   따로 짠 풀이와 맞춘다. 이진 탐색의 가운데는 교과서 정의 그대로 ⌊(lo + hi) / 2⌋다. */

const plain = (s) => String(s || '').replace(/\*\*/g, '');
const probesOf = (out) => out.frames.filter((f) => f.act.kind === 'probe').map((f) => f.act.i);

/** 따로 짠 이진 탐색. 되부름으로 쓰고 본 칸의 차례를 돌려준다. */
function refBinary(arr, t, lo = 0, hi = arr.length - 1, seen = []) {
    if (lo > hi) return {at: -1, seen};
    const mid = Math.floor((lo + hi) / 2);
    seen.push(mid);
    if (arr[mid] === t) return {at: mid, seen};
    return arr[mid] < t ? refBinary(arr, t, mid + 1, hi, seen) : refBinary(arr, t, lo, mid - 1, seen);
}

{
    let traceChecks = 0;
    const cases = [[], [5], [5, 9], [1, 2, 3, 4, 5, 6, 7, 8], [3, 17, 24, 38, 41, 55, 64, 73]];
    for (let r = 0; r < 40; r++) cases.push(pick(1 + Math.floor(rnd() * 12), 99).sort((a, b) => a - b));

    for (const vals of cases) {
        const n = vals.length;
        const state = findArrayState(vals);
        const targets = [...vals, 0, 100, ...(n ? [vals[0] - 1, vals[n - 1] + 1] : []), 50];
        for (const t of targets) {
            traceChecks++;
            const truth = vals.indexOf(t);

            /* 순차 — 0번부터 차례로, 찾으면 멈춘다. */
            const seq = runFindOperation(FIND_SEQ_OPS[0], state, t);
            const wantSeq = Array.from({length: truth >= 0 ? truth + 1 : n}, (_, i) => i);
            if (probesOf(seq).join() !== wantSeq.join()) {
                bad(`순차 ${t} in [${vals}] — 본 차례 ${probesOf(seq)}(정답 ${wantSeq})`);
            }
            if (seq.counts.access !== seq.counts.compare) bad(`순차 ${t} — 접근 ${seq.counts.access}과 비교 ${seq.counts.compare}이 갈렸다`);
            const seqEnd = plain(seq.frames.at(-1).say);
            if (n && truth >= 0 && !seqEnd.startsWith(`${truth}번에서 찾았습니다. ${truth + 1}번 비교했습니다.`)) {
                bad(`순차 ${t} — 끝 장 「${seqEnd}」`);
            }
            if (n && truth < 0 && !seqEnd.includes(`끝까지 ${n}번 비교했습니다`)) bad(`순차 ${t} 없음 — 끝 장 「${seqEnd}」`);

            /* 이진 — 본 칸의 차례가 따로 짠 풀이와 같아야 한다. */
            const bin = runFindOperation(FIND_BIN_OPS[0], state, t);
            const ref = refBinary(vals, t);
            if (probesOf(bin).join() !== ref.seen.join()) {
                bad(`이진 ${t} in [${vals}] — 본 차례 ${probesOf(bin)}(정답 ${ref.seen})`);
            }
            if (bin.counts.compare !== ref.seen.length) bad(`이진 ${t} — 비교 ${bin.counts.compare}번(정답 ${ref.seen.length}번)`);
            /* 비교 횟수의 상한 ⌊log₂n⌋ + 1. 가장 큰 값보다 큰 것을 찾으면 늘 오른쪽으로 가므로 상한에 꼭 닿는다. */
            const bound = n ? Math.floor(Math.log2(n)) + 1 : 0;
            if (bin.counts.compare > bound) bad(`이진 ${t} — ${n}개에서 ${bin.counts.compare}번(상한 ${bound})`);
            if (n && t > vals[n - 1] && bin.counts.compare !== bound) {
                bad(`이진 — [${vals}]에서 가장 큰 값보다 큰 ${t}를 찾는데 ${bin.counts.compare}번(${bound}번이어야 한다)`);
            }
            const binEnd = plain(bin.frames.at(-1).say);
            if (n && truth >= 0 && !binEnd.startsWith(`${truth}번에서 찾았습니다. ${ref.seen.length}번 비교했습니다.`)) {
                bad(`이진 ${t} — 끝 장 「${binEnd}」`);
            }
            if (n && truth < 0 && !binEnd.includes(`${ref.seen.length}번 만에 볼 곳이 없어졌습니다`)) bad(`이진 ${t} 없음 — 끝 장 「${binEnd}」`);
            if (truth < 0 && /정렬/.test(bin.frames.at(-1).marks.banner || '')) bad(`이진 ${t} — 정렬된 자료에서 없는 값인데 「놓쳤다」 경고가 떴다`);

            /* 걸음마다의 불변식 — 답이 있으면 늘 [lo, hi] 안에 있고, 버린 칸에는 답이 없다.
               버린 칸은 줄지 않고, lo·hi 사이는 걸음마다 좁아진다. */
            let prevRuled = 0;
            let prevWidth = Infinity;
            for (const f of bin.frames) {
                const {lo, hi} = f.state.cursors;
                if (lo !== undefined && hi !== undefined) {
                    if (truth >= 0 && (truth < lo || truth > hi)) bad(`이진 ${t} — 답 ${truth}번이 [${lo}, ${hi}] 밖으로 밀렸다`);
                    if (hi - lo + 1 > prevWidth) bad(`이진 ${t} — 볼 곳이 ${prevWidth}칸에서 ${hi - lo + 1}칸으로 늘었다`);
                    prevWidth = hi - lo + 1;
                }
                if (truth >= 0 && f.marks.ruled.includes(truth)) bad(`이진 ${t} — 답이 있는 ${truth}번을 버렸다`);
                if (f.marks.ruled.length < prevRuled) bad(`이진 ${t} — 버린 칸이 줄었다`);
                prevRuled = f.marks.ruled.length;
            }
            /* 이진 탐색이 버린 칸은 본 칸 말고는 세지 않는다 — 접근도 비교와 같다. */
            if (bin.counts.access !== bin.counts.compare) bad(`이진 ${t} — 접근 ${bin.counts.access}과 비교 ${bin.counts.compare}이 갈렸다`);
        }
    }
    console.log(`  순차·이진 걸음 ${traceChecks}판 — 본 칸의 차례를 따로 짠 풀이와, 끝 장의 수를 센 값과 맞췄다`);
}

/* ================================================================
   8. 해시 — **칸 하나하나와 세는 값을 따로 짠 표와 맞춘다**
   ================================================================
   2절은 «있다 · 없다»만 맞췄다. 그러면 값이 엉뚱한 칸에 앉거나 묘비를 다시 쓰지 않아도
   답은 맞을 수 있다. 여기서는 선형 조사와 체이닝을 평범한 배열로 따로 짜서 **칸마다** 맞춘다. */

const T = 'T';

/** 따로 짠 해시 표. 개방 주소법은 칸마다 값 · 묘비(T) · null, 체이닝은 칸마다 배열. */
function refHash(mode, cap) {
    const cells = Array.from({length: cap}, () => (mode === 'chain' ? [] : null));
    const home = (v) => v % cap;
    const run = (kind, v) => {
        const c = {compare: 0, access: 0, hash: 1};
        const h = home(v);
        if (mode === 'chain') {
            const chain = cells[h];
            c.access++;
            let pos = -1;
            for (let k = 0; k < chain.length; k++) { c.compare++; if (chain[k] === v) { pos = k; break; } }
            if (kind === 'put' && pos < 0) { chain.push(v); c.access++; }
            if (kind === 'remove' && pos >= 0) { chain.splice(pos, 1); c.access++; }
            return {c, pos, h};
        }
        let tomb = -1;
        for (let k = 0; k < cap; k++) {
            const at = (h + k) % cap;
            c.access++;
            const cell = cells[at];
            if (cell === null) {
                if (kind === 'put') {
                    const spot = tomb >= 0 ? tomb : at;
                    cells[spot] = v; c.access++;
                    return {c, spot, h, looked: k + 1};
                }
                return {c, pos: -1, h};
            }
            if (cell === T) { if (tomb < 0) tomb = at; continue; }
            c.compare++;
            if (cell === v) {
                if (kind === 'remove') { cells[at] = T; c.access++; }
                return {c, pos: at, h, shift: k};
            }
        }
        if (kind === 'put' && tomb >= 0) { cells[tomb] = v; c.access++; return {c, spot: tomb, h, looked: cap, wrapped: true}; }
        return {c, pos: -1, h, full: kind === 'put'};
    };
    return {cells, run};
}

const cellsOf = (st) => st.buckets.map((b) => (Array.isArray(b) ? b.map((it) => it.v) : (b === TOMB ? T : (b ? b.v : null))));

{
    let exactChecks = 0;
    for (const mode of ['chain', 'open']) {
        const [put, find, remove] = mode === 'chain' ? FIND_CHAIN_OPS : FIND_OPEN_OPS;
        const OP = {put, find, remove};
        for (const cap of [FIND_HASH_CAP, 7]) {
            for (let round = 0; round < 25; round++) {
                let state = findHashState(cap, [], mode);
                const ref = refHash(mode, cap);
                for (let step = 0; step < 50; step++) {
                    const v = Math.floor(rnd() * 40);
                    const r = rnd();
                    const kind = r < 0.5 ? 'put' : (r < 0.75 ? 'remove' : 'find');
                    const out = runFindOperation(OP[kind], state, v);
                    state = out.state;
                    const want = ref.run(kind, v);
                    exactChecks++;
                    const where = `[${mode} · 칸 ${cap}] ${kind} ${v}`;

                    const got = cellsOf(state);
                    if (JSON.stringify(got) !== JSON.stringify(ref.cells)) {
                        bad(`${where} — 칸이 ${JSON.stringify(got)}(정답 ${JSON.stringify(ref.cells)})`);
                        break;
                    }
                    for (const key of ['compare', 'access', 'hash']) {
                        if (out.counts[key] !== want.c[key]) bad(`${where} — ${key} ${out.counts[key]}번(정답 ${want.c[key]}번)`);
                    }
                    /* ▶(본래 자리)는 계산으로 나온 칸이어야 한다. */
                    if (state.home !== want.h) bad(`${where} — 본래 자리를 ${state.home}번이라 했다(정답 ${want.h}번)`);

                    /* 끝 장의 수가 센 값과 같은가. */
                    const end = plain(out.frames.at(-1).say);
                    if (kind === 'find' && want.pos >= 0) {
                        const hitCell = hitAt(out);
                        const wantCell = mode === 'chain' ? want.h : want.pos;
                        if (hitCell !== wantCell) bad(`${where} — ${hitCell}번 칸을 찾았다고 표시했다(정답 ${wantCell}번)`);
                        if (mode === 'chain' && !end.startsWith(`${want.h}번 칸 리스트의 ${want.pos + 1}번째에서 찾았습니다. 계산 한 번에 비교 ${want.pos + 1}번입니다.`)) {
                            bad(`${where} — 끝 장 「${end}」`);
                        }
                        if (mode === 'open') {
                            const tail = want.shift > 0 ? `계산한 자리에서 ${want.shift}칸 밀린 곳입니다.` : '계산한 자리에 바로 있었습니다.';
                            if (end !== `${want.pos}번에서 찾았습니다. ${tail}`) bad(`${where} — 끝 장 「${end}」`);
                        }
                    }
                    if (kind === 'find' && want.pos < 0 && hitAt(out) >= 0) bad(`${where} — 없는 값을 찾았다고 표시했다`);
                    if (mode === 'open' && kind === 'put' && want.wrapped) {
                        /* 한 바퀴를 다 돌도록 빈 칸이 없었다 — 지나온 첫 묘비에 앉는다. */
                        if (!end.includes(`묘비 자리인 ${want.spot}번에 넣었습니다`)) bad(`${where} — 끝 장 「${end}」`);
                    } else if (mode === 'open' && kind === 'put' && want.spot !== undefined) {
                        const dist = (want.spot - want.h + cap) % cap;
                        if (dist > 0 && !end.includes(`계산한 자리(${want.h}번)에서 ${dist}칸 밀렸습니다`)) bad(`${where} — 끝 장 「${end}」`);
                        if (dist === 0 && !end.includes(`계산한 자리 그대로 ${want.spot}번에 넣었습니다`) && !end.includes(`묘비 자리인 ${want.spot}번`)) {
                            bad(`${where} — 끝 장 「${end}」`);
                        }
                        if (want.looked > dist + 1 && want.looked < cap && !end.includes(`${want.looked}칸을 확인했습니다`)) bad(`${where} — 끝 장 「${end}」`);
                    }
                    if (want.full) {
                        if (!/모두 찼습니다/.test(out.frames.at(-1).marks.banner || '')) bad(`${where} — 꽉 찼는데 까닭을 말하지 않는다`);
                    }
                    const fault = findStateFault(state);
                    if (fault) bad(`${where} — ${fault}`);
                }
            }
        }
    }
    console.log(`  해시 칸 대조 ${exactChecks}판 — 선형 조사·체이닝을 배열로 따로 짜서 칸 · 세는 값 · 끝 장의 수를 맞췄다`);
}

/* ================================================================
   9. 페이지 — 조작의 경계에서 죽지 않고, 화면의 수가 담긴 것과 맞는가
   ================================================================ */

{
    const page = loadSim('cs/search', {box: {w: 900, h: 700}});
    page.lifecycle();
    const $ = (id) => page.el(id);
    const text = (id) => $(id).textContent;
    const clickText = (hostId, re) => {
        const b = [...$(hostId).querySelectorAll('button')].find((x) => re.test(x.textContent));
        if (!b) { bad(`#${hostId}에 「${re}」 버튼이 없다`); return false; }
        b.click();
        return true;
    };
    const opLogRows = () => $('op-log').children.length;

    /* 찾을 값의 경계 — 범위 밖과 정수가 아닌 것은 막고, 0과 99는 받는다. */
    for (const raw of ['', '-1', '100', '3.5', 'abc', ' ']) {
        $('value-input').value = raw;
        const rows = opLogRows();
        clickText('ops-host', /탐색/);
        if (opLogRows() !== rows) bad(`찾을 값 「${raw}」를 받아 실행했다`);
        if (!text('input-error').trim()) bad(`찾을 값 「${raw}」에 까닭을 말하지 않는다`);
    }
    for (const raw of ['0', '99']) {
        $('value-input').value = raw;
        const rows = opLogRows();
        clickText('ops-host', /탐색/);
        if (opLogRows() !== rows + 1) bad(`찾을 값 「${raw}」를 받지 않았다`);
    }

    /* 직접 입력의 경계 */
    for (const raw of ['1, 2, 2', '1, 100', '1, x', Array.from({length: 13}, (_, i) => i).join(',')]) {
        $('input-text').value = raw;
        $('btn-apply-input').click();
        if (!text('input-error').trim()) bad(`직접 입력 「${raw}」을 막지 않았다`);
    }

    /* 값 12개를 넣고 개방 주소법(칸 10개)으로 가도 **자료가 줄지 않아야 한다.**
       다 담지 못한 값은 그 까닭을 띄우고, 찾기 한 번에 사라지지 않는다. */
    const twelve = [3, 13, 23, 33, 5, 15, 25, 35, 7, 17, 27, 37];
    $('input-text').value = twelve.join(', ');
    $('btn-apply-input').click();
    if (text('size-label') !== '12개') bad(`값 12개를 넣었는데 「${text('size-label')}」`);
    clickText('group-tabs', /계산 기반/);
    /* 적재율 = 담긴 값 ÷ 칸 수. 체이닝은 12개를 다 담는다. */
    if (!text('view-host').includes(`적재율 ${(12 / FIND_HASH_CAP).toFixed(2)}`)) bad(`체이닝 적재율이 ${(12 / FIND_HASH_CAP).toFixed(2)}가 아니다 — ${text('view-host').slice(-40)}`);
    clickText('impl-buttons', /개방 주소법/);
    if (text('size-label') !== `${FIND_HASH_CAP}개 / 칸 ${FIND_HASH_CAP}개`) bad(`개방 주소법에서 「${text('size-label')}」`);
    if (!text('view-host').includes('12개 중 10개만 담았습니다')) bad('개방 주소법이 값 둘을 말없이 뺐다');
    if (!text('view-host').includes('적재율 1.00')) bad('개방 주소법(10/10) 적재율이 1.00이 아니다');
    $('value-input').value = '3';
    clickText('ops-host', /탐색/);
    clickText('group-tabs', /비교 기반/);
    if (text('size-label') !== '12개') bad(`개방 주소법에서 찾기 한 번 뒤 순차 탭 자료가 「${text('size-label')}」 — 담지 못한 값이 사라졌다`);

    /* 빈 자료에서 모든 탭 · 모든 연산이 죽지 않는다. */
    $('btn-clear').click();
    for (const g of [...$('group-tabs').querySelectorAll('button')]) {
        g.click();
        for (const s of [...$('struct-tabs').querySelectorAll('button')]) {
            s.click();
            const impls = [...$('impl-buttons').querySelectorAll('button')];
            for (const im of impls.length ? impls : [null]) {
                if (im) im.click();
                for (const op of [...$('ops-host').querySelectorAll('button')]) {
                    $('value-input').value = '7';
                    op.click();
                    $('btn-last').click();
                }
            }
        }
    }
    for (const e of page.errors) bad(`경계 조작 중 — ${e}`);
    for (const el of page.texts()) {
        if (/NaN|Infinity|undefined/.test(el.text)) bad(`경계 조작 뒤 #${el.id}에 ${el.text.slice(0, 40)}`);
    }
    console.log('  페이지 경계 — 잘못된 값은 막고, 칸보다 많은 값도 잃지 않으며, 적재율이 담긴 값 ÷ 칸 수다');
}

console.log(fail ? `찾기 검사 — ${fail}건 어긋남` : '전부 통과');
test('find', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
