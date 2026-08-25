/* 어떤 자료구조를 싣는지 정하는 **유일한 곳.**
 *
 * 탭바도, 연산 단추도, 비용 표도, 검사도 전부 여기서 읽는다 —
 * 구조를 하나 더하면 화면에도 검사에도 저절로 딸려 온다.
 *
 * **무리를 「담는 방식」과 「쓰는 규칙」으로 가른다.** 이름표를 붙이려는 것이 아니라
 * 학생이 실제로 헷갈리는 자리가 거기이기 때문이다. 배열과 연결 리스트는
 * **무엇으로 담는가**에 대한 답이고, 스택과 큐는 **어떻게 쓰기로 정했는가**에 대한 답이다.
 * 층이 다른 둘을 한 줄에 늘어놓으면 「스택 대신 배열을 쓴다」 같은 말이 성립하는 것처럼
 * 보인다 — 스택은 배열로도 연결 리스트로도 만들 수 있는데도.
 *
 * 그래서 스택 · 큐 · 덱에는 **담는 방식을 바꾸는 단추**를 둔다. 같은 규칙을 두 방식으로
 * 만들어 보면 그 층이 다르다는 것이 말이 아니라 화면으로 드러난다.
 */

import {dsArrayState, dsListState} from './ds-model.js';
import {
    dsArrayOps, dsListOps, dsStackOps, dsQueueOps, dsDequeOps, dsRingOps,
} from './ds-ops.js';

/** 칸을 몇 개 두는가. 375px에서 한 칸이 글자를 담을 수 있는 한계가 이 언저리다. */
export const DS_CAP = 10;

/** 처음에 들어 있는 값. **구조마다 다르게 두지 않는다** — 같은 자료를 여러 구조에
 *  넣어 보는 것이 이 페이지의 쓰임이라, 처음 모습이 같아야 견줄 수 있다. */
export const DS_START = [17, 42, 8, 23];

const arrayOpList = [
    dsArrayOps.insertFront, dsArrayOps.insertBack, dsArrayOps.insertAt,
    dsArrayOps.removeFront, dsArrayOps.removeBack, dsArrayOps.removeAt,
    dsArrayOps.readAt, dsArrayOps.find,
];

const listOpList = [
    dsListOps.insertFront, dsListOps.insertBack, dsListOps.insertAt,
    dsListOps.removeFront, dsListOps.removeBack, dsListOps.removeAt,
    dsListOps.readAt, dsListOps.find,
];

export const DS_GROUPS = [
    {
        id: 'store',
        name: '담는 방식',
        blurb: '값을 **어디에 어떻게 늘어놓는가**에 대한 답입니다. '
            + '배열은 칸을 붙여 놓고 자리 번호로 짚고, 연결 리스트는 마디를 흩어 놓고 '
            + '링크로 잇습니다. 여기서 갈린 성질이 아래 「쓰는 규칙」의 비용을 정합니다.',
    },
    {
        id: 'adt',
        name: '쓰는 규칙',
        blurb: '값을 **어느 자리에서만 넣고 뺄지 정해 둔** 것입니다. '
            + '규칙이 정해지면 쓰는 쪽은 안이 어떻게 생겼는지 몰라도 됩니다 — '
            + '그래서 같은 스택을 배열로도 연결 리스트로도 만들 수 있습니다. '
            + '**담는 방식 단추로 바꾸어 보세요.** 하는 일은 같고 드는 값이 달라집니다.',
    },
    {
        id: 'compare',
        name: '비용 비교',
        blurb: '같은 연산을 **배열과 연결 리스트에 동시에** 시켜 나란히 봅니다. '
            + '한 구조만 볼 때는 숫자로만 남던 차이가, 나란히 놓으면 어느 쪽이 어디서 '
            + '값을 치르는지로 드러납니다.',
    },
];

/* ---------------------------------------------------------------
   담는 방식
   --------------------------------------------------------------- */

