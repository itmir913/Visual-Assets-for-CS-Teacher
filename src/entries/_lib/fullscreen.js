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

/** 전체 화면에서 그림과 조작을 **어느 쪽으로 나눌지** 무대에 알려 준다.
 *
 * **탭마다 다르다.** 같은 페이지 안에서도 배열 칸 줄은 1200×130으로 가로로 길고,
 * 「나란히 비교」는 1200×1000으로 세로로 크다. 가로로 긴 그림을 좌우로 쪼개면
 * 그림이 절반으로 눌리고, 세로로 큰 그림을 위아래로 쌓으면 조작이 화면 밖으로 밀린다.
 * 어느 쪽인지는 **등록부의 `shape`** 가 정한다(적지 않으면 가로형).
 *
 * @param {'wide'|'tall'|undefined} shape
 */
export function setStageShape(shape) {
    const st = document.querySelector('.fs-stage');
    if (!st) return;
    const tall = shape === 'tall';
    st.classList.toggle('fs-tall', tall);
    st.classList.toggle('fs-wide', !tall);
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

/* **탭 줄을 전체 화면 안으로 들여온다.**
   무대를 탭마다 하나씩 두는 페이지(맹목적 탐색·정보 이용 탐색·결정 트리)는 탭 줄이
   무대 «밖»에 있다. 그러면 전체 화면에서 탭을 바꿀 수가 없어, 교사가 켜 놓은 그 하나에
   갇힌다. 무대를 하나로 합치려면 페이지를 통째로 다시 짜야 하므로, **드나들 때 옮긴다.**

   `fs-dock` 을 준 것은 전체 화면에 들어갈 때 그 무대의 «맨 앞»으로 들어가고,
   나올 때 **있던 자리로 돌아간다.** 자리를 기억해 두지 않으면 페이지가 어그러진다. */
const docks = new Map();      // el → {parent, next}

function moveDocks() {
    const fs = document.fullscreenElement;
    document.querySelectorAll('.fs-dock').forEach((el) => {
        if (!docks.has(el)) docks.set(el, {parent: el.parentElement, next: el.nextSibling});
    });
    for (const [el, home] of docks) {
        if (!el.isConnected && !home.parent) continue;
        if (fs && fs.classList.contains('fs-stage')) {
            if (el.parentElement !== fs) fs.insertBefore(el, fs.firstChild);
        } else if (home.parent && el.parentElement !== home.parent) {
            const before = home.next && home.next.isConnected ? home.next : null;
            home.parent.insertBefore(el, before);
        }
    }
}

/** 서랍을 **안에서 닫는 문**을 달아 둔다.
 *
 * 여는 버튼은 탭 줄 오른쪽 끝에 있는데, 열린 서랍이 바로 그 자리를 덮는다 —
 * **열고 나면 닫을 방법이 없었다.** 전체 화면을 통째로 나가는 Esc 뿐이었는데,
 * 자료 한 번 바꾸자고 수업 화면을 내릴 수는 없다.
 *
 * **페이지마다 적지 않고 여기서 달아 둔다.** 복사 버튼을 모든 `<pre>` 에 빌드가
 * 붙이는 것과 같은 이치다 — 새 서랍을 만들면 문이 저절로 따라온다.
 * 모양은 simulator.css 의 `fs-drawer-close`. */
function addDrawerClose() {
    document.querySelectorAll('.fs-drawer').forEach((drawer) => {
        if (drawer.querySelector('.fs-drawer-close')) return;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'fs-drawer-close';
        btn.innerHTML = '<i class="fa-solid fa-xmark"></i> 닫기';
        btn.addEventListener('click', () => {
            const stage = drawer.closest('.fs-stage');
            if (stage) stage.classList.remove('fs-drawer-open');
        });
        drawer.insertBefore(btn, drawer.firstChild);
    });
}

/** 화면에 나와 있는가. **자기만 보지 않고 조상까지 거슬러 본다** —
 *  탭을 감추는 자리가 무대 자신이 아니라 **무대를 싼 바깥 상자**인 페이지가 있다
 *  (결정 트리가 그렇다: `sec-cat` 을 감추고 무대 `catStage` 는 그 안에 있다). */
function isShown(el) {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
        if (getComputedStyle(n).display === 'none') return false;
    }
    return true;
}

/** 지금 화면에 나와 있는 무대.
 *
 * **전체 화면인 것 하나는 빼고 센다.** 그것만은 `display` 가 참말을 하지 않는다 —
 * 무대에 걸린 전체 화면 규칙(`:has(> .fs-fill)` 등)이 특정도로 `.hidden` 을 이겨서,
 * 페이지가 감춘 뒤에도 `flex` 로 남는다. 나머지 무대는 그 규칙이 닿지 않아 정직하다. */
