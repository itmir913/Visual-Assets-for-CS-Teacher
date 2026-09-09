// 로지스틱 회귀 시뮬레이터가 **경사 하강을 규칙대로 하고, 그린 곡선이 그 모형인지** 본다.
//
// 학습하는 화면은 **틀려도 그럴듯하게 움직인다** — 기울기 부호 하나를 뒤집어도 곡선은
// 여전히 꿈틀거리고 회차는 올라간다. 그래서 여기서는 **한 걸음의 갱신값을 손으로 계산해**
// 맞대어 보고, 여러 걸음 뒤에 **손실이 실제로 줄었는지**까지 본다.
// 그림도 따로 본다 — 셈이 맞아도 곡선을 다른 식으로 그리면 학생이 보는 것은 그림이다.
//
// 보는 것.
//   1. **시그모이드가 정의와 같은가.** 값이 크게 벗어날 때 눌러 두는 것도 함께 본다.
//   2. **한 걸음의 갱신이 교차 엔트로피의 기울기와 같은가.** dw = 평균((σ(z)-y)x), db = 평균(σ(z)-y).
//   3. **여러 걸음 뒤에 손실이 줄고, 갈라지는 자료에서는 다 맞히는가.**
//   4. **화면에 적는 식이 정규화를 되돌린 식인가.** 화면의 x 는 원래 값인데 모형은 0~1 로
//      줄인 값으로 배우므로, 되돌리기를 빠뜨리면 **식만 틀린 채로 그림은 멀쩡하다.**
//   5. **예측이 그 식에서 나온 확률인가.** 0.5 를 기준으로 반을 가르는 것까지.
//   6. **그린 곡선과 결정 경계가 모형과 같은가.**
//   7. **학습률을 크게 잡으면 발산을 알아채는가.**
//
// **못 보는 것.** 색·굵기·글자 자리는 볼 수 없다.

import {loadSim, SIM_ROOT} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/supervised-logistic-regression');
sim.lifecycle();
console.log(`로지스틱 회귀 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

const 시그모이드 = (z) => 1 / (1 + Math.exp(-z));

/* ================================================================
   1. 시그모이드
   ================================================================ */
for (const z of [-30, -5, -1, 0, 0.5, 1, 5, 30]) {
    const 답 = P(`uiController.model.sigmoid(${z})`);
    if (Math.abs(z) > 20) {
        // 크게 벗어난 값은 눌러 둔다 — 0 이나 1 이 되면 로그를 씌울 때 무한대가 나온다
        if (답 <= 0 || 답 >= 1) bad(`시그모이드: z=${z} 에서 ${답} — 0과 1 사이로 눌러 두어야 한다`);
        continue;
    }
    if (Math.abs(답 - 시그모이드(z)) > 1e-12) bad(`시그모이드: z=${z} 에서 ${답} — 정의대로면 ${시그모이드(z)} 다`);
}

/* ================================================================
   자료를 손으로 놓는다
   ================================================================ */
const 점들 = [];
for (let i = 0; i < 20; i++) 점들.push({x: 10 + i * 2, y: 0});
for (let i = 0; i < 20; i++) 점들.push({x: 60 + i * 2, y: 1});
P(`uiController.dataManager.setPoints(${JSON.stringify(점들)})`);
P('uiController.model.init()');
P('uiController.model.hasStarted = true');
P('uiController.model.w = 0.3');
P('uiController.model.b = -0.1');
P('uiController.model.learningRate = 1');

const 경계 = P('uiController.dataManager.getBounds()');
{
    // 자료 폭의 1할씩을 앞뒤에 둔 칸인가
    const minX = Math.min(...점들.map((p) => p.x)), maxX = Math.max(...점들.map((p) => p.x));
    const 여백 = (maxX - minX) * 0.1;
    if (Math.abs(경계.minX - (minX - 여백)) > 1e-9 || Math.abs(경계.maxX - (maxX + 여백)) > 1e-9) {
        bad(`그리는 칸: [${경계.minX}, ${경계.maxX}] — 자료 폭의 1할을 앞뒤에 두면 [${minX - 여백}, ${maxX + 여백}] 이다`);
    }
}
const 줄인값 = 점들.map((p) => ({x: (p.x - 경계.minX) / (경계.maxX - 경계.minX), y: p.y}));

/* ================================================================
   2. 한 걸음의 갱신
   ================================================================ */
{
    const w0 = P('uiController.model.w'), b0 = P('uiController.model.b');
    const lr = P('uiController.model.learningRate');
    let dw = 0, db = 0;
    for (const p of 줄인값) {
        const 오차 = 시그모이드(w0 * p.x + b0) - p.y;
        dw += 오차 * p.x;
        db += 오차;
    }
    dw /= 줄인값.length;
    db /= 줄인값.length;

    P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`);
    const w1 = P('uiController.model.w'), b1 = P('uiController.model.b');
    if (Math.abs(w1 - (w0 - lr * dw)) > 1e-9) bad(`한 걸음: w 가 ${w1} — 기울기대로면 ${w0 - lr * dw} 다`);
    if (Math.abs(b1 - (b0 - lr * db)) > 1e-9) bad(`한 걸음: b 가 ${b1} — 기울기대로면 ${b0 - lr * db} 다`);
    if (P('uiController.model.epoch') !== 1) bad('한 걸음: 회차를 세지 않는다');
}

