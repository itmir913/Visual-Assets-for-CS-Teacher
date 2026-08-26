// 압축 시뮬레이터의 값을 **따로 구해서** 대 본다.
//
// 같은 코드로 두 번 세면 틀린 것도 맞다고 나온다. 그래서 이 파일은 시뮬레이터의
// 함수를 셈에 쓰지 않고, **여기서 다시 센다** — 런은 손으로 훑어 세고, 허프만의
// 「가장 짧은 전체 길이」는 **나무를 짓지 않고** 다른 방법으로 구한다.
//
// 못박는 것.
//   - 되돌리면 원본과 한 글자도 다르지 않다 (압축의 정의다)
//   - 화면에 쌓인 조각의 비트 합이 **마지막 장의 셈과 같다** — 화면과 셈이 갈리지 않는다
//   - 허프만이 낸 전체 길이가 **이론상 가장 짧은 값과 같다**
//   - 허프만 코드는 **접두 부호**다 — 아니면 띄어 적지 않고는 되살릴 수 없다
//   - 횟수가 고르면 허프만이 **하나도 못 줄인다** — 화면이 그렇게 적어 두었으므로 참이어야 한다
//   - 같은 글은 **언제나 같은 나무**가 된다

import {frequencies, symbolBits, compressRate} from '../src/entries/_lib/compress/compress-model.js';
import {rleEncode, rleDecode, runsOf} from '../src/entries/_lib/compress/compress-rle.js';
import {
    huffmanEncode, huffmanTree, huffmanDecode, codesOf, isPrefixFree, tableBitsOf,
} from '../src/entries/_lib/compress/compress-huffman.js';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

/* ================================================================
   따로 구하는 정답
   ================================================================ */

/** 런의 개수를 **처음부터 다시 센다.** `runsOf`를 부르지 않는다. */
function countRuns(text) {
    if (!text) return 0;
    let n = 1;
    for (let i = 1; i < text.length; i++) if (text[i] !== text[i - 1]) n++;
    return n;
}

/** 가장 긴 런의 길이. 역시 다시 센다. */
function longestRun(text) {
    if (!text) return 0;
    let best = 1, cur = 1;
    for (let i = 1; i < text.length; i++) {
        cur = text[i] === text[i - 1] ? cur + 1 : 1;
        if (cur > best) best = cur;
    }
    return best;
}

/**
 * 허프만이 낼 수 있는 **가장 짧은 전체 길이**를 나무를 짓지 않고 구한다.
 *
 * 두 개를 묶을 때마다 «묶인 합»이 전체 길이에 그대로 더해진다는 성질을 쓴다.
 * 어느 잎의 깊이가 얼마인지는 안 보고 **묶은 값을 더하기만 한다** —
 * 시뮬레이터가 잎을 걸어 내려가 세는 것과 **셈이 완전히 다른 길**이다.
 */
function optimalBits(text) {
    const freq = frequencies(text).map((f) => f.n);
    if (freq.length === 0) return 0;
    if (freq.length === 1) return text.length;      // 한 가지뿐이면 한 비트씩
    const q = [...freq].sort((a, b) => a - b);
    let total = 0;
    while (q.length > 1) {
        const a = q.shift();
        const b = q.shift();
        total += a + b;
        // 정렬을 지켜 넣는다
        let i = 0;
        while (i < q.length && q[i] < a + b) i++;
        q.splice(i, 0, a + b);
    }
    return total;
}

/* ================================================================
   글감
   ================================================================ */

const 손으로_고른_글 = [
    'AAAAABBCCC',        // 강의노트가 든 예. A5 B2 C3
    'AAAAAAAAAAAAAAAAAAAA',
    'ABCDEFGHIJ',        // 반복이 하나도 없다
    'ABABABABAB',        // 횟수가 고르다 — 허프만이 0%가 나와야 한다
    'A',
    'AB',
    'AAB',
    'ZZZZZZZZZZZZZZZZZZZZZZZZ',
    'AABBAABBAABB',
    'AAAAAAAAAABCDEFGHIJKLMN',
];

