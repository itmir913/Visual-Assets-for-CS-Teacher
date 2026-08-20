/* 실행 단추 -> 시각화 영역 자동 스크롤.
   좁은 화면에서는 실행 단추가 시각화 **아래**에 오므로, 누르는 순간 관찰 대상이
   화면 밖으로 나간다. 눌린 뒤에 그 시각화를 화면 위쪽으로 데려온다.

   페이지는 「어느 단추가 어느 그림을 보여 주는가」만 적는다.

       window.bindSimScroll([
           [['#btnTrain'], '#svmCanvas'],
       ]);

   **여기 있던 것과 같은 코드가 예전에는 18개 HTML에 통째로 복사돼 있었다.**
   한 곳을 고치면 열일곱 곳이 낡으므로 진입점으로 옮겼다. */

/* 화면 위에 붙는 막대가 가릴 높이.
   **「지금 붙어 있는가」로 재면 안 된다.** 단추를 누른 자리에서는 아직 안 붙어
   있어도, 스크롤한 뒤에는 붙어서 그림의 머리를 덮는다. 그래서 현재 위치가 아니라
   **붙었을 때의 아래쪽 좌표(css `top` + 높이)**를 쓴다. */
function topBarBottom() {
    let bottom = 0;
    document.querySelectorAll('body *').forEach((el) => {
        const cs = getComputedStyle(el);
        if (cs.position !== 'sticky' && cs.position !== 'fixed') return;
        if (cs.visibility === 'hidden' || cs.display === 'none') return;

        const top = parseFloat(cs.top);
        // `top: auto` 는 위에 붙지 않는다. 화면 한참 아래에 고정된 것(토스트)도 막대가 아니다.
        if (!isFinite(top) || top < 0 || top > window.innerHeight * 0.2) return;

        const r = el.getBoundingClientRect();
        if (r.height <= 0) return;
        // 표 안의 sticky 머리글은 페이지 막대가 아니다. 표 밖의 화면을 가리지 않는다.
        if (el.closest('table')) return;
        // 화면을 크게 덮는 것은 막대가 아니라 덮개다. 세면 엉뚱하게 멀리 스크롤한다.
        if (r.height > window.innerHeight * 0.3) return;

        const stuck = top + r.height;
        if (stuck > bottom) bottom = stuck;
    });
    return bottom;
}

function scrollToSimView(target) {
    const el = (typeof target === 'string') ? document.querySelector(target) : target;
    if (!el) return;

    const base = window.SIM_SCROLL_GAP || 16;
    const gap = topBarBottom() + base + (window.innerWidth < 640 ? 8 : 0);
    const r = el.getBoundingClientRect();

    // 이미 보기 좋은 자리에 있으면 움직이지 않는다.
    // (단계 실행을 연달아 누를 때 화면이 계속 튀는 것을 막는다.)
    if (r.top >= gap && r.top <= window.innerHeight * 0.6) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({
        top: Math.max(0, r.top + window.scrollY - gap),
        behavior: reduce ? 'auto' : 'smooth',
    });
}

window.scrollToSimView = scrollToSimView;

window.bindSimScroll = function (pairs) {
    pairs.forEach(([selectors, target]) => {
        selectors.forEach((sel) => {
            document.querySelectorAll(sel).forEach((btn) => {
                btn.addEventListener('click', () => {
                    /* 단추의 원래 동작이 **화면에 반영된 뒤**에 잰다.
                       `setTimeout(…, 0)` 은 아직 배치가 끝나기 전이라, 누르면서 늘어나거나
                       줄어드는 칸이 있는 페이지에서 옛 좌표로 스크롤한다.
                       rAF 를 두 번 기다리면 배치와 그리기가 한 번 끝난 뒤다. */
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => scrollToSimView(target));
                    });
                });
            });
        });
    });
};
