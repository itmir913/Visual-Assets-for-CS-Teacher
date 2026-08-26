/* 키워드 인코딩 — **떨어져 있어도 반복되면** 기호 하나로 바꾼다.
 *
 * 런 렝스가 못 하는 자리를 이것이 한다. `ABABABABAB`에는 «이어진» 반복이 하나도 없어
 * 런 렝스는 길이를 두 배로 늘리고, A와 B가 다섯 번씩이라 허프만도 한 비트씩 주어
 * 하나도 못 줄인다. 그런데 **`AB`가 다섯 번 반복된다** — 그것을 기호 하나로 바꾸면
 * 열 글자가 다섯 글자가 된다.
 *
 * **강의노트가 바로 그 글을 두고 「세 방법 가운데 무엇으로 줄일 수 있을까」를 묻는다.**
 * 답을 눌러 확인할 자리가 없어서 그 물음이 열린 채였다. 이 탭이 그 자리다.
 *
 * ---------------------------------------------------------------
 * **가장 좋은 답을 찾아 준다고 말하지 않는다**
 * ---------------------------------------------------------------
 *
 * 어떤 조각들을 골라야 가장 많이 줄어드는지는 조각끼리 겹치고 서로를 잡아먹어서
 * 다 헤아려 보지 않고는 알 수 없다. 여기서 쓰는 규칙은 하나다 —
 *
 *   > **지금 이득이 가장 큰 조각을 하나 고른다. 이득이 없어지면 멈춘다.**
 *
 * 이것은 «규칙»이지 «보장»이 아니다. 화면에도 그렇게 적는다.
 * **「이 방법이 가장 좋은 답을 낸다」고 적으면 학생이 반례를 만들 수 있다** —
 * 그러면 배운 것이 통째로 흔들린다.
 *
 * ---------------------------------------------------------------
 * 사전도 함께 보내야 한다
 * ---------------------------------------------------------------
 *
 * 「★가 AB다」를 받는 쪽이 모르면 되살릴 수가 없다. 그래서 사전이 따라붙고,
 * 짧은 글에서는 그 사전이 아낀 것을 도로 잡아먹는다. 허프만의 코드표와 같은 자리다 —
 * 압축률에는 넣지 않고 크기를 옆에 적는다. 까닭은 `compress-model.js`에.
 */

import {createCompressRecorder, symbolBits} from './compress-model.js';
import {josa, withJosa} from '../josa.js';

/** 기호로 쓸 글자. **입력이 영어 대문자뿐이라 겹칠 일이 없다.** */
export const KEYWORD_SYMBOLS = ['★', '●', '▲'];

/** 조각 하나가 겹치지 않게 몇 번 나오는가. **왼쪽부터 집는다** — 세는 법과 바꾸는 법이
 *  같아야 「세 번 나온다」고 해 놓고 두 번만 바꾸는 일이 없다. */
export function countPieces(text, piece) {
    let n = 0;
    for (let i = 0; i <= text.length - piece.length;) {
        if (text.startsWith(piece, i)) { n++; i += piece.length; } else i++;
    }
    return n;
}

function replacePieces(text, piece, symbol) {
    let out = '';
    for (let i = 0; i < text.length;) {
        if (text.startsWith(piece, i)) { out += symbol; i += piece.length; } else { out += text[i]; i++; }
    }
    return out;
}

/**
 * 현재 글에서 **이득이 가장 큰 조각**을 고른다.
 *
 * 이득 = 「줄어드는 글자 수 × 글자 하나의 비트」 − 「사전에 한 줄 적는 비트」.
 * 같으면 **긴 조각을 먼저, 그다음은 앞에 나온 것을** 고른다 — 긴 길이부터 확인하고
 * «더 큰» 이득에서만 갈아 끼우므로 그렇게 된다. 회차마다 답이 흔들리면 학생이 두 번
 * 돌려 다른 그림을 본다.
 *
 * **이 동점 규칙은 검사에서 값으로 확인하지 못했다.** 이득이 꼭 같아지는 글을
 * 지어내야 하는데 찾지 못했다 — 확인 순서를 뒤집어도 검사가 통과한다.
 *
 * @returns {{piece: string, times: number, gain: number}|null}
 */
