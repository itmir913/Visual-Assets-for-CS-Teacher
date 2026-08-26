/* 연산 하나가 어떻게 이루어지는지 — **이 페이지가 가르치려는 것의 알맹이.**
 *
 * 자료구조를 배우는 학생이 헷갈리는 자리는 「무엇을 할 수 있는가」가 아니라
 * **「그것을 하는 데 실제로 무슨 일이 몇 번 벌어지는가」**다. 「배열은 앞에 넣기가
 * 느리다」는 말은 외울 수 있지만, **뒤에 있는 것이 하나씩 밀려나는 것을 보기 전에는**
 * 왜 느린지가 서지 않는다. 그래서 밀기 한 칸을 한 장으로 남긴다.
 *
 * **같은 이름의 연산이라도 저장 구조에 따라 하는 일이 다르다.** 그것이 이 파일이
 * 배열 쪽과 리스트 쪽을 나란히 두는 까닭이다 — 두 벌을 따로 쓰면 «다르다»가 아니라
 * 그냥 «따로»가 된다.
 *
 * 각 연산은 `{id, name, arg, run}`이고, `run`은 기록기에 부탁만 한다.
 * 돌려주는 문자열은 마지막 장에 붙는 말이다.
 */

import {dsItem} from './ds-model.js';
import {withJosa} from '../josa.js';

/** 넣는 값의 천장. 세 자리가 되면 좁은 칸에서 글자가 넘친다. */
export const DS_VALUE_MAX = 99;

/* ---------------------------------------------------------------
   칸(배열) 쪽
   --------------------------------------------------------------- */

/** 자리 `i`에 값을 넣는다. **뒤에 있는 것을 뒤에서부터 하나씩 민다.** */
function arrayInsertAt(rec, i, v) {
    if (rec.size >= rec.cap) {
        rec.flag(`칸 ${rec.cap}개가 모두 찼습니다. 배열은 **칸 수를 미리 정해 두는** 구조라`
            + ' 더 넣으려면 더 큰 배열을 새로 만들어 통째로 옮겨야 합니다.');
        rec.mark('full');
        return '꽉 차서 넣지 못했습니다.';
    }
    rec.clearFlag();
    rec.cursor('i', i);

    const pushed = rec.size - i;
    if (pushed > 0) {
        rec.say(`${i}번 자리를 비우려면 **뒤에 있는 원소 ${pushed}개를 한 칸씩 뒤로** 밀어야 합니다.`);
        for (let j = rec.size - 1; j >= i; j--) {
            rec.say(`${j}번의 ${withJosa(rec.peek(j).v, '을를')} ${j + 1}번으로 밉니다.`);
            rec.shift(j, j + 1);
        }
    }
    rec.say(`빈 ${i}번 자리에 ${withJosa(v, '을를')} 씁니다.`);
    rec.write(i, dsItem(v));
    rec.setSize(rec.size + 1);
    rec.cursor('i', null);
    return pushed > 0
        ? `${withJosa(v, '을를')} ${i}번에 넣었습니다. **밀어낸 것이 ${pushed}개**입니다.`
        : `${withJosa(v, '을를')} ${i}번에 넣었습니다. **아무것도 밀지 않았습니다.**`;
}

/** 자리 `i`의 값을 뺀다. **뒤에 있는 것을 앞에서부터 하나씩 당긴다.** */
function arrayRemoveAt(rec, i) {
    if (rec.size === 0) {
        rec.flag('비어 있어서 뺄 것이 없습니다.');
        rec.mark('empty');
        return '비어 있어 아무 일도 하지 않았습니다.';
    }
    rec.clearFlag();
    rec.cursor('i', i);

    rec.say(`${i}번 자리를 읽습니다.`);
    const gone = rec.at(i);
    rec.say(`${withJosa(gone.v, '을를')} 꺼내 그 자리를 비웁니다.`);
    rec.clear(i);

    const pulled = rec.size - 1 - i;
    if (pulled > 0) {
        rec.say(`빈 자리가 가운데 남으면 안 되므로 **뒤에 있는 원소 ${pulled}개를 한 칸씩 당깁니다.**`);
        for (let j = i + 1; j < rec.size; j++) {
            rec.say(`${j}번의 ${withJosa(rec.peek(j).v, '을를')} ${j - 1}번으로 당깁니다.`);
            rec.shift(j, j - 1);
        }
    }
    rec.setSize(rec.size - 1);
    rec.cursor('i', null);
    return pulled > 0
        ? `${withJosa(gone.v, '을를')} 뺐습니다. **당긴 것이 ${pulled}개**입니다.`
        : `${withJosa(gone.v, '을를')} 뺐습니다. **아무것도 당기지 않았습니다.**`;
}