const arrayStruct = {
    id: 'array',
    name: '배열',
    en: 'Array',
    group: 'store',
    view: 'array',
    ops: arrayOpList,
    makeState: (values) => dsArrayState(DS_CAP, values),
    idea: '칸을 **빈틈없이 붙여 놓고** 자리 번호로 짚습니다. 칸의 크기가 모두 같아서 '
        + '「시작 주소 + 자리 번호 × 칸 크기」로 몇 번째든 **한 번에** 찾아갑니다. '
        + '대신 가운데에 넣거나 빼면 **빈틈이 생기지 않게 뒤엣것을 모두 밀어야** 합니다.',
    watch: '「앞에 넣기」와 「뒤에 넣기」를 번갈아 눌러 보세요. 넣는 값은 하나로 같은데 '
        + '**옮김 횟수가 전혀 다릅니다.** 배열이 느린 것이 아니라 **어디에 넣느냐가** 값을 정합니다. '
        + '「k번째 읽기」는 k를 아무리 키워도 접근이 1입니다 — 이것이 배열의 무기입니다.',
    costRows: [
        ['앞에 넣기 · 빼기', 'O(n)', '뒤엣것을 전부 민다'],
        ['뒤에 넣기 · 빼기', 'O(1)', '밀 것이 없다'],
        ['k번째 읽기', 'O(1)', '자리 번호로 바로 짚는다'],
        ['값 찾기', 'O(n)', '앞에서부터 훑는다'],
    ],
    facts: [
        {on: true, text: '자리 번호로 바로 짚기', hint: '몇 번째를 묻든 한 번에 찾아갑니다'},
        {on: false, text: '칸 수가 정해져 있음', hint: '미리 잡아 둔 칸을 다 쓰면 더 넣을 수 없습니다'},
    ],
};

const singlyStruct = {
    id: 'slist',
    name: '단일 연결 리스트',
    en: 'Singly Linked List',
    group: 'store',
    view: 'list',
    ops: listOpList,
    makeState: (values) => dsListState(values, {doubly: false, hasTail: false}),
    idea: '값과 **다음 마디의 자리**를 함께 담은 **마디(노드, node)**를 링크로 잇습니다. '
        + '「다음 마디의 자리」를 담은 값을 **링크(포인터)**라고 합니다. '
        + '마디들이 붙어 있을 필요가 없으므로 넣고 빼는 데 **미는 일이 없고**, '
        + '칸 수를 미리 정해 둘 일도 없습니다. 대신 **자리 번호로 짚을 수가 없어** '
        + 'k번째를 보려면 머리부터 링크를 따라가야 합니다.',
    watch: '「뒤에 넣기」를 눌러 보세요. **넣는 일 자체는 링크 두 줄인데 거기까지 가는 데 '
        + '접근이 마디 수만큼** 듭니다. 이 구조는 꼬리 포인터를 두지 않았습니다 — '
        + '「이중 연결 리스트」와 대 보면 포인터 하나가 무엇을 바꾸는지 보입니다.',
    costRows: [
        ['앞에 넣기 · 빼기', 'O(1)', '머리 포인터만 고친다'],
        ['뒤에 넣기 · 빼기', 'O(n)', '끝까지 따라가야 한다'],
        ['k번째 읽기', 'O(n)', '머리부터 링크를 따라간다'],
        ['값 찾기', 'O(n)', '앞에서부터 훑는다'],
    ],
    facts: [
        {on: true, text: '넣고 뺄 때 밀지 않음', hint: '고치는 것은 링크뿐이라 원소는 제자리에 있습니다'},
        {on: false, text: '자리 번호로 못 짚음', hint: 'k번째를 보려면 처음부터 따라가야 합니다'},
    ],
};

const doublyStruct = {
    id: 'dlist',
    name: '이중 연결 리스트',
    en: 'Doubly Linked List',
    group: 'store',
    view: 'list',
    ops: listOpList,
    makeState: (values) => dsListState(values, {doubly: true}),
    idea: '마디마다 **되돌아가는 링크**를 하나 더 두고, 마지막 마디를 가리키는 '
        + '**꼬리 포인터**도 둡니다. 링크를 고칠 자리가 늘어나는 대신 '
        + '뒤에서 넣고 빼는 일과 거꾸로 훑는 일이 단번에 됩니다.',
    watch: '「뒤에서 빼기」를 단일 연결 리스트와 번갈아 해 보세요. 단일 쪽은 **앞마디를 '
        + '알 수 없어** 처음부터 다시 따라가야 하지만, 이쪽은 **꼬리 포인터로 끝에 가서 '
        + '되돌아가는 링크로 앞마디까지** 곧장 알아냅니다(더한 것이 둘입니다). '
        + '마디가 한둘일 때는 이득이 없거나 오히려 한 번 더 듭니다 — 개수를 늘려 보세요. '
        + '대신 넣고 뺄 때마다 **고치는 링크가 더 많습니다** — 공짜로 얻은 것이 아닙니다.',
    costRows: [
        ['앞에 넣기 · 빼기', 'O(1)', '머리 포인터만 고친다'],
        ['뒤에 넣기 · 빼기', 'O(1)', '꼬리 포인터로 곧장 간다'],
        ['k번째 읽기', 'O(n)', '여전히 따라가야 한다'],
        ['값 찾기', 'O(n)', '앞에서부터 훑는다'],
    ],
    facts: [
        {on: true, text: '양쪽 끝이 모두 싸다', hint: '머리와 꼬리를 다 들고 있습니다'},
        {on: false, text: '링크를 두 배로 고침', hint: '마디마다 링크가 둘이라 고칠 자리도 늘어납니다'},
    ],
};