export function bestPiece(text, width, entryBits) {
    let best = null;
    const maxLen = Math.floor(text.length / 2);
    for (let len = maxLen; len >= 2; len--) {
        const seen = new Set();
        for (let i = 0; i + len <= text.length; i++) {
            const piece = text.slice(i, i + len);
            if (seen.has(piece)) continue;
            seen.add(piece);
            /* 기호가 이미 들어간 조각은 고르지 않는다. 기호 속의 기호를 풀어 내려면
               사전을 차례대로 되짚어야 하는데, 그 차례까지 함께 보내야 한다. */
            if (KEYWORD_SYMBOLS.some((s) => piece.includes(s))) continue;

            const times = countPieces(text, piece);
            if (times < 2) continue;
            const gain = times * (len - 1) * width - entryBits(len);
            if (!best || gain > best.gain) best = {piece, times, gain, len};
        }
    }
    return best && best.gain > 0 ? best : null;
}

/**
 * 사전 한 줄에 드는 비트 — **기호 하나 + 낱말 글자들.**
 *
 * **본문 글자와 사전 낱말은 폭이 다르다.** 본문에는 바꾸고 남은 것만 나오고,
 * 사전에는 «원래 글자»가 나온다. `AB`를 전부 기호로 바꾸면 본문에서 A와 B가 사라지므로
 * 본문은 좁아지는데, 사전은 여전히 A와 B를 적어야 한다.
 *
 * **알맹이만 센다** — 줄을 어디서 끊는지 표시하는 자리는 세지 않았다.
 * 허프만의 코드표와 같은 규칙이다. 처음에는 낱말 길이를 적는 칸까지 넣었는데,
 * 그 칸 하나가 `ABABABABAB`에서 이득을 음수로 돌려 **이 방법이 유일하게 줄일 수 있는 글을
 * 「줄일 수 없다」고 내놓게 만들었다.** 셈에 넣은 것이 가르치려는 것을 지운 셈이다.
 */
function entryBitsOf(wBody, wDict) {
    return (len) => wBody + len * wDict;
}

/** 현재 글에 실제로 나오는 글자 가짓수로 폭을 낸다. */
const widthOf = (s) => symbolBits(new Set(s).size);

