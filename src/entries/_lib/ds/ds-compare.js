/* 비용 비교 — **같은 연산을 배열과 연결 리스트에 한꺼번에 물린다.**
 *
 * 한 구조씩 볼 때는 「싸다·비싸다」가 숫자로만 남는데, 나란히 돌리면
 * **어느 쪽이 무엇을 하느라 오래 걸리는지**가 그림이 된다.
 *
 * **무엇을 똑같이 나눠 주는가 — 「걸음」이 아니라 「작업량」이다.**
 * 기록된 장을 하나씩 똑같이 나눠 주면 비교가 공정하지 않다. 한 장의 무게가 다르기
 * 때문이다 — 설명만 바뀌는 장도 한 장을 먹는다. 실제로 연결 리스트는 링크를 거는
 * 장이 많아, 걸음으로 나누면 **일을 덜 한 쪽이 늦게 끝난다.**
 *
 * 그래서 축을 «작업량»으로 둔다 — **접근 + 이동 + 링크**를 더한 값이다.
 * 같은 만큼 일했을 때 어디까지 갔는지를 보므로 **먼저 끝난 쪽이 실제로 일을 덜 한 것**이
 * 정의상 참이 된다. 셋 가운데 하나라도 빼면 그 일이 공짜가 되어 축이 기운다.
 */

import {runDsOperation, dsArrayState, dsListState} from './ds-model.js';

/** 한 장에 든 일의 양. **화면의 세 숫자를 그대로 더한다** — 화면과 축이 어긋날 수 없게. */
export const dsWorkOf = (counts) => counts.access + counts.move + counts.link;

/** 아래 표에서 개수를 키워 가며 재는 자리. 화면의 칸 수(`DS_CAP`)와 무관하다 —
 *  재는 것은 그림이 아니라 **개수가 늘 때 값이 어떻게 벌어지는가**이기 때문이다. */
export const DS_MEASURE_SIZES = [4, 8, 16, 32, 64];

/**
 * 두 구조에 같은 연산을 물려 **작업량을 한 칸씩 나란히 넘길 수 있는 장**을 만든다.
 *
 * @param {object} op     비용 비교의 연산(`pair`에 배열용·리스트용이 들어 있다)
 * @param {object} states `{array, list}` — 앞 판이 끝난 상태 둘
 * @param {*}      arg    연산이 받는 값
 */
export function buildDsCompare(op, states, arg) {
    const runs = [
        {kind: 'array', name: '배열', out: runDsOperation(op.pair.array, states.array, arg)},
        {kind: 'list', name: '단일 연결 리스트', out: runDsOperation(op.pair.list, states.list, arg)},
    ].map((r) => {
        const work = r.out.frames.map((f) => dsWorkOf(f.counts));
        return {...r, work, total: work[work.length - 1] || 0};
    });

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
                /** 끝내는 데 든 일의 양. **이것이 곧 등수다.** */
                finishedWork: r.total,
            };
        });
        const finished = lanes.filter((l) => l.done).length;
        const winner = runs[0].total === runs[1].total ? null
            : (runs[0].total < runs[1].total ? runs[0] : runs[1]);
        frames.push({
            lanes,
            counts: {access: 0, move: 0, link: 0},
            say: finished === 0
                ? '두 구조에 **같은 연산**을 물렸습니다. 작업량(접근 + 이동 + 링크)을'
                  + ' 똑같이 나눠 주므로 **먼저 끝난 쪽이 일을 덜 한 것**입니다.'
                : (finished < 2
                    ? `${lanes.find((l) => l.done).name} 쪽이 먼저 끝났습니다.`
                        + ' 다른 쪽은 아직 일하고 있습니다.'
                    : (winner
                        ? `둘 다 끝났습니다. **${winner.name}** 쪽이 ${Math.abs(runs[0].total - runs[1].total)}만큼`
                          + ' 일을 덜 했습니다.'
                        : '둘 다 끝났습니다. **작업량이 같습니다.**')),
        });
    }

    return {frames, runs};
}

/**
 * **장을 남기지 않고 개수를 키워 가며 작업량만 잰다.**
 * 한 판을 넘겨서는 볼 수 없는 것 — 개수가 늘 때 두 구조의 값이 어떻게 벌어지는가 — 을 본다.
 *
 * @returns {{sizes:number[], rows:{op:object, array:number[], list:number[]}[]}}
 */
export function measureDsWork(ops, sizes = DS_MEASURE_SIZES) {
    const rows = ops.map((op) => {
        const array = [];
        const list = [];
        for (const n of sizes) {
            const values = Array.from({length: n}, (_, i) => ((i * 37) % 90) + 5);
            /* 칸을 하나 넉넉히 잡는다. **꽉 차서 못 넣는 판을 재면 「값이 싸다」가 되어**
               개수를 키운 뜻이 사라진다. */
            const arrState = dsArrayState(n + 1, values);
            const listState = dsListState(values, {doubly: false, hasTail: false});
            const arg = {v: 55, i: Math.floor(n / 2)};
            array.push(dsWorkOf(runDsOperation(op.pair.array, arrState, arg).counts));
            list.push(dsWorkOf(runDsOperation(op.pair.list, listState, arg).counts));
        }
        return {op, array, list};
    });
    return {sizes, rows};
}
