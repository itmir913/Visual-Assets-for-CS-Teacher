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

export const SORT_GROUPS = [
    {
        id: 'simple',
        name: '단순 정렬',
        badge: 'O(n²)',
        blurb: '이웃끼리, 또는 남은 것 전부와 하나씩 비교합니다. '
            + '느리지만 무슨 일이 벌어지는지가 그대로 보입니다.',
    },
    {
        id: 'improved',
        name: '단순 정렬의 개선',
        /* **여기만 복잡도를 적지 않는다.** 셸 정렬의 최악은 O(n²)이고 힙 정렬은
           O(n log n)이라 한 값으로 묶을 수가 없다. 없는 값을 지어내느니 비워 둔다. */
        badge: '',
        blurb: '단순 정렬의 약점을 짚어 고친 것들입니다. '
            + '셸 정렬은 삽입 정렬을 간격(증분)으로, 힙 정렬은 선택 정렬을 힙으로 고쳤습니다. '
            + '분할 정복은 아닙니다.',
    },
    {
        id: 'divide',
        name: '분할 정복',
        badge: 'O(n log n)',
        blurb: '문제를 반씩 쪼개 더 쪼갤 수 없을 때까지 내려간 뒤, '
            + '작은 답을 합쳐 큰 답을 만듭니다. 정렬 밖에서도 두루 쓰이는 설계 기법입니다.',
    },
    {
        id: 'distribution',
        name: '분배 정렬',
        badge: 'O(n+k)',
        blurb: '값끼리 비교하는 대신 값 자체를 자리의 이름으로 씁니다. '
            + '그래서 비교 정렬의 한계인 O(n log n)이 여기에는 걸리지 않습니다.',
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
];

export function sortAlgoById(id) {
    return SORT_ALGOS.find((a) => a.id === id) || null;
}

export function sortAlgosOfGroup(groupId) {
    return SORT_ALGOS.filter((a) => a.group === groupId);
}

export function sortGroupById(id) {
    return SORT_GROUPS.find((g) => g.id === id) || null;
}

/** 항목이 하나도 없는 분류는 탭바에 내지 않는다. */
export function sortGroupsInUse() {
    return SORT_GROUPS.filter((g) => sortAlgosOfGroup(g.id).length > 0);
}
