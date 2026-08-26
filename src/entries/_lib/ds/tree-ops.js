/* 트리 연산이 어떻게 이루어지는지 — **이 페이지가 가르치려는 것의 알맹이.**
 *
 * 트리에서 학생이 놓치는 것은 「어떤 모양인가」가 아니라 **「그 모양이 왜 그렇게 되었고
 * 그것이 무엇을 정하는가」**다. 오름차순으로 넣은 이진 탐색 트리가 한 줄로 이어진 편향 트리가 되는 것을
 * 보기 전에는, 「최악이 O(n)」이 왜 나오는지도 AVL 트리가 왜 있는지도 서지 않는다.
 * 그래서 넣을 때마다 **어디서 왼쪽으로 갈지 오른쪽으로 갈지 비교하는 것**을 한 장씩 남기고,
 * 회전은 링크를 하나씩 고쳐 쓰는 것으로 남긴다.
 */

import {
    balanceOf, treeHeight, treeLinkedState, heapState, runTreeOperation,
} from './tree-model.js';
import {withJosa} from '../josa.js';

export const TREE_VALUE_MAX = 99;

/* ---------------------------------------------------------------
   이진 탐색 트리
   --------------------------------------------------------------- */

/** 넣을 자리를 찾아 내려간다. 이미 있으면 `{found}`를 돌려준다. */
function descend(rec, v) {
    let at = rec.node(rec.root);
    while (at) {
        const d = rec.compareAt(at.id, v);
        if (d === 0) return {found: at};
        const side = d < 0 ? 'left' : 'right';
        rec.say(d < 0
            ? `${withJosa(v, '은는')} ${at.v}보다 작으므로 **왼쪽**으로 내려갑니다.`
            : `${withJosa(v, '은는')} ${at.v}보다 크므로 **오른쪽**으로 내려갑니다.`);
        if (at[side] === null) return {parent: at, side};
        at = rec.node(at[side]);
    }
    return {parent: null, side: null};
}

function bstInsert(rec, v) {
    rec.clearFlag();
    rec.clearEmitted();

    if (rec.root === null) {
        rec.say(`트리가 비어 있으므로 ${withJosa(v, '이가')} **루트**가 됩니다.`);
        const nd = rec.newNode(v);
        rec.link(null, nd.id, 'root');
        rec.settle(nd.id);
        return `${withJosa(v, '을를')} 루트로 넣었습니다.`;
    }

    const spot = descend(rec, v);
    if (spot.found) {
        rec.flag(`${withJosa(v, '은는')} 이미 들어 있습니다. 이 시뮬레이터는 **같은 값을 두 번 넣지 않습니다.**`);
        rec.mark('duplicate');
        return `${withJosa(v, '은는')} 이미 있습니다.`;
    }

    rec.spotAt(spot.parent.id, spot.side);
    rec.say(`${spot.parent.v}의 ${spot.side === 'left' ? '왼쪽' : '오른쪽'}이 비어 있습니다. **여기가 ${v}의 자리입니다.**`);
    rec.mark('spot');

    const nd = rec.newNode(v);
    rec.say(`${spot.parent.v}의 ${spot.side === 'left' ? '왼쪽' : '오른쪽'} 링크를 새 노드로 겁니다.`);
    rec.link(spot.parent.id, nd.id, spot.side);
    rec.settle(nd.id);
    return `${withJosa(v, '을를')} 넣었습니다. **비교한 횟수가 곧 내려간 깊이**입니다.`;
}

