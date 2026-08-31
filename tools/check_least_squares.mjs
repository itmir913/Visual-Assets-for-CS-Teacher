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
 *   5. 그림을 누르면 그 자리에 점이 생기는가. 그때 **놓아 둔 선이 흔들리지 않는가.**
 *   6. 곡선이 그림 칸 «안»에 그려지고, 골짜기 바닥이 바닥 가까이 오는가 —
 *      0부터 그리면 볼 것인 바닥 언저리가 한 줄로 눌린다.
 *   7. **골짜기에 다가가면 실제로 확대되는가.** 창이 좁아지는 것만으로는 모자란다 —
 *      빨간 점이 창 안에서 바닥 쪽으로 다가와야 「다가가고 있다」가 보인다.
 *   8. 자료를 비워도 성한가. 비운 자리에서 학생이 점을 찍기 시작한다.
 *   9. **점을 찍어도 그림의 틀이 흔들리지 않는가.** 자료에 맞춰 틀을 다시 잡으면
 *      둘째 점을 찍는 순간 먼저 찍은 점이 화면을 가로질러 옮겨 간다.
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

/* 한 변이 그 점의 오차(세로 픽셀 길이)와 같은가 — 오차선과 짝지어 비교한다. */
const dashes = canvas._ctx.ops.filter((o) => o.op === 'path' && o.pts.length === 2
    && near(o.pts[0][0], o.pts[1][0], 0.01) && !o.rect);
if (dashes.length < 40) bad(`오차선이 ${dashes.length}개뿐이다`);
/* **개수로 짝짓지 않는다.** 오차가 반 픽셀도 안 되는 점은 사각형을 그리지 않으므로
   둘의 개수가 어긋나고, 차례로 비교하면 엉뚱한 짝이 맞부딪힌다. 같은 값을 가진 오차선이
   있는지로 본다. */
