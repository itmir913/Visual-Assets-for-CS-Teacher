// N-퀸 시뮬레이터가 **되짚기(백트래킹)를 규칙대로 하는지** 본다.
//
// 화면에는 트리와 체스판만 나오므로, 「가지치기가 제자리에서 일어났는가」는 눈으로 갈리지
// 않는다 — 한 걸음 어긋나도 그럴듯한 그림이 나오기 때문이다. 그래서 **페이지가 내놓는
// 걸음을 그대로 받아 두고, 같은 규칙을 이 검사가 따로 돌려 한 걸음씩 맞대어 본다.**
// 페이지 함수를 불러 그 결과를 자기 자신과 비교하면 검사가 헛돈다.
//
// 보는 것.
//   1. **걸음의 차례가 규칙과 같다.** 시도 → 안전하면 놓기, 아니면 가지치기 → 막히면 되짚기.
//      열은 작은 번호부터, 행은 위에서부터. 한 걸음이라도 어긋나면 그 자리를 찍는다.
//   2. **찾은 답이 실제로 답이다.** 같은 행·열·대각선에 둘이 없어야 한다.
//   3. **찾은 답이 「처음 만나는 답」이다.** 깊이 우선 탐색이 차례를 지켰다면 사전순으로
//      가장 앞선 배치가 나온다.
//   4. **센 노드 수가 실제로 시도한 횟수와 같다.**
//   5. **답으로 가는 길이 트리에 온전히 남는다.** 뿌리까지 이어지고 마디마다 답으로 찍힌다.
//   6. **직접 해 보는 판**: 충돌 표시가 실제 충돌과 같은가, 답을 놓으면 성공이 뜨는가,
//      힌트로 내놓는 배치가 실제로 답인가, 손대는 칸의 공격 범위가 맞는가.
//
// **못 보는 것.** 트리가 화면에서 겹치는지, 칸이 몇 픽셀인지는 여기서 볼 수 없다.