/** 인덱스로 바로 접근한다. **몇 번째든 한 번이다.** */
function arrayReadAt(rec, i) {
    if (i >= rec.size) {
        rec.flag(`${i}번은 아직 아무것도 들어 있지 않은 자리입니다.`);
        rec.mark('empty');
        return '빈 자리라 읽을 것이 없습니다.';
    }
    rec.clearFlag();
    rec.say(`${i}번 자리에 **바로 접근합니다.** 앞에서부터 세어 갈 것 없이`
        + ' 시작 주소에 인덱스를 더하면 그 칸이 어디인지 곧바로 나옵니다.');
    const it = rec.at(i);
    return `${i}번은 ${it.v}입니다. **몇 번째를 묻든 접근은 한 번**입니다.`;
}

/** 값을 앞에서부터 찾는다. */
function arrayFind(rec, v) {
    rec.clearFlag();
    for (let i = 0; i < rec.size; i++) {
        rec.say(`${i}번과 ${withJosa(v, '을를')} 비교해 봅니다.`);
        const it = rec.at(i);
        if (it.v === v) {
            rec.cursor('i', i);
            rec.say(`${i}번에서 ${withJosa(v, '을를')} 찾았습니다.`);
            rec.mark('found');
            rec.cursor('i', null);
            return `${i}번에서 찾았습니다. **${i + 1}번 확인했습니다.**`;
        }
    }
    rec.say(`${withJosa(v, '은는')} 없습니다.`);
    rec.mark('missing');
    return `${withJosa(v, '은는')} 들어 있지 않습니다. **끝까지 ${rec.size}번 확인했습니다.**`;
}

/* **범위 밖 인덱스를 말없이 당겨 쓰지 않는다.**
 *
 * 예전에는 `Math.min(i, size - 1)`로 접어 넣었다. 그러면 4개 담긴 배열에서 「4번을 빼겠다」고
 * 말해 놓고 **3번을 빼면서** 「아무것도 당기지 않았습니다」라고 끝냈다 — 학생은 없는 자리를
 * 빼는 것이 되는 일이라고 배운다. 게다가 같은 4번을 「읽기」로 물으면 제대로 막았으니,
 * 한 페이지가 같은 인덱스를 두 가지로 다룬 셈이다.
 *
 * @param {number} last 쓸 수 있는 가장 큰 인덱스(넣기는 `size`, 읽기·빼기는 `size - 1`)
 * @returns {boolean} 범위 밖이면 `true`. 그때는 부르는 쪽이 바로 돌아간다
 */
function outOfRange(rec, i, last, what) {
    if (i <= last) return false;
    rec.flag(rec.size === 0
        ? `비어 있어서 ${what} 자리가 없습니다.`
        : `${i}번은 쓸 수 있는 자리가 아닙니다. 지금 ${what} 수 있는 자리는 **0번부터 ${last}번까지**입니다.`);
    rec.mark('out-of-range');
    return true;
}

/* ---------------------------------------------------------------
   노드(연결 리스트) 쪽
   --------------------------------------------------------------- */

/** 머리에서 `k`번째 노드까지 링크를 따라간다. 닿은 노드를 돌려준다. */
function walkTo(rec, k, name = 'p') {
    let nd = rec.nodeById(rec.head);
    if (!nd) return null;
    rec.say('head 포인터가 가리키는 첫 노드에서 출발합니다.');
    rec.walk(nd.id, name);
    for (let step = 0; step < k; step++) {
        rec.say(`링크를 따라 다음 노드로 갑니다. (${step + 1}번째 걸음)`);
        nd = rec.nodeById(nd.next);
        if (!nd) return null;
        rec.walk(nd.id, name);
    }
    return nd;
}

/** 자리 `i`의 **앞 노드**를 찾는다. tail 포인터가 있으면 맨 뒤는 따라갈 것이 없다.
 *  **여기 한 곳에서만 찾는다** — 부르는 쪽에서 미리 한 번 따라가 두면 같은 길을
 *  두 번 걷게 되어 화면의 접근 횟수가 실제의 두 배가 된다. */