/* ================================================================
   3. 손실이 줄고 다 맞히는가
   ================================================================ */
const 손실 = (w, b) => 줄인값.reduce((합, p) => {
    const q = Math.min(1 - 1e-12, Math.max(1e-12, 시그모이드(w * p.x + b)));
    return 합 - (p.y * Math.log(q) + (1 - p.y) * Math.log(1 - q));
}, 0) / 줄인값.length;

{
    P('uiController.model.init()');
    P('uiController.model.w = 0.3; uiController.model.b = -0.1');
    P('uiController.model.learningRate = 1');
    let 앞손실 = 손실(P('uiController.model.w'), P('uiController.model.b'));
    for (let 회 = 0; 회 < 300; 회++) {
        P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`);
        const 이번 = 손실(P('uiController.model.w'), P('uiController.model.b'));
        if (이번 > 앞손실 + 1e-9) { bad(`학습: ${회 + 1}회차에서 손실이 ${앞손실.toFixed(6)} → ${이번.toFixed(6)} 로 늘었다`); break; }
        앞손실 = 이번;
    }
    const w = P('uiController.model.w'), b = P('uiController.model.b');
    const 맞힌수 = 줄인값.filter((p) => (시그모이드(w * p.x + b) >= 0.5 ? 1 : 0) === p.y).length;
    if (맞힌수 !== 줄인값.length) bad(`학습: 완전히 갈라지는 자료인데 ${줄인값.length}개 가운데 ${맞힌수}개만 맞힌다`);
    if (P('uiController.model.diverged')) bad('학습: 학습률 1에서 발산했다고 한다');
}

/* ================================================================
   4. 화면에 적는 식이 정규화를 되돌린 것인가
   ================================================================ */
{
    P('uiController.updateUI()');
    const 식 = doc.getElementById('zEquationDisplay').innerText;
    const m = 식.match(/z = (-?[\d.]+)x ([+-]) ([\d.]+)/);
    if (!m) {
        bad(`식: 「${식}」 을 읽을 수 없다`);
    } else {
        const a = Number(m[1]), c = (m[2] === '-' ? -1 : 1) * Number(m[3]);
        const w = P('uiController.model.w'), b = P('uiController.model.b');
        for (const x of [경계.minX, (경계.minX + 경계.maxX) / 2, 경계.maxX]) {
            const nx = (x - 경계.minX) / (경계.maxX - 경계.minX);
            const 모형z = w * nx + b;
            const 식z = a * x + c;
            // 화면에는 소수점 둘째 자리까지 적으므로 그만큼은 어긋날 수 있다
            if (Math.abs(모형z - 식z) > 0.02 * Math.max(1, Math.abs(x))) {
                bad(`식: x=${x.toFixed(1)} 에서 식은 z=${식z.toFixed(3)} 인데 모형은 z=${모형z.toFixed(3)} 다`);
                break;
            }
        }
    }
}

/* ================================================================
   5. 예측
   ================================================================ */
{
    const w = P('uiController.model.w'), b = P('uiController.model.b');
    for (const x of [20, 45, 55, 90]) {
        doc.getElementById('predictInputX').value = String(x);
        P('uiController.executePredict()');
        const nx = (x - 경계.minX) / (경계.maxX - 경계.minX);
        const 기대확률 = P(`uiController.model.sigmoid(${w * nx + b})`);
        const 적힌것 = doc.getElementById('predictResult').textContent;
        const m = 적힌것.match(/확률: ([\d.]+)%/);
        if (!m) { bad(`예측: 「${적힌것}」 에서 확률을 읽을 수 없다`); continue; }
        if (Math.abs(Number(m[1]) / 100 - 기대확률) > 0.001) {
            bad(`예측: x=${x} 에서 ${m[1]}% 라고 적었다 — 모형대로면 ${(기대확률 * 100).toFixed(1)}% 다`);
        }
        const 적힌반 = 적힌것.includes('클래스 1') ? 1 : 0;
        if (적힌반 !== (기대확률 >= 0.5 ? 1 : 0)) {
            bad(`예측: x=${x} 에서 확률 ${(기대확률 * 100).toFixed(1)}% 인데 클래스 ${적힌반} 로 갈랐다`);
        }
    }
}

/* ================================================================
   6. 그린 곡선과 결정 경계
   ================================================================ */
{
    for (const c of sim.canvases()) c._ctx.ops.length = 0;
    P('uiController.renderer.render(uiController.dataManager, uiController.model)');
    const 자취 = sim.canvases().flatMap((c) => c._ctx.ops);
    const 곡선 = 자취.filter((o) => o.op === 'path' && o.style === '#8b5cf6' && o.pts.length > 10);
    if (곡선.length !== 1) {
        bad(`곡선: 시그모이드 곡선을 ${곡선.length}개 그렸다`);
    } else {
        // 그린 점을 되짚어 «그 자리의 확률»이 모형의 확률과 같은지 본다
        const 점 = 곡선[0].pts;
        const 왼끝 = 점[0][0], 오른끝 = 점.at(-1)[0];
        const 위 = Math.min(...점.map((q) => q[1])), 아래 = Math.max(...점.map((q) => q[1]));
        if (오른끝 <= 왼끝) bad('곡선: 왼쪽에서 오른쪽으로 그리지 않았다');
        const w = P('uiController.model.w'), b = P('uiController.model.b');
        // 곡선이 오르는 방향이 기울기 부호와 같아야 한다
        const 오름 = 점.at(-1)[1] < 점[0][1];
        if (오름 !== (w > 0)) bad(`곡선: 기울기 ${w.toFixed(2)} 인데 곡선이 ${오름 ? '오른다' : '내린다'}`);
        if (아래 - 위 < 10) bad('곡선: 세로로 거의 움직이지 않는다 — 확률이 그려지지 않았다');
    }

    const 경계선 = 자취.filter((o) => o.op === 'path' && o.style === '#f59e0b' && o.pts.length === 2);
    if (경계선.length !== 1) {
        bad(`결정 경계: 선을 ${경계선.length}개 그렸다`);
    } else if (곡선.length === 1) {
        // 결정 경계는 확률이 0.5 인 자리다. 곡선에서 세로 한가운데를 지나는 x 와 맞대어 본다
        const 점 = 곡선[0].pts;
        const 위 = Math.min(...점.map((q) => q[1])), 아래 = Math.max(...점.map((q) => q[1]));
        const 한가운데 = (위 + 아래) / 2;
        let 가장가까운 = 점[0];
        for (const q of 점) if (Math.abs(q[1] - 한가운데) < Math.abs(가장가까운[1] - 한가운데)) 가장가까운 = q;
        if (Math.abs(경계선[0].pts[0][0] - 가장가까운[0]) > 4) {
            bad(`결정 경계: 선을 x=${경계선[0].pts[0][0].toFixed(1)} 에 그었다 — 확률 0.5 인 자리는 x=${가장가까운[0]} 근처다`);
        }
    }
}

/* ================================================================
   7. 학습률을 크게 잡으면 「학습률을 낮추세요」라고 말하는가

   **여기가 이 페이지에서 가장 조용히 죽어 있던 자리다.** x 를 0~1 로 줄여 두어 한 걸음이
   학습률만큼만 움직이는데 고르개의 천장이 20이므로, |w| 가 1천만을 넘는 일은 화면의
   조작으로는 일어나지 않았다 — 알림이 뜰 수가 없었다. 지금은 **손실이 오르내리는 것**을
   보고 알아챈다. 그러니 여기서는 「튀는 판에서 알아채는가」와 「멀쩡한 판에서 헛알람이
   울리지 않는가」를 함께 본다.
   ================================================================ */
{
    // 튀는 판 — 두 반이 섞여 있어 큰 걸음이 골짜기를 뛰어넘는다
    const 섞인점 = [];
    for (let i = 0; i < 24; i++) 섞인점.push({x: 10 + i * 4, y: i % 3 === 0 ? 1 : (i % 2)});
    const 섞인줄인값 = 섞인점.map((p) => ({x: (p.x - 10) / 92, y: p.y}));
    P('uiController.model.init()');
    P('uiController.model.hasStarted = true');
    P('uiController.model.w = 0.3; uiController.model.b = -0.1');
    P('uiController.model.learningRate = 20');
    let 알아챘나 = false;
    for (let 회 = 0; 회 < 400; 회++) {
        P(`uiController.model.trainStep(${JSON.stringify(섞인줄인값)})`);
        if (P('uiController.model.diverged')) { 알아챘나 = true; break; }
    }
    if (!알아챘나) bad('발산: 손실이 오르내리는데도 학습률이 크다고 알려 주지 않는다');
    if (!Number.isFinite(P('uiController.model.w'))) bad('발산: 알아채기 전에 w 가 숫자가 아니게 되었다');

    // 멀쩡한 판 — 학습률이 알맞으면 헛알람이 울리면 안 된다
    P('uiController.model.init()');
    P('uiController.model.hasStarted = true');
    P('uiController.model.w = 0.3; uiController.model.b = -0.1');
    P('uiController.model.learningRate = 0.5');
    for (let 회 = 0; 회 < 600; 회++) {
        if (P(`uiController.model.trainStep(${JSON.stringify(줄인값)})`)) break;
    }
    if (P('uiController.model.diverged')) bad('발산: 학습률 0.5 인데 발산했다고 한다 — 헛알람이다');

    // 알아챈 것을 화면이 그대로 말하는가
    P(`uiController.dataManager.setPoints(${JSON.stringify(섞인점)})`);
    P('uiController.model.init()');
    P('uiController.model.hasStarted = true');
    P('uiController.model.w = 0.3; uiController.model.b = -0.1');
    P('uiController.model.learningRate = 20');
    P('uiController.model.isTraining = true');
    for (let 회 = 0; 회 < 200 && P('uiController.model.isTraining'); 회++) P('uiController.loop()');
    if (!P('uiController.model.diverged')) {
        bad('발산: 화면으로 돌렸을 때는 알아채지 못한다');
    } else {
        const 버튼 = doc.getElementById('btnTrain').textContent;
        if (!버튼.includes('학습률')) bad(`발산: 알아챘는데 버튼에 「${버튼.trim()}」 이라고 적었다`);
        if (doc.getElementById('btnTrain').disabled) bad('발산: 학습률을 낮춰 다시 해 볼 수 없게 버튼을 잠갔다');
    }
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
process.exit(fail ? 1 : 0);
