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
import fs from 'node:fs';
import path from 'node:path';

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

/* ================================================================
   10. 지도 뽑기의 규칙 — 출발 칸은 비고, 금과 괴물은 겹치지 않고, 함정은 둘 위에 없다.
       큰 격자에서도 지각이 규칙대로인가
   ================================================================ */
for (const size of [4, 5, 8]) {
    setSize(size);
    for (let s = 0; s < (size === 4 ? 80 : 25); s++) {
        씨앗(s * 4099 + size);
        P('initGame()');
        const env = P('env');
        const 뜻 = `${size}x${size}(씨앗 ${s})`;
        if (env.gold.x === 0 && env.gold.y === 0) bad(`지도 ${뜻}: 금을 출발 칸에 놓았다`);
        if (env.wumpus.x === 0 && env.wumpus.y === 0) bad(`지도 ${뜻}: 괴물을 출발 칸에 놓았다`);
        if (env.pits.has('0,0')) bad(`지도 ${뜻}: 출발 칸에 함정을 놓았다`);
        if (env.gold.x === env.wumpus.x && env.gold.y === env.wumpus.y) bad(`지도 ${뜻}: 금과 괴물이 한 칸에 있다`);
        if (env.pits.has(`${env.gold.x},${env.gold.y}`) || env.pits.has(`${env.wumpus.x},${env.wumpus.y}`)) bad(`지도 ${뜻}: 금이나 괴물 칸에 함정을 겹쳐 놓았다`);
        for (const [x, y] of 칸들(size)) {
            const p = env.getPercepts(x, y);
            const 바람 = 이웃(size, x, y).some(([a, b]) => env.pits.has(`${a},${b}`));
            const 냄새 = 이웃(size, x, y).some(([a, b]) => env.wumpus.x === a && env.wumpus.y === b);
            if (!!p.breeze !== 바람 || !!p.stench !== 냄새 || !!p.glitter !== (env.gold.x === x && env.gold.y === y)) {
                bad(`지각 ${뜻}: (${x},${y}) 의 지각이 규칙과 어긋난다`);
                break;
            }
        }
    }
}

/* ================================================================
   11. AI 의 걸음 — 이웃 칸으로만 옮기고, 새 칸은 고른 목표뿐이며, 끝의 판정이 실제와 같다
   ================================================================ */
setSize(4);
for (let s = 0; s < 60; s++) {
    씨앗(s * 6007 + 11);
    P('initGame()');
    P("setMode('ai')");
    const env = P('env');
    let 회차 = 0;
    for (; 회차 < 2000; 회차++) {
        // `P('agent')` 는 살아 있는 객체라 걸음 뒤에 바뀐다 — 앞 상태는 떠 둔다
        const 앞 = P('({x: agent.x, y: agent.y, state: agent.state, visited: new Set(agent.visited), safe: new Set(agent.safe), hasGold: agent.hasGold, isDead: agent.isDead, stopped: agent.stopped})');
        if (앞.hasGold || 앞.isDead || 앞.stopped) break;
        const 목표 = 앞.state === 'MOVE' ? P('chooseBestTarget()') : null;
        P('stepSimulation()');
        const 뒤 = P('agent');
        if (앞.state !== 'MOVE') continue;
        const 옮김 = Math.abs(뒤.x - 앞.x) + Math.abs(뒤.y - 앞.y);
        if (목표 && 옮김 !== 1) { bad(`AI 걸음(씨앗 ${s}): (${앞.x},${앞.y}) 에서 (${뒤.x},${뒤.y}) 로 ${옮김}칸을 옮겼다 — 한 걸음은 이웃 칸이다`); break; }
        const 새칸 = `${뒤.x},${뒤.y}`;
        if (!앞.visited.has(새칸) && 목표 && !(앞.safe.has(새칸) || !앞.safe.has(목표.k))) {
            bad(`AI 걸음(씨앗 ${s}): 목표는 안전한 칸인데 가 보지 않은 위험한 칸 (${새칸}) 을 지나갔다`);
        }
        const 함정 = env.pits.has(새칸), 괴물 = env.wumpus.x === 뒤.x && env.wumpus.y === 뒤.y;
        if (뒤.isDead !== (함정 || 괴물)) bad(`AI 걸음(씨앗 ${s}): (${새칸}) 에 함정 ${함정} · 괴물 ${괴물} 인데 사망을 ${뒤.isDead} 로 적었다`);
    }
    const 끝 = P('agent');
    if (끝.hasGold && !(env.gold.x === 끝.x && env.gold.y === 끝.y)) bad(`AI(씨앗 ${s}): 금이 없는 (${끝.x},${끝.y}) 에서 금을 주웠다`);
    if (끝.stopped) {
        // 멈췄다면 정말 갈 곳이 없어야 한다 — 가 보지 않은 이웃 칸이 모두 확정된 위험이다
        const 경계 = 칸들(4).map(([x, y]) => `${x},${y}`).filter((k) => !끝.visited.has(k)
            && 이웃(4, ...k.split(',').map(Number)).some(([a, b]) => 끝.visited.has(`${a},${b}`)));
        const 남은곳 = 경계.filter((k) => !끝.knownPit.has(k) && 끝.knownWumpus !== k);
        if (남은곳.length) bad(`AI(씨앗 ${s}): 갈 곳이 없다고 멈췄는데 확정되지 않은 칸(${남은곳.join(' ')})이 남았다`);
    }
}

