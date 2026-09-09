// 하노이의 탑 시뮬레이터가 **규칙을 지키고 상태 공간을 제대로 그리는지** 본다.
//
// 이 페이지는 셋을 함께 보인다 — 손으로 옮기기 · 재귀 해법의 자동 풀이 · n=3 상태 공간
// 그래프. 앞의 둘은 규칙이 분명해서 **답을 따로 구해 맞대면** 되고, 그래프는 눈으로 보면
// 그럴듯하지만 **자리를 한 번만 잘못 맞바꿔도 이웃한 상태가 화면 반대편에 앉는다.**
// 그래서 그래프는 이어짐만 보지 않고 **그린 자리까지 기하로 따진다** — 선이 서로 넘나들면
// 시에르핀스키 삼각형이 아니라 실뭉치가 되고, 학생은 「가까운 상태」를 자리로 읽을 수 없다.
//
// 보는 것.
//   1. **재귀 해법이 최소 횟수(2ⁿ-1)이고, 그대로 옮기면 실제로 다 옮겨진다.**
//   2. **옮길 수 있는지 판정이 규칙과 같다** — 빈 기둥에서 집지 않고, 큰 원판을 작은 원판 위에 얹지 않는다.
//   3. **손으로 옮기기**: 규칙에 어긋나는 이동은 판을 바꾸지 않고 횟수도 세지 않는다.
//      다 옮기면 성공이 뜨고, 최소 횟수를 제대로 적는다.
//   4. **자동 풀이**: 한 걸음씩 눌러 간 판이 회차마다 해법과 같고, 마지막에 다 옮겨져 있다.
//   5. **상태 공간 그래프(n=3)**: 상태 27개와 간선이 규칙대로이고, 최적 경로만 굵게 칠하며,
//      **자리가 겹치지 않고 선이 서로 넘나들지 않는다.**
//
// **못 보는 것.** 실제 픽셀 크기와 색은 여기서 볼 수 없다. 원판이 기둥 안에 들어가는지도
// 레이아웃이 없어 따질 수 없다 — 그것은 브라우저 몫이다.

import {loadSim, SIM_ROOT} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/search-tower-of-hanoi');
sim.lifecycle();
console.log(`하노이의 탑 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/* ================================================================
   1 · 2. 재귀 해법과 이동 판정
   ================================================================ */
/** 규칙대로라면 나와야 할 이동 차례. **페이지와 따로 돌린다.** */
function 규칙대로의이동(n, 출발 = 0, 곁 = 1, 목표 = 2, 모음 = []) {
    if (n === 0) return 모음;
    규칙대로의이동(n - 1, 출발, 목표, 곁, 모음);
    모음.push([출발, 목표]);
    규칙대로의이동(n - 1, 곁, 출발, 목표, 모음);
    return 모음;
}

for (const n of [3, 4, 5, 6]) {
    const 해법 = P(`getHanoiSolution(${n})`);
    const 기대 = 규칙대로의이동(n);
    if (해법.length !== (1 << n) - 1) bad(`${n}장: 해법이 ${해법.length}수 — 최소는 ${(1 << n) - 1}수`);
    if (JSON.stringify(해법) !== JSON.stringify(기대)) bad(`${n}장: 해법의 이동 차례가 재귀 규칙과 다르다`);

    // 그대로 옮겨 보면 실제로 다 옮겨지는가
    const 기둥 = [[], [], []];
    for (let i = n; i >= 1; i--) 기둥[0].push(i);
    for (const [from, to] of 해법) {
        if (!기둥[from].length) { bad(`${n}장: 빈 기둥에서 집는 이동이 있다`); break; }
        const 원판 = 기둥[from].at(-1);
        if (기둥[to].length && 기둥[to].at(-1) < 원판) { bad(`${n}장: 작은 원판 위에 큰 원판을 얹는 이동이 있다`); break; }
        기둥[to].push(기둥[from].pop());
    }
    if (기둥[2].length !== n) bad(`${n}장: 해법대로 옮겨도 목표 기둥에 다 모이지 않는다`);
}

// 이동 판정 — 여러 판을 손으로 만들어 규칙과 맞대어 본다
const 판모음 = [
    [[3, 2, 1], [], []],
    [[3], [2], [1]],
    [[], [], [3, 2, 1]],
    [[3, 1], [2], []],
];
for (const 판 of 판모음) {
    for (let from = 0; from < 3; from++) {
        for (let to = 0; to < 3; to++) {
            if (from === to) continue;
            const 답 = P(`canMove(${JSON.stringify(판)}, ${from}, ${to})`).ok;
            const 기대 = 판[from].length > 0
                && (판[to].length === 0 || 판[to].at(-1) > 판[from].at(-1));
            if (답 !== 기대) bad(`이동 판정: ${JSON.stringify(판)} 에서 ${from}→${to} 판정이 어긋난다`);
        }
    }
}

/* ================================================================
   3. 손으로 옮기기 — **화면을 눌러서 본다**
   ================================================================ */
const 기둥누르기 = (i) => {
    const col = doc.querySelector(`#manualScene .peg-col[data-peg="${i}"]`);
    if (!col) { bad(`손으로 옮기기: ${i}번 기둥이 화면에 없다`); return; }
    col.dispatchEvent(new sim.window.Event('pointerdown', {bubbles: true}));
};

