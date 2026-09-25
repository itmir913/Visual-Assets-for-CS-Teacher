// SVM 시뮬레이터가 **가장 넓은 여백을 찾는지** 본다.
//
// 이 화면의 요점은 「선을 하나 긋는다」가 아니라 **「두 반에서 가장 멀리 떨어진 선을 긋는다」**
// 이다. 그런데 어떤 선을 그어도 그림은 그럴듯하므로, 여백이 최대인지는 눈으로 갈리지 않는다.
// 그래서 **여백의 정답을 기하로 따로 구한다** — 갈라지는 자료에서 가장 넓은 여백은
// **두 반의 볼록 껍질 사이 거리의 절반**이다. 이것은 페이지가 쓰는 방법(Pegasos 경사 하강)과
// 아무 상관이 없는 계산이라, 같은 실수를 함께 저지를 수가 없다.
//
// 보는 것.
//   1. **한 걸음의 갱신이 Pegasos 규칙과 같은가** — 여백을 침범한 점에만 밀어 주고,
//      나머지는 줄이기만 하며, 넘치면 공 안으로 되돌린다.
//   2. **학습한 뒤 두 반을 다 맞히는가.**
//   3. **얻은 여백이 기하로 구한 최대 여백에 닿는가.**
//   4. **서포트 벡터가 여백 위이거나 안쪽인 점들인가.**
//   5. **규제가 정한 크기 상한을 넘지 않는가** — Pegasos 는 ‖(w,b)‖ ≤ 1/√λ 을 지켜야 한다.
//   6. **그린 선과 여백 점선이 실제로 w·x + b = 0 과 ±1 인가.** 여기가 어긋나면
//      **셈은 맞는데 학생이 보는 여백만 다르다.**
//   7. **화면에 적는 식이 w 와 b 그대로인가.**
//
// **못 보는 것.** 색과 두께, 칠한 넓이는 볼 수 없다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/supervised-svm');
sim.lifecycle();
console.log(`SVM (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

/** 씨앗을 주면 같은 순서로 섞이는 난수. 학습이 재현되어야 결함을 좇을 수 있다. */
function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/* ================================================================
   1. 한 걸음의 갱신
   ================================================================ */
{
    const 판 = [
        {w: [0.2, -0.3], b: 0.1, p: {x1: 0.4, x2: 0.5, y: 1}, eta: 0.5, lambda: 0.1},
        {w: [1.5, 0.4], b: -0.2, p: {x1: -0.6, x2: 0.2, y: -1}, eta: 0.2, lambda: 0.05},
        {w: [3.0, 3.0], b: 2.0, p: {x1: 0.1, x2: 0.1, y: 1}, eta: 0.9, lambda: 0.2},
    ];
    for (const [i, t] of 판.entries()) {
        P(`svm.w = [${t.w[0]}, ${t.w[1]}]; svm.b = ${t.b}`);
        P(`svm.stepOnce(${JSON.stringify(t.p)}, ${t.eta}, ${t.lambda})`);

        // **규칙대로 여기서 다시 계산한다**
        const 줄임 = 1 - t.eta * t.lambda;
        const 여백 = t.p.y * (t.w[0] * t.p.x1 + t.w[1] * t.p.x2 + t.b);
        let w0, w1, b;
        if (여백 < 1) {
            w0 = 줄임 * t.w[0] + t.eta * t.p.y * t.p.x1;
            w1 = 줄임 * t.w[1] + t.eta * t.p.y * t.p.x2;
            b = 줄임 * t.b + t.eta * t.p.y;
        } else {
            w0 = 줄임 * t.w[0];
            w1 = 줄임 * t.w[1];
            b = 줄임 * t.b;
        }
        const 크기 = Math.sqrt(w0 * w0 + w1 * w1 + b * b);
        const 상한 = 1 / Math.sqrt(t.lambda);
        if (크기 > 상한) {
            w0 *= 상한 / 크기;
            w1 *= 상한 / 크기;
            b *= 상한 / 크기;
        }
        const 실제 = [P('svm.w[0]'), P('svm.w[1]'), P('svm.b')];
        for (const [j, 값] of [w0, w1, b].entries()) {
            if (Math.abs(실제[j] - 값) > 1e-12) {
                bad(`한 걸음 ${i + 1}: ${['w₁', 'w₂', 'b'][j]} 가 ${실제[j]} — 규칙대로면 ${값} 다`);
            }
        }
    }
}

/* ================================================================
   여백의 정답 — 두 반의 볼록 껍질 사이 거리의 절반
   ================================================================ */
const 볼록껍질 = (점들) => {
    const pts = [...점들].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    if (pts.length < 3) return pts;
    const 왼쪽으로 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const 아래 = [], 위 = [];
    for (const p of pts) {
        while (아래.length >= 2 && 왼쪽으로(아래.at(-2), 아래.at(-1), p) <= 0) 아래.pop();
        아래.push(p);
    }
    for (const p of [...pts].reverse()) {
        while (위.length >= 2 && 왼쪽으로(위.at(-2), 위.at(-1), p) <= 0) 위.pop();
        위.push(p);
    }
    아래.pop();
    위.pop();
    return [...아래, ...위];
};
const 점선분거리 = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const 길이제곱 = dx * dx + dy * dy;
    const t = 길이제곱 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / 길이제곱));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
};
/** 볼록 껍질 둘 사이의 가장 가까운 거리. 갈라지는 자료에서만 뜻이 있다. */
function 껍질사이거리(A, B) {
    const ha = 볼록껍질(A), hb = 볼록껍질(B);
    let 가장가까움 = Infinity;
    const 변 = (h) => h.length < 2 ? [[h[0], h[0]]] : h.map((p, i) => [p, h[(i + 1) % h.length]]);
    for (const [a1, a2] of 변(ha)) {
        for (const [b1, b2] of 변(hb)) {
            가장가까움 = Math.min(가장가까움,
                점선분거리(a1, b1, b2), 점선분거리(a2, b1, b2),
                점선분거리(b1, a1, a2), 점선분거리(b2, a1, a2));
        }
    }
    return 가장가까움;
}

/* ================================================================
   2 · 3 · 4 · 5. 학습한 결과
   ================================================================ */
const 자료벌 = [
    {
        이름: '가로로 갈라진 자료',
        A: [[-0.7, 0.5], [-0.4, 0.7], [-0.6, 0.2], [-0.8, 0.6], [-0.5, 0.4]],
        B: [[0.5, -0.4], [0.7, -0.6], [0.4, -0.2], [0.6, -0.7], [0.8, -0.5]],
    },
    {
        이름: '세로로 갈라진 자료',
        A: [[-0.2, 0.6], [0.1, 0.8], [0.3, 0.7], [-0.4, 0.9], [0.0, 0.65]],
        B: [[-0.2, -0.6], [0.1, -0.8], [0.3, -0.7], [-0.4, -0.9], [0.0, -0.65]],
    },
    {
        이름: '비스듬히 갈라진 자료',
        A: [[-0.8, 0.1], [-0.5, 0.5], [-0.9, 0.4], [-0.6, 0.8], [-0.3, 0.9]],
        B: [[0.3, -0.9], [0.6, -0.5], [0.9, -0.3], [0.5, -0.8], [0.8, -0.6]],
    },
];

for (const 벌 of 자료벌) {
    const 점들 = [
        ...벌.A.map(([x, y]) => ({nx: x, ny: y, cls: 1})),
        ...벌.B.map(([x, y]) => ({nx: x, ny: y, cls: -1})),
    ];
    sim.window.Math.random = mulberry32(20260909);
    const C = 100;
    P(`svm.trainInstant(${JSON.stringify(점들)}, ${C})`);
    const w = [P('svm.w[0]'), P('svm.w[1]')], b = P('svm.b');

    // 2. 다 맞히는가
    const 틀린점 = 점들.filter((p) => p.cls * (w[0] * p.nx + w[1] * p.ny + b) <= 0);
    if (틀린점.length) bad(`${벌.이름}: 갈라지는 자료인데 ${틀린점.length}개를 틀리게 가른다`);

    // 3. 여백이 기하로 구한 최대에 닿는가
    const 얻은여백 = 1 / Math.hypot(w[0], w[1]);
    const 최대여백 = 껍질사이거리(벌.A, 벌.B) / 2;
    const 비율 = 얻은여백 / 최대여백;
    if (비율 < 0.85 || 비율 > 1.15) {
        bad(`${벌.이름}: 여백이 ${얻은여백.toFixed(3)} — 기하로 구한 최대 여백은 ${최대여백.toFixed(3)} 다 (${(비율 * 100).toFixed(0)}%)`);
    }

    // 4. 서포트 벡터
    const 기대SV = 점들.filter((p) => p.cls * (w[0] * p.nx + w[1] * p.ny + b) <= 1.05)
        .map((p) => `${p.nx},${p.ny}`).sort();
    const 실제SV = P('svm.supportVectors').map((p) => `${p.nx},${p.ny}`).sort();
    if (기대SV.join(' ') !== 실제SV.join(' ')) {
        bad(`${벌.이름}: 서포트 벡터를 ${실제SV.length}개 짚었다 — 여백 안쪽인 점은 ${기대SV.length}개다`);
    }
    if (!실제SV.length) bad(`${벌.이름}: 서포트 벡터가 하나도 없다 — 여백을 떠받치는 점이 보이지 않는다`);

    // 5. 규제가 정한 크기 상한
    const lambda = 1 / (C * 점들.length);
    const 크기 = Math.hypot(w[0], w[1], b);
    if (크기 > 1 / Math.sqrt(lambda) + 1e-9) {
        bad(`${벌.이름}: ‖(w,b)‖ 가 ${크기.toFixed(2)} — Pegasos 의 상한은 ${(1 / Math.sqrt(lambda)).toFixed(2)} 다`);
    }
}

// C 를 낮추면 규제가 세져 크기가 줄어야 한다
{
    const 벌 = 자료벌[0];
    const 점들 = [
        ...벌.A.map(([x, y]) => ({nx: x, ny: y, cls: 1})),
        ...벌.B.map(([x, y]) => ({nx: x, ny: y, cls: -1})),
    ];
    const 크기 = [];
    for (const C of [0.01, 1, 100]) {
        sim.window.Math.random = mulberry32(777);
        P(`svm.trainInstant(${JSON.stringify(점들)}, ${C})`);
        크기.push(Math.hypot(P('svm.w[0]'), P('svm.w[1]')));
    }
    if (!(크기[0] < 크기[1] && 크기[1] <= 크기[2] + 1e-9)) {
        bad(`벌점 C: C를 올려도 ‖w‖ 가 커지지 않는다 (${크기.map((v) => v.toFixed(2)).join(' → ')})`);
    }
}

/* ================================================================
   6. 그린 선과 여백 점선
   ================================================================ */
{
    const 벌 = 자료벌[2];
    const 점들 = [
        ...벌.A.map(([x, y]) => ({nx: x, ny: y, cls: 1})),
        ...벌.B.map(([x, y]) => ({nx: x, ny: y, cls: -1})),
    ];
    sim.window.Math.random = mulberry32(31337);
    P(`dataManager.points = ${JSON.stringify(점들)}`);
    P(`svm.trainInstant(${JSON.stringify(점들)}, 100)`);
    for (const c of sim.canvases()) c._ctx.ops.length = 0;
    P("renderer.draw('DONE')");

    const w = [P('svm.w[0]'), P('svm.w[1]')], b = P('svm.b');
    const cw = sim.state.box.w, ch = sim.state.box.h;
    const 되돌리기 = ([px, py]) => [px / (cw / 2) - 1, 1 - py / (ch / 2)];
    const 자취 = sim.canvases().flatMap((c) => c._ctx.ops);
    const 선들 = 자취.filter((o) => o.op === 'path' && o.pts.length === 2 && o.style);

    /** 그 선 위의 두 점을 원래 좌표로 되돌려 w·x + b 를 구한다. 같은 값이 나와야 한다. */
    const 선의값 = (o) => o.pts.map((p) => {
        const [nx, ny] = 되돌리기(p);
        return w[0] * nx + w[1] * ny + b;
    });

    const 값들 = 선들.map(선의값).filter(([a, c2]) => Math.abs(a - c2) < 0.02).map(([a]) => a);
    const 흔들림 = 선들.map(선의값).filter(([a, c2]) => Math.abs(a - c2) >= 0.02);
    if (흔들림.length) bad(`그림: 한 직선 위에 있지 않은 선이 ${흔들림.length}개다`);

    for (const 있어야할값 of [0, 1, -1]) {
        if (!값들.some((v) => Math.abs(v - 있어야할값) < 0.02)) {
            bad(`그림: w·x + b = ${있어야할값} 인 선을 그리지 않았다 (그린 선들의 값 ${값들.map((v) => v.toFixed(2)).join(', ')})`);
        }
    }

    // 서포트 벡터를 동그라미로 짚는가
    const 짚은동그라미 = 자취.filter((o) => o.op === 'arc' && o.r === 14).length;
    if (짚은동그라미 !== P('svm.supportVectors').length) {
        bad(`그림: 서포트 벡터 ${P('svm.supportVectors').length}개 가운데 ${짚은동그라미}개만 짚었다`);
    }
}

/* ================================================================
   7. 화면에 적는 식
   ================================================================ */
{
    P('updateEquationText()');
    const 식 = doc.getElementById('equationDisplay').innerText;
    const m = 식.match(/(-?[\d.]+)x₁ ([+-]) ([\d.]+)x₂ ([+-]) ([\d.]+) = 0/);
    if (!m) {
        bad(`식: 「${식}」 을 읽을 수 없다`);
    } else {
        const 적힌값 = [Number(m[1]), (m[2] === '-' ? -1 : 1) * Number(m[3]), (m[4] === '-' ? -1 : 1) * Number(m[5])];
        const 실제값 = [P('svm.w[0]'), P('svm.w[1]'), P('svm.b')];
        for (const [i, v] of 적힌값.entries()) {
            if (Math.abs(v - 실제값[i]) > 0.005) {
                bad(`식: ${['w₁', 'w₂', 'b'][i]} 를 ${v} 로 적었다 — 실제로는 ${실제값[i]} 다`);
            }
        }
    }
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('svm', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