/* ================================================================
   12. 직접 걷기의 끝 — 함정 · 괴물 칸에서 죽고 까닭을 남기며, 금 칸에서만 금을 쥔다
   ================================================================ */
{
    setSize(4);
    P("setMode('play')");
    /** 출발에서 목표까지 함정·괴물을 피하는 이웃 걸음들. 목표 칸 자체는 막지 않는다. */
    const 길 = (env, 목표) => {
        const 막힘 = (k) => env.pits.has(k) || `${env.wumpus.x},${env.wumpus.y}` === k;
        const 앞 = new Map([['0,0', null]]);
        const 줄 = ['0,0'];
        while (줄.length) {
            const k = 줄.shift();
            if (k === 목표) break;
            for (const [a, b] of 이웃(4, ...k.split(',').map(Number))) {
                const n = `${a},${b}`;
                if (앞.has(n) || (막힘(n) && n !== 목표)) continue;
                앞.set(n, k);
                줄.push(n);
            }
        }
        if (!앞.has(목표)) return null;
        const 걸음 = [];
        for (let k = 목표; k !== '0,0'; k = 앞.get(k)) 걸음.unshift(k);
        return 걸음;
    };
    const 걷기 = (걸음) => {
        for (const k of 걸음) {
            const [x, y] = k.split(',').map(Number);
            const pl = P('player');
            P(`movePlayer(${x - pl.x}, ${y - pl.y})`);
        }
    };
    let 본함정 = 0, 본괴물 = 0;
    for (let s = 0; s < 40 && (본함정 < 3 || 본괴물 < 3); s++) {
        씨앗(s * 3571 + 1);
        P('initGame()');
        const env = P('env');
        // 금까지 걸어가 쥔다
        const 금길 = 길(env, `${env.gold.x},${env.gold.y}`);
        걷기(금길);
        let pl = P('player');
        if (pl.isDead) { bad(`직접 걷기(씨앗 ${s}): 안전한 길로 금까지 걸었는데 죽었다`); continue; }
        if (pl.moves !== 금길.length) bad(`직접 걷기(씨앗 ${s}): ${금길.length}번 옮겼는데 이동 횟수를 ${pl.moves} 로 셌다`);
        P('grabGold()');
        if (!P('player').hasGold) bad(`직접 걷기(씨앗 ${s}): 금 칸에서 「금 획득」을 눌렀는데 쥐지 않았다`);
        P('movePlayer(1, 0)'); P('movePlayer(-1, 0)');
        if (P('player').moves !== 금길.length) bad(`직접 걷기(씨앗 ${s}): 금을 쥔 뒤에도 움직인다`);
        // 같은 지도를 처음부터 걸어 위험한 칸으로 들어간다
        for (const [무엇, 목표] of [['pit', [...env.pits][0]], ['wumpus', `${env.wumpus.x},${env.wumpus.y}`]]) {
            if (!목표) continue;
            P('resetPlay()');
            const 위험길 = 길(env, 목표);
            if (!위험길) continue;
            걷기(위험길);
            pl = P('player');
            if (!pl.isDead || pl.cause !== 무엇) { bad(`직접 걷기(씨앗 ${s}): ${무엇} 칸 (${목표}) 에 들어갔는데 isDead=${pl.isDead} · 까닭=${pl.cause}`); continue; }
            if (무엇 === 'pit') 본함정++; else 본괴물++;
            const 글 = sim.doc.getElementById('play-percept').textContent;
            if (!글.includes(무엇 === 'pit' ? '함정' : '몬스터')) bad(`직접 걷기(씨앗 ${s}): ${무엇} 에 죽었는데 안내 글이 「${글.slice(0, 40)}」 이다`);
        }
    }
    if (본함정 < 1 || 본괴물 < 1) bad(`직접 걷기: 죽는 길을 충분히 보지 못했다(함정 ${본함정} · 괴물 ${본괴물}) — 검사가 헛돈다`);
    // 화면 글이 없는 버튼을 가리키지 않는다
    // 처음 뜰 때 스크립트가 덮어쓰는 글도 본다 — 원본 HTML 에서 주석과 스크립트를 걷어 낸 글
    const 원본 = fs.readFileSync(path.join(SIM_ROOT, 'ai/wumpus-world.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script>/g, '');
    if (/방향 버튼/.test(원본)) bad('화면: 없는 「방향 버튼」을 누르라고 한다 — 방향은 이웃 칸을 눌러 옮긴다');
}

/* ================================================================
   13. 목표 고르기 — 안전한 칸이 있으면 아무것도 모르는 칸보다 먼저, 멀어도 먼저
   ================================================================ */
{
    setSize(4);
    for (let s = 0; s < 20; s++) {
        씨앗(s + 1);
        // (0,0)·(1,0) 을 밟았고, 안전하다고 밝혀진 칸은 (2,0) 하나. (0,1)·(1,1) 은 아무것도 모른다
        P(`agent = new Agent(); agent.visited.add('1,0'); agent.safe.add('1,0'); agent.safe.add('2,0'); agent.state = 'MOVE'`);
        const 고른칸 = P('chooseBestTarget()');
        if (고른칸?.k !== '2,0') { bad(`목표 고르기: 안전한 (2,0) 을 두고 (${고른칸?.k}) 를 골랐다`); break; }
    }
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('wumpus', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
