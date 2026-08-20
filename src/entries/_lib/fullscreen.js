/* 시뮬레이터 전체 화면(프레젠테이션) 단추.
   교실 화면·빔프로젝터에 띄울 때 머리글·내비게이션을 걷어내고 시뮬레이터만 남긴다.

   HTML 규약과 모양은 src/styles/simulator.css 의 「전체 화면(프레젠테이션) 모드」에 있다.
   여기서는 단추를 눌렀을 때의 동작만 맡는다.

   **캔버스는 대부분 window 의 resize 를 듣고 자기 크기를 다시 잰다.**
   전체 화면으로 드나들면 뷰포트가 바뀌므로 브라우저가 resize 를 주기는 하지만,
   주는 시점이 화면 전환보다 이를 때가 있어 옛 크기로 다시 재는 일이 생긴다.
   전환이 끝난 뒤 한 번 더 알려 두면 어느 쪽이든 마지막 값이 맞는다. */

function targetOf(btn) {
    return document.getElementById(btn.dataset.fullscreen);
}

function bind() {
    document.querySelectorAll('button[data-fullscreen]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const el = targetOf(btn);
            if (!el) return;
            if (document.fullscreenElement) document.exitFullscreen();
            else if (el.requestFullscreen) el.requestFullscreen();
        });
    });

    document.addEventListener('fullscreenchange', () => {
        window.dispatchEvent(new Event('resize'));
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();
