// 웜퍼스 월드가 **논리로 알아낼 수 있는 것을 실제로 알아내는지** 본다.
//
// 이 페이지의 알맹이는 그림이 아니라 **추론**이다. 그런데 추론은 화면에 결과만 나오므로,
// 「죽었다」가 «어쩔 수 없어서»인지 «알 수 있었는데 못 알아내서»인지 눈으로는 갈리지 않는다.
// 그래서 여기서는 **정답을 페이지에 묻지 않고 따로 구한다** — 지각 기록만 가지고
// 모순되지 않는 세계를 전부 세어, 어느 칸이 «모든 세계에서» 안전한지 직접 계산한다.
// 페이지가 그 칸을 두고 위험한 칸을 밟아 죽으면 결함이다.
//
// 보는 것.
//   1. **뽑은 지도는 풀 수 있다.** 금까지 함정도 괴물도 밟지 않는 길이 있어야 한다.
//      없으면 학생이 배우는 것은 추론이 아니라 운이다.
//   2. **지각이 규칙과 맞는다.** 바람 ↔ 이웃의 함정, 냄새 ↔ 이웃의 괴물, 반짝임 ↔ 그 칸의 금.
//   3. **에이전트가 「안전」이라 적은 칸에는 실제로 아무것도 없다**(건전성).
//      추론이 틀린 것을 말하기 시작하면 나머지는 볼 것도 없다.
//   4. **「함정 확정」·「괴물 확정」도 실제와 맞는다.**
//   5. **안전한 칸이 남아 있는데 위험을 감수하지 않는다.**
//   6. **논리로 안전을 증명할 수 있는 칸이 있는데 죽지 않는다.** ← 이 검사의 값어치
//   7. **반드시 끝난다.** 같은 자리를 오가며 멈추지 않는 판이 없어야 한다.
//   8. **갈 곳이 없어 멈춘 것을 죽음으로 적지 않는다.**
//   9. **직접 걷는 탭**: 이웃 칸으로만 옮기고, 벽을 뚫지 않으며, 끝난 판에서는 조작이 잠기고,
//      남는 자국이 그 칸의 실제 지각과 같다.
//
// **못 보는 것.** 화면의 색·자리·크기는 여기서 볼 수 없다(jsdom 에는 레이아웃이 없다).
// 확정한 칸을 붉게 칠하는지 따위는 브라우저 몫이다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

