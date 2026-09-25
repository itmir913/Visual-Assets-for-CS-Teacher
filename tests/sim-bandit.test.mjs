// 여러 팔 밴딧 시뮬레이터가 **평균을 제대로 쌓고 탐험과 활용을 규칙대로 가르는지** 본다.
//
// 이 화면은 **틀려도 그럴듯하다** — 숫자가 오르내리고 왕관이 옮겨 다니면 학습으로 보인다.
// 그래서 여기서는 확률을 **씨앗을 고정한 난수로 붙들어** 같은 판을 되풀이할 수 있게 하고,
// 쌓인 예측값이 **실제 확률에 다가가는지**, 고르는 규칙이 ε 를 그대로 지키는지 본다.
//
// 보는 것.
//   1. **뽑은 기계 다섯의 확률이 정해 둔 구간 안이고, 가장 좋은 기계가 늘 같은 자리에 있지 않은가.**
//      늘 A 가 최고이면 학생은 몇 판만에 규칙을 눈치채고 탐험할 까닭을 잃는다.
//   2. **예측값이 실제로 받은 보상의 평균인가.** 한 번에 하나씩 늘려 가는 식이라
//      나눗셈 한 자리만 어긋나도 값이 조용히 치우친다.
//   3. **ε=0 이면 예측이 가장 높은 것만 고르고, ε=1 이면 고르게 흩어지는가.**
//   4. **오래 돌리면 실제로 가장 좋은 기계를 가장 많이 고르고, 예측값이 실제 확률에 닿는가.**
//   5. **화면의 예측값·선택 횟수·왕관이 실제 상태와 같은가.**
//
// **못 보는 것.** 그래프의 색과 애니메이션은 볼 수 없다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/reinforcement-multi-armed-bandit');
sim.lifecycle();
console.log(`여러 팔 밴딧 (${SIM_ROOT})`);
if (sim.errors.length) bad(`뜨는 동안 오류: ${sim.errors.slice(0, 3).join(' / ')}`);
if (sim.stubbed.length) console.log(`  · 가짜로 때운 것: ${sim.stubbed.join(', ')}`);

const doc = sim.doc;
const P = (expr) => sim.evalInPage(expr);

