/* 정렬에 넣을 자료를 만든다.
 *
 * **무작위 하나만 두면 결론이 늘 「퀵이 빠르다」로 끝난다.** 어떤 알고리즘이 언제
 * 빛나는지는 자료의 생김새가 정하므로, 그 생김새를 학생이 직접 고를 수 있어야 한다.
 * 프리셋 넷은 각각 **한 가지를 드러내려고** 있는 것이지 종류를 채운 것이 아니다.
 *
 * **값이 겹치는 것을 막지 않는다.** 오히려 겹쳐야 안정 정렬이 보인다 —
 * 같은 값 둘의 앞뒤가 뒤집히는지를 보는 것 말고는 안정성을 눈으로 확인할 길이 없다.
 */

/** 한 종목을 볼 때의 알갱이 수. 되감기를 하려면 스냅샷을 전부 들고 있어야 해서 바닥이 있다.
 *  교실 화면에서 막대가 보이려면 어차피 이 언저리다. */
export const SORT_N_MIN = 6;
export const SORT_N_MAX = 64;
export const SORT_N_DEFAULT = 24;

/** 값의 범위. 막대 높이로 비교하는 그림이라 0을 넣으면 보이지 않는다. */
export const SORT_V_MIN = 1;
export const SORT_V_MAX = 99;

export const SORT_PRESETS = [
    {
        id: 'random',
        name: '무작위',
        hint: '아무 순서도 아닌 자료. 비교할 때의 기준이 된다.',
    },
    {
        id: 'nearly',
        name: '거의 정렬됨',
        hint: '몇 자리만 어긋나 있다. 삽입 정렬이 퀵 정렬을 이기는 유일한 자리다.',
    },
    {
        id: 'reversed',
        name: '역순',
        hint: '거꾸로 놓인 자료. 맨 앞을 피벗으로 잡는 퀵 정렬이 최악으로 무너진다.',
    },
    {
        id: 'fewUnique',
        name: '값이 몇 종류뿐',
        hint: '같은 값이 잔뜩 겹친다. 계수 정렬이 빛나고, 안정 정렬과 아닌 것이 갈린다.',
    },
];

/** 되풀이할 수 있는 난수. 같은 씨앗이면 같은 자료가 나와야 겨루기가 공정하다. */
export function sortRandom(seed) {
    let s = (seed >>> 0) || 1;
    return () => {
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17;
        s ^= s << 5; s >>>= 0;
        return s / 4294967296;
    };
}

/**
 * 프리셋으로 자료를 만든다.
 * @param {string} presetId  `SORT_PRESETS`의 id
 * @param {number} n         알갱이 수
 * @param {number} seed      씨앗. 같으면 같은 자료가 나온다
 */
export function makeSortData(presetId, n, seed = Date.now()) {
    const rnd = sortRandom(seed);
    const span = SORT_V_MAX - SORT_V_MIN;
    const randVal = () => SORT_V_MIN + Math.floor(rnd() * (span + 1));

    if (presetId === 'reversed') {
        // 값이 겹치지 않아야 「완전한 역순」이 된다. 고르게 깔고 뒤집는다.
        const step = span / Math.max(1, n - 1);
        return Array.from({length: n}, (_, i) => Math.round(SORT_V_MAX - i * step));
    }

    if (presetId === 'nearly') {
        const step = span / Math.max(1, n - 1);
        const out = Array.from({length: n}, (_, i) => Math.round(SORT_V_MIN + i * step));
        if (n < 2) return out;      // 어긋뜨릴 이웃이 없다. 없는 자리를 건드리면 배열이 늘어난다.
        // 어긋난 자리를 몇 군데만 둔다. 너무 많으면 그냥 무작위가 된다.
        const swaps = Math.max(1, Math.round(n / 8));
        for (let k = 0; k < swaps; k++) {
            const i = Math.floor(rnd() * (n - 1));
            [out[i], out[i + 1]] = [out[i + 1], out[i]];
        }
        return out;
    }

    if (presetId === 'fewUnique') {
        // 종류를 넷으로 줄인다. 겹치는 값이 있어야 안정성이 눈에 보인다.
        const kinds = [12, 34, 56, 78];
        return Array.from({length: n}, () => kinds[Math.floor(rnd() * kinds.length)]);
    }

    return Array.from({length: n}, randVal);
}

/**
 * 직접 적어 넣은 것을 읽는다. 쉼표든 빈칸이든 줄바꿈이든 가리지 않는다.
 * @returns {{values: number[], error: string|null}} 잘못이 있으면 **왜 안 되는지**를 준다
 */
export function parseSortInput(text) {
    const pieces = String(text).split(/[\s,]+/).filter((p) => p.length);
    if (!pieces.length) return {values: [], error: '숫자를 하나도 찾지 못했습니다.'};

    const values = [];
    for (const p of pieces) {
        if (!/^-?\d+$/.test(p)) {
            return {values: [], error: `「${p}」은 정수가 아닙니다. 정수만 넣어 주세요.`};
        }
        values.push(Number(p));
    }
    if (values.length < SORT_N_MIN) {
        return {values: [], error: `숫자가 ${values.length}개뿐입니다. ${SORT_N_MIN}개 이상 넣어 주세요.`};
    }
    if (values.length > SORT_N_MAX) {
        return {
            values: [],
            error: `숫자가 ${values.length}개입니다. 되감기를 하려면 모든 단계를 들고 있어야 해서 `
                + `${SORT_N_MAX}개까지만 됩니다.`,
        };
    }
    return {values, error: null};
}

/**
 * 알고리즘이 이 자료를 받을 수 있는지 본다.
 * **제약 자체가 그 알고리즘의 성질이므로**, 막기만 하지 않고 **왜인지를 함께 준다.**
 */
export function checkSortInput(algo, values) {
    const need = algo.needs || {};
    if (need.nonNegative && values.some((v) => v < 0)) {
        return `${algo.name}은 값을 「몇 번 나왔는지 세는 칸」의 자리로 쓰기 때문에 `
            + `음수를 그대로 담을 수 없습니다. 0 이상만 넣어 주세요.`;
    }
    if (need.maxValue !== undefined && values.some((v) => v > need.maxValue)) {
        return `${algo.name}은 값의 크기만큼 세는 칸을 만듭니다. `
            + `여기서는 ${need.maxValue}까지만 다룹니다 — 값이 커질수록 칸이 그만큼 늘어납니다.`;
    }
    return null;
}
