/* 나란히 놓기 — **같은 자료에서 같은 값을 세 가지 방법으로 한꺼번에 찾는다.**
 *
 * **무엇을 똑같이 나눠 주는가 — 「걸음」이 아니라 「작업량」이다.**
 * 기록된 장을 하나씩 나눠 주면 공정하지 않다. 한 장의 무게가 다르기 때문이다 —
 * 설명만 바뀌는 장도 한 장을 먹는다. 축을 «작업량»(비교 + 접근 + 계산)으로 두면
 * **먼저 끝난 쪽이 실제로 일을 덜 한 것**이 정의상 참이 된다.
 *
 * 셋 가운데 하나라도 빼면 그 일이 공짜가 되어 축이 기운다. 특히 **`계산`을 빼면 안 된다** —
 * 빼는 순간 해시는 「아무 일도 안 하고 답을 아는」 마법이 되어, 이 페이지가 가르치려는
 * 「계산 한 번으로 «바꿔치기»한 것」이 사라진다.
 */

import {runFindOperation, findArrayState, findHashState} from './find-model.js';
import {withJosa} from '../josa.js';
import {FIND_SEQ_OPS, FIND_BIN_OPS, FIND_CHAIN_OPS} from './find-ops.js';

/** 한 장에 든 일의 양. **화면의 세 숫자를 그대로 더한다** — 화면과 축이 어긋날 수 없게. */
export const findWorkOf = (c) => c.compare + c.access + c.hash;

const RACE_LANES = [
    {kind: 'seq', name: '순차 탐색', op: FIND_SEQ_OPS[0]},
    {kind: 'bin', name: '이진 탐색', op: FIND_BIN_OPS[0]},
    {kind: 'hash', name: '해시 테이블', op: FIND_CHAIN_OPS[1]},
];

/** 나란히 놓기가 쓰는 해시 표의 칸 수. **값 수에 맞춰 늘린다** — 까닭은 `measureFindWork`에. */
export const findRaceCap = (n) => Math.max(4, n * 2);

/** 세 줄의 처음 상태. **같은 값을 담는다** — 그것이 비교의 전제다. */
export function makeFindRaceStates(values) {
    return {
        seq: findArrayState(values),
        bin: findArrayState(values),
        hash: findHashState(findRaceCap(values.length), values, 'chain'),
    };
}

function idleOf(state, why) {
    return {
        state,
        act: {kind: 'idle'},
        marks: {focus: [], hit: [], hitPos: null, ruled: [], banner: why || null},
        counts: {compare: 0, access: 0, hash: 0},
        say: '',
    };
}

/**
 * 세 줄에 같은 값을 물려 **작업량을 한 칸씩 나란히 넘길 수 있는 장**을 만든다.
 *
 * @param {object} states `{seq, bin, hash}`
 * @param {number} v      찾을 값
 */