function bstSearch(rec, v) {
    rec.clearFlag();
    rec.clearEmitted();
    if (rec.root === null) {
        rec.flag('트리가 비어 있습니다.');
        rec.mark('empty');
        return '비어 있어 찾을 것이 없습니다.';
    }
    let at = rec.node(rec.root);
    let steps = 0;
    while (at) {
        const d = rec.compareAt(at.id, v);
        steps++;
        if (d === 0) {
            rec.say(`${withJosa(v, '을를')} 찾았습니다.`);
            rec.mark('found');
            return `${steps}번 비교해 찾았습니다. **트리 높이가 ${treeHeight(rec.state)}이므로 아무리 깊어도 그만큼입니다.**`;
        }
        const side = d < 0 ? 'left' : 'right';
        rec.say(d < 0
            ? `${withJosa(v, '은는')} ${at.v}보다 작습니다. **오른쪽 가지는 통째로 볼 필요가 없습니다.**`
            : `${withJosa(v, '은는')} ${at.v}보다 큽니다. **왼쪽 가지는 통째로 볼 필요가 없습니다.**`);
        if (at[side] === null) break;
        at = rec.node(at[side]);
    }
    rec.say(`더 내려갈 곳이 없습니다. ${withJosa(v, '은는')} 트리에 없습니다.`);
    rec.mark('missing');
    return `${withJosa(v, '은는')} 없습니다. **${steps}번 비교하고 끝났습니다** — 없다는 것도 이만큼이면 알 수 있습니다.`;
}

/** 오른쪽 가지에서 **가장 작은 노드**. 지우려는 값의 바로 다음 값이다. */
function successorOf(rec, nd) {
    rec.say('오른쪽 가지에서 **가장 작은 값**을 찾습니다. 그것이 지우려는 값의 바로 다음 값입니다.');
    let at = rec.node(nd.right);
    rec.visit(at.id);
    while (at.left !== null) {
        rec.say('왼쪽으로 더 갈 수 있으면 더 작은 값이 있습니다.');
        at = rec.node(at.left);
        rec.visit(at.id);
    }
    return at;
}

function bstRemove(rec, v, {rebalance = false} = {}) {
    rec.clearFlag();
    rec.clearEmitted();
    if (rec.root === null) {
        rec.flag('트리가 비어 있습니다.');
        rec.mark('empty');
        return '비어 있어 뺄 것이 없습니다.';
    }

    let at = rec.node(rec.root);
    let target = null;
    while (at) {
        const d = rec.compareAt(at.id, v);
        if (d === 0) { target = at; break; }
        const side = d < 0 ? 'left' : 'right';
        if (at[side] === null) break;
        at = rec.node(at[side]);
    }
    if (!target) {
        rec.flag(`${withJosa(v, '은는')} 트리에 없습니다.`);
        rec.mark('missing');
        return `${withJosa(v, '이가')} 없어 아무것도 지우지 않았습니다.`;
    }

    /* **자식이 둘이면 값을 맞바꾼 뒤 «다음 값»의 노드를 지운다.**
       링크를 새로 얽어 붙이는 것으로 그리면 그림이 통째로 뒤집혀 따라갈 수가 없다.
       실제 구현도 대개 이렇게 한다 — 옮기는 것은 값 하나뿐이다. */
    if (target.left !== null && target.right !== null) {
        const succ = successorOf(rec, target);
        /* **이 장에서 트리는 잠깐 이진 탐색 트리가 아니다.** 값을 맞바꾸는 순간
           옮겨 간 값이 제자리를 벗어난다(화면에서도 가로 순서가 어긋나 보인다).
           곧 그 노드를 제거하므로 끝나고 나면 성질이 돌아온다 —
           **그 「잠깐」을 밝히지 않으면 자막이 화면을 부정한다.** */
        rec.say(`${target.v} 자리에 **${withJosa(succ.v, '을를')}** 올려놓습니다. `
            + `옮겨 온 자리(${withJosa(target.v, '이가')} 있던 곳)에는 `
            + `이제 ${withJosa(succ.v, '이가')} 두 번 있는 셈이라 `
            + '**잠깐 규칙이 어긋납니다** — 곧 아래쪽 노드를 제거하면 제자리로 돌아옵니다.');
        rec.swapValues(target.id, succ.id);
        target = succ;   // 이제 지울 것은 «다음 값»이 옮겨 간 노드다
    }

    const child = target.left !== null ? target.left : target.right;
    const parent = target.parent;
    const side = parent === null ? null
        : (rec.node(parent).left === target.id ? 'left' : 'right');

    rec.say(child === null
        ? `${withJosa(target.v, '은는')} 자식이 없으므로 그냥 제거합니다.`
        : `${withJosa(target.v, '은는')} 자식이 하나뿐이므로 **그 자식을 제 자리에 올립니다.**`);
    rec.doom(target.id);
    rec.link(parent, child, side);
    rec.dropNode(target.id);

    if (rebalance) avlRebalanceUp(rec, parent);
    rec.refreshHeights();
    return `${withJosa(v, '을를')} 뺐습니다.`;
}

