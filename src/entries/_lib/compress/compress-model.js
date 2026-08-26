/* 압축 시뮬레이터의 **진리**.
 *
 * 뼈대는 찾기 쪽과 같다 — 연산이 화면을 직접 만지지 않고 이 기록기에 부탁하면 부탁
 * 한 번마다 **스냅샷이 한 장** 쌓이고, 재생·되감기·스크럽은 그 장을 되짚는 것뿐이다.
 *
 * **다른 것은 「한 회차」의 뜻이다.** 찾기는 「연산 한 번이 한 회차」이라 앞 회차가 끝난 상태를
 * 물려받았다. 압축은 물려받을 것이 없다 — **글 하나를 통째로 줄이는 것이 한 회차**이고,
 * 글을 바꾸면 처음부터 다시 한다. 그래서 상태를 이어 붙이는 장치가 여기에는 없다.
 *
 * ---------------------------------------------------------------
 * 세는 단위는 **비트**다. 왜 칸이 아닌가
 * ---------------------------------------------------------------
 *
 * 런 렝스만 다룬다면 「글자 한 칸, 숫자 한 칸」으로 세는 편이 쉽다. 그런데 허프만은
 * **글자마다 코드 길이가 다른 것이 알맹이**라, 칸으로는 아예 셀 수가 없다.
 * 한 화면에서 둘을 나란히 놓으려면 단위가 하나여야 하고, 그 하나는 비트일 수밖에 없다.
 *
 * **기준(압축 전)은 글자마다 같은 길이의 코드를 줬을 때다.** 글자가 k가지면
 * `⌈log₂ k⌉`비트면 다 구별되므로 그것이 기준이 된다. 8비트로 두지 않는 까닭은,
 * 글자가 세 가지뿐인 글을 8비트로 적을 사람이 없어서다 — 그렇게 두면 어떤 방법을 쓰든
 * 압축률이 부풀어 **방법 사이의 차이가 안 보인다.** 이 화면에서 볼 것은 그 차이다.
 *
 * ---------------------------------------------------------------
 * **코드표는 압축률에 넣지 않는다.** 대신 크기를 따로 보여 준다
 * ---------------------------------------------------------------
 *
 * 받는 쪽이 되살리려면 「어느 글자가 어느 코드인가」를 알아야 하고, 그 표도 자리를
 * 차지한다. 그것까지 세면 **짧은 글에서는 허프만이 지는 일이 흔하다** — 열 글자짜리
 * 글에서 표가 본문보다 클 수 있다.
 *
 * 그런데 압축률에 표를 넣어 버리면 강의노트가 표로 보여 준 셈(본문 15비트 대 20비트)과
 * 화면의 숫자가 어긋난다. **같은 개념을 두 자리에서 다르게 말하지 않는다.**
 * 그래서 이렇게 갈랐다.
 *
 *   - **압축률은 본문만으로 낸다** — 강의노트와 같은 셈이다
 *   - **표 크기는 옆에 따로 적는다** — 「이것도 함께 보내야 한다」를 숨기지 않는다
 *
 * 숨기지도 않고 어긋나지도 않는 자리는 이 하나뿐이다.
 */

/** 입력에 쓸 수 있는 글자. **영어 대문자만** — 강의노트의 런 렝스 위젯과 같은 제약이라
 *  학생이 거기 넣어 본 글을 여기에 그대로 넣어 볼 수 있다. */
export const COMPRESS_ALPHABET = /^[A-Z]*$/;

/** 입력 길이 천장. 넘으면 트리가 화면을 벗어나고, 한 회차가 길어져 되감아 볼 수가 없다. */
export const COMPRESS_MAX_LEN = 24;

/**
 * 글자 하나를 적는 데 드는 비트 — **같은 길이 코드를 줬을 때**의 값이다.
 *
 * **가짓수가 하나여도 0으로 두지 않는다.** `AAAA`를 0비트라고 하면 원본이 0비트가 되어
 * 압축률이 0으로 나누기가 된다. 「구별할 것이 없어도 한 비트는 든다」로 바닥을 둔다.
 */
export function symbolBits(kinds) {
    const k = Math.max(1, kinds);
    return Math.max(1, Math.ceil(Math.log2(k)));
}

