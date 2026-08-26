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
import {loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 40) console.log('  ✗ ' + m); };

findResetIds();

/** 되풀이할 수 있는 난수. 씨앗이 같으면 같은 자료가 나와야 결함을 다시 볼 수 있다. */
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
                if (out.counts.hash !== 1) bad(`[${mode}] 넣기가 해시를 ${out.counts.hash}번 돌렸다`);
            } else if (r < 0.8) {
                const out = runFindOperation(remove, state, v);
                state = out.state;
                truth.delete(v);
                if (out.counts.hash !== 1) bad(`[${mode}] 빼기가 해시를 ${out.counts.hash}번 돌렸다`);
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
   4. 나란히 놓기 — **장 나누는 규칙 자체를 본다**
   ================================================================ */

{
    let raceChecks = 0;
    for (let round = 0; round < 30; round++) {
        const vals = pick(2 + Math.floor(rnd() * 10), 99).sort((a, b) => a - b);
        const states = makeFindRaceStates(vals);
        const target = rnd() < 0.7 ? vals[Math.floor(rnd() * vals.length)] : 1 + Math.floor(rnd() * 99);
        const race = buildFindRace(states, target);

        /* **끝나는 장 번호를 작업량과 대 보지 않는다.** 그것은 정의상 같은 수라
           무엇을 해도 통과하는 순환 논리다. 견줄 것은 «규칙 자체»다 —
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

        /* **세 줄이 같은 값을 담고 있어야 한다.** 이것이 깨지면 견주기가 통째로 뜻을 잃는다. */
        for (const kind of ['seq', 'bin', 'hash']) {
            const got = findValues(race.runs.find((r) => r.kind === kind).out.state).slice().sort((a, b) => a - b);
            if (got.join() !== vals.join()) bad(`나란히 놓기의 ${kind} 줄이 다른 값을 담고 있다 — ${got}`);
        }
    }
    console.log(`  나란히 놓기 ${raceChecks}건 — 장마다 「t 이하인 마지막 장」 규칙과 세 줄의 담긴 값을 보았다`);
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
    for (const el of page.byId.values()) {
        for (const v of [el._text, el._html]) {
            if (typeof v === 'string' && SICK.test(v)) bad(`#${el.id}에 ${v.slice(0, 40)}`);
        }
    }
    /* 조사를 손으로 적어 둔 자리가 남아 있지 않은가 → `_lib/josa.js` */
    for (const el of page.byId.values()) {
        for (const v of [el._text, el._html]) {
            if (typeof v === 'string' && /이\(가\)|을\(를\)|은\(는\)|와\(과\)/.test(v)) {
                bad(`#${el.id}에 조사가 손으로 적혀 있다 — ${v.slice(0, 40)}`);
            }
        }
    }
    console.log('  페이지 — 띄우고 조작 줄을 붙이는 동안 죽지 않았다');
}

console.log(fail ? `찾기 검사 — ${fail}건 어긋남` : '전부 통과');
process.exit(fail ? 1 : 0);
