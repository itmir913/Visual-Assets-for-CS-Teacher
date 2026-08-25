/* 정렬 알고리즘을 **실제로 돌려** 대조한다.
 *
 * 화면만 보고는 알아챌 수 없는 것들이 있다. 막대가 그럴듯하게 움직여도 결과가 틀릴 수
 * 있고, 카드에 「안정 정렬」이라 적어 두고 화면에서는 같은 값의 앞뒤가 뒤집힐 수 있다.
 * **카드에 적힌 말과 화면에서 벌어지는 일이 어긋나는 것이 가장 나쁜 결함이다** —
 * 학생이 외우는 것은 카드이기 때문이다.
 *
 * **정답을 베끼지 않는다.** 기대값은 알고리즘이 만든 스냅샷이 아니라
 * `Array.prototype.sort` 로 따로 구한다. 같은 코드로 두 번 구하면 아무것도 대조하지 못한다.
 */

import {SORT_ALGOS} from '../src/entries/_lib/sort/sort-registry.js';
import {runSortAlgorithm, sortIsStable} from '../src/entries/_lib/sort/sort-model.js';
import {makeSortData, SORT_PRESETS, SORT_N_MAX} from '../src/entries/_lib/sort/sort-data.js';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 30) console.log('  ✗ ' + m); };

const SIZES = [1, 2, 3, 6, 7, 16, 24, SORT_N_MAX];
const SEEDS = [1, 7, 12345, 99991];

/** 스냅샷 한 장이 성한가 — 알갱이가 사라지거나 늘어나지 않았는가. */
function frameIsSound(frame, ids) {
    const seen = [];
    for (const it of frame.a) if (it) seen.push(it.id);
    for (const b of frame.aux || []) for (const it of b.items) if (it) seen.push(it.id);
    // 보조 칸은 **떠 온 것**이라 주 배열과 겹칠 수 있다. 겹침을 걷어 내고 센다.
    const uniq = new Set(seen);
    for (const id of uniq) if (!ids.has(id)) return `없던 알갱이 ${id}`;
    // 들고 있는 것(hold)은 배열에서 빠져 있다. 그것까지 세면 전부여야 한다.
    const held = frame.marks.held ? 1 : 0;
    if (uniq.size + (held && !uniq.has(frame.marks.held.item.id) ? 1 : 0) !== ids.size) {
        return `알갱이 ${uniq.size + held}개, 있어야 할 것 ${ids.size}개`;
    }
    return null;
}

console.log(`정렬 알고리즘 ${SORT_ALGOS.length}종을 `
    + `자료 ${SORT_PRESETS.length}가지 × 크기 ${SIZES.length}가지 × 씨앗 ${SEEDS.length}가지로 돌린다`);

const rows = [];

for (const algo of SORT_ALGOS) {
    let runs = 0;
    let maxFrames = 0;
    let stableSeen = true;
    const cmpOf = {};

    for (const preset of SORT_PRESETS) {
        for (const n of SIZES) {
            for (const seed of SEEDS) {
                const values = makeSortData(preset.id, n, seed);
                const out = runSortAlgorithm(algo, values);
                runs++;
                maxFrames = Math.max(maxFrames, out.frames.length);

                if (!out.sorted) {
                    bad(`${algo.id} · ${preset.id} n=${n} seed=${seed} — 정렬되지 않았다: `
                        + out.values.slice(0, 12).join(' '));
                    continue;
                }
                if (out.overflow) {
                    bad(`${algo.id} · ${preset.id} n=${n} — 스냅샷 상한을 넘겼다`);
                }

                /* 알고리즘이 스스로 신고한 안정성과 **실제로 벌어진 일**을 맞춰 본다. */
                const stable = sortIsStable(out.frames, values);
                if (algo.stable && !stable) {
                    bad(`${algo.id} · ${preset.id} n=${n} seed=${seed} — `
                        + `안정 정렬이라고 적어 두었는데 같은 값의 앞뒤가 뒤집혔다`);
                }
                if (!stable) stableSeen = false;

                /* 스냅샷마다 알갱이가 성한지. 옮기다 흘리면 화면에서 상자가 사라진다. */
                const ids = new Set(values.map((_, i) => i));
                for (let f = 0; f < out.frames.length; f++) {
                    const why = frameIsSound(out.frames[f], ids);
                    if (why) {
                        bad(`${algo.id} · ${preset.id} n=${n} — ${f}번째 장이 성하지 않다: ${why}`);
                        break;
                    }
                }

                /* 마지막 장은 **전부 확정**으로 찍혀 있어야 한다.
                   확정 표시를 빠뜨리면 다 끝났는데도 화면이 아직 도는 것처럼 보인다. */
                const last = out.frames[out.frames.length - 1];
                if (last.marks.done.length !== n) {
                    bad(`${algo.id} · ${preset.id} n=${n} — 끝났는데 확정 표시가 `
                        + `${last.marks.done.length}/${n}개다`);
                }

                /* 세는 값이 거꾸로 가지 않는가. 화면의 숫자가 줄어들면 학생이 헷갈린다. */
                let prev = -1;
                for (const fr of out.frames) {
                    if (fr.counts.compare < prev) {
                        bad(`${algo.id} · ${preset.id} n=${n} — 비교 횟수가 줄었다`);
                        break;
                    }
                    prev = fr.counts.compare;
                }

                if (n === SORT_N_MAX && seed === SEEDS[0]) cmpOf[preset.id] = out.counts.compare;
            }
        }
    }

    /* **「최선 O(n)」이라 적었으면 이미 정렬된 자료에서 실제로 그래야 한다.**
       멈춤 장치를 빠뜨린 채 최선을 O(n)이라 적는 것이 흔한 어긋남이다. */
    if (algo.complexity.best === 'O(n)') {
        const values = Array.from({length: SORT_N_MAX}, (_, i) => i + 1);
        const out = runSortAlgorithm(algo, values);
        if (out.counts.compare > SORT_N_MAX * 2) {
            bad(`${algo.id} — 최선을 O(n)이라 적었는데 이미 정렬된 ${SORT_N_MAX}개에서 `
                + `${out.counts.compare}번 비교했다`);
        }
    }

    /* 신고한 것과 실제가 어긋나는 반대 방향도 본다 — 안정한데 아니라고 적어 둔 경우. */
    if (!algo.stable && stableSeen) {
        bad(`${algo.id} — 안정 정렬이 아니라고 적어 두었는데 어떤 자료에서도 뒤집히지 않았다`);
    }

    rows.push({
        id: algo.id,
        name: algo.name,
        runs,
        maxFrames,
        cmp: cmpOf,
    });
}

const w = Math.max(...rows.map((r) => r.name.length));
for (const r of rows) {
    const c = SORT_PRESETS.map((p) => `${p.name} ${String(r.cmp[p.id] ?? '-').padStart(5)}`).join(' · ');
    console.log(`  ${r.name.padEnd(w)}  판 ${String(r.runs).padStart(3)} · `
        + `가장 긴 기록 ${String(r.maxFrames).padStart(5)}장   비교 횟수(n=${SORT_N_MAX}): ${c}`);
}

console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