/** 어떤 수를 적는 데 드는 비트. 런 렝스가 「횟수」를 몇 자리로 적을지 정하는 데 쓴다. */
export function countBits(maxValue) {
    return Math.max(1, Math.ceil(Math.log2(Math.max(1, maxValue) + 1)));
}

/** 글자별 나온 횟수. **나온 순서를 지킨다** — 같은 횟수끼리의 순서가 흔들리면
 *  허프만 트리가 회차마다 달라져, 학생이 두 번 돌렸을 때 다른 그림을 본다. */
export function frequencies(text) {
    const map = new Map();
    for (const ch of text) map.set(ch, (map.get(ch) || 0) + 1);
    return [...map.entries()].map(([ch, n]) => ({ch, n}));
}

/**
 * 압축률(%). **강의노트와 같은 식이다** — 「줄어든 비율」이지 「몇 배」가 아니다.
 * 늘어나면 음수가 나오고, 그 음수가 이 화면에서 볼 것 가운데 하나다.
 */
export function compressRate(beforeBits, afterBits) {
    if (!beforeBits) return 0;
    return Math.round((1 - afterBits / beforeBits) * 1000) / 10;
}

/* ---------------------------------------------------------------
   기록기
   --------------------------------------------------------------- */

/**
 * @param {string} text 압축할 글
 * @param {object} opts
 *   - `kinds`  글자 가짓수. 기준 크기를 여기서 낸다. 안 주면 글에서 센다.
 */
export function createCompressRecorder(text, opts = {}) {
    const kinds = opts.kinds ?? new Set(text).size;
    const width = symbolBits(kinds);

    const frames = [];
    /** 내놓은 조각들. 조각마다 `bits`를 들고 있어 **화면과 셈이 같은 값을 본다.** */
    let out = [];
    /** 코드표·사전처럼 **본문 말고 함께 보내야 하는 것.** 압축률에는 안 들어간다. */
    let side = [];

    let note = '';
    let focus = [];      // 지금 들여다보는 입력 글자의 자리
    let span = null;     // 지금 묶고 있는 구간 [from, to)
    let extra = null;    // 방법마다 다른 부가 정보(허프만의 숲·트리, 키워드의 현재 글 따위)

    const sum = (list) => list.reduce((a, x) => a + x.bits, 0);

    function snap(act) {
        frames.push({
            text,
            width,
            kinds,
            act,
            out: out.map((o) => ({...o})),
            side: side.map((o) => ({...o})),
            marks: {focus: [...focus], span: span && {...span}},
            counts: {
                before: text.length * width,
                body: sum(out),
                table: sum(side),
            },
            extra,
            say: note,
        });
        /* **들여다보는 자리 표시만 그리고 나면 끈다.** 다음 장까지 남으면 어디를 보라는
           건지 흐려진다. **내놓은 조각과 코드표는 끄지 않는다** — 쌓이는 것을 보는 것이
           이 화면의 요점이다. */
        focus = [];
        span = null;
    }

    const rec = {
        get text() { return text; },
        get width() { return width; },
        get kinds() { return kinds; },
        get out() { return out; },

        say(t) { note = t; return rec; },

        /** 입력의 어느 자리를 들여다보는지. */
        look(...idx) { focus = idx.flat(); return rec; },
        /** 입력의 어느 구간을 묶는지. `to`는 포함하지 않는다. */
        cover(from, to) { span = {from, to}; return rec; },

        /** 방법마다 다른 부가 정보을 갈아 끼운다. 허프만이 숲과 트리를 여기 싣는다. */
        carry(value) { extra = value; return rec; },

        /**
         * 본문에 조각 하나를 내놓는다.
         * @param {object} piece `{kind, text, bits, ...}` — `bits`가 곧 셈이다.
         */
        emit(piece) {
            out.push({...piece});
            return rec;
        },

        /** 함께 보내야 하는 것(코드표·사전)에 한 줄 보탠다. */
        aside(piece) {
            side.push({...piece});
            return rec;
        },

        /** 한 장 남긴다. `emit`·`aside`와 달리 **이것을 불러야 장이 쌓인다.** */
        step(kind, data = {}) { snap({kind, ...data}); return rec; },

        done() {
            return {
                frames,
                text,
                width,
                kinds,
                out,
                side,
                bodyBits: sum(out),
                tableBits: sum(side),
                beforeBits: text.length * width,
            };
        },
    };
    return rec;
}
