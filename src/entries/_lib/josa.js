/* 앞말에 따라 달라지는 조사를 골라 준다.
 *
 * 설명글에 값을 끼워 넣으면 **조사가 그 값에 따라 달라진다.** 「0~7를」이 아니라
 * 「0~7을」이고, 「값 0는」이 아니라 「값 0은」이다. 글을 쓸 때는 안 보이고
 * 화면에 값이 들어간 뒤에야 드러나는 자리라, 손으로 맞추면 반드시 어긋난다.
 *
 * **숫자와 낱말을 한 함수가 받는다.** 예전에는 숫자만 다루었는데, 그러다
 * 「해시 테이블**이(가)**」가 화면에 그대로 찍혔다 — 낱말을 끼워 넣을 자리에서는
 * 쓸 것이 없어 손으로 「이(가)」라고 적어 두게 되기 때문이다.
 * **받을 수 있는 것을 하나로 두면 그 자리에서 손으로 적을 까닭이 없어진다.**
 *
 * 숫자 판정은 **마지막 자리 숫자의 한국어 읽기**로 한다.
 *   0 영(ㅇ) · 1 일(ㄹ) · 2 이 · 3 삼(ㅁ) · 4 사 · 5 오 · 6 육(ㄱ) · 7 칠(ㄹ) · 8 팔(ㄹ) · 9 구
 * 낱말 판정은 **마지막 글자의 받침**으로 한다. 한글 음절은 `0xAC00`부터 28칸씩
 * 묶여 있어 `(코드 - 0xAC00) % 28`이 0이면 받침이 없다.
 */

/** 숫자에 받침이 있는가. 없으면 「는·가·를·와·로」, 있으면 「은·이·을·과·으로」. */
const DIGIT_HAS_FINAL = [true, true, false, true, false, false, true, true, true, false];

/** ㄹ 받침은 「으로」가 아니라 「로」를 쓴다. 숫자는 1·7·8이 그렇다. */
const DIGIT_RIEUL = new Set([1, 7, 8]);

const HANGUL_FIRST = 0xac00;
const HANGUL_LAST = 0xd7a3;
/** 받침이 ㄹ인 음절의 종성 번호. 「서울로」처럼 「으로」가 아니라 「로」가 붙는다. */
const FINAL_RIEUL = 8;

/** 앞말의 끝을 본다. @returns {{final: boolean, rieul: boolean}|null} 알 수 없으면 `null` */
function tailOf(text) {
    const s = String(text).trim();
    if (!s) return null;

    const last = s[s.length - 1];
    const code = last.charCodeAt(0);

    if (code >= HANGUL_FIRST && code <= HANGUL_LAST) {
        const fin = (code - HANGUL_FIRST) % 28;
        return {final: fin !== 0, rieul: fin === FINAL_RIEUL};
    }
    if (last >= '0' && last <= '9') {
        const d = Number(last);
        return {final: DIGIT_HAS_FINAL[d], rieul: DIGIT_RIEUL.has(d)};
    }
    /* 한글도 숫자도 아니면 **아무 조사도 내지 않는다.** 찍어 맞히면 영어 낱말이나
       기호 뒤에 엉뚱한 조사가 붙는데, 없는 편이 틀린 것보다 낫다. */
    return null;
}

/**
 * @param {string|number} text 조사가 붙을 앞말
 * @param {string} kind `'은는'` · `'이가'` · `'을를'` · `'과와'` · `'으로'` · `'이라'`
 */
export function josa(text, kind) {
    const t = tailOf(text);
    if (!t) return '';
    switch (kind) {
        case '은는': return t.final ? '은' : '는';
        case '이가': return t.final ? '이' : '가';
        case '을를': return t.final ? '을' : '를';
        case '과와': return t.final ? '과' : '와';
        case '으로': return t.final && !t.rieul ? '으로' : '로';
        case '이라': return t.final ? '이라' : '라';
        default: return '';
    }
}

/** 「7을」·「해시 테이블이」처럼 앞말과 조사를 붙여 준다. */
export function withJosa(text, kind) {
    return `${text}${josa(text, kind)}`;
}
