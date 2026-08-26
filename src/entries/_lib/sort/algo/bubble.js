/* 버블 정렬. **알고리즘 파일은 import 가 없다** — 기록기를 인자로 받기 때문이다.
 * 그래서 검사 받침대가 이 파일을 가짜가 아닌 진짜로 돌려 본다. */

export const bubbleSortAlgo = {
    id: 'bubble',
    name: '버블 정렬',
    en: 'Bubble sort',
    group: 'simple',
    view: 'array',
    motion: 'swap',
    idea: '이웃한 둘을 비교해 큰 것을 뒤로 보냅니다. 한 바퀴 돌 때마다 맨 뒤 한 자리가 확정됩니다.',
    complexity: {best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)'},
    stable: true,
    inPlace: true,
    /** 「최선 O(n)」은 **한 바퀴 도는 동안 교환이 없으면 멈추는** 구현에서만 참이다.
     *  그 장치가 없는 구현은 이미 정렬된 자료에서도 끝까지 돈다. */
    watch: '한 바퀴 도는 동안 한 번도 교환하지 않았다면 이미 정렬된 것이라 거기서 멈춥니다. '
        + '이 멈춤 장치가 없는 구현도 많고, 그런 구현은 이미 정렬된 자료에서도 끝까지 돕니다.',

    run(rec) {
        const n = rec.n;
        let end = n - 1;

        for (let pass = 0; pass < n - 1; pass++) {
            let swapped = false;
            rec.say(`${pass + 1}바퀴째 — 앞에서부터 이웃한 둘을 비교해 큰 값을 뒤로 이동시킵니다.`);

            for (let i = 0; i < end; i++) {
                rec.cursor('i', i);
                if (rec.cmp(i, i + 1) > 0) {
                    rec.swap(i, i + 1);
                    swapped = true;
                }
            }

            rec.fix(end);
            rec.say(`가장 큰 값이 끝까지 이동했습니다. ${end + 1}번째 자리가 확정됩니다.`);
            rec.mark('fix');
            end--;

            if (!swapped) {
                rec.fixRange(0, end);
                rec.say('한 바퀴 도는 동안 한 번도 교환하지 않았습니다 — 이미 정렬되어 있으므로 멈춥니다.');
                rec.mark('early-exit');
                break;
            }
            if (end === 0) rec.fix(0);
        }
        rec.clearCursors();
    },
};
