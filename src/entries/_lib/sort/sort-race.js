/* 겨루기 — **같은 자료를 전 종목에 한꺼번에 물린다.**
 *
 * 한 종목씩 볼 때는 「빠르다·느리다」가 숫자로만 남는데, 나란히 돌리면
 * **누가 언제 끝나는지**가 그림이 된다. 한 걸음을 모두에게 똑같이 주므로
 * 먼저 끝난 쪽이 실제로 일을 덜 한 것이다.
 *
 * **크기에 천장이 있다.** 걸음을 하나도 솎지 않아야 겨루기가 공정한데,
 * 기록 예산이 `300000/n`이고 단순 정렬의 걸음이 대략 `0.75n²`이라
 * `n³ ≤ 400000`, 곧 n이 73쯤을 넘으면 어느 한쪽만 솎이기 시작한다.
 * 그래서 64에서 끊는다 → `sort-model.js`의 `sortFrameBudget`.
 */

import {SORT_ALGOS} from './sort-registry.js';
import {runSortAlgorithm} from './sort-model.js';

export const RACE_MAX_N = 64;

/** 곡선을 그릴 크기들. 여기서만 큰 값을 쓴다 — 장을 남기지 않으므로 부담이 없다. */
export const RACE_CURVE_SIZES = [8, 16, 32, 64, 128, 256, 512, 1000];

/**
 * 전 종목을 같은 자료로 돌려 **한 걸음씩 나란히 넘길 수 있는 장**을 만든다.
 * @returns {{frames: object[], runs: object[]}}
 */
export function buildSortRace(values) {
    const runs = SORT_ALGOS.map((algo) => {
        const out = runSortAlgorithm(algo, values);
        return {algo, frames: out.frames, counts: out.counts, sorted: out.sorted};
    });

    const total = Math.max(...runs.map((r) => r.frames.length));
    const frames = [];
    for (let t = 0; t < total; t++) {
        const lanes = runs.map((r) => {
            const last = r.frames.length - 1;
            const at = Math.min(t, last);
            return {
                algo: r.algo,
                frame: r.frames[at],
                done: t >= last,
                /* **끝난 걸음 수를 적어 둔다.** 「몇 번째에 끝났나」가 곧 등수다. */
                finishedAt: last,
            };
        });
        const finished = lanes.filter((l) => l.done).length;
        frames.push({
            race: lanes,
            /* 재생기와 화면이 기대하는 자리를 채워 둔다. 겨루기에서는 종목마다 세는 값이
               다르므로 **합계를 내지 않는다** — 줄마다 제 숫자를 옆에 적는다. */
            counts: {compare: 0, move: 0, access: 0},
            marks: {compare: null, moving: [], done: [], pivot: null, held: null, cursors: {}},
            ranges: [],
            aux: null,
            strip: null,
            say: finished === 0
                ? '같은 자료를 열 종목에 한꺼번에 물렸습니다. 한 걸음씩 똑같이 나눠 줍니다.'
                : (finished < lanes.length
                    ? `${finished}종목이 끝났습니다. 남은 종목은 아직 일하고 있습니다.`
                    : '모두 끝났습니다. 끝난 차례가 곧 일한 양의 차례입니다.'),
        });
    }

    return {frames, runs};
}

/**
 * **장을 남기지 않고 「일한 양」만 잰다.** n을 키워 가며 재면 O(n²)와 O(n log n)이
 * 갈라지는 것이 곡선으로 드러난다 — 한 걸음씩 넘겨서는 절대 볼 수 없는 그림이다.
 *
 * @param {(n:number)=>number[]} makeValues 크기별 자료를 만드는 함수
 * @returns {{sizes:number[], series:{algo:object, work:number[]}[]}}
 */
export function measureSortWork(makeValues, sizes = RACE_CURVE_SIZES) {
    const data = sizes.map((n) => makeValues(n));
    const series = SORT_ALGOS.map((algo) => ({
        algo,
        /* **「비교 + 옮김」을 잰다.** 비교만 세면 분배 정렬이 0이라 바닥에 붙어
           아무것도 보이지 않는다. 둘을 더하면 어느 종목이든 실제로 한 일이 잡힌다. */
        work: data.map((values) => {
            const out = runSortAlgorithm(algo, values, {countOnly: true});
            return out.counts.compare + out.counts.move;
        }),
    }));
    return {sizes, series};
}
