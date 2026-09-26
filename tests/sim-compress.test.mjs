// 압축 시뮬레이터의 값을 **따로 구해서** 대 본다.
//
// 같은 코드로 두 번 세면 틀린 것도 맞다고 나온다. 그래서 이 파일은 시뮬레이터의
// 함수를 셈에 쓰지 않고, **여기서 다시 센다** — 런은 손으로 살펴 세고, 허프만의
// 「가장 짧은 전체 길이」는 **트리를 짓지 않고** 다른 방법으로 구한다.
//
// 못박는 것.
//   - 되돌리면 원본과 한 글자도 다르지 않다 (압축의 정의다)
//   - 화면에 쌓인 조각의 비트 합이 **마지막 장의 셈과 같다** — 화면과 셈이 갈리지 않는다
//   - 허프만이 낸 전체 길이가 **이론상 가장 짧은 값과 같다**
//   - 허프만 코드는 **접두 부호**다 — 아니면 띄어 적지 않고는 되살릴 수 없다
//   - 횟수가 고르면 허프만이 **하나도 못 줄인다** — 화면이 그렇게 적어 두었으므로 참이어야 한다
//   - 같은 글은 **언제나 같은 트리**가 된다
import {test, expect} from 'vitest';

import {frequencies, symbolBits, compressRate} from '../src/entries/_lib/compress/compress-model.js';
import {rleEncode, rleDecode, runsOf} from '../src/entries/_lib/compress/compress-rle.js';
import {
    huffmanEncode, huffmanTree, huffmanDecode, codesOf, isPrefixFree, tableBitsOf,
} from '../src/entries/_lib/compress/compress-huffman.js';
import {
    keywordEncode, keywordDecode, countPieces, KEYWORD_SYMBOLS,
} from '../src/entries/_lib/compress/compress-keyword.js';
import {
    COMPRESS_PRESETS, COMPRESS_METHODS, sideNameOf,
} from '../src/entries/_lib/compress/compress-registry.js';
import {COMPRESS_ALPHABET, COMPRESS_MAX_LEN} from '../src/entries/_lib/compress/compress-model.js';

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
 * 허프만이 낼 수 있는 **가장 짧은 전체 길이**를 트리를 짓지 않고 구한다.
 *
 * 두 개를 묶을 때마다 «묶인 합»이 전체 길이에 그대로 더해진다는 성질을 쓴다.
 * 어느 잎의 깊이가 얼마인지는 안 보고 **묶은 값을 더하기만 한다** —
 * 시뮬레이터가 잎을 걸어 내려가 세는 것과 **셈이 완전히 다른 길**이다.
 */
