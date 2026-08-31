/* 「손으로 맞추기」·「오차 곡선」 두 절이 **실제로 최소제곱을 보이는가.**
 *
 * 화면 글자가 성한지는 `check:sims` 가 본다. 여기서 보는 것은 그 위다.
 *
 *   1. 그린 정사각형의 **한 변이 오차의 세로 길이와 같은가.** 넓이가 곧 제곱이라는
 *      그림이므로, 한 변이 어긋나면 이 절의 주장 자체가 거짓이 된다.
 *   2. 슬라이더를 **최적합선 자리로 옮기면** 합이 가장 작아지고 배지가 뜨는가.
 *      최적합선이 슬라이더 눈금 «안»에 있어야 학생이 손으로 닿을 수 있다.
 *   3. 평균선에서 시작하는가 — 시작 자리가 「관계를 하나도 쓰지 않은 선」이라야
 *      나아졌는지 나빠졌는지가 분명하다.
 *   4. 오차 곡선의 골짜기가 **닫힌 해와 같은 자리**인가, 화살표가 그쪽을 가리키는가.
 *
 * **못 보는 것.** jsdom 에는 레이아웃이 없다. 사각형이 서로 겹쳐 보이는지, 곡선의
 * 축 이름이 그림을 뚫는지는 브라우저 몫이다.
 */

import {loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; console.log('  ✗ ' + m); };
const near = (a, b, tol) => Math.abs(a - b) <= tol;

const page = loadSim('ai/supervised-linear-regression');
page.setBox(800, 600);
page.lifecycle();
for (const e of page.errors) bad(`콘솔 오류: ${e.slice(0, 140)}`);

const doc = page.doc;
const txt = (id) => (doc.getElementById(id).textContent || '').trim();
const num = (id) => Number(txt(id).replace(/[,\s+]/g, ''));

/* ---- 1. 정사각형의 한 변이 오차의 세로 길이인가 ------------------------ */
const canvas = doc.getElementById('handFitCanvas');
const rects = canvas._ctx.ops.filter((o) => o.rect);
if (rects.length < 40) bad(`오차 제곱을 그린 사각형이 ${rects.length}개뿐이다(점 50개짜리 예제)`);
for (const o of rects) {
    const [, , w, h] = o.rect;
    if (!near(w, h, 0.01)) { bad(`사각형이 정사각형이 아니다: ${w.toFixed(2)} × ${h.toFixed(2)}`); break; }
}

/* 한 변이 그 점의 오차(세로 픽셀 길이)와 같은가 — 오차선과 짝지어 견주어 본다. */
const dashes = canvas._ctx.ops.filter((o) => o.op === 'path' && o.pts.length === 2
    && near(o.pts[0][0], o.pts[1][0], 0.01) && !o.rect);
if (dashes.length < 40) bad(`오차선이 ${dashes.length}개뿐이다`);
const sides = rects.map((o) => o.rect[2]).sort((a, b) => a - b);
const drops = dashes.map((o) => Math.abs(o.pts[0][1] - o.pts[1][1])).sort((a, b) => a - b);
for (let i = 0; i < Math.min(sides.length, drops.length); i++) {
    if (!near(sides[i], drops[i], 0.01)) {
        bad(`사각형의 한 변(${sides[i].toFixed(2)})이 그 점의 오차(${drops[i].toFixed(2)})와 다르다`);
        break;
    }
}

/* ---- 2. 평균선에서 시작하는가 ------------------------------------------ */
const hf = page.window.handFit;
if (!near(hf.a, 0, 1e-9)) bad(`시작 기울기가 0이 아니다(${hf.a})`);
const pts = hf.data.points;
const meanY = pts.reduce((t, p) => t + p.y, 0) / pts.length;
if (!near(hf.b, meanY, 1e-6)) bad(`시작 절편이 평균 y(${meanY.toFixed(3)})가 아니다(${hf.b.toFixed(3)})`);
const startSum = num('hfSum');
if (doc.getElementById('hfBadge').className.includes('hidden') === false) {
    bad('평균선인데 「가장 작은 합에 들었다」 배지가 떠 있다');
}

