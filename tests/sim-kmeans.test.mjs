// k-평균 시뮬레이터가 **모으고 옮기는 두 걸음을 규칙대로 되풀이하는지** 본다.
//
// 군집 화면은 **틀려도 예쁘다** — 점이 색으로 갈리고 중심이 움직이면 학습으로 읽힌다.
// 그래서 여기서는 걸음마다 **오차 제곱합(각 점에서 제 중심까지 거리의 제곱을 다 더한 값)**을
// 직접 구해 본다. k-평균은 두 걸음 모두 이 값을 «절대 늘리지 않는» 것이 성질이므로,
// 한 번이라도 늘면 **모으는 규칙이나 옮기는 규칙 가운데 하나가 어긋난 것이다.**
// 이 성질은 페이지가 어떻게 짜였든 성립해야 하므로, 같은 실수를 함께 저지를 수가 없다.
//
// 보는 것.
//   1. **처음 중심을 실제 데이터 위에, 겹치지 않게 놓는가.** 점보다 k 가 크면 점 수만큼만 놓는다.
//   2. **모으는 걸음이 가장 가까운 중심을 고르고, 바뀌었는지를 제대로 알리는가.**
//   3. **옮기는 걸음이 소속 점들의 평균 자리인가.** 빈 군집은 제자리에 둔다.
//   4. **되풀이할수록 오차 제곱합이 줄기만 하고, 끝난 판에서는 옮길 점이 없는가.** ← 이 검사의 값어치
//   5. **뽑은 점이 판 안에 들어오는가.**
//
// **못 보는 것.** 중심이 미끄러져 가는 애니메이션은 볼 수 없다. 이 검사는 애니메이션이
// 끝난 자리(`targetX`·`targetY`)를 곧바로 중심 자리로 삼고 본다.

import {test, expect} from 'vitest';
import {loadSim, SIM_ROOT} from '../tools/_sim-harness.mjs';

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
};

const sim = loadSim('ai/unsupervised-k-means');
sim.lifecycle();
console.log(`k-평균 (${SIM_ROOT})`);
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

/** 흩어진 덩어리 셋을 손으로 놓는다 — 판마다 다르면 결함을 좇을 수 없다. */
function 점만들기(개수, 씨) {
    const 흔들 = mulberry32(씨);
    const 덩어리 = [[80, 80], [300, 120], [180, 320]];
    const 점들 = [];
    for (let i = 0; i < 개수; i++) {
        const [cx, cy] = 덩어리[i % 3];
        점들.push({x: cx + (흔들() - 0.5) * 90, y: cy + (흔들() - 0.5) * 90, cluster: -1});
    }
    return 점들;
}

/** 애니메이션이 끝난 자리로 중심을 앉힌다. 화면에서는 미끄러져 가는 그 자리다. */
const 중심앉히기 = () => P('kmeans.centroids.forEach(c => { c.x = c.targetX; c.y = c.targetY; })');