/** 씨앗을 주면 같은 지도가 나오는 난수. **판을 재현할 수 있어야 결함을 좇을 수 있다.** */
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const sim = loadSim('ai/wumpus-world');
sim.lifecycle();
console.log(`웜퍼스 월드 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const W = sim.window;
const P = (expr) => sim.evalInPage(expr);
const 씨앗 = (n) => { W.Math.random = mulberry32(n); };
const 칸들 = (SIZE) => {
    const out = [];
    for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) out.push([x, y]);
    return out;
};
const 이웃 = (SIZE, x, y) => [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]
    .filter(([a, b]) => a >= 0 && b >= 0 && a < SIZE && b < SIZE);

/** 격자 크기를 고르개로 바꾼다. 페이지가 실제로 그렇게 바꾸는 길이다. */
function setSize(size) {
    sim.doc.getElementById('grid-size').value = String(size);
    P('changeSize()');
}

/** (0,0)에서 금까지 함정도 괴물도 밟지 않는 길이 있는가. **페이지에 묻지 않고 직접 잰다.** */
function 금까지갈수있나(SIZE, env) {
    const 막힘 = (x, y) => env.pits.has(`${x},${y}`) || (env.wumpus.x === x && env.wumpus.y === y);
    if (막힘(0, 0)) return false;
    const 본곳 = new Set(['0,0']);
    const 대기열 = [[0, 0]];
    while (대기열.length) {
        const [x, y] = 대기열.shift();
        if (x === env.gold.x && y === env.gold.y) return true;
        for (const [nx, ny] of 이웃(SIZE, x, y)) {
            const k = `${nx},${ny}`;
            if (본곳.has(k) || 막힘(nx, ny)) continue;
            본곳.add(k);
            대기열.push([nx, ny]);
        }
    }
    return false;
}

/* ================================================================
   1. 뽑은 지도는 풀 수 있다
   ================================================================ */
for (const size of [4, 5, 6, 7, 8]) {
    setSize(size);
    let 못푸는판 = 0;
    for (let s = 0; s < 120; s++) {
        씨앗(s * 131 + 7);
        P('initGame()');
        if (!금까지갈수있나(size, P('env'))) 못푸는판++;
    }
    if (못푸는판) bad(`${size}x${size}: 금까지 갈 수 없는 지도가 ${못푸는판}/120 판 나왔다`);
}

/* ================================================================
   2. 지각이 규칙과 맞는다
   ================================================================ */
setSize(4);
for (let s = 0; s < 40; s++) {
    씨앗(s * 977 + 5);
    P('initGame()');
    const env = P('env');
    for (const [x, y] of 칸들(4)) {
        const p = env.getPercepts(x, y);
        const 바람 = 이웃(4, x, y).some(([a, b]) => env.pits.has(`${a},${b}`));
        const 냄새 = 이웃(4, x, y).some(([a, b]) => env.wumpus.x === a && env.wumpus.y === b);
        const 반짝임 = env.gold.x === x && env.gold.y === y;
        if (!!p.breeze !== 바람) bad(`지각: (${x},${y}) 의 바람이 이웃 함정과 어긋난다`);
        if (!!p.stench !== 냄새) bad(`지각: (${x},${y}) 의 냄새가 이웃 괴물과 어긋난다`);
        if (!!p.glitter !== 반짝임) bad(`지각: (${x},${y}) 의 반짝임이 금 자리와 어긋난다`);
    }
}

/* ================================================================
   6. 논리로 증명할 수 있는 안전 칸 — **정답을 따로 구한다**

   지금까지 본 지각과 모순되지 않는 세계를 전부 세어, 어느 칸이 모든 세계에서 안전한지 본다.
   함정과 괴물은 서로 다른 지각(바람 · 냄새)에 걸리므로 **따로 세면 된다** — 함께 세면
   경우의 수가 곱해져 셀 수 없다.
   ================================================================ */
function 증명되는안전칸(SIZE, 밟은곳, 지각) {
    const 목록 = 칸들(SIZE);
    const 번호 = new Map(목록.map(([x, y], i) => [`${x},${y}`, i]));
    const 곁 = 목록.map(([x, y]) => 이웃(SIZE, x, y).map(([a, b]) => 번호.get(`${a},${b}`)));
    const 밟음 = 목록.map(([x, y]) => 밟은곳.has(`${x},${y}`));
    const 모르는칸 = 목록.map((_, i) => i).filter((i) => !밟음[i]);
    if (모르는칸.length > 18) return null;         // 셀 수 없이 넓으면 이 판은 건너뛴다

    const 함정일수있는칸 = new Set();
    for (let m = 0; m < (1 << 모르는칸.length); m++) {
        const 함정 = new Set();
        for (let b = 0; b < 모르는칸.length; b++) if (m & (1 << b)) 함정.add(모르는칸[b]);
        let 맞음 = true;
        for (const k of 밟은곳) {
            const i = 번호.get(k);
            if (곁[i].some((j) => 함정.has(j)) !== !!지각.get(k).breeze) { 맞음 = false; break; }
        }
        if (맞음) for (const 자리 of 함정) 함정일수있는칸.add(자리);
    }

    const 괴물일수있는칸 = new Set();
    for (const w of 모르는칸) {
        let 맞음 = true;
        for (const k of 밟은곳) {
            const i = 번호.get(k);
            if (곁[i].includes(w) !== !!지각.get(k).stench) { 맞음 = false; break; }
        }
        if (맞음) 괴물일수있는칸.add(w);
    }

    return 목록
        .map(([x, y], i) => ({k: `${x},${y}`, 안전: !함정일수있는칸.has(i) && !괴물일수있는칸.has(i)}))
        .filter((c) => c.안전 && !밟은곳.has(c.k));
}

/* ================================================================
   3 · 4 · 5 · 6 · 7 · 8 — 판을 끝까지 돌리며 함께 본다
   ================================================================ */
setSize(4);
let 이긴판 = 0, 죽은판 = 0, 멈춘판 = 0;
for (let s = 0; s < 120; s++) {
    씨앗(s * 7919 + 3);
    P('initGame()');
    const env = P('env');
    const 진짜함정 = (k) => env.pits.has(k);
    const 진짜괴물 = (k) => `${env.wumpus.x},${env.wumpus.y}` === k;

    let 회차 = 0;
    for (;;) {
        const ag = P('agent');
        if (ag.hasGold || ag.isDead || ag.stopped) break;
        if (++회차 > 2000) { bad(`씨앗 ${s}: 2000회차가 지나도 끝나지 않는다`); break; }

        // 3 · 4. 건전성 — 적어 둔 것이 실제와 어긋나면 그 자리에서 잡는다
        for (const k of ag.safe) {
            if (진짜함정(k) || 진짜괴물(k)) bad(`씨앗 ${s}: Safe(${k}) 라고 적었는데 실제로 위험한 칸이다`);
        }
        for (const k of ag.knownPit ?? []) {
            if (!진짜함정(k)) bad(`씨앗 ${s}: Pit(${k}) 로 확정했는데 함정이 아니다`);
        }
        if (ag.knownWumpus && !진짜괴물(ag.knownWumpus)) {
            bad(`씨앗 ${s}: Wumpus(${ag.knownWumpus}) 로 확정했는데 괴물이 없다`);
        }

        if (ag.state !== 'MOVE') { P('stepSimulation()'); continue; }

        // 5. 안전한 칸이 남아 있는데 위험을 감수하는가
        const 안전한칸이남음 = [...ag.safe].some((k) => !ag.visited.has(k));
        const 고른칸 = P('chooseBestTarget()');
        if (안전한칸이남음 && 고른칸 && !ag.safe.has(고른칸.k)) {
            bad(`씨앗 ${s}: 안전한 칸이 남았는데 (${고른칸.k}) 로 위험을 감수한다`);
        }

        const 밟은곳 = new Set(ag.visited);
        const 지각 = new Map([...밟은곳].map((k) => {
            const [x, y] = k.split(',').map(Number);
            return [k, env.getPercepts(x, y)];
        }));

        P('stepSimulation()');

        const 뒤 = P('agent');
        if (뒤.isDead) {
            // 6. 증명할 수 있는 안전 칸을 두고 죽었는가
            const 안전칸 = 증명되는안전칸(4, 밟은곳, 지각);
            if (안전칸 && 안전칸.length) {
                bad(`씨앗 ${s}: 논리로 안전을 증명할 수 있는 칸(${안전칸.map((c) => c.k).join(' ')})을 두고 죽었다`);
            }
        }
    }

    const 끝 = P('agent');
    if (끝.hasGold) 이긴판++;
    else if (끝.isDead) 죽은판++;
    else if (끝.stopped) 멈춘판++;
}
console.log(`  · 4x4 백스무 판: 금 ${이긴판} · 죽음 ${죽은판} · 갈 곳 없어 멈춤 ${멈춘판}`);

/* ================================================================
   9. 직접 걷는 탭
   ================================================================ */
씨앗(20260909);
P('initGame()');
P("setMode('play')");
{
    const env = P('env');

    // 벽을 뚫지 않는다 — (0,0) 에서 왼쪽·아래로는 나갈 수 없다
    P('movePlayer(-1, 0)');
    P('movePlayer(0, -1)');
    let pl = P('player');
    if (pl.x !== 0 || pl.y !== 0) bad('직접 걷기: 벽 밖으로 나갔다');
    if (pl.moves !== 0) bad('직접 걷기: 벽에 부딪힌 것을 이동 횟수로 셌다');

    // 자국이 그 칸의 실제 지각과 같은가
    P('movePlayer(1, 0)');
    pl = P('player');
    const 여기 = `${pl.x},${pl.y}`;
    const 적힌것 = pl.percepts.get(여기);
    const 실제 = env.getPercepts(pl.x, pl.y);
    for (const 무엇 of ['breeze', 'stench', 'glitter']) {
        if (!!적힌것?.[무엇] !== !!실제[무엇]) bad(`직접 걷기: (${여기}) 의 ${무엇} 자국이 실제 지각과 다르다`);
    }
    // 밟지 않은 칸의 자국은 남지 않는다 — 남으면 학생이 «가 보지 않은 칸»을 읽게 된다
    for (const k of pl.percepts.keys()) {
        if (!pl.visited.has(k)) bad(`직접 걷기: 밟지 않은 (${k}) 에 자국이 남았다`);
    }

    // 금이 없는 칸에서 「금 획득」을 눌러도 금을 쥐지 않는다
    if (!실제.glitter) {
        P('grabGold()');
        if (P('player').hasGold) bad('직접 걷기: 금이 없는 칸에서 금을 쥐었다');
    }

    // 끝난 판에서는 조작이 잠긴다
    P('player.isDead = true');
    P('renderGrid()');
    if (!sim.doc.getElementById('btn-grab').disabled) bad('직접 걷기: 죽은 뒤에도 「금 획득」이 눌린다');
    P('movePlayer(1, 0)');
    if (P('player').moves !== 1) bad('직접 걷기: 죽은 뒤에도 움직인다');
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('wumpus', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
