/* 정렬 시뮬레이터의 **진리**.
 *
 * 알고리즘은 배열을 직접 만지지 않는다. 이 기록기에 부탁하고, 부탁 한 번마다
 * **스냅샷이 한 장** 쌓인다. 재생·되감기·스크럽은 그 장을 되짚는 것뿐이라
 * 「뒤로 한 단계」가 공짜로 따라온다 —
 * **그리면서 진행하는 방식으로 짜면 되감기는 나중에 얹을 수 없다.**
 *
 * **값이 아니라 알갱이(item)를 옮긴다.** 배열이 담는 것은 `{v, id}`이고 스냅샷은
 * 그 참조만 베낀다. 알갱이가 제자리를 지키므로 두 가지가 한꺼번에 풀린다.
 *
 *   1. 화면이 같은 상자를 계속 따라가 **맞바꿈·밀기를 움직임으로** 그릴 수 있다.
 *   2. 값이 같은 둘을 구별할 수 있어 **안정 정렬**이 눈에 보인다. 화면은 값이 겹칠 때만
 *      처음 자리를 덧붙여(`5·3`) 보여 준다. 값만 베끼면 둘이 뒤바뀌어도 화면이 똑같아
 *      아무것도 가르치지 못한다.
 *
 * **움직임을 셋으로 가른다.** 하나로 뭉뚱그리면 그림이 틀린다 —
 * 삽입 정렬은 이웃을 맞바꾸는 것이 아니라 **자리를 비켜 주며 미는** 것이고,
 * 병합 정렬은 옮기는 것이 아니라 **딴 칸에 쓰는** 것이다.
 *
 *   `swap`  두 자리를 맞바꾼다            버블 · 칵테일 · 선택 · 힙
 *   `shift` 한 칸 옆으로 민다             삽입 · 셸
 *   `write` 칸에 값을 쓴다(제자리가 아니다) 병합 · 계수 · 기수
 */

/* **몇 장까지 쌓을 수 있는가 — 알갱이 수가 정한다.**
 *
 * 되감기를 하려면 장마다 배열을 통째로 들고 있어야 하므로, 드는 자리는 «장 수 × n»이다.
 * n=1000짜리 버블 정렬은 걸음이 75만이라 다 남길 수가 없다.
 *
 * **그렇다고 큰 배열을 막지는 않는다.** 대신 걸음을 «솎아» 남긴다 — 예산을 넘길 때마다
 * 가진 장을 반으로 줄이고 앞으로 남길 간격을 두 배로 늘린다. 그러면 어느 크기에서도
 * 되감기와 스크럽이 그대로 되고, 다만 «한 단계»가 한 걸음이 아니게 된다.
 * **그 사실은 화면에 밝힌다** — 모르면 학생이 비교를 빠뜨리고 세게 된다.
 */
export function sortFrameBudget(n) {
    return Math.max(400, Math.min(6000, Math.round(300000 / Math.max(1, n))));
}

/** 값 목록을 알갱이로 바꾼다. `id`는 처음 자리이자 **끝까지 변하지 않는 이름**이다. */
export function createSortItems(values) {
    return values.map((v, i) => ({v, id: i}));
}

/**
 * 알고리즘에게 건네줄 기록기.
 *
 * @param {number[]} values 처음 배열
 * @returns 기록기. 알고리즘은 `run(rec)` 안에서 이것만 쓴다.
 */