/** 오차 제곱합 — 각 점에서 제 중심까지 거리의 제곱을 다 더한 값. */
function 오차제곱합(점들, 중심들) {
    let 합 = 0;
    for (const p of 점들) {
        const c = 중심들.find((c) => c.clusterId === p.cluster);
        if (!c) continue;
        합 += (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    }
    return 합;
}

/* ================================================================
   1. 처음 중심
   ================================================================ */
for (const [점개수, k] of [[60, 3], [60, 5], [4, 6], [1, 3]]) {
    씨앗(점개수 * 31 + k);
    P(`dataManager.points = ${JSON.stringify(점만들기(점개수, 7))}`);
    P(`kmeans.initCentroids(${k}, 400, 400)`);
    const 중심 = P('kmeans.centroids');
    const 점들 = P('dataManager.points');
    if (중심.length !== Math.min(k, 점개수)) {
        bad(`처음 중심: 점 ${점개수}개에 k=${k} 인데 중심을 ${중심.length}개 놓았다`);
    }
    for (const c of 중심) {
        if (!점들.some((p) => p.x === c.x && p.y === c.y)) {
            bad(`처음 중심: (${c.x.toFixed(1)},${c.y.toFixed(1)}) 에 놓았는데 그 자리에 점이 없다`);
        }
    }
    if (new Set(중심.map((c) => `${c.x},${c.y}`)).size !== 중심.length) {
        bad('처음 중심: 두 중심이 같은 점 위에 겹쳤다 — 한쪽은 처음부터 빈 군집이 된다');
    }
    if (new Set(중심.map((c) => c.clusterId)).size !== 중심.length) bad('처음 중심: 군집 번호가 겹친다');
    if (점들.some((p) => p.cluster !== -1)) bad('처음 중심: 앞서 나눈 소속이 남아 있다');
}

/* ================================================================
   2 · 3. 모으는 걸음과 옮기는 걸음
   ================================================================ */
{
    씨앗(20260909);
    const 점들 = 점만들기(45, 99);
    P(`dataManager.points = ${JSON.stringify(점들)}`);
    P('kmeans.initCentroids(3, 400, 400)');
    중심앉히기();

    for (let 회 = 0; 회 < 6; 회++) {
        const 앞소속 = P('dataManager.points').map((p) => p.cluster);
        const 중심 = P('kmeans.centroids');
        const 바뀜 = P('kmeans.assignPoints()');
        const 뒤점들 = P('dataManager.points');

        // 가장 가까운 중심을 골랐는가
        for (const [i, p] of 뒤점들.entries()) {
            let 가장가까움 = Infinity, 골라야할것 = -1;
            for (const c of 중심) {
                const d = Math.hypot(p.x - c.x, p.y - c.y);
                if (d < 가장가까움) { 가장가까움 = d; 골라야할것 = c.clusterId; }
            }
            if (p.cluster !== 골라야할것) {
                bad(`모으기(${회 + 1}회차): ${i}번 점을 ${p.cluster}번에 넣었다 — 가장 가까운 중심은 ${골라야할것}번이다`);
                break;
            }
        }
        const 실제로바뀜 = 뒤점들.some((p, i) => p.cluster !== 앞소속[i]);
        if (바뀜 !== 실제로바뀜) bad(`모으기(${회 + 1}회차): 바뀌었는지를 ${바뀜} 로 알렸다 — 실제로는 ${실제로바뀜} 다`);

        // 옮기는 걸음 — 소속 점들의 평균 자리인가
        const 앞중심 = P('kmeans.centroids').map((c) => ({...c}));
        P('kmeans.calculateNewCentroids()');
        const 뒤중심 = P('kmeans.centroids');
        for (const [i, c] of 뒤중심.entries()) {
            const 소속 = 뒤점들.filter((p) => p.cluster === c.clusterId);
            if (!소속.length) {
                if (c.targetX !== 앞중심[i].targetX || c.targetY !== 앞중심[i].targetY) {
                    bad(`옮기기(${회 + 1}회차): 빈 군집 ${c.clusterId}번의 중심을 움직였다`);
                }
                continue;
            }
            const 평균x = 소속.reduce((a, p) => a + p.x, 0) / 소속.length;
            const 평균y = 소속.reduce((a, p) => a + p.y, 0) / 소속.length;
            if (Math.abs(c.targetX - 평균x) > 1e-9 || Math.abs(c.targetY - 평균y) > 1e-9) {
                bad(`옮기기(${회 + 1}회차): ${c.clusterId}번 중심을 (${c.targetX.toFixed(2)},${c.targetY.toFixed(2)}) 로 옮겼다 — 평균 자리는 (${평균x.toFixed(2)},${평균y.toFixed(2)}) 다`);
            }
        }
        중심앉히기();
    }
}

/* ================================================================
   4. 오차 제곱합은 줄기만 하고, 끝나면 옮길 점이 없다
   ================================================================ */
for (const [k, 씨] of [[2, 11], [3, 22], [5, 33], [8, 44]]) {
    씨앗(씨);
    const 점들 = 점만들기(80, 씨 * 3);
    P(`dataManager.points = ${JSON.stringify(점들)}`);
    P(`kmeans.initCentroids(${k}, 400, 400)`);
    중심앉히기();
    P('kmeans.assignPoints()');

    let 앞오차 = 오차제곱합(P('dataManager.points'), P('kmeans.centroids'));
    let 회 = 0;
    for (; 회 < 200; 회++) {
        P('kmeans.calculateNewCentroids()');
        중심앉히기();
        const 옮긴뒤 = 오차제곱합(P('dataManager.points'), P('kmeans.centroids'));
        if (옮긴뒤 > 앞오차 + 1e-6) {
            bad(`k=${k}: 중심을 옮겼더니 오차 제곱합이 ${앞오차.toFixed(1)} → ${옮긴뒤.toFixed(1)} 로 늘었다`);
            break;
        }
        const 바뀜 = P('kmeans.assignPoints()');
        const 모은뒤 = 오차제곱합(P('dataManager.points'), P('kmeans.centroids'));
        if (모은뒤 > 옮긴뒤 + 1e-6) {
            bad(`k=${k}: 다시 모았더니 오차 제곱합이 ${옮긴뒤.toFixed(1)} → ${모은뒤.toFixed(1)} 로 늘었다`);
            break;
        }
        앞오차 = 모은뒤;
        if (!바뀜) break;
    }
    if (회 >= 200) bad(`k=${k}: 200회를 되풀이해도 소속이 멎지 않는다`);

    // 끝난 판에서는 어느 점도 다른 중심이 더 가깝지 않아야 한다
    const 끝점들 = P('dataManager.points');
    const 끝중심 = P('kmeans.centroids');
    for (const p of 끝점들) {
        const 제중심 = 끝중심.find((c) => c.clusterId === p.cluster);
        const 더가까운것 = 끝중심.find((c) => Math.hypot(p.x - c.x, p.y - c.y) < Math.hypot(p.x - 제중심.x, p.y - 제중심.y) - 1e-9);
        if (더가까운것) {
            bad(`k=${k}: 끝난 판인데 (${p.x.toFixed(0)},${p.y.toFixed(0)}) 는 ${더가까운것.clusterId}번 중심이 더 가깝다`);
            break;
        }
    }
    // 빈 군집이 남으면 화면에는 색만 있고 점이 없는 중심이 떠 있게 된다
    const 빈군집 = 끝중심.filter((c) => !끝점들.some((p) => p.cluster === c.clusterId));
    if (빈군집.length) {
        console.log(`  · k=${k}: 빈 군집 ${빈군집.length}개 (점보다 중심이 많으면 생길 수 있다)`);
    }
}

/* ================================================================
   5. 뽑은 점이 판 안에 들어오는가
   ================================================================ */
for (const 흩음 of [40, 100, 200]) {
    씨앗(흩음);
    P(`dataManager.generateRandom(400, 300, 120, ${흩음})`);
    const 점들 = P('dataManager.points');
    if (점들.length !== 120) bad(`무작위 자료: 점을 ${점들.length}개 뽑았다 — 120개를 부탁했다`);
    for (const p of 점들) {
        if (p.x < 10 || p.x > 390 || p.y < 10 || p.y > 290) {
            bad(`무작위 자료(흩음 ${흩음}): (${p.x.toFixed(0)},${p.y.toFixed(0)}) 가 판 밖으로 나갔다`);
            break;
        }
    }
    if (점들.some((p) => p.cluster !== -1)) bad('무작위 자료: 새로 뽑은 점에 소속이 붙어 있다');
}

console.log(fail ? `\n✗ ${fail}건` : '\n✓ 모두 통과');
test('kmeans', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