/* ---------------------------------------------------------------
   쓰는 규칙
   --------------------------------------------------------------- */

/** 담는 방식을 바꿀 수 있는 구조가 쓰는 틀. */
function adtStruct(spec) {
    return {
        group: 'adt',
        /* **단추 이름을 구조마다 정한다.** 「연결 리스트로 담기」라고만 적어 두었더니
           스택은 머리 포인터만 있는 리스트, 큐는 꼬리 포인터까지 있는 리스트, 덱은 이중
           연결 리스트인데 **셋의 단추 이름이 같았다.** 같은 이름이 다른 구조를 가리키면
           학생은 그것들이 같은 것이라고 배운다. */
        impls: [
            {id: 'array', name: '배열로 담기', view: 'array', ops: spec.ops.array},
            {
                id: 'list',
                name: spec.listName || '연결 리스트로 담기',
                view: 'list',
                ops: spec.ops.list,
            },
        ],
        makeState: (values, implId) => (implId === 'list'
            ? dsListState(values, spec.listOpts || {doubly: false, hasTail: true})
            : dsArrayState(DS_CAP, values)),
        ...spec,
    };
}

/** 끝이 어디인지 늘 붙여 두는 이름표. 배열로 담았을 때만 쓴다 —
 *  마디로 담으면 머리·꼬리 포인터가 그 노릇을 한다. */
const endsOf = (names) => (st) => (st.store !== 'array' || st.size === 0 ? [] : names(st));

const stackStruct = adtStruct({
    id: 'stack',
    endMarks: endsOf((st) => [{at: st.size - 1, name: 'top'}, {at: 0, name: 'bottom'}]),
    name: '스택',
    en: 'Stack',
    ops: dsStackOps,
    listOpts: {doubly: false, hasTail: false},
    idea: '**한쪽 끝에서만** 넣고 뺍니다. 마지막에 넣은 것이 가장 먼저 나오므로 '
        + '**후입선출(LIFO)**이라고 합니다. 접시를 쌓았다가 위에서부터 걷어 내는 것과 같습니다.',
    watch: '담는 방식을 바꿔 가며 눌러 보세요. **배열로 담아도 미는 일이 없습니다** — '
        + '넣고 빼는 자리가 늘 끝이기 때문입니다. 「앞에 넣기」가 비싼 배열이 스택에서는 '
        + '아무 값도 치르지 않는다는 것이, 규칙이 비용을 정한다는 말의 뜻입니다.',
    costRows: [
        ['넣기 (push)', 'O(1)', '끝에만 얹는다'],
        ['빼기 (pop)', 'O(1)', '끝에서만 걷는다'],
        ['꼭대기 보기 (peek)', 'O(1)', '끝이 어디인지 늘 안다'],
    ],
    facts: [
        {on: true, text: '후입선출 (LIFO)', hint: '마지막에 넣은 것이 가장 먼저 나옵니다'},
        {on: false, text: '가운데를 못 본다', hint: '꼭대기 말고는 들여다볼 수 없게 정해 둔 규칙입니다'},
    ],
});

const queueStruct = adtStruct({
    id: 'queue',
    endMarks: endsOf((st) => [{at: 0, name: 'front'}, {at: st.size - 1, name: 'rear'}]),
    name: '큐',
    en: 'Queue',
    ops: dsQueueOps,
    listOpts: {doubly: false, hasTail: true},
    listName: '연결 리스트로 담기 (꼬리 포인터를 둔다)',
    idea: '**넣는 끝과 빼는 끝이 다릅니다.** 먼저 넣은 것이 먼저 나오므로 '
        + '**선입선출(FIFO)**이라고 합니다. 매표소 줄과 같습니다. '
        + '연결 리스트로 담을 때는 **마지막 마디를 가리키는 꼬리 포인터를 함께 둡니다** — '
        + '그것이 없으면 뒤에 세울 때마다 줄 끝까지 따라가야 합니다.',
    watch: '배열로 담아 「빼기」를 눌러 보세요. 맨 앞이 빠지고 나면 **뒤에 선 사람이 모두 '
        + '한 칸씩 앞으로 당겨집니다.** 줄이 길수록 값이 커집니다. '
        + '이 낭비를 없애려고 만든 것이 다음 탭의 **원형 큐**입니다. '
        + '연결 리스트로 담아 보면 당기는 일 자체가 사라지는 것도 확인해 보세요.',
    costRows: [
        ['넣기 (enqueue) · 배열', 'O(1)', '빈 뒤칸에 쓴다'],
        ['넣기 (enqueue) · 연결 리스트', 'O(1)', '꼬리 포인터로 곧장 간다'],
        ['빼기 (dequeue) · 배열', 'O(n)', '뒤엣것을 모두 당긴다'],
        ['빼기 (dequeue) · 연결 리스트', 'O(1)', '머리 포인터만 옮긴다'],
    ],
    facts: [
        {on: true, text: '선입선출 (FIFO)', hint: '먼저 넣은 것이 먼저 나옵니다'},
        {on: false, text: '이렇게 담으면 빼기가 비싸다', hint: '배열에 앞에서부터 담으면 맨 앞이 빠진 자리를 메우려고 모두 당깁니다. 다음 탭의 원형 큐가 그것을 없앱니다'},
    ],
});