function shownStages() {
    const fs = document.fullscreenElement;
    return [...document.querySelectorAll('.fs-stage')].filter((el) => el !== fs && isShown(el));
}

/* **탭을 바꾸면 전체 화면도 따라간다.**

   무대를 탭마다 하나씩 두는 페이지는 탭을 바꾸면 **전체 화면인 그 무대가 감춰지고**
   옆의 형제가 드러난다. 그런데 드러난 형제는 top layer 밖이라 전체 화면에는 아예
   그려지지 않고, 감춰진 쪽은 위에 적은 특정도 탓에 그대로 남는다 —
   **탭 줄은 새 탭을 가리키는데 화면은 옛 탭인 채로 멈춘다.**

   **페이지의 `switchTab` 마다 적지 않고 여기서 맡는다.** 탭을 바꾸는 코드는 페이지마다
   다르게 자라므로(`.hidden` 토글 · `.tab-content.active` · 저마다의 `switchTab`),
   거기에 한 줄씩 적어 두면 반드시 한 곳이 빠진다. 닫는 문을 여기서 달아 주는 것과
   같은 이치다 → `addDrawerClose`.

   **누른 김에, 그 클릭 처리 안에서 옮긴다.** 브라우저는 사용자 조작 없는
   `requestFullscreen` 을 거부하므로 뒤로 미룰 수 없다. 이미 전체 화면일 때 다른 요소를
   요청하면 나갔다 들어오지 않고 **대상만 바뀐다.** 뒤따르는 `fullscreenchange` 가
   `fs-on` 과 탭 줄(`fs-dock`)을 새 무대로 옮기고 `resize` 를 쏜다. */
let shownBeforeClick = null;

function bindTabRetarget() {
    document.addEventListener('click', (e) => {
        const fs = document.fullscreenElement;
        shownBeforeClick = fs && fs.classList.contains('fs-stage') && fs.contains(e.target)
            ? shownStages() : null;
    }, true);

    /* 페이지의 핸들러는 눌린 것 자신에 걸려 있어 여기(문서까지 거슬러 온 뒤)보다 먼저 돈다.
       **새로 드러난 무대가 있을 때만** 옮긴다 — 전체 화면 안의 여느 버튼을 눌렀을 때
       엉뚱하게 전환하지 않는다. */
    document.addEventListener('click', () => {
        const before = shownBeforeClick;
        shownBeforeClick = null;
        if (!before) return;
        const next = shownStages().find((el) => !before.includes(el));
        if (next && next.requestFullscreen) {
            Promise.resolve(next.requestFullscreen()).catch(() => {});
        }
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

    /* **「자료」 서랍.** 자료를 갈아 끼우는 일은 자주 하지 않는데 자리를 많이 먹는다.
       전체 화면에서만 오른쪽에서 미끄러져 나오게 접어 둔다 → simulator.css 의 `fs-drawer`. */
    document.querySelectorAll('button[data-fs-drawer]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const el = document.getElementById(btn.dataset.fsDrawer);
            if (el) el.classList.toggle('fs-drawer-open');
        });
    });

    addDrawerClose();
    bindTabRetarget();

    document.addEventListener('fullscreenchange', () => {
        syncStageClass();
        moveDocks();
        moveFloats();
        window.dispatchEvent(new Event('resize'));
    });
}

/** 전체 화면인 무대에 `fs-on` 을 붙인다.
 *
 * **CSS 가 `:fullscreen` 이 아니라 이 클래스를 본다.** 까닭은 둘이다.
 *   - `requestFullscreen` 은 **iframe 안에서 거부된다.** 미리보기 창이 그렇고,
 *     다른 페이지에 얹혔을 때도 그렇다. 그때도 짜임은 맞아야 한다.
 *   - **검사가 볼 수 있게 된다.** jsdom 도 자동화된 브라우저도 진짜 전체 화면을
 *     켤 수 없어서, 예전에는 전체 화면 짜임을 **한 번도 검사하지 못했다.**
 *     클래스면 켜 놓고 측정할 수 있다.
 *
 * 나갈 때는 서랍도 함께 닫는다. 열어 둔 채 나가면 평소 화면에서 그 칸이
 * 엉뚱한 자리에 앉는다. */
function syncStageClass() {
    const fs = document.fullscreenElement;
    document.querySelectorAll('.fs-stage').forEach((el) => {
        const on = el === fs;
        el.classList.toggle('fs-on', on);
        if (!on) el.classList.remove('fs-drawer-open');
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
else bind();
