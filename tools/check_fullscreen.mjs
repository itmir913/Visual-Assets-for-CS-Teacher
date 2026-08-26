/* 전체 화면에서 **조작이 화면 밖으로 나가지 않는가.**
 *
 * 전체 화면은 교사가 그것만 켜 놓고 수업을 끌고 갈 수 있어야 뜻이 있다. 그런데
 * 오래도록 무대가 「그림 + 재생 줄」까지였고 탭·연산 버튼·값 입력·자료는 전부 무대
 * «밖»이었다 — 전체 화면에 들어가면 **알고리즘을 바꾸지도 값을 넣지도 못했다.**
 * 정렬에서는 「비교할 알고리즘」 고르개에 `fs-hide` 까지 붙어 아예 사라졌다.
 *
 * **이 결함이 오래 살아남은 까닭은 검사할 수가 없어서였다.** jsdom 도 자동화된
 * 브라우저도 `requestFullscreen` 을 켜지 못한다(iframe 에서는 거부된다). 그래서
 * 2026-08-27에 CSS 가 `:fullscreen` 대신 `fs-on` 클래스를 보게 바꾸었고,
 * 그 클래스는 `fullscreenchange` 때 `_lib/fullscreen.js` 가 붙인다 — 이제 검사가
 * 전체 화면을 «켜 놓고» 볼 수 있다.
 *
 * **못 보는 것.** jsdom 에는 레이아웃이 없다. 「조작이 무대 «안»에 있는가」는 보지만
 * 「화면 안에 들어오는가 · 겹치지 않는가」는 브라우저 몫이다.
 */

import fs from 'node:fs';
import path from 'node:path';

import {SIM_ROOT, loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 30) console.log('  ✗ ' + m); };

/* 아직 손대지 않은 갈래. **비어 있는 것이 목표다** — `subjects.json` 의 `font_exempt`,
   `check_sim_terms.py` 의 `PENDING` 과 같은 뜻이다. */
const PENDING = [];

function findPages(dir, prefix = '') {
    const out = [];
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        if (e.isDirectory()) out.push(...findPages(path.join(dir, e.name), prefix + e.name + '/'));
        else if (e.name.endsWith('.html')) out.push(prefix + e.name.slice(0, -5));
    }
    return out;
}

const PAGES = findPages(SIM_ROOT)
    .filter((p) => !PENDING.some((d) => p.startsWith(d + '/')))
    .sort();

/** 조작이라 부를 것. 링크(`<a>`)는 뺀다 — 푸터의 목록·저장소 링크는 조작이 아니다. */
const CONTROL = 'button, input, select, textarea';

/** **시뮬레이터의 조작이 아닌 것.** 페이지 껍데기(머리글의 메뉴 버튼)와, 스스로 확인하는
 *  퀴즈다. 퀴즈는 수업 «뒤»에 각자 푸는 것이라 전체 화면에 들어갈 까닭이 없다.
 *  페이지 쪽에서 빼겠다고 밝히려면 그 상자에 `fs-outside` 를 준다. */
const NOT_SIM = 'header, footer, nav, .fs-outside, .fs-dock';

