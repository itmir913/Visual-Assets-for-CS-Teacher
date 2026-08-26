/* 병합 정렬.
 *
 * **임시 배열을 숨기지 않는다.** C 교과서에서 흔히 쓰는 꼴 그대로, 합칠 두 부분 배열을
 * 왼쪽·오른쪽 칸으로 따로 복사해 온 뒤 세 손가락으로 되돌려 쓴다. 그래야
 * 「제자리 정렬이 아니다」가 글이 아니라 **화면에 실제로 나타났다 사라지는 칸**이 된다.
 *
 * 구현이 이것 하나뿐인 것은 아니다 — 임시 배열을 하나만 쓰는 구현, 두 버퍼를 번갈아
 * 쓰는 구현이 다 있다. 그 사실은 화면 설명에 적어 둔다.
 */

import {withJosa} from '../../josa.js';

export const mergeSortAlgo = {
    id: 'merge',
    name: '병합 정렬',
    en: 'Merge sort',
    group: 'divide',
    view: 'array',
    motion: 'write',
    idea: '**분할 정복**의 대표적인 예입니다. 구간을 반씩 쪼개 더 쪼갤 수 없을 때까지 내려간 다음, '
        + '정렬된 두 부분 배열을 앞에서부터 하나씩 비교하며 합쳐 올라옵니다.',
    complexity: {best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(n)'},
    stable: true,
    inPlace: false,
    watch: '**자료가 어떻게 생겼든 차수가 같습니다** — 최선도 최악도 O(n log n)이라 '
        + '퀵 정렬처럼 자료 하나에 수십 배로 무너지는 일이 없습니다(자료를 바꿔 가며 비교해 보세요). '
        + '대신 배열만큼의 자리를 더 씁니다. '
        + '화면 아래에 나타나는 두 칸이 그 대가입니다. '
        + '값이 같으면 왼쪽 부분 배열을 먼저 가져오기 때문에 앞뒤 순서가 지켜집니다(안정 정렬).',

    run(rec) {
        const n = rec.n;

        const msort = (lo, hi, depth) => {
            if (lo >= hi) return;
            const mid = Math.floor((lo + hi) / 2);

            rec.setRanges([
                {lo, hi: mid, depth, state: 'active'},
                {lo: mid + 1, hi, depth, state: 'right'},
            ]);
            rec.say(`${lo}~${withJosa(hi, '을를')} 반으로 쪼갭니다.`);
            rec.mark('split');

            msort(lo, mid, depth + 1);
            msort(mid + 1, hi, depth + 1);

            /* ---- 합치기 ---- */
            rec.setRanges([
                {lo, hi: mid, depth, state: 'active'},
                {lo: mid + 1, hi, depth, state: 'right'},
            ]);
            rec.say('정렬된 두 부분 배열을 따로 복사해 옵니다. 이 칸이 병합 정렬이 더 쓰는 자리입니다.');
            // 이름을 짧게 둔다 — 부분 배열이 한 칸짜리일 때 이름표가 칸보다 길어진다.
            rec.auxOpen([{label: '왼쪽', base: lo}, {label: '오른쪽', base: mid + 1}]);
            rec.auxFill(0, lo, mid);
            rec.auxFill(1, mid + 1, hi);

            // **복사해 온 뒤 원래 구간을 비운다.** 여기에 처음부터 다시 채워 넣을 것이므로,
            // 옛 값이 남아 있으면 「어디까지 채웠는지」가 화면에서 구별되지 않는다.
            rec.vacate(lo, hi);
            rec.say('두 부분 배열의 맨 앞끼리 비교해 작은 쪽을 빈 구간에 차례로 씁니다.');

            let x = 0;
            let y = 0;
            let k = lo;
            while (x < rec.auxLen(0) && y < rec.auxLen(1)) {
                rec.cursor('쓸 자리', k);
                /* **같으면 왼쪽을 먼저 가져온다.** `<=`의 등호 하나가 안정 정렬인지
                   아닌지를 가른다 — `<`로 바꾸면 같은 값의 앞뒤가 뒤집힌다. */
                if (rec.auxCmp(0, x, 1, y) <= 0) rec.auxWriteBack(0, x++, k++);
                else rec.auxWriteBack(1, y++, k++);
            }
            while (x < rec.auxLen(0)) {
                rec.cursor('쓸 자리', k);
                rec.say('오른쪽 부분 배열이 먼저 비었습니다. 왼쪽에 남은 것은 그대로 옮깁니다.');
                rec.auxWriteBack(0, x++, k++);
            }
            while (y < rec.auxLen(1)) {
                rec.cursor('쓸 자리', k);
                rec.say('왼쪽 부분 배열이 먼저 비었습니다. 오른쪽에 남은 것은 그대로 옮깁니다.');
                rec.auxWriteBack(1, y++, k++);
            }

            rec.auxClose();
            rec.cursor('쓸 자리', null);
            rec.setRanges([{lo, hi, depth, state: 'merged'}]);
            rec.say(`${lo}~${withJosa(hi, '이가')} 정렬되었습니다.`);
            rec.mark('merged');
        };

        msort(0, n - 1, 0);
        rec.setRanges([]);
        rec.fixRange(0, n - 1);
        rec.say('맨 위 구간까지 합쳐졌습니다.');
        rec.mark('done');
    },
};
