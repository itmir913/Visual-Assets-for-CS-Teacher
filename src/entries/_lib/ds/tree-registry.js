/* 어떤 트리를 싣는지 정하는 **유일한 곳.**
 *
 * **무리를 「무엇에 쓰는 트리인가」로 가른다.** 「트리 세 가지」라고 늘어놓으면
 * 학생은 셋이 서로 대신할 수 있는 것으로 여긴다. 실제로는 묻는 질문이 다르다 —
 * 이진 탐색 트리와 AVL 트리는 **「이 값이 어디 있나」**에 답하고,
 * 힙은 **「지금 가장 큰 것이 무엇이냐」**에 답한다. 힙에서 값을 찾아 보면
 * 하나씩 다 봐야 한다는 것이 바로 드러난다.
 */

import {treeLinkedState, heapState} from './tree-model.js';
import {
    bstOps, avlOps, heapOps, treeCompareOps, bstBuild, avlBuild, heapBuild,
} from './tree-ops.js';

/** 힙의 칸 수. 4층까지 그리면 잎이 여덟이라 화면 폭에 들어간다. */
export const HEAP_CAP = 15;

/** 처음에 들어 있는 값. **넣는 차례 그대로다** — 트리는 차례가 모양을 정한다.
 *  이 차례로 넣으면 이진 탐색 트리가 높이 3의 반듯한 모양이 되어, 「최악」과 대 볼 밑그림이 된다. */
export const TREE_START = [50, 30, 70, 20, 40, 60, 80];

export const TREE_GROUPS = [
    {
        id: 'search',
        name: '찾기 위한 트리',
        blurb: '**「이 값이 어디 있나」**에 답하는 트리입니다. 왼쪽은 작고 오른쪽은 크다는 '
            + '규칙 하나로, 한 번 비교할 때마다 **볼 곳이 반으로 줄어듭니다.** '
            + '다만 그 이득은 트리가 반듯할 때의 이야기입니다 — 넣는 차례가 나쁘면 '
            + '한 줄로 늘어져 훑기와 다를 바가 없어집니다.',
    },
    {
        id: 'priority',
        name: '꺼내기 위한 트리',
        blurb: '**「지금 가장 큰 것이 무엇이냐」**에 답하는 트리입니다. 전부 줄 세우지 않고 '
            + '«맨 위 하나»만 늘 맞게 두므로 넣고 꺼내는 값이 쌉니다. '
            + '대신 **찾기는 잘 못합니다** — 왼쪽·오른쪽 어느 쪽에 있는지가 정해져 있지 않아 '
            + '가지를 버릴 수가 없습니다.',
    },
    {
        id: 'compare',
        name: '비용 비교',
        blurb: '같은 값을 **같은 차례로** 두 트리에 넣어 나란히 봅니다. '
            + '「최악에 O(n)」이라는 말이 무슨 뜻인지, 그리고 AVL 트리가 그것을 막으려고 '
            + '무엇을 치르는지가 여기서 그림이 됩니다.',
    },
];

const bstStruct = {
    id: 'bst',
    name: '이진 탐색 트리',
    en: 'Binary Search Tree',
    group: 'search',
    view: 'linked',
    ops: bstOps,
    makeState: (values) => bstBuild(values),
    idea: '값을 담은 상자 하나를 **마디(노드, node)**라 하고, 마디끼리 이어 주는 것을 '
        + '**링크(포인터)**라고 합니다. 마디마다 '
        + '**왼쪽 가지에는 자기보다 작은 값만, 오른쪽 가지에는 큰 값만** 둡니다. '
        + '그래서 찾을 때 한 번 비교할 때마다 **반대쪽 가지를 통째로 버릴 수 있습니다.** '
        + '넣는 것도 찾는 것과 같은 길을 내려가 빈자리에 매다는 일입니다.',
    watch: '**넣는 차례를 바꿔 보세요.** 「비우기」를 누르고 10 · 20 · 30 · 40을 차례로 넣으면 '
        + '트리가 **한 줄로 늘어집니다.** 이때는 찾기가 훑기와 다를 바 없습니다 — '
        + '이것이 「최악에 O(n)」의 정체입니다. 정렬된 자료가 들어오는 일은 드물지 않습니다. '
        + '그리고 **중위 순회**를 눌러 보세요. 나온 값이 오름차순입니다.',
    costRows: [
        ['찾기 · 넣기 · 빼기', 'O(높이)', '한 층 내려갈 때마다 한 번 비교한다'],
        ['반듯할 때의 높이', 'O(log n)', '층마다 마디 수가 두 배가 된다'],
        ['한 줄로 늘어졌을 때', 'O(n)', '가지를 버릴 수가 없다'],
        ['순회', 'O(n)', '모든 마디를 한 번씩 지난다'],
    ],
    facts: [
        {on: true, text: '중위 순회가 곧 정렬', hint: '왼쪽 → 뿌리 → 오른쪽으로 훑으면 오름차순이 나옵니다'},
        {on: false, text: '모양이 넣는 차례를 탄다', hint: '정렬된 자료를 넣으면 한 줄로 늘어집니다'},
    ],
};

