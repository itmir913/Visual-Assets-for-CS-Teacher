/* 어떤 정렬을 싣는지 정하는 **유일한 곳.**
 *
 * 탭바도, 겨루기 목록도, 검사도 전부 여기서 읽는다 —
 * 알고리즘을 하나 더하면 화면에도 검사에도 저절로 딸려 온다.
 *
 * **무리(`group`)는 이름표가 아니라 개념 지도다.** 「비교하지 않는」 무리가 있어야
 * 「정렬은 O(n log n)이 한계」라는 말이 **비교로 정렬할 때만** 참이라는 것이 드러난다.
 */

import {bubbleSortAlgo} from './algo/bubble.js';
import {cocktailSortAlgo} from './algo/cocktail.js';
import {selectionSortAlgo} from './algo/selection.js';
import {insertionSortAlgo} from './algo/insertion.js';

export const SORT_GROUPS = [
    {
        id: 'simple',
        name: '단순한 것',
        badge: 'O(n²)',
        blurb: '이웃끼리, 또는 남은 것 전부와 하나씩 비교합니다. '
            + '느리지만 무슨 일이 벌어지는지가 그대로 보입니다.',
    },
    {
        id: 'divide',
        name: '나눠서 푸는 것',
        badge: 'O(n log n)',
        blurb: '큰 문제를 반씩 쪼개거나, 자료를 트리로 보고 풉니다.',
    },
    {
        id: 'nocompare',
        name: '비교하지 않는 것',
        badge: 'O(n+k)',
        blurb: '값끼리 비교하는 대신 값 자체를 자리의 이름으로 씁니다. '
            + '그래서 「비교 정렬의 한계」가 여기에는 걸리지 않습니다.',
    },
];

export const SORT_ALGOS = [
    bubbleSortAlgo,
    cocktailSortAlgo,
    selectionSortAlgo,
    insertionSortAlgo,
];

export function sortAlgoById(id) {
    return SORT_ALGOS.find((a) => a.id === id) || null;
}

export function sortAlgosOfGroup(groupId) {
    return SORT_ALGOS.filter((a) => a.group === groupId);
}

/** 항목이 하나도 없는 무리는 탭바에 내지 않는다. */
export function sortGroupsInUse() {
    return SORT_GROUPS.filter((g) => sortAlgosOfGroup(g.id).length > 0);
}
