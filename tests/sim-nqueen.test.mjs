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

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

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
            걸음.push({type: 'try', row, col, path: 다음길, state: [...판]});
            if (안전한가(판, row, col)) {
                판[row] = col;
                걸음.push({type: 'place', row, col, path: 다음길, state: [...판]});
                if (파고들기(row + 1, 다음길)) return true;
                판[row] = -1;
                걸음.push({type: 'backtrack', row, col, path: 다음길, state: [...판]});
            } else {
                걸음.push({type: 'prune', row, col, path: 다음길, state: [...판]});
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
        // 걸음마다 **그 순간의 판**까지 맞댄다 — 되짚을 때 퀸을 거두지 않으면 판에 옛 퀸이 남아 보인다
        if (a.type !== b.type || (b.type !== 'solution' && (a.row !== b.row || a.col !== b.col || a.path !== b.path
            || a.state.join(',') !== b.state.join(',')))) {
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

/* ================================================================
   7. 비트마스크로 따로 구한 정답 — 해의 개수 · 처음 만나는 답 · 시도 횟수
   ================================================================ */
// 위의 「규칙대로의걸음」은 페이지와 같은 모양(대각선을 절댓값으로 비교)이라 같은 버그를 나눠 가질 수 있다.
// 여기서는 **열 · 두 대각선을 비트로 들고 가는 다른 방법**으로 정답을 다시 구한다.
/** 모든 해를 사전순으로 — 열을 작은 번호부터 보므로 나오는 차례가 곧 사전순이다. */
function 비트로모든해(N) {
    const 해들 = [], 판 = [];
    const 파고들기 = (row, cols, d1, d2) => {
        if (row === N) { 해들.push([...판]); return; }
        for (let c = 0; c < N; c++) {
            const bc = 1 << c, b1 = 1 << (row + c), b2 = 1 << (row - c + N - 1);
            if ((cols & bc) || (d1 & b1) || (d2 & b2)) continue;
            판[row] = c;
            파고들기(row + 1, cols | bc, d1 | b1, d2 | b2);
        }
    };
    파고들기(0, 0, 0, 0);
    return 해들;
}
/** 첫 해를 찾을 때까지 「놓아 볼 칸」을 몇 번 검사했는가 — 화면의 [방문] 이 세는 것. */
function 비트로센시도(N) {
    let 시도 = 0;
    const 파고들기 = (row, cols, d1, d2) => {
        if (row === N) return true;
        for (let c = 0; c < N; c++) {
            시도++;
            const bc = 1 << c, b1 = 1 << (row + c), b2 = 1 << (row - c + N - 1);
            if ((cols & bc) || (d1 & b1) || (d2 & b2)) continue;
            if (파고들기(row + 1, cols | bc, d1 | b1, d2 | b2)) return true;
        }
        return false;
    };
    파고들기(0, 0, 0, 0);
    return 시도;
}
// 이 검사 자신의 정답이 맞는지부터 — 알려진 해의 개수(n=1..8)
const 알려진개수 = [1, 0, 0, 2, 10, 4, 40, 92];
for (let n = 1; n <= 8; n++) {
    const k = 비트로모든해(n).length;
    if (k !== 알려진개수[n - 1]) bad(`검사 자체: ${n}-퀸 해를 ${k}개로 셌다 — 알려진 값은 ${알려진개수[n - 1]}개`);
}
for (const N of [4, 5, 6, 8]) {
    const 모든해 = 비트로모든해(N);
    const 해이름 = new Set(모든해.map((s) => s.join(',')));
    doc.getElementById('boardSize').value = String(N);
    P('initGame()');
    const 페이지걸음 = P(`[...dfsGenerator(0, 'root', Array(${N}).fill(-1))]`);
    const 답걸음 = 페이지걸음.at(-1);
    if (!답걸음 || 답걸음.type !== 'solution' || 답걸음.state.join(',') !== 모든해[0].join(',')) {
        bad(`${N}-퀸: 페이지가 내놓은 답이 사전순 첫 해 [${모든해[0]}] 가 아니다`);
    }
    const 페이지시도 = 페이지걸음.filter((s) => s.type === 'try').length;
    if (페이지시도 !== 비트로센시도(N)) bad(`${N}-퀸: 시도 ${페이지시도}번 — 비트로 따로 세면 ${비트로센시도(N)}번`);
    // 걸음마다 판에 놓인 퀸끼리는 부딪히지 않는다(가지치기가 제자리에서 일어났다는 뜻)
    for (const s of 페이지걸음) {
        const 놓인행 = s.state.map((c, r) => [r, c]).filter(([, c]) => c >= 0);
        for (const [r, c] of 놓인행) {
            if (!안전한가(s.state.map((x) => (x < 0 ? -99 : x)), r, c)) { bad(`${N}-퀸: 판에 서로 부딪히는 퀸이 올라간 걸음이 있다`); break; }
        }
    }
    // 힌트는 실제 해 가운데 하나다
    sim.window.iqChangeSize(N);
    sim.window.iqShowHint();
    const 힌트열 = [...doc.getElementById('iq-hint-text').textContent.matchAll(/(\d+)행→(\d+)열/g)].map((m) => Number(m[2]) - 1);
    sim.window.iqShowHint();
    if (!해이름.has(힌트열.join(','))) bad(`직접 해 보기 ${N}: 힌트 [${힌트열}] 가 ${N}-퀸의 해 ${모든해.length}개 가운데 없다`);
}

/* ================================================================
   8. 설명문의 수 — 화면이 한 말이 실제로 센 것과 같은가
   ================================================================ */
{
    const 본문 = doc.body.textContent.replace(/\s+/g, ' ');
    const 방문 = 본문.match(/\[방문\]\s*([\d,]+)칸/);
    if (!방문) bad('설명문: 「[방문] ○칸」 문장을 찾지 못했다');
    else if (Number(방문[1].replace(/,/g, '')) !== 비트로센시도(8)) {
        bad(`설명문: 8×8 첫 답까지 [방문] ${방문[1]}칸이라고 적었는데 실제로는 ${비트로센시도(8)}칸이다`);
    }
    const 완전탐색 = 본문.match(/(\d{1,3}(?:,\d{3})+)가지/);
    if (!완전탐색 || Number(완전탐색[1].replace(/,/g, '')) !== 8 ** 8) {
        bad(`설명문: 완전탐색 가짓수를 ${완전탐색?.[1]} 로 적었다 — 8을 여덟 번 곱하면 ${8 ** 8}`);
    }
}

/* ================================================================
   9. 단계별 풀이의 그림 — 첫 판의 공격 범위와 마지막 판의 답
   ================================================================ */
{
    const 판들 = [...doc.querySelectorAll('.walkthrough-board')];
    const 칸들 = (b) => [...b.querySelectorAll('.chess-cell')];
    if (판들.length < 2) bad(`단계별 풀이: 그림 판이 ${판들.length}개다`);
    else {
        const 첫판 = 칸들(판들[0]);
        첫판.forEach((e, i) => {
            const r = Math.floor(i / 4), c = i % 4;
            const 퀸 = e.textContent.includes('👑');
            const 빨강 = !!e.querySelector('[class*="bg-red"]');
            const 공격 = !(r === 0 && c === 0) && (r === 0 || c === 0 || r === c);
            if (퀸 !== (r === 0 && c === 0)) bad(`단계별 풀이 1단계: (${r + 1},${c + 1}) 퀸 표시가 어긋난다`);
            if (빨강 !== 공격) bad(`단계별 풀이 1단계: (${r + 1},${c + 1}) 공격 범위 표시가 어긋난다`);
        });
        const 끝판 = 칸들(판들.at(-1));
        const 배치 = Array(4).fill(-1);
        끝판.forEach((e, i) => { if (e.textContent.includes('👑')) 배치[Math.floor(i / 4)] = i % 4; });
        if (!비트로모든해(4).some((s) => s.join(',') === 배치.join(','))) {
            bad(`단계별 풀이: 목표 상태로 그린 판 [${배치}] 가 4-퀸의 해가 아니다`);
        }
    }
}

/* ================================================================
   10. 직접 해 보기 — 같은 행 · 같은 열 충돌, 거두기, 상태 문장
   ================================================================ */
{
    const 찍힌 = () => [...doc.querySelectorAll('.iq-cell-conflict')].map((e) => e.id.replace('iq-cell-', '').replace('-', ',')).sort().join(' ');
    sim.window.iqChangeSize(5);
    누르기(0, 0); 누르기(0, 3);                       // 같은 행
    if (찍힌() !== '0,0 0,3') bad(`직접 해 보기: 같은 행 충돌을 [${찍힌()}] 로 찍었다`);
    sim.window.iqChangeSize(5);
    누르기(1, 4); 누르기(4, 4);                       // 같은 열
    if (찍힌() !== '1,4 4,4') bad(`직접 해 보기: 같은 열 충돌을 [${찍힌()}] 로 찍었다`);
    누르기(3, 0);                                    // 무사한 퀸 하나 더 — (3,0)은 (1,4)·(4,4)와 행·열·대각선이 모두 다르다
    const 상태 = doc.getElementById('iq-status').textContent;
    const 빨간수 = doc.querySelectorAll('.iq-cell-conflict').length;
    if (!상태.includes(`빨간 퀸 ${빨간수}개`)) bad(`직접 해 보기: 상태 문장 「${상태.trim()}」 이 충돌한 퀸 ${빨간수}개와 맞지 않는다`);
    누르기(4, 4);                                    // 다시 누르면 거둔다
    if (doc.getElementById('iq-queen-count').textContent !== '2') bad('직접 해 보기: 퀸을 다시 눌러도 거두지 않는다');
    if (찍힌() !== '') bad('직접 해 보기: 부딪히던 퀸을 거뒀는데 충돌 표시가 남았다');
}

/* ================================================================
   11. 멈춘 채로 한 걸음 — 대기 상태에서 「다음 단계」
   ================================================================ */
doc.getElementById('boardSize').value = '4';
P('initGame()');
P('stepNextAI()');
if (doc.getElementById('nodeCount').innerText !== '1') bad(`한 걸음: 첫 걸음 뒤 방문을 ${doc.getElementById('nodeCount').innerText} 로 적었다`);
if (!P('isPaused') || !P('isAnimating')) bad('한 걸음: 대기 상태에서 누르면 멈춘 채로 탐색을 시작해야 한다');
P('stepNextAI()');
if (P('currentStepIndex') !== 2) bad(`한 걸음: 두 번 눌렀는데 ${P('currentStepIndex')}단계다`);

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('nqueen', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