import {loadSim, SIM_ROOT} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/search-n-queen');
sim.lifecycle();
console.log(`N-퀸 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/** 같은 행·열·대각선에 놓였는가. **페이지의 판정을 쓰지 않고 여기서 다시 따진다.** */
const 안전한가 = (state, row, col) => {
    for (let i = 0; i < row; i++) {
        if (state[i] === col || Math.abs(state[i] - col) === Math.abs(i - row)) return false;
    }
    return true;
};

/** 규칙대로라면 나와야 할 걸음의 차례. **페이지와 따로 돌린다.** */
function 규칙대로의걸음(N) {
    const 걸음 = [];
    const 판 = Array(N).fill(-1);
    const 파고들기 = (row, 길) => {
        if (row === N) {
            걸음.push({type: 'solution', state: [...판]});
            return true;
        }
        for (let col = 0; col < N; col++) {
            const 다음길 = 길 + '-' + col;
            걸음.push({type: 'try', row, col, path: 다음길});
            if (안전한가(판, row, col)) {
                판[row] = col;
                걸음.push({type: 'place', row, col, path: 다음길});
                if (파고들기(row + 1, 다음길)) return true;
                판[row] = -1;
                걸음.push({type: 'backtrack', row, col, path: 다음길});
            } else {
                걸음.push({type: 'prune', row, col, path: 다음길});
            }
        }
        return false;
    };
    파고들기(0, 'root');
    return 걸음;
}

/** 사전순으로 가장 앞선 답. 없으면 `null`. */
function 처음만나는답(N) {
    const 판 = Array(N).fill(-1);
    const 파고들기 = (row) => {
        if (row === N) return true;
        for (let col = 0; col < N; col++) {
            if (!안전한가(판, row, col)) continue;
            판[row] = col;
            if (파고들기(row + 1)) return true;
            판[row] = -1;
        }
        return false;
    };
    return 파고들기(0) ? [...판] : null;
}

/* ================================================================
   1 · 2 · 3. 걸음의 차례와 찾아낸 답
   ================================================================ */
for (const N of [4, 5, 6, 8]) {
    doc.getElementById('boardSize').value = String(N);
    P('initGame()');

    // **제너레이터를 직접 돌려 걸음을 그대로 받는다.** 화면을 거치면 그리는 코드가 섞인다.
    const 페이지걸음 = P(`[...dfsGenerator(0, 'root', Array(${N}).fill(-1))]`);
    const 기대걸음 = 규칙대로의걸음(N);

    if (페이지걸음.length !== 기대걸음.length) {
        bad(`${N}-퀸: 걸음 수가 ${페이지걸음.length}, 규칙대로면 ${기대걸음.length}`);
    }
    let 어긋난자리 = -1;
    for (let i = 0; i < Math.min(페이지걸음.length, 기대걸음.length); i++) {
        const a = 페이지걸음[i], b = 기대걸음[i];
        if (a.type !== b.type || (b.type !== 'solution' && (a.row !== b.row || a.col !== b.col || a.path !== b.path))) {
            어긋난자리 = i;
            break;
        }
    }
    if (어긋난자리 >= 0) {
        const a = 페이지걸음[어긋난자리], b = 기대걸음[어긋난자리];
        bad(`${N}-퀸: ${어긋난자리 + 1}번째 걸음이 어긋난다 — 페이지는 ${a.type}(${a.row},${a.col}), 규칙대로면 ${b.type}(${b.row},${b.col})`);
    }

    const 답걸음 = 페이지걸음.at(-1);
    const 답 = 처음만나는답(N);
    if (!답) {
        if (답걸음 && 답걸음.type === 'solution') bad(`${N}-퀸: 답이 없는 크기인데 답을 찾았다고 한다`);
        continue;
    }
    if (!답걸음 || 답걸음.type !== 'solution') {
        bad(`${N}-퀸: 답이 있는데 찾지 못했다`);
        continue;
    }
    for (let r = 0; r < N; r++) {
        if (!안전한가(답걸음.state, r, 답걸음.state[r])) bad(`${N}-퀸: 내놓은 배치의 ${r + 1}행이 다른 퀸과 부딪힌다`);
    }
    if (답걸음.state.join(',') !== 답.join(',')) {
        bad(`${N}-퀸: 내놓은 배치 [${답걸음.state}] 가 처음 만나는 답 [${답}] 와 다르다`);
    }
}

/* ================================================================
   4 · 5. 센 노드 수와 답으로 가는 길
   ================================================================ */
for (const N of [4, 6]) {
    doc.getElementById('boardSize').value = String(N);
    P('beginSearch(true)');
    let 회차 = 0;
    while (P('isAnimating') && 회차 < 20000) {
        P('executeNextStep(true)');
        회차++;
    }
    if (회차 >= 20000) { bad(`${N}-퀸: 탐색이 끝나지 않는다`); continue; }

    const 시도횟수 = 규칙대로의걸음(N).filter((s) => s.type === 'try').length;
    const 화면수 = Number(doc.getElementById('nodeCount').innerText);
    if (화면수 !== 시도횟수) bad(`${N}-퀸: 화면의 노드 수 ${화면수} 가 실제 시도 횟수 ${시도횟수} 와 다르다`);

    // 답으로 가는 길이 뿌리까지 이어지고 마디마다 답으로 찍혔는가
    const 답 = 처음만나는답(N);
    const 답길 = 'root' + 답.map((c) => '-' + c).join('');
    const 마디들 = P(`Object.keys(nodeMap).filter(k => nodeMap[k].type === 'solution')`);
    let 길 = 답길;
    const 있어야할것 = [];
    while (길 !== 'root') {
        있어야할것.push(길);
        길 = 길.substring(0, 길.lastIndexOf('-'));
    }
    for (const k of 있어야할것) {
        if (!마디들.includes(k)) bad(`${N}-퀸: 답으로 가는 길의 ${k} 가 답으로 찍히지 않았다`);
    }
    const 군더더기 = 마디들.filter((k) => k !== 'root' && !있어야할것.includes(k));
    if (군더더기.length) bad(`${N}-퀸: 답이 아닌 ${군더더기.length}개 마디가 답으로 찍혔다`);
}

/* ================================================================
   6. 직접 해 보는 판 — **화면을 눌러서 본다**
   ================================================================ */
const 칸 = (r, c) => doc.getElementById(`iq-cell-${r}-${c}`);
const 누르기 = (r, c) => 칸(r, c).dispatchEvent(new sim.window.MouseEvent('click', {bubbles: true}));

for (const N of [4, 5, 6, 8]) {
    sim.window.iqChangeSize(N);

    // 힌트로 내놓는 배치가 실제로 답인가
    sim.window.iqShowHint();
    const 힌트 = doc.getElementById('iq-hint-text').textContent;
    const 열들 = [...힌트.matchAll(/(\d+)행→(\d+)열/g)].map((m) => Number(m[2]) - 1);
    if (열들.length !== N) {
        bad(`직접 해 보기 ${N}: 힌트가 ${열들.length}행짜리다`);
    } else {
        for (let r = 0; r < N; r++) {
            if (!안전한가(열들, r, 열들[r])) bad(`직접 해 보기 ${N}: 힌트로 내놓은 배치가 답이 아니다 — ${r + 1}행이 부딪힌다`);
        }
    }
    sim.window.iqShowHint();     // 다시 눌러 닫는다

    // 힌트대로 놓으면 성공이 떠야 한다
    for (let r = 0; r < N; r++) 누르기(r, 열들[r]);
    if (doc.getElementById('iq-success-banner').classList.contains('hidden')) {
        bad(`직접 해 보기 ${N}: 답을 놓았는데 성공이 뜨지 않는다`);
    }
    if (doc.querySelectorAll('.iq-cell-conflict').length) {
        bad(`직접 해 보기 ${N}: 답을 놓았는데 충돌로 찍힌 칸이 있다`);
    }
    if (Number(doc.getElementById('iq-queen-count').textContent) !== N) {
        bad(`직접 해 보기 ${N}: 놓은 퀸 수를 잘못 센다`);
    }
}

// 부딪히게 놓으면 부딪힌 칸만 찍혀야 한다
sim.window.iqChangeSize(5);
const 놓은곳 = [[0, 0], [1, 1], [3, 2]];      // 앞의 둘은 대각선으로 부딪히고 나머지 하나는 무사하다
for (const [r, c] of 놓은곳) 누르기(r, c);
const 찍힌칸 = [...doc.querySelectorAll('.iq-cell-conflict')].map((e) => e.id.replace('iq-cell-', '').replace('-', ','));
const 부딪힌칸 = new Set();
for (let i = 0; i < 놓은곳.length; i++) {
    for (let j = i + 1; j < 놓은곳.length; j++) {
        const [r1, c1] = 놓은곳[i], [r2, c2] = 놓은곳[j];
        if (r1 === r2 || c1 === c2 || Math.abs(r1 - r2) === Math.abs(c1 - c2)) {
            부딪힌칸.add(`${r1},${c1}`);
            부딪힌칸.add(`${r2},${c2}`);
        }
    }
}
if ([...부딪힌칸].sort().join(' ') !== 찍힌칸.sort().join(' ')) {
    bad(`직접 해 보기: 충돌로 찍은 칸(${찍힌칸.join(' ')})이 실제 충돌(${[...부딪힌칸].join(' ')})과 다르다`);
}
if (!doc.getElementById('iq-success-banner').classList.contains('hidden')) {
    bad('직접 해 보기: 충돌이 있는데 성공이 떠 있다');
}

// 손댄 칸의 공격 범위 — 같은 행 · 열 · 대각선이 모두 찍혀야 한다
sim.window.iqChangeSize(5);
칸(2, 2).dispatchEvent(new sim.window.MouseEvent('mouseenter', {bubbles: false}));
const 찍힌공격 = new Set([...doc.querySelectorAll('.iq-cell-attacked')].map((e) => e.id.replace('iq-cell-', '').replace('-', ',')));
for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
        const 공격받음 = (r !== 2 || c !== 2)
            && (r === 2 || c === 2 || Math.abs(r - 2) === Math.abs(c - 2));
        if (공격받음 !== 찍힌공격.has(`${r},${c}`)) {
            bad(`직접 해 보기: (${r + 1}행 ${c + 1}열) 의 공격 범위 표시가 어긋난다`);
        }
    }
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
