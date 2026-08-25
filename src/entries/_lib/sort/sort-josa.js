/* 숫자 뒤에 붙는 조사를 골라 준다.
 *
 * 설명글에 숫자를 끼워 넣으면 **조사가 숫자에 따라 달라진다.** 「0~7를」이 아니라
 * 「0~7을」이고, 「값 0는」이 아니라 「값 0은」이다. 글을 쓸 때는 안 보이고
 * 화면에 숫자가 들어간 뒤에야 드러나는 자리라, 손으로 맞추면 반드시 어긋난다.
 *
 * 판정은 **마지막 자리 숫자의 한국어 읽기**로 한다.
 *   0 영(ㅇ) · 1 일(ㄹ) · 2 이 · 3 삼(ㅁ) · 4 사 · 5 오 · 6 육(ㄱ) · 7 칠(ㄹ) · 8 팔(ㄹ) · 9 구
 */

/** 받침이 있는가. 없으면 「는·가·를·와·로」, 있으면 「은·이·을·과·으로」. */
const HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

function numberHasFinal(n) {
    return HAS_FINAL[Math.abs(Math.trunc(n)) % 10];
}

/** ㄹ 받침은 「으로」가 아니라 「로」를 쓴다. 1·7·8이 그렇다. */
const RIEUL = new Set([1, 7, 8]);

/**
 * @param {number} n    숫자
 * @param {string} kind `'은는'` · `'이가'` · `'을를'` · `'과와'` · `'으로'` · `'이라'`
 */
export function sortJosa(n, kind) {
    const final = numberHasFinal(n);
    switch (kind) {
        case '은는': return final ? '은' : '는';
        case '이가': return final ? '이' : '가';
        case '을를': return final ? '을' : '를';
        case '과와': return final ? '과' : '와';
        case '으로': return final && !RIEUL.has(Math.abs(Math.trunc(n)) % 10) ? '으로' : '로';
        case '이라': return final ? '이라' : '라';
        default: return '';
    }
}

/** 「7을」처럼 숫자와 조사를 붙여 준다. */
export function sortNum(n, kind) {
    return `${n}${sortJosa(n, kind)}`;
}
