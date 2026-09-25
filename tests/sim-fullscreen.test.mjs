import {test, expect} from 'vitest';
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

import {SIM_ROOT, loadSim} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 30) console.log('  ✗ ' + m); };

/* 아직 손대지 않은 갈래. **비어 있는 것이 목표다** — `subjects.json` 의 `font_exempt`,
   `checks/terms.mjs` 의 `PENDING` 과 같은 뜻이다. */
const PENDING = [];

function findPages(dir, prefix = '') {
    const out = [];
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        if (e.isDirectory()) out.push(...findPages(path.join(dir, e.name), prefix + e.name + '/'));
        else if (e.name.endsWith('.html')) out.push(prefix + e.name.slice(0, -5));
    }
    return out;
}

/* 시뮬레이터가 아니라 **입구**인 페이지. 링크 목록뿐이라 무대가 있을 까닭이 없다.
   루트 index.html에서 구워 낸다 → tools/checks/sim-index.mjs */
const ENTRANCE = ['index'];

const PAGES = findPages(SIM_ROOT)
    .filter((p) => !ENTRANCE.includes(p))
    .filter((p) => !PENDING.some((d) => p.startsWith(d + '/')))
    .sort();

/** 조작이라 부를 것. 링크(`<a>`)는 뺀다 — 푸터의 목록·저장소 링크는 조작이 아니다. */
const CONTROL = 'button, input, select, textarea';

/** **시뮬레이터의 조작이 아닌 것.** 페이지 껍데기(머리글의 메뉴 버튼)와, 스스로 확인하는
 *  퀴즈와, 무대를 고르는 탭 줄(`fs-tabs`)이다. 퀴즈는 수업 «뒤»에 각자 푸는 것이라
 *  전체 화면에 들어갈 까닭이 없고, 탭은 어느 무대를 켤지 켜기 «전»에 고르는 것이다.
 *  페이지 쪽에서 빼겠다고 밝히려면 그 상자에 `fs-outside` 를 준다. */
const NOT_SIM = 'header, footer, nav, .fs-outside, .fs-tabs';

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
    page.fireFullscreenChange(stage);
    if (!stage.classList.contains('fs-on')) {
        bad(`${name} — 전체 화면에 들어갔는데 무대에 fs-on 이 붙지 않는다. 짜임이 통째로 안 듣는다`);
    }
    /* **탭 줄이 무대 밖에 그대로 있는가.** 안으로 들어오면 눌러도 화면이 바뀌지 않는
       탭이 생긴다 → src/entries/_lib/fullscreen.js 의 `fs-tabs`. */
    for (const t of doc.querySelectorAll('.fs-tabs')) {
        if (stages.some((s) => s.contains(t))) bad(`${name} — 탭 줄(fs-tabs)이 무대 «안»에 있다. 전체 화면에서 눌러도 화면이 바뀌지 않는다`);
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

    for (const e of page.errors) bad(`${name} — 콘솔 오류: ${e.slice(0, 120)}`);
}

/* ---- 5. CSS 가 fs-on 을 «보는가» ------------------------------------------
   위에서는 fs-on 이 붙는지만 본다. 받침대는 CSS 를 읽지 않으므로, CSS 규칙이 `:fullscreen`
   만 보고 fs-on 을 잊으면 **클래스는 붙는데 아무 모양도 바뀌지 않는다** — 그리고 이 검사는
   초록이었다(2026-09-25 돌연변이로 확인). 그래서 CSS 원문에서 `:fullscreen` 이 나오는 자리마다
   `:is(:fullscreen, .fs-on)` 짝으로 적혀 있는지 본다. */
{
    const ROOT = path.resolve(SIM_ROOT, '..');
    const sheets = [path.join(ROOT, 'src/styles/simulator.css')];
    const walk = (d) => fs.readdirSync(d, {withFileTypes: true}).flatMap((e) =>
        e.isDirectory() ? walk(path.join(d, e.name)) : e.name.endsWith('.html') ? [path.join(d, e.name)] : []);
    sheets.push(...walk(SIM_ROOT));
    let paired = 0;
    for (const f of sheets) {
        const src = fs.readFileSync(f, 'utf8');
        const css = f.endsWith('.css') ? src : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
        for (const m of css.matchAll(/:fullscreen/g)) {
            const around = css.slice(Math.max(0, m.index - 4), m.index + 40);
            /* 뒤에 더 붙는 것(`sim-deck` 의 `.fs-desk`)은 받는다 — 짝이 있는지만 본다. */
            if (/:is\(\s*:fullscreen\s*,\s*\.fs-on\s*(?:,[^)]*)?\)/.test(around)) { paired++; continue; }
            const line = css.slice(0, m.index).split('\n').length;
            bad(`${path.relative(ROOT, f)} — CSS 의 :fullscreen 에 .fs-on 짝이 없다(${line}행 근처). `
                + '검사는 fs-on 으로 켜 보므로 이 규칙은 검사에서 한 번도 적용되지 않는다');
        }
    }
    if (paired < 10) bad(`simulator.css 에 :is(:fullscreen, .fs-on) 규칙이 ${paired}개뿐이다 — 전체 화면 짜임이 사라졌다`);
}

console.log(`전체 화면 짜임 — 시뮬레이터 ${pages}장에서 조작이 무대 안에 있는지, `
    + `fs-on·그림 모양이 따라오는지 보았다`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
test('fullscreen', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
