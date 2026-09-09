// 다중 선형 회귀 시뮬레이터가 **최소제곱해에 닿는지, 그리고 그 값을 제대로 되돌리는지** 본다.
//
// 이 화면은 두 변수를 함께 다루므로 **틀려도 그림 둘이 그럴듯하게 나온다** — 한쪽 기울기만
// 어긋나도 점과 선은 여전히 어울려 보인다. 그래서 **정답을 정규방정식으로 따로 푼다.**
// 경사 하강과 아무 상관이 없는 풀이라, 같은 실수를 함께 저지를 수가 없다.
//
// 되돌리기도 따로 본다. 모형은 0~1 로 줄인 값에서 배우는데 화면에는 **원래 단위의 계수**를
// 적는다. 되돌리는 식이 틀리면 **학습은 멀쩡한데 화면의 숫자만 거짓말을 한다** —
// 학생이 「x₁이 1 늘면 y가 얼마 는다」로 읽는 바로 그 숫자다.
//
// 보는 것.
//   1. **한 걸음의 갱신이 평균제곱오차의 기울기와 같은가.** (2/N)·Σ(오차·x).
//   2. **오래 돌리면 최소제곱해에 닿는가.** 정규방정식으로 따로 푼 답과 맞댄다.
//   3. **되돌린 계수가 원래 단위의 회귀식인가.** 화면에 적는 값과 식까지 함께 본다.
//   4. **화면에 적는 평균제곱오차가 실제 오차인가.**
//   5. **부분 그림의 초록 선이 「다른 변수를 평균에 둔」 그 선인가.** 오차 선이 점에서
//      그 선까지 닿는지도 본다 — 여기가 어긋나면 오차가 실제보다 커 보이거나 작아 보인다.
//   6. **학습률을 크게 잡으면 발산을 알아채고, 상한에 걸리면 「완료」라고 하지 않는가.**
//
// **못 보는 것.** 색·굵기와 실제 픽셀은 볼 수 없다.

import {loadSim, SIM_ROOT} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/supervised-multiple-linear-regression');
sim.lifecycle();
console.log(`다중 선형 회귀 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/** 정규방정식을 가우스 소거로 푼다. **경사 하강과 아무 상관이 없는 길이다.** */
function 최소제곱해(점들) {
    // [Σx₁x₁ Σx₁x₂ Σx₁ | Σx₁y] 꼴의 3×4 행렬을 세운다
    const A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (const p of 점들) {
        const v = [p.x1, p.x2, 1];
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) A[i][j] += v[i] * v[j];
            A[i][3] += v[i] * p.y;
        }
    }
    for (let i = 0; i < 3; i++) {
        let 축 = i;
        for (let r = i + 1; r < 3; r++) if (Math.abs(A[r][i]) > Math.abs(A[축][i])) 축 = r;
        [A[i], A[축]] = [A[축], A[i]];
        const 나눔 = A[i][i];
        if (Math.abs(나눔) < 1e-12) return null;
        for (let j = i; j < 4; j++) A[i][j] /= 나눔;
        for (let r = 0; r < 3; r++) {
            if (r === i) continue;
            const 곱 = A[r][i];
            for (let j = i; j < 4; j++) A[r][j] -= 곱 * A[i][j];
        }
    }
    return {w1: A[0][3], w2: A[1][3], b: A[2][3]};
}

/* ================================================================
   자료를 손으로 놓는다 — y 는 두 변수에 함께 기대게 만든다
   ================================================================ */
const 점들 = [];
for (let i = 0; i < 24; i++) {
    const x1 = 10 + (i % 6) * 8;
    const x2 = 2 + Math.floor(i / 6) * 3;
    // 흔들림을 규칙적으로 얹어 완전한 직선이 되지 않게 한다 — 오차가 0이면 볼 것이 없다
    const y = 3.5 * x1 - 2 * x2 + 12 + ((i * 7) % 5) - 2;
    점들.push({x1, x2, y});
}
P(`uiController.dataManager.setPoints(${JSON.stringify(점들)})`);
const 칸 = P('uiController.dataManager.getBounds()');
const 배율 = {
    x1: 칸.maxX1 - 칸.minX1 || 1,
    x2: 칸.maxX2 - 칸.minX2 || 1,
    y: 칸.maxY - 칸.minY || 1,
};
const 줄인값 = 점들.map((p) => ({
    x1: (p.x1 - 칸.minX1) / 배율.x1,
    x2: (p.x2 - 칸.minX2) / 배율.x2,
    y: (p.y - 칸.minY) / 배율.y,
}));

/* ================================================================
   1. 한 걸음의 갱신
   ================================================================ */
{
    P('uiController.model.init()');
    P('uiController.model.w1 = 0.2; uiController.model.w2 = -0.1; uiController.model.b = 0.05');
    P('uiController.model.learningRate = 0.05');
    const w0 = [P('uiController.model.w1'), P('uiController.model.w2'), P('uiController.model.b')];
    const lr = P('uiController.model.learningRate');

    let dw1 = 0, dw2 = 0, db = 0;
    for (const p of 줄인값) {
        const 오차 = w0[0] * p.x1 + w0[1] * p.x2 + w0[2] - p.y;
        dw1 += 오차 * p.x1;
        dw2 += 오차 * p.x2;
        db += 오차;
    }
    const N = 줄인값.length;
    dw1 *= 2 / N;
    dw2 *= 2 / N;
    db *= 2 / N;

    P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`);
    const 기대 = [w0[0] - lr * dw1, w0[1] - lr * dw2, w0[2] - lr * db];
    const 실제 = [P('uiController.model.w1'), P('uiController.model.w2'), P('uiController.model.b')];
    for (const [i, v] of 기대.entries()) {
        if (Math.abs(실제[i] - v) > 1e-12) bad(`한 걸음: ${['w₁', 'w₂', 'b'][i]} 가 ${실제[i]} — 기울기대로면 ${v} 다`);
    }
}