/* ---- 순회 ---- */

function traverse(rec, order) {
    rec.clearFlag();
    rec.clearEmitted();
    if (rec.root === null) {
        rec.flag('트리가 비어 있습니다.');
        rec.mark('empty');
        return '비어 있어 순회할 것이 없습니다.';
    }
    const name = {pre: '전위', in: '중위', post: '후위'}[order];
    const walk = (id) => {
        if (id === null) return;
        const nd = rec.node(id);
        if (order === 'pre') {
            rec.say(`이 노드를 **먼저** 적고 아래로 내려갑니다.`);
            rec.visit(id);
            rec.emit(nd.v);
        }
        walk(nd.left);
        if (order === 'in') {
            rec.say('왼쪽을 다 순회했으므로 **이제** 이 노드를 적습니다.');
            rec.visit(id);
            rec.emit(nd.v);
        }
        walk(nd.right);
        if (order === 'post') {
            rec.say('양쪽을 다 순회한 **뒤에** 이 노드를 적습니다.');
            rec.visit(id);
            rec.emit(nd.v);
        }
    };
    walk(rec.root);
    rec.say(`${name} 순회가 끝났습니다.`);
    rec.mark('done');
    /* **세는 횟수가 셋 다 0인 것에 뜻이 있다.** 순회는 값을 비교하지도 옮기지도 링크를
       고치지도 않는다 — 이미 만들어진 모양대로 지나갈 뿐이다. 그 0을 밝혀 주지 않으면
       학생은 화면이 고장 났다고 읽는다. */
    const zero = ' 순회는 값을 **비교하지 않습니다** — 이미 만들어진 모양대로 지나갈 뿐이라 세는 횟수가 모두 0입니다.';
    return (order === 'in'
        ? '중위 순회로 나온 값이 **오름차순**입니다. 왼쪽은 작고 오른쪽은 크다는 규칙을 '
          + '지키는 트리라면 언제나 그렇습니다 — 회전한 뒤에도 마찬가지입니다.'
        : `${name} 순회가 끝났습니다. 나온 순서를 중위 순회와 비교해 보세요.`) + zero;
}

/* ---------------------------------------------------------------
   AVL 트리 — **회전**
   --------------------------------------------------------------- */

/** 한 번 회전한다. `dir`가 `'right'`면 왼쪽으로 기운 것을 오른쪽으로 회전한다. */
function rotate(rec, y, dir) {
    const pivotSide = dir === 'right' ? 'left' : 'right';
    const otherSide = dir === 'right' ? 'right' : 'left';
    const x = rec.node(y[pivotSide]);
    const parent = y.parent;
    const sideOfY = parent === null ? null
        : (rec.node(parent).left === y.id ? 'left' : 'right');
    const moved = x[otherSide];

    rec.say(`**${dir === 'right' ? '오른쪽' : '왼쪽'}으로 회전합니다.** `
        + `${withJosa(x.v, '이가')} 위로 올라가고 ${withJosa(y.v, '이가')} 아래로 내려갑니다.`);
    rec.mark('rotate');

    rec.say(moved === null
        ? `${x.v}의 ${otherSide === 'left' ? '왼쪽' : '오른쪽'}은 비어 있습니다.`
        : `${withJosa(rec.node(moved).v, '은는')} ${withJosa(x.v, '과와')} ${y.v} 사이의 값이므로 ${y.v}의 `
          + `${pivotSide === 'left' ? '왼쪽' : '오른쪽'}으로 옮겨 갑니다. **자리가 바뀌어도 크기 순서는 그대로입니다.**`);
    rec.link(y.id, moved, pivotSide);
    rec.link(x.id, y.id, otherSide);
    rec.link(parent, x.id, sideOfY);
    rec.refreshHeights();
    return x;
}

