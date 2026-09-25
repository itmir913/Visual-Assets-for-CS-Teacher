/* 스냅샷 열을 재생한다. 재생 · 멈춤 · 한 단계 앞뒤 · 스크럽 · 속도.
 *
 * **정렬에서 태어났지만 정렬에 매인 데가 없다.** 스냅샷 열과 그리는 함수만 받으므로
 * 무엇을 그리든 상관하지 않는다 — 그래서 정렬 · 선형 자료구조 · 트리가 이것 하나를 쓴다.
 * 쓰는 곳이 셋을 넘어선 2026-08-26에 `sort/`에서 `_lib/`로 올리고 이름에서 정렬을 뗐다.
 *
 * **되감기와 애니메이션은 서로 싸운다.** 트랜지션은 시간이 걸리는데 되감기와
 * 스크럽은 아무 데로나 뛴다. 그래서 규칙을 하나로 못박는다.
 *
 *   > **앞으로 한 칸 갈 때만 움직여 그린다. 되감기 · 스크럽 · 최고 속도는 즉시 그린다.**
 *
 * 스냅샷이 진리이고 애니메이션은 **이웃한 두 장의 차이를 보고 붙이는 장식**일 뿐이라,
 * 어디로 뛰든 화면은 언제나 그 장의 상태와 정확히 같다.
 * 트랜지션이 밀렸다고 끝값을 잃는 일이 있을 수 없다.
 */

/** 속도 단계. 값은 한 장에 머무는 밀리초다. */
export const PLAY_SPEEDS = [
    {id: 'slow', name: '느리게', ms: 900},
    {id: 'normal', name: '보통', ms: 380},
    {id: 'fast', name: '빠르게', ms: 120},
    {id: 'turbo', name: '최고', ms: 16},
];

/** 이 밑으로는 움직여 그리지 않는다. 트랜지션보다 다음 장이 먼저 와서 어지럽기만 하다. */
const ANIMATE_MIN_MS = 100;

/** 자리를 잡으려고 그려 보는 장의 수 천장. 넘으면 고르게 솎아 그린다. */
const RESERVE_MAX_FRAMES = 240;

/**
 * **한 회차에서 가장 높은 장만큼 그림 칸의 자리를 미리 잡는다.**
 *
 * 누를 때마다 화면이 흔들리지 않아야 한다(2026-09-25 사용자 확정). 그런데 중간에 한 줄이
 * 생기는 장(해시 테이블의 경고 띠, 쌓이며 접히는 압축 결과)에서 그림이 자라면 그 아래
 * 재생 버튼이 내려갔다. 그래서 회차를 시작하기 전에 장을 한 번씩 그려 보고 가장 높았던
 * 만큼을 잡아 둔다. 잡는 곳은 화면에 따라 다르다.
 *
 *   - **넓은 평소 화면**(`fs-desk`) — 칸 높이는 무대가 정한다. 그림이 칸보다 넘치는 만큼을
 *     무대의 `--fs-extra` 에 적어 **무대를 그만큼 늘린다**(칸 안에서 스크롤하지 않는다).
 *   - **좁은 화면** — 칸이 그림 높이를 따라가므로 가장 높은 장을 칸의 `min-height` 로 둔다.
 *   - **전체 화면**(`fs-on`) — 화면 밖이 없다. 아무것도 잡지 않고 칸 안에서 스크롤한다.
 *
 * @param {HTMLElement} el      그림 칸
 * @param {object[]}    frames  스냅샷 열
 * @param {Function}    render  재생기가 받은 그리는 함수
 */
