/* 칵테일 셰이커 정렬 — 버블 정렬을 양방향으로 돌린다. */

export const cocktailSortAlgo = {
    id: 'cocktail',
    name: '칵테일 정렬',
    en: 'Cocktail shaker sort',
    group: 'simple',
    view: 'array',
    motion: 'swap',
    idea: '버블 정렬을 한 방향이 아니라 앞뒤로 번갈아 돌립니다. '
        + '오른쪽 끝으로 밀고 나면 방향을 돌려 왼쪽 끝으로 끌어옵니다.',
    complexity: {best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)'},
    stable: true,
    inPlace: true,
    /** 버블 정렬이 느려지는 대표적인 자료를 짚어 준다. 이름이 붙어 있을 만큼 잘 알려진 자리다. */
    watch: '맨 뒤에 있는 아주 작은 값은 버블 정렬에서 한 바퀴에 한 칸씩밖에 못 옵니다. '
        + '방향을 번갈아 주면 그런 값이 한 바퀴 만에 앞으로 끌려옵니다. '
        + '다만 비교 횟수의 차수는 그대로 O(n²)입니다 — 상수만 줄어듭니다.',

    run(rec) {
        let lo = 0;
        let hi = rec.n - 1;

        while (lo < hi) {
            let swapped = false;

            rec.say('오른쪽으로 — 큰 값을 뒤로 이동시킵니다.');
            for (let i = lo; i < hi; i++) {
                rec.cursor('i', i);
                if (rec.cmp(i, i + 1) > 0) { rec.swap(i, i + 1); swapped = true; }
            }
            rec.fix(hi);
            rec.say(`가장 큰 값이 ${hi + 1}번째 자리에 놓였습니다.`);
            rec.mark('fix');
            hi--;

            if (!swapped) break;
            if (lo >= hi) break;
            swapped = false;

            rec.say('왼쪽으로 — 이번에는 작은 값을 앞으로 끌어옵니다.');
            for (let i = hi; i > lo; i--) {
                rec.cursor('i', i);
                if (rec.cmp(i - 1, i) > 0) { rec.swap(i - 1, i); swapped = true; }
            }
            rec.fix(lo);
            rec.say(`가장 작은 값이 ${lo + 1}번째 자리에 놓였습니다.`);
            rec.mark('fix');
            lo++;

            if (!swapped) break;
        }

        rec.fixRange(0, rec.n - 1);
        rec.say('남은 구간에서 더 교환할 것이 없습니다.');
        rec.clearCursors();
        rec.mark('done');
    },
};