/** 새로 넣거나 뺀 자리에서 위로 올라가며 균형을 본다. */
function avlRebalanceUp(rec, startId) {
    let atId = startId;
    let rotations = 0;
    while (atId !== null && atId !== undefined) {
        rec.refreshHeights();
        const at = rec.node(atId);
        if (!at) break;
        const b = balanceOf(rec.state, at);
        const up = at.parent;

        if (Math.abs(b) <= 1) {
            rec.say(`${at.v}의 균형 인수는 ${b}입니다. **−1·0·1 안이므로 그대로 둡니다.**`);
            rec.visit(at.id);
            atId = up;
            continue;
        }

        rec.say(`${at.v}의 균형 인수가 ${b}입니다. **한쪽이 2 이상 깊어졌으므로 회전해야 합니다.**`);
        rec.visit(at.id);

        if (b > 1) {
            const left = rec.node(at.left);
            if (balanceOf(rec.state, left) < 0) {
                rec.say(`왼쪽 자식(${left.v})이 다시 오른쪽으로 기울어 있습니다. `
                    + '**한 번에 균형을 잡지 못하므로 먼저 그 자식을 왼쪽으로 회전합니다.**');
                rotate(rec, left, 'left');
                rotations++;
            }
            rotate(rec, rec.node(atId), 'right');
            rotations++;
        } else {
            const right = rec.node(at.right);
            if (balanceOf(rec.state, right) > 0) {
                rec.say(`오른쪽 자식(${right.v})이 다시 왼쪽으로 기울어 있습니다. `
                    + '**한 번에 균형을 잡지 못하므로 먼저 그 자식을 오른쪽으로 회전합니다.**');
                rotate(rec, right, 'right');
                rotations++;
            }
            rotate(rec, rec.node(atId), 'left');
            rotations++;
        }
        atId = up;
    }
    rec.refreshHeights();
    return rotations;
}

function avlInsert(rec, v) {
    const before = rec.size;
    const out = bstInsert(rec, v);
    if (rec.size === before) return out;   // 이미 있어서 안 들어간 판

    const added = rec.state.nodes.find((n) => n.v === v);
    rec.say('넣었으니 **루트까지 올라가며 균형을 봅니다.**');
    const rotations = avlRebalanceUp(rec, added ? added.parent : null);
    return rotations === 0
        ? `${withJosa(v, '을를')} 넣었습니다. **회전할 일이 없었습니다** — 균형이 이미 −1·0·1 안입니다.`
        : `${withJosa(v, '을를')} 넣었습니다. **${rotations}번 회전해** 높이를 ${withJosa(treeHeight(rec.state), '으로')} 지켰습니다.`;
}

/* ---------------------------------------------------------------
   힙 — **배열이다**
   --------------------------------------------------------------- */

const parentOf = (i) => Math.floor((i - 1) / 2);

function heapInsert(rec, v) {
    rec.clearFlag();
    rec.clearEmitted();
    if (rec.size >= rec.cap) {
        rec.flag(`칸 ${rec.cap}개가 모두 찼습니다.`);
        rec.mark('full');
        return '꽉 차서 넣지 못했습니다.';
    }
    /* **같은 값을 두 번 넣지 않는다.** 이진 탐색 트리 쪽은 막는데 힙만 안 막았더니,
       겹친 값이 들어간 뒤 탭을 옮기는 순간 «넣은 차례»에서 하나가 걸러져
       **값이 말없이 사라졌다.** 두 곳의 규칙이 같아야 한다. */
    if (rec.state.slots.slice(0, rec.size).some((it) => it && it.v === v)) {
        rec.flag(`${withJosa(v, '은는')} 이미 들어 있습니다. 이 시뮬레이터는 `
            + '**같은 값을 두 번 넣지 않습니다.**');
        rec.mark('duplicate');
        return `${withJosa(v, '은는')} 이미 있습니다.`;
    }
    const at = rec.size;
    rec.say(`새 값은 **배열의 맨 끝(${at}번 칸)**에 놓습니다. 트리로 보면 마지막 자리입니다.`);
    rec.heapWrite(at, v);
    rec.heapSetSize(rec.size + 1);

    let i = at;
    let swaps = 0;
    while (i > 0) {
        const p = parentOf(i);
        rec.say(`부모는 **(${i} − 1) ÷ 2 = ${p}번 칸**입니다. 링크를 따라가는 것이 아니라 `
            + '**인덱스를 계산**해서 찾습니다.');
        if (rec.heapCompare(i, p) <= 0) {
            rec.say('부모가 더 크므로 **여기가 제자리입니다.**');
            rec.mark('settled');
            break;
        }
        rec.say('부모보다 크므로 **부모와 자리를 바꿉니다.**');
        rec.heapSwap(i, p);
        swaps++;
        i = p;
    }
    return `${withJosa(v, '을를')} 넣었습니다. **${swaps}번 올라갔습니다** — 아무리 많아도 트리 높이만큼입니다.`;
}

