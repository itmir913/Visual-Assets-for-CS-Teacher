// 결정 트리 시뮬레이터가 **불순도가 가장 낮은 자리에서 나누는지** 본다.
//
// 결정 트리는 그림이 그럴듯해서 **틀려도 틀린 티가 나지 않는다** — 아무 자리에서나 나누어도
// 트리 모양은 나오고 경계선도 그어진다. 그래서 여기서는 마디마다 **나눌 수 있는 모든 자리를
// 이 검사가 직접 세어** 가장 낮은 가중 불순도를 구하고, 페이지가 고른 자리가 그 값인지 본다.
// **어느 자리를 골랐는지가 아니라 「그보다 나은 자리가 없는지」를 따지므로**, 같은 값이 여럿일 때
// 어느 것을 고르든 통과한다 — 동점 처리 방식을 검사에 베껴 적으면 그 순간 검사가 헛돈다.
//
// 보는 것.
//   1. **지니 불순도 계산이 정의와 같다.**
//   2. **범주형 트리**: 마디마다 고른 나눔이 가중 불순도를 가장 낮게 하는 나눔인가,
//      더 나눌 것이 남았는데 잎으로 끝내지 않는가, 잎의 답이 그 잎에 온 데이터의 다수인가.
//   3. **2차원 트리**: 같은 것을 이어지는 값에서 본다. 깊이와 잎 최소 개수 제한을 지키는가,
//      나눈 자리가 이웃한 두 값의 한가운데인가.
//   4. **경계선 그리기**: 그린 선이 트리의 나눔과 하나씩 맞물리고, 선이 제 칸 안에서만 그어지는가.
//      여기가 어긋나면 **트리는 맞는데 그림만 틀린다** — 학생이 보는 것은 그림이다.
//
//   5. **2차원 칠**: 받침대의 가짜 캔버스는 `fillRect` 를 적어 두지 않으므로 페이지의 ctx 에
//      기록기를 끼워, 판 위 격자의 색이 트리를 따라 내려가 얻은 답의 색인지 본다.
//   6. **경계값**: 점 하나, 같은 자리에 반이 다른 점들에서 죽지 않고 잎 하나가 된다.
//   7. **범주형 예측**: 처음 자료의 과일은 특징 조합이 모두 달라, 제 특징을 넣으면 제 이름이 나와야 한다.
//
// **못 보는 것.** 실제 픽셀과 트리 그림(SVG)의 배치는 볼 수 없다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/supervised-decision-tree');
sim.lifecycle();
console.log(`결정 트리 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/** 지니 불순도 — 1 에서 각 반의 비율의 제곱을 뺀 값. */
function 지니(값들) {
    if (!값들.length) return 0;
    const 셈 = {};
    for (const v of 값들) 셈[v] = (셈[v] || 0) + 1;
    return 1 - Object.values(셈).reduce((a, c) => a + (c / 값들.length) ** 2, 0);
}
const 다수 = (값들) => {
    const 셈 = {};
    for (const v of 값들) 셈[v] = (셈[v] || 0) + 1;
    return Math.max(...Object.values(셈));
};

/* ================================================================
   1. 지니 계산
   ================================================================ */
const 지니거리 = [
    [{name: 'A'}, {name: 'A'}, {name: 'A'}],
    [{name: 'A'}, {name: 'B'}],
    [{name: 'A'}, {name: 'A'}, {name: 'B'}, {name: 'C'}],
    [],
];
for (const 자료 of 지니거리) {
    const 답 = P(`calcGiniCat(${JSON.stringify(자료)})`);
    const 기대 = 지니(자료.map((d) => d.name));
    if (Math.abs(답 - 기대) > 1e-12) bad(`지니: ${JSON.stringify(자료.map((d) => d.name))} 에서 ${답} — 정의대로면 ${기대}`);
}

/* ================================================================
   2. 범주형 트리
   ================================================================ */
const 특징들 = ['color', 'size', 'shape'];

/** 마디 하나를 따진다. `자료` 는 이 마디에 온 데이터, `쓴특징` 은 위에서 이미 물어본 것. */
function 범주형마디검사(마디, 자료, 쓴특징, 깊이, 어디) {
    if (!마디) { bad(`범주형 ${어디}: 마디가 비었다`); return; }
    const 반들 = 자료.map((d) => d.name);

    // 나눌 수 있는 모든 자리를 세어 **가장 낮은 가중 불순도**를 구한다
    let 가장낮은 = Infinity;
    for (const f of 특징들) {
        if (쓴특징.includes(f)) continue;
        for (const v of new Set(자료.map((d) => d[f]))) {
            const 왼 = 자료.filter((d) => d[f] === v);
            const 오 = 자료.filter((d) => d[f] !== v);
            const w = (왼.length / 자료.length) * 지니(왼.map((d) => d.name))
                + (오.length / 자료.length) * 지니(오.map((d) => d.name));
            if (w < 가장낮은) 가장낮은 = w;
        }
    }
    const 나눌수있음 = 가장낮은 < Infinity && 지니(반들) - 가장낮은 > 1e-9;
    const 멈춰야함 = new Set(반들).size === 1 || 쓴특징.length === 특징들.length || 깊이 >= 5 || !나눌수있음;

    if (마디.isLeaf) {
        if (!멈춰야함) bad(`범주형 ${어디}: 더 나눌 수 있는데 잎으로 끝냈다 (가중 불순도 ${가장낮은.toFixed(4)} 로 낮출 수 있다)`);
        if (반들.filter((n) => n === 마디.result).length !== 다수(반들)) {
            bad(`범주형 ${어디}: 잎의 답 「${마디.result}」 이 이 잎에 온 데이터의 다수가 아니다`);
        }
        if (마디.size !== 자료.length) bad(`범주형 ${어디}: 잎이 든 개수를 ${마디.size} 로 적었다 — 실제로는 ${자료.length}개다`);
        return;
    }

    if (멈춰야함) bad(`범주형 ${어디}: 더 나눌 것이 없는데 나누었다`);
    const 왼 = 자료.filter((d) => d[마디.feature] === 마디.value);
    const 오 = 자료.filter((d) => d[마디.feature] !== 마디.value);
    const w = (왼.length / 자료.length) * 지니(왼.map((d) => d.name))
        + (오.length / 자료.length) * 지니(오.map((d) => d.name));
    if (w > 가장낮은 + 1e-9) {
        bad(`범주형 ${어디}: ${마디.feature}=${마디.value} 로 나누어 불순도 ${w.toFixed(4)} — ${가장낮은.toFixed(4)} 로 낮추는 나눔이 있다`);
    }
    if (Math.abs(마디.gini - w) > 1e-9) {
        bad(`범주형 ${어디}: 화면에 적는 불순도 ${마디.gini} 가 실제 ${w} 와 다르다`);
    }
    // **「예」 쪽만 그 특징을 다 쓴 것으로 친다** — 「아니오」 쪽에는 남은 값이 여럿이라 다시 물을 수 있다
    범주형마디검사(마디.left, 왼, [...쓴특징, 마디.feature], 깊이 + 1, 어디 + '/예');
    범주형마디검사(마디.right, 오, [...쓴특징], 깊이 + 1, 어디 + '/아니오');
}

// 처음 자료와, 손으로 지어낸 자료 몇 벌
const 색 = ['빨강', '노랑', '초록'], 크기 = ['큼', '작음'], 모양 = ['둥근', '길쭉'];
const 자료벌 = [null];                     // null 이면 페이지가 처음에 넣어 둔 자료를 쓴다
for (let 벌 = 0; 벌 < 6; 벌++) {
    const 자료 = [];
    for (let i = 0; i < 10 + 벌; i++) {
        const c = 색[(i * 3 + 벌) % 3], s = 크기[(i + 벌) % 2], sh = 모양[(i * 2 + 벌) % 2];
        // 이름은 특징에서 규칙적으로 만든다 — 나눌 자리가 실제로 생기게 하려는 것이다
        const name = (c === '빨강' ? '사과' : s === '큼' ? '수박' : '포도');
        자료.push({id: i + 1, color: c, size: s, shape: sh, name});
    }
    자료벌.push(자료);
}

for (const [i, 자료] of 자료벌.entries()) {
    if (자료) P(`datasetCat = ${JSON.stringify(자료)}`);
    P('runCatTraining()');
    const 쓴자료 = P('datasetCat');
    const 트리 = P('treeCat');
    범주형마디검사(트리, 쓴자료, [], 0, `자료${i}`);
}

/* ================================================================
   3. 2차원 트리
   ================================================================ */
function 이차원마디검사(마디, 점들, 깊이, 최대깊이, 최소잎, 어디) {
    if (!마디) { bad(`2차원 ${어디}: 마디가 비었다`); return; }
    const 반들 = 점들.map((p) => p.cls);

    let 가장낮은 = Infinity;
    const 자를수있는값 = [];
    for (const f of ['x', 'y']) {
        const 정렬 = [...점들].sort((a, b) => a[f] - b[f]);
        for (let i = 0; i < 정렬.length - 1; i++) {
            const v = (정렬[i][f] + 정렬[i + 1][f]) / 2;
            const 왼 = 점들.filter((p) => p[f] <= v);
            const 오 = 점들.filter((p) => p[f] > v);
            if (!왼.length || !오.length) continue;
            if (왼.length < 최소잎 || 오.length < 최소잎) continue;
            자를수있는값.push(`${f}@${v}`);
            const w = (왼.length / 점들.length) * 지니(왼.map((p) => p.cls))
                + (오.length / 점들.length) * 지니(오.map((p) => p.cls));
            if (w < 가장낮은) 가장낮은 = w;
        }
    }
    const 멈춰야함 = 깊이 >= 최대깊이 || 점들.length <= 최소잎 || 지니(반들) === 0 || !자를수있는값.length;

    if (마디.isLeaf) {
        if (!멈춰야함) bad(`2차원 ${어디}: 더 나눌 수 있는데 잎으로 끝냈다`);
        if (반들.filter((c) => c === 마디.cls).length !== 다수(반들)) {
            bad(`2차원 ${어디}: 잎의 반이 이 잎에 온 점들의 다수가 아니다`);
        }
        return;
    }

    if (멈춰야함) bad(`2차원 ${어디}: 깊이 ${깊이}·점 ${점들.length}개인데 더 나누었다 (최대 깊이 ${최대깊이}·잎 최소 ${최소잎})`);
    if (!자를수있는값.includes(`${마디.feature}@${마디.value}`)) {
        bad(`2차원 ${어디}: ${마디.feature}=${마디.value} 는 이웃한 두 값의 한가운데가 아니거나 잎 최소 개수를 어긴다`);
    }
    const 왼 = 점들.filter((p) => p[마디.feature] <= 마디.value);
    const 오 = 점들.filter((p) => p[마디.feature] > 마디.value);
    const w = (왼.length / 점들.length) * 지니(왼.map((p) => p.cls))
        + (오.length / 점들.length) * 지니(오.map((p) => p.cls));
    if (w > 가장낮은 + 1e-9) {
        bad(`2차원 ${어디}: 불순도 ${w.toFixed(4)} 로 나누었다 — ${가장낮은.toFixed(4)} 로 낮추는 나눔이 있다`);
    }
    이차원마디검사(마디.left, 왼, 깊이 + 1, 최대깊이, 최소잎, 어디 + '/예');
    이차원마디검사(마디.right, 오, 깊이 + 1, 최대깊이, 최소잎, 어디 + '/아니오');
}

/** 자리를 정해 두고 흔드는 난수 — 같은 점이 나와야 결함을 좇을 수 있다. */
let 씨 = 12345;
const 흔들기 = () => (씨 = (씨 * 1103515245 + 12345) % 2147483648) / 2147483648;

for (const [최대깊이, 최소잎] of [[3, 1], [5, 2], [2, 5], [6, 3]]) {
    const 점들 = [];
    for (let i = 0; i < 45; i++) {
        점들.push({x: Math.round(흔들기() * 380 + 10), y: Math.round(흔들기() * 380 + 10), cls: Math.floor(흔들기() * 3) + 1});
    }
    P(`points2D = ${JSON.stringify(점들)}`);
    doc.getElementById('paramDepth2D').value = String(최대깊이);
    doc.getElementById('paramMinLeaf2D').value = String(최소잎);
    P('run2DTraining()');
    이차원마디검사(P('tree2D'), P('points2D'), 0, 최대깊이, 최소잎, `깊이${최대깊이}잎${최소잎}`);

    /* ============================================================
       4. 그린 경계선이 트리의 나눔과 맞물리는가
       ============================================================ */
    const 그린선 = sim.canvases()
        .flatMap((c) => c._ctx.ops)
        .filter((o) => o.op === 'path' && o.pts.length === 2 && o.style === '#475569')
        .map((o) => o.pts);
    // 트리를 훑어 **있어야 할 선**을 구한다. 선은 제 칸 안에서만 그어져야 한다.
    const 있어야할선 = [];
    (function 훑기(마디, x0, x1, y0, y1) {
        if (!마디 || 마디.isLeaf) return;
        if (마디.feature === 'x') {
            있어야할선.push([[마디.value, y0], [마디.value, y1]]);
            훑기(마디.left, x0, 마디.value, y0, y1);
            훑기(마디.right, 마디.value, x1, y0, y1);
        } else {
            있어야할선.push([[x0, 마디.value], [x1, 마디.value]]);
            훑기(마디.left, x0, x1, y0, 마디.value);
            훑기(마디.right, x0, x1, 마디.value, y1);
        }
    })(P('tree2D'), 0, 400, 0, 400);

    const 적기 = (선) => 선.map((p) => p.map((n) => Math.round(n * 100) / 100).join(',')).join(' → ');
    const 그린것 = new Set(그린선.map(적기));
    for (const 선 of 있어야할선) {
        if (!그린것.has(적기(선))) bad(`경계선(깊이${최대깊이}잎${최소잎}): ${적기(선)} 이 그려지지 않았거나 칸 밖으로 그어졌다`);
    }
    if (그린선.length !== 있어야할선.length) {
        bad(`경계선(깊이${최대깊이}잎${최소잎}): 선을 ${그린선.length}개 그렸다 — 나눔은 ${있어야할선.length}개다`);
    }

    // 찍은 점이 다 그려졌는가
    const 그린점 = sim.canvases().flatMap((c) => c._ctx.ops).filter((o) => o.op === 'arc' && o.r === 6);
    if (그린점.length !== 점들.length) bad(`점 그리기(깊이${최대깊이}잎${최소잎}): 점 ${점들.length}개 가운데 ${그린점.length}개만 그렸다`);
    for (const c of sim.canvases()) c._ctx.ops.length = 0;
}

/* ================================================================
   5. 2차원 칠 — 판의 어느 자리든 칠한 색이 트리가 내린 답의 색인가
   ================================================================ */
// 받침대는 fillRect 를 적지 않으므로 페이지의 ctx 에 기록기를 끼운다
P(`globalThis.__칠 = []; ctx.fillRect = (x, y, w, h) => __칠.push({x, y, w, h, style: ctx.fillStyle});`);
const 옅은색 = {1: 'rgba(239, 68, 68, 0.2)', 2: 'rgba(59, 130, 246, 0.2)', 3: 'rgba(16, 185, 129, 0.2)'};
for (const [최대깊이, 최소잎] of [[4, 1], [2, 3], [15, 1]]) {
    const 점들 = [];
    for (let i = 0; i < 30; i++) {
        점들.push({x: Math.round(흔들기() * 380 + 10), y: Math.round(흔들기() * 380 + 10), cls: Math.floor(흔들기() * 3) + 1});
    }
    P(`points2D = ${JSON.stringify(점들)}`);
    doc.getElementById('paramDepth2D').value = String(최대깊이);
    doc.getElementById('paramMinLeaf2D').value = String(최소잎);
    P('__칠.length = 0');
    P('run2DTraining()');
    const 트리 = P('tree2D');
    const 칠 = P('__칠').filter((r) => Object.values(옅은색).includes(r.style));
    const 잎수 = (function 세기(n) { return n.isLeaf ? 1 : 세기(n.left) + 세기(n.right); })(트리);
    if (칠.length !== 잎수) bad(`칠(깊이${최대깊이}잎${최소잎}): 칸을 ${칠.length}개 칠했다 — 잎은 ${잎수}개다`);
    const 넓이 = 칠.reduce((a, r) => a + r.w * r.h, 0);
    if (Math.abs(넓이 - 400 * 400) > 1e-6) bad(`칠(깊이${최대깊이}잎${최소잎}): 칠한 넓이 합이 ${넓이} — 판 전체 160000 이어야 한다`);
    let 어긋남 = 0;
    for (let gx = 3.7; gx < 400; gx += 13) {
        for (let gy = 5.3; gy < 400; gy += 13) {
            let n = 트리;
            while (!n.isLeaf) n = (n.feature === 'x' ? gx : gy) <= n.value ? n.left : n.right;
            const 칸 = 칠.find((r) => gx >= r.x && gx < r.x + r.w && gy >= r.y && gy < r.y + r.h);
            if (!칸 || 칸.style !== 옅은색[n.cls]) 어긋남++;
        }
    }
    if (어긋남) bad(`칠(깊이${최대깊이}잎${최소잎}): 판 위 ${어긋남}곳의 색이 트리가 내린 답과 다르다`);
}

/* ================================================================
   6. 2차원 경계값 — 점 하나, 같은 자리에 반이 다른 점들
   ================================================================ */
{
    doc.getElementById('paramDepth2D').value = '5';
    doc.getElementById('paramMinLeaf2D').value = '1';
    for (const [이름, 점들, 답] of [
        ['점 하나', [{x: 100, y: 100, cls: 2}], 2],
        ['같은 자리에 반 둘', [{x: 50, y: 50, cls: 1}, {x: 50, y: 50, cls: 3}, {x: 50, y: 50, cls: 3}], 3],
    ]) {
        P(`points2D = ${JSON.stringify(점들)}`);
        const 앞오류 = sim.errors.length;
        P('run2DTraining()');
        const 트리 = P('tree2D');
        if (sim.errors.length > 앞오류 || !트리) { bad(`2차원 ${이름}: 학습하다 죽었다`); continue; }
        if (!트리.isLeaf || 트리.cls !== 답) bad(`2차원 ${이름}: 잎 하나(${답})여야 하는데 ${JSON.stringify(트리)} 다`);
    }
}

/* ================================================================
   7. 범주형 예측 — 처음 자료의 과일은 특징 조합이 모두 달라, 제 특징을 넣으면 제 이름이 나와야 한다
   ================================================================ */
{
    P('initCatData()');
    P('runCatTraining()');
    // 기다리는 1초를 없앤다 — 트리를 따라 내려가는 순서는 그대로다
    const 원래 = sim.window.setTimeout;
    sim.window.setTimeout = (f) => { f(); return 0; };
    for (const 과일 of P('datasetCat')) {
        doc.getElementById('testColor').value = 과일.color;
        doc.getElementById('testSize').value = 과일.size;
        doc.getElementById('testShape').value = 과일.shape;
        await P('runCatPrediction()');
        const 적힌것 = doc.getElementById('predResult').innerHTML;
        if (!적힌것.includes(`<b>${과일.name}</b>`)) bad(`범주형 예측: ${과일.color}·${과일.size}·${과일.shape} 를 「${적힌것}」 로 분류했다 — ${과일.name} 이어야 한다`);
    }
    sim.window.setTimeout = 원래;
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('decision-tree', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
