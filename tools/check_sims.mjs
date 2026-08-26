// 시뮬레이터 **전체를 한 번에** 살피는다. 페이지 원문을 node 에서 돌려 세 가지를 본다.
//
//   1. **뜨는가.** 인라인 스크립트 평가부터 `DOMContentLoaded` · `load` 까지 예외가 없는가.
//      감사 때 「초기 로드 콘솔 스윕은 0건인데 그 뒤에 오류가 잔뜩」이었던 자리를 자동화한다.
//   2. **캔버스가 화면 크기 × 화면 배율로 잡히는가.** 배율을 빼먹으면 2배 화면과 4K 교실
//      화면에서 선과 글자가 흐려진다. 크기를 바꿀 때와 **전체 화면을 드나든 뒤**에도 본다 —
//      전체 화면 해제는 창 크기가 되돌아오기 전에 알림이 오는 일이 있어 특히 잘 어긋난다.
//   3. **마크업의 `on*="…"` 가 가리키는 것이 실제로 있는가.** 이름만 살피는 검사는
//      `on*="obj.method()"` 꼴을 놓친다. 실제로 정의 없는 핸들러가 배포된 적이 있다.
//
// **못 보는 것을 밝혀 둔다.** prismjs · chart.js · ml5 · mathjax 를 쓰는 페이지는 그 모듈을
// 가짜로 때운다. 그런 페이지는 아래 표에 「가짜로 때운 것」으로 찍히므로,
// **그 페이지의 통과는 「죽지는 않는다」까지만 뜻한다.** 알맹이는 각 페이지 전용 검사가 본다
// (`check:graph-sim` · `check:puzzle` · `check:deep-learning`).
//
// **d3 를 쓰는 트리·그래프 렌더러는 2026-08-26부터 진짜로 돈다**(받침대가 jsdom 위에서
// 그 꾸러미를 실제로 얹는다). 그 전에는 빈 껍데기여서, 그리는 코드에 무슨 짓을 해도
// 이 검사가 초록이었다 — 콜백에 엉뚱한 모양을 기대한 결함이 그렇게 브라우저까지 갔다.
// **다만 레이아웃은 여전히 없다** — 글자 폭과 상자 크기는 어림값이라 겹침은 못 본다.

import fs from 'node:fs';
import path from 'node:path';

