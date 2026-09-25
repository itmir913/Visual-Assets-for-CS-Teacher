// 컴퓨터 비전 데모의 **좌표 셈과 되돌아가는 길**을 본다.
//
// **이 페이지의 알맹이(ml5 모델)는 검사할 수 없다** — 모델을 인터넷에서 받고 카메라가
// 있어야 돌기 때문이다. 받침대는 p5 와 ml5 를 가짜로 때우므로, 여기서 「통과」는
// **모델이 맞다는 뜻이 아니다.** 그 대신 **모델이 돌려준 좌표를 화면에 얹는 셈**과
// **카메라·모델이 없을 때 학생에게 뭐라고 말하는지**를 본다. 그 둘은 교실에서 실제로
// 어긋나는 자리다 — 카메라 해상도가 640x480 이 아닌 교실 PC 에서 상자가 엉뚱한 데 놓이고,
// 학교망이 CDN 을 막으면 화면이 「로딩 중」인 채로 멎는다.
//
// 보는 것.
//   1. **카메라 해상도가 다를 때 좌표를 그 비율로 고쳐 그리는가.**
//   2. **거울 모드에서 좌우를 뒤집는가.** 상자는 폭까지 셈해야 제자리에 온다.
//   3. **상자가 화면 위에 붙으면 이름표를 안쪽에 넣는가.** 밖에 두면 잘려 나간다.
//   4. **얼굴 점도 같은 규칙으로 옮기는가.**
//   5. **카메라를 못 쓸 때 까닭에 맞는 말을 하고 버튼을 되돌리는가.**
//   6. **모델을 늦게 받았을 때 낡은 것을 버리는가.** 학생이 다른 모델로 넘어간 뒤
//      먼저 시킨 것이 도착하면, 지금 고른 것을 덮어써서는 안 된다.
//   7. **분류 결과를 확률이 높은 차례로 셋만 보이는가**(따로 정렬한 것과 대조), 다른 모드 · 꺼진 뒤에
//      늦게 온 결과를 버리는가, 끄면 남은 상자를 지우는가, 모델 오류 안내가 한 번뿐인가.
//   8. **픽셀 격자의 숫자 · 칸 밝기 · 배열 글이 서로 맞는가.**
//
// **못 보는 것.** 모델의 판정, 실제 카메라 화면, p5 가 그리는 그림.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

/** p5 가 그리라고 받는 명령을 적어 두는 가짜. **자리를 따지려면 이것이 있어야 한다.** */
const 그린것 = [];
const 적기 = (이름) => (...인자) => { 그린것.push({op: 이름, args: 인자}); };
const p5가짜 = {
    noCanvas: () => {},
    frameRate: () => {},
    background: () => {},
    push: () => {}, pop: () => {}, translate: () => {}, scale: () => {},
    stroke: () => {}, strokeWeight: () => {}, noStroke: () => {}, noFill: () => {}, fill: () => {},
    textSize: () => {}, textAlign: () => {}, image: 적기('image'),
    rect: 적기('rect'), circle: 적기('circle'), text: 적기('text'),
    createCanvas: () => ({parent: () => {}, style: () => {}}),
    select: () => null,
    createCapture: () => ({elt: {}, size: () => {}, hide: () => {}}),
    LEFT: 'LEFT', CENTER: 'CENTER',
    width: 640, height: 480,
    ml5: {setBackend: () => {}},
};

