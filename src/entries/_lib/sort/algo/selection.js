/* 선택 정렬. */

export const selectionSortAlgo = {
    id: 'selection',
    name: '선택 정렬',
    en: 'Selection sort',
    group: 'simple',
    view: 'array',
    motion: 'swap',
    idea: '남은 구간에서 가장 작은 값을 찾아 맨 앞자리와 교환합니다. '
        + '한 바퀴에 교환은 딱 한 번뿐입니다.',
    complexity: {best: 'O(n²)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)'},
    stable: false,
    inPlace: true,
    /** 안정하지 않은 까닭을 **이유까지** 적는다. 「불안정」이라는 딱지만으로는 외울 거리가 된다. */
    watch: '이미 정렬된 자료를 넣어도 비교 횟수가 줄지 않습니다 — 가장 작은 값을 찾으려면 '
        + '남은 것을 끝까지 다 봐야 하기 때문입니다. 대신 옮기는 횟수는 n번을 넘지 않아, '
        + '값 하나를 옮기는 비용이 아주 클 때는 이쪽이 유리합니다. '
        + '멀리 있는 둘을 교환하므로 같은 값의 앞뒤가 뒤집힐 수 있습니다(안정 정렬이 아닙니다).',

    run(rec) {
        const n = rec.n;

        for (let i = 0; i < n - 1; i++) {
            let min = i;
            rec.cursor('i', i);
            rec.cursor('최솟값', min);
            rec.say(`${i + 1}번째 자리에 올 값을 남은 구간에서 찾습니다.`);
            rec.mark('scan-start');

            for (let j = i + 1; j < n; j++) {
                rec.cursor('j', j);
                if (rec.cmp(j, min) < 0) {
                    min = j;
                    rec.cursor('최솟값', min);
                    rec.say('더 작은 값을 찾았습니다. 여기를 기억해 둡니다.');
                    rec.mark('new-min');
                }
            }

            rec.cursor('j', null);
            if (min === i) {
                rec.say('찾은 값이 이미 제자리에 있습니다. 교환할 것이 없습니다.');
                rec.mark('no-swap');
            } else {
                rec.say('찾은 가장 작은 값을 맨 앞자리와 교환합니다.');
                rec.swap(i, min);
            }
            rec.fix(i);
            rec.mark('fix');
        }

        rec.fix(n - 1);
        rec.clearCursors();
        rec.say('마지막 하나는 비교할 상대가 없으므로 그대로 확정됩니다.');
        rec.mark('done');
    },
};
