/* 삽입 정렬.
 *
 * **교환이 아니라 이동이다.** 이웃끼리 자리를 바꾸는 것으로 그리면 그림이 틀리고,
 * 「거의 정렬된 자료에서 왜 빠른가」도 보이지 않는다 — 이동시킬 것이 없으면 그냥 지나가는
 * 것이 요점인데, 교환으로 그리면 그 「지나감」이 화면에 남지 않는다.
 */

export const insertionSortAlgo = {
    id: 'insertion',
    name: '삽입 정렬',
    en: 'Insertion sort',
    group: 'simple',
    view: 'array',
    motion: 'shift',
    idea: '값을 하나 임시 변수에 저장한 뒤, 앞쪽의 이미 정렬된 부분을 뒤에서부터 훑으며 '
        + '큰 것들을 한 칸씩 뒤로 이동시키고 생긴 빈자리에 내려놓습니다.',
    complexity: {best: 'O(n)', avg: 'O(n²)', worst: 'O(n²)', space: 'O(1)'},
    stable: true,
    inPlace: true,
    watch: '임시 저장한 값보다 작은 것을 만나면 거기서 멈춥니다. 거의 정렬된 자료에서는 '
        + '거의 곧바로 멈추므로 이동시킬 것이 없어 아주 빠릅니다 — '
        + '「거의 정렬됨」 자료로 비교 횟수를 보세요.',

    run(rec) {
        const n = rec.n;
        /* **「확정」으로 찍지 않는다.** 앞쪽이 «자기들끼리» 정렬되어 있을 뿐,
           나중에 더 작은 값이 들어오면 통째로 밀린다 — 열한 가지 알고리즘 가운데 삽입 정렬만
           그렇다. 확정 색을 쓰면 같은 초록이 「최종 자리」와 「지금까지 정렬된 부분」
           두 뜻이 되어, 학생이 초록을 믿을 수 없게 된다. 구간 띠로 표시한다. */
        rec.setRanges([{lo: 0, hi: 0, depth: 0, state: 'merged'}]);
        rec.say('첫 값 하나는 그것만으로 이미 정렬된 부분입니다. '
            + '띠는 「여기까지는 자기들끼리 정렬되어 있다」는 뜻이지 자리가 확정되었다는 뜻이 아닙니다.');
        rec.mark('init');

        for (let i = 1; i < n; i++) {
            rec.cursor('i', i);
            rec.say('다음 값을 임시 변수에 저장합니다. 그 자리가 빈칸이 됩니다.');
            rec.hold(i);

            let j = i - 1;
            rec.say('앞쪽을 뒤에서부터 봅니다. 임시 저장한 값보다 크면 한 칸 뒤로 이동시킵니다.');
            while (j >= 0 && rec.cmpHeld(j) > 0) {
                rec.cursor('j', j);
                rec.shift(j, j + 1);
                j--;
            }

            rec.cursor('j', null);
            rec.say(j < 0
                ? '앞쪽 전부가 더 컸습니다. 맨 앞 빈자리에 내려놓습니다.'
                : '더 작은 값을 만났습니다. 그 바로 뒤 빈자리에 내려놓습니다.');
            rec.drop(j + 1);
            rec.setRanges([{lo: 0, hi: i, depth: 0, state: 'merged'}]);
            rec.mark('grow');
        }

        rec.clearCursors();
        rec.setRanges([]);
        rec.fixRange(0, n - 1);
        rec.say('마지막 값까지 끼워 넣었습니다. 이제 모든 자리가 확정됩니다.');
        rec.mark('done');
    },
};
