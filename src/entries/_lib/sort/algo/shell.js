/* 셸 정렬 — 삽입 정렬을 «멀리 떨어진 것끼리» 먼저 시킨다. */

export const shellSortAlgo = {
    id: 'shell',
    name: '셸 정렬',
    en: 'Shell sort',
    group: 'divide',
    view: 'array',
    motion: 'shift',
    idea: '멀리 떨어진 자리끼리 먼저 삽입 정렬을 하고, 그 간격을 반씩 줄여 갑니다. '
        + '마지막 간격이 1이 되면 평범한 삽입 정렬인데, 그때는 이미 거의 정렬되어 있습니다.',
    complexity: {best: 'O(n log n)', avg: 'O(n^1.5) 안팎', worst: 'O(n²)', space: 'O(1)'},
    stable: false,
    inPlace: true,
    /** **간격을 어떻게 고르느냐가 곧 이 알고리즘의 성능이다.** 여기서 쓰는 「반씩 줄이기」는
     *  가장 쉬운 방식이고 최악이 O(n²)이다. 이 조건을 빼고 말하면 뒤에서 배신당한다. */
    watch: '삽입 정렬의 약점은 작은 값이 멀리 뒤에 있을 때 한 칸씩밖에 못 온다는 것입니다. '
        + '간격을 크게 두면 그런 값이 단번에 앞으로 옵니다. '
        + '여기서는 간격을 절반씩 줄이는 가장 쉬운 방식을 씁니다 — '
        + '간격을 어떻게 고르느냐에 따라 성능이 달라지고, 이 방식의 최악은 O(n²)입니다.',

    run(rec) {
        const n = rec.n;

        for (let gap = Math.floor(n / 2); gap >= 1; gap = Math.floor(gap / 2)) {
            rec.say(gap === 1
                ? '간격이 1이 되었습니다. 이제 평범한 삽입 정렬인데, 앞선 단계들 덕분에 밀 것이 거의 없습니다.'
                : `간격 ${gap} — ${gap}칸씩 떨어진 자리끼리만 모아 삽입 정렬을 합니다.`);
            rec.mark('gap');

            for (let i = gap; i < n; i++) {
                rec.cursor('i', i);
                /* **지금 보고 있는 「띄엄띄엄한 줄」을 띠로 보여 준다.** 간격이 크면
                   화면에서 서로 떨어진 칸들이 한 묶음이라는 것이 달리 드러나지 않는다. */
                const band = [];
                for (let k = i % gap; k <= i; k += gap) band.push({lo: k, hi: k, depth: 0});
                rec.setRanges(band);

                rec.hold(i);
                let j = i - gap;
                while (j >= 0 && rec.cmpHeld(j) > 0) {
                    rec.shift(j, j + gap);
                    j -= gap;
                }
                rec.drop(j + gap);
            }
        }

        rec.setRanges([]);
        rec.clearCursors();
        rec.fixRange(0, n - 1);
        rec.say('마지막 간격 1까지 끝났습니다.');
        rec.mark('done');
    },
};