const sim = loadSim('ai/computer-vision-ml5', {globals: p5가짜});
sim.lifecycle();
console.log(`컴퓨터 비전 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
console.log('  · 모델(ml5)과 그리기(p5)는 가짜로 때웠다 — 통과는 「좌표 셈과 안내가 맞다」까지만 뜻한다');

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

// 화면 요소를 잡아 두는 것은 setup() 이 한다. p5 가 부르는 자리를 우리가 대신 부른다.
P('setup()');

/** 카메라가 내보내는 해상도를 정해 둔다. */
const 카메라해상도 = (w, h) => P(`video = {elt: {videoWidth: ${w}, videoHeight: ${h}}, loadedmetadata: true}`);

/* ================================================================
   1 · 2 · 3. 객체 탐지 상자
   ================================================================ */
const 상자들 = [
    {x: 100, y: 60, width: 80, height: 120, label: '사람', confidence: 0.91},
    {x: 10, y: 5, width: 60, height: 40, label: '컵', confidence: 0.72},      // 화면 위에 붙은 상자
];

for (const [vw, vh] of [[640, 480], [320, 240], [1280, 720]]) {
    for (const 거울 of [false, true]) {
        그린것.length = 0;
        카메라해상도(vw, vh);
        P(`mirrorMode = ${거울}`);
        P(`detections = ${JSON.stringify(상자들)}`);
        P('drawDetections()');

        const sx = 640 / vw, sy = 480 / vh;
        const 그린상자 = 그린것.filter((o) => o.op === 'rect');
        if (그린상자.length !== 상자들.length * 2) {
            bad(`상자(${vw}x${vh}, 거울 ${거울}): 사각형을 ${그린상자.length}개 그렸다 — 상자와 이름표까지 ${상자들.length * 2}개다`);
            continue;
        }
        for (const [i, d] of 상자들.entries()) {
            const 몸통 = 그린상자[i * 2], 이름표 = 그린상자[i * 2 + 1];
            let 기대x = d.x * sx;
            const 기대y = d.y * sy, 기대w = d.width * sx, 기대h = d.height * sy;
            if (거울) 기대x = 640 - 기대x - 기대w;

            if (Math.abs(몸통.args[0] - 기대x) > 1e-9 || Math.abs(몸통.args[1] - 기대y) > 1e-9) {
                bad(`상자(${vw}x${vh}, 거울 ${거울}): 「${d.label}」 을 (${몸통.args[0].toFixed(1)},${몸통.args[1].toFixed(1)}) 에 그렸다 — 비율대로면 (${기대x.toFixed(1)},${기대y.toFixed(1)}) 다`);
            }
            if (Math.abs(몸통.args[2] - 기대w) > 1e-9 || Math.abs(몸통.args[3] - 기대h) > 1e-9) {
                bad(`상자(${vw}x${vh}): 「${d.label}」 의 크기를 ${몸통.args[2].toFixed(1)}x${몸통.args[3].toFixed(1)} 로 그렸다 — 비율대로면 ${기대w.toFixed(1)}x${기대h.toFixed(1)} 다`);
            }
            // 이름표는 상자 위에, 자리가 없으면 안쪽에
            const 기대이름표y = (기대y - 26 < 0) ? 기대y : 기대y - 26;
            if (Math.abs(이름표.args[1] - 기대이름표y) > 1e-9) {
                bad(`이름표(${vw}x${vh}): 「${d.label}」 의 이름표를 y=${이름표.args[1].toFixed(1)} 에 두었다 — ${기대이름표y.toFixed(1)} 이어야 한다`);
            }
            if (이름표.args[1] < 0) bad(`이름표: 「${d.label}」 의 이름표가 화면 밖(y=${이름표.args[1].toFixed(1)})으로 나가 잘린다`);
        }
        // 이름과 확률을 적는가
        const 글 = 그린것.filter((o) => o.op === 'text').map((o) => String(o.args[0]));
        for (const d of 상자들) {
            if (!글.some((t) => t.includes(d.label) && t.includes((d.confidence * 100).toFixed(1)))) {
                bad(`이름표: 「${d.label}」 의 이름이나 확률을 적지 않았다`);
            }
        }
    }
}

/* ================================================================
   4. 얼굴 점
   ================================================================ */
for (const [vw, vh] of [[640, 480], [800, 600]]) {
    for (const 거울 of [false, true]) {
        그린것.length = 0;
        카메라해상도(vw, vh);
        P(`mirrorMode = ${거울}`);
        P('detections = []');
        P(`faces = [{keypoints: [{x: 100, y: 50}, {x: 300, y: 200}, {x: 0, y: 0}]}]`);
        P('drawFaceMesh()');
        const 점 = 그린것.filter((o) => o.op === 'circle');
        if (점.length !== 3) { bad(`얼굴 점(${vw}x${vh}): 점을 ${점.length}개 그렸다 — 세 개다`); continue; }
        const sx = 640 / vw, sy = 480 / vh;
        const 기대 = [[100, 50], [300, 200], [0, 0]].map(([x, y]) => [거울 ? 640 - x * sx : x * sx, y * sy]);
        for (const [i, p] of 점.entries()) {
            if (Math.abs(p.args[0] - 기대[i][0]) > 1e-9 || Math.abs(p.args[1] - 기대[i][1]) > 1e-9) {
                bad(`얼굴 점(${vw}x${vh}, 거울 ${거울}): ${i}번 점을 (${p.args[0].toFixed(1)},${p.args[1].toFixed(1)}) 에 그렸다 — 비율대로면 (${기대[i][0].toFixed(1)},${기대[i][1].toFixed(1)}) 다`);
                break;
            }
        }
    }
}

// 해상도를 아직 모를 때는 배율을 1 로 두어야 한다 — 0 으로 나누면 좌표가 통째로 사라진다
{
    P('video = {elt: {videoWidth: 0, videoHeight: 0}, loadedmetadata: false}');
    const 배율 = P('videoScale()');
    if (배율.sx !== 1 || 배율.sy !== 1) bad(`배율: 해상도를 모를 때 (${배율.sx},${배율.sy}) 를 썼다 — 1 이어야 한다`);
    P('video = null');
    const 배율2 = P('videoScale()');
    if (배율2.sx !== 1 || 배율2.sy !== 1) bad('배율: 카메라가 없을 때도 1 이어야 한다');
}

/* ================================================================
   5. 카메라를 못 쓸 때
   ================================================================ */
{
    const 판 = [
        ['InsecureContext', ['https', 'localhost']],
        ['NotAllowedError', ['거부', '권한']],
        ['NotFoundError', ['찾지 못']],
        ['NotReadableError', ['사용 중']],
        ['알 수 없는 오류', ['새로고침']],
    ];
    for (const [이름, 들어야할말] of 판) {
        P(`handleCameraError({name: ${JSON.stringify(이름)}})`);
        const 안내 = doc.getElementById('statusText').textContent;
        for (const 말 of 들어야할말) {
            if (!안내.includes(말)) bad(`카메라 오류(${이름}): 안내에 「${말}」 이 없다 — 「${안내.slice(0, 40)}」`);
        }
        if (P('isRunning')) bad(`카메라 오류(${이름}): 켜진 것으로 남겨 두었다`);
        if (doc.getElementById('startBtn').classList.contains('hidden')) {
            bad(`카메라 오류(${이름}): 다시 시도할 「시작」 버튼을 숨겨 두었다`);
        }
        if (!doc.getElementById('stopBtn').classList.contains('hidden')) {
            bad(`카메라 오류(${이름}): 「중지」 버튼이 남아 있다`);
        }
    }

    // 안전하지 않은 주소인지 가리는 규칙
    const 앞것 = sim.window.isSecureContext;
    P('window.isSecureContext = false');
    if (!P('insecurePage()')) bad('주소 판정: 안전하지 않은 주소인데 쓸 수 있다고 본다');
    P('window.isSecureContext = true');
    const 장치자리 = (값) => Object.defineProperty(sim.window.navigator, 'mediaDevices', {value: 값, configurable: true});
    장치자리(undefined);
    if (!P('insecurePage()')) bad('주소 판정: 카메라 장치 목록이 아예 없는데 쓸 수 있다고 본다');
    장치자리({getUserMedia: () => Promise.reject(new Error('no camera'))});
    if (P('insecurePage()')) bad('주소 판정: 안전한 주소인데 못 쓴다고 본다');
    P(`window.isSecureContext = ${앞것}`);
}

/* ================================================================
   6. 늦게 도착한 모델
   ================================================================ */
{
    // 지금 고른 번호와 같으면 받아 쓴다
    P('loadSeq = 5');
    P('window.__받은것 = null');
    P('receiveModel(Promise.resolve({ready: Promise.resolve(), 이름: "지금것"}), 5, (m) => { window.__받은것 = m; })');
    await new Promise((r) => setTimeout(r, 50));
    if (P('window.__받은것 && window.__받은것.이름') !== '지금것') {
        bad('늦게 온 모델: 지금 고른 모델을 받아 쓰지 않았다');
    }

    // 번호가 낡았으면 버린다
    P('loadSeq = 6');
    P('window.__받은것 = null');
    P('receiveModel(Promise.resolve({ready: Promise.resolve(), 이름: "낡은것"}), 5, (m) => { window.__받은것 = m; })');
    await new Promise((r) => setTimeout(r, 50));
    if (P('window.__받은것')) bad('늦게 온 모델: 학생이 다른 모델로 넘어갔는데 낡은 것을 덮어썼다');

    // 낡은 로드가 실패한 것으로 지금 화면을 망가뜨리지 않는다
    P('modelFailed = false');
    P('receiveModel(Promise.reject(new Error("낡은 실패")), 5, () => {})');
    await new Promise((r) => setTimeout(r, 50));
    if (P('modelFailed')) bad('늦게 온 모델: 낡은 로드의 실패로 지금 모델까지 버렸다');

    // 지금 번호의 실패는 제대로 알린다
    P('receiveModel(Promise.reject(new Error("지금 실패")), 6, () => {})');
    await new Promise((r) => setTimeout(r, 50));
    if (!P('modelFailed')) bad('모델 오류: 지금 고른 모델을 못 받았는데 알리지 않는다');
    const 안내 = doc.getElementById('statusText').textContent;
    if (!안내.includes('모델')) bad(`모델 오류: 안내에 까닭이 없다 — 「${안내.slice(0, 40)}」`);
    if (!doc.getElementById('loadingOverlay').classList.contains('hidden')) {
        bad('모델 오류: 「로딩 중」 덮개를 걷지 않아 화면이 멎은 것처럼 보인다');
    }
}

/* ================================================================
   7. 분류 결과 — 확률이 높은 차례로 세 개, 확률은 백분율 소수 한 자리
   ================================================================ */
{
    const 결과칸 = doc.getElementById('classificationResult');
    const 읽기 = () => [...결과칸.querySelectorAll('.font-black')].map((e) => e.textContent.trim());
    const 확률들 = () => [...결과칸.querySelectorAll('span.px-2')].map((e) => e.textContent.trim());
    P('isRunning = true; currentMode = "classification"');
    doc.getElementById('loadingOverlay').classList.remove('hidden');
    // 차례를 섞어 준다 — 따로 정렬한 것과 같아야 한다
    const 받은것 = [
        {label: '고양이', confidence: 0.12}, {label: '컵', confidence: 0.61},
        {label: '연필', confidence: 0.05}, {label: '의자', confidence: 0.2}, {label: '공', confidence: 0.02},
    ];
    P(`gotClassificationResults(${JSON.stringify(받은것)})`);
    const 기대 = [...받은것].sort((a, b) => b.confidence - a.confidence).slice(0, 3);
    if (읽기().join(',') !== 기대.map((r) => r.label).join(',')) {
        bad(`분류: 「${읽기().join(', ')}」 차례로 보였다 — 확률이 높은 셋은 「${기대.map((r) => r.label).join(', ')}」`);
    }
    if (확률들().join(',') !== 기대.map((r) => (r.confidence * 100).toFixed(1) + '%').join(',')) {
        bad(`분류: 확률을 「${확률들().join(', ')}」 로 적었다`);
    }
    // 막대 폭이 그 확률이다
    const 폭 = [...결과칸.querySelectorAll('[style*="width"]')].map((e) => parseFloat(e.style.width).toFixed(1) + '%');
    if (폭.join(',') !== 기대.map((r) => (r.confidence * 100).toFixed(1) + '%').join(',')) bad(`분류: 막대 폭이 「${폭.join(', ')}」`);
    if (!doc.getElementById('loadingOverlay').classList.contains('hidden')) bad('분류: 첫 결과가 왔는데 「로딩 중」 덮개를 걷지 않았다');
    // 셋보다 적게 와도 죽지 않고 온 만큼만 보인다
    P(`gotClassificationResults(${JSON.stringify([{label: '공', confidence: 0.5}])})`);
    if (읽기().length !== 1) bad(`분류: 결과가 하나인데 ${읽기().length}개를 보였다`);
    // 다른 모드로 넘어간 뒤 늦게 온 결과는 버린다
    P('currentMode = "detection"');
    P(`gotClassificationResults(${JSON.stringify(받은것)})`);
    if (읽기().length !== 1) bad('분류: 탐지 모드로 넘어갔는데 늦게 온 분류 결과를 덮어썼다');
    P('faces = []; gotFaces([{keypoints: []}])');
    if (P('faces.length') !== 0) bad('얼굴: 탐지 모드인데 얼굴 결과를 받아 두었다');
    P('gotDetections([{x: 1, y: 1, width: 2, height: 2, label: "공", confidence: 0.5}])');
    if (P('detections.length') !== 1) bad('탐지: 탐지 모드인데 결과를 받아 두지 않았다');
    P('currentMode = "facemesh"; gotDetections([])');
    if (P('detections.length') !== 1) bad('탐지: 얼굴 모드로 넘어갔는데 늦게 온 탐지 결과로 상자를 바꿨다');
    P('currentMode = "detection"; isRunning = false');
    P('gotDetections([])');
    if (P('detections.length') !== 1) bad('탐지: 꺼진 뒤에 온 결과로 화면을 바꿨다');

    // 끄면 남은 상자 · 얼굴 점 · 마스크를 지우고 버튼을 되돌린다
    P('isRunning = true; video = null; faces = [{keypoints: []}]; segmentationResult = {}');
    P('stopSystem()');
    if (P('detections.length + faces.length') !== 0 || P('segmentationResult') !== null) bad('중지: 화면에 남은 상자 · 얼굴 점 · 마스크를 지우지 않았다');
    if (P('isRunning')) bad('중지: 켜진 것으로 남았다');
    if (doc.getElementById('startBtn').classList.contains('hidden') || !doc.getElementById('stopBtn').classList.contains('hidden')) {
        bad('중지: 「시작」 · 「중지」 버튼을 되돌리지 않았다');
    }
    // 꺼진 채로는 모델을 받으러 가지 않는다
    const 번호 = P('loadSeq');
    P('loadCurrentModel()');
    if (P('loadSeq') !== 번호) bad('모델: 꺼져 있는데 모델을 받기 시작했다');

    // 모델 오류는 한 번만 알린다 — 넷이 잇따라 실패해도 안내는 하나다
    P('modelFailed = false; window.__알림 = 0');
    const 원래토스트 = P('showToast');
    P('showToast = () => { window.__알림++; }');
    P('handleModelError(new Error("하나")); handleModelError(new Error("둘"))');
    if (P('window.__알림') !== 1) bad(`모델 오류: 두 번 실패하자 안내를 ${P('window.__알림')}번 띄웠다`);
    if (P('classifier || detector || faceMesh || bodySegmentation')) bad('모델 오류: 반쯤 받은 모델을 남겨 두었다');
    sim.window.showToast = 원래토스트;
}

/* ================================================================
   8. 픽셀 격자 — 칸의 숫자 · 밝기 · 배열 글이 서로 맞는가
   ================================================================ */
{
    const 칸 = [...doc.querySelectorAll('#pixelGrid .pixel-cell')];
    if (칸.length !== 25) bad(`픽셀: 칸이 ${칸.length}개 — 5×5 는 25개다`);
    const 값 = 칸.map((c) => Number(c.textContent));
    const 허용 = new Set([0, 1, 2, 3, 4, 5, 6].map((k) => Math.round(k / 6 * 255)));
    if (값.some((v) => !허용.has(v))) bad(`픽셀: 0~255 를 일곱 단계로 나눈 값이 아닌 것이 있다 — ${값.join(' ')}`);
    // 밝기 — 칸 색의 밝기가 숫자와 같은 차례여야 한다(0 이 가장 어둡다)
    const 밝기 = (css) => {
        const m = css.match(/\d+/g).map(Number);
        return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2];
    };
    for (let i = 0; i < 25; i++) {
        for (let j = 0; j < 25; j++) {
            if (값[i] < 값[j] && !(밝기(칸[i].style.backgroundColor) < 밝기(칸[j].style.backgroundColor))) {
                bad(`픽셀: 값 ${값[i]} 인 칸이 값 ${값[j]} 인 칸보다 어둡지 않다`); i = j = 25;
            }
        }
    }
    // 배열 글 — 줄마다 다섯, 칸 차례(왼쪽 위부터 가로로)와 같다
    const 글 = doc.getElementById('pixelArrayDisplay').textContent;
    const 줄 = 글.split('\n').slice(1, 6).map((l) => l.match(/\d+/g).map(Number));
    if (줄.length !== 5 || 줄.some((r) => r.length !== 5) || 줄.flat().join(',') !== 값.join(',')) {
        bad('픽셀: 배열 글이 칸의 숫자와 차례가 다르다');
    }
    // 누르면 숫자가 드러나 남고, 다시 누르면 감춘다 — 밝은 칸은 어두운 글자, 어두운 칸은 밝은 글자
    for (const c of 칸) {
        const v = Number(c.textContent);
        c.dispatchEvent(new sim.window.Event('click'));
        const 드러남 = c.style.color;
        c.dispatchEvent(new sim.window.Event('mouseleave'));
        if (!드러남 || c.style.color !== 드러남) { bad('픽셀: 누른 칸의 숫자가 손을 떼자 사라졌다'); break; }
        if ((v >= 170 && 밝기(드러남) > 128) || (v <= 85 && 밝기(드러남) < 128)) { bad(`픽셀: 값 ${v} 인 칸에 바탕과 비슷한 밝기의 글자를 얹었다`); break; }
        c.dispatchEvent(new sim.window.Event('click'));
        if (c.style.color) { bad('픽셀: 다시 눌렀는데 숫자를 감추지 않았다'); break; }
    }
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('vision', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