export function createSortRecorder(values, opts = {}) {
    const a = createSortItems(values);
    const n = a.length;
    let frames = [];
    const budget = opts.maxFrames ?? sortFrameBudget(n);
    let stride = 1;      // 몇 걸음마다 한 장을 남기는가
    let seq = 0;         // 지금까지 몇 걸음 걸었는가
    const counts = {compare: 0, move: 0, access: 0};
    const done = new Set();

    let auxBlocks = null;      // [{label, items, base}]
    let ranges = [];           // [{lo, hi, depth, state}]
    let cursors = {};          // {이름: 자리}
    let held = null;           // 들어올린 알갱이 {item, from}
    let pivot = null;
    let compareMark = null;    // 이 한 장에만 켜지는 표시
    let movingMark = [];
    let note = '';

    /** @param {boolean} force 처음과 끝 장은 간격과 상관없이 반드시 남긴다. */
    function snap(act, force = false) {
        seq++;
        if (!force && seq % stride !== 0) {
            // 남기지 않더라도 **한 장짜리 표시는 꺼야 한다.** 안 그러면 다음에 남는 장에
            // 엉뚱한 자리가 「지금 비교하는 중」으로 찍힌다.
            compareMark = null;
            movingMark = [];
            return;
        }
        frames.push({
            a: [...a],
            aux: auxBlocks ? auxBlocks.map((b) => ({label: b.label, items: [...b.items], base: b.base})) : null,
            act,
            marks: {
                compare: compareMark ? [...compareMark] : null,
                moving: [...movingMark],
                done: [...done],
                pivot,
                held: held ? {item: held.item, from: held.from} : null,
                cursors: {...cursors},
            },
            ranges: ranges.map((r) => ({...r})),
            counts: {...counts},
            say: note,
        });
        // 한 장짜리 표시는 그리고 나면 끈다. 다음 장까지 남으면 어디를 보라는 건지 흐려진다.
        compareMark = null;
        movingMark = [];

        if (frames.length > budget) {
            // 반으로 솎고 앞으로의 간격을 두 배로. 처음 장(0번)은 늘 살아남는다.
            frames = frames.filter((_, i) => i % 2 === 0);
            stride *= 2;
        }
    }

    const rec = {
        n,
        /** 값을 들여다본다. **스냅샷을 남기지 않는다** — 알고리즘이 조건을 따지는
         *  중간 계산까지 한 장씩 쌓으면 학생이 넘겨야 할 장이 두 배가 된다. */
        peek: (i) => { counts.access++; return a[i].v; },
        item: (i) => a[i],
        size: () => a.length,

        /** 설명 한 줄. 지금부터 쌓이는 장에 붙는다. */
        say(text) { note = text; return rec; },

        /** 커서(i·j·k 같은 것)를 옮긴다. 화면에 이름표로 뜬다. */
        cursor(name, i) { if (i === null || i === undefined) delete cursors[name]; else cursors[name] = i; return rec; },
        clearCursors() { cursors = {}; return rec; },

        /** 나뉜 구간. 병합·퀵·셸이 「지금 어디를 보고 있는지」를 층으로 보인다. */
        setRanges(list) { ranges = list.map((r) => ({state: 'active', depth: 0, ...r})); return rec; },
        pivotAt(i) { pivot = i; return rec; },

        /** 자리 하나를 확정으로 찍는다. 한 번 찍은 것은 되돌리지 않는다. */
        fix(i) { done.add(i); return rec; },
        fixRange(lo, hi) { for (let i = lo; i <= hi; i++) done.add(i); return rec; },
        unfixAll() { done.clear(); return rec; },

        /** 두 자리를 비교한다. `a[i] - a[j]`의 부호를 돌려준다. */
        cmp(i, j) {
            counts.compare++;
            counts.access += 2;
            compareMark = [i, j];
            const d = a[i].v - a[j].v;
            snap({kind: 'compare', i, j, result: d});
            return d;
        },

        /** 들고 있는 알갱이와 자리 하나를 비교한다. 삽입 정렬이 쓴다. */
        cmpHeld(j) {
            counts.compare++;
            counts.access += 1;
            compareMark = [j, null];
            const d = a[j].v - held.item.v;
            snap({kind: 'compare', i: j, j: null, result: d});
            return d;
        },

        /** 값 하나와 자리 하나를 비교한다. 이진 삽입·계수 정렬이 쓴다. */
        cmpValue(i, v) {
            counts.compare++;
            counts.access += 1;
            compareMark = [i, null];
            const d = a[i].v - v;
            snap({kind: 'compare', i, j: null, result: d});
            return d;
        },

        /** 두 자리를 **맞바꾼다.** */
        swap(i, j) {
            if (i === j) return rec;
            counts.move += 2;
            counts.access += 4;
            [a[i], a[j]] = [a[j], a[i]];
            movingMark = [i, j];
            snap({kind: 'swap', i, j});
            return rec;
        },

        /** 알갱이를 **들어올린다.** 그 자리는 빈칸이 된다(삽입·셸). */
        hold(i) {
            counts.access++;
            held = {item: a[i], from: i};
            a[i] = null;
            snap({kind: 'hold', i});
            return rec;
        },

        /** 한 칸 옆으로 **민다.** 맞바꿈이 아니다 — 빈칸이 따라 움직인다. */
        shift(from, to) {
            counts.move++;
            counts.access += 2;
            a[to] = a[from];
            a[from] = null;
            movingMark = [to];
            snap({kind: 'shift', from, to});
            return rec;
        },

        /** 들고 있던 알갱이를 빈칸에 **내려놓는다.** */
        drop(to) {
            counts.move++;
            counts.access++;
            a[to] = held.item;
            movingMark = [to];
            const from = held.from;
            held = null;
            snap({kind: 'drop', to, from});
            return rec;
        },

        /** 칸에 **쓴다.** 제자리 정렬이 아닌 것들이 되돌려 놓을 때 쓴다. */
        write(i, item) {
            counts.move++;
            counts.access++;
            a[i] = item;
            movingMark = [i];
            snap({kind: 'write', i});
            return rec;
        },

        /* ---- 보조 칸. 「메모리를 더 쓴다」를 글이 아니라 그림으로 말한다 ---- */

        /** 보조 칸을 연다. `base`는 주 배열의 어느 자리 아래에 놓을지. */
        auxOpen(blocks) {
            auxBlocks = blocks.map((b) => ({label: b.label, base: b.base, items: b.items ?? []}));
            snap({kind: 'aux-open'});
            return rec;
        },
        /** 주 배열의 한 구간을 보조 칸으로 **통째로 떠 온다.** 원본은 그대로 둔다.
         *  **한 칸씩 한 장으로 남기지 않는다** — 떠 오는 것은 병합의 요점이 아니라 준비
         *  과정인데, 칸마다 한 장을 쓰면 정작 봐야 할 「합치기」가 기록에 묻힌다.
         *  옮긴 횟수는 칸 수만큼 정직하게 센다. */
        auxFill(blockIdx, lo, hi) {
            for (let i = lo; i <= hi; i++) {
                counts.move++;
                counts.access += 2;
                auxBlocks[blockIdx].items.push(a[i]);
            }
            snap({kind: 'aux-fill', block: blockIdx, lo, hi});
            return rec;
        },
        auxAt: (blockIdx, k) => auxBlocks[blockIdx].items[k],
        auxLen: (blockIdx) => auxBlocks[blockIdx].items.length,
        /** 보조 칸 둘을 비교한다. 병합의 알맹이다. */
        auxCmp(b1, k1, b2, k2) {
            counts.compare++;
            counts.access += 2;
            compareMark = [null, null];
            const d = auxBlocks[b1].items[k1].v - auxBlocks[b2].items[k2].v;
            snap({kind: 'aux-compare', a: [b1, k1], b: [b2, k2], result: d});
            return d;
        },
        /** 보조 칸의 알갱이를 주 배열로 **되돌려 쓴다.** */
        auxWriteBack(blockIdx, k, i) {
            counts.move++;
            counts.access += 2;
            a[i] = auxBlocks[blockIdx].items[k];
            movingMark = [i];
            snap({kind: 'aux-writeback', block: blockIdx, k, i});
            return rec;
        },
        /** 보조 칸을 치운다. **장을 따로 남기지 않는다** — 다음에 남길 장에서
         *  칸이 사라져 있는 것으로 충분하고, 그것만으로 한 장을 쓸 값어치가 없다. */
        auxClose() {
            auxBlocks = null;
            return rec;
        },

        /** 주 배열의 한 구간을 **비운다.** 병합 정렬이 두 조각을 보조 칸으로 떠 온 뒤,
         *  그 구간을 처음부터 다시 채워 넣는다는 것을 그림으로 말해 준다.
         *  세는 값은 늘지 않는다 — 실제로 옮기는 일이 아니라 화면에서만 비우는 것이다. */
        vacate(lo, hi) {
            for (let i = lo; i <= hi; i++) a[i] = null;
            snap({kind: 'vacate', lo, hi});
            return rec;
        },

        /** 아무 일도 없지만 한 장 남긴다. 설명만 바뀌는 자리에 쓴다. */
        mark(kind = 'mark') { snap({kind}); return rec; },
    };

    /* **손대기 전 모습으로 한 장 시작한다.** 없으면 0단계가 이미 「첫 비교를 마친 뒤」라,
       되감기를 끝까지 해도 처음 자료를 볼 수 없다. */
    note = '처음 자료입니다. 재생을 누르거나 「앞으로」로 한 단계씩 넘겨 보세요.';
    snap({kind: 'start'}, true);

    return {
        rec,
        finish() {
            note = '정렬이 끝났습니다. 모든 자리가 확정되었습니다.';
            for (let i = 0; i < n; i++) done.add(i);
            ranges = [];
            cursors = {};
            pivot = null;
            snap({kind: 'finish'}, true);
            return {frames, counts: {...counts}, stride, steps: seq, n};
        },
    };
}

