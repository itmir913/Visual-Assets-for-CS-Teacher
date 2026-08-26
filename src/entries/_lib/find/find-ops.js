/* 찾는 방법마다 한 회차가 어떻게 흘러가는가.
 *
 * **연산은 화면을 모른다.** 기록기에 부탁만 하고, 그 부탁이 스냅샷으로 쌓인다.
 * 돌려주는 문자열은 회차가 끝났을 때 아래에 뜨는 «맺음말»이다.
 *
 * **비용은 함수로 적어 둔다**(`cost`). 상태를 받는 함수인 데 뜻이 있다 —
 * 같은 「찾기」라도 자료가 정렬되어 있느냐, 칸이 얼마나 찼느냐에 따라 비용이 갈리고,
 * 그 갈림이 이 페이지가 가르칠 것이기 때문이다. 검사(`tools/check_find.mjs`)가
 * 개수를 키워 가며 실제 작업량이 여기 적은 대로 자라는지 본다.
 */

import {TOMB, findHash} from './find-model.js';
import {withJosa} from '../josa.js';

/** 값의 범위. 해시 계산을 학생이 암산할 수 있는 크기로 묶어 둔다. */
export const FIND_VALUE_MAX = 99;

/* ---------------------------------------------------------------
   비용 — 검사가 읽는다
   --------------------------------------------------------------- */

const O1 = {big: 'O(1)', of: () => 1};
const ON = {big: 'O(n)', of: (st) => st.size};
const OLOG = {big: 'O(log n)', of: (st) => Math.max(1, Math.ceil(Math.log2(st.size + 1)))};

/* ---------------------------------------------------------------
   순차 탐색
   --------------------------------------------------------------- */

/** 앞에서부터 하나씩 비교한다. **자료에 아무 조건도 걸지 않는다** — 이것이 값이다. */
function seqFind(rec, v) {
    rec.clearFlag();
    if (rec.size === 0) {
        rec.flag('비어 있어 찾을 것이 없습니다.');
        rec.mark('empty');
        return '비어 있어 아무 일도 하지 않았습니다.';
    }
    rec.say(`${withJosa(v, '을를')} 앞에서부터 하나씩 비교합니다.`);
    rec.mark('start');

    for (let i = 0; i < rec.size; i++) {
        rec.cursor('i', i);
        /* **두 수를 반드시 갈라 놓는다.** `${앞값}${찾는값}`으로 이어 붙이면 3과 41이
           「341」이라는 없는 수가 되어, 「비교한다」를 가르치는 자리에서 대상이 사라진다. */
        rec.say(`${i}번을 봅니다. ${withJosa(rec.peek(i).v, '은는')} ${v}입니까?`);
        if (rec.probe(i, v) === 0) {
            rec.cursor('i', null);
            return `${i}번에서 찾았습니다. **${i + 1}번 비교했습니다.**`;
        }
    }
    rec.cursor('i', null);
    return `${withJosa(v, '은는')} 없습니다. **끝까지 ${rec.size}번 비교했습니다** — `
        + '없다는 것을 알려면 하나도 빠뜨리지 않고 다 봐야 합니다.';
}

/* ---------------------------------------------------------------
   이진 탐색
   --------------------------------------------------------------- */

/**
 * 가운데를 확인하고 반을 버린다.
 *
 * **정렬되어 있지 않으면 못 찾는다.** 그런데 이 코드는 그것을 «검사하지 않는다» —
 * 일부러 그렇게 두었다. 흐트러진 자료에서 있는 값을 놓치는 장면을 학생이 직접 보는 것이
 * 「정렬이 전제다」라는 문장을 백 번 읽는 것보다 낫다. 대신 **놓쳤을 때 그 까닭을 말해 준다.**
 */