function heapExtract(rec) {
    rec.clearFlag();
    rec.clearEmitted();
    if (rec.size === 0) {
        rec.flag('비어 있습니다.');
        rec.mark('empty');
        return '비어 있어 뺄 것이 없습니다.';
    }
    const top = rec.heapAt(0).v;
    rec.say(`**가장 큰 값은 늘 루트(0번 칸)**에 있습니다. 찾을 것도 없이 꺼내면 됩니다.`);
    rec.heapFocus([0]);

    const last = rec.size - 1;
    if (last === 0) {
        rec.heapClear(0);
        rec.heapSetSize(0);
        return `${withJosa(top, '을를')} 꺼냈습니다. 이제 비었습니다.`;
    }

    rec.say('빈 루트를 메우려고 **맨 끝 값을 루트로 올립니다.** 빈틈이 가운데 남으면 '
        + '배열로 담을 수 없기 때문입니다.');
    rec.heapSwap(0, last);
    rec.heapClear(last);
    rec.heapSetSize(last);

    let i = 0;
    let swaps = 0;
    for (;;) {
        const l = 2 * i + 1;
        const r = 2 * i + 2;
        if (l >= rec.size) break;
        rec.say(`자식은 **2 × ${i} + 1 = ${l}번**${r < rec.size ? `과 ${r}번` : ''} 칸입니다.`);
        let big = l;
        if (r < rec.size && rec.heapCompare(r, l) > 0) big = r;
        if (rec.heapCompare(big, i) <= 0) {
            rec.say('자식이 더 크지 않으므로 **여기가 제자리입니다.**');
            rec.mark('settled');
            break;
        }
        rec.say('더 큰 자식과 자리를 바꿉니다.');
        rec.heapSwap(i, big);
        swaps++;
        i = big;
    }
    return `${withJosa(top, '을를')} 꺼냈습니다. **${swaps}번 내려갔습니다.**`;
}

function heapFind(rec, v) {
    rec.clearFlag();
    rec.clearEmitted();
    if (rec.size === 0) {
        rec.flag('비어 있습니다.');
        rec.mark('empty');
        return '비어 있어 찾을 것이 없습니다.';
    }
    rec.say(`힙은 **부모가 자식보다 크다는 것만** 지킵니다. 왼쪽·오른쪽 어느 쪽에 `
        + '있는지는 정해져 있지 않으므로, 가지를 버릴 수가 없습니다.');
    for (let i = 0; i < rec.size; i++) {
        if (rec.heapCompareValue(i, v) === 0) {
            rec.say(`${i}번 칸에서 찾았습니다.`);
            rec.mark('found');
            /* **일찍 찾은 경우에 「다 봐야 한다」고 말하지 않는다.** 학생이 맨 먼저 찾아보는
               값은 대개 화면에서 가장 큰 값인데, 그것은 늘 0번 칸이라 한 번에 걸린다.
               계수기에 「비교 1」이 떠 있는데 글이 「다 봐야 합니다」라고 하면 어긋난다. */
            return i === 0
                ? '루트에 있어 한 번에 찾았습니다. **가장 큰 값이라서 그렇습니다** — '
                  + '다른 값을 찾아보면 앞에서부터 하나씩 봐야 합니다.'
                : `${i + 1}칸째에서 찾았습니다. **가지를 버릴 수가 없어 앞에서부터 하나씩 봅니다** — `
                  + '힙이 잘하는 것은 「가장 큰 것 꺼내기」이지 「찾기」가 아닙니다.';
        }
    }
    rec.say(`${withJosa(v, '은는')} 없습니다.`);
    rec.mark('missing');
    return `${withJosa(v, '은는')} 없습니다. **${rec.size}칸을 모두 보았습니다.**`;
}