import {SIM_ROOT, loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

/* **전용 검사가 페이지를 통째로 보는 것은 여기서 빼둔다.** 탭·프리셋처럼 페이지만 아는
   구조를 이 훑기가 흉내 내려면 페이지 사정을 여기 베껴 적어야 하고, 그러면 낡는다. */
const OWN_CHECK = {
    'ai/deep-learning': 'check:deep-learning',
};

/* **`simulator/` 아래를 통째로 살피는다.** 예전에는 `simulator/ai` 를 못박아 두었는데,
   그러면 새로 만든 갈래(`simulator/cs` 등)가 **검사에 걸리지도 않으면서 통과로 보인다.**
   페이지 이름은 여기서부터 `ai/…` 처럼 폴더를 붙인 상대경로다. */
function findPages(dir, prefix = '') {
    const out = [];
    for (const e of fs.readdirSync(dir, {withFileTypes: true})) {
        if (e.isDirectory()) out.push(...findPages(path.join(dir, e.name), prefix + e.name + '/'));
        else if (e.name.endsWith('.html')) out.push(prefix + e.name.slice(0, -5));
    }
    return out;
}

const PAGES = findPages(SIM_ROOT)
    .filter((p) => !OWN_CHECK[p])
    .sort();

/* ================================================================
   2. 캔버스 해상도
   ================================================================ */

/** 상자를 정사각으로만 흔든다 — 좌표계를 고정해 두는 페이지(결정 트리)도 같은 잣대로 볼 수 있다. */
const STEPS = [
    ['처음', 800],
    ['상자 줄이기', 520],
    ['상자 키우기', 1000],
];

function checkCanvasResolution(page, sim) {
    const seen = [];
    const look = (label) => {
        for (const c of sim.canvases()) {
            const want = Math.round(c.clientWidth * sim.dpr);
            const wantH = Math.round(c.clientHeight * sim.dpr);
            if (c.width !== want || c.height !== wantH) {
                bad(`${page} · ${label} — 캔버스 #${c.id} 가 ${c.width}×${c.height}, ` +
                    `기대값 ${want}×${wantH} (화면 ${c.clientWidth}×${c.clientHeight}, 배율 ${sim.dpr})`);
            }
            seen.push(c.id);
        }
    };

    for (const [label, size] of STEPS) {
        sim.setBox(size, size);
        if (label !== '처음') sim.fireResize();
        look(label);
    }

    /* 전체 화면. **해제 알림이 창 크기가 되돌아오기 전에 오는 경우**까지 재현한다 —
       크롬에서 실제로 그렇고, 딥러닝 시뮬레이터가 그 한 박자 때문에 굳어 있었다. */
    sim.setBox(1400, 1400);
    sim.fireFullscreenChange(sim.el('__fs'));
    look('전체 화면 안');

    sim.fireFullscreenChange(null);        // 아직 1400 으로 잰다
    sim.setBox(1000, 1000);
    sim.fireResize();
    look('전체 화면 해제 뒤');

    return [...new Set(seen)];
}

/* ================================================================
   3. 마크업이 부르는 핸들러가 실제로 있는가
   ================================================================ */

function checkInlineHandlers(page, sim) {
    const html = fs.readFileSync(path.join(SIM_ROOT, page + '.html'), 'utf8');
    const names = new Set();
    for (const m of html.matchAll(/\son[a-z]+\s*=\s*"([^"]*)"/g)) {
        // `obj.method(...)` · `fn(...)` 의 **앞머리 이름**만 뽑는다. 이름만 살피는 검사가
        // 놓치던 것이 바로 점이 붙은 꼴이다.
        for (const call of m[1].matchAll(/([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\(/g)) {
            names.add(call[1]);
        }
    }
    const RESERVED = new Set(['if', 'for', 'while', 'return', 'typeof', 'new', 'this', 'alert', 'confirm']);
    let n = 0;
    for (const chain of names) {
        const parts = chain.split('.');
        if (RESERVED.has(parts[0])) continue;
        n++;

        /* **페이지 안에서 평가해 본다.** `let`·`const` 로 선언한 것은 sandbox 의 속성이
           되지 않는데, 브라우저에서는 인라인 핸들러가 그 이름을 볼 수 있다.
           sandbox 속성만 뒤지면 멀쩡한 것을 없다고 잡는다. */
        const probe = '(() => { try { const head = ' + parts[0] + ';' +
            ' if (head === undefined) return "없음";' +
            ' if (head === null) return "아직-없음";' +
            ' let cur = head;' +
            ' for (const p of ' + JSON.stringify(parts.slice(1)) + ') {' +
            '   if (cur == null) return "아직-없음";' +
            '   cur = cur[p]; }' +
            ' return typeof cur;' +
            ' } catch (e) { return "없음"; } })()';
        const kind = sim.evalInPage(probe);

        /* **`아직-없음` 은 잘못이 아니다.** 학생이 학습 버튼을 누르기 전에는 뷰가 없는
           페이지가 있고, 그 마크업은 `onclick="if(view) view.fit()"` 처럼 막아 두었다.
           여기서 잡으면 멀쩡한 것을 잡는 셈이 된다. */
        if (kind === '없음') bad(`${page} — 마크업이 부르는 \`${chain}(…)\` 이 정의되어 있지 않다`);
        else if (kind !== 'function' && kind !== '아직-없음') {
            bad(`${page} — \`${chain}\` 이 함수가 아니다(${kind})`);
        }
    }
    return n;
}


/* ================================================================
   4. 버튼을 눌러 보고, 화면에 뜬 숫자가 성한가
   ================================================================
   감사에서 반복해 나온 것이 **발산한 값이 그대로 화면에 뜨는 것**과
   **자동 실행 중에 다른 버튼을 누르면 죽는 것**이었다. 둘 다 「뜨는가」만 보는
   검사로는 잡히지 않는다. 그래서 마크업에 있는 버튼을 하나씩 눌러 보고,
   그때마다 예외가 났는지와 **화면 글자에 `NaN`·`Infinity`·`undefined` 가 섞였는지**를 본다.

   **타이머는 돌지 않는다.** 이 받침대는 예약된 콜백을 굳이 돌리지 않으므로
   자동 실행 루프가 폭주하지 않는다 — 누르는 순간에 나는 잘못만 잡힌다. */

const SICK = /\bNaN\b|\bInfinity\b|\bundefined\b/;

function screenText(sim) {
    const out = [];
    for (const {id, text, html, value} of sim.texts()) {
        for (const v of [text, html, value]) if (v) out.push([id, v]);
    }
    return out;
}

function checkButtons(page, sim) {
    const html = fs.readFileSync(path.join(SIM_ROOT, page + '.html'), 'utf8');
    const ids = [];
    for (const m of html.matchAll(/<button\b([^>]*)>/g)) {
        const id = m[1].match(/\bid="([^"]*)"/)?.[1];
        if (id) ids.push(id);
    }

    let told = false;              // 한 페이지에 한 번만 알린다 — 누를 때마다 같은 말이 나온다
    const sick = (label) => {
        if (told) return;
        for (const [id, text] of screenText(sim)) {
            const hit = text.match(SICK);
            if (hit) {
                bad(`${page} · ${label} — #${id} 에 \`${hit[0]}\` 가 떴다: ` +
                    text.replace(/\s+/g, ' ').slice(0, 70));
                told = true;
                return;
            }
        }
    };

    sick('처음');
    for (const id of ids) {
        const before = sim.errors.length;
        try {
            sim.el(id).click();
        } catch (e) {
            bad(`${page} — #${id} 를 누르다가 죽었다: ${e.message}`);
            continue;
        }
        for (const e of sim.errors.slice(before)) bad(`${page} — #${id} 를 누르니 ${e}`);
        sick(`#${id} 누른 뒤`);
    }
    return ids.length;
}

/* ================================================================ */

console.log(`시뮬레이터 ${PAGES.length}개를 페이지 원문 그대로 돌린다` +
    ` (전용 검사가 따로 보는 것 ${Object.keys(OWN_CHECK).length}개는 뺐다: ` +
    Object.entries(OWN_CHECK).map(([p, c]) => `${p} → ${c}`).join(', ') + ')');

const rows = [];
for (const page of PAGES) {
    let sim;
    try {
        sim = loadSim(page, {box: {w: 800, h: 800}});
        sim.lifecycle();
    } catch (e) {
        bad(`${page} — 띄우다가 죽었다: ${e.message}`);
        continue;
    }
    for (const e of sim.errors) bad(`${page} — ${e}`);

    const canvases = checkCanvasResolution(page, sim);
    const handlers = checkInlineHandlers(page, sim);
    const buttons = checkButtons(page, sim);
    rows.push({page, canvases: canvases.length, handlers, buttons, stubbed: sim.stubbed});
}

const width = Math.max(...rows.map((r) => r.page.length));
for (const r of rows) {
    console.log('  ' + r.page.padEnd(width) +
        '  캔버스 ' + String(r.canvases).padStart(2) +
        ' · 인라인 핸들러 ' + String(r.handlers).padStart(2) +
        ' · 눌러 본 버튼 ' + String(r.buttons).padStart(2) +
        (r.stubbed.length ? '   ← 가짜로 때운 것: ' + r.stubbed.join(', ') : ''));
}

const stubbedPages = rows.filter((r) => r.stubbed.length).length;
console.log(`  캔버스를 실제로 잰 페이지 ${rows.filter((r) => r.canvases).length}개, ` +
    `라이브러리를 가짜로 때운 페이지 ${stubbedPages}개(그 페이지의 통과는 「죽지 않는다」까지만 뜻한다)`);
console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
