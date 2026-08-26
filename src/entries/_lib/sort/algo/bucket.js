/* 버킷 정렬.
 *
 * 계수 정렬은 값 하나마다 칸이 하나였고, 기수 정렬은 자릿수마다 칸이 열 개였다.
 * 버킷 정렬은 **값의 «구간»마다 칸을 하나** 둔다 — 그래서 칸의 수를 마음대로 정할 수 있다.
 *
 * **다만 칸 안은 여전히 비교해서 정렬해야 한다.** 그래서 셋 가운데 이것만 비교 횟수가
 * 0이 아니다. 칸마다 몇 개씩만 들어가면 그 비교는 얼마 되지 않지만, 한 칸에 몰리면
 * 그 안이 곧 삽입 정렬이 되어 최악 O(n²)로 간다.
 *
 * **어느 자료가 최악인지 두 번 틀렸다.** 처음에는 「값이 몇 종류뿐」이 최악이라고 적었고,
 * 고친 뒤에는 「역순이면 무작위의 두 배」라고 적었다. 둘 다 **큰 n에서만** 맞는 말이다.
 * 기본 크기(n=8)에서는 역순의 비교가 «0»이다 — 값이 고르게 퍼져 칸마다 하나씩 들어가
 * 비교할 상대가 없기 때문이다. 비율이 1을 넘는 것은 n이 수십은 되어야 한다.
 *
 * **크기에 따라 뒤집히는 주장은 크기를 밝히지 않으면 거짓이 된다.** 그래서 화면 글에서는
 * 「자료를 바꿔 가며 직접 비교하라」고만 하고 배수는 적지 않는다.
 * 지금 값은 `npm run check:sort`가 찍는다.
 */

export const bucketSortAlgo = {
    id: 'bucket',
    name: '버킷 정렬',
    en: 'Bucket sort',
    group: 'distribution',
    view: 'array',
    motion: 'write',
    /* **음수를 막지 않는다.** 버킷 정렬은 값을 칸의 «자리»로 쓰지 않고
       최솟값~최댓값을 k구간으로 가르므로 음수가 섞여도 그대로 돈다.
       막는 것은 값을 자리로 쓰는 계수·기수뿐이다. */
    idea: '값의 구간마다 칸을 하나씩 두고 원소를 자기 구간의 칸에 던져 넣습니다. '
        + '칸 안은 삽입 정렬로 정리한 뒤, 칸을 작은 구간부터 이어 붙입니다.',
    complexity: {best: 'O(n+k)', avg: 'O(n+k)', worst: 'O(n²)', space: 'O(n+k)'},
    stable: true,
    inPlace: false,
    watch: '분배 정렬 셋 가운데 **이것만 비교 횟수가 0이 아닙니다** — 칸 «안»은 비교해서 '
        + '정렬하기 때문입니다. 그 비용은 **한 칸에 얼마나 몰리는가**로 정해집니다. '
        + '자료 넷을 번갈아 넣고 비교 횟수를 비교해 보세요. 개수도 함께 키워 보면 '
        + '**크기에 따라 순서가 뒤집히는 것**을 볼 수 있습니다 — '
        + '원소가 몇 개뿐일 때는 칸마다 하나씩 들어가 비교가 아예 없기도 합니다. '
        + '어느 자료가 나쁜지 외우지 말고, 눈앞의 숫자로 확인하세요.',

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
        /* **칸 수는 값의 가짓수를 넘지 않는다.** 값이 셋뿐인데 칸을 열 개 만들면
           끝까지 비어 있는 칸이 일곱 개 남고, 칸 이름도 서로 겹친다. */
        const k = Math.max(1, Math.min(10, n, span));
        const keys = [];
        for (let b = 0; b < k; b++) {
            /* **`bucketOf`와 같은 경계를 써야 한다.** 아래끝을 내림으로 잡았더니
               `11~20 · 20~30`처럼 경계값이 두 칸에 적혀, 20이 어느 칸인지 화면만 보고는
               알 수 없었다. 실제로 가는 곳은 앞 칸이다. */
            const from = lo + Math.ceil((span * b) / k);
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