function binFind(rec, v) {
    rec.clearFlag();
    if (rec.size === 0) {
        rec.flag('비어 있어 찾을 것이 없습니다.');
        rec.mark('empty');
        return '비어 있어 아무 일도 하지 않았습니다.';
    }

    let lo = 0;
    let hi = rec.size - 1;
    rec.say(`${withJosa(v, '을를')} 찾습니다. **볼 곳은 아직 ${rec.size}칸 전부입니다.**`);
    rec.cursor('lo', lo);
    rec.cursor('hi', hi);
    rec.mark('start');

    let looked = 0;
    while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        rec.cursor('mid', mid);
        rec.say(`남은 ${hi - lo + 1}칸의 가운데는 ${mid}번입니다. `
            + `${withJosa(rec.peek(mid).v, '은는')} ${v}입니까?`);
        const cmp = rec.probe(mid, v);
        looked += 1;

        if (cmp === 0) {
            rec.clearCursors();
            return `${mid}번에서 찾았습니다. **${looked}번 비교했습니다.**`;
        }
        if (cmp < 0) {
            rec.say(`${withJosa(rec.peek(mid).v, '이가')} ${v}보다 작으니 **${mid}번까지는 볼 것 없습니다.**`);
            rec.ruleOut(lo, mid);
            lo = mid + 1;
        } else {
            rec.say(`${withJosa(rec.peek(mid).v, '이가')} ${v}보다 크니 **${mid}번부터 뒤는 볼 것 없습니다.**`);
            rec.ruleOut(mid, hi);
            hi = mid - 1;
        }
        rec.cursor('lo', lo <= hi ? lo : null);
        rec.cursor('hi', lo <= hi ? hi : null);
        rec.cursor('mid', null);
    }

    rec.clearCursors();
    /* **있는데 못 찾았는지 살펴 말해 준다.** 흐트러진 자료에서 이 자리에 오는 것이
       이 탭의 가르칠 거리다 — 아무 말 없이 「없습니다」로 끝내면 학생은
       시뮬레이터가 고장 났다고 여긴다. */
    const reallyThere = rec.state.slots.some((it) => it && it.v === v);
    if (reallyThere) {
        rec.flag(`${withJosa(v, '은는')} 분명히 들어 있는데 못 찾았습니다. `
            + '이진 탐색은 **정렬되어 있다는 것을 믿고** 반을 버립니다 — '
            + '그 전제가 깨지면 버린 쪽에 답이 남습니다.');
        return `${withJosa(v, '을를')} 놓쳤습니다. **${looked}번 만에 볼 곳이 없어졌습니다.**`;
    }
    return `${withJosa(v, '은는')} 없습니다. **${looked}번 만에 볼 곳이 없어졌습니다** — `
        + '한 번 볼 때마다 남은 칸이 반으로 줄기 때문입니다.';
}

/* ---------------------------------------------------------------
   해시 — 체이닝
   --------------------------------------------------------------- */

/** 사슬을 순회하며 값을 찾는다. 찾으면 그 자리, 없으면 -1. */
function walkChain(rec, at, v) {
    const chain = rec.state.buckets[at];
    for (let k = 0; k < chain.length; k++) {
        rec.say(`${at}번 칸 리스트의 ${k + 1}번째는 ${chain[k].v}입니다. ${v}입니까?`);
        if (rec.test(at, v, k)) return k;
    }
    return -1;
}

function chainPut(rec, v) {
    rec.clearFlag();
    rec.say(`${withJosa(v, '을를')} ${withJosa(rec.cap, '으로')} 나눈 나머지를 구합니다.`);
    const at = rec.hashOf(v);
    rec.say(`${at}번 칸으로 갑니다. **어디로 갈지 «보지 않고 계산해서» 정했습니다.**`);
    rec.visit(at);

    if (walkChain(rec, at, v) >= 0) {
        rec.flag(`${withJosa(v, '은는')} 이미 들어 있습니다. 이 시뮬레이터는 같은 값을 두 번 넣지 않습니다.`);
        return '이미 들어 있어 넣지 않았습니다.';
    }
    const before = rec.state.buckets[at].length;
    rec.say(`${at}번 칸의 리스트 끝에 연결합니다.`);
    rec.place(at, v, before);
    return before > 0
        ? `${withJosa(v, '을를')} ${at}번에 넣었습니다. **이미 있던 ${before}개 뒤에 연결했습니다** — 충돌입니다.`
        : `${withJosa(v, '을를')} ${at}번에 넣었습니다. **그 칸은 비어 있었습니다.**`;
}

function chainFind(rec, v) {
    rec.clearFlag();
    rec.say(`${withJosa(v, '을를')} ${withJosa(rec.cap, '으로')} 나눈 나머지를 구합니다.`);
    const at = rec.hashOf(v);
    rec.say(`${at}번 칸만 봅니다. **다른 칸은 볼 까닭이 없습니다.**`);
    rec.visit(at);

    const k = walkChain(rec, at, v);
    const len = rec.state.buckets[at].length;
    if (k >= 0) {
        return `${at}번 칸 리스트의 ${k + 1}번째에서 찾았습니다. `
            + `**계산 한 번에 비교 ${k + 1}번입니다.**`;
    }
    if (len === 0) {
        return `${withJosa(v, '은는')} 없습니다. **${at}번 칸이 비어 있으니 그것으로 끝입니다** — `
            + '없다는 것을 알아내는 데도 계산 한 번뿐입니다.';
    }
    return `${withJosa(v, '은는')} 없습니다. ${at}번 칸 리스트의 ${len}개를 다 보았습니다 — `
        + '**다른 칸은 보지 않고 그 칸의 리스트만 봅니다.**';
}

