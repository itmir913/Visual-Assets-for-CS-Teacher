// 그리드월드 Q러닝 시뮬레이터가 **실제로 최단 경로를 배우는지** 본다.
//
// 강화학습 화면은 **틀려도 배우는 것처럼 보인다** — 값이 커지고 화살표가 생기면 학생도
// 교사도 「학습이 되는구나」로 읽는다. 그래서 여기서는 배운 결과를 **너비 우선 탐색으로
// 따로 구한 최단 거리**와 맞대어 본다. 칸마다 −0.1, 목표에서 +10 이라면 최적 정책은
// 곧 최단 경로이므로, **다 배운 뒤 화살표를 따라가면 최단 걸음 수로 목표에 닿아야 한다.**
//
// 보는 것.
//   1. **뽑은 미로에 반드시 길이 있고, 벽이 출발·목표를 덮지 않는가.**
//   2. **한 걸음의 이동과 보상이 규칙과 같은가** — 벽과 가장자리는 제자리, 걸음마다 −0.1,
//      목표에서 +10 이고 그때 끝난다.
//   3. **Q 갱신이 공식과 같은가** — Q ← Q + α(r + γ·maxQ′ − Q), 끝난 뒤에는 maxQ′ 를 0 으로.
//   4. **다 배운 뒤 탐욕 정책이 최단 경로인가.** ← 이 검사의 값어치
//   5. **화면의 화살표가 그 정책과 같은가.** 동점이어도 화면은 흔들리지 않아야 한다.
//   6. **되돌린 뒤 Q 표가 비는가.**
//
// **못 보는 것.** 칸의 색과 크기, 애니메이션은 볼 수 없다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/reinforcement-gridworld');
sim.lifecycle();
console.log(`그리드월드 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const 씨앗 = (n) => { sim.window.Math.random = mulberry32(n); };

/** 판을 새로 뽑는다. 화면의 「초기화」가 하는 그 길이다. */
function 새판(크기, 씨) {
    씨앗(씨);
    doc.getElementById('gridSizeSelect').value = String(크기);
    doc.getElementById('btnReset').dispatchEvent(new sim.window.MouseEvent('click', {bubbles: true}));
}

const 움직임 = [[0, -1], [1, 0], [0, 1], [-1, 0]];   // 위 · 오른쪽 · 아래 · 왼쪽

/** 목표까지의 최단 걸음 수. **페이지에 묻지 않고 여기서 구한다.** */
function 최단거리표(env) {
    const 거리 = Array.from({length: env.rows}, () => Array(env.cols).fill(Infinity));
    거리[env.goal.y][env.goal.x] = 0;
    const 대기열 = [[env.goal.x, env.goal.y]];
    const 벽 = new Set(env.walls.map((w) => `${w.x},${w.y}`));
    while (대기열.length) {
        const [x, y] = 대기열.shift();
        for (const [dx, dy] of 움직임) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= env.cols || ny >= env.rows) continue;
            if (벽.has(`${nx},${ny}`) || 거리[ny][nx] < Infinity) continue;
            거리[ny][nx] = 거리[y][x] + 1;
            대기열.push([nx, ny]);
        }
    }
    return 거리;
}

/* ================================================================
   1. 뽑은 미로
   ================================================================ */
for (const 크기 of [4, 6, 8]) {
    for (let s = 0; s < 15; s++) {
        새판(크기, s * 97 + 11);
        const env = P('gridWorldController.env');
        const 거리 = 최단거리표(env);
        if (!Number.isFinite(거리[env.start.y][env.start.x])) {
            bad(`${크기}×${크기}(씨앗 ${s}): 출발에서 목표까지 갈 길이 없는 미로를 뽑았다`);
        }
        for (const w of env.walls) {
            if (w.x === env.start.x && w.y === env.start.y) bad(`${크기}×${크기}: 출발 칸에 벽을 놓았다`);
            if (w.x === env.goal.x && w.y === env.goal.y) bad(`${크기}×${크기}: 목표 칸에 벽을 놓았다`);
        }
    }
}

/* ================================================================
   2. 한 걸음의 이동과 보상
   ================================================================ */
새판(4, 20260909);
{
    const env = P('gridWorldController.env');
    const 벽 = new Set(env.walls.map((w) => `${w.x},${w.y}`));
    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            if (벽.has(`${x},${y}`)) continue;
            for (const [i, [dx, dy]] of 움직임.entries()) {
                P(`gridWorldController.env.agentPos = {x: ${x}, y: ${y}}`);
                const 답 = P(`gridWorldController.env.step(${i})`);
                let ex = x + dx, ey = y + dy;
                if (ex < 0 || ey < 0 || ex >= env.cols || ey >= env.rows || 벽.has(`${ex},${ey}`)) {
                    ex = x;
                    ey = y;
                }
                const 목표에닿음 = ex === env.goal.x && ey === env.goal.y;
                if (답.nx !== ex || 답.ny !== ey) {
                    bad(`이동: (${x},${y}) 에서 ${['위', '오른쪽', '아래', '왼쪽'][i]} 로 (${답.nx},${답.ny}) — 규칙대로면 (${ex},${ey}) 다`);
                }
                if (Math.abs(답.reward - (목표에닿음 ? 10 : -0.1)) > 1e-12) {
                    bad(`보상: (${ex},${ey}) 에서 ${답.reward} — 규칙대로면 ${목표에닿음 ? 10 : -0.1} 이다`);
                }
                if (!!답.done !== 목표에닿음) bad(`끝남: (${ex},${ey}) 에서 done=${답.done} 이다`);
            }
        }
    }
}

/* ================================================================
   3. Q 갱신
   ================================================================ */
{
    const 판 = [
        {x: 1, y: 1, a: 2, r: -0.1, nx: 1, ny: 2, done: false, alpha: 0.3, gamma: 0.9},
        {x: 0, y: 2, a: 1, r: 10, nx: 3, ny: 3, done: true, alpha: 0.5, gamma: 0.8},
        {x: 2, y: 0, a: 3, r: -0.1, nx: 1, ny: 0, done: false, alpha: 0.1, gamma: 1.0},
    ];
    for (const t of 판) {
        // 다음 칸의 값을 정해 두어야 기대값을 손으로 계산할 수 있다
        P(`gridWorldController.agent.qTable[${t.ny}][${t.nx}] = [1, 2, 3, 4]`);
        P(`gridWorldController.agent.qTable[${t.y}][${t.x}][${t.a}] = 0.5`);
        P(`gridWorldController.agent.learn(${t.x}, ${t.y}, ${t.a}, ${t.r}, ${t.nx}, ${t.ny}, ${t.done}, ${t.alpha}, ${t.gamma})`);
        const 다음최대 = t.done ? 0 : 4;
        const 기대 = 0.5 + t.alpha * (t.r + t.gamma * 다음최대 - 0.5);
        const 실제 = P(`gridWorldController.agent.qTable[${t.y}][${t.x}][${t.a}]`);
        if (Math.abs(실제 - 기대) > 1e-12) bad(`Q 갱신: ${실제} — 공식대로면 ${기대} 다`);
    }
}

/* ================================================================
   4. 다 배운 뒤 탐욕 정책이 최단 경로인가
   ================================================================ */
for (const [크기, 씨] of [[4, 4242], [5, 777], [6, 31337]]) {
    새판(크기, 씨);
    const env = P('gridWorldController.env');
    const 거리 = 최단거리표(env);

    const ε = 0.3, α = 0.5, γ = 0.95;
    doc.getElementById('epsilonSlider').value = String(ε);
    doc.getElementById('alphaSlider').value = String(α);
    doc.getElementById('gammaSlider').value = String(γ);

    /* **화면의 「한 걸음」으로 먼저 몇 걸음 걸어 본다** — 슬라이더를 읽어 학습까지 잇는 그 길이
       실제로 도는지 보려는 것이다. */
    for (let 회 = 0; 회 < 60; 회++) P('gridWorldController.step()');

    /* 나머지는 **그리지 않고** 배운다. `step()` 은 걸음마다 판 전체를 다시 그려서,
       4만 걸음을 화면째로 걸으면 이 검사 하나가 1분을 먹는다. 여기서 부르는 것은 페이지의
       같은 코드(`env.step`·`agent.chooseAction`·`agent.learn`)이고 빠진 것은 그리기뿐이다. */
    P(`(function () {
        const c = gridWorldController;
        const ε = ${ε}, α = ${α}, γ = ${γ};
        for (let i = 0; i < 400000 && c.env.totalEpisodes < 400; i++) {
            const x = c.env.agentPos.x, y = c.env.agentPos.y;
            const a = c.agent.chooseAction(x, y, ε);
            const r = c.env.step(a);
            c.agent.learn(x, y, a, r.reward, r.nx, r.ny, r.done, α, γ);
            if (r.done) c.env.reset();
        }
    })()`);
    const 배운회차 = P('gridWorldController.env.totalEpisodes');
    if (배운회차 < 50) { bad(`${크기}×${크기}: 4만 걸음을 걸었는데 회차가 ${배운회차}회뿐이다`); continue; }

    // **탐욕 정책을 따라가 본다.** 벽에 부딪히거나 돌면 최단이 아니다
    const q = P('gridWorldController.agent.qTable');
    let x = env.start.x, y = env.start.y, 걸음 = 0;
    const 지나온곳 = new Set();
    while (!(x === env.goal.x && y === env.goal.y) && 걸음 <= 크기 * 크기 * 2) {
        if (지나온곳.has(`${x},${y}`)) break;
        지나온곳.add(`${x},${y}`);
        const qs = q[y][x];
        const 가장큼 = Math.max(...qs);
        const a = qs.indexOf(가장큼);
        const [dx, dy] = 움직임[a];
        let nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= env.cols || ny >= env.rows
            || env.walls.some((w) => w.x === nx && w.y === ny)) { nx = x; ny = y; }
        if (nx === x && ny === y) break;
        x = nx;
        y = ny;
        걸음++;
    }
    const 최단 = 거리[env.start.y][env.start.x];
    if (!(x === env.goal.x && y === env.goal.y)) {
        bad(`${크기}×${크기}: ${배운회차}회를 배우고도 화살표를 따라가면 목표에 닿지 못한다`);
    } else if (걸음 !== 최단) {
        bad(`${크기}×${크기}: 화살표를 따라가면 ${걸음}걸음 — 최단은 ${최단}걸음이다`);
    }

    // Q 값이 보상 규모를 넘지 않는가 (γ<1 이므로 목표 보상 10 이 천장이다)
    let 가장큰Q = -Infinity;
    for (const 줄 of q) for (const 칸 of 줄) 가장큰Q = Math.max(가장큰Q, ...칸);
    if (가장큰Q > 10 + 1e-9) bad(`${크기}×${크기}: Q 값이 ${가장큰Q.toFixed(3)} 까지 올랐다 — 목표 보상 10 을 넘을 수 없다`);
}

/* ================================================================
   5. 화면의 화살표가 정책과 같은가
   ================================================================ */
{
    const env = P('gridWorldController.env');
    const q = P('gridWorldController.agent.qTable');
    P('gridWorldController.updateGridVisuals()');
    let 본칸 = 0;
    for (let y = 0; y < env.rows; y++) {
        for (let x = 0; x < env.cols; x++) {
            if (env.walls.some((w) => w.x === x && w.y === y)) continue;
            if (x === env.goal.x && y === env.goal.y) continue;
            const 칸 = doc.getElementById(`cell-${x}-${y}`);
            if (!칸) { bad(`화살표: (${x},${y}) 칸이 화면에 없다`); continue; }
            const 보이는것 = [...칸.querySelectorAll('.policy-arrow')]
                .filter((a) => !a.classList.contains('hidden'))
                .map((a) => Number(a.dataset.dir));
            const qs = q[y][x];
            const 배운적있음 = qs.some((v) => v !== 0);
            if (!배운적있음) {
                if (보이는것.length) bad(`화살표: (${x},${y}) 는 배운 적이 없는데 화살표를 그렸다`);
                continue;
            }
            본칸++;
            if (보이는것.length !== 1) {
                bad(`화살표: (${x},${y}) 에 화살표를 ${보이는것.length}개 그렸다 — 하나여야 한다`);
                continue;
            }
            const 가장큼 = Math.max(...qs);
            if (Math.abs(qs[보이는것[0]] - 가장큼) > 1e-12) {
                bad(`화살표: (${x},${y}) 가 ${['위', '오른쪽', '아래', '왼쪽'][보이는것[0]]} 을 가리키는데 그 쪽 Q 는 ${qs[보이는것[0]].toFixed(3)} 이고 가장 큰 것은 ${가장큼.toFixed(3)} 이다`);
            }
            // 화면의 값도 그 칸의 가장 큰 Q 여야 한다
            const 적힌값 = Number(칸.querySelector('.v-text').textContent);
            if (Math.abs(적힌값 - 가장큼) > 0.05) {
                bad(`칸의 값: (${x},${y}) 에 ${적힌값} 을 적었다 — 가장 큰 Q 는 ${가장큼.toFixed(1)} 이다`);
            }
        }
    }
    if (!본칸) bad('화살표: 배운 뒤인데 화살표가 그려진 칸이 하나도 없다');

    // 여러 번 다시 그려도 같은 화살표여야 한다 — 동점을 무작위로 깨면 화면이 흔들린다
    const 보임 = () => [...doc.querySelectorAll('.policy-arrow')].map((a) => a.classList.contains('hidden') ? '.' : a.dataset.dir).join('');
    const 첫번째 = 보임();
    for (let i = 0; i < 5; i++) P('gridWorldController.updateGridVisuals()');
    if (첫번째 !== 보임()) bad('화살표: 같은 Q 표인데 다시 그릴 때마다 화살표가 바뀐다');
}

/* ================================================================
   6. 되돌리기
   ================================================================ */
{
    새판(4, 555);
    const q = P('gridWorldController.agent.qTable');
    const 다0 = q.every((줄) => 줄.every((칸) => 칸.every((v) => v === 0)));
    if (!다0) bad('되돌리기: 새 판인데 Q 표가 비어 있지 않다');
    if (P('gridWorldController.history').length) bad('되돌리기: 새 판인데 지난 회차 기록이 남았다');
    if (P('gridWorldController.env.totalEpisodes') !== 0) bad('되돌리기: 새 판인데 회차가 0이 아니다');
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('gridworld', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