function mulberry32(a) {
    return () => {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const 씨앗 = (n) => { sim.window.Math.random = mulberry32(n); };

/* ================================================================
   1. 뽑은 기계 다섯
   ================================================================ */
{
    const 구간 = [[0.61, 0.75], [0.45, 0.60], [0.35, 0.50], [0.20, 0.40], [0.10, 0.30]];
    const 최고자리 = new Set();
    for (let s = 0; s < 40; s++) {
        씨앗(s * 313 + 7);
        P('banditController.env.reset()');
        const 기계 = P('banditController.env.machines');
        if (기계.length !== 5) { bad(`기계를 ${기계.length}개 뽑았다`); break; }
        const 확률 = 기계.map((m) => m.trueProb).sort((a, b) => b - a);
        for (const [i, [아래, 위]] of 구간.entries()) {
            if (확률[i] < 아래 - 1e-9 || 확률[i] > 위 + 1e-9) {
                bad(`확률: ${i + 1}번째로 높은 확률이 ${확률[i]} — 정해 둔 구간은 ${아래}~${위} 다`);
            }
        }
        if (new Set(기계.map((m) => m.id)).size !== 5) bad('기계 이름이 겹친다');
        최고자리.add(기계.indexOf(기계.reduce((a, b) => (a.trueProb >= b.trueProb ? a : b))));
        if (기계.some((m) => m.qValue !== 0 || m.count !== 0)) bad('새 판인데 예측값이나 선택 횟수가 남았다');
    }
    if (최고자리.size < 3) {
        bad(`가장 좋은 기계가 ${[...최고자리].length}자리에만 나온다 — 자리가 굳으면 탐험할 까닭이 사라진다`);
    }
    // 가장 좋은 기계는 늘 하나다 — 둘이면 「최고 기계를 찾았는가」가 뜻을 잃는다.
    // 두 구간이 끝점을 나누면 겹침은 수백 판에 한 번꼴이라 판을 많이 뽑는다.
    for (let s = 0; s < 4000; s++) {
        씨앗(s * 7919 + 11);
        P('banditController.env.reset()');
        const 확률 = P('banditController.env.machines').map((m) => m.trueProb).sort((a, b) => b - a);
        if (!(확률[0] > 확률[1])) { bad(`최선 기계가 둘이다(씨앗 ${s}): ${확률[0]} · ${확률[1]}`); break; }
    }
}

/* ================================================================
   2. 예측값이 받은 보상의 평균인가
   ================================================================ */
{
    씨앗(20260909);
    P('banditController.env.reset()');
    const 받은보상 = [[], [], [], [], []];
    for (let 회 = 0; 회 < 400; 회++) {
        const 어느것 = 회 % 5;
        const 결과 = P(`banditController.env.playMachine(${어느것})`);
        if (결과.reward !== 0 && 결과.reward !== 1) bad(`보상이 ${결과.reward} 다 — 0 이나 1 이어야 한다`);
        받은보상[어느것].push(결과.reward);

        const 기계 = P('banditController.env.machines');
        const 평균 = 받은보상[어느것].reduce((a, b) => a + b, 0) / 받은보상[어느것].length;
        if (Math.abs(기계[어느것].qValue - 평균) > 1e-12) {
            bad(`예측값: ${회 + 1}회차에 ${기계[어느것].qValue} — 받은 보상의 평균은 ${평균} 이다`);
            break;
        }
        if (기계[어느것].count !== 받은보상[어느것].length) {
            bad(`선택 횟수: ${기계[어느것].count} — 실제로는 ${받은보상[어느것].length}번 골랐다`);
            break;
        }
    }
    const 센회차 = P('banditController.env.episode');
    if (센회차 !== 400) bad(`회차를 ${센회차} 로 셌다 — 400번 골랐다`);

    // 보상이 실제 확률만큼 나오는가 — 여든 번씩 골랐으니 크게 어긋나면 뽑기가 잘못된 것이다
    const 기계 = P('banditController.env.machines');
    for (const [i, m] of 기계.entries()) {
        const 실제비율 = 받은보상[i].reduce((a, b) => a + b, 0) / 받은보상[i].length;
        if (Math.abs(실제비율 - m.trueProb) > 0.2) {
            bad(`보상 뽑기: ${m.id} 의 실제 확률은 ${m.trueProb} 인데 ${받은보상[i].length}번에서 ${실제비율.toFixed(2)} 가 나왔다`);
        }
    }
}

/* ================================================================
   3. 고르는 규칙
   ================================================================ */
{
    씨앗(4242);
    P('banditController.env.reset()');
    P('banditController.env.machines.forEach((m, i) => { m.qValue = i * 0.1; m.count = 1; })');
    for (let i = 0; i < 50; i++) {
        if (P('banditController.env.chooseAction(0)') !== 4) { bad('ε=0 인데 예측이 가장 높은 기계를 고르지 않는다'); break; }
    }
    // 동점이면 그중에서만 고른다
    P('banditController.env.machines.forEach((m, i) => { m.qValue = (i === 1 || i === 3) ? 0.5 : 0.1; })');
    const 고른것 = new Set();
    for (let i = 0; i < 200; i++) 고른것.add(P('banditController.env.chooseAction(0)'));
    if ([...고른것].some((i) => i !== 1 && i !== 3)) bad(`ε=0 인데 동점이 아닌 기계도 골랐다 (${[...고른것].join(',')})`);
    if (고른것.size < 2) bad('동점인데 한쪽만 고른다');

    // ε=1 이면 고르게 흩어져야 한다
    const 셈 = [0, 0, 0, 0, 0];
    for (let i = 0; i < 3000; i++) 셈[P('banditController.env.chooseAction(1)')]++;
    for (const [i, c] of 셈.entries()) {
        if (c < 3000 / 5 * 0.7 || c > 3000 / 5 * 1.3) {
            bad(`ε=1 인데 ${i}번 기계를 ${c}번 골랐다 — 고르게 흩어지면 600 언저리다`);
        }
    }
}

/* ================================================================
   4. 오래 돌리면 가장 좋은 기계로 모이는가
   ================================================================ */
for (const [ε, 씨] of [[0.1, 111], [0.3, 222]]) {
    씨앗(씨);
    P('banditController.env.reset()');
    doc.getElementById('epsilonSlider').value = String(ε);
    for (let 회 = 0; 회 < 3000; 회++) {
        const a = P(`banditController.env.chooseAction(${ε})`);
        P(`banditController.env.playMachine(${a})`);
    }
    const 기계 = P('banditController.env.machines');
    const 진짜최고 = 기계.reduce((a, b) => (a.trueProb >= b.trueProb ? a : b));
    const 가장많이고른것 = 기계.reduce((a, b) => (a.count >= b.count ? a : b));
    if (가장많이고른것.id !== 진짜최고.id) {
        bad(`ε=${ε}: 3000판을 돌렸는데 가장 많이 고른 것은 ${가장많이고른것.id} 이고 실제 최고는 ${진짜최고.id} 다`);
    }
    for (const m of 기계) {
        if (m.count < 30) continue;      // 조금 고른 기계는 평균이 흔들린다
        if (Math.abs(m.qValue - m.trueProb) > 0.15) {
            bad(`ε=${ε}: ${m.id} 의 예측값 ${m.qValue.toFixed(3)} 이 실제 확률 ${m.trueProb} 과 멀다 (${m.count}번 골랐다)`);
        }
    }
    const 기록 = P('banditController.env.history');
    if (기록.at(-1).episode !== P('banditController.env.episode')) {
        bad(`ε=${ε}: 기록의 마지막 회차가 실제 회차와 다르다`);
    }
}

/* ================================================================
   5. 화면이 실제 상태와 같은가
   ================================================================ */
{
    P('banditController.initDOM()');
    P('banditController.updateUI()');
    const 기계 = P('banditController.env.machines');
    const 카드 = [...doc.querySelectorAll('.machine-card')];
    if (카드.length !== 5) bad(`화면: 기계 카드가 ${카드.length}개다`);
    for (const [i, m] of 기계.entries()) {
        const 적힌예측 = Number(카드[i].querySelector('.val-q').textContent);
        const 적힌횟수 = Number(카드[i].querySelector('.val-count').textContent);
        if (Math.abs(적힌예측 - m.qValue) > 0.005) bad(`화면: ${m.id} 의 예측값을 ${적힌예측} 로 적었다 — 실제로는 ${m.qValue.toFixed(2)} 다`);
        if (적힌횟수 !== m.count) bad(`화면: ${m.id} 의 선택 횟수를 ${적힌횟수} 로 적었다 — 실제로는 ${m.count} 다`);
    }
    const 가장높은예측 = Math.max(...기계.map((m) => m.qValue));
    const 왕관 = 카드.map((c, i) => [i, !c.querySelector('.best-badge').classList.contains('hidden')])
        .filter(([, 켜짐]) => 켜짐).map(([i]) => i);
    if (!왕관.length) bad('화면: 예측이 가장 높은 기계에 왕관이 없다');
    for (const i of 왕관) {
        if (Math.abs(기계[i].qValue - 가장높은예측) > 1e-12) {
            bad(`화면: ${기계[i].id} 에 왕관을 씌웠는데 예측이 가장 높은 기계가 아니다`);
        }
    }

    // 아직 한 판도 안 돌린 새 판에서는 왕관을 씌우지 않는다 — 근거 없이 고른 것처럼 보인다
    P('banditController.env.reset()');
    P('banditController.initDOM()');
    P('banditController.updateUI()');
    const 새왕관 = [...doc.querySelectorAll('.best-badge')].filter((b) => !b.classList.contains('hidden'));
    if (새왕관.length) bad('화면: 한 판도 돌리지 않았는데 왕관을 씌웠다');
}

/* ================================================================
   6. 따로 짠 ε-탐욕과 한 판 전체 대조 — 같은 난수 순서로 고른 것 · 보상 합 · 산술 평균
   ================================================================ */
// 「한 번 실행」 버튼을 누른다 — ε 은 슬라이더로 넣고, 버튼 배선까지 함께 본다.
for (const [ε, 씨] of [[0, 5], [0.2, 6], [1, 7]]) {
    씨앗(씨);
    P('banditController.env.reset(); banditController.initDOM(); banditController.updateUI()');
    const 확률 = P('banditController.env.machines').map((m) => m.trueProb);
    const 판수 = 700;
    doc.getElementById('epsilonSlider').value = String(ε);
    const 한번 = doc.getElementById('btnStep');
    for (let i = 0; i < 판수; i++) 한번.dispatchEvent(new sim.window.MouseEvent('click', {bubbles: true}));

    // 기계를 뽑는 데 쓴 난수까지 똑같이 흘려보낸 뒤 따로 돌린다 — 뽑기 다섯 + 섞기 넷
    const rnd = mulberry32(씨);
    for (let i = 0; i < 9; i++) rnd();
    const 합 = [0, 0, 0, 0, 0], 셈 = [0, 0, 0, 0, 0];
    let 총보상 = 0;
    for (let i = 0; i < 판수; i++) {
        let a;
        if (rnd() < ε) a = Math.floor(rnd() * 5);
        else {
            // 예측은 산술 평균으로 — 페이지의 증분식과 다른 길
            const 예측 = 합.map((s, k) => (셈[k] ? s / 셈[k] : 0));
            const m = Math.max(...예측);
            const 후보 = [0, 1, 2, 3, 4].filter((k) => 예측[k] === m);
            a = 후보[Math.floor(rnd() * 후보.length)];
        }
        const r = rnd() < 확률[a] ? 1 : 0;
        합[a] += r; 셈[a]++; 총보상 += r;
    }
    const 기계 = P('banditController.env.machines');
    const 뜻 = `ε=${ε}`;
    if (기계.some((m, k) => m.count !== 셈[k])) bad(`한 판(${뜻}): 고른 횟수 [${기계.map((m) => m.count)}] — 따로 돌린 것은 [${셈}]`);
    for (const [k, m] of 기계.entries()) {
        const 평균 = 셈[k] ? 합[k] / 셈[k] : 0;
        if (Math.abs(m.qValue - 평균) > 1e-9) { bad(`한 판(${뜻}): ${m.id} 의 예측값 ${m.qValue} — 산술 평균은 ${평균}`); break; }
    }
    const 페이지총보상 = 기계.reduce((a, m) => a + m.qValue * m.count, 0);
    if (Math.abs(페이지총보상 - 총보상) > 1e-6) bad(`한 판(${뜻}): 예측값×횟수로 되살린 총보상 ${페이지총보상.toFixed(3)} — 따로 더한 것은 ${총보상}`);
    if (doc.getElementById('episodeCount').textContent !== String(판수)) bad(`한 판(${뜻}): 화면의 에피소드가 ${doc.getElementById('episodeCount').textContent} 이다`);
    // 그래프 기록 — 새 판 한 줄 + 판마다 한 줄, 500줄에서 앞이 잘리고 마지막 줄은 지금 예측값
    const 기록 = P('banditController.env.history');
    if (기록.length !== 500) bad(`한 판(${뜻}): 기록이 ${기록.length}줄 — ${판수 + 1}줄 가운데 최근 500줄이어야 한다`);
    if (기록[0].episode !== 판수 + 1 - 500) bad(`한 판(${뜻}): 가장 오랜 기록이 ${기록[0].episode}회차다 — ${판수 + 1 - 500}회차여야 한다`);
    if (기록.at(-1).qValues.some((q, k) => q !== 기계[k].qValue)) bad(`한 판(${뜻}): 마지막 기록의 예측값이 지금 예측값과 다르다`);
}

/* ================================================================
   7. 화면의 주장 — ε=0 이면 나쁜 기계에 갇힐 수 있고, ε=100% 는 총 보상이 줄어든다
   ================================================================ */
{
    let 갇힘 = 0, 판 = 0;
    const 평균보상 = {0.1: 0, 1: 0};
    for (let s = 0; s < 30; s++) {
        씨앗(9000 + s);
        P('banditController.env.reset()');
        const 기계 = P('banditController.env.machines');
        const 최고 = 기계.reduce((a, b, k) => (b.trueProb > 기계[a].trueProb ? k : a), 0);
        // ε=0 — 처음 1 을 받은 기계는 평균이 0 보다 커서 다시는 다른 기계를 고르지 않는다
        let 처음당첨 = -1, 배신 = false;
        for (let i = 0; i < 300; i++) {
            const a = P('banditController.env.chooseAction(0)');
            if (처음당첨 >= 0 && a !== 처음당첨) 배신 = true;
            const r = P(`banditController.env.playMachine(${a})`).reward;
            if (r === 1 && 처음당첨 < 0) 처음당첨 = a;
        }
        if (배신) bad(`ε=0(씨앗 ${s}): 처음 당첨된 기계를 두고 다른 기계를 골랐다 — 예측이 가장 높은 것만 골라야 한다`);
        판++;
        if (처음당첨 >= 0 && 처음당첨 !== 최고) 갇힘++;
        for (const ε of [0.1, 1]) {
            P('banditController.env.machines.forEach((m) => { m.qValue = 0; m.count = 0; })');
            let 합 = 0;
            for (let i = 0; i < 1000; i++) 합 += P(`banditController.env.playMachine(banditController.env.chooseAction(${ε}))`).reward;
            평균보상[ε] += 합 / 1000 / 30;
        }
    }
    if (!갇힘) bad(`ε=0: ${판}판 모두 최고 기계를 찾았다 — 화면은 「나쁜 기계에 갇힐 수 있다」고 말한다`);
    if (!(평균보상[1] < 평균보상[0.1])) bad(`ε=100% 의 판당 보상 ${평균보상[1].toFixed(3)} 이 ε=10% 의 ${평균보상[0.1].toFixed(3)} 보다 작지 않다 — 화면은 줄어든다고 말한다`);
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('bandit', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