function chainRemove(rec, v) {
    rec.clearFlag();
    rec.say(`${withJosa(v, '을를')} ${withJosa(rec.cap, '으로')} 나눈 나머지를 구합니다.`);
    const at = rec.hashOf(v);
    rec.visit(at);
    const k = walkChain(rec, at, v);
    if (k < 0) {
        rec.flag(`${withJosa(v, '은는')} 들어 있지 않습니다.`);
        return '없어서 아무것도 빼지 않았습니다.';
    }
    rec.say(`${at}번 칸 리스트에서 ${withJosa(v, '을를')} 제거합니다.`);
    rec.erase(at, k);
    return `${withJosa(v, '을를')} 뺐습니다. **리스트에서 하나만 제거하면 끝입니다** — `
        + '뒤에 있는 원소를 당길 일이 없습니다.';
}

/* ---------------------------------------------------------------
   해시 — 개방 주소법(선형 탐사)
   --------------------------------------------------------------- */

function openPut(rec, v) {
    rec.clearFlag();
    rec.say(`${withJosa(v, '을를')} ${withJosa(rec.cap, '으로')} 나눈 나머지를 구합니다.`);
    const home = rec.hashOf(v);

    /* **먼저 있는지 본다.** 빈 칸을 찾자마자 넣으면 묘비 뒤에 같은 값이 또 들어간다. */
    let tombAt = -1;
    for (let k = 0; k < rec.cap; k++) {
        const at = (home + k) % rec.cap;
        rec.say(k === 0 ? `${at}번 칸을 봅니다.` : `${at}번 칸으로 **한 칸 옆으로 밀어** 봅니다.`);
        const cell = rec.visit(at);
        if (cell === null) {
            /* **앉을 자리는 「지금 본 칸」이 아니라 「지나온 첫 묘비」다.** 묘비를 다시 쓰는
               것이 개방 주소법이 자리를 되찾는 유일한 길이므로 그렇게 하는데, 그러면
               «들여다본 칸 수»와 «밀려난 칸 수»가 갈린다 — 맺음말에서 그 둘을 섞으면
               묘비 자리에 그대로 앉은 값을 두고 「여덟 칸 밀렸다」고 하게 된다. */
            const spot = tombAt >= 0 ? tombAt : at;
            const dist = (spot - home + rec.cap) % rec.cap;
            const looked = k + 1;
            rec.say(tombAt >= 0
                ? `${spot}번 묘비 자리를 되씁니다.`
                : `${spot}번이 비었으니 여기에 씁니다.`);
            rec.place(spot, v);

            const head = dist > 0
                ? `${withJosa(v, '을를')} ${spot}번에 넣었습니다. `
                  + `**계산한 자리(${home}번)에서 ${dist}칸 밀렸습니다** — 충돌입니다.`
                : `${withJosa(v, '을를')} 계산한 자리 그대로 ${spot}번에 넣었습니다.`;
            /* 묘비를 지나쳐 왔으면 «앉은 자리»보다 «살펴본 칸»이 많다. 그 차이가
               「묘비가 쌓이면 느려진다」는 이야기의 알맹이라 숨기지 않고 적는다. */
            return looked > dist + 1
                ? `${head} 같은 값이 뒤에 있는지 보느라 ${looked}칸을 살폈습니다 — `
                  + '**묘비를 지나칠 때는 멈출 수가 없습니다.**'
                : head;
        }
        if (cell === TOMB) {
            if (tombAt < 0) tombAt = at;
            rec.say(`${at}번은 **묘비**입니다. 쓸 수는 있지만 **찾기가 여기서 멈추면 안 되므로** 계속 봅니다.`);
            rec.mark('tomb');
            continue;
        }
        if (rec.test(at, v)) {
            rec.flag(`${withJosa(v, '은는')} 이미 들어 있습니다. 이 시뮬레이터는 같은 값을 두 번 넣지 않습니다.`);
            return '이미 들어 있어 넣지 않았습니다.';
        }
    }

    if (tombAt >= 0) {
        rec.place(tombAt, v);
        return `${withJosa(v, '을를')} 묘비 자리인 ${tombAt}번에 넣었습니다.`;
    }
    rec.flag(`칸 ${rec.cap}개가 모두 찼습니다. 개방 주소법은 **칸 안에서만** 자리를 찾으므로 `
        + '더 넣으려면 더 큰 표를 새로 만들어 전부 다시 계산해 옮겨야 합니다.');
    return '꽉 차서 넣지 못했습니다.';
}