export function buildFindRace(states, v) {
    const runs = RACE_LANES.map((L) => {
        const out = runFindOperation(L.op, states[L.kind], v);
        const work = out.frames.map((f) => findWorkOf(f.counts));
        return {...L, out, work, total: work[work.length - 1] || 0};
    });

    /* **아무 줄도 일하지 않았으면 견줄 것이 없다.** 자료가 비었을 때가 그렇다.
       한쪽만 막히는 일은 여기서는 생기지 않는다 — 셋 다 「찾기」뿐이고, 찾기는
       무엇을 넣거나 빼지 않으므로 담긴 것이 갈라질 수가 없다. */
    if (runs.every((r) => r.total === 0)) {
        return {
            frames: [{
                lanes: runs.map((r) => ({
                    kind: r.kind,
                    name: r.name,
                    frame: idleOf(states[r.kind], '비어 있어 찾을 것이 없습니다.'),
                    done: true,
                    finishedWork: 0,
                })),
                counts: {compare: 0, access: 0, hash: 0},
                say: '비어 있어 **아무 일도 일어나지 않았습니다.**',
            }],
            runs,
            blocked: true,
        };
    }

    const maxWork = Math.max(1, ...runs.map((r) => r.total));
    const cursor = runs.map(() => 0);
    const frames = [];

    for (let t = 0; t <= maxWork; t++) {
        const lanes = runs.map((r, k) => {
            // 「지금까지 t만큼 일했을 때」의 마지막 장. 훑어 온 자리를 이어 쓰므로 전체가 O(장 수)다.
            while (cursor[k] + 1 < r.out.frames.length && r.work[cursor[k] + 1] <= t) cursor[k]++;
            return {
                kind: r.kind,
                name: r.name,
                frame: r.out.frames[cursor[k]],
                done: t >= r.total,
                finishedWork: r.total,
            };
        });

        const done = lanes.filter((l) => l.done);
        const best = runs.reduce((a, b) => (b.total < a.total ? b : a));
        const worst = runs.reduce((a, b) => (b.total > a.total ? b : a));
        frames.push({
            lanes,
            counts: {compare: 0, access: 0, hash: 0},
            say: done.length === 0
                ? '세 가지에 **같은 값을 찾게** 했습니다. 작업량(비교 + 접근 + 계산)을'
                  + ' 똑같이 나눠 주므로 **먼저 끝난 쪽이 일을 덜 한 것**입니다.'
                : (done.length < 3
                    ? `${done.map((l) => l.name).join(' · ')} 쪽이 끝났습니다.`
                        + ' 나머지는 아직 찾고 있습니다.'
                    : `셋 다 끝났습니다. **${withJosa(best.name, '이가')}** ${best.total}, `
                      + `**${withJosa(worst.name, '이가')}** ${worst.total}만큼 일했습니다. `
                      + '**개수가 적어 차이가 작습니다 — 아래 표에서 개수를 키워 보세요.**'),
        });
    }

    return {frames, runs};
}

/** 아래 표에서 개수를 키워 가며 재는 자리. */
export const FIND_MEASURE_SIZES = [8, 16, 32, 64, 128];

/** 한 크기에서 몇 개의 값을 찾아 평균을 낼지. **전부 재면 느리고, 하나만 재면 고른 티가 난다.** */
const SAMPLES = 8;

/**
 * **장을 남기지 않고 개수를 키워 가며 작업량만 잰다.**
 *
 * **고르게 뽑은 여덟 값의 평균을 쓴다.** 한 값만 재면 어느 것을 고르느냐로 답이 달라진다 —
 * 순차 탐색은 첫 값이면 1이고 끝 값이면 n이다. 고른 값 하나로 표를 만들면 그것은 재는 것이
 * 아니라 **고르는 것**이 된다.
 *
 * **해시 표는 값 수에 맞춰 키운다.** 칸을 10으로 고정해 두고 값을 128개 넣으면 한 칸에
 * 열세 개씩 매달려 해시도 결국 O(n)이 된다 — 그러면 표가 「해시는 그대로다」를 부정하게 된다.
 * 실제 해시 테이블도 적재율이 높아지면 표를 새로 만들어 옮긴다. **그 사실을 표에 반영한
 * 것이지 해시를 봐준 것이 아니다** — 화면 아래 「화면 읽는 법」에 그렇게 적어 두었다.
 */
export function measureFindWork(sizes = FIND_MEASURE_SIZES) {
    const rows = RACE_LANES.map((L) => ({kind: L.kind, name: L.name, work: []}));

    for (const n of sizes) {
        // 정렬된 값. 이진 탐색이 그것을 전제로 한다.
        const values = Array.from({length: n}, (_, i) => i * 3 + 1);
        const states = makeFindRaceStates(values);
        const targets = Array.from({length: SAMPLES},
            (_, k) => values[Math.floor(((k + 0.5) * n) / SAMPLES)]);

        RACE_LANES.forEach((L, k) => {
            let sum = 0;
            for (const t of targets) sum += findWorkOf(runFindOperation(L.op, states[L.kind], t).counts);
            rows[k].work.push(Math.round(sum / targets.length));
        });
    }
    return {sizes, rows};
}
