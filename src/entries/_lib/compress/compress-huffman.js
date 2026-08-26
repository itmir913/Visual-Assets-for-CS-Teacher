/* 허프만 코딩 — **자주 나오는 글자에 짧은 코드**를 준다.
 *
 * 앞의 둘과 줄이는 자리가 다르다. 런 렝스와 키워드는 **되풀이되는 «덩어리»**를 줄이는데,
 * 허프만은 덩어리를 보지 않고 **글자 하나하나의 «길이»**를 손본다. 그래서 반복이 하나도
 * 없는 글에서도 줄어들 수 있다 — 대신 **횟수가 고르면 하나도 못 줄인다.**
 *
 * ---------------------------------------------------------------
 * **못 줄이는 판을 감추지 않는다**
 * ---------------------------------------------------------------
 *
 * `ABABABABAB`은 A와 B가 다섯 번씩이다. 나무를 지어 보면 둘 다 한 비트를 받아
 * **압축률이 0%**로 나온다. 고장처럼 보이지만 이것이 허프만의 성질이다 —
 * 짧은 코드를 줄 «자주 나오는 글자»가 있어야 이득이 생긴다.
 *
 * 강의노트가 바로 그 글을 두고 「세 방법 가운데 무엇으로 줄일 수 있을까」를 묻는다.
 * 답은 허프만이 아니라 **키워드 인코딩**이고, 학생이 그것을 여기서 눌러 확인할 수 있어야
 * 그 물음이 닫힌다 → `compress-keyword.js`
 *
 * ---------------------------------------------------------------
 * **같은 글은 언제나 같은 나무가 되어야 한다**
 * ---------------------------------------------------------------
 *
 * 가장 작은 둘을 고를 때 값이 같으면 어느 쪽을 집어도 «압축된 길이»는 같다. 그런데
 * 나무 «모양»은 달라진다. 학생이 두 번 돌려 다른 그림을 보면 그것부터 물어보게 되고,
 * 화면에 적어 둔 설명도 어긋난다. 그래서 동점은 **먼저 만들어진 것부터**로 못박는다
 * (`seq`가 그 차례다). 무작위도, 정렬 알고리즘의 안정성에 기대는 것도 아니다.
 */

import {createCompressRecorder, frequencies} from './compress-model.js';
import {josa} from '../josa.js';

/** 나무 한 마디. 잎은 `ch`를 들고, 속마디는 `left`·`right`를 든다. */
function leaf(ch, n, seq) {
    return {ch, n, seq, left: null, right: null};
}

/**
 * 둘을 묶는다. **자주 나오는 쪽을 왼쪽에 둔다.**
 *
 * 어느 쪽을 왼쪽에 두든 코드 «길이»는 같으므로 압축된 크기는 달라지지 않는다.
 * 그런데 **글자에 붙는 코드가 달라진다** — 3번 나온 C가 `10`이 되기도 하고 `11`이
 * 되기도 한다. 강의노트가 든 예에서 C는 `10`이다.
 * **같은 글을 두 자리에서 보는데 코드가 다르면 학생은 어느 쪽을 믿을지 알 수 없다.**
 *
 * 「자주 나오는 쪽이 왼쪽」이라는 규칙 하나로 그 어긋남이 사라지고,
 * 나무를 읽는 방향(왼쪽이 0)과도 결이 맞는다 — **왼쪽으로 갈수록 자주 나오는 글자다.**
 * 값이 같으면 먼저 만들어진 쪽이 왼쪽이다.
 */
function join(a, b, seq) {
    const [왼, 오] = (b.n > a.n) || (b.n === a.n && b.seq < a.seq) ? [b, a] : [a, b];
    return {ch: null, n: a.n + b.n, seq, left: 왼, right: 오};
}

/**
 * 숲에서 **가장 작은 둘**을 꺼낸다. 동점이면 먼저 만들어진 것부터.
 * @returns {[object, object]} 꺼낸 둘. 작은 쪽이 앞이다.
 */
function pickTwo(forest) {
    const order = [...forest].sort((x, y) => (x.n - y.n) || (x.seq - y.seq));
    return [order[0], order[1]];
}

/** 나무에서 코드표를 읽어 낸다. 왼쪽이 0, 오른쪽이 1. */
export function codesOf(root) {
    const codes = new Map();
    if (!root) return codes;
    /* **잎이 하나뿐인 나무**는 길을 걸을 수가 없어 코드가 빈 문자열이 된다.
       그러면 「AAAA」가 0비트가 되어 되살릴 수 없다. 한 비트를 준다. */
    if (!root.left && !root.right) {
        codes.set(root.ch, '0');
        return codes;
    }
    (function walk(nd, path) {
        if (!nd) return;
        if (!nd.left && !nd.right) { codes.set(nd.ch, path); return; }
        walk(nd.left, path + '0');
        walk(nd.right, path + '1');
    })(root, '');
    return codes;
}

/** 나무만 짓는다. 화면 없이 값을 얻을 때 쓴다 — 검사와 나란히 놓기가 이것을 부른다. */
export function huffmanTree(text) {
    const freq = frequencies(text);
    if (!freq.length) return null;
    let seq = 0;
    let forest = freq.map((f) => leaf(f.ch, f.n, seq++));
    while (forest.length > 1) {
        const [a, b] = pickTwo(forest);
        const merged = join(a, b, seq++);
        forest = forest.filter((t) => t !== a && t !== b);
        forest.push(merged);
    }
    return forest[0];
}