function optimalBits(text) {
    const freq = 따로세기(text).map((f) => f.n);
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
    '',                  // **빈 글.** 없어서 키워드의 되돌리기가 죽는 것을 못 잡고 있었다
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
for (let k = 0; k < 2500; k++) {
    글감.push(무작위글(rng, 1 + Math.floor(rng() * 8), 1 + Math.floor(rng() * 24)));
}
/* **글자 두 가지짜리 글을 따로 더 넣는다.** 키워드가 두 조각의 이득을 똑같이 매기는
   글이 여기서 가장 잘 나온다 — 동점 규칙은 그런 글이 있어야 밟힌다. */
for (let k = 0; k < 1000; k++) {
    글감.push(무작위글(rng, 2, 6 + Math.floor(rng() * 19)));
}

/** 글자별 횟수를 **나온 순서대로** 다시 센다. `frequencies`를 부르지 않는다. */
function 따로세기(text) {
    const 순서 = [];
    const 수 = {};
    for (let i = 0; i < text.length; i++) {
        const c = text.charAt(i);
        if (!(c in 수)) { 수[c] = 0; 순서.push(c); }
        수[c] += 1;
    }
    return 순서.map((ch) => ({ch, n: 수[ch]}));
}

/** 가짓수 k를 구별하는 데 드는 비트. `symbolBits`와 달리 **2를 거듭 곱해** 구한다. */
function 폭(k) {
    let b = 1;
    while (2 ** b < k) b++;
    return b;
}

/**
 * 허프만 코드표를 **따로 짠 우선순위 큐로** 만든다.
 *
 * 화면에 적어 둔 규칙 둘을 그대로 옮긴다 — 가장 작은 둘을 꺼내되 **동점이면 먼저
 * 만들어진 것부터**, 묶을 때는 **자주 나오는 쪽이 왼쪽(0)**, 같으면 먼저 만든 쪽이 왼쪽.
 * 시뮬레이터는 숲을 통째로 정렬하고, 여기서는 매번 가장 작은 하나를 훑어 꺼낸다.
 */
function 따로허프만(text) {
    let made = 0;
    const pool = 따로세기(text).map(({ch, n}) => ({ch, n, t: made++, kids: null}));
    const take = () => {
        let k = 0;
        for (let i = 1; i < pool.length; i++) {
            if (pool[i].n < pool[k].n || (pool[i].n === pool[k].n && pool[i].t < pool[k].t)) k = i;
        }
        return pool.splice(k, 1)[0];
    };
    while (pool.length > 1) {
        const a = take();
        const b = take();
        const [l, r] = (a.n > b.n || (a.n === b.n && a.t < b.t)) ? [a, b] : [b, a];
        pool.push({ch: null, n: a.n + b.n, t: made++, kids: [l, r]});
    }
    const codes = {};
    const walk = (nd, p) => {
        if (!nd.kids) { codes[nd.ch] = p || '0'; return; }
        walk(nd.kids[0], p + '0');
        walk(nd.kids[1], p + '1');
    };
    if (pool.length) walk(pool[0], '');
    return codes;
}

/** 겹치지 않게 왼쪽부터 센 횟수. `countPieces`를 부르지 않는다. */
function 겹침없이(text, piece) {
    let n = 0;
    let i = 0;
    while (i + piece.length <= text.length) {
        if (text.substr(i, piece.length) === piece) { n++; i += piece.length; } else i++;
    }
    return n;
}

/**
 * 키워드가 **지금 글에서 골라야 할 조각**을 따로 구한다.
 * 이득 = 줄어드는 글자 × 지금 폭 − (기호 하나 + 낱말 글자 × 원래 폭).
 * 같으면 긴 것, 그다음은 처음 나온 자리가 앞인 것. 동점이 있었는지도 함께 돌려준다.
 */
function 따로고르기(now, 원래폭) {
    const w = 폭(new Set(now).size);
    const 후보 = [];
    for (let L = 2; L <= now.length; L++) {
        for (let i = 0; i + L <= now.length; i++) {
            const piece = now.substr(i, L);
            if (후보.some((c) => c.piece === piece)) continue;
            if (KEYWORD_SYMBOLS.some((s) => piece.includes(s))) continue;
            const t = 겹침없이(now, piece);
            if (t < 2) continue;
            후보.push({piece, L, first: i, gain: t * (L - 1) * w - (w + L * 원래폭)});
        }
    }
    후보.sort((a, b) => (b.gain - a.gain) || (b.L - a.L) || (a.first - b.first));
    const best = 후보[0];
    if (!best || best.gain <= 0) return {best: null, 동점: false};
    return {best, 동점: 후보.length > 1 && 후보[1].gain === best.gain};
}

let 키워드동점 = 0;

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

    // **같은 글은 같은 트리가 된다.** 두 번 지어 모양까지 대 본다.
    if (JSON.stringify(huffmanTree(text)) !== JSON.stringify(tree)) {
        bad(`${where허}: 두 번 지었더니 트리 모양이 달라졌다`);
    }

    // 횟수가 고르고 가짓수가 2의 거듭제곱이면 **하나도 못 줄인다.**
    const ns = frequencies(text).map((f) => f.n);
    const 고른가 = ns.length > 1 && ns.every((n) => n === ns[0]);
    const 이의거듭 = Number.isInteger(Math.log2(ns.length));
    if (고른가 && 이의거듭 && h.bodyBits !== text.length * w) {
        bad(`${where허}: 횟수가 고르고 ${ns.length}가지인데 ${h.bodyBits}비트다 — ${text.length * w}이어야 한다`);
    }
    /* 반대쪽도 화면이 적어 두었다 — 「가짓수가 3·5·6처럼 어정쩡하면 횟수가 고르더라도 조금 줄어듭니다」. */
    if (고른가 && !이의거듭 && h.bodyBits >= text.length * w) {
        bad(`${where허}: 횟수가 고르고 ${ns.length}가지인데 ${h.bodyBits}비트다 — ${text.length * w}보다 작아야 한다`);
    }

    /* **센 횟수가 맞는가.** 트리가 옳아도 횟수를 잘못 세면 엉뚱한 글자가 짧아진다. */
    const 참횟수 = 따로세기(text);
    if (JSON.stringify(frequencies(text)) !== JSON.stringify(참횟수)) {
        bad(`${where허}: 센 횟수가 ${JSON.stringify(frequencies(text))}인데 따로 세면 ${JSON.stringify(참횟수)}`);
    }

    /* **코드 자체를 따로 짠 큐와 댄다.** 길이 합(최적성)만 보면 동점 규칙과 좌우 규칙이
       틀려도 통과한다 — 총 비트는 어떤 허프만 트리든 같기 때문이다. 그런데 화면은
       「같은 글은 늘 같은 트리」「자주 나오는 쪽이 왼쪽」이라고 적어 두었다. */
    const 참코드 = 따로허프만(text);
    for (const {ch} of 참횟수) {
        if (codes.get(ch) !== 참코드[ch]) {
            bad(`${where허}: ${ch}의 코드가 ${codes.get(ch)}인데 규칙대로면 ${참코드[ch]}다`);
            break;
        }
    }
    if (codes.size !== 참횟수.length) bad(`${where허}: 코드가 ${codes.size}개인데 글자는 ${참횟수.length}가지다`);

    /* 본문 비트 = Σ 코드 길이 × 횟수. 조각을 더하지 않고 **코드표와 따로 센 횟수로** 낸다. */
    const 길이합 = 참횟수.reduce((a, {ch, n}) => a + (참코드[ch] || '').length * n, 0);
    if (text.length && h.bodyBits !== 길이합) bad(`${where허}: ${h.bodyBits}비트인데 Σ 길이×횟수는 ${길이합}`);

    /* 「자주 나온 글자일수록 코드가 짧거나 같습니다」 — 더 자주 나온 글자가 더 긴 코드를 받으면 거짓이 된다. */
    for (const a of 참횟수) {
        for (const b of 참횟수) {
            if (a.n > b.n && codes.get(a.ch).length > codes.get(b.ch).length) {
                bad(`${where허}: ${a.ch}(${a.n}번)가 ${b.ch}(${b.n}번)보다 코드가 길다`);
            }
        }
    }

    /* **장마다 고른 둘이 정말 가장 작은 둘인가.** 끝의 트리만 보면 도중의 장이 엉뚱한 둘을
       «골랐다고 말하는» 것을 못 잡는다. 동점이면 먼저 만들어진 것부터다. */
    const 고른장 = h.frames.filter((f) => f.act.kind === 'pick');
    if (text.length && 고른장.length !== 참횟수.length - 1) {
        bad(`${where허}: 묶기가 ${고른장.length}번인데 ${참횟수.length - 1}번이어야 한다`);
    }
    for (const f of 고른장) {
        const 순 = [...f.extra.forest].sort((x, y) => (x.n !== y.n ? x.n - y.n : x.seq - y.seq));
        const [p, q] = f.extra.picked;
        if (p !== 순[0].seq || q !== 순[1].seq) {
            bad(`${where허}: 숲 ${순.map((t) => `${t.seq}:${t.n}`).join(' ')}에서 ${p}·${q}를 골랐다`);
            break;
        }
    }

    /* ---- 키워드 ---- */
    const kw = keywordEncode(text);
    const where키 = `키워드 「${text}」`;

    if (keywordDecode(kw.encoded, kw.dict) !== text) {
        bad(`${where키}: 되돌렸더니 「${keywordDecode(kw.encoded, kw.dict)}」 — 원본과 다르다`);
    }
    // 사전에 오른 조각은 **실제로 두 번 넘게 나와야 한다.** 한 번뿐인 것을 사전에 올리면 손해다.
    let 되짚음 = kw.encoded;
    for (let i = kw.dict.length - 1; i >= 0; i--) {
        const {symbol, piece} = kw.dict[i];
        const 쓰인수 = [...되짚음].filter((c) => c === symbol).length;
        if (쓰인수 < 2) bad(`${where키}: ${symbol}=${piece}가 ${쓰인수}번만 쓰였다 — 사전에 올릴 값이 아니다`);
        if (countPieces(text, piece) < 2) bad(`${where키}: ${piece}가 원본에 두 번 넘게 없다`);
        되짚음 = 되짚음.split(symbol).join(piece);
    }
    // 기호가 겹쳐 쓰이면 안 된다
    if (new Set(kw.dict.map((d) => d.symbol)).size !== kw.dict.length) {
        bad(`${where키}: 같은 기호를 두 번 썼다`);
    }
    if (kw.dict.length > KEYWORD_SYMBOLS.length) bad(`${where키}: 기호를 ${kw.dict.length}개 썼다`);
    장과셈이맞는가(kw, where키);

    // 본문 조각 수는 **바꾼 뒤의 글자 수**와 같아야 한다
    if (kw.out.length !== kw.encoded.length) {
        bad(`${where키}: 조각 ${kw.out.length}개인데 바꾼 글은 ${kw.encoded.length}글자다`);
    }

    /* **본문 비트를 따로 구해서 댄다.**
       이 줄이 없어서, 「바꾼 뒤 글로 폭을 다시 잰다」를 도로 옛 셈으로 되돌려도
       검사가 초록이었다. 조각의 `bits`를 도로 더하는 검사는 «순환»이라 잡지 못한다.
       여기서는 시뮬레이터를 부르지 않고 **바꾼 글을 직접 보고** 폭을 낸다. */
    const 쓰인가짓수 = new Set(kw.encoded).size;
    const 예상폭 = Math.max(1, Math.ceil(Math.log2(Math.max(1, 쓰인가짓수))));
    const 예상본문 = kw.encoded.length * 예상폭;
    if (kw.bodyBits !== 예상본문) {
        bad(`${where키}: 본문 ${kw.bodyBits}비트인데 따로 세면 ${예상본문}비트`
            + `(${kw.encoded.length}글자 × ${예상폭}비트, 나오는 것 ${쓰인가짓수}가지)`);
    }

    /* 사전 한 줄도 따로 센다 — 기호 하나(본문 폭) + 낱말 글자들(원래 폭). */
    const 원래폭 = Math.max(1, Math.ceil(Math.log2(Math.max(1, new Set(text).size))));
    const 예상사전 = kw.dict.reduce((a, d) => a + 예상폭 + d.piece.length * 원래폭, 0);
    if (kw.tableBits !== 예상사전) {
        bad(`${where키}: 사전 ${kw.tableBits}비트인데 따로 세면 ${예상사전}비트`);
    }

    /* **장마다 고른 조각이 정말 이득이 가장 큰가.** 조각을 모두 늘어놓고 따로 셈해
       댄다. 멈춘 장에서는 이득이 남은 조각이 없어야 한다 — 「이득이 없어지면 멈춘다」. */
    for (const f of kw.frames) {
        if (f.act.kind !== 'pick' && f.act.kind !== 'stop') continue;
        const {best, 동점} = 따로고르기(f.extra.now, 원래폭);
        if (f.act.kind === 'stop') {
            if (best) bad(`${where키}: 「${f.extra.now}」에서 멈췄는데 ${best.piece}의 이득이 ${best.gain}비트 남았다`);
            continue;
        }
        if (!best || f.extra.picked !== best.piece) {
            bad(`${where키}: 「${f.extra.now}」에서 ${f.extra.picked}를 골랐는데 따로 고르면 ${best && best.piece}다`);
            break;
        }
        if (동점) 키워드동점++;
    }
    /* 기호를 다 쓰지 않았는데 멈춘 장이 없으면 「왜 멈췄는지」를 말하지 않은 것이다. */
    if (text.length && kw.dict.length < KEYWORD_SYMBOLS.length && !kw.frames.some((f) => f.act.kind === 'stop')) {
        bad(`${where키}: 기호가 남았는데 멈춘 까닭을 말하는 장이 없다`);
    }
}