function nodeBefore(rec, i) {
    if (i <= 0) return null;
    if (i >= rec.size && rec.state.hasTail) {
        rec.say('**tail 포인터**가 마지막 노드를 바로 가리킵니다. 따라갈 것이 없습니다.');
        return rec.walk(rec.tail, 'p');
    }
    if (i >= rec.size) {
        rec.say('tail 포인터가 없어 **마지막 노드가 어디인지 알 길이 없습니다.**'
            + ' 뒤에 넣는 것인데도 처음부터 끝까지 따라가야 합니다.');
    }
    return walkTo(rec, i - 1);
}

/** 노드를 자리 `i`에 끼워 넣는다. **밀리는 것이 하나도 없다.** */
function listInsertAt(rec, i, v) {
    rec.clearFlag();
    const s = rec.state;
    const before = nodeBefore(rec, i);                  // 끼울 자리의 앞 노드
    const after = before ? rec.nodeById(before.next) : rec.nodeById(rec.head);

    rec.say(`값 ${withJosa(v, '을를')} 담은 **새 노드를 만듭니다.** 아직 어디에도 연결되어 있지 않습니다.`);
    const nd = rec.newNode(v, i);

    // 새 노드가 뒤를 가리키게 먼저 건다. 앞을 먼저 끊으면 뒤쪽 노드를 놓쳐 잃어버린다.
    rec.say(after
        ? '**새 노드가 먼저 뒤 노드를 가리키게 합니다.** 앞쪽을 먼저 끊으면 뒤쪽 노드를 통째로 잃습니다.'
        : '뒤에 아무것도 없으므로 새 노드의 링크는 비워 둡니다.');
    rec.link(nd.id, after ? after.id : null, 'next');

    if (before) {
        rec.say(`${i - 1}번 노드의 링크를 새 노드로 바꿉니다. **이 한 줄이 「끼워 넣기」의 전부입니다.**`);
        rec.link(before.id, nd.id, 'next');
    } else {
        rec.say('맨 앞에 넣는 것이므로 **head 포인터**를 새 노드로 바꿉니다.');
        rec.link(null, nd.id, 'next');
    }

    if (s.doubly) {
        rec.say('역방향 링크도 함께 겁니다. 이중 연결 리스트는 링크를 **양쪽 다** 고쳐야 합니다.');
        rec.link(nd.id, before ? before.id : null, 'prev');
        if (after) rec.link(after.id, nd.id, 'prev');
    }
    if (s.hasTail && !after) {
        rec.say('맨 뒤에 붙었으므로 **tail 포인터**도 새 노드로 옮깁니다.');
        rec.link(null, nd.id, 'prev');   // `prev` 방향은 tail 포인터를 뜻한다
    }

    rec.say('링크가 다 걸렸습니다. 새 노드가 리스트에 들어왔습니다.');
    rec.settle(nd.id);
    rec.setSize(rec.size + 1);
    return `${withJosa(v, '을를')} ${i}번에 넣었습니다. **원소는 하나도 움직이지 않았습니다** — 고친 것은 링크뿐입니다.`;
}

