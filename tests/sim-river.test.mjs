// 강 건너기 시뮬레이터가 **금지 조건과 너비 우선 탐색을 규칙대로 다루는지** 본다.
//
// 이 문제는 상태가 열여섯 개뿐이라 **모든 상태를 다 세어 정답을 따로 구할 수 있다.**
// 그래서 페이지의 판정을 한 번도 빌리지 않고, 안전한 상태 · 이웃 상태 · 최단 경로를
// 이 검사가 처음부터 다시 구해 맞대어 본다.
//
// 보는 것.
//   1. **안전 판정이 규칙과 같다.** 열여섯 상태를 하나씩 맞대어 본다.
//   2. **이웃 상태가 규칙과 같다.** 농부와 같은 쪽에 있는 것만 태우고, 위험해지는 이동은 뺀다.
//   3. **자동 풀이의 경로가 최단이고 실제로 이어져 있다.** 일곱 수이고, 지나는 상태가 모두 안전하다.
//   4. **손으로 풀기**: 위험해지는 이동은 판을 바꾸지 않고 횟수도 세지 않는다.
//      건너편에 있는 것은 태울 수 없다. 다 건너면 성공이 뜬다.
//   5. **상태 공간 트리**: 층마다 나오는 마디와 그 종류(위험 · 이미 발견 · 목표 · 정답 경로)가
//      너비 우선 탐색을 그대로 따라간 것과 같다. **가지치기된 마디도 화면에 남아야 한다** —
//      빠지면 학생은 왜 그 길로 안 갔는지를 볼 수 없다.
//
// **못 보는 것.** 나룻배가 화면 어디를 지나는지, 마디가 겹치는지는 여기서 볼 수 없다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/search-river-crossing');
sim.lifecycle();
console.log(`강 건너기 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/* ================================================================
   정답을 따로 구한다 — 상태가 열여섯뿐이라 전부 셀 수 있다
   ================================================================ */
const 모든상태 = [];
for (let f = 0; f < 2; f++) for (let w = 0; w < 2; w++) for (let s = 0; s < 2; s++) for (let c = 0; c < 2; c++) {
    모든상태.push([f, w, s, c]);
}
/** 농부가 없는 쪽에 늑대와 양, 또는 양과 양배추가 함께 남지 않는가. */
const 안전한가 = ([f, w, s, c]) => !(w === s && f !== w) && !(s === c && f !== s);
const 이름 = (s) => s.join('');
const 이웃들 = (s) => {
    const 결과 = [];
    for (let 짐 = -1; 짐 <= 2; 짐++) {
        if (짐 >= 0 && s[짐 + 1] !== s[0]) continue;
        const ns = [...s];
        ns[0] = 1 - s[0];
        if (짐 >= 0) ns[짐 + 1] = ns[0];
        if (안전한가(ns)) 결과.push({state: ns, cargo: 짐});
    }
    return 결과;
};
/** 너비 우선 탐색으로 구한 최단 경로. 페이지의 것과 맞대어 볼 정답이다. */
function 최단경로() {
    const 대기열 = [{state: [0, 0, 0, 0], path: []}];
    const 본곳 = new Set(['0000']);
    while (대기열.length) {
        const {state, path} = 대기열.shift();
        if (이름(state) === '1111') return path;
        for (const {state: ns, cargo} of 이웃들(state)) {
            if (본곳.has(이름(ns))) continue;
            본곳.add(이름(ns));
            대기열.push({state: ns, path: [...path, {from: state, to: ns, cargo}]});
        }
    }
    return [];
}

/* ================================================================
   1 · 2. 안전 판정과 이웃 상태
   ================================================================ */
for (const s of 모든상태) {
    if (P(`isSafe(${JSON.stringify(s)})`) !== 안전한가(s)) {
        bad(`안전 판정: ${이름(s)} 의 판정이 규칙과 어긋난다`);
    }
    if (!안전한가(s)) continue;
    const 페이지 = P(`getNeighbors(${JSON.stringify(s)})`).map((n) => `${이름(n.state)}:${n.cargo}`).sort();
    const 기대 = 이웃들(s).map((n) => `${이름(n.state)}:${n.cargo}`).sort();
    if (페이지.join(' ') !== 기대.join(' ')) {
        bad(`이웃 상태: ${이름(s)} 에서 [${페이지}] 를 내놓았는데 규칙대로면 [${기대}] 다`);
    }
}

/* ================================================================
   3. 자동 풀이의 경로
   ================================================================ */
const 경로 = P('BFS_SOLUTION');
const 기대경로 = 최단경로();
if (경로.length !== 기대경로.length) bad(`자동 풀이: ${경로.length}수 경로를 내놓았다 — 최단은 ${기대경로.length}수다`);
{
    let 여기 = [0, 0, 0, 0];
    for (const [i, 걸음] of 경로.entries()) {
        if (이름(걸음.from) !== 이름(여기)) bad(`자동 풀이: ${i + 1}수의 출발 상태가 앞 수의 도착 상태와 다르다`);
        const 갈수있는곳 = 이웃들(여기).map((n) => 이름(n.state));
        if (!갈수있는곳.includes(이름(걸음.to))) bad(`자동 풀이: ${i + 1}수 ${이름(여기)}→${이름(걸음.to)} 는 규칙에 없는 이동이다`);
        if (!안전한가(걸음.to)) bad(`자동 풀이: ${i + 1}수 뒤의 상태 ${이름(걸음.to)} 가 위험하다`);
        여기 = 걸음.to;
    }
    if (이름(여기) !== '1111') bad('자동 풀이: 경로 끝이 목표 상태가 아니다');
}

// 한 걸음씩 눌러 간 판이 경로와 같은가
P('resetAI()');
for (let i = 0; i < 경로.length; i++) {
    P('aiStep()');
    if (이름(P('aiState')) !== 이름(경로[i].to)) bad(`자동 풀이: ${i + 1}회차의 판이 경로와 다르다`);
    if (doc.getElementById('autoStep').textContent !== String(i + 1)) {
        bad(`자동 풀이: ${i + 1}회차인데 회차를 ${doc.getElementById('autoStep').textContent} 로 적었다`);
    }
}
const 끝난판 = 이름(P('aiState'));
P('aiStep()');
if (이름(P('aiState')) !== 끝난판) bad('자동 풀이: 다 건넌 뒤에도 판이 움직인다');
if (doc.querySelectorAll('#aiPathBox span').length < 경로.length) {
    bad('자동 풀이: 지나온 수를 다 적지 않는다');
}

/* ================================================================
   4. 손으로 풀기 — **화면을 눌러서 본다**
   ================================================================ */
const 짐고르기 = (idx) => P(`toggleCargo(${idx})`);
const 건너기 = () => P('doCross()');

P('resetManual()');
// 농부만 건너면 늑대와 양이 남아 위험하다 — 막혀야 한다
건너기();
if (이름(P('manualState')) !== '0000') bad('손으로 풀기: 위험해지는 이동이 판을 바꿨다');
if (doc.getElementById('manualMoveCount').textContent !== '0') bad('손으로 풀기: 위험해지는 이동을 횟수로 셌다');

// 양을 태우면 건널 수 있다
짐고르기(1);
건너기();
if (이름(P('manualState')) !== '1010') bad(`손으로 풀기: 양을 태워 건넜는데 상태가 ${이름(P('manualState'))} 다`);
if (doc.getElementById('manualMoveCount').textContent !== '1') bad('손으로 풀기: 이동 횟수를 세지 않는다');

// 건너편에 있는 것은 태울 수 없다 — 농부는 오른쪽, 늑대는 왼쪽이다
짐고르기(0);
if (P('selectedCargo') !== -1) bad('손으로 풀기: 농부와 다른 쪽에 있는 것을 태웠다');

// 최단 경로대로 건너면 성공이 뜬다
P('resetManual()');
for (const 걸음 of 기대경로) {
    if (걸음.cargo >= 0) 짐고르기(걸음.cargo);
    건너기();
}
if (이름(P('manualState')) !== '1111') bad('손으로 풀기: 최단 경로대로 갔는데 목표에 닿지 않았다');
if (doc.getElementById('successMsg').classList.contains('hidden')) bad('손으로 풀기: 다 건넜는데 성공이 뜨지 않는다');
// 「최적」만 찾으면 헛돈다 — 돌아간 풀이의 「최적은 7번」에도 그 낱말이 든다
if (!doc.getElementById('successDetail').textContent.includes('최적 해 달성')) {
    bad('손으로 풀기: 최단 수로 끝냈는데 그렇게 알려 주지 않는다');
}
if (!doc.getElementById('crossBtn').disabled) bad('손으로 풀기: 다 건넌 뒤에도 「건너기」가 눌린다');

// 돌아간 풀이 — 양을 건네 놓고 농부 혼자 두 번 더 오간 뒤 최단 경로의 나머지로. 성공이지만 최적이 아니다
P('resetManual()');
for (const 짐 of [기대경로[0].cargo, -1, -1, ...기대경로.slice(1).map((s) => s.cargo)]) {
    if (짐 >= 0) 짐고르기(짐);
    건너기();
}
{
    const 글 = doc.getElementById('successDetail').textContent;
    const 수 = 기대경로.length + 2;
    if (doc.getElementById('manualMoveCount').textContent !== String(수)) bad(`손으로 풀기: ${수}수로 끝냈는데 ${doc.getElementById('manualMoveCount').textContent} 로 적었다`);
    if (doc.getElementById('successMsg').classList.contains('hidden')) bad('손으로 풀기: 돌아가서 끝냈는데 성공이 뜨지 않는다');
    if (글.includes('최적 해 달성') || !글.includes(`최적은 ${기대경로.length}번`)) bad(`손으로 풀기: ${수}수로 끝냈는데 「${글}」 라고 알린다`);
}

// 끝나기 전에는 성공이 없다
P('resetManual()');
짐고르기(1);
건너기();
if (!doc.getElementById('successMsg').classList.contains('hidden')) bad('손으로 풀기: 한 수 만에 성공이 떴다');
// 고른 짐을 다시 누르면 해제한다
짐고르기(1);                                         // 농부는 오른쪽, 양도 오른쪽 — 고를 수 있다
짐고르기(1);
if (P('selectedCargo') !== -1) bad('손으로 풀기: 고른 짐을 다시 눌렀는데 해제되지 않는다');

/* ================================================================
   5. 상태 공간 트리 — 층마다의 마디와 그 종류
   ================================================================ */
P('buildTree()');
{
    // **정답을 따로 만든다.** 페이지와 같은 규칙을 여기서 다시 돌린다.
    const 자리이름 = (k) => '(' + k.split('').map((c) => (c === '1' ? '오' : '왼')).join(',') + ')';
    const 기대층 = [[{label: 자리이름('0000'), type: 'path'}]];
    const 본곳 = new Set(['0000']);
    let 앞줄 = [[0, 0, 0, 0]];
    for (let d = 1; d <= 12 && 앞줄.length; d++) {
        const 이번층 = [], 다음줄 = [];
        for (const s of 앞줄) {
            for (let 짐 = -1; 짐 <= 2; 짐++) {
                if (짐 >= 0 && s[짐 + 1] !== s[0]) continue;
                const ns = [...s];
                ns[0] = 1 - s[0];
                if (짐 >= 0) ns[짐 + 1] = ns[0];
                const k = 이름(ns);
                if (!안전한가(ns)) 이번층.push({label: 자리이름(k), type: 'invalid'});
                else if (본곳.has(k)) 이번층.push({label: 자리이름(k), type: 'visited'});
                else {
                    본곳.add(k);
                    다음줄.push(ns);
                    if (k === '1111') 이번층.push({label: 자리이름(k), type: 'goal'});
                    else 이번층.push({label: 자리이름(k), type: 기대경로[d - 1] && 이름(기대경로[d - 1].to) === k ? 'path' : ''});
                }
            }
        }
        기대층.push(이번층);
        if (본곳.has('1111')) break;
        앞줄 = 다음줄;
    }

    const 그린층 = [...doc.querySelectorAll('#treeContainer .tree-level')].map((row) =>
        [...row.querySelectorAll('.tree-node')].map((n) => ({
            label: n.querySelector('div').textContent,
            type: [...n.classList].filter((c) => c !== 'tree-node').join(' '),
        })));

    if (그린층.length !== 기대층.length) {
        bad(`상태 공간 트리: ${그린층.length}층을 그렸다 — 규칙대로면 ${기대층.length}층이다`);
    }
    for (let d = 0; d < Math.min(그린층.length, 기대층.length); d++) {
        const 그림 = 그린층[d].map((n) => `${n.label}${n.type ? '[' + n.type + ']' : ''}`);
        const 기대 = 기대층[d].map((n) => `${n.label}${n.type ? '[' + n.type + ']' : ''}`);
        if (그림.join(' ') !== 기대.join(' ')) {
            bad(`상태 공간 트리: ${d}층이 어긋난다 — 그린 것 [${그림.join(' ')}] · 규칙대로면 [${기대.join(' ')}]`);
        }
    }
    const 위험마디 = 그린층.flat().filter((n) => n.type === 'invalid').length;
    if (!위험마디) bad('상태 공간 트리: 가지치기된 마디가 하나도 남지 않았다 — 왜 그 길로 안 갔는지 볼 수 없다');
    console.log(`  · 트리 ${그린층.length}층 · 마디 ${그린층.flat().length}개(위험 ${위험마디}개) · 최단 ${경로.length}수`);

    // 정답 경로 마디의 덧글 — 몇 번째 수인지 · 누구와 · 어느 쪽으로
    const 번호 = '①②③④⑤⑥⑦⑧⑨';
    const 짐이름 = ['늑대와', '양과', '양배추와'];
    const 경로마디 = [...doc.querySelectorAll('#treeContainer .tree-node.path, #treeContainer .tree-node.goal')].slice(1);
    if (경로마디.length !== 기대경로.length) bad(`상태 공간 트리: 정답 경로 마디가 ${경로마디.length}개 — 최단은 ${기대경로.length}수다`);
    경로마디.forEach((n, i) => {
        const 덧글 = n.querySelectorAll('div')[1]?.textContent ?? '';
        const 걸음 = 기대경로[i];
        if (!걸음) return;
        const 기대 = `${번호[i]} ${걸음.cargo < 0 ? '혼자' : 짐이름[걸음.cargo]} ${걸음.to[0] === 1 ? '→' : '←'}`;
        if (!덧글.startsWith(기대)) bad(`상태 공간 트리: ${i + 1}수 마디의 덧글 「${덧글}」 이 「${기대}」 로 시작하지 않는다`);
    });

    // 회색 마디는 큐에 넣을 때 표시한 것이다 — 「방문」(꺼내서 확장)이 아니라 「발견」이다
    for (const n of doc.querySelectorAll('#treeContainer .tree-node.visited')) {
        const 덧글 = n.querySelectorAll('div')[1]?.textContent ?? '';
        if (!덧글.endsWith('이미 발견')) bad(`상태 공간 트리: 회색 마디의 덧글 「${덧글}」 — 큐에 넣을 때 거르므로 「이미 발견」이라야 한다`);
    }
}

/* ================================================================
   6. 설명문의 수 — 상태 수 · 유효 상태 · 최단 수 · 퀴즈의 전제
   ================================================================ */
{
    const 안전수 = 모든상태.filter(안전한가).length;
    // 처음 상태에서 닿는 안전한 상태 — 너비 우선으로 따로 센다
    const 닿음 = new Set(['0000']);
    const 줄 = [[0, 0, 0, 0]];
    while (줄.length) {
        for (const {state} of 이웃들(줄.shift())) if (!닿음.has(이름(state))) { 닿음.add(이름(state)); 줄.push(state); }
    }
    if (닿음.size !== 안전수) bad(`상태 공간: 안전한 상태 ${안전수}개 가운데 ${닿음.size}개만 처음 상태에서 닿는다`);

    const 본문 = doc.body.textContent.replace(/\s+/g, ' ');
    const 표 = 본문.match(/2⁴ = (\d+)개, 그중 유효 상태 (\d+)개/);
    if (!표) bad('설명문: 「2⁴ = ○개, 그중 유효 상태 ○개」 문장을 찾지 못했다');
    else {
        if (Number(표[1]) !== 모든상태.length) bad(`설명문: 상태를 ${표[1]}개로 적었다 — ${모든상태.length}개`);
        if (Number(표[2]) !== 안전수) bad(`설명문: 유효 상태를 ${표[2]}개로 적었다 — 안전한 상태는 ${안전수}개`);
    }
    const 유효 = 본문.match(/총 유효 상태 (\d+)개/);
    if (!유효 || Number(유효[1]) !== 안전수) bad(`설명문: 「총 유효 상태 ${유효?.[1]}개」 — 안전한 상태는 ${안전수}개`);
    // 「최소 N번」 · 「N번 건너기」 · 「N수 해」 · 「N번 이내」 가 모두 최단 수와 같다
    for (const m of 본문.matchAll(/최소 (\d+)번|(\d+)번 건너기|(\d+)수 해|목표: (\d+)번 이내|최단 해\((\d+)번\)/g)) {
        const k = Number(m.slice(1).find((x) => x !== undefined));
        if (k !== 기대경로.length) bad(`설명문: 「${m[0]}」 — 최단은 ${기대경로.length}수다`);
    }
    // 퀴즈 3의 전제 — 최적 해의 4번째 수는 양을 왼쪽으로 데려오는 것이고, 그 앞 수에서 늑대를 건넸다
    const q3 = 본문.includes('4번째 수에서 양을 왼쪽으로 다시 데려오는');
    if (q3 && !(경로[3]?.cargo === 1 && 경로[3].to[0] === 0)) bad('퀴즈 3: 페이지 경로의 4번째 수가 양을 데려오는 수가 아니다');
    if (q3 && 경로[2]?.cargo !== 0) bad('퀴즈 3: 정답 해설은 늑대를 먼저 건넨 경로를 전제하는데 페이지 경로의 3번째 수가 늑대가 아니다');
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('river', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