/* **동점 규칙이 실제로 밟혔는가.** 동점인 글이 하나도 없었다면 위 대조는 동점 규칙을
   보지 못한 채 초록이다 — 예전에 「값으로 확인하지 못했다」고 적어 두었던 자리다. */
if (키워드동점 === 0) bad('키워드: 이득이 같은 조각이 경쟁한 글이 하나도 없었다 — 동점 규칙이 검사되지 않는다');
console.log(`  키워드 동점을 가린 장 ${키워드동점}번`);

/* 압축률을 따로 셈한다 — 줄어든 비율을 백분율로, 소수 첫째 자리까지. */
for (const [전, 후] of [[20, 15], [40, 50], [10, 10], [3, 1], [24, 7]]) {
    const 참 = Math.round(((전 - 후) / 전) * 1000) / 10;
    if (compressRate(전, 후) !== 참) bad(`압축률: ${전}→${후}가 ${compressRate(전, 후)}%인데 ${참}%다`);
}
/* 「화면 읽는 법」이 드는 예 — 「글자가 여덟 가지면 하나에 3비트」. */
for (const [k, b] of [[1, 1], [2, 1], [3, 2], [4, 2], [5, 3], [8, 3], [9, 4], [16, 4], [17, 5]]) {
    if (symbolBits(k) !== b) bad(`글자 폭: ${k}가지가 ${symbolBits(k)}비트인데 ${b}비트다`);
}

