/* 힙 정렬.
 *
 * **이 알고리즘이 가르치는 것은 정렬 방법이 아니라 「1차원 배열이 사실은 트리다」이다.**
 * 그래서 화면에 트리와 배열을 나란히 두고 같은 색으로 묶는다 —
 * 트리만 보면 그것이 배열이라는 것을 놓치고, 배열만 보면 왜 인덱스가 2i+1로
 * 껑충 뛰는지 알 수가 없다. 둘을 잇는 것 자체가 수업 내용이다.
 */

export const heapSortAlgo = {
    id: 'heap',
    name: '힙 정렬',
    en: 'Heap sort',
    group: 'improved',
    view: 'heap',
    motion: 'swap',
    idea: '**선택 정렬을 개선한 것**입니다. 배열을 완전 이진 트리로 보고, 부모가 자식보다 크도록 정리합니다(최대 힙). '
        + '그러면 꼭대기가 가장 큰 값이므로 맨 뒤와 교환해 확정하고, '
        + '남은 부분을 다시 힙으로 고칩니다.',
    complexity: {best: 'O(n log n)', avg: 'O(n log n)', worst: 'O(n log n)', space: 'O(1)'},
    stable: false,
    inPlace: true,
    watch: '트리와 배열은 **같은 것**입니다. i번 칸의 자식은 2i+1번과 2i+2번 칸입니다 — '
        + '트리에서 아래로 내려갈 때 배열에서 인덱스가 어떻게 뛰는지 함께 보세요. '
        + '병합 정렬과 달리 추가 메모리를 쓰지 않으면서도 최악이 O(n log n)입니다.',

    run(rec) {
        const n = rec.n;

        /** 힙에 남아 있는 구간을 화면에 알린다. 뷰가 트리를 어디까지 그릴지 이것으로 안다. */
        const heapRange = (size) => rec.setRanges(size > 0 ? [{lo: 0, hi: size - 1, depth: 0, state: 'heap'}] : []);

        /** 뿌리에서 아래로 내려가며 «부모가 자식보다 크다»를 고친다. */
        const siftDown = (root, size) => {
            let r = root;
            for (;;) {
                const left = 2 * r + 1;
                const right = 2 * r + 2;
                let big = r;
                rec.cursor('부모', r);

                if (left < size) {
                    rec.cursor('자식', left);
                    if (rec.cmp(left, big) > 0) big = left;
                }
                if (right < size) {
                    rec.cursor('자식', right);
                    if (rec.cmp(right, big) > 0) big = right;
                }

                if (big === r) {
                    rec.say('부모가 두 자식보다 큽니다. 여기는 더 고칠 것이 없습니다.');
                    rec.cursor('자식', null);
                    rec.mark('settled');
                    return;
                }

                rec.say('자식이 더 큽니다. 부모와 교환하고 그 자리에서 다시 내려갑니다.');
                rec.swap(r, big);
                r = big;
            }
        };

        rec.say('먼저 배열 전체를 최대 힙으로 만듭니다. 자식이 있는 마지막 칸부터 거꾸로 고쳐 올라옵니다.');
        heapRange(n);
        rec.mark('build-start');

        for (let i = Math.floor(n / 2) - 1; i >= 0; i--) siftDown(i, n);

        rec.clearCursors();
        rec.say('최대 힙이 되었습니다. 이제 꼭대기가 가장 큰 값입니다.');
        rec.mark('heap-ready');

        for (let end = n - 1; end > 0; end--) {
            rec.say('꼭대기(가장 큰 값)를 힙의 맨 뒤와 교환합니다. 그 자리는 확정입니다.');
            rec.swap(0, end);
            rec.fix(end);
            heapRange(end);
            rec.say('힙이 한 칸 줄었습니다. 새 꼭대기를 제자리로 내려보냅니다.');
            rec.mark('shrink');
            siftDown(0, end);
        }

        rec.fix(0);
        rec.setRanges([]);
        rec.clearCursors();
        rec.say('힙이 비었습니다. 뒤에서부터 큰 값이 차례로 쌓여 정렬이 끝났습니다.');
        rec.mark('done');
    },
};