/** 자리 `i`의 노드를 뺀다. */
function listRemoveAt(rec, i) {
    if (rec.size === 0) {
        rec.flag('비어 있어서 뺄 것이 없습니다.');
        rec.mark('empty');
        return '비어 있어 아무 일도 하지 않았습니다.';
    }
    rec.clearFlag();
    const s = rec.state;
    let before = null;
    let target = null;

    /* **역방향 링크가 있으면 맨 뒤를 빼는 데 따라갈 것이 없다.** 이 갈래가 곧
       이중 연결 리스트를 두는 까닭이라, 단일 쪽과 나란히 보이게 말로도 밝힌다. */
    if (i === rec.size - 1 && s.doubly && rec.size > 0) {
        rec.say('**tail 포인터**로 마지막 노드에 바로 갑니다.');
        target = rec.walk(rec.tail, 'p');
        if (target.prev !== null) {
            rec.say('**역방향 링크**가 있어 앞 노드도 곧바로 알 수 있습니다.');
            before = rec.walk(target.prev, 'q');
        }
    } else {
        if (i === rec.size - 1 && rec.size > 1) {
            rec.say('마지막 노드를 제거하려면 **그 앞 노드의 링크**를 고쳐야 하는데,'
                + ' 역방향 링크가 없어 앞 노드를 알 수 없습니다. 처음부터 따라갑니다.');
        }
        before = i > 0 ? walkTo(rec, i - 1) : null;
        target = before ? rec.nodeById(before.next) : rec.nodeById(rec.head);
        if (target && before) {
            rec.say('빼려는 노드를 찾았습니다.');
            rec.walk(target.id, 'p');
        }
    }

    if (!target) {
        rec.flag(`${i}번 노드가 없습니다.`);
        rec.mark('empty');
        return '그 자리에는 노드가 없습니다.';
    }
    const after = rec.nodeById(target.next);

    rec.say(`${withJosa(target.v, '을를')} 담은 이 노드를 제거합니다.`);
    rec.doom(target.id);

    if (before) {
        rec.say('앞 노드의 링크를 **제거할 노드를 건너뛰어** 그 뒤로 잇습니다.');
        rec.link(before.id, after ? after.id : null, 'next');
    } else {
        rec.say('맨 앞을 빼는 것이므로 **head 포인터**를 다음 노드로 옮깁니다.');
        rec.link(null, after ? after.id : null, 'next');
    }
    if (s.doubly && after) {
        rec.say('역방향 링크도 앞 노드로 이어 줍니다.');
        rec.link(after.id, before ? before.id : null, 'prev');
    }
    if (s.hasTail && !after) {
        rec.say('마지막 노드였으므로 **tail 포인터**를 앞 노드로 되돌립니다.');
        rec.link(null, before ? before.id : null, 'prev');
    }

    rec.say('리스트에서 빠졌습니다. 이제 이 노드를 가리키는 링크는 하나도 없습니다.');
    rec.dropNode(target.id);
    rec.setSize(rec.size - 1);
    return `${withJosa(target.v, '을를')} 뺐습니다. **밀거나 당긴 것은 하나도 없습니다.**`;
}

/** `k`번째 노드를 읽는다. **처음부터 링크를 따라가는 수밖에 없다.** */
function listReadAt(rec, k) {
    if (k >= rec.size) {
        rec.flag(`${k}번 노드가 없습니다.`);
        rec.mark('empty');
        return '그 자리에는 노드가 없습니다.';
    }
    rec.clearFlag();
    rec.say(`${k}번 노드를 보려 합니다. 노드들이 **여기저기 떨어져 있어** 인덱스로`
        + ' 바로 접근할 수가 없습니다. 처음부터 링크를 따라갑니다.');
    const nd = walkTo(rec, k);
    rec.cursor('p', null);
    return `${k}번은 ${nd.v}입니다. **노드를 ${k + 1}개 지나왔습니다** —`
        + ' 뒤로 갈수록 더 걸립니다.';
}

/** 값을 앞에서부터 찾는다. */
function listFind(rec, v) {
    rec.clearFlag();
    let nd = rec.nodeById(rec.head);
    let seen = 0;
    while (nd) {
        rec.say(`이 노드의 값과 ${withJosa(v, '을를')} 비교해 봅니다.`);
        rec.walk(nd.id, 'p');
        seen++;
        if (nd.v === v) {
            rec.say(`${seen - 1}번째 노드에서 ${withJosa(v, '을를')} 찾았습니다.`);
            rec.mark('found');
            rec.cursor('p', null);
            return `${seen - 1}번째에서 찾았습니다. **노드를 ${seen}개 지나왔습니다.**`;
        }
        nd = rec.nodeById(nd.next);
    }
    rec.say(`${withJosa(v, '은는')} 없습니다.`);
    rec.mark('missing');
    rec.cursor('p', null);
    return `${withJosa(v, '은는')} 들어 있지 않습니다. **끝까지 노드 ${seen}개를 지나왔습니다.**`;
}

/* ---------------------------------------------------------------
   연산 — 저장 구조마다 한 벌씩
   --------------------------------------------------------------- */