const avlStruct = {
    id: 'avl',
    name: 'AVL 트리',
    en: 'AVL Tree',
    group: 'search',
    view: 'linked-balance',
    ops: avlOps,
    makeState: (values) => avlBuild(values),
    idea: '이진 탐색 트리와 **규칙도 연산도 같습니다.** 하나만 더 지킵니다 — '
        + '어느 마디에서든 **왼쪽 높이와 오른쪽 높이의 차이가 1을 넘지 않게** 합니다. '
        + '넣거나 뺀 뒤 그 차이가 2가 되면 **회전**으로 폅니다. '
        + '마디 옆의 수가 그 차이(균형 인수)입니다.',
    watch: '「비우기」를 누르고 10 · 20 · 30을 차례로 넣어 보세요. 30을 넣는 순간 **돌아갑니다.** '
        + '이어서 10 · 30 · 20으로 다시 해 보면 **두 번 돌립니다** — 한쪽으로 곧게 기울면 '
        + '한 번에 펴지지만, 꺾여 기울면 먼저 곧게 편 뒤에야 펴집니다. '
        + '**회전이 공짜가 아니라는 것도 보세요** — 돌리기 한 번에 링크를 세 줄 고쳐 씁니다'
        + '(계수기에는 새 마디를 매다는 링크가 더해집니다). '
        + '그리고 돌린 뒤 **중위 순회**를 해 보세요. 자리는 바뀌었는데 **차례는 그대로**입니다.',
    costRows: [
        ['찾기 · 넣기 · 빼기', 'O(log n)', '높이가 늘 log n 언저리로 눌려 있다'],
        ['넣을 때의 펴기', '많아야 한 곳', '한 곳만 펴면 높이가 되돌아온다'],
        ['그 한 곳을 펴는 데', '돌리기 1~2번', '한쪽으로 기울면 한 번, 꺾여 기울면 두 번'],
        ['뺄 때의 펴기', 'O(log n)곳', '뿌리까지 올라가며 봐야 한다'],
        ['순회', 'O(n)', '모든 마디를 한 번씩 지난다'],
    ],
    facts: [
        {on: true, text: '최악에도 O(log n)', hint: '넣는 차례가 어떻든 높이가 눌려 있습니다'},
        {on: false, text: '고칠 링크가 늘어난다', hint: '균형을 지키려고 회전할 때마다 링크를 세 번 고칩니다'},
    ],
};

const heapStruct = {
    id: 'heap',
    name: '힙',
    en: 'Heap',
    group: 'priority',
    view: 'heap',
    ops: heapOps,
    makeState: (values) => heapBuild(values, HEAP_CAP),
    idea: '**부모가 자식보다 크다**는 것 하나만 지킵니다(최대 힙). 형제끼리는 아무 차례가 없어 '
        + '완전히 줄 세운 것이 아닌데, 그 덕에 넣고 꺼내는 값이 쌉니다. '
        + '그리고 **모양이 늘 빈틈없이 채워지므로 평범한 배열에 담깁니다** — '
        + '부모와 자식은 링크가 아니라 자리 번호 계산으로 잇습니다.',
    watch: '**트리와 배열을 함께 보세요.** 같은 것을 두 가지로 그린 것입니다. '
        + '마디 위의 작은 수가 배열의 자리 번호이고, `(자리 − 1) ÷ 2`가 부모, '
        + '`2 × 자리 + 1`이 왼쪽 자식입니다. '
        + '**「값 찾기」로 «가장 큰 값이 아닌» 값을 찾아 보세요** — 이진 탐색 트리와 달리 '
        + '앞에서부터 하나씩 봅니다(가장 큰 값만은 늘 뿌리에 있어 한 번에 걸립니다). '
        + '힙이 잘하는 것은 「가장 큰 것 꺼내기」이지 「찾기」가 아닙니다.',
    costRows: [
        ['넣기', 'O(log n)', '부모와 비교하며 올라간다'],
        ['가장 큰 값 꺼내기', 'O(log n)', '뿌리를 꺼내고 자식과 비교하며 내려간다'],
        ['가장 큰 값 보기', 'O(1)', '늘 0번 칸에 있다'],
        ['값 찾기', 'O(n)', '가지를 버릴 수가 없어 다 본다'],
    ],
    facts: [
        {on: true, text: '배열 하나면 된다', hint: '링크를 쓰지 않고 자리 번호 계산으로 잇습니다'},
        {on: false, text: '찾기는 못한다', hint: '형제끼리 차례가 없어 어느 가지에 있는지 알 수 없습니다'},
    ],
};