const ringStruct = {
    id: 'ring',
    name: '원형 큐',
    en: 'Circular Queue',
    group: 'adt',
    view: 'ring',
    ops: dsRingOps,
    /** 원형 큐만은 담는 방식을 고를 수 없다. **배열이라서 생긴 문제를 배열 안에서
     *  푸는 것**이 이 구조의 전부라, 연결 리스트로 담으면 있을 까닭이 없어진다. */
    makeState: (values) => dsArrayState(DS_CAP, values, {
        ring: true,
        front: 0,
        rear: values.length % DS_CAP,
    }),
    idea: '칸을 **동그랗게 이어 붙였다고 치고** 씁니다. 실제로는 그냥 배열이고, '
        + '끝 칸을 지나면 자리 번호를 0으로 되돌릴 뿐입니다(`(자리 + 1) % 칸수`). '
        + '**front와 rear라는 자리 번호 둘**이 줄의 앞뒤를 가리킵니다. '
        + '다만 둘만으로는 «비었다»와 «꽉 찼다»를 가를 수 없어(둘 다 front와 rear가 같습니다) '
        + '**개수를 따로 세어 둡니다.**',
    watch: '넣기와 빼기를 여러 번 눌러 **front와 rear가 끝을 지나 0으로 돌아오는 것**을 보세요. '
        + '앞 탭의 큐와 견주면 요점이 뚜렷합니다 — **당기는 일이 아예 없습니다.** '
        + '움직이는 것은 원소가 아니라 자리 번호입니다. '
        + '다만 칸 수는 그대로라, 꽉 차면 여전히 더 넣을 수 없습니다.',
    costRows: [
        ['넣기 (enqueue)', 'O(1)', 'rear 자리에 쓰고 한 칸 돌린다'],
        ['빼기 (dequeue)', 'O(1)', 'front를 한 칸 돌린다'],
        ['맨 앞 보기 (peek)', 'O(1)', 'front 자리를 바로 짚는다'],
    ],
    facts: [
        {on: true, text: '당기는 일이 없다', hint: '원소가 아니라 자리 번호가 움직입니다'},
        {on: false, text: '칸 수는 그대로', hint: '자리를 돌려 쓸 뿐이라 담을 수 있는 개수는 늘지 않습니다'},
    ],
};

const dequeStruct = adtStruct({
    id: 'deque',
    endMarks: endsOf((st) => [{at: 0, name: 'front'}, {at: st.size - 1, name: 'rear'}]),
    name: '덱',
    en: 'Deque',
    ops: dsDequeOps,
    listOpts: {doubly: true},
    listName: '이중 연결 리스트로 담기',
    idea: '**양쪽 끝에서 모두** 넣고 뺄 수 있습니다. 스택처럼도 큐처럼도 쓸 수 있어 '
        + '「양방향 큐」라고도 합니다. 어느 끝을 쓸지는 쓰는 쪽이 그때그때 정합니다.',
    watch: '**이 시뮬레이터의 배열 판은 앞쪽 끝이 비쌉니다** — 앞에 넣으려면 밀어야 하니까요. '
        + '이중 연결 리스트로 담으면 양쪽이 모두 싸집니다. '
        + '**다만 배열이라서 비싼 것은 아닙니다** — 앞 탭의 원형 큐처럼 자리 번호를 돌려 쓰면 '
        + '배열로도 양쪽 끝을 싸게 만들 수 있습니다. 여기서는 미는 쪽만 보입니다. '
        + '**덱을 쓰겠다고 정하는 것과 무엇으로 담을지 정하는 것은 다른 결정**이라는 것이 '
        + '여기서 가장 뚜렷하게 보입니다.',
    costRows: [
        ['앞에 넣기 · 빼기 · 배열', 'O(n)', '뒤엣것을 민다'],
        ['앞에 넣기 · 빼기 · 이중 연결 리스트', 'O(1)', '머리 포인터만 고친다'],
        ['앞에 넣기 · 빼기 · 원형으로 쓴 배열', 'O(1)', '앞 탭의 수를 쓰면 밀지 않아도 된다'],
        ['뒤에 넣기 · 빼기', 'O(1)', '양쪽 다 끝을 알고 있다'],
    ],
    facts: [
        {on: true, text: '양쪽 끝을 다 쓴다', hint: '스택으로도 큐로도 쓸 수 있습니다'},
        {on: false, text: '담는 방식을 탄다', hint: '배열로 담으면 앞쪽 끝이 비쌉니다'},
    ],
});

