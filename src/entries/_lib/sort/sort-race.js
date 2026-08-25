/* 겨루기 — **같은 자료를 전 종목에 한꺼번에 물린다.**
 *
 * 한 종목씩 볼 때는 「빠르다·느리다」가 숫자로만 남는데, 나란히 돌리면
 * **누가 언제 끝나는지**가 그림이 된다.
 *
 * **무엇을 똑같이 나눠 주는가 — 「걸음」이 아니라 「일한 양」이다.**
 * 처음에는 기록된 장을 하나씩 똑같이 나눠 주었는데, 그러면 겨루기가 공정하지 않다.
 * 한 장의 무게가 종목마다 다르기 때문이다 — 설명만 바뀌는 장(`mark`)도 한 장을 먹고,
 * 구간을 통째로 복사하는 것도 한 장이다. 실제로 측정해 보니 **일을 가장 적게 한
 * 계수 정렬이 꼴찌로 끝났다**(값이 없는 칸마다 「건너뜁니다」 장을 한 장씩 썼기 때문).
 *
 * 그래서 축을 «비교 + 옮김»으로 바꿨다. 같은 만큼 일했을 때 어디까지 갔는지를 보므로
 * **먼저 끝난 쪽이 실제로 일을 덜 한 것**이 정의상 참이 된다.
 * 아래 곡선도 같은 잣대를 쓰므로 둘이 어긋날 수 없다.
 *
 * **크기에 천장이 있다.** 걸음을 하나도 솎지 않아야 어느 종목도 손해를 보지 않는데,
 * 기록 예산(`sort-model.js`의 `sortFrameBudget`)이 `300000/n`이라 n이 커지면
 * 걸음이 많은 종목부터 솎이기 시작한다. 64까지는 어느 종목도 솎이지 않는다 —
 * 그것을 `check:sort`가 대조한다.
 */

import {SORT_ALGOS} from './sort-registry.js';
import {runSortAlgorithm} from './sort-model.js';

export const RACE_MAX_N = 64;

/** 곡선을 그릴 크기들. 여기서만 큰 값을 쓴다 — 장을 남기지 않으므로 부담이 없다. */
export const RACE_CURVE_SIZES = [8, 16, 32, 64, 128, 256, 512, 1000];

/**
 * 전 종목을 같은 자료로 돌려 **일한 양을 한 칸씩 나란히 넘길 수 있는 장**을 만든다.
 * @returns {{frames: object[], runs: object[]}}
 */
export function buildSortRace(values) {
    const runs = SORT_ALGOS.map((algo) => {
        const out = runSortAlgorithm(algo, values);
        /* 장마다 「그때까지 한 일」을 미리 뽑아 둔다. 이것이 겨루기의 «시간축»이다. */
        const work = out.frames.map((f) => f.counts.compare + f.counts.move);
        return {algo, frames: out.frames, work, total: work[work.length - 1] || 0};
    });

    const maxWork = Math.max(1, ...runs.map((r) => r.total));
    const cursor = runs.map(() => 0);
    const frames = [];

    for (let t = 0; t <= maxWork; t++) {
        const lanes = runs.map((r, k) => {
            // 「지금까지 t만큼 일했을 때」의 마지막 장. 훑어 온 자리를 이어 쓰므로 전체가 O(장 수)다.
            while (cursor[k] + 1 < r.frames.length && r.work[cursor[k] + 1] <= t) cursor[k]++;
            return {
                algo: r.algo,
                frame: r.frames[cursor[k]],
                done: t >= r.total,
                /** 끝내는 데 든 일의 양. **이것이 곧 등수다.** */
                finishedWork: r.total,
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
                ? '같은 자료를 열한 종목에 한꺼번에 물렸습니다. '
                  + '**일한 양(비교 + 옮김)을 똑같이 나눠 줍니다** — 같은 만큼 일했을 때 어디까지 갔는지를 봅니다.'
                : (finished < lanes.length
                    ? `${finished}종목이 끝났습니다. 남은 종목은 아직 일하고 있습니다.`
                    : '모두 끝났습니다. **끝난 차례가 곧 일한 양의 차례입니다.**'),
        });
    }

    return {frames, runs};
}

/**
 * **장을 남기지 않고 「일한 양」만 측정한다.** n을 키워 가며 측정하면 O(n²)와 O(n log n)이
 * 갈라지는 것이 곡선으로 드러난다 — 한 걸음씩 넘겨서는 절대 볼 수 없는 그림이다.
 *
 * @param {(n:number)=>number[]} makeValues 크기별 자료를 만드는 함수
 * @returns {{sizes:number[], series:{algo:object, work:number[]}[]}}
 */
export function measureSortWork(makeValues, sizes = RACE_CURVE_SIZES) {
    const data = sizes.map((n) => makeValues(n));
    const series = SORT_ALGOS.map((algo) => ({
        algo,
        /* **「비교 + 옮김」을 측정한다.** 비교만 세면 분배 정렬이 0이라 바닥에 붙어
           아무것도 보이지 않는다. 둘을 더하면 어느 종목이든 실제로 한 일이 잡힌다. */
        work: data.map((values) => {
            const out = runSortAlgorithm(algo, values, {countOnly: true});
            return out.counts.compare + out.counts.move;
        }),
    }));
    return {sizes, series};
}
