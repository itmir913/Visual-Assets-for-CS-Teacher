/* 버킷 정렬.
 *
 * 계수 정렬은 값 하나마다 칸이 하나였고, 기수 정렬은 자릿수마다 칸이 열 개였다.
 * 버킷 정렬은 **값의 «구간»마다 칸을 하나** 둔다 — 그래서 칸의 수를 마음대로 정할 수 있다.
 *
 * **다만 칸 안은 여전히 비교해서 정렬해야 한다.** 그래서 셋 가운데 이것만 비교 횟수가
 * 0이 아니다. 칸마다 몇 개씩만 들어가면 그 비교는 얼마 되지 않지만, 한 칸에 몰리면
 * 그 안이 곧 삽입 정렬이 되어 최악 O(n²)로 간다.
 *
 * **어느 자료가 최악인지는 측정해 보고 적었다.** 처음에는 「값이 몇 종류뿐」이 최악이라고
 * 적었는데 정반대였다 — 한 칸 안의 값이 전부 같아 첫 비교에서 멈추므로 넷 가운데 가장 적다.
 * 실제로 나빠지는 것은 「역순」이다. 칸마다 그 안이 거꾸로 놓여 삽입 정렬의 최악이 된다.
 * **짐작으로 적었으면 그대로 틀린 채 나갈 뻔했다.** 지금 값은 `npm run check:sort`가 찍는다.
 */

export const bucketSortAlgo = {
    id: 'bucket',
    name: '버킷 정렬',
    en: 'Bucket sort',
    group: 'distribution',
    view: 'array',
    motion: 'write',
    needs: {nonNegative: true},
    idea: '값의 구간마다 칸을 하나씩 두고 원소를 자기 구간의 칸에 던져 넣습니다. '
        + '칸 안은 삽입 정렬로 정리한 뒤, 칸을 작은 구간부터 이어 붙입니다.',
    complexity: {best: 'O(n+k)', avg: 'O(n+k)', worst: 'O(n²)', space: 'O(n+k)'},
    stable: true,
    inPlace: false,
    watch: '분배 정렬 셋 가운데 **이것만 비교 횟수가 0이 아닙니다** — 칸 «안»은 비교해서 '
        + '정렬하기 때문입니다. 자료를 「역순」으로 바꿔 보세요. 칸마다 그 안이 거꾸로 놓여 '
        + '삽입 정렬의 최악이 되므로 비교가 무작위의 두 배 가까이로 늘어납니다. '
        + '그래도 삽입 정렬 하나로 돌릴 때보다는 한참 적습니다 — 나눠 놓은 만큼 이득입니다. '
        + '「값이 몇 종류뿐」은 짐작과 달리 비교가 **가장 적습니다.** '
        + '한 칸 안의 값이 전부 같아 첫 비교에서 멈추기 때문입니다.',

    run(rec) {
        const n = rec.n;

        let lo = Infinity;
        let hi = -Infinity;
        for (let i = 0; i < n; i++) {
            const v = rec.peek(i);
            lo = Math.min(lo, v);
            hi = Math.max(hi, v);
        }
        const span = hi - lo + 1;
        const k = Math.min(10, n);
        const keys = [];
        for (let b = 0; b < k; b++) {
            const from = lo + Math.floor((span * b) / k);
            const to = lo + Math.ceil((span * (b + 1)) / k) - 1;
            keys.push(from === to ? `${from}` : `${from}~${to}`);
        }
        const bucketOf = (v) => Math.min(k - 1, Math.floor(((v - lo) * k) / span));

        rec.say(`값이 ${lo}~${hi}입니다. 이 범위를 ${k}개 구간으로 갈라 칸을 하나씩 둡니다.`);
        rec.stripOpen('값 구간 칸', 'bucket', keys);

        rec.say('원소를 자기 구간의 칸에 던져 넣습니다. **여기까지는 비교가 없습니다.**');
        for (let i = 0; i < n; i++) {
            rec.cursor('i', i);
            rec.stripPut(keys[bucketOf(rec.peek(i))], i);
        }
        rec.cursor('i', null);

        rec.say('이제 칸 안을 정리합니다. **칸 «안»은 비교해서 정렬해야 합니다** — 삽입 정렬입니다. '
            + '한 칸에 몰릴수록 여기서 드는 비용이 커집니다.');
        rec.mark('sort-buckets');
        for (const key of keys) {
            const cell = rec.stripCell(key);
            if (cell.items.length <= 1) continue;
            rec.stripFocus(key);
            rec.say(`${key} 칸에 ${cell.items.length}개가 들어 있습니다. 이 안을 삽입 정렬로 정리합니다.`);
            rec.mark('bucket-start');

            for (let i = 1; i < cell.items.length; i++) {
                let j = i;
                /* 앞쪽을 뒤에서부터 보다가 자기보다 작거나 같은 것을 만나면 멈춘다.
                   **같으면 멈추는 것**이 안정 정렬을 만든다. */
                while (j > 0 && rec.stripCmpIn(key, j - 1, i) > 0) j--;
                if (j < i) rec.stripMoveIn(key, i, j);
            }
        }

        rec.say('칸을 작은 구간부터 이어 붙입니다.');
        rec.vacate(0, n - 1);
        let out = 0;
        for (const key of keys) {
            while (rec.stripCell(key).count > 0) {
                rec.cursor('쓸 자리', out);
                rec.stripTake(key, out);
                rec.fix(out);
                out++;
            }
        }

        rec.stripClose();
        rec.clearCursors();
        rec.fixRange(0, n - 1);
        rec.say('칸을 다 이어 붙였습니다. 비교는 칸 안에서만 일어났습니다.');
        rec.mark('done');
    },
};