export const TREE_STRUCTS = [bstStruct, avlStruct, heapStruct];

/* **비용 비교는 트리가 아니다.** 그래도 탭에는 나와야 하므로 구조처럼 생긴 항목을 하나 둔다. */
export const TREE_COMPARE = {
    id: 'compare',
    name: '나란히 놓기',
    en: 'Side by Side',
    group: 'compare',
    view: 'compare',
    ops: treeCompareOps,
    idea: '위는 **이진 탐색 트리**, 아래는 **AVL 트리**입니다. 같은 값을 같은 차례로 받습니다. '
        + '「비우고 오름차순으로 여덟 개 넣기」를 눌러 보면 위쪽은 **한 줄로 늘어지고** '
        + '아래쪽은 반듯하게 남습니다. 그 단추는 이름 그대로 **두 트리를 먼저 비웁니다** — '
        + '이미 값이 든 트리에 더 넣으면 새 값들이 기존 마디 아래로 흩어져 한 줄이 되지 않습니다.',
    watch: '한 줄로 늘어진 트리에서 **찾기**를 해 보세요. 비교 횟수가 마디 수만큼 듭니다. '
        + '**AVL 트리가 늘 이기는 것은 아닙니다** — 섞여 들어오는 자료에서는 이진 탐색 트리도 '
        + '충분히 반듯해서, 돌리는 값만큼 손해입니다. '
        + '**어느 쪽에 먼저 「끝」이 붙는지는 판마다 다릅니다** — 늘어진 트리에서는 '
        + '내려가며 비교하는 횟수가 워낙 많아 AVL이 먼저 끝나기도 합니다. '
        + '아래 표에서 「섞어서 넣기」 줄과 「오름차순」 줄을 대 보세요.',
    costRows: [
        ['찾기 · 오름차순 자료', '이진 탐색 트리 O(n) · AVL O(log n)', '한 줄이냐 반듯하냐'],
        ['찾기 · 섞인 자료', '둘 다 O(log n) 언저리', '섞여 있으면 그냥도 반듯해진다'],
        ['넣기의 값', '판에 따라 다르다', '돌리는 값이 붙지만 트리가 낮으면 비교가 줄어 상쇄된다'],
    ],
    facts: [],
};

export const TREE_TABS = [...TREE_STRUCTS, TREE_COMPARE];

export function treeStructById(id) {
    return TREE_TABS.find((s) => s.id === id) || null;
}

export function treeStructsOfGroup(groupId) {
    return TREE_TABS.filter((s) => s.group === groupId);
}

export function treeGroupById(id) {
    return TREE_GROUPS.find((g) => g.id === id) || null;
}

export function treeGroupsInUse() {
    return TREE_GROUPS.filter((g) => treeStructsOfGroup(g.id).length > 0);
}

/** 비용 비교가 쓰는 두 상태. **등록부의 것을 그대로 쓴다** — 여기서 따로 만들면
 *  탭을 옮겼을 때 같은 트리가 다르게 굴 수 있다. */
export function treeComparePair(values) {
    return {bst: bstStruct.makeState(values), avl: avlStruct.makeState(values)};
}

/** 표를 재는 데 쓰는 「넣기」 두 벌. */
export const TREE_INSERT_OPS = {bstInsert: bstOps[0], avlInsert: avlOps[0]};

export {treeLinkedState, heapState};