const drops = dashes.map((o) => Math.abs(o.pts[0][1] - o.pts[1][1]));
for (const o of rects) {
    const side = o.rect[2];
    if (!drops.some((d) => near(d, side, 0.01))) {
        bad(`한 변이 ${side.toFixed(2)}인 사각형에 짝이 되는 오차선이 없다`);
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

/* ---- 5. 그림을 눌러 점을 찍는가 ---------------------------------------- */
const before = hf.data.points.length;
const keepA = hf.a, keepB = hf.b;
const canvasW = doc.getElementById('handFitCanvas').clientWidth;
const canvasH = doc.getElementById('handFitCanvas').clientHeight;
doc.getElementById('handFitCanvas').dispatchEvent(new page.window.MouseEvent('pointerdown', {
    bubbles: true, clientX: canvasW / 2, clientY: canvasH / 2
}));
if (hf.data.points.length !== before + 1) {
    bad(`그림을 눌렀는데 점이 늘지 않았다(${before} → ${hf.data.points.length})`);
} else {
    const added = hf.data.points[hf.data.points.length - 1];
    const bd0 = hf.data.getBounds();
    if (!(added.x > bd0.minX && added.x < bd0.maxX && added.y > bd0.minY && added.y < bd0.maxY)) {
        bad(`찍은 점이 그림 밖의 값이다(${added.x}, ${added.y})`);
    }
    // **놓아 둔 선을 건드리지 않아야 한다** — 여기서 되돌리면 맞춰 놓은 것이 날아간다.
    if (!near(hf.a, keepA, 1e-9) || !near(hf.b, keepB, 1e-9)) {
        bad(`점을 찍었더니 놓아 둔 선이 움직였다(${keepA}, ${keepB} → ${hf.a}, ${hf.b})`);
    }
    // 눈금은 다시 잡혀야 한다 — 새 최적합선이 슬라이더 밖으로 나가면 손이 닿지 않는다.
    if (hf.fit && (hf.fit.a < hf.range.aMin || hf.fit.a > hf.range.aMax)) {
        bad('점을 찍은 뒤 최적 기울기가 슬라이더 눈금 밖으로 나갔다');
    }
}

/* ---- 6. 곡선이 칸 안에 있고 바닥이 눌리지 않았는가 --------------------- */
const gh = doc.getElementById('curveGraph');
const curvePath = g._ctx.ops.filter((o) => o.op === 'path' && o.pts.length > 100).pop();
if (!curvePath) bad('오차 곡선을 그린 자취가 없다');
else {
    /* 곡선은 **일부러 위로 벗어난다** — 골짜기를 확대하려고 천장을 잘랐기 때문이다.
       그래서 「칸 안에 있는가」가 아니라 **잘라 내는 칸을 실제로 걸었는가**를 본다.
       (jsdom 은 clip 을 실제로 적용하지 않으므로 그린 명령으로 확인한다.) */
    const T2 = 26, B2 = 46, L2 = 108, R2 = 24;
    const W = gh.clientWidth, H = gh.clientHeight;
    const clip = g._ctx.ops.some((o) => o.rect && o.clip
        && near(o.rect[0], L2, 0.5) && near(o.rect[1], T2, 0.5)
        && near(o.rect[2], W - L2 - R2, 0.5) && near(o.rect[3], H - T2 - B2, 0.5));
    if (!clip) bad('곡선을 그림 칸으로 잘라 내지 않는다 — 천장을 넘는 팔이 축 이름 위에 그려진다');
}

const cr = ec.curveRange;
if (!cr) bad('오차 곡선이 세로 눈금을 남기지 않는다');
else {
    if (!(cr.lo <= cr.vMin)) bad('골짜기 바닥이 세로 눈금 아래로 잘렸다');
    if (!(cr.cur <= cr.hi)) bad('지금 서 있는 자리가 세로 눈금 위로 잘렸다 — 빨간 점이 보이지 않는다');
    // **골짜기가 한 줄로 눌리지 않는가.** 곡선을 통째로 담으면 여기서 걸린다.
    if (!((cr.vMin - cr.lo) >= (cr.hi - cr.lo) * 0.05)) {
        bad(`골짜기 바닥이 가로축에 붙어 눌린다(바닥 ${cr.vMin.toFixed(0)}, 눈금 ${cr.lo.toFixed(0)}~${cr.hi.toFixed(0)})`);
    }
    if (!(cr.hi <= cr.vMax * 1.07)) bad('세로 눈금의 천장이 곡선의 가장 큰 값보다 높다 — 눈금이 남아돈다');
}

/* ---- 7. 다가갈수록 확대되는가 ------------------------------------------ */
const look = (a) => {
    setSlope(a);
    const r = ec.curveRange;
    return {width: r.aHi - r.aLo, off: Math.abs(ec.a - (r.aLo + r.aHi) / 2) / ((r.aHi - r.aLo) / 2)};
};
const far = look(want + (ec.range.aMax - ec.range.aMin) * 0.4);
const near1 = look(want + (ec.range.aMax - ec.range.aMin) * 0.04);
if (!(near1.width < far.width / 3)) {
    bad(`골짜기에 다가갔는데 가로 눈금이 그만큼 좁아지지 않는다(${far.width.toFixed(3)} → ${near1.width.toFixed(3)})`);
}
// **창만 좁아지면 확대가 아니다** — 빨간 점이 창 안에서 가운데로 다가와야 한다.
if (!(near1.off < far.off * 0.8)) {
    bad(`창이 거리를 그대로 따라가 빨간 점이 제자리다(${far.off.toFixed(3)} → ${near1.off.toFixed(3)})`);
}

/* ---- 8. 자료를 비워도 성한가 -------------------------------------------- */
const SICK = /NaN|Infinity|undefined/;
for (const [name, ctl, clearId] of [['손으로 맞추기', hf, 'hfClear'], ['오차 곡선', ec, 'ecClear']]) {
    doc.getElementById(clearId).click();
    if (ctl.data.points.length !== 0) bad(`${name} — 「모두 지우기」를 눌렀는데 점이 남아 있다`);
    const sick = page.idElements().map((e) => e.textContent || '').filter((t) => SICK.test(t));
    if (sick.length) bad(`${name} — 자료를 비웠더니 화면에 ${sick[0].trim().slice(0, 40)}`);
}
// 비운 자리에서 점을 찍을 수 있어야 한다 — 여기서부터 학생이 자기 자료를 만든다.
doc.getElementById('handFitCanvas').dispatchEvent(new page.window.MouseEvent('pointerdown', {
    bubbles: true, clientX: canvasW / 3, clientY: canvasH / 3
}));
if (hf.data.points.length !== 1) bad('자료를 비운 뒤에 그림을 눌렀는데 점이 찍히지 않는다');

/* ---- 9. 점을 찍어도 틀이 흔들리지 않는가 ------------------------------- */
const frameOf = () => JSON.stringify(hf.frame);
const before2 = frameOf();
const first = hf.data.points[0];
doc.getElementById('handFitCanvas').dispatchEvent(new page.window.MouseEvent('pointerdown', {
    bubbles: true, clientX: canvasW * 0.7, clientY: canvasH * 0.7
}));
if (frameOf() !== before2) bad(`틀 «안»에 점을 찍었는데 틀이 다시 잡혔다(${before2} → ${frameOf()})`);
const moved = hf.data.points[0];
if (!near(moved.x, first.x, 1e-9) || !near(moved.y, first.y, 1e-9)) {
    bad('둘째 점을 찍었더니 먼저 찍은 점의 값이 달라졌다');
}
// 틀 «밖»을 누르면 그쪽으로 넓어져야 한다 — 찍은 점이 화면 밖에 남으면 안 된다.
const wide = hf.frame.maxX;
doc.getElementById('handFitCanvas').dispatchEvent(new page.window.MouseEvent('pointerdown', {
    bubbles: true, clientX: canvasW * 1.4, clientY: canvasH * 0.5
}));
if (!(hf.frame.maxX > wide)) bad('틀 밖에 점을 찍었는데 틀이 넓어지지 않는다 — 그 점이 화면 밖에 남는다');

for (const [name, id] of [['손으로 맞추기', 'hfRandom'], ['오차 곡선', 'ecRandom']]) {
    doc.getElementById(id).click();
    const ctl = id === 'hfRandom' ? hf : ec;
    if (ctl.data.points.length < 5) bad(`${name} — 「랜덤 데이터」가 점을 ${ctl.data.points.length}개만 만들었다`);
    if (!ctl.fit) bad(`${name} — 무작위 자료에서 최적합선을 구하지 못했다`);
}
for (const e of page.errors) bad(`콘솔 오류: ${e.slice(0, 140)}`);

console.log(`최소제곱 두 절 — 정사각형 ${rects.length}개의 한 변이 오차와 같은지, `
    + '최적합선이 슬라이더 안에 있고 그 자리에서 합이 가장 작은지, '
    + '골짜기에 다가가면 확대되는지, 자료를 비우고 찍을 수 있는지 보았다');
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
process.exit(fail ? 1 : 0);
