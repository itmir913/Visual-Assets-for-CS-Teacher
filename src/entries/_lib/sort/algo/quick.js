/* 퀵 정렬 — 맨 끝 값을 피벗으로 삼는 가장 흔한 꼴(로무토 분할). */

export const quickSortAlgo = {
    id: 'quick',
    name: '퀵 정렬',
    en: 'Quicksort',
    group: 'divide',
    view: 'array',
    motion: 'swap',
    idea: '**분할 정복**을 병합 정렬과 반대 차례로 씁니다. 구간에서 기준값(피벗) 하나를 고르고 '
        + '그보다 작은 것을 모두 왼쪽으로 몰아낸 뒤, 그 좌우를 같은 방법으로 다시 나눕니다. '
        + '나눌 때 이미 정리가 되므로 합치는 단계가 따로 없습니다.',
    complexity: {best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n²)', space: 'O(log n)'},
    stable: false,
    inPlace: true,
    /** **피벗을 어떻게 고르느냐가 최악을 만든다.** 이 조건을 빼고 「퀵 정렬은 빠르다」로
     *  적어 두면, 역순 자료를 넣어 본 학생이 곧바로 모순에 부딪힌다. */
    watch: '여기서는 구간의 맨 끝 값을 피벗으로 삼습니다. 그래서 이미 정렬된 자료나 '
        + '역순 자료를 넣으면 한쪽이 텅 비어 O(n²)로 무너집니다 — '
        + '「역순」 자료로 비교 횟수를 보고 무작위와 대 보세요. '
        + '실제 라이브러리가 가운데 값이나 세 값의 중앙값을 피벗으로 고르는 것이 이 때문입니다.',

    run(rec) {
        const qsort = (lo, hi, depth) => {
            if (lo > hi) return;
            if (lo === hi) {
                rec.fix(lo);
                rec.say('혼자 남은 칸은 더 나눌 것이 없습니다.');
                rec.mark('leaf');
                return;
            }

            rec.setRanges([{lo, hi, depth, state: 'active'}]);
            rec.pivotAt(hi);
            rec.say(`${lo}~${hi} 구간 — 맨 끝 값을 피벗으로 삼고, 이보다 작은 것을 왼쪽으로 몰아냅니다.`);
            rec.mark('pivot');

            /* `wall`은 «여기까지는 피벗보다 작다»는 경계다. 작은 값을 만날 때마다
               경계 자리와 교환하고 경계를 한 칸 옮긴다. */
            let wall = lo;
            rec.cursor('경계', wall);
            for (let j = lo; j < hi; j++) {
                rec.cursor('j', j);
                if (rec.cmp(j, hi) < 0) {
                    rec.swap(wall, j);
                    wall++;
                    rec.cursor('경계', wall);
                }
            }

            rec.cursor('j', null);
            rec.say('마지막으로 피벗을 경계 자리로 데려옵니다. 이제 피벗은 제자리입니다.');
            rec.swap(wall, hi);
            rec.pivotAt(null);
            rec.cursor('경계', null);
            rec.fix(wall);
            rec.say(`피벗이 ${wall}번 자리에 확정되었습니다. 왼쪽은 모두 작고 오른쪽은 모두 큽니다.`);
            rec.mark('fix');

            qsort(lo, wall - 1, depth + 1);
            qsort(wall + 1, hi, depth + 1);
        };

        qsort(0, rec.n - 1, 0);
        rec.setRanges([]);
        rec.clearCursors();
        rec.fixRange(0, rec.n - 1);
        rec.say('모든 구간에서 피벗이 제자리를 찾았습니다.');
        rec.mark('done');
    },
};
