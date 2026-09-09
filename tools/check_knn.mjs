// k-NN 시뮬레이터가 **가까운 것부터 k개를 골라 다수결로 정하는지** 본다.
//
// 화면에는 굵은 선 몇 개와 「Class A」만 나오므로, 고른 이웃이 정말 가장 가까운 것들인지는
// 눈으로 갈리지 않는다. 그래서 **거리를 이 검사가 직접 재어** k개를 따로 고르고,
// 페이지가 고른 것과 맞대어 본다. 동점일 때의 규칙(가까운 이웃의 반을 따른다)도 함께 본다.
//
// 보는 것.
//   1. **거리가 유클리드 거리이고 가까운 것부터 늘어서는가.**
//   2. **고른 k개가 실제로 가장 가까운 k개인가.** 거리가 같은 것이 여럿이면 어느 것을 골라도
//      되므로 **거리의 목록**으로 맞댄다 — 어느 점을 골랐는지로 맞대면 검사가 동점 처리에 매인다.
//   3. **표를 세는 것과 정하는 것이 규칙과 같은가.** 동점이면 그 반들 가운데 가장 가까운
//      이웃의 반을 따른다.
//   4. **k를 바꾸면 결과가 곧바로 다시 나오는가.**
//   5. **화면에 그린 굵은 선이 고른 이웃과 하나씩 맞물리는가.** 여기가 어긋나면 셈은 맞는데
//      **학생이 보는 그림만 틀린다.**
//   6. **무작위 자료가 판 안에 들어오는가.**
//
// **못 보는 것.** 실제 픽셀과 색은 볼 수 없다. 점의 모양(●■▲)도 그린 명령의 자취로만 본다.