export function keywordEncode(text, opts = {}) {
    const kinds0 = new Set(text).size;
    const rec = createCompressRecorder(text, {...opts, kinds: kinds0});
    if (!text.length) {
        /* **빈 글에서도 `dict`와 `encoded`를 채워 내보낸다.** 여기서 그냥 나가면 둘이
           `undefined`로 남고, 되돌리기가 그것을 순회하다 죽는다. 지금 화면은 빈 입력을
           막지만 **막는 곳이 하나 없어지면 조용히 죽는 자리**라 여기서 세워 둔다. */
        rec.say('압축할 글이 없습니다.').step('idle');
        const 빈것 = rec.done();
        빈것.dict = [];
        빈것.encoded = '';
        return 빈것;
    }

    /* **폭은 「현재 글에 실제로 나오는 것」이 정한다.**
     *
     * 처음에는 쓸 기호 셋을 미리 세어 폭을 넓게 잡아 두었다. 그러자 `ABABABABAB`이
     * 글자 두 가지(1비트)에서 다섯 가지(3비트)가 되어 **줄인 보람이 통째로 사라졌다** —
     * 열 글자 10비트가 다섯 글자 15비트가 됐다.
     *
     * 그런데 `AB`를 전부 바꾸고 나면 남는 것은 **기호 하나뿐**이다. A도 B도 본문에
     * 나오지 않는다. 쓰지도 않을 것을 구별하려고 자리를 넓혀 둘 까닭이 없다.
     * **셀 것은 「넣을 수 있었던 것」이 아니라 「실제로 나온 것」이다.**
     *
     * 고를 때는 그때의 글로 폭을 잡고, 다 고른 뒤에 **끝난 글로 다시 측정한다.**
     * 그래서 고르는 규칙은 어림이지만 **화면에 적히는 숫자는 언제나 서로 맞는다.** */
    let now = text;
    const dict = [];
    const wDict = symbolBits(kinds0);

    rec.carry({now, dict: []})
        .say(`글자가 ${kinds0}가지입니다. <b>떨어져 있어도 반복되는 조각</b>을 찾아 `
            + `기호 하나로 바꿉니다.`)
        .step('start');

    for (const symbol of KEYWORD_SYMBOLS) {
        const w지금 = widthOf(now);
        const found = bestPiece(now, w지금, entryBitsOf(w지금, wDict));
        if (!found) {
            rec.carry({now, dict: [...dict]})
                .say(dict.length
                    ? '더 바꿀 만한 조각이 없습니다. <b>바꿔서 아끼는 것보다 사전에 적는 것이 더 크면</b> 멈춥니다.'
                    : '반복되는 조각이 없어 <b>바꿀 것이 없습니다.</b> 이 글은 키워드 인코딩으로 줄지 않습니다.')
                .step('stop');
            break;
        }

        rec.carry({now, dict: [...dict], picked: found.piece})
            .say(`<b>${found.piece}</b>${josa(found.piece, '이가')} ${found.times}번 반복됩니다. `
                + `${found.times}번을 기호 하나씩으로 바꾸면 `
                + `<b>${found.times * (found.len - 1)}글자</b>가 줄어듭니다.`)
            .step('pick');

        now = replacePieces(now, found.piece, symbol);
        dict.push({symbol, piece: found.piece});

        rec.carry({now, dict: [...dict]})
            /* **기호 뒤에 조사를 붙이지 않는다.** `★`를 무엇이라 읽는지 정해 두지 않았으니
               「★으로」인지 「★로」인지 고를 수가 없다. 뒤에 「기호」를 세워 조사가
               그 낱말에 붙게 하면 읽는 소리를 정하지 않고도 문장이 선다. */
            .say(`<b>${symbol}</b> 기호로 바꾸었습니다. 글이 <b>${now.length}글자</b>가 되었습니다. `
                + `대신 사전에 <b>${symbol} = ${found.piece}</b>${josa(found.piece, '을를')} `
                + `적어 두어야 합니다.`)
            .step('swap');
    }

    /* 다 바꾸고 나서 **끝난 글로 폭을 다시 측정한다.** 바꾸는 동안 사라진 글자가 있으면
       그만큼 좁아진다 — 그것이 이 방법이 줄이는 방식의 절반이다. */
    const wBody = widthOf(now);
    const entry = entryBitsOf(wBody, wDict);
    for (const d of dict) {
        rec.aside({
            kind: 'entry',
            text: `${d.symbol} = ${d.piece}`,
            symbol: d.symbol,
            piece: d.piece,
            bits: entry(d.piece.length),
        });
    }

    for (let i = 0; i < now.length; i++) {
        const ch = now[i];
        const 기호인가 = KEYWORD_SYMBOLS.includes(ch);
        rec.emit({kind: 기호인가 ? 'symbol' : 'plain', text: ch, ch, bits: wBody, from: i, to: i + 1});
    }
    /* **글자가 줄어도 비트는 늘 수 있다.** 기호가 «새 글자 한 가지»로 세어져 칸이
       넓어지면, 글자 수가 준 것보다 칸이 넓어진 것이 더 클 수 있다.
       고를 때 쓴 폭은 그때의 글로 측정한 것이라 끝난 뒤의 폭을 미리 알 수 없어서다.
       **그 회차에서 「줄어듭니다」로만 끝내면 바로 아래 계수기의 음수와 어긋난다** —
       런 렝스가 늘어나는 자리에서 그렇다고 밝히는 것과 같은 자리다. */
    const 늘었나 = wBody * now.length > text.length * wDict;
    rec.carry({now, dict: [...dict]})
        .say(`남은 ${now.length}글자에 나오는 것이 ${new Set(now).size}가지라 `
            + `<b>${wBody}비트씩</b>이면 됩니다. `
            + (dict.length
                ? (늘었나
                    ? '<b>그런데 글자 수가 준 것보다 칸이 넓어진 것이 더 큽니다</b> — '
                      + '기호가 새 글자 한 가지로 세어지기 때문입니다. <b>여기서는 오히려 늘어납니다.</b>'
                    : '기호도 글자 하나로 칩니다 — <b>사전을 봐야 무엇인지 알 수 있을 뿐입니다.</b>')
                : '바꾼 것이 없어 처음과 같습니다.'))
        .step('emit');

    const out = rec.done();
    out.dict = dict;
    out.encoded = now;
    return out;
}

/** 되돌리기. **사전을 거꾸로 되짚는다** — 검사가 이것으로 원본과 대조한다. */
export function keywordDecode(encoded, dict) {
    let s = encoded;
    for (let i = dict.length - 1; i >= 0; i--) {
        s = s.split(dict[i].symbol).join(dict[i].piece);
    }
    return s;
}