/* ---- 프리셋 안내가 말한 것이 참인가 ----
   안내는 「런 렝스에서 음수」「허프만은 줄입니다」처럼 **값을 두고 단정한다.**
   프리셋 글이나 셈이 바뀌면 그 말이 조용히 거짓이 된다. */
{
    const 률 = (id, 글) => {
        const out = COMPRESS_METHODS.find((m) => m.id === id).run(글);
        return compressRate(out.beforeBits, out.bodyBits);
    };
    const 글 = (id) => COMPRESS_PRESETS.find((p) => p.id === id).text;
    if (!(률('rle', 글('runs')) > 0)) bad('프리셋 runs: 런 렝스가 노리는 모양인데 줄지 않는다');
    if (!(률('rle', 글('flat')) < 0)) bad('프리셋 flat: 런 렝스가 늘어난다고 했는데 아니다');
    if (률('huffman', 글('flat')) !== 0) bad('프리셋 flat: 허프만이 그대로라 했는데 아니다');
    if (!(률('rle', 글('none')) < 0)) bad('프리셋 none: 런 렝스가 음수라 했는데 아니다');
    if (!(률('huffman', 글('none')) > 0)) bad('프리셋 none: 허프만이 줄인다고 했는데 아니다');
    if (률('huffman', 글('same')) !== 0) bad('프리셋 same: 허프만이 하나도 못 줄인다고 했는데 아니다');
    const 낱말 = 글('word');
    if (!(률('keyword', 낱말) >= Math.max(률('rle', 낱말), 률('huffman', 낱말)))) {
        bad('프리셋 word: 키워드가 노리는 모양인데 다른 방법이 더 줄인다');
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

/* ---- 강의노트의 「스스로 확인」이 가리키는 판 ----
   「ABABABABAB을 넣어 보세요. 반복이 분명히 있는데도 압축률이 좋지 않습니다.
     세 방법 가운데 이런 데이터를 줄일 수 있는 것은 무엇일까요?」

   **셋을 다 걸어 봐야 그 물음이 닫힌다.** 런 렝스는 늘어나고, 허프만은 그대로이고,
   키워드만 줄어야 한다. 하나라도 어긋나면 화면이 그 물음에 엉뚱한 답을 준다. */
{
    const 글 = 'ABABABABAB';
    const h = huffmanEncode(글);
    if (compressRate(h.beforeBits, h.bodyBits) !== 0) {
        bad(`${글}: 허프만 압축률이 ${compressRate(h.beforeBits, h.bodyBits)}%다 — 0이어야 한다`);
    }
    const r = rleEncode(글);
    if (compressRate(r.beforeBits, r.bodyBits) >= 0) {
        bad(`${글}: 런 렝스 압축률이 ${compressRate(r.beforeBits, r.bodyBits)}%다 — 음수여야 한다`);
    }
    const kw = keywordEncode(글);
    if (compressRate(kw.beforeBits, kw.bodyBits) <= 0) {
        bad(`${글}: 키워드 압축률이 ${compressRate(kw.beforeBits, kw.bodyBits)}%다 — 양수여야 한다`);
    }
    if (kw.encoded.length !== 5) bad(`${글}: 바꾼 뒤가 ${kw.encoded.length}글자다 — AB를 묶으면 5글자다`);
}

/* ---- 키워드가 **이득이 큰 조각을 고르는가** ----
   `ABCABCABCABC`에는 `ABC`(3글자, 4번)와 `AB`(2글자, 4번)가 둘 다 있다.
   긴 쪽이 이득이 크므로 그쪽을 골라야 한다.

   **이것은 「동점일 때 긴 쪽」을 대 보는 것이 아니다.** 여기 둘은 이득이 달라 동점이
   아니다. 순회 순서를 뒤집어도 이 검사는 통과한다 — 최댓값을 고르는 데 살피는 순서가
   상관없기 때문이다. **동점 규칙은 위의 `따로고르기` 대조가 본다** — 글자 두 가지짜리
   글에서 이득이 같은 조각이 경쟁하는 장을 세어, 하나도 없으면 빨간불을 켠다. */
{
    const kw = keywordEncode('ABCABCABCABC');
    if (!kw.dict.length) {
        bad('고르기: ABCABCABCABC에서 아무 조각도 안 골랐다');
    } else if (kw.dict[0].piece !== 'ABC') {
        bad(`고르기: 첫 조각이 「${kw.dict[0].piece}」다 — 이득이 큰 ABC를 골라야 한다`);
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

/* ================================================================
   프리셋 — **볼 것이 없는 화면이 되지 않게 지킨다**
   ================================================================ */

for (const p of COMPRESS_PRESETS) {
    if (!COMPRESS_ALPHABET.test(p.text)) bad(`프리셋 ${p.id}: 영어 대문자가 아닌 글자가 있다 — ${p.text}`);
    if (p.text.length > COMPRESS_MAX_LEN) bad(`프리셋 ${p.id}: ${p.text.length}글자다 — ${COMPRESS_MAX_LEN}자를 넘는다`);
    if (!p.text.length) bad(`프리셋 ${p.id}: 비어 있다`);
}

/* **되돌리기는 등록부가 건네주는 것으로도 돌아야 한다.**
   위에서는 모듈의 함수를 곧바로 불렀는데, 화면은 등록부를 거쳐 부른다.
   그 사이에서 어긋나면 화면에서만 깨지고 검사는 초록으로 남는다. */
for (const p of COMPRESS_PRESETS) {
    for (const m of COMPRESS_METHODS) {
        const out = m.run(p.text);
        if (m.decode(out) !== p.text) {
            bad(`등록부 ${m.id} ${p.id}: 되돌렸더니 「${m.decode(out)}」 — 원본과 다르다`);
        }
        if (!out.frames.length) bad(`등록부 ${m.id} ${p.id}: 장이 하나도 없다`);
        // 마지막 장의 말이 비어 있으면 화면 아래가 빈 채로 끝난다
        if (!out.frames[out.frames.length - 1].say) bad(`등록부 ${m.id} ${p.id}: 마지막 장에 할 말이 없다`);
    }
}

/* **어느 한 방법이 모든 프리셋에서 이기면 안 된다.**
   그러면 학생이 「그럼 그것만 쓰면 되잖아」로 끝내고, 「방법마다 잘 줄이는 글이 다르다」는
   이 화면의 결론이 통째로 사라진다. 그리고 **방법마다 이기는 판이 하나는 있어야 한다** —
   한 번도 못 이기는 방법을 굳이 화면에 둘 까닭이 없다. */
{
    const 이긴수 = new Map(COMPRESS_METHODS.map((m) => [m.id, 0]));
    for (const p of COMPRESS_PRESETS) {
        const 점수 = COMPRESS_METHODS.map((m) => {
            const out = m.run(p.text);
            return {id: m.id, rate: compressRate(out.beforeBits, out.bodyBits)};
        });
        const 최고 = Math.max(...점수.map((x) => x.rate));
        for (const x of 점수) if (x.rate === 최고) 이긴수.set(x.id, 이긴수.get(x.id) + 1);
    }
    for (const [id, n] of 이긴수) {
        if (n === 0) bad(`프리셋: ${id}가 한 회차도 못 이긴다 — 화면에 둘 까닭이 없어진다`);
        if (n === COMPRESS_PRESETS.length) {
            bad(`프리셋: ${id}가 ${n}판을 다 이긴다 — 「방법마다 잘 줄이는 글이 다르다」가 안 보인다`);
        }
    }
    console.log('  프리셋에서 이긴 판 — '
        + [...이긴수].map(([id, n]) => `${id} ${n}`).join(' · ')
        + ` (모두 ${COMPRESS_PRESETS.length}판)`);
}

/* ================================================================
   화면 — **페이지를 원문 그대로 돌려 «화면에 찍힌 글자»를 읽는다**
   ================================================================ */

/* 위의 검사는 전부 모듈을 곧바로 불렀다. 그런데 학생이 보는 것은 화면이고,
   그 사이에는 등록부와 그리는 코드가 한 겹 더 있다. **거기서 어긋나면 값은 맞는데
   화면만 틀린다** — 실제로 그런 결함을 여러 번 만났다.

   받침대의 DOM 은 진짜가 아니라 개수에 기대는 판정은 할 수 없다.
   그래서 **찍힌 글자**만 본다. */
{
    const {loadSim} = await import('../tools/_sim-harness.mjs');
    const sim = loadSim('cs/compress');
    /* **`DOMContentLoaded`를 손수 보내야 한다.** 진입점은 그때 화면을 채우므로,
       이것을 빼먹으면 아무것도 안 그려진 화면을 읽고 「다 틀렸다」가 열두 줄 나온다. */
    sim.lifecycle();

    if (sim.errors.length) bad(`화면: 뜨는 동안 오류가 났다 — ${sim.errors[0]}`);

    const 글자 = (id) => String(sim.el(id).textContent ?? '');
    const 속 = (id) => String(sim.el(id).innerHTML ?? '');

    /* **첫 화면은 «첫 장»이다.** 재생기가 처음에 0번 장을 그리므로 압축 후가 0비트이고
       압축률이 100%로 나온다 — 아직 아무것도 안 내놓았으니 맞는 값이다.
       끝 값을 보려면 «끝으로» 버튼을 눌러야 한다. 누르는 김에 재생기도 함께 밟힌다. */
    sim.el('btn-last').click();

    const 첫글 = COMPRESS_PRESETS[0].text;
    const 첫방법 = COMPRESS_METHODS[0];
    const 참 = 첫방법.run(첫글);

    // 단계 표시가 끝에 가 있는가 — 위의 클릭이 정말 먹었는지부터 본다
    if (!글자('step-label').startsWith(`${참.frames.length} / ${참.frames.length}`)) {
        bad(`화면: 「끝으로」를 눌렀는데 단계가 「${글자('step-label')}」다`);
    }

    if (글자('count-before') !== String(참.beforeBits)) {
        bad(`화면: 압축 전이 「${글자('count-before')}」인데 ${참.beforeBits}여야 한다`);
    }
    if (글자('count-body') !== String(참.bodyBits)) {
        bad(`화면: 압축 후가 「${글자('count-body')}」인데 ${참.bodyBits}여야 한다`);
    }
    const 참압축률 = `${compressRate(참.beforeBits, 참.bodyBits)}%`;
    if (글자('count-rate') !== 참압축률) {
        bad(`화면: 압축률이 「${글자('count-rate')}」인데 ${참압축률}여야 한다`);
    }
    if (글자('count-table') !== String(참.tableBits)) {
        bad(`화면: 표 크기가 「${글자('count-table')}」인데 ${참.tableBits}여야 한다`);
    }

    // 글자 칸이 글자 수만큼 있는가
    const 칸수 = (속('glyph-row').match(/class="glyph/g) || []).length;
    if (칸수 !== 첫글.length) bad(`화면: 글자 칸이 ${칸수}개인데 글은 ${첫글.length}자다`);

    // 나란히 비교 표에 세 방법이 다 있고 숫자가 맞는가
    const 표 = 속('race-table');
    for (const m of COMPRESS_METHODS) {
        if (!표.includes(m.name)) bad(`화면: 나란히 표에 「${m.name}」 줄이 없다`);
        const out = m.run(첫글);
        if (!표.includes(`${out.bodyBits}비트`)) {
            bad(`화면: 나란히 표에 ${m.name}의 ${out.bodyBits}비트가 없다`);
        }
    }
    for (const 글 of ['undefined', 'NaN', 'null', '[object Object]']) {
        if (표.includes(글)) bad(`화면: 나란히 표에 ${글}이 찍혔다`);
        if (속('say').includes(글)) bad(`화면: 안내 문장에 ${글}이 찍혔다`);
    }

    // 「화면 읽는 법」이 비어 있지 않은가 — 압축률에서 무엇을 뺐는지 밝히는 자리다
    const 읽는법 = 속('read-notes');
    if (!읽는법.includes('압축률은 본문만으로')) {
        bad('화면: 「압축률은 본문만으로 낸다」가 읽는 법에 없다 — 코드표가 공짜로 읽힌다');
    }

    /* **가짜로 때운 것을 반드시 밝힌다.** `tree-view.js`는 d3를 얹을 수가 없어 빈 껍데기다.
       그러니 **허프만 트리가 화면에 어떻게 그려지는지는 여기서 못 본다** — 이 검사가
       보증하는 것은 「트리를 그리려다 죽지는 않는다」와 숫자·표·글자 칸까지다. */
    const 때운것 = (sim.stubbed || []).join(', ') || '없음';
    /* **탭과 프리셋을 진짜로 누른다.**
       페이지는 `e.target.closest('[data-method]')`로 위임해 받는다. 받침대가 손으로 만든
       가짜 DOM 이던 동안에는 `closest()`가 늘 `null`이라 **클릭이 통째로 무시되어**,
       이 검사가 «첫 방법 + 첫 프리셋» 한 회차만 밟았다 — 허프만 그리는 길에 `throw`를
       심어도 초록이었다. 받침대를 jsdom 으로 갈아 끼운 뒤로는 **그냥 누르면 된다.** */
    const 위임클릭 = (host, attr, value) => {
        const b = sim.doc.querySelector(`[${attr}="${value}"]`);
        if (!b) return bad(`화면: [${attr}="${value}"] 버튼이 없다`);
        b.click();
    };

    let 밟은판 = 0;
    for (const m of COMPRESS_METHODS) {
        위임클릭('method-tabs', 'data-method', m.id);
        for (const p of COMPRESS_PRESETS) {
            위임클릭('preset-host', 'data-preset', p.id);
            sim.el('btn-last').click();
            밟은판++;

            const 참판 = m.run(p.text);
            const 어디 = `화면 ${m.id}/${p.id}`;
            if (글자('count-body') !== String(참판.bodyBits)) {
                bad(`${어디}: 압축 후가 「${글자('count-body')}」인데 ${참판.bodyBits}여야 한다`);
            }
            if (글자('count-before') !== String(참판.beforeBits)) {
                bad(`${어디}: 압축 전이 「${글자('count-before')}」인데 ${참판.beforeBits}여야 한다`);
            }
            /* **덤의 이름은 여기 따로 적어 둔다.** `sideNameOf`로 물어보고 그 답과 대 보면
               같은 코드로 두 번 세는 셈이라, 그 함수를 「엉터리」로 바꿔도 검사가 초록이었다. */
            const 이름 = ({rle: null, huffman: '코드표', keyword: '사전'})[m.id];
            if (이름 !== sideNameOf(m.id)) {
                bad(`화면 ${m.id}: 덤 이름이 「${sideNameOf(m.id)}」인데 ${이름 ?? '없음'}이어야 한다`);
            }
            if (이름 && 글자('count-table') !== String(참판.tableBits)) {
                bad(`${어디}: ${이름}가 「${글자('count-table')}」인데 ${참판.tableBits}여야 한다`);
            }
            if (이름 && 글자('aside-name') !== 이름) {
                bad(`${어디}: 덤의 이름이 「${글자('aside-name')}」인데 ${이름}여야 한다`);
            }
            for (const 글 of ['undefined', 'NaN', 'null', '[object Object]']) {
                if (속('say').includes(글)) bad(`${어디}: 안내 문장에 ${글}이 찍혔다 — ${속('say')}`);
                if (속('read-notes').includes(글)) bad(`${어디}: 읽는 법에 ${글}이 찍혔다`);
            }
            // 프리셋 안내가 실제로 갈리는가
            if (!속('preset-hint').length) bad(`${어디}: 프리셋 안내가 비어 있다`);

            /* **「가장 많이 줄임」 표시가 가장 많이 줄인 줄에만 붙는가.** 늘어난 판에서는 붙지 않는다. */
            const 줄들 = [...sim.doc.querySelectorAll('#race-table tbody tr')];
            const 률들 = COMPRESS_METHODS.map((mm) => {
                const o = mm.run(p.text);
                return compressRate(o.beforeBits, o.bodyBits);
            });
            const 최고률 = Math.max(...률들);
            줄들.forEach((tr, k) => {
                const 붙음 = tr.textContent.includes('가장 많이 줄임');
                const 붙어야 = 률들[k] === 최고률 && 최고률 > 0;
                if (붙음 !== 붙어야) {
                    bad(`${어디}: ${COMPRESS_METHODS[k].id} 줄(${률들[k]}%)에 「가장 많이 줄임」이 ${붙음 ? '붙었다' : '없다'}`);
                }
            });

            /* **그린 트리의 0·1을 따라가면 코드표와 같은 코드가 나와야 한다.**
               트리 뷰는 진짜 d3 로 그려지므로, 간선 글자에 매인 데이터를 거슬러 올라가 읽는다. */
            if (m.id === 'huffman') {
                const 간선 = new Map();
                for (const el of sim.doc.querySelectorAll('#tree-host .tv-edge-label')) {
                    const d = el.__data__;
                    if (d && d.target) 간선.set(d.target, el.textContent);
                }
                const 참코드 = 따로허프만(p.text);
                const 읽은 = {};
                for (const 대상 of 간선.keys()) {
                    if (대상.children && 대상.children.length) continue;
                    let 코드 = '';
                    for (let nd = 대상; nd && 간선.has(nd); nd = nd.parent) 코드 = 간선.get(nd) + 코드;
                    읽은[대상.data.ch] = 코드;
                }
                // 글자가 한 가지뿐이면 간선이 없다 — 그림에서 읽을 코드가 없는 것이 맞다
                if (Object.keys(참코드).length > 1) {
                    for (const [ch, want] of Object.entries(참코드)) {
                        if (읽은[ch] !== want) {
                            bad(`${어디}: 그린 트리에서 ${ch}를 따라가면 ${읽은[ch]}인데 ${want}여야 한다`);
                            break;
                        }
                    }
                }
            }
        }
    }
    if (sim.errors.length) bad(`화면: 탭·프리셋을 누르는 동안 오류가 났다 — ${sim.errors[0]}`);

    /* **직접 적어 넣는 길.** 프리셋은 모두 어느 방법이든 하나는 줄이므로, 「아무도 못 줄이는
       글」에서 표시가 빠지는지는 적어 넣어야 밟힌다. 틀린 입력은 막고 앞 글을 그대로 둔다. */
    const 넣기 = (v) => { sim.el('text-input').value = v; sim.el('btn-apply').click(); };
    넣기('ab');
    if (sim.el('text-input').value !== 'AB') bad(`입력: 소문자를 대문자로 바꾸지 않았다 — 「${sim.el('text-input').value}」`);
    if (속('race-table').includes('가장 많이 줄임')) bad('입력 AB: 아무 방법도 못 줄였는데 「가장 많이 줄임」이 붙었다');
    for (const [틀린, 까닭] of [['', '빈 글'], ['A1B', '숫자'], ['가나', '한글'], ['A'.repeat(COMPRESS_MAX_LEN + 1), '천장 넘김']]) {
        넣기(틀린);
        if (!글자('input-error').trim()) bad(`입력 ${까닭}: 막았다는 말이 없다`);
        if (sim.el('text-input').value !== 틀린 && 틀린 !== '') {
            // 틀린 글은 입력 칸에 그대로 남아 고칠 수 있어야 한다
            bad(`입력 ${까닭}: 입력 칸이 「${sim.el('text-input').value}」로 바뀌었다`);
        }
    }
    넣기('A'.repeat(COMPRESS_MAX_LEN));
    if (글자('input-error').trim()) bad(`입력 ${COMPRESS_MAX_LEN}자: 천장과 같은데 막았다 — ${글자('input-error')}`);
    if (sim.errors.length) bad(`화면: 적어 넣는 동안 오류가 났다 — ${sim.errors[0]}`);

    console.log(`  화면 — 방법 ${COMPRESS_METHODS.length} × 프리셋 ${COMPRESS_PRESETS.length}`
        + ` = ${밟은판}판을 눌러 봤다. 가짜로 때운 것: ${때운것}`
        + (때운것 === '없음' ? '' : ' (트리 «그림»은 이 검사가 보지 못한다)'));
}

console.log(`글 ${글감.length}개를 세 방법으로 돌렸다`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
test('compress', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