P('setDiskCount(3)');
if (doc.getElementById('manualMinMoves').textContent !== '7') {
    bad(`손으로 옮기기: 3장일 때 최소 횟수를 ${doc.getElementById('manualMinMoves').textContent} 로 적었다`);
}

// 규칙에 어긋나는 이동 — C 로 1을 옮긴 뒤 A(2 위)에서 다시 C 로 옮기려 하면 안 된다
기둥누르기(0);
기둥누르기(2);                                  // 1 을 A → C
기둥누르기(0);
기둥누르기(2);                                  // 2 를 C 위에 얹으려 한다 — 막혀야 한다
if (doc.getElementById('manualMoves').textContent !== '1') {
    bad(`손으로 옮기기: 규칙에 어긋나는 이동을 세었다 (${doc.getElementById('manualMoves').textContent}회)`);
}
if (P('manualPegs')[2].length !== 1) bad('손으로 옮기기: 규칙에 어긋나는 이동이 판을 바꿨다');

// 빈 기둥을 먼저 누르면 아무 일도 없어야 한다
P('resetManual()');
기둥누르기(1);
if (P('manualSelected') !== -1) bad('손으로 옮기기: 빈 기둥을 골랐다');

// 해법대로 다 옮기면 성공이 뜬다
P('resetManual()');
for (const [from, to] of 규칙대로의이동(3)) {
    기둥누르기(from);
    기둥누르기(to);
}
if (doc.getElementById('manualSuccess').classList.contains('hidden')) {
    bad('손으로 옮기기: 다 옮겼는데 성공이 뜨지 않는다');
}
if (doc.getElementById('manualMoves').textContent !== '7') {
    bad(`손으로 옮기기: 7수로 끝냈는데 ${doc.getElementById('manualMoves').textContent} 회로 적혔다`);
}
if (!doc.getElementById('manualSuccessDetail').textContent.includes('최적')) {
    bad('손으로 옮기기: 최소 횟수로 끝냈는데 그렇게 알려 주지 않는다');
}

/* ================================================================
   4. 자동 풀이 — 한 걸음씩
   ================================================================ */
for (const n of [3, 4]) {
    P(`setAiDiskCount(${n})`);
    const 해법 = 규칙대로의이동(n);
    if (doc.getElementById('aiMaxSteps').textContent !== String(해법.length)) {
        bad(`자동 풀이 ${n}장: 전체 회차를 ${doc.getElementById('aiMaxSteps').textContent} 로 적었다`);
    }
    const 기둥 = [[], [], []];
    for (let i = n; i >= 1; i--) 기둥[0].push(i);
    for (let i = 0; i < 해법.length; i++) {
        P('doAiStep()');
        const [from, to] = 해법[i];
        기둥[to].push(기둥[from].pop());
        if (JSON.stringify(P('aiPegs')) !== JSON.stringify(기둥)) {
            bad(`자동 풀이 ${n}장: ${i + 1}회차의 판이 해법과 다르다`);
            break;
        }
        if (doc.getElementById('aiStepNum').textContent !== String(i + 1)) {
            bad(`자동 풀이 ${n}장: ${i + 1}회차인데 회차 수를 ${doc.getElementById('aiStepNum').textContent} 로 적었다`);
            break;
        }
    }
    // 다 옮긴 뒤 더 눌러도 판이 흐트러지지 않는다
    const 끝난판 = JSON.stringify(P('aiPegs'));
    P('doAiStep()');
    if (JSON.stringify(P('aiPegs')) !== 끝난판) bad(`자동 풀이 ${n}장: 다 옮긴 뒤에도 판이 움직인다`);
}