/**
 * 코드표를 함께 보내는 데 드는 비트.
 *
 * **압축률에는 넣지 않는다.** 까닭은 `compress-model.js` 머리주석에 적어 두었다.
 *
 * **알맹이만 센다** — 글자마다 「그 글자 + 그 코드」다. 줄을 어디서 끊는지 표시하는 데도
 * 자리가 들지만 그것은 적는 방식에 따라 달라지는 것이라 세지 않았고, 화면에 그렇게 밝힌다.
 * 키워드 인코딩의 사전도 같은 규칙으로 센다 — **둘을 다르게 세면 나란히 놓을 수가 없다.**
 */
export function tableBitsOf(codes, width) {
    let bits = 0;
    for (const code of codes.values()) bits += width + code.length;
    return {bits};
}

export function huffmanEncode(text, opts = {}) {
    const rec = createCompressRecorder(text, opts);
    const w = rec.width;

    if (!text.length) {
        rec.say('줄일 글이 없습니다.').step('idle');
        return rec.done();
    }

    const freq = frequencies(text);
    let seq = 0;
    let forest = freq.map((f) => leaf(f.ch, f.n, seq++));

    rec.carry({forest: forest.map(cloneTree), root: null, codes: null})
        .say(`글자마다 몇 번 나왔는지를 셉니다 — `
            + freq.map((f) => `<b>${f.ch}</b> ${f.n}번`).join(' · ')
            + `. 지금은 글자마다 <b>${w}비트</b>씩 ${text.length}글자입니다.`)
        .step('count');

    while (forest.length > 1) {
        const [a, b] = pickTwo(forest);
        rec.carry({forest: forest.map(cloneTree), root: null, codes: null, picked: [a.seq, b.seq]})
            .say(`가장 작은 둘을 고릅니다 — <b>${nameOf(a)}</b>(${a.n})${josa(nameOf(a), '과와')}`
                + ` <b>${nameOf(b)}</b>(${b.n}).`)
            .step('pick');

        const merged = join(a, b, seq++);
        forest = forest.filter((t) => t !== a && t !== b);
        forest.push(merged);

        rec.carry({forest: forest.map(cloneTree), root: null, codes: null, merged: merged.seq})
            .say(`둘을 묶어 <b>${merged.n}</b>짜리 마디를 만듭니다. `
                + `왼쪽으로 가면 <b>0</b>, 오른쪽으로 가면 <b>1</b>입니다.`)
            .step('join');
    }

    const root = forest[0];
    const codes = codesOf(root);

    rec.carry({forest: [], root: cloneTree(root), codes: mapToObj(codes)})
        .say('나무가 다 지어졌습니다. 뿌리에서 잎까지 걸어가며 <b>0과 1을 주워 담으면</b> '
            + '그것이 그 글자의 코드입니다. '
            + '<b>자주 나온 글자일수록 잎이 위에 있어 코드가 짧습니다.</b>')
        .step('tree');

    const 표 = tableBitsOf(codes, w);
    for (const [ch, code] of codes) {
        rec.aside({kind: 'code', text: `${ch} → ${code}`, ch, code, bits: w + code.length});
    }
    rec.carry({forest: [], root: cloneTree(root), codes: mapToObj(codes)})
        .say(`코드표를 함께 보내야 받는 쪽이 되살릴 수 있습니다. `
            + `이 표가 <b>${표.bits}비트</b>입니다 — <b>압축률에는 넣지 않지만 없는 셈 칠 수도 없습니다.</b>`)
        .step('table');

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = codes.get(ch);
        rec.emit({kind: 'code', text: code, ch, code, bits: code.length, from: i, to: i + 1})
            .look(i)
            .say(`<b>${ch}</b>${josa(ch, '은는')} <b>${code}</b>, ${code.length}비트입니다.`)
            .step('emit');
    }

    return rec.done();
}

function nameOf(nd) {
    return nd.ch !== null ? nd.ch : `${nd.n}짜리 묶음`;
}

/** 스냅샷에 실을 사본. **참조로 실으면 다음 장이 앞 장을 고쳐 버린다** — 나무는 계속 자란다. */
function cloneTree(nd) {
    if (!nd) return null;
    return {ch: nd.ch, n: nd.n, seq: nd.seq, left: cloneTree(nd.left), right: cloneTree(nd.right)};
}

function mapToObj(m) {
    const o = {};
    for (const [k, v] of m) o[k] = v;
    return o;
}

/** 되돌리기. **나무를 걸어 내려간다** — 검사가 이것으로 원본과 대 본다. */
export function huffmanDecode(bits, root) {
    if (!root) return '';
    if (!root.left && !root.right) return root.ch.repeat(bits.length);
    let out = '';
    let nd = root;
    for (const b of bits) {
        nd = b === '0' ? nd.left : nd.right;
        if (!nd) return out;
        if (!nd.left && !nd.right) { out += nd.ch; nd = root; }
    }
    return out;
}

/** 코드가 **접두 부호**인가 — 어느 코드도 다른 코드의 앞머리가 아니어야 한다.
 *  아니면 띄어 적지 않고는 되살릴 수 없다. 나무에서 뽑은 코드는 늘 그렇지만,
 *  **그것이 참인지는 값으로 봐야 한다** → `tools/check_compress.mjs` */
export function isPrefixFree(codes) {
    const list = [...codes.values()];
    for (const a of list) {
        for (const b of list) {
            if (a !== b && b.startsWith(a)) return false;
        }
    }
    return true;
}