function 무작위글(rng, maxKinds, len) {
    const 글자 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, maxKinds);
    let s = '';
    for (let i = 0; i < len; i++) s += 글자[Math.floor(rng() * 글자.length)];
    return s;
}

function mulberry(seed) {
    return function () {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const rng = mulberry(20260826);
const 글감 = [...손으로_고른_글];
for (let k = 0; k < 300; k++) {
    글감.push(무작위글(rng, 1 + Math.floor(rng() * 8), 1 + Math.floor(rng() * 24)));
}

/* ================================================================
   대 보기
   ================================================================ */

/** 마지막 장의 셈이 쌓인 조각과 맞는가. **화면이 보는 것과 셈이 갈리면 안 된다.** */
function 장과셈이맞는가(out, where) {
    const last = out.frames[out.frames.length - 1];
    if (!last) return bad(`${where}: 장이 하나도 없다`);
    const 쌓인본문 = last.out.reduce((a, x) => a + x.bits, 0);
    const 쌓인표 = last.side.reduce((a, x) => a + x.bits, 0);
    if (last.counts.body !== 쌓인본문) {
        bad(`${where}: 마지막 장의 본문 셈 ${last.counts.body}인데 조각을 더하면 ${쌓인본문}`);
    }
    if (last.counts.table !== 쌓인표) {
        bad(`${where}: 마지막 장의 표 셈 ${last.counts.table}인데 줄을 더하면 ${쌓인표}`);
    }
    if (last.counts.body !== out.bodyBits) {
        bad(`${where}: 마지막 장 ${last.counts.body}과 내놓은 값 ${out.bodyBits}이 다르다`);
    }
    // 장마다 본문 셈이 줄어드는 일은 없다 — 조각은 쌓이기만 한다
    let prev = -1;
    for (const f of out.frames) {
        if (f.counts.body < prev) return bad(`${where}: 본문 셈이 ${prev}에서 ${f.counts.body}으로 줄었다`);
        prev = f.counts.body;
    }
}

let 판 = 0;
for (const text of 글감) {
    판++;
    const kinds = new Set(text).size;
    const w = symbolBits(kinds);

    /* ---- 런 렝스 ---- */
    const r = rleEncode(text);
    const where삼 = `런 「${text}」`;

    if (rleDecode(r.out) !== text) {
        bad(`${where삼}: 되돌렸더니 「${rleDecode(r.out)}」 — 원본과 다르다`);
    }
    const 런수 = countRuns(text);
    if (r.out.length !== 런수) bad(`${where삼}: 조각 ${r.out.length}개인데 런은 ${런수}개다`);

    const cw = Math.max(1, Math.ceil(Math.log2(Math.max(1, longestRun(text)) + 1)));
    const 런예상 = 런수 * (w + cw);
    if (text.length && r.bodyBits !== 런예상) {
        bad(`${where삼}: ${r.bodyBits}비트인데 따로 세면 ${런예상}비트(런 ${런수} × (${w}+${cw}))`);
    }
    장과셈이맞는가(r, where삼);

    // 반복이 하나도 없으면 **반드시 늘어난다.** 화면이 그렇게 적어 두었다.
    if (text.length > 1 && 런수 === text.length) {
        if (compressRate(r.beforeBits, r.bodyBits) >= 0) {
            bad(`${where삼}: 반복이 없는데 압축률이 ${compressRate(r.beforeBits, r.bodyBits)}%다 — 늘어나야 한다`);
        }
    }

    /* ---- 허프만 ---- */
    const h = huffmanEncode(text);
    const tree = huffmanTree(text);
    const codes = codesOf(tree);
    const where허 = `허프만 「${text}」`;

    const bits = h.out.map((o) => o.code).join('');
    if (huffmanDecode(bits, tree) !== text) {
        bad(`${where허}: 되돌렸더니 「${huffmanDecode(bits, tree)}」 — 원본과 다르다`);
    }
    if (!isPrefixFree(codes)) {
        bad(`${where허}: 접두 부호가 아니다 — ${[...codes.entries()].map(([c, x]) => c + ':' + x).join(' ')}`);
    }
    const 최적 = optimalBits(text);
    if (h.bodyBits !== 최적) {
        bad(`${where허}: ${h.bodyBits}비트인데 가장 짧게 하면 ${최적}비트다`);
    }
    장과셈이맞는가(h, where허);

    // 표 셈이 실제 줄과 맞는가
    if (text.length) {
        const 표 = tableBitsOf(codes, w);
        if (h.tableBits !== 표.bits) bad(`${where허}: 표 ${h.tableBits}비트인데 따로 세면 ${표.bits}비트`);
    }

    // **같은 글은 같은 나무가 된다.** 두 번 지어 모양까지 대 본다.
    if (JSON.stringify(huffmanTree(text)) !== JSON.stringify(tree)) {
        bad(`${where허}: 두 번 지었더니 나무 모양이 달라졌다`);
    }

    // 횟수가 고르고 가짓수가 2의 거듭제곱이면 **하나도 못 줄인다.**
    const ns = frequencies(text).map((f) => f.n);
    const 고른가 = ns.length > 1 && ns.every((n) => n === ns[0]);
    const 이의거듭 = Number.isInteger(Math.log2(ns.length));
    if (고른가 && 이의거듭 && h.bodyBits !== text.length * w) {
        bad(`${where허}: 횟수가 고르고 ${ns.length}가지인데 ${h.bodyBits}비트다 — ${text.length * w}이어야 한다`);
    }
}

/* ---- 강의노트가 든 예를 값으로 못박는다 ----
   「A 5번 · C 3번 · B 2번, 코드 0 · 10 · 11, 5 + 6 + 4 = 15칸」
   같은 글을 이 화면에 넣었을 때 그 15가 그대로 나와야 한다 —
   **두 자리가 다른 숫자를 말하면 학생이 어느 쪽을 믿을지 알 수 없다.** */
{
    const h = huffmanEncode('AAAAABBCCC');
    if (h.bodyBits !== 15) bad(`강의노트 예: 본문이 ${h.bodyBits}비트인데 15여야 한다`);
    if (h.beforeBits !== 20) bad(`강의노트 예: 기준이 ${h.beforeBits}비트인데 20이어야 한다`);
    /* **길이만 대 보면 모자란다.** 길이가 같아도 어느 글자가 `10`이고 어느 글자가 `11`인지가
       갈릴 수 있고, 그 갈림이 곧 두 화면의 어긋남이다. 그래서 **코드 자체**를 못박는다. */
    const codes = codesOf(huffmanTree('AAAAABBCCC'));
    const 적힌대로 = {A: '0', C: '10', B: '11'};
    for (const [ch, want] of Object.entries(적힌대로)) {
        if (codes.get(ch) !== want) bad(`강의노트 예: ${ch}가 ${codes.get(ch)}인데 ${want}여야 한다`);
    }
}

/* ---- 「ABABABABAB은 허프만으로 못 줄인다」 — 화면이 적어 둔 말이 참인가 ---- */
{
    const h = huffmanEncode('ABABABABAB');
    if (compressRate(h.beforeBits, h.bodyBits) !== 0) {
        bad(`ABABABABAB: 허프만 압축률이 ${compressRate(h.beforeBits, h.bodyBits)}%다 — 0이어야 한다`);
    }
    const r = rleEncode('ABABABABAB');
    if (compressRate(r.beforeBits, r.bodyBits) >= 0) {
        bad(`ABABABABAB: 런 렝스 압축률이 ${compressRate(r.beforeBits, r.bodyBits)}%다 — 음수여야 한다`);
    }
}

/* ---- 런 가르기가 글을 빠짐없이 덮는가 ---- */
for (const text of 글감.slice(0, 40)) {
    const runs = runsOf(text);
    if (runs.map((x) => x.ch.repeat(x.n)).join('') !== text) bad(`런 가르기가 「${text}」를 못 덮는다`);
    for (let i = 1; i < runs.length; i++) {
        if (runs[i].from !== runs[i - 1].to) bad(`런 가르기에 틈이 있다 — 「${text}」`);
        if (runs[i].ch === runs[i - 1].ch) bad(`이웃한 런의 글자가 같다 — 「${text}」`);
    }
}

console.log(`글 ${글감.length}개를 두 방법으로 돌렸다`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