let pages = 0;
for (const name of PAGES) {
    const page = loadSim(name);
    const {doc} = page;
    /* **살아 있게 만든 뒤에 본다.** 진입점이 `defer` 라 이것을 부르지 않으면
       `fullscreen.js` 도 UI 도 붙지 않아, 짜임이 깨져 있어도 조용히 통과한다. */
    page.lifecycle();
    pages++;

    /* **무대가 여럿인 페이지가 있다.** 탭마다 하나씩 두는 쪽(탐색 시뮬레이터)이 그렇다.
       첫째 것만 보면 나머지 탭의 조작이 통째로 «밖»으로 세어진다 — 실제로 그렇게
       26개가 거짓으로 잡혔다. **어느 무대든 그 안에 있으면 된다.** */
    const stages = [...doc.querySelectorAll('.fs-stage')];
    if (!stages.length) { bad(`${name} — 무대(.fs-stage)가 없다`); continue; }
    const stage = stages[0];
    const inAnyStage = (e) => stages.some((s) => s.contains(e));
    for (const s of stages) {
        if (!s.id) { bad(`${name} — 무대에 id 가 없다. 전체 화면 버튼이 가리킬 수 없다`); }
    }

    const btns = [...doc.querySelectorAll('button[data-fullscreen]')];
    if (!btns.length) { bad(`${name} — 전체 화면 버튼이 없다`); continue; }
    for (const b of btns) {
        const target = doc.getElementById(b.dataset.fullscreen);
        if (!target) bad(`${name} — 전체 화면 버튼이 없는 id 「${b.dataset.fullscreen}」을 가리킨다`);
        else if (!target.classList.contains('fs-stage')) {
            bad(`${name} — 전체 화면 버튼이 가리키는 「${b.dataset.fullscreen}」에 fs-stage 가 없다`);
        } else if (!target.contains(b)) {
            bad(`${name} — 전체 화면 버튼이 자기가 켤 무대 밖에 있다(${b.dataset.fullscreen})`);
        }
    }

    /* ---- 1. 조작이 전부 무대 안에 있는가 ------------------------------- */
    const outside = [...doc.querySelectorAll(CONTROL)]
        .filter((e) => !inAnyStage(e) && !e.closest(NOT_SIM));
    if (outside.length) {
        const 이름 = outside.slice(0, 6)
            .map((e) => e.id || (e.textContent || '').trim().slice(0, 12) || e.tagName)
            .join(' · ');
        bad(`${name} — 조작 ${outside.length}개가 무대 «밖»이다(전체 화면에서 누를 수 없다): ${이름}`);
    }

    /* ---- 2. 무대 «안»의 조작을 fs-hide 로 감추지 않았는가 --------------- */
    const hidden = stages.flatMap((s) => [...s.querySelectorAll(CONTROL)])
        .filter((e) => e.closest('.fs-hide'));
    if (hidden.length) {
        bad(`${name} — 조작 ${hidden.length}개가 `
            + `fs-hide 안에 있다 — 전체 화면에서 통째로 사라진다: `
            + hidden.slice(0, 4).map((e) => e.id || (e.textContent || '').trim().slice(0, 12)).join(' · '));
    }

    /* ---- 3. 짜임 -------------------------------------------------------
       **fs-cols 는 아직 cs 갈래만 갖췄다.** 없는 페이지를 위반으로 잡으면 ai 열여덟 장이
       한꺼번에 빨간불이 되어 검사를 꺼 두게 된다. 있으면 제대로 되었는지만 본다. */
    const cols = stage.querySelector('.fs-cols');
    if (cols) {
        if (!cols.classList.contains('fs-fill')) bad(`${name} — fs-cols 에 fs-fill 이 없다. 남는 높이를 못 받는다`);
        if (cols.parentElement !== stage) bad(`${name} — fs-cols 가 무대의 «직계 자식»이 아니다. fs-fill 규칙이 닿지 않는다`);
        if (!cols.querySelector('.fs-main')) bad(`${name} — fs-cols 안에 fs-main(그림 칸)이 없다`);
    }

    /* ---- 4. 전체 화면을 켜고 끄면 fs-on 이 따라오는가 ------------------- */
    const docks = [...doc.querySelectorAll('.fs-dock')];
    const dockHome = docks.map((d) => d.parentElement);
    page.fireFullscreenChange(stage);
    if (!stage.classList.contains('fs-on')) {
        bad(`${name} — 전체 화면에 들어갔는데 무대에 fs-on 이 붙지 않는다. 짜임이 통째로 안 듣는다`);
    }
    /* 탭 줄을 무대 안으로 들여왔는가. **여기까지 봐야 「탭을 바꿀 수 있다」가 참이 된다.** */
    for (const d of docks) {
        if (d.parentElement !== stage) bad(`${name} — fs-dock 이 전체 화면 무대 안으로 들어오지 않았다`);
    }

    /* ---- 5. 서랍 ------------------------------------------------------- */
    const drawer = stage.querySelector('.fs-drawer');
    const drawerBtn = doc.querySelector('button[data-fs-drawer]');
    if (drawer && !drawerBtn) bad(`${name} — 서랍은 있는데 여는 버튼이 없다`);
    if (drawerBtn) {
        if (!drawer) bad(`${name} — 서랍 버튼은 있는데 fs-drawer 가 없다`);
        else {
            if (!stage.contains(drawerBtn)) bad(`${name} — 서랍 버튼이 무대 밖이다`);
            drawerBtn.click();
            if (!stage.classList.contains('fs-drawer-open')) bad(`${name} — 서랍 버튼을 눌렀는데 열리지 않는다`);
            drawerBtn.click();
            if (stage.classList.contains('fs-drawer-open')) bad(`${name} — 서랍 버튼을 다시 눌렀는데 닫히지 않는다`);
        }
    }

    /* ---- 6. 탭마다 그림 모양을 알려 주는가 ------------------------------ */
    const tabHosts = ['group-tabs', 'method-tabs'].map((id) => doc.getElementById(id)).filter(Boolean);
    const shapeOf = () => (stage.classList.contains('fs-tall') ? 'tall'
        : stage.classList.contains('fs-wide') ? 'wide' : null);
    if (cols && !shapeOf()) bad(`${name} — 무대에 fs-wide·fs-tall 중 어느 것도 없다. 전체 화면에서 나눌 방향을 모른다`);
    for (const host of cols ? tabHosts : []) {
        for (const tab of [...host.children]) {
            tab.click();
            const sub = doc.getElementById('struct-tabs') || doc.getElementById('algo-tabs');
            for (const chip of sub ? [...sub.children] : []) {
                chip.click();
                if (!shapeOf()) {
                    bad(`${name} · ${chip.textContent.trim().slice(0, 14)} — 그림 모양(fs-wide·fs-tall)이 붙지 않았다`);
                }
            }
        }
    }

    /* ---- 7. 나온 뒤에는 표시가 떨어지는가 ------------------------------- */
    page.fireFullscreenChange(null);
    if (stage.classList.contains('fs-on')) bad(`${name} — 전체 화면에서 나왔는데 fs-on 이 남아 있다`);
    docks.forEach((d, i) => {
        if (d.parentElement !== dockHome[i]) bad(`${name} — 나왔는데 fs-dock 이 있던 자리로 돌아가지 않았다`);
    });
    if (stage.classList.contains('fs-drawer-open')) bad(`${name} — 나왔는데 서랍이 열린 채로 남아 있다`);

    for (const e of page.errors) bad(`${name} — 콘솔 오류: ${e.slice(0, 120)}`);
}

console.log(`전체 화면 짜임 — 시뮬레이터 ${pages}장에서 조작이 무대 안에 있는지, `
    + `fs-on·서랍·그림 모양이 따라오는지 보았다`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
process.exit(fail ? 1 : 0);