/* ---------------------------------------------------------------
   연산 목록
   --------------------------------------------------------------- */

export const bstOps = [
    {
        id: 'insert', name: '넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 넣을 자리를 **루트에서부터 비교하며** 찾아 내려갑니다.`,
        run: (rec, {v}) => bstInsert(rec, v),
        cost: () => 'O(높이)',
    },
    {
        id: 'search', name: '찾기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '이가')} 있는지 **루트에서부터** 비교하며 내려갑니다.`,
        run: (rec, {v}) => bstSearch(rec, v),
        cost: () => 'O(높이)',
    },
    {
        id: 'remove', name: '빼기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 찾아 지웁니다. **자식이 몇인지에 따라 하는 일이 다릅니다.**`,
        run: (rec, {v}) => bstRemove(rec, v),
        cost: () => 'O(높이)',
    },
    {
        id: 'pre', name: '전위 순회', arg: null,
        opening: () => '**루트 → 왼쪽 → 오른쪽** 차례로 순회합니다.',
        run: (rec) => traverse(rec, 'pre'),
        cost: () => 'O(n)',
    },
    {
        id: 'in', name: '중위 순회', arg: null,
        opening: () => '**왼쪽 → 루트 → 오른쪽** 차례로 순회합니다.',
        run: (rec) => traverse(rec, 'in'),
        cost: () => 'O(n)',
    },
    {
        id: 'post', name: '후위 순회', arg: null,
        opening: () => '**왼쪽 → 오른쪽 → 루트** 차례로 순회합니다.',
        run: (rec) => traverse(rec, 'post'),
        cost: () => 'O(n)',
    },
];

export const avlOps = [
    {
        id: 'insert', name: '넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 이진 탐색 트리와 **똑같이 넣은 뒤**, 균형이 무너졌으면 회전합니다.`,
        run: (rec, {v}) => avlInsert(rec, v),
        cost: () => 'O(log n)',
    },
    {
        id: 'search', name: '찾기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 찾습니다. 하는 일은 이진 탐색 트리와 같습니다 — **높이가 다를 뿐입니다.**`,
        run: (rec, {v}) => bstSearch(rec, v),
        cost: () => 'O(log n)',
    },
    {
        id: 'remove', name: '빼기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 지운 뒤 **루트까지 올라가며** 균형을 봅니다.`,
        run: (rec, {v}) => bstRemove(rec, v, {rebalance: true}),
        cost: () => 'O(log n)',
    },
    {
        id: 'in', name: '중위 순회', arg: null,
        opening: () => '**왼쪽 → 루트 → 오른쪽** 차례로 순회합니다. 회전한 뒤에도 오름차순인지 보세요.',
        run: (rec) => traverse(rec, 'in'),
        cost: () => 'O(n)',
    },
];

export const heapOps = [
    {
        id: 'insert', name: '넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} **배열 맨 끝에 놓고 부모와 비교하며 올라갑니다.**`,
        run: (rec, {v}) => heapInsert(rec, v),
        cost: () => 'O(log n)',
    },
    {
        id: 'extract', name: '가장 큰 값 꺼내기', arg: null,
        opening: () => '**루트(0번 칸)**를 꺼내고 빈자리를 메웁니다.',
        run: (rec) => heapExtract(rec),
        cost: () => 'O(log n)',
    },
    {
        id: 'find', name: '값 찾기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '이가')} 어디 있는지 찾습니다. **힙이 잘 못하는 일입니다.**`,
        run: (rec, {v}) => heapFind(rec, v),
        cost: () => 'O(n)',
    },
];

/* ---------------------------------------------------------------
   비용 비교 — 같은 값을 두 트리에 함께 넣는다
   --------------------------------------------------------------- */