/* ================================================================
   2. 최소제곱해에 닿는가
   ================================================================ */
{
    P('uiController.model.init()');
    P('uiController.model.w1 = 0; uiController.model.w2 = 0; uiController.model.b = 0');
    P('uiController.model.learningRate = 0.3');
    P('uiController.model.epochCap = 200000');
    for (let 회 = 0; 회 < 60000; 회++) {
        if (P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`)) break;
    }
    const 얻은것 = {w1: P('uiController.model.w1'), w2: P('uiController.model.w2'), b: P('uiController.model.b')};
    const 정답 = 최소제곱해(줄인값);
    if (!정답) {
        bad('최소제곱해: 정규방정식을 풀 수 없는 자료다 — 검사의 자료를 고쳐야 한다');
    } else {
        for (const 이름 of ['w1', 'w2', 'b']) {
            if (Math.abs(얻은것[이름] - 정답[이름]) > 0.01) {
                bad(`최소제곱해: ${이름} 이 ${얻은것[이름].toFixed(4)} — 정규방정식으로 푼 답은 ${정답[이름].toFixed(4)} 다`);
            }
        }
    }
    if (P('uiController.model.diverged')) bad('최소제곱해: 학습률 0.3 에서 발산했다고 한다');
}

/* ================================================================
   3 · 4. 되돌린 계수와 화면의 숫자
   ================================================================ */
{
    P('uiController.model.hasStarted = true');
    P(`uiController.cachedBounds = uiController.dataManager.getBounds()`);
    const 되돌린것 = P('uiController._getRealWeights()');
    const w = {w1: P('uiController.model.w1'), w2: P('uiController.model.w2'), b: P('uiController.model.b')};

    // **되돌린 계수는 원래 단위에서 같은 예측을 내야 한다.** 식을 베끼지 않고 그것으로 따진다
    for (const p of 점들.slice(0, 5)) {
        const 줄인예측 = w.w1 * ((p.x1 - 칸.minX1) / 배율.x1) + w.w2 * ((p.x2 - 칸.minX2) / 배율.x2) + w.b;
        const 원래예측 = 칸.minY + 줄인예측 * 배율.y;
        const 되돌린예측 = 되돌린것.w1 * p.x1 + 되돌린것.w2 * p.x2 + 되돌린것.b;
        if (Math.abs(원래예측 - 되돌린예측) > 1e-6 * Math.max(1, Math.abs(원래예측))) {
            bad(`되돌리기: (${p.x1},${p.x2}) 에서 되돌린 식은 ${되돌린예측.toFixed(4)} 인데 모형은 ${원래예측.toFixed(4)} 다`);
            break;
        }
    }

    // 원래 자료의 최소제곱해와도 같아야 한다 — 줄였다 되돌린 것이므로 값이 살아 있어야 한다
    const 원래정답 = 최소제곱해(점들);
    for (const 이름 of ['w1', 'w2', 'b']) {
        if (Math.abs(되돌린것[이름] - 원래정답[이름]) > 0.05 * Math.max(1, Math.abs(원래정답[이름]))) {
            bad(`되돌리기: ${이름} 이 ${되돌린것[이름].toFixed(3)} — 원래 단위의 최소제곱해는 ${원래정답[이름].toFixed(3)} 다`);
        }
    }

    P('uiController.updateUI()');
    const 적힌w1 = Number(doc.getElementById('valW1').innerText);
    const 적힌w2 = Number(doc.getElementById('valW2').innerText);
    const 적힌b = Number(doc.getElementById('valIntercept').innerText);
    if (Math.abs(적힌w1 - 되돌린것.w1) > 0.001) bad(`화면: w₁ 을 ${적힌w1} 로 적었다 — 되돌린 값은 ${되돌린것.w1} 다`);
    if (Math.abs(적힌w2 - 되돌린것.w2) > 0.001) bad(`화면: w₂ 를 ${적힌w2} 로 적었다`);
    if (Math.abs(적힌b - 되돌린것.b) > 0.001) bad(`화면: b 를 ${적힌b} 로 적었다`);

    // 4. 평균제곱오차
    const 실제오차 = 점들.reduce((합, p) =>
        합 + (되돌린것.w1 * p.x1 + 되돌린것.w2 * p.x2 + 되돌린것.b - p.y) ** 2, 0) / 점들.length;
    const 적힌오차 = Number(doc.getElementById('valMSE').innerText);
    if (Math.abs(적힌오차 - 실제오차) > 0.01 * Math.max(1, 실제오차)) {
        bad(`화면: 평균제곱오차를 ${적힌오차} 로 적었다 — 실제로는 ${실제오차.toFixed(3)} 다`);
    }
    // 식도 같은 값이어야 한다
    const 식 = doc.getElementById('equationDisplay').innerText;
    const m = 식.match(/y = (-?[\d.]+)x₁ ([+-]) ([\d.]+)x₂ ([+-]) ([\d.]+)/);
    if (!m) bad(`식: 「${식}」 을 읽을 수 없다`);
    else {
        const 식값 = [Number(m[1]), (m[2] === '-' ? -1 : 1) * Number(m[3]), (m[4] === '-' ? -1 : 1) * Number(m[5])];
        const 실제값 = [되돌린것.w1, 되돌린것.w2, 되돌린것.b];
        for (const [i, v] of 식값.entries()) {
            if (Math.abs(v - 실제값[i]) > 0.005 * Math.max(1, Math.abs(실제값[i]))) {
                bad(`식: ${['w₁', 'w₂', 'b'][i]} 를 ${v} 로 적었다 — 되돌린 값은 ${실제값[i]} 다`);
            }
        }
    }
}

/* ================================================================
   5. 부분 그림의 초록 선과 오차 선
   ================================================================ */
{
    for (const c of sim.canvases()) c._ctx.ops.length = 0;
    P('uiController.updateUI()');
    const 되돌린것 = P('uiController._getRealWeights()');
    const 통계 = P('uiController.dataManager.getStats()');
    const cw = sim.state.box.w, ch = sim.state.box.h;

    const 판 = [
        {키: 'x1', 최소: 칸.minX1, 최대: 칸.maxX1, 다른평균: 통계.meanX2,
            값: (x) => 되돌린것.w1 * x + 되돌린것.w2 * 통계.meanX2 + 되돌린것.b},
        {키: 'x2', 최소: 칸.minX2, 최대: 칸.maxX2, 다른평균: 통계.meanX1,
            값: (x) => 되돌린것.w1 * 통계.meanX1 + 되돌린것.w2 * x + 되돌린것.b},
    ];
    const 화면들 = sim.canvases();
    if (화면들.length < 2) bad(`부분 그림: 캔버스를 ${화면들.length}개만 썼다 — 둘이어야 한다`);

    for (const [i, 그림] of 판.entries()) {
        const 자취 = 화면들[i]?._ctx.ops || [];
        const 초록선 = 자취.filter((o) => o.op === 'path' && o.style === '#10b981' && o.pts.length === 2);
        if (초록선.length !== 1) { bad(`부분 그림 ${그림.키}: 회귀선을 ${초록선.length}개 그렸다`); continue; }

        const mapY = (v) => ch - ((v - 칸.minY) / (칸.maxY - 칸.minY)) * ch;
        const 기대 = [[0, mapY(그림.값(그림.최소))], [cw, mapY(그림.값(그림.최대))]];
        for (const [j, p] of 초록선[0].pts.entries()) {
            if (Math.abs(p[0] - 기대[j][0]) > 0.5 || Math.abs(p[1] - 기대[j][1]) > 0.5) {
                bad(`부분 그림 ${그림.키}: 회귀선 끝이 (${p[0].toFixed(1)},${p[1].toFixed(1)}) — 「다른 변수를 평균에 둔」 선이면 (${기대[j][0].toFixed(1)},${기대[j][1].toFixed(1)}) 다`);
                break;
            }
        }

        // 오차 선은 점에서 그 선까지 세로로 닿아야 한다
        const 오차선 = 자취.filter((o) => o.op === 'path' && o.pts.length === 2
            && Math.abs(o.pts[0][0] - o.pts[1][0]) < 1e-9 && o.style && o.style.startsWith('rgba(225'));
        if (오차선.length !== 점들.length) {
            bad(`부분 그림 ${그림.키}: 오차 선을 ${오차선.length}개 그렸다 — 점은 ${점들.length}개다`);
        } else {
            const mapX = (v) => ((v - 그림.최소) / (그림.최대 - 그림.최소)) * cw;
            for (const 선 of 오차선) {
                const x = 선.pts[0][0];
                const 그점 = 점들.find((p) => Math.abs(mapX(p[그림.키]) - x) < 0.5);
                if (!그점) { bad(`부분 그림 ${그림.키}: 어느 점에도 닿지 않는 오차 선이 있다`); break; }
                const 아래끝 = mapY(그림.값(그점[그림.키]));
                if (Math.abs(선.pts[1][1] - 아래끝) > 0.5) {
                    bad(`부분 그림 ${그림.키}: 오차 선이 회귀선까지 닿지 않는다`);
                    break;
                }
            }
        }
    }
}

/* ================================================================
   6. 발산과 상한
   ================================================================ */
{
    P('uiController.model.init()');
    P('uiController.model.learningRate = 500');
    P('uiController.model.w1 = 0.2; uiController.model.w2 = -0.1; uiController.model.b = 0.05');
    let 알아챘나 = false;
    for (let 회 = 0; 회 < 500; 회++) {
        P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`);
        if (P('uiController.model.diverged')) { 알아챘나 = true; break; }
    }
    if (!알아챘나) bad('발산: 학습률 500 에서도 발산을 알아채지 못한다');

    // 상한에 걸린 것을 「완료」라고 하지 않는가
    P('uiController.model.init()');
    P('uiController.model.learningRate = 1e-6');   // 아주 느리게 — 상한에 걸리게 한다
    P('uiController.model.epochCap = 30');
    for (let 회 = 0; 회 < 100; 회++) {
        if (P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`)) break;
    }
    if (!P('uiController.model.hitEpochCap')) bad('상한: 회차 상한에 걸렸는데 그렇게 적어 두지 않는다');
    if (P('uiController.model.diverged')) bad('상한: 상한에 걸린 것을 발산으로 적었다');
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
