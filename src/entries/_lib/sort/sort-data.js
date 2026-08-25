/* 정렬에 넣을 자료를 만든다.
 *
 * **무작위 하나만 두면 결론이 늘 「퀵이 빠르다」로 끝난다.** 어떤 알고리즘이 언제
 * 빛나는지는 자료의 생김새가 정하므로, 그 생김새를 학생이 직접 고를 수 있어야 한다.
 * 프리셋 넷은 각각 **한 가지를 드러내려고** 있는 것이지 종류를 채운 것이 아니다.
 *
 * **값이 겹치는 것을 막지 않는다.** 오히려 겹쳐야 안정 정렬이 보인다 —
 * 같은 값 둘의 앞뒤가 뒤집히는지를 보는 것 말고는 안정성을 눈으로 확인할 길이 없다.
 */

/* **고를 수 있는 개수. 고르게 펴지 않는다.**
 *
 * 수업에서 실제로 쓰는 자리는 2~20이다 — 한 단계씩 넘겨 가며 무슨 일이 벌어지는지
 * 보려면 그만큼이어야 한다. 그런데 2~1000을 고르게 편 슬라이더에서는 그 구간이
 * 전체의 2%가 되어 **정작 쓸 값을 고를 수가 없다.** 그래서 작은 쪽을 촘촘히,
 * 큰 쪽을 성기게 둔 목록에서 고른다.
 *
 * 큰 값도 열어 둔다. 1000개가 정리되어 가는 모습은 한 단계씩 보는 것과 **다른 것을**
 * 가르친다 — 알고리즘마다 자료가 정돈되는 「모양」이 다르다는 것이다.
 */
export const SORT_SIZES = [
    2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 32,
    48, 64, 96, 128, 192, 256, 384, 512, 768, 1000,
];

export const SORT_N_MIN = SORT_SIZES[0];
export const SORT_N_MAX = SORT_SIZES[SORT_SIZES.length - 1];

/** **기본값은 「한 판이 80단계 안에서 끝나는 크기」로 잡았다.**
 *
 *  여덟 종목 × 자료 넷 × 씨앗 다섯을 실제로 돌려 세어 보고 고른 값이다.
 *  n=8이면 가장 긴 종목(병합 정렬)이 83단계, 나머지는 18~80단계다.
 *  n=10이면 병합이 114, 삽입이 120까지 가고 n=24는 369~436단계가 된다 —
 *  뒤엣것들은 수업 시간에 끝까지 넘겨 볼 수 있는 양이 아니다.
 *  세는 법 → `npm run check:sort` */
export const SORT_N_DEFAULT = 8;

/** 목록에서 가장 가까운 값. 직접 넣은 자료의 개수를 슬라이더에 맞출 때 쓴다. */
export function nearestSortSize(n) {
    return SORT_SIZES.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), SORT_SIZES[0]);
}

/** 값의 범위. 막대 높이로 비교하는 그림이라 0을 넣으면 보이지 않는다. */
export const SORT_V_MIN = 1;
export const SORT_V_MAX = 99;

/** **원소가 많으면 값의 범위도 넓혀야 한다.** 1~99에 1000개를 담으면 열 개씩 값이
 *  겹쳐 「역순」이 참된 역순이 되지 못하고, 그러면 최악을 보여 주려던 자료가
 *  최악이 아니게 된다. 겹침을 일부러 만드는 「값이 몇 종류뿐」은 이 규칙 밖이다. */
function sortValueMax(n, cap) {
    // 알고리즘이 값의 범위를 못박아 두었으면 그쪽이 이긴다.
    // 계수 정렬은 값의 크기만큼 칸이 늘어나므로 0~9만 다룬다.
    if (cap !== undefined && cap !== null) return cap;
    return Math.max(SORT_V_MAX, Math.min(999, n));
}

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
        hint: '거꾸로 놓인 자료. 삽입 정렬과, 구간의 끝에서 피벗을 고르는 퀵 정렬이 나란히 최악이 된다.',
    },
    {
        id: 'fewUnique',
        name: '값이 몇 종류뿐',
        hint: '같은 값이 잔뜩 겹친다. 정렬이 끝난 뒤 같은 값끼리 앞뒤가 지켜졌는지 보면 안정 정렬인지 알 수 있다.',
    },
];

/** 반복할 수 있는 난수. 같은 씨앗이면 같은 자료가 나와야 겨루기가 공정하다. */
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
 * @param {number} n         원소 수
 * @param {number} seed      씨앗. 같으면 같은 자료가 나온다
 */
export function makeSortData(presetId, n, seed = Date.now(), cap = null) {
    const rnd = sortRandom(seed);
    const vMin = cap !== null && cap < SORT_V_MAX ? 0 : SORT_V_MIN;
    const vMax = sortValueMax(n, cap);
    const span = vMax - vMin;
    const randVal = () => vMin + Math.floor(rnd() * (span + 1));

    if (presetId === 'reversed') {
        // 값이 겹치지 않아야 「완전한 역순」이 된다. 고르게 깔고 뒤집는다.
        const step = span / Math.max(1, n - 1);
        return Array.from({length: n}, (_, i) => Math.round(vMax - i * step));
    }

    if (presetId === 'nearly') {
        const step = span / Math.max(1, n - 1);
        const out = Array.from({length: n}, (_, i) => Math.round(vMin + i * step));
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
        // 값의 범위가 좁은 종목(계수 정렬)에서는 그 안에서 넷을 고른다.
        const kinds = span >= 78
            ? [12, 34, 56, 78]
            : [0, 1, 2, 3].map((q) => vMin + Math.round((span * (q + 1)) / 5));
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
            error: `숫자가 ${values.length}개입니다. 여기서는 ${SORT_N_MAX}개까지만 다룹니다.`,
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