/** 배열로 담는 구조가 쓰는 연산 만들기. */
export const dsArrayOps = {
    insertFront: {
        id: 'insert-front', name: '앞에 넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} **맨 앞(0번)**에 넣으려 합니다.`,
        run: (rec, {v}) => arrayInsertAt(rec, 0, v),
    },
    insertBack: {
        id: 'insert-back', name: '뒤에 넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} **맨 뒤(${rec.size}번)**에 넣으려 합니다.`,
        run: (rec, {v}) => arrayInsertAt(rec, rec.size, v),
    },
    insertAt: {
        id: 'insert-at', name: 'k번째에 넣기', arg: 'valueIndex',
        opening: (rec, {v, i}) => `${withJosa(v, '을를')} **${i}번 자리**에 넣으려 합니다.`,
        run: (rec, {v, i}) => (outOfRange(rec, i, rec.size, '넣을')
            ? '쓸 수 없는 자리라 넣지 않았습니다.'
            : arrayInsertAt(rec, i, v)),
    },
    removeFront: {
        id: 'remove-front', name: '앞에서 빼기', arg: null,
        opening: () => '**맨 앞(0번)**을 빼려 합니다.',
        run: (rec) => arrayRemoveAt(rec, 0),
    },
    removeBack: {
        id: 'remove-back', name: '뒤에서 빼기', arg: null,
        opening: (rec) => `**맨 뒤(${Math.max(0, rec.size - 1)}번)**를 빼려 합니다.`,
        run: (rec) => arrayRemoveAt(rec, Math.max(0, rec.size - 1)),
    },
    removeAt: {
        id: 'remove-at', name: 'k번째 빼기', arg: 'index',
        opening: (rec, {i}) => `**${i}번 자리**를 빼려 합니다.`,
        run: (rec, {i}) => (outOfRange(rec, i, rec.size - 1, '뺄')
            ? '그 자리에는 뺄 것이 없습니다.'
            : arrayRemoveAt(rec, i)),
    },
    readAt: {
        id: 'read-at', name: 'k번째 읽기', arg: 'index',
        opening: (rec, {i}) => `**${i}번 자리**의 값을 보려 합니다.`,
        run: (rec, {i}) => arrayReadAt(rec, i),
    },
    find: {
        id: 'find', name: '값 찾기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '이가')} 어디 있는지 찾으려 합니다.`,
        run: (rec, {v}) => arrayFind(rec, v),
    },
};

/** 노드로 담는 구조가 쓰는 연산 만들기. 이름은 배열 쪽과 **일부러 같게** 둔다 —
 *  같은 이름의 연산이 얼마나 다른 일을 하는지가 이 페이지의 요점이기 때문이다. */
export const dsListOps = {
    insertFront: {
        id: 'insert-front', name: '앞에 넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} **맨 앞**에 넣으려 합니다.`,
        run: (rec, {v}) => listInsertAt(rec, 0, v),
    },
    insertBack: {
        id: 'insert-back', name: '뒤에 넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} **맨 뒤**에 넣으려 합니다.`,
        run: (rec, {v}) => listInsertAt(rec, rec.size, v),
    },
    insertAt: {
        id: 'insert-at', name: 'k번째에 넣기', arg: 'valueIndex',
        opening: (rec, {v, i}) => `${withJosa(v, '을를')} **${i}번째**에 넣으려 합니다.`,
        run: (rec, {v, i}) => (outOfRange(rec, i, rec.size, '넣을')
            ? '쓸 수 없는 자리라 넣지 않았습니다.'
            : listInsertAt(rec, i, v)),
    },
    removeFront: {
        id: 'remove-front', name: '앞에서 빼기', arg: null,
        opening: () => '**맨 앞**을 빼려 합니다.',
        run: (rec) => listRemoveAt(rec, 0),
    },
    removeBack: {
        id: 'remove-back', name: '뒤에서 빼기', arg: null,
        opening: () => '**맨 뒤**를 빼려 합니다.',
        run: (rec) => listRemoveAt(rec, Math.max(0, rec.size - 1)),
    },
    removeAt: {
        id: 'remove-at', name: 'k번째 빼기', arg: 'index',
        opening: (rec, {i}) => `**${i}번째**를 빼려 합니다.`,
        run: (rec, {i}) => (outOfRange(rec, i, rec.size - 1, '뺄')
            ? '그 자리에는 뺄 것이 없습니다.'
            : listRemoveAt(rec, i)),
    },
    readAt: {
        id: 'read-at', name: 'k번째 읽기', arg: 'index',
        opening: (rec, {i}) => `**${i}번째** 노드의 값을 보려 합니다.`,
        run: (rec, {i}) => listReadAt(rec, i),
    },
    find: {
        id: 'find', name: '값 찾기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '이가')} 어디 있는지 찾으려 합니다.`,
        run: (rec, {v}) => listFind(rec, v),
    },
};

