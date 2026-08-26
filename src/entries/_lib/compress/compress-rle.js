/* 런 렝스 부호화 — **이어진 반복**을 「글자 + 횟수」로 줄인다.
 *
 * 이 방법의 알맹이는 잘 되는 자리가 아니라 **안 되는 자리**다. 반복이 하나도 없으면
 * 글자마다 「1번」을 덧붙이게 되어 **길이가 두 배가 된다.** 그래서 프리셋에 반복이 없는
 * 글을 반드시 하나 둔다 → `compress-registry.js`
 *
 * **횟수를 몇 비트로 적을지는 글이 정한다.** 가장 긴 런이 3이면 2비트면 되고, 20이면
 * 5비트가 든다. 고정 8비트로 두면 짧은 글에서 런 렝스가 늘 지는 것처럼 보이는데,
 * 그건 방법의 성질이 아니라 우리가 고른 자릿수 탓이다 — **방법 탓이 아닌 것을
 * 방법 탓으로 보이게 하면 안 된다.**
 */

import {countBits, createCompressRecorder} from './compress-model.js';
import {josa, withJosa} from '../josa.js';

/** 이어진 같은 글자의 구간들. 셈과 그림이 같은 것을 보도록 **한 곳에서만 가른다.** */
export function runsOf(text) {
    const runs = [];
    for (let i = 0; i < text.length;) {
        let j = i;
        while (j < text.length && text[j] === text[i]) j++;
        runs.push({ch: text[i], n: j - i, from: i, to: j});
        i = j;
    }
    return runs;
}

/** 횟수 한 칸에 드는 비트. 가장 긴 런이 정한다. */
export function runCountBits(text) {
    const runs = runsOf(text);
    return countBits(runs.reduce((a, r) => Math.max(a, r.n), 1));
}

export function rleEncode(text, opts = {}) {
    const rec = createCompressRecorder(text, opts);
    const w = rec.width;

    if (!text.length) {
        rec.say('줄일 글이 없습니다.').step('idle');
        return rec.done();
    }

    const runs = runsOf(text);
    const cw = runCountBits(text);
    const 가장긴 = runs.reduce((a, r) => Math.max(a, r.n), 1);

    rec.say(`글자가 ${rec.kinds}가지라 하나에 <b>${w}비트</b>면 다 구별됩니다. `
        + `가장 긴 반복이 ${withJosa(가장긴, '이라')} 횟수는 <b>${cw}비트</b>로 적습니다. `
        + `그러니 조각 하나가 <b>${w + cw}비트</b>입니다.`)
        .step('start');

    for (const r of runs) {
        rec.cover(r.from, r.to)
            .say(`${r.from}번부터 <b>${withJosa(r.ch, '이가')}</b> ${r.n}번 이어집니다.`)
            .step('scan');

        rec.emit({kind: 'run', text: `${r.ch}${r.n}`, ch: r.ch, n: r.n, bits: w + cw, from: r.from, to: r.to})
            .cover(r.from, r.to)
            .say(`<b>${r.ch}${r.n}</b>${josa(r.n, '으로')} 적습니다. `
                + (r.n === 1
                    ? '한 번뿐인데도 <b>「1번」을 덧붙여야 합니다</b> — 여기서 오히려 늘어납니다.'
                    : `${r.n}글자가 조각 하나가 되었습니다.`))
            .step('emit');
    }

    const out = rec.done();
    return out;
}

/** 되돌리기. **검사가 이것으로 원본과 대 본다** — 되돌아오지 않으면 압축이 아니다. */
export function rleDecode(pieces) {
    return pieces.map((p) => p.ch.repeat(p.n)).join('');
}