/* ---------------------------------------------------------------
   등록부
   --------------------------------------------------------------- */

export const DS_STRUCTS = [
    arrayStruct, singlyStruct, doublyStruct,
    stackStruct, queueStruct, ringStruct, dequeStruct,
];

/* **비용 비교는 자료구조가 아니다.** 그래도 탭에는 나와야 하므로 구조처럼 생긴 항목을
   하나 둔다. `DS_STRUCTS`에는 넣지 않는다 — 넣으면 비용 비교가 자기 자신과 비교된다. */
export const DS_COMPARE = {
    id: 'compare',
    name: '나란히 놓기',
    en: 'Side by Side',
    group: 'compare',
    view: 'compare',
    /* **연산 이름을 배열 쪽과 리스트 쪽이 나눠 쓴다.** 등록부에서 이름을 다시 적지 않고
       배열 쪽 정의를 그대로 쓰되, 돌릴 것은 둘을 짝지어 들고 있는다 —
       이름이 같아야 「같은 연산인데 값이 다르다」가 성립한다. */
    ops: ['insertFront', 'insertBack', 'removeFront', 'removeBack', 'readAt', 'find']
        .map((key) => ({...dsArrayOps[key], pair: {array: dsArrayOps[key], list: dsListOps[key]}})),
    idea: '위는 **배열**, 아래는 **단일 연결 리스트**입니다. 같은 값을 담고 있고 '
        + '같은 연산을 한꺼번에 받습니다. 어느 쪽이 먼저 끝나는지, '
        + '그리고 **무엇을 하느라 오래 걸리는지**를 함께 보세요.',
    watch: '「앞에 넣기」에서는 배열이 밀리느라 오래 걸리고, 「k번째 읽기」에서는 '
        + '연결 리스트가 따라가느라 오래 걸립니다. **한쪽이 늘 빠른 것이 아니라 '
        + '무엇을 자주 하느냐가 고르는 기준이 됩니다.** '
        + '아래 표는 개수를 키워 가며 잰 것입니다 — 차이가 개수에 따라 어떻게 벌어지는지 보세요.',
    costRows: [
        ['앞에 넣기', '배열 O(n) · 리스트 O(1)', '미느냐 링크만 고치느냐'],
        ['뒤에 넣기', '배열 O(1) · 리스트 O(n)', '끝을 아느냐 찾아가야 하느냐'],
        ['k번째 읽기', '배열 O(1) · 리스트 O(n)', '짚느냐 따라가느냐'],
        ['값 찾기', '둘 다 O(n)', '어차피 다 봐야 한다'],
    ],
    facts: [],
};

/** 탭에 나오는 것 전부 — 진짜 자료구조 일곱에 비용 비교를 더한 것. */
export const DS_TABS = [...DS_STRUCTS, DS_COMPARE];

export function dsStructById(id) {
    return DS_TABS.find((s) => s.id === id) || null;
}

export function dsStructsOfGroup(groupId) {
    return DS_TABS.filter((s) => s.group === groupId);
}

export function dsGroupById(id) {
    return DS_GROUPS.find((g) => g.id === id) || null;
}

/** 항목이 하나도 없는 무리는 탭바에 내지 않는다. */
export function dsGroupsInUse() {
    return DS_GROUPS.filter((g) => dsStructsOfGroup(g.id).length > 0);
}

/** 지금 고른 구조와 담는 방식으로 **무엇을 쓸지** 고른다.
 *  담는 방식을 고를 수 없는 구조는 자기 것을 그대로 내놓는다. */
export function dsPlanOf(struct, implId) {
    if (!struct.impls) return {view: struct.view, ops: struct.ops, impl: null};
    const impl = struct.impls.find((i) => i.id === implId) || struct.impls[0];
    return {view: impl.view, ops: impl.ops, impl};
}
