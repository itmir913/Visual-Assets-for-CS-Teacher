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

/**
 * @param {object} opts
 *  - `frames`   스냅샷 열
 *  - `render`   (frame, prev, {animate, ms}) => void
 *  - `onState`  ({index, total, playing, atEnd}) => void
 */
export function createStepPlayer({frames, render, onState}) {
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
        start() { goto(0); },
        destroy() { pause(); },
    };
}