function openFind(rec, v) {
    rec.clearFlag();
    rec.say(`${withJosa(v, '을를')} ${withJosa(rec.cap, '으로')} 나눈 나머지를 구합니다.`);
    const home = rec.hashOf(v);

    for (let k = 0; k < rec.cap; k++) {
        const at = (home + k) % rec.cap;
        rec.say(k === 0 ? `${at}번 칸을 봅니다.` : `${at}번 칸으로 **한 칸 옆으로 밀어** 봅니다.`);
        const cell = rec.visit(at);
        if (cell === null) {
            return `${withJosa(v, '은는')} 없습니다. **${at}번이 비어 있으므로 더 볼 것도 없습니다** — `
                + '넣을 때도 빈 칸에서 멈췄을 테니까요.';
        }
        if (cell === TOMB) {
            rec.say(`${at}번은 묘비입니다. **여기서 멈추면 안 됩니다** — 뒤에 밀려난 값이 있을 수 있습니다.`);
            rec.mark('tomb');
            continue;
        }
        rec.say(`${withJosa(cell.v, '은는')} ${v}입니까?`);
        if (rec.test(at, v)) {
            return k > 0
                ? `${at}번에서 찾았습니다. **계산한 자리에서 ${k}칸 밀린 곳입니다.**`
                : `${at}번에서 찾았습니다. **계산한 자리에 바로 있었습니다.**`;
        }
    }
    return `${withJosa(v, '은는')} 없습니다. 칸을 한 바퀴 다 돌았습니다.`;
}

function openRemove(rec, v) {
    rec.clearFlag();
    rec.say(`${withJosa(v, '을를')} ${withJosa(rec.cap, '으로')} 나눈 나머지를 구합니다.`);
    const home = rec.hashOf(v);

    for (let k = 0; k < rec.cap; k++) {
        const at = (home + k) % rec.cap;
        rec.say(k === 0 ? `${at}번 칸을 봅니다.` : `${at}번 칸으로 **한 칸 옆으로 밀어** 봅니다.`);
        const cell = rec.visit(at);
        if (cell === null) break;
        if (cell === TOMB) {
            rec.say(`${at}번은 묘비입니다. 지나칩니다.`);
            rec.mark('tomb');
            continue;
        }
        rec.say(`${withJosa(cell.v, '은는')} ${v}입니까?`);
        if (rec.test(at, v)) {
            /* **그냥 비우면 안 된다.** 이 칸을 넘어 밀려난 값이 뒤에 있으면, 빈 칸을 만난
               찾기가 거기서 멈춰 «있는 값을 없다»고 하게 된다. 그래서 묘비를 세운다. */
            rec.say(`${withJosa(v, '을를')} 지우고 **묘비를 세웁니다.**`);
            rec.erase(at, null, true);
            return `${withJosa(v, '을를')} 뺐습니다. **빈 칸이 아니라 묘비를 남겼습니다** — `
                + '이 칸을 넘어 밀려난 값이 뒤에 있을 수 있기 때문입니다.';
        }
    }
    rec.flag(`${withJosa(v, '은는')} 들어 있지 않습니다.`);
    return '없어서 아무것도 빼지 않았습니다.';
}

/* ---------------------------------------------------------------
   내보내기 — 등록부가 읽는다
   --------------------------------------------------------------- */

export const FIND_SEQ_OPS = [
    {id: 'seq-find', name: '찾기', arg: 'value', cost: ON, run: seqFind},
];

export const FIND_BIN_OPS = [
    {id: 'bin-find', name: '찾기', arg: 'value', cost: OLOG, run: binFind},
];

export const FIND_CHAIN_OPS = [
    {id: 'hash-put', name: '넣기', arg: 'value', cost: O1, run: chainPut},
    {id: 'hash-find', name: '찾기', arg: 'value', cost: O1, run: chainFind},
    {id: 'hash-remove', name: '빼기', arg: 'value', cost: O1, run: chainRemove},
];

export const FIND_OPEN_OPS = [
    {id: 'hash-put', name: '넣기', arg: 'value', cost: O1, run: openPut},
    {id: 'hash-find', name: '찾기', arg: 'value', cost: O1, run: openFind},
    {id: 'hash-remove', name: '빼기', arg: 'value', cost: O1, run: openRemove},
];

/** 나란히 비교가 쓰는 「찾기」 셋. **같은 값을 셋에 한꺼번에 물린다.** */
export const FIND_RACE_OPS = {
    seq: FIND_SEQ_OPS[0],
    bin: FIND_BIN_OPS[0],
    hash: FIND_CHAIN_OPS[1],
};

export {findHash};