import {loadSim, SIM_ROOT} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/supervised-k-nn');
sim.lifecycle();
console.log(`k-NN (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/** 자리를 정해 두고 흔드는 난수. 같은 점이 나와야 결함을 좇을 수 있다. */
let 씨 = 987654321;
const 흔들기 = () => (씨 = (씨 * 1103515245 + 12345) % 2147483648) / 2147483648;

const 거리 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/* ================================================================
   자료를 손으로 놓고 본다 — 화면에서 뽑으면 판마다 달라져 결함을 좇을 수 없다
   ================================================================ */
const 점들 = [];
for (let i = 0; i < 60; i++) {
    점들.push({
        x: Math.round(흔들기() * 380 + 10),
        y: Math.round(흔들기() * 380 + 10),
        cls: ['A', 'B', 'C'][Math.floor(흔들기() * 3)],
    });
}
// 거리가 같은 이웃이 반드시 생기도록 물음점 둘레에 대칭으로 몇 개를 더 놓는다
const 물음 = {x: 200, y: 200};
점들.push({x: 170, y: 200, cls: 'A'}, {x: 230, y: 200, cls: 'B'},
    {x: 200, y: 170, cls: 'C'}, {x: 200, y: 230, cls: 'A'});

P(`dataManager.points = ${JSON.stringify(점들)}`);
P(`dataManager.setQueryPoint(${물음.x}, ${물음.y})`);

/* ================================================================
   1. 거리
   ================================================================ */
P('knn.calcAllDistances()');
const 잰거리 = P('knn.distances').map((d) => ({x: d.point.x, y: d.point.y, cls: d.point.cls, dist: d.dist}));
if (잰거리.length !== 점들.length) bad(`거리: ${잰거리.length}개만 쟀다 — 점은 ${점들.length}개다`);
for (const d of 잰거리) {
    const 기대 = 거리(d, 물음);
    if (Math.abs(d.dist - 기대) > 1e-9) bad(`거리: (${d.x},${d.y}) 까지 ${d.dist} 로 쟀다 — 유클리드 거리는 ${기대} 다`);
}
for (let i = 1; i < 잰거리.length; i++) {
    if (잰거리[i - 1].dist > 잰거리[i].dist + 1e-12) { bad('거리: 가까운 것부터 늘어서지 않았다'); break; }
}

/* ================================================================
   2 · 3. 고른 k개와 다수결
   ================================================================ */
const 기대순 = [...점들].map((p) => ({...p, dist: 거리(p, 물음)})).sort((a, b) => a.dist - b.dist);

for (let k = 1; k <= 15; k += 2) {
    P(`knn.selectKNeighbors(${k})`);
    const 고른것 = P('knn.kNeighbors').map((n) => ({cls: n.point.cls, dist: n.dist}));
    if (고른것.length !== k) { bad(`k=${k}: 이웃을 ${고른것.length}개 골랐다`); continue; }

    const 기대거리 = 기대순.slice(0, k).map((p) => p.dist.toFixed(9)).sort();
    const 고른거리 = 고른것.map((n) => n.dist.toFixed(9)).sort();
    if (기대거리.join(' ') !== 고른거리.join(' ')) {
        bad(`k=${k}: 고른 이웃이 가장 가까운 ${k}개가 아니다`);
    }

    const 정한반 = P('knn.doVoting()');
    const 표 = P('knn.voteCounts');
    // **표를 여기서 다시 센다.** 페이지가 고른 이웃 그대로 세되, 세는 일 자체는 검사가 한다
    const 기대표 = {A: 0, B: 0, C: 0};
    for (const n of 고른것) 기대표[n.cls]++;
    for (const cls of ['A', 'B', 'C']) {
        if (표[cls] !== 기대표[cls]) bad(`k=${k}: ${cls} 의 표를 ${표[cls]} 로 셌다 — 실제로는 ${기대표[cls]}표다`);
    }
    const 가장많은표 = Math.max(...Object.values(기대표));
    const 동점반 = Object.keys(기대표).filter((c) => 기대표[c] === 가장많은표 && 가장많은표 > 0);
    if (!동점반.includes(정한반)) {
        bad(`k=${k}: 표가 가장 많은 반은 ${동점반.join('·')} 인데 ${정한반} 로 정했다`);
    }
    if (동점반.length > 1) {
        // 동점이면 «그 반들 가운데 가장 가까운 이웃»의 반을 따라야 한다
        const 가장가까운동점 = 고른것.filter((n) => 동점반.includes(n.cls))
            .sort((a, b) => a.dist - b.dist)[0];
        if (정한반 !== 가장가까운동점.cls) {
            bad(`k=${k}: 동점인데 가장 가까운 ${가장가까운동점.cls} 가 아니라 ${정한반} 로 정했다`);
        }
        if (!P('knn.isTie')) bad(`k=${k}: 동점인데 동점이라고 알리지 않는다`);
    } else if (P('knn.isTie')) {
        bad(`k=${k}: 동점이 아닌데 동점이라고 알린다`);
    }
}

/* ================================================================
   4. 화면 — 걸음을 눌러 끝까지 가고, k 를 바꾸면 다시 셈한다
   ================================================================ */
doc.getElementById('kSlider').value = '5';
P("phase = 'IDLE'");
// **버튼을 눌리게 해 둔다.** 물음점을 화면이 아니라 코드로 놓았으므로, 화면에서 물음점을
// 찍을 때 함께 풀리는 잠금이 아직 걸려 있다.
P('toggleAlgControls(true)');
for (let i = 0; i < 3; i++) doc.getElementById('btnStep').dispatchEvent(new sim.window.MouseEvent('click', {bubbles: true}));
{
    const 표 = P('knn.voteCounts');
    for (const cls of ['A', 'B', 'C']) {
        if (doc.getElementById('vote' + cls).innerText !== String(표[cls])) {
            bad(`화면: ${cls} 의 표를 화면에 다르게 적었다`);
        }
    }
    const 적힌것 = doc.getElementById('finalResultText').innerText;
    const 정한반 = P('dataManager.queryPoint.resultCls');
    if (!적힌것.startsWith(`Class ${정한반}`)) bad(`화면: 결과를 「${적힌것}」 로 적었다 — 정한 반은 ${정한반} 다`);
    if (!doc.getElementById('btnStep').disabled) bad('화면: 다 끝났는데 「Step」이 눌린다');
}

// k 를 바꾸면 곧바로 다시 셈한다
{
    const 앞표 = JSON.stringify(P('knn.voteCounts'));
    const 슬라이더 = doc.getElementById('kSlider');
    슬라이더.value = '11';
    슬라이더.dispatchEvent(new sim.window.Event('input', {bubbles: true}));
    const 뒤표 = P('knn.voteCounts');
    const 합 = 뒤표.A + 뒤표.B + 뒤표.C;
    if (합 !== 11) bad(`화면: k를 11로 바꿨는데 표의 합이 ${합}이다`);
    if (JSON.stringify(뒤표) === 앞표 && 앞표 !== JSON.stringify(뒤표)) bad('화면: k를 바꿔도 표가 그대로다');
    if (doc.getElementById('voteA').innerText !== String(뒤표.A)) bad('화면: k를 바꾼 뒤 표를 다시 적지 않는다');
}

/* ================================================================
   5. 그린 굵은 선이 고른 이웃과 맞물리는가
   ================================================================ */
for (const c of sim.canvases()) c._ctx.ops.length = 0;
P('renderer.draw()');
{
    const 이웃 = P('knn.kNeighbors').map((n) => `${n.point.x},${n.point.y}`).sort();
    const 자취 = sim.canvases().flatMap((c) => c._ctx.ops);
    const 굵은선 = 자취.filter((o) => o.op === 'path' && o.pts.length === 2
        && o.pts[0][0] === 물음.x && o.pts[0][1] === 물음.y
        && ['#f43f5e', '#3b82f6', '#10b981', '#ef4444', '#22c55e'].includes(o.style));
    const 그린이웃 = 굵은선.map((o) => `${o.pts[1][0]},${o.pts[1][1]}`).sort();
    if (그린이웃.join(' ') !== 이웃.join(' ')) {
        bad(`그림: 굵게 이은 이웃 ${그린이웃.length}개가 고른 이웃 ${이웃.length}개와 다르다`);
    }
    // 물음점은 늘 그린다
    if (!자취.some((o) => o.op === 'arc' && o.x === 물음.x && o.y === 물음.y && o.r === 12)) {
        bad('그림: 물음점을 그리지 않았다');
    }
}

/* ================================================================
   6. 무작위 자료가 판 안에 들어오는가
   ================================================================ */
for (const 흩음 of [60, 200, 400]) {
    P(`dataManager.generateRandom(400, 300, ${흩음})`);
    const 뽑힌점 = P('dataManager.points');
    if (뽑힌점.length !== 90) bad(`무작위 자료: 점을 ${뽑힌점.length}개 뽑았다 — 세 반에 서른씩이면 90개다`);
    for (const p of 뽑힌점) {
        if (p.x < 10 || p.x > 390 || p.y < 10 || p.y > 290) {
            bad(`무작위 자료(흩음 ${흩음}): (${Math.round(p.x)},${Math.round(p.y)}) 가 판 밖으로 나갔다`);
            break;
        }
    }
    if (new Set(뽑힌점.map((p) => p.cls)).size !== 3) bad(`무작위 자료: 반이 셋이 아니다`);
    if (P('dataManager.queryPoint')) bad('무작위 자료: 자료를 새로 뽑았는데 앞서 찍은 물음점이 남았다');
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