/**
 * 알고리즘 하나를 처음부터 끝까지 돌려 스냅샷 열을 얻는다.
 * **여기서 배열이 실제로 정렬되는지도 함께 본다** — 스냅샷만 그럴듯하고 결과가 틀린
 * 알고리즘은 화면으로는 알아채기 어렵다.
 */
export function runSortAlgorithm(algo, values) {
    const {rec, finish} = createSortRecorder(values);
    algo.run(rec);
    const result = finish();
    const last = result.frames[result.frames.length - 1];
    const out = last ? last.a.map((it) => (it ? it.v : NaN)) : [];
    const want = [...values].sort((x, y) => x - y);
    result.sorted = out.length === want.length && out.every((v, i) => v === want[i]);
    result.values = out;
    return result;
}

/**
 * **안정 정렬인지 실제로 확인한다.** 값이 같은 알갱이들의 `id` 차례가 그대로면 안정이다.
 * 알고리즘이 스스로 신고한 `stable`과 맞는지는 검사가 대조한다 —
 * 카드에 적힌 말과 화면에서 벌어지는 일이 어긋나면 그게 가장 나쁜 결함이다.
 */
export function sortIsStable(frames, values) {
    const last = frames[frames.length - 1];
    if (!last) return true;
    const byValue = new Map();
    for (const it of last.a) {
        if (!it) return false;
        if (!byValue.has(it.v)) byValue.set(it.v, []);
        byValue.get(it.v).push(it.id);
    }
    for (const ids of byValue.values()) {
        for (let i = 1; i < ids.length; i++) if (ids[i] < ids[i - 1]) return false;
    }
    return true;
}