/* ================================================================
   5. 상태 공간 그래프 — 이어짐과 **그린 자리**까지
   ================================================================ */
P('setDiskCount(3)');
P('buildGraphPanel()');
const svg = doc.querySelector('#graphPanel svg');
if (!svg) {
    bad('상태 공간: 그래프를 그리지 않았다');
} else {
    const 동그라미 = [...svg.querySelectorAll('circle')];
    const 글자 = [...svg.querySelectorAll('text')].filter((t) => /^[ABC]{3}$/.test(t.textContent));
    if (동그라미.length !== 27) bad(`상태 공간: 상태를 ${동그라미.length}개 그렸다 — 3장이면 27개다`);
    if (글자.length !== 27) bad(`상태 공간: 이름을 붙인 상태가 ${글자.length}개다`);

    // 이름 ↔ 자리. 이름이 겹치면 어느 상태를 그린 것인지 알 수 없다
    const 자리 = new Map();
    for (const t of 글자) {
        const 이름 = t.textContent;
        if (자리.has(이름)) bad(`상태 공간: ${이름} 이 두 번 그려졌다`);
        자리.set(이름, {x: Number(t.getAttribute('x')), y: Number(t.getAttribute('y')) - 5});
    }

    // 규칙대로의 간선 — **페이지에 묻지 않고 여기서 만든다**
    const 상태들 = [];
    for (let a = 0; a <= 2; a++) for (let b = 0; b <= 2; b++) for (let c = 0; c <= 2; c++) 상태들.push([a, b, c]);
    const 이름붙이기 = (s) => s.map((c) => 'ABC'[c]).join('');
    const 기대간선 = new Set();
    for (const s of 상태들) {
        for (let d = 0; d < 3; d++) {
            for (let to = 0; to <= 2; to++) {
                if (to === s[d]) continue;
                let 옮길수있음 = true;
                for (let 작은 = 0; 작은 < d; 작은++) {
                    if (s[작은] === s[d] || s[작은] === to) { 옮길수있음 = false; break; }
                }
                if (!옮길수있음) continue;
                const ns = [...s];
                ns[d] = to;
                기대간선.add([이름붙이기(s), 이름붙이기(ns)].sort().join('-'));
            }
        }
    }

    // 그린 선을 자리로 되짚어 어느 상태끼리 이었는지 알아낸다
    const 같은자리 = (x, y) => [...자리.entries()]
        .find(([, p]) => Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5)?.[0];
    const 그린간선 = new Set();
    const 선들 = [...svg.querySelectorAll('line')];
    for (const l of 선들) {
        const a = 같은자리(Number(l.getAttribute('x1')), Number(l.getAttribute('y1')));
        const b = 같은자리(Number(l.getAttribute('x2')), Number(l.getAttribute('y2')));
        if (!a || !b) { bad('상태 공간: 어느 상태에도 닿지 않는 선이 있다'); continue; }
        그린간선.add([a, b].sort().join('-'));
    }
    if (그린간선.size !== 선들.length) bad(`상태 공간: 같은 간선을 두 번 그렸다 (선 ${선들.length}개, 간선 ${그린간선.size}개)`);
    for (const e of 기대간선) if (!그린간선.has(e)) bad(`상태 공간: 간선 ${e} 가 빠졌다`);
    for (const e of 그린간선) if (!기대간선.has(e)) bad(`상태 공간: 규칙에 없는 간선 ${e} 를 그렸다`);

    // 최적 경로만 굵게 — 7수 해법이 지나는 여덟 상태를 여기서 따로 구한다
    const 최적경로상태 = ['AAA'];
    {
        const 기둥 = [[3, 2, 1], [], []];
        for (const [from, to] of 규칙대로의이동(3)) {
            기둥[to].push(기둥[from].pop());
            const 어디 = [0, 0, 0];
            기둥.forEach((스택, pi) => 스택.forEach((원판) => { 어디[원판 - 1] = pi; }));
            최적경로상태.push(이름붙이기(어디));
        }
    }
    const 굵은선 = 선들.filter((l) => l.getAttribute('stroke') === '#f59e0b');
    const 기대굵은선 = new Set();
    for (let i = 0; i + 1 < 최적경로상태.length; i++) {
        기대굵은선.add([최적경로상태[i], 최적경로상태[i + 1]].sort().join('-'));
    }
    const 그린굵은선 = new Set(굵은선.map((l) => [
        같은자리(Number(l.getAttribute('x1')), Number(l.getAttribute('y1'))),
        같은자리(Number(l.getAttribute('x2')), Number(l.getAttribute('y2'))),
    ].sort().join('-')));
    for (const e of 기대굵은선) if (!그린굵은선.has(e)) bad(`상태 공간: 최적 경로의 ${e} 가 굵게 칠해지지 않았다`);
    for (const e of 그린굵은선) if (!기대굵은선.has(e)) bad(`상태 공간: 최적 경로가 아닌 ${e} 가 굵게 칠해졌다`);

    // **자리가 겹치지 않는가.** 반지름 10짜리 동그라미 둘이 20 안쪽으로 붙으면 포개진다
    const 자리목록 = [...자리.entries()];
    let 가장가까운 = Infinity;
    for (let i = 0; i < 자리목록.length; i++) {
        for (let j = i + 1; j < 자리목록.length; j++) {
            const d = Math.hypot(자리목록[i][1].x - 자리목록[j][1].x, 자리목록[i][1].y - 자리목록[j][1].y);
            if (d < 가장가까운) 가장가까운 = d;
            if (d < 20) bad(`상태 공간: ${자리목록[i][0]} 과 ${자리목록[j][0]} 이 ${d.toFixed(1)} 만큼 붙어 포개진다`);
        }
    }

    // **선이 서로 넘나들지 않는가.** 하노이 상태 그래프는 평면 그래프라 제대로 앉히면 넘나들 일이 없다
    const 끝점공유 = (a, b) => a.some((p) => b.some((q) => Math.abs(p[0] - q[0]) < 0.5 && Math.abs(p[1] - q[1]) < 0.5));
    const 방향 = (o, a, b) => Math.sign((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]));
    const 넘나듦 = (s1, s2) => {
        const d1 = 방향(s1[0], s1[1], s2[0]), d2 = 방향(s1[0], s1[1], s2[1]);
        const d3 = 방향(s2[0], s2[1], s1[0]), d4 = 방향(s2[0], s2[1], s1[1]);
        return d1 !== d2 && d3 !== d4 && d1 !== 0 && d2 !== 0 && d3 !== 0 && d4 !== 0;
    };
    const 선분 = 선들.map((l) => [
        [Number(l.getAttribute('x1')), Number(l.getAttribute('y1'))],
        [Number(l.getAttribute('x2')), Number(l.getAttribute('y2'))],
    ]);
    let 넘나든쌍 = 0;
    for (let i = 0; i < 선분.length; i++) {
        for (let j = i + 1; j < 선분.length; j++) {
            if (끝점공유(선분[i], 선분[j])) continue;
            if (넘나듦(선분[i], 선분[j])) 넘나든쌍++;
        }
    }
    if (넘나든쌍) bad(`상태 공간: 선이 서로 넘나드는 자리가 ${넘나든쌍}군데다 — 자리를 잘못 앉혔다`);

    // 뷰박스 밖으로 나간 상태가 없는가
    const [, , vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    for (const [이름, p] of 자리목록) {
        if (p.x < 14 || p.y < 14 || p.x > vw - 14 || p.y > vh - 14) {
            bad(`상태 공간: ${이름} 이 그림 밖(${p.x.toFixed(0)},${p.y.toFixed(0)})에 앉았다`);
        }
    }
    console.log(`  · 상태 27개 · 간선 ${그린간선.size}개 · 가장 가까운 두 상태 ${가장가까운.toFixed(1)}`);
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