/* ---------------------------------------------------------------
   추상 자료형이 정해진 구조 — 스택 · 큐 · 원형 큐 · 덱
   --------------------------------------------------------------- */

/** 비어 있어 볼 것이 없을 때. 세 구조가 같은 말을 한다. */
function emptyPeek(rec) {
    rec.flag('비어 있습니다.');
    rec.mark('empty');
    return '비어 있어 볼 것이 없습니다.';
}

/** 끝을 들여다본다. **끝이 어디인지 늘 알고 있으므로 한 번이면 된다** —
 *  인덱스를 받아 따라가는 「k번째 읽기」와 다른 점이다. */
function peekEnd(rec, i, where) {
    if (rec.size === 0) return emptyPeek(rec);
    rec.clearFlag();
    rec.say(`어느 칸이 ${where}인지 **늘 알고 있으므로** 바로 접근합니다.`);
    const it = rec.at(i);
    return `${where} 자리의 값은 ${it.v}입니다. **접근은 한 번**입니다.`;
}

/** 스택. **한쪽 끝만 쓴다.** 배열로 담아도 밀리는 것이 없는 까닭이 여기 있다. */
export const dsStackOps = {
    array: [
        {
            id: 'push', name: '넣기 (push)', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **맨 위에 쌓습니다.**`,
            run: (rec, {v}) => arrayInsertAt(rec, rec.size, v),
        },
        {
            id: 'pop', name: '빼기 (pop)', arg: null,
            opening: () => '**맨 위**를 꺼냅니다.',
            run: (rec) => arrayRemoveAt(rec, Math.max(0, rec.size - 1)),
        },
        {
            id: 'top', name: '맨 위 보기 (peek)', arg: null,
            opening: () => '**맨 위만 확인합니다.** 빼지는 않습니다.',
            run: (rec) => peekEnd(rec, rec.size - 1, '맨 위'),
        },
    ],
    list: [
        {
            id: 'push', name: '넣기 (push)', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **맨 위에 쌓습니다.**`,
            run: (rec, {v}) => listInsertAt(rec, 0, v),
        },
        {
            id: 'pop', name: '빼기 (pop)', arg: null,
            opening: () => '**맨 위**를 꺼냅니다.',
            run: (rec) => listRemoveAt(rec, 0),
        },
        {
            id: 'top', name: '맨 위 보기 (peek)', arg: null,
            opening: () => '**맨 위만 확인합니다.** 빼지는 않습니다.',
            run: (rec) => {
                if (rec.size === 0) return emptyPeek(rec);
                rec.clearFlag();
                rec.say('**head 포인터**가 맨 위 노드를 바로 가리킵니다.');
                const nd = rec.walk(rec.head, 'p');
                return `맨 위는 ${nd.v}입니다. **노드 하나만 지났습니다.**`;
            },
        },
    ],
};

/** 큐. **넣는 끝과 빼는 끝이 다르다.** 배열로 담으면 그 「다름」이 곧 밀기가 된다. */
export const dsQueueOps = {
    array: [
        {
            id: 'enqueue', name: '넣기 (enqueue)', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **줄 뒤에 세웁니다.**`,
            run: (rec, {v}) => arrayInsertAt(rec, rec.size, v),
        },
        {
            id: 'dequeue', name: '빼기 (dequeue)', arg: null,
            opening: () => '**줄 맨 앞** 사람을 내보냅니다.',
            run: (rec) => arrayRemoveAt(rec, 0),
        },
        {
            id: 'front', name: '맨 앞 보기 (peek)', arg: null,
            opening: () => '**맨 앞만 확인합니다.** 내보내지는 않습니다.',
            run: (rec) => peekEnd(rec, 0, '맨 앞'),
        },
    ],
    list: [
        {
            id: 'enqueue', name: '넣기 (enqueue)', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **줄 뒤에 세웁니다.**`,
            run: (rec, {v}) => listInsertAt(rec, rec.size, v),
        },
        {
            id: 'dequeue', name: '빼기 (dequeue)', arg: null,
            opening: () => '**줄 맨 앞** 사람을 내보냅니다.',
            run: (rec) => listRemoveAt(rec, 0),
        },
        {
            id: 'front', name: '맨 앞 보기 (peek)', arg: null,
            opening: () => '**맨 앞만 확인합니다.** 내보내지는 않습니다.',
            run: (rec) => {
                if (rec.size === 0) return emptyPeek(rec);
                rec.clearFlag();
                rec.say('**head 포인터**가 줄 맨 앞을 바로 가리킵니다.');
                const nd = rec.walk(rec.head, 'p');
                return `맨 앞은 ${nd.v}입니다. **노드 하나만 지났습니다.**`;
            },
        },
    ],
};

