/* 어떤 정렬을 싣는지 정하는 **유일한 곳.**
 *
 * 탭바도, 겨루기 목록도, 검사도 전부 여기서 읽는다 —
 * 알고리즘을 하나 더하면 화면에도 검사에도 저절로 딸려 온다.
 *
 * **분류는 이름표가 아니라 개념 지도다.** 그래서 「나눠서 푸는 것」처럼 풀어 쓴 말이
 * 아니라 **정식 용어**를 쓰고, 정식 용어를 쓰는 이상 **소속이 정확해야 한다.**
 *
 *   - **셸 정렬과 힙 정렬은 분할 정복이 아니다.** 셸 정렬은 삽입 정렬을 간격(증분)으로,
 *     힙 정렬은 선택 정렬을 힙으로 개선한 것이다. 둘을 병합·퀵과 한 칸에 넣고
 *     그 칸을 「분할 정복」이라 부르면 **탭 이름 자체가 오개념을 가르친다.**
 *   - **분배 정렬 칸이 따로 있어야** 「정렬은 O(n log n)이 한계」라는 말이
 *     **비교 정렬에 한해서** 참이라는 것이 드러난다.
 */

import {bubbleSortAlgo} from './algo/bubble.js';
import {cocktailSortAlgo} from './algo/cocktail.js';
import {selectionSortAlgo} from './algo/selection.js';
import {insertionSortAlgo} from './algo/insertion.js';
import {shellSortAlgo} from './algo/shell.js';
import {mergeSortAlgo} from './algo/merge.js';
import {quickSortAlgo} from './algo/quick.js';
import {heapSortAlgo} from './algo/heap.js';
import {countingSortAlgo} from './algo/counting.js';
import {radixSortAlgo} from './algo/radix.js';
import {bucketSortAlgo} from './algo/bucket.js';

export const SORT_GROUPS = [
    {
        id: 'simple',
        name: '단순 정렬',
        blurb: '이웃끼리, 또는 남은 것 전부와 하나씩 비교합니다. 넷 다 최악이 O(n²)입니다. '
            + '느리지만 무슨 일이 벌어지는지가 그대로 보입니다.',
    },
    {
        id: 'improved',
        name: '단순 정렬의 개선',
        blurb: '단순 정렬의 약점을 짚어 고친 것들입니다. '
            + '셸 정렬은 삽입 정렬을 간격(증분)으로, 힙 정렬은 선택 정렬을 힙으로 고쳤습니다. '
            + '분할 정복은 아닙니다.',
    },
    {
        id: 'divide',
        name: '분할 정복',
        blurb: '문제를 반씩 쪼개 더 쪼갤 수 없을 때까지 내려간 뒤, '
            + '작은 답을 합쳐 큰 답을 만듭니다. 정렬 밖에서도 두루 쓰이는 설계 기법입니다. '
            + '병합 정렬은 최악도 O(n log n)이지만 퀵 정렬의 최악은 O(n²)입니다 — '
            + '같은 기법이라도 복잡도가 같지는 않습니다.',
    },
    {
        id: 'distribution',
        name: '분배 정렬',
        blurb: '값끼리 비교하는 대신 값 자체를 칸의 이름으로 씁니다. '
            + '그래서 비교 정렬의 한계인 O(n log n)이 여기에는 걸리지 않습니다. '
            + '계수·기수 정렬은 비교를 한 번도 하지 않고, '
            + '버킷 정렬만 칸 «안»을 정리할 때 비교합니다.',
    },
    {
        id: 'race',
        name: '겨루기',
        blurb: '같은 자료를 열한 종목에 한꺼번에 물리고 **일한 양(비교 + 옮김)을 똑같이 나눠 줍니다.** '
            + '그래서 먼저 끝난 쪽이 실제로 일을 덜 한 것입니다. '
            + '아래 곡선은 원소 수를 키워 가며 측정한 것으로, 한 단계씩 넘겨서는 볼 수 없는 그림입니다.',
    },
];

export const SORT_ALGOS = [
    bubbleSortAlgo,
    cocktailSortAlgo,
    selectionSortAlgo,
    insertionSortAlgo,
    shellSortAlgo,
    heapSortAlgo,
    mergeSortAlgo,
    quickSortAlgo,
    countingSortAlgo,
    radixSortAlgo,
    bucketSortAlgo,
];

/* **겨루기는 알고리즘이 아니다.** 그래도 탭에는 나와야 하므로 종목처럼 생긴 항목을
   하나 둔다. `SORT_ALGOS`에는 넣지 않는다 — 넣으면 겨루기가 자기 자신과 겨룬다. */
export const SORT_RACE = {
    id: 'race',
    name: '전 종목 겨루기',
    en: 'Race',
    group: 'race',
    view: 'race',
    idea: '위에서 고른 자료를 **열한 종목에 똑같이** 물리고, 일한 양을 한 칸씩 나란히 넘깁니다. '
        + '한 종목만 볼 때는 숫자로만 남던 차이가, 나란히 놓으면 끝나는 차례로 드러납니다.',
    complexity: {best: '—', avg: '—', worst: '—', space: '—'},
    stable: null,
    inPlace: null,
    watch: '자료를 「거의 정렬됨」으로 바꿔 보세요. 삽입 정렬이 분할 정복보다 먼저 끝납니다. '
        + '「역순」에서는 퀵 정렬이 꼴찌 가까이로 내려앉습니다 — '
        + '**어느 정렬이 빠른가는 자료가 정합니다.** '
        + '아래 곡선의 세로축은 로그 눈금입니다. 선의 «기울기»가 곧 복잡도의 차수입니다.',
};

/** 탭에 나오는 것 전부 — 진짜 종목 열에 겨루기를 더한 것. */
export const SORT_TABS = [...SORT_ALGOS, SORT_RACE];

export function sortAlgoById(id) {
    return SORT_TABS.find((a) => a.id === id) || null;
}

export function sortAlgosOfGroup(groupId) {
    return SORT_TABS.filter((a) => a.group === groupId);
}

export function sortGroupById(id) {
    return SORT_GROUPS.find((g) => g.id === id) || null;
}

/** 항목이 하나도 없는 분류는 탭바에 내지 않는다. */
export function sortGroupsInUse() {
    return SORT_GROUPS.filter((g) => sortAlgosOfGroup(g.id).length > 0);
}