/* ---- 3. 최적합선 자리로 옮기면 가장 작아지는가 ------------------------- */
const fit = hf.fit;
if (!fit) bad('최적합선을 구하지 못했다');
else {
    const {aMin, aMax, bMin, bMax} = hf.range;
    if (fit.a < aMin || fit.a > aMax) bad(`최적 기울기 ${fit.a.toFixed(3)}가 슬라이더 눈금 밖이다`);
    if (fit.b < bMin || fit.b > bMax) bad(`최적 절편 ${fit.b.toFixed(3)}가 슬라이더 눈금 밖이다`);

    const slide = (id, v, min, max) => {
        const el = doc.getElementById(id);
        el.value = String(Math.round((v - min) / (max - min) * 1000));
        el.dispatchEvent(new page.window.Event('input', {bubbles: true}));
    };
    slide('hfSlopeSlider', fit.a, aMin, aMax);
    slide('hfInterceptSlider', fit.b, bMin, bMax);

    const bestSum = num('hfSum');
    if (!(bestSum < startSum)) bad(`최적합선 자리인데 합이 평균선보다 작지 않다(${bestSum} ≥ ${startSum})`);
    if (doc.getElementById('hfBadge').className.includes('hidden')) {
        bad(`최적합선 자리로 옮겼는데 배지가 뜨지 않는다(합 ${bestSum}, ${txt('hfGap')})`);
    }
    // 눈금이 1000칸이라 딱 떨어지지 않는다. 「가장 작은 합」과의 차이가 1%를 넘으면 안 된다.
    const gap = Number(txt('hfGap').replace(/[+,\s]/g, ''));
    if (!(gap <= bestSum * 0.01 + 1e-9)) bad(`최적합선 자리인데 차이가 크다(${gap})`);

    // **거짓으로 통과하지 않는지 본다** — 일부러 어긋난 자리로 옮기면 배지가 꺼져야 한다.
    slide('hfSlopeSlider', fit.a + (aMax - aMin) * 0.2, aMin, aMax);
    if (!doc.getElementById('hfBadge').className.includes('hidden')) {
        bad('엉뚱한 자리로 옮겼는데도 배지가 떠 있다 — 배지가 아무것도 판정하지 않는다');
    }
}

/* ---- 4. 오차 곡선의 골짜기가 닫힌 해와 같은가 -------------------------- */
const ec = page.window.errorCurve;
const p2 = ec.data.points;
let sxx = 0, sxy = 0;
for (const p of p2) { sxx += p.x * p.x; sxy += p.x * (p.y - ec.b); }
const want = sxy / sxx;
const got = ec.valleySlope();
if (!near(got, want, 1e-9)) bad(`골짜기 자리가 닫힌 해와 다르다(${got} ≠ ${want})`);
if (!near(Number(txt('ecMinA')), want, Math.abs(want) * 0.01 + 0.01)) {
    bad(`화면에 찍힌 「그때의 기울기」(${txt('ecMinA')})가 골짜기 자리(${want.toFixed(3)})와 다르다`);
}
// 골짜기가 곧 최솟값인가 — 양옆을 재어 본다.
const at = (a) => p2.reduce((t, p) => t + Math.pow(a * p.x + ec.b - p.y, 2), 0);
const step = (ec.range.aMax - ec.range.aMin) / 100;
if (!(at(want) < at(want + step) && at(want) < at(want - step))) {
    bad('골짜기라고 짚은 자리가 양옆보다 작지 않다');
}

/* 화살표가 골짜기 쪽을 가리키는가. 기울기를 골짜기보다 «작게» 두면 오른쪽을 가리켜야 한다. */
const g = doc.getElementById('curveGraph');
const arrowDir = () => {
    const head = g._ctx.ops.filter((o) => o.op === 'path' && o.pts.length === 3);
    if (!head.length) return null;
    const p = head[head.length - 1].pts;      // 화살촉: 꼭짓점 → 뒤쪽 두 점
    return Math.sign(p[0][0] - p[1][0]);
};
const setSlope = (v) => {
    const el = doc.getElementById('ecSlopeSlider');
    el.value = String(Math.round((v - ec.range.aMin) / (ec.range.aMax - ec.range.aMin) * 1000));
    el.dispatchEvent(new page.window.Event('input', {bubbles: true}));
};
setSlope(want - (ec.range.aMax - ec.range.aMin) * 0.25);
if (arrowDir() !== 1) bad('기울기가 골짜기보다 작은데 화살표가 오른쪽을 가리키지 않는다');
setSlope(want + (ec.range.aMax - ec.range.aMin) * 0.25);
if (arrowDir() !== -1) bad('기울기가 골짜기보다 큰데 화살표가 왼쪽을 가리키지 않는다');

console.log(`최소제곱 두 절 — 정사각형 ${rects.length}개의 한 변이 오차와 같은지, `
    + '최적합선이 슬라이더 안에 있고 그 자리에서 합이 가장 작은지, '
    + '오차 곡선의 골짜기가 닫힌 해와 같은지 보았다');
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
process.exit(fail ? 1 : 0);