/** 덱. 양쪽 끝을 다 쓴다. */
export const dsDequeOps = {
    array: [
        {
            id: 'push-front', name: '앞에 넣기', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **앞쪽 끝**에 넣습니다.`,
            run: (rec, {v}) => arrayInsertAt(rec, 0, v),
        },
        {
            id: 'push-back', name: '뒤에 넣기', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **뒤쪽 끝**에 넣습니다.`,
            run: (rec, {v}) => arrayInsertAt(rec, rec.size, v),
        },
        {
            id: 'pop-front', name: '앞에서 빼기', arg: null,
            opening: () => '**앞쪽 끝**을 뺍니다.',
            run: (rec) => arrayRemoveAt(rec, 0),
        },
        {
            id: 'pop-back', name: '뒤에서 빼기', arg: null,
            opening: () => '**뒤쪽 끝**을 뺍니다.',
            run: (rec) => arrayRemoveAt(rec, Math.max(0, rec.size - 1)),
        },
    ],
    list: [
        {
            id: 'push-front', name: '앞에 넣기', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **앞쪽 끝**에 넣습니다.`,
            run: (rec, {v}) => listInsertAt(rec, 0, v),
        },
        {
            id: 'push-back', name: '뒤에 넣기', arg: 'value',
            opening: (rec, {v}) => `${withJosa(v, '을를')} **뒤쪽 끝**에 넣습니다.`,
            run: (rec, {v}) => listInsertAt(rec, rec.size, v),
        },
        {
            id: 'pop-front', name: '앞에서 빼기', arg: null,
            opening: () => '**앞쪽 끝**을 뺍니다.',
            run: (rec) => listRemoveAt(rec, 0),
        },
        {
            id: 'pop-back', name: '뒤에서 빼기', arg: null,
            opening: () => '**뒤쪽 끝**을 뺍니다.',
            run: (rec) => listRemoveAt(rec, Math.max(0, rec.size - 1)),
        },
    ],
};

/* ---------------------------------------------------------------
   원형 큐 — 밀지 않으려고 **인덱스를 돌린다**
   --------------------------------------------------------------- */

/* ---------------------------------------------------------------
   연산이 비용 — **여기 한곳에 적는다**
   ---------------------------------------------------------------

   화면의 카드는 「앞에 넣기는 O(n)」이라고 말한다. **그 말이 참인지 검사가 실제로
   측정해 본다** — 개수를 키워 가며 작업량이 어떻게 자라는지를 보고 여기 적힌 것과 맞춘다.
   카드에 적힌 말과 화면에서 벌어지는 일이 어긋나는 것이 가장 나쁜 결함이라,
   말을 사람이 적는 이상 기계가 붙들어야 한다.

   **상태를 받는 함수인 것에 뜻이 있다.** 같은 「뒤에 넣기」라도 tail 포인터가 있으면
   O(1)이고 없으면 O(n)이다 — 그 갈림이 이 페이지가 가르치려는 것 가운데 하나다. */

const O1 = () => 'O(1)';
const ON = () => 'O(n)';

function setCost(ops, table) {
    for (const [key, cost] of Object.entries(table)) {
        const op = Array.isArray(ops) ? ops.find((o) => o.id === key) : ops[key];
        op.cost = cost;
    }
}

setCost(dsArrayOps, {
    insertFront: ON, insertBack: O1, insertAt: ON,
    removeFront: ON, removeBack: O1, removeAt: ON,
    readAt: O1, find: ON,
});

setCost(dsListOps, {
    insertFront: O1,
    insertBack: (st) => (st.hasTail ? 'O(1)' : 'O(n)'),
    insertAt: ON,
    removeFront: O1,
    removeBack: (st) => (st.doubly ? 'O(1)' : 'O(n)'),
    removeAt: ON,
    readAt: ON, find: ON,
});

setCost(dsStackOps.array, {push: O1, pop: O1, top: O1});
setCost(dsStackOps.list, {push: O1, pop: O1, top: O1});
setCost(dsQueueOps.array, {enqueue: O1, dequeue: ON, front: O1});
setCost(dsQueueOps.list, {enqueue: O1, dequeue: O1, front: O1});
setCost(dsDequeOps.array, {
    'push-front': ON, 'push-back': O1, 'pop-front': ON, 'pop-back': O1,
});
setCost(dsDequeOps.list, {
    'push-front': O1, 'push-back': O1, 'pop-front': O1, 'pop-back': O1,
});

/** 원형 큐. `front`·`rear`는 커서가 아니라 **상태**다 — 연산이 끝나도 남는다. */
export const dsRingOps = [
    {
        id: 'enqueue', name: '넣기 (enqueue)', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} **rear 자리**에 넣으려 합니다.`,
        run: (rec, {v}) => {
            const s = rec.state;
            if (rec.size >= rec.cap) {
                rec.flag(`칸 ${rec.cap}개가 모두 찼습니다. 원형 큐는 자리를 돌려 쓸 뿐이라`
                    + ' **칸 수 자체가 늘지는 않습니다.**');
                rec.mark('full');
                return '꽉 차서 넣지 못했습니다.';
            }
            rec.clearFlag();
            const at = s.rear;
            rec.say(`rear가 가리키는 ${at}번 칸에 ${withJosa(v, '을를')} 씁니다.`);
            rec.write(at, dsItem(v));
            rec.setSize(rec.size + 1);
            const next = (at + 1) % rec.cap;
            s.rear = next;
            if (next === 0 && at === rec.cap - 1) {
                rec.say(`rear가 마지막 칸을 지났으므로 **0번으로 돌아옵니다.**`
                    + ' 나머지 연산(`% 칸수`)이 하는 일이 이것입니다.');
            } else {
                rec.say(`rear를 ${next}번으로 옮깁니다.`);
            }
            rec.mark('ring');
            return `${withJosa(v, '을를')} 넣었습니다. **아무것도 밀지 않았습니다.**`;
        },
    },
    {
        id: 'dequeue', name: '빼기 (dequeue)', arg: null,
        opening: (rec) => `**front 자리(${rec.state.front}번)**에서 빼려 합니다.`,
        run: (rec) => {
            const s = rec.state;
            if (rec.size === 0) {
                rec.flag('비어 있어서 뺄 것이 없습니다.');
                rec.mark('empty');
                return '비어 있어 아무 일도 하지 않았습니다.';
            }
            rec.clearFlag();
            const at = s.front;
            rec.say(`front가 가리키는 ${at}번 칸을 읽습니다.`);
            const gone = rec.at(at);
            rec.say(`${withJosa(gone.v, '을를')} 꺼내고 그 칸을 비웁니다.`);
            rec.clear(at);
            rec.setSize(rec.size - 1);
            const next = (at + 1) % rec.cap;
            s.front = next;
            if (next === 0 && at === rec.cap - 1) {
                rec.say('front도 마지막 칸을 지나 **0번으로 돌아옵니다.**');
            } else {
                rec.say(`front를 ${next}번으로 옮깁니다.`);
            }
            rec.mark('ring');
            return `${withJosa(gone.v, '을를')} 뺐습니다. **당긴 것이 하나도 없습니다** —`
                + ' 원소가 아니라 front가 움직였습니다.';
        },
    },
    {
        id: 'front', name: '맨 앞 보기 (peek)', arg: null,
        opening: () => '**front 자리**만 확인합니다. 빼지는 않습니다.',
        run: (rec) => {
            if (rec.size === 0) {
                rec.flag('비어 있습니다.');
                rec.mark('empty');
                return '비어 있어 볼 것이 없습니다.';
            }
            rec.clearFlag();
            const it = rec.at(rec.state.front);
            return `맨 앞은 ${it.v}입니다.`;
        },
    },
];

setCost(dsRingOps, {enqueue: O1, dequeue: O1, front: O1});