export function reserveHeight(el, frames, render) {
    if (!frames.length) return;
    const stage = el.closest('.fs-stage');
    const desk = stage?.classList.contains('fs-desk') && !stage.classList.contains('fs-on');
    el.style.minHeight = '';
    if (stage && desk) stage.style.setProperty('--fs-extra', '0px');
    if (stage?.classList.contains('fs-on')) return;

    const stride = Math.max(1, Math.ceil(frames.length / RESERVE_MAX_FRAMES));
    const picks = [];
    for (let i = 0; i < frames.length; i += stride) picks.push(frames[i]);
    picks.push(frames[frames.length - 1]);
    let tallest = 0;   // 좁은 화면: 가장 높은 그림
    let over = 0;      // 넓은 화면: 칸을 가장 많이 넘친 만큼
    let worst = picks[0];
    for (const f of picks) {
        render(f, null, {animate: false, ms: 0});
        tallest = Math.max(tallest, el.scrollHeight);
        const o = el.scrollHeight - el.clientHeight;
        if (o > over) { over = o; worst = f; }
    }
    if (!desk) {
        if (tallest > 0) el.style.minHeight = `${Math.ceil(tallest)}px`;
        return;
    }
    /* **늘린 만큼이 다 그림 칸으로 가지 않는다.** 조작 띠의 높이 한도가 무대에 비례해
       (가로형 띠 `max-height: 45%`) 무대가 길어지면 띠도 함께 자라 몫을 나눠 가진다.
       그래서 가장 많이 넘친 장을 다시 그려 보며 모자란 만큼을 몇 번 더 채운다. */
    let extra = Math.ceil(over);
    for (let pass = 0; pass < 4 && over > 0; pass++) {
        stage.style.setProperty('--fs-extra', `${extra}px`);
        render(worst, null, {animate: false, ms: 0});
        over = el.scrollHeight - el.clientHeight;
        extra += Math.max(0, Math.ceil(over));
    }
    stage.style.setProperty('--fs-extra', `${extra}px`);
}

/**
 * @param {object} opts
 *  - `frames`   스냅샷 열
 *  - `render`   (frame, prev, {animate, ms}) => void
 *  - `onState`  ({index, total, playing, atEnd}) => void
 *  - `reserve`  그림 칸 요소(고를 수 있음). 주면 `start` 가 **이 회차의 가장 높은 장만큼
 *               자리를 미리 잡는다** → `reserveHeight`
 *  - `reserveFirstOnly`  첫 장만 그려 보고 잡는다. 줄 높이를 회차 내내 고정해 두는 그림
 *               (정렬 막대)은 장마다 높이가 같으므로, 수천 장을 다 그려 볼 까닭이 없다
 */
export function createStepPlayer({frames, render, onState, reserve, reserveFirstOnly = false}) {
    let index = 0;
    let playing = false;
    let timer = null;
    let ms = PLAY_SPEEDS[1].ms;

    const total = frames.length;
    const clamp = (i) => Math.max(0, Math.min(total - 1, i));

    function tell() {
        onState?.({index, total, playing, atEnd: index >= total - 1, ms});
    }

    /** @param {boolean} animate 움직여 그릴지. 부르는 쪽이 정한다 — 여기서 추측하지 않는다. */
    function draw(prevIndex, animate) {
        const prev = prevIndex === null ? null : frames[prevIndex];
        render(frames[index], prev, {animate: animate && ms >= ANIMATE_MIN_MS, ms});
    }

    function goto(next, {animate = false} = {}) {
        const prev = index;
        index = clamp(next);
        draw(prev, animate && index === prev + 1);
        tell();
    }

    function tick() {
        if (index >= total - 1) { pause(); return; }
        goto(index + 1, {animate: true});
        if (playing) timer = setTimeout(tick, ms);
    }

    function play() {
        if (playing || total === 0) return;
        // 끝에서 다시 누르면 처음부터. 「아무 일도 안 일어나는 버튼」가 되지 않게 한다.
        if (index >= total - 1) goto(0);
        playing = true;
        tell();
        timer = setTimeout(tick, ms);
    }

    function pause() {
        playing = false;
        if (timer) { clearTimeout(timer); timer = null; }
        tell();
    }

    return {
        get index() { return index; },
        get total() { return total; },
        get playing() { return playing; },
        play,
        pause,
        toggle: () => (playing ? pause() : play()),
        /** 한 단계. **앞으로 갈 때만 움직여 그린다.** */
        step(delta) {
            pause();
            goto(index + delta, {animate: delta === 1});
        },
        /** 슬라이더가 부른다. 어디로 뛰든 즉시 그린다. */
        seek(i) {
            pause();
            goto(i);
        },
        toStart() { pause(); goto(0); },
        toEnd() { pause(); goto(total - 1); },
        setSpeed(nextMs) {
            ms = nextMs;
            if (playing) { clearTimeout(timer); timer = setTimeout(tick, ms); }
            tell();
        },
        /** 처음 한 번 그린다. */
        start() {
            if (reserve) reserveHeight(reserve, reserveFirstOnly ? frames.slice(0, 1) : frames, render);
            goto(0);
        },
        destroy() { pause(); },
    };
}
