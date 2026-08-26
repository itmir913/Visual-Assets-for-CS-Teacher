/* 기수 정렬 — 낮은 자릿수부터(LSD).
 *
 * 계수 정렬의 약점은 값이 커지면 칸이 그만큼 늘어난다는 것이다. 기수 정렬은
 * **한 번에 한 자릿수씩** 보아 칸을 언제나 열 개로 묶는다. 대신 자릿수만큼 판을 돈다.
 *
 * **꺼낼 때 넣은 차례를 지키는 것이 이 알고리즘의 전부다.** 그 차례가 흐트러지면
 * 앞선 자릿수에서 해 놓은 정렬이 무너져 결과가 아예 틀린다 — 안정 정렬이 «있으면 좋은
 * 성질»이 아니라 «없으면 안 되는 조건»인 드문 자리다.
 */

import {withJosa} from '../../josa.js';

export const radixSortAlgo = {
    id: 'radix',
    name: '기수 정렬',
    en: 'Radix sort (LSD)',
    group: 'distribution',
    view: 'array',
    motion: 'write',
    valueMin: 0,
    needs: {nonNegative: true},
    idea: '값을 한 자릿수씩 봅니다. 일의 자리로 열 개 칸에 나눠 담았다가 차례로 꺼내고, '
        + '십의 자리로 다시 나눠 담았다가 꺼냅니다. 가장 높은 자리까지 끝나면 정렬이 끝납니다.',
    complexity: {best: 'O(d(n+10))', avg: 'O(d(n+10))', worst: 'O(d(n+10))', space: 'O(n)'},
    stable: true,
    inPlace: false,
    watch: '칸에서 꺼낼 때 **넣은 차례를 그대로** 지키는지 보세요. '
        + '그 차례가 흐트러지면 앞 자릿수에서 해 놓은 정렬이 무너져 결과가 틀립니다 — '
        + '기수 정렬에서 안정성은 있으면 좋은 성질이 아니라 없으면 안 되는 조건입니다. '
        + 'd는 자릿수입니다. 계수 정렬과 달리 칸은 늘 열 개뿐이지만, 자릿수만큼 판을 돕니다.',

    run(rec) {
        const n = rec.n;
        const keys = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

        let maxValue = 0;
        for (let i = 0; i < n; i++) maxValue = Math.max(maxValue, rec.peek(i));
        const digits = Math.max(1, String(maxValue).length);
        const NAMES = ['일', '십', '백', '천'];

        rec.say(`가장 큰 값이 ${withJosa(maxValue, '이라')} 자릿수는 ${digits}자리입니다. 낮은 자리부터 ${digits}번 돕니다.`);
        rec.mark('plan');

        for (let d = 0; d < digits; d++) {
            const place = Math.pow(10, d);
            const name = NAMES[d] || `${place}`;

            rec.say(`${name}의 자리를 봅니다. **칸은 언제나 0~9 열 개뿐입니다.**`);
            rec.stripOpen(`${name}의 자리`, 'bucket', keys);

            for (let i = 0; i < n; i++) {
                rec.cursor('i', i);
                const digit = Math.floor(rec.peek(i) / place) % 10;
                rec.stripPut(digit, i);
            }
            rec.cursor('i', null);

            rec.say('0번 칸부터 차례로, **넣은 차례 그대로** 꺼내 다시 씁니다.');
            let out = 0;
            for (const k of keys) {
                while (rec.stripCell(k).count > 0) {
                    rec.cursor('쓸 자리', out);
                    rec.stripTake(k, out);
                    out++;
                }
            }

            rec.stripClose();
            rec.cursor('쓸 자리', null);
            rec.say(d === digits - 1
                ? '가장 높은 자리까지 끝났습니다.'
                : `${name}의 자리까지는 정렬되었습니다. 다음 자리로 넘어갑니다.`);
            rec.mark('pass-done');
        }

        rec.clearCursors();
        rec.fixRange(0, n - 1);
        rec.say('자릿수를 다 돌았습니다. 여기서도 원소끼리 비교한 적이 없습니다.');
        rec.mark('done');
    },
};
