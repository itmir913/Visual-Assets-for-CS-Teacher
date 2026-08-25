/* 계수 정렬.
 *
 * **이 알고리즘이 있어야 「정렬은 O(n log n)이 한계」라는 말이 조건부라는 것이 드러난다.**
 * 그 한계는 «원소끼리 비교해서» 정렬할 때의 이야기이고, 여기서는 한 번도 비교하지 않는다.
 *
 * 대신 대가가 있다. 값의 범위만큼 칸이 필요하다 — 그래서 여기서는 0~9만 다룬다.
 * 값이 커지면 칸이 그만큼 늘어난다는 것이 이 알고리즘의 성질이고,
 * 범위를 좁혀 둔 것 자체가 그 성질을 보여 주는 장치다.
 */

import {sortNum} from '../sort-josa.js';

export const countingSortAlgo = {
    id: 'counting',
    name: '계수 정렬',
    en: 'Counting sort',
    group: 'distribution',
    view: 'array',
    motion: 'write',
    /** 값의 범위. 자료를 만들 때도, 직접 넣은 값을 막을 때도 이 값을 쓴다. */
    valueMin: 0,
    valueMax: 9,
    needs: {nonNegative: true, maxValue: 9},
    idea: '원소끼리 비교하지 않습니다. 값마다 칸을 하나씩 두고 몇 번 나왔는지 센 다음, '
        + '칸을 작은 값부터 훑으며 센 개수만큼 배열에 다시 씁니다.',
    complexity: {best: 'O(n+k)', avg: 'O(n+k)', worst: 'O(n+k)', space: 'O(n+k)'},
    stable: true,
    inPlace: false,
    watch: '「비교」 횟수가 끝까지 0인 것을 보세요. 비교 정렬의 한계인 O(n log n)은 '
        + '**비교로 정렬할 때만** 걸리는 한계입니다. 대신 k(값의 범위)만큼 칸이 필요해서 '
        + '여기서는 0~9만 다룹니다 — 값이 0~1000000이면 칸도 그만큼 만들어야 합니다. '
        + '한 가지 더: 값만 세어 다시 쓰는 이 방식은 원소에 «딸린 정보»가 있으면 잃어버립니다. '
        + '그래서 실제 구현은 누적 합을 구해 출력 배열에 옮겨 담는 판을 씁니다.',

    run(rec) {
        const n = rec.n;

        /* **칸의 수는 자료가 정한다.** `valueMax`는 「이 화면에서 보여 줄 범위」를 정할 뿐,
           알고리즘 자체는 주어진 값이 닿는 데까지 칸을 만든다 —
           그래야 비교 탭처럼 범위가 넓은 자료를 받아도 그대로 돌아간다. */
        let maxValue = 0;
        for (let i = 0; i < n; i++) maxValue = Math.max(maxValue, rec.peek(i));
        const keys = [];
        for (let v = 0; v <= maxValue; v++) keys.push(v);

        rec.say(`값이 0~${sortNum(maxValue, '이라')} 칸을 ${keys.length}개 만듭니다.`
            + ' **칸의 수는 원소 수가 아니라 값의 범위가 정합니다.**');
        rec.stripOpen('세는 칸', 'count', keys);

        rec.say('배열을 한 번 훑으며 각 값이 몇 번 나왔는지 셉니다. 원소끼리 비교하지 않습니다.');
        for (let i = 0; i < n; i++) {
            rec.cursor('i', i);
            rec.stripCount(i);
        }
        rec.cursor('i', null);

        rec.say('다 셌습니다. 이제 배열을 비우고, 칸을 작은 값부터 훑으며 센 개수만큼 다시 씁니다.');
        rec.vacate(0, n - 1);

        let out = 0;
        for (const v of keys) {
            const have = rec.stripCell(v).count;
            rec.stripFocus(v);
            if (!have) {
                rec.say(`값 ${sortNum(v, '은는')} 한 번도 나오지 않았습니다. 건너뜁니다.`);
                rec.mark('skip');
                continue;
            }
            rec.say(`값 ${sortNum(v, '이가')} ${have}개 있습니다. 넣은 차례 그대로 꺼내 씁니다.`);
            while (rec.stripCell(v).count > 0) {
                rec.cursor('쓸 자리', out);
                rec.stripTake(v, out);
                rec.fix(out);
                out++;
            }
        }

        rec.stripClose();
        rec.clearCursors();
        rec.fixRange(0, n - 1);
        rec.say('한 번도 원소끼리 비교하지 않고 정렬이 끝났습니다.');
        rec.mark('done');
    },
};
