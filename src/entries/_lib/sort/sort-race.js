/* 알고리즘 비교 — **같은 자료를 전체 알고리즘에 한꺼번에 물린다.**
 *
 * 한 알고리즘씩 볼 때는 「빠르다·느리다」가 숫자로만 남는데, 나란히 돌리면
 * **누가 언제 끝나는지**가 그림이 된다.
 *
 * **무엇을 똑같이 나눠 주는가 — 「걸음」이 아니라 「작업량」이다.**
 * 처음에는 기록된 장을 하나씩 똑같이 나눠 주었는데, 그러면 비교가 공정하지 않다.
 * 한 장의 무게가 알고리즘마다 다르기 때문이다 — 설명만 바뀌는 장(`mark`)도 한 장을 먹고,
 * 구간을 통째로 복사하는 것도 한 장이다. 실제로 측정해 보니 **일을 가장 적게 한
 * 계수 정렬이 꼴찌로 끝났다**(값이 없는 칸마다 「건너뜁니다」 장을 한 장씩 썼기 때문).
 *
 * 그래서 축을 «작업량»으로 바꿨다. 같은 만큼 일했을 때 어디까지 갔는지를 보므로
 * **먼저 끝난 쪽이 실제로 일을 덜 한 것**이 정의상 참이 된다.
 * 아래 곡선도 같은 잣대를 쓰므로 둘이 어긋날 수 없다.
 *
 * **작업량은 화면의 세 숫자를 더한 값이다 — 비교 + 옮김 + 배열 접근.**
 * 처음에는 «비교 + 옮김»만 더했는데, 그러면 계수 정렬의 «세는 단계»가 공짜가 된다.
 * 세는 동안에는 옮기지도 비교하지도 않기 때문이다. 그 스물두 장이 전부 0이 되어
 * **t=0에서 이미 배열을 비운 자리로 건너뛰었고**, 알고리즘 비교 줄이 텅 빈 채로 시작했다.
 * 배열을 읽는 것도 일이므로 접근까지 더한다 — 그러면 공짜인 걸음이 없다.
 *
 * **크기에 천장이 있다.** 걸음을 하나도 솎지 않아야 어느 알고리즘도 손해를 보지 않는데,
 * 기록 예산(`sort-model.js`의 `sortFrameBudget`)이 `300000/n`이라 n이 커지면
 * 걸음이 많은 알고리즘부터 솎이기 시작한다. 64까지는 어느 알고리즘도 솎이지 않는다 —
 * 그것을 `check:sort`가 대조한다.
 */

import {SORT_ALGOS} from './sort-registry.js';
import {runSortAlgorithm} from './sort-model.js';

export const RACE_MAX_N = 64;

/** 곡선을 그릴 크기들. 여기서만 큰 값을 쓴다 — 장을 남기지 않으므로 부담이 없다. */
export const RACE_CURVE_SIZES = [8, 16, 32, 64, 128, 256, 512, 1000];

/**
 * 고른 알고리즘을 같은 자료로 돌려 **작업량을 한 칸씩 나란히 넘길 수 있는 장**을 만든다.
 * @param {object[]} [algos] 비교할 알고리즘. 기본은 전부.
 * @returns {{frames: object[], runs: object[]}}
 */
export function buildSortRace(values, algos = SORT_ALGOS) {
    const runs = algos.map((algo) => {
        const out = runSortAlgorithm(algo, values);
        /* 장마다 「그때까지 한 일」을 미리 뽑아 둔다. 이것이 알고리즘 비교의 «시간축»이다. */
        const work = out.frames.map((f) => f.counts.compare + f.counts.move + f.counts.access);
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
                /* **색은 고른 차례가 아니라 등록부 차례로 정한다.** 몇 개를 골랐든
                   버블 정렬은 늘 같은 색이어야 골라 놓은 것을 바꿔 가며 봐도 헷갈리지 않는다. */
                colorIndex: SORT_ALGOS.indexOf(r.algo),
                frame: r.frames[cursor[k]],
                done: t >= r.total,
                /** 끝내는 데 든 일의 양. **이것이 곧 등수다.** */
                finishedWork: r.total,
            };
        });
        const finished = lanes.filter((l) => l.done).length;
        frames.push({
            race: lanes,
            /* 재생기와 화면이 기대하는 자리를 채워 둔다. 알고리즘 비교에서는 알고리즘마다 세는 값이
               다르므로 **합계를 내지 않는다** — 줄마다 제 숫자를 옆에 적는다. */
            counts: {compare: 0, move: 0, access: 0},
            marks: {compare: null, moving: [], done: [], pivot: null, held: null, cursors: {}},
            ranges: [],
            aux: null,
            strip: null,
            say: finished === 0
                ? `고른 ${lanes.length}가지에 같은 자료를 물렸습니다. `
                  + '**작업량을 똑같이 나눠 줍니다** — 화면의 세 숫자(비교 · 옮김 · 배열 접근)를 더한 값입니다.'
                : (finished < lanes.length
                    ? `${finished}가지가 끝났습니다. 남은 것은 아직 일하고 있습니다.`
                    : '모두 끝났습니다. **끝난 차례가 곧 작업량의 차례입니다.**'),
        });
    }

    return {frames, runs};
}

/**
 * **장을 남기지 않고 「작업량」만 측정한다.** n을 키워 가며 측정하면 O(n²)와 O(n log n)이
 * 갈라지는 것이 곡선으로 드러난다 — 한 걸음씩 넘겨서는 절대 볼 수 없는 그림이다.
 *
 * @param {(n:number)=>number[]} makeValues 크기별 자료를 만드는 함수
 * @returns {{sizes:number[], series:{algo:object, work:number[]}[]}}
 */
export function measureSortWork(makeValues, sizes = RACE_CURVE_SIZES, algos = SORT_ALGOS) {
    const data = sizes.map((n) => makeValues(n));
    const series = algos.map((algo) => ({
        algo,
        colorIndex: SORT_ALGOS.indexOf(algo),
        /* **알고리즘 비교와 같은 잣대를 쓴다.** 비교만 세면 분배 정렬이 0이라 바닥에 붙어
           아무것도 보이지 않고, 옮김까지만 더하면 계수 정렬의 세는 단계가 빠진다. */
        work: data.map((values) => {
            const out = runSortAlgorithm(algo, values, {countOnly: true});
            return out.counts.compare + out.counts.move + out.counts.access;
        }),
    }));
    return {sizes, series};
}
