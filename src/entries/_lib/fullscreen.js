/* 시뮬레이터 전체 화면(프레젠테이션) 버튼.
   교실 화면·빔프로젝터에 띄울 때 머리글·내비게이션을 걷어내고 시뮬레이터만 남긴다.

   HTML 규약과 모양은 src/styles/simulator.css 의 「전체 화면(프레젠테이션) 모드」에 있다.
   여기서는 버튼을 눌렀을 때의 동작만 맡는다.

   **캔버스는 대부분 window 의 resize 를 듣고 자기 크기를 다시 측정한다.**
   전체 화면으로 드나들면 뷰포트가 바뀌므로 브라우저가 resize 를 주기는 하지만,
   주는 시점이 화면 전환보다 이를 때가 있어 옛 크기로 다시 측정하는 일이 생긴다.
   전환이 끝난 뒤 한 번 더 알려 두면 어느 쪽이든 마지막 값이 맞는다. */

function targetOf(btn) {
    return document.getElementById(btn.dataset.fullscreen);
}

/* **전체 화면일 때는 그 요소 바깥이 아예 그려지지 않는다.**
   그래서 `document.body` 에 붙인 토스트는 전체 화면에서 통째로 보이지 않는다 —
   규칙 위반 이유처럼 **꼭 보여야 하는 것**이 조용히 사라진다.

   새로 만들어 띄우는 것은 `window.fsOverlayHost()` 가 주는 자리에 붙이고,
   마크업에 이미 있는 것은 `fs-float` 를 달아 두면 드나들 때 이 모듈이 옮겨 준다.
   `position: fixed` 는 안으로 옮겨도 화면 기준 그대로라 자리는 변하지 않는다. */
window.fsOverlayHost = () => document.fullscreenElement || document.body;

/* **표시는 기억해 두고 요소로 붙잡는다.**
   페이지의 `showToast` 들이 `el.className = '...'` 로 클래스를 통째로 덮어써서,
   토스트가 한 번 뜨고 나면 `fs-float` 표시가 지워진다. 그때부터는 다시 찾을 수 없어
   전체 화면에서 영영 안 보이게 된다. 그래서 **처음 본 요소를 그대로 들고 있는다** —
   클래스가 지워져도 옮길 수 있다. */
const floats = new Set();

function collectFloats() {
    document.querySelectorAll('.fs-float').forEach((el) => floats.add(el));
}

function moveFloats() {
    collectFloats();          // 나중에 생긴 것도 여기서 주워 담는다
    const host = window.fsOverlayHost();
    floats.forEach((el) => {
        if (el.isConnected && el.parentElement !== host) host.appendChild(el);
    });
}

function bind() {
    /* **iOS 사파리(아이폰)에는 요소 전체 화면이 없다.** `requestFullscreen` 자체가
       없어서, 그냥 두면 눌러도 아무 일이 없는 죽은 버튼이 남는다.
       쓸 수 없으면 내놓지 않는다 — 좁은 화면 숨김은 CSS 가 따로 맡는다. */
    if (!document.fullscreenEnabled) {
        document.querySelectorAll('button[data-fullscreen]').forEach((btn) => {
            btn.hidden = true;
        });
        return;
    }

    collectFloats();

    document.querySelectorAll('button[data-fullscreen]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const el = targetOf(btn);
            if (!el) return;
            /* **`fullscreenEnabled` 가 참이어도 요청은 거부될 수 있다.** 다른 페이지에
               iframe 으로 얹혔을 때가 그렇다 — 위의 가로막기는 통과하는데 부름은
               「Permissions check failed」로 거부된다. 받아 주는 데가 없으면
               학생 화면의 콘솔에 붉은 오류가 남으므로 여기서 삼킨다.
               못 켜면 그냥 안 켜지는 것이 맞다. */
            const ignore = () => {};
            if (document.fullscreenElement) Promise.resolve(document.exitFullscreen()).catch(ignore);
            else if (el.requestFullscreen) Promise.resolve(el.requestFullscreen()).catch(ignore);
        });
    });

    document.addEventListener('fullscreenchange', () => {
        moveFloats();
        window.dispatchEvent(new Event('resize'));
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();