/** 한 번에 여러 개를 넣는다. **오름차순으로 넣어 봐야 두 트리가 갈린다.** */
function insertMany(rec, values, {rebalance}) {
    for (const v of values) {
        rec.say(`${withJosa(v, '을를')} 넣습니다.`);
        if (rebalance) avlInsert(rec, v); else bstInsert(rec, v);
    }
    const h = treeHeight(rec.state);
    return `${values.length}개를 넣었습니다. **높이가 ${h}입니다.**`;
}

/** 비용 비교 탭이 쓰는 연산. `pair`에 이진 탐색 트리용·AVL용이 들어 있다. */
export const treeCompareOps = [
    {
        id: 'insert-asc', name: '비우고 오름차순으로 여덟 개 넣기', arg: null,
        /* **빈 트리에서 시작한다.** 이미 값이 든 트리에 여덟 개를 더 넣으면 한 줄이
           되지 않는다 — 새 값들이 기존 노드 아래로 흩어져 연결되기 때문이다.
           그런데 이 버튼이 보이려는 장면이 바로 「한 줄로 이어진 편향 트리가 된다」이므로,
           **비우지 않으면 카드가 말한 것과 정반대 화면이 나온다.**
           그래서 비우는 것을 버튼 이름에 적고 화면에서도 그렇게 한다. */
        clears: true,
        opening: () => '두 트리를 **비우고** 시작합니다. **이미 정렬된 자료**를 차례대로 '
            + '넣어 봅니다 — 흔한 일입니다. 학번 · 날짜 · 번호는 대개 정렬된 채로 들어옵니다.',
        pair: {
            bst: {
                run: (rec) => insertMany(rec, ASC_BATCH, {rebalance: false}),
                opening: () => '이진 탐색 트리에 오름차순으로 넣습니다.',
            },
            avl: {
                run: (rec) => insertMany(rec, ASC_BATCH, {rebalance: true}),
                opening: () => 'AVL 트리에 오름차순으로 넣습니다.',
            },
        },
    },
    {
        id: 'insert', name: '한 개 넣기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 두 트리에 함께 넣습니다.`,
        pair: {
            bst: {run: (rec, {v}) => bstInsert(rec, v)},
            avl: {run: (rec, {v}) => avlInsert(rec, v)},
        },
    },
    {
        id: 'search', name: '찾기', arg: 'value',
        opening: (rec, {v}) => `${withJosa(v, '을를')} 두 트리에서 함께 찾습니다. **비교 횟수를 보세요.**`,
        pair: {
            bst: {run: (rec, {v}) => bstSearch(rec, v)},
            avl: {run: (rec, {v}) => bstSearch(rec, v)},
        },
    },
];

/** 간판 버튼이 넣는 여덟 개. **늘 같은 값이다** — 볼 때마다 달라지면 비교할 수가 없다. */
export const ASC_BATCH = [10, 20, 30, 40, 50, 60, 70, 80];

/* ---------------------------------------------------------------
   처음 상태 세우기
   ---------------------------------------------------------------

   **값 목록이 아니라 「넣은 차례」를 물려받아 다시 넣는다.** 트리는 넣는 순서가 모양을
   정하므로, 담긴 값만 물려주면 탭을 옮기는 것만으로 모양이 달라진다. 특히 중위 순회로
   뽑은 값은 오름차순이라, 그것을 이진 탐색 트리에 다시 넣으면 **한 줄로 이어진 편향 트리**가
   된다 — 아무것도 안 했는데 최악이 되어 버린다.

   그리고 **화면에서 쓰는 바로 그 연산으로 세운다.** 따로 만들면 처음 모습과
   손으로 넣어 만든 모습이 어긋날 수 있다. */

export function bstBuild(values) {
    let s = treeLinkedState([], {balanced: false});
    for (const v of values) s = runTreeOperation(bstOps[0], s, {v}).state;
    return s;
}

export function avlBuild(values) {
    let s = treeLinkedState([], {balanced: true});
    for (const v of values) s = runTreeOperation(avlOps[0], s, {v}).state;
    return s;
}

export function heapBuild(values, cap) {
    let s = heapState([], cap);
    for (const v of values) s = runTreeOperation(heapOps[0], s, {v}).state;
    return s;
}

export {bstInsert, avlInsert, bstSearch, treeHeight};
