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
import {
    makeSortData, SORT_PRESETS, SORT_N_MAX, SORT_SIZES, SORT_N_DEFAULT,
} from '../src/entries/_lib/sort/sort-data.js';
import {loadSim} from './_sim-harness.mjs';

let fail = 0;
const bad = (m) => { fail++; if (fail <= 30) console.log('  ✗ ' + m); };

const SIZES = [1, 2, 3, 6, 7, 16, 24, SORT_N_MAX];
const SEEDS = [1, 7, 12345, 99991];

/** 스냅샷 한 장이 성한가 — 원소가 사라지거나 늘어나지 않았는가. */
function frameIsSound(frame, ids) {
    const seen = [];
    for (const it of frame.a) if (it) seen.push(it.id);
    for (const b of frame.aux || []) for (const it of b.items) if (it) seen.push(it.id);
    // 임시 배열은 **복사해 온 것**이라 주 배열과 겹칠 수 있다. 겹침을 걷어 내고 센다.
    const uniq = new Set(seen);
    for (const id of uniq) if (!ids.has(id)) return `없던 원소 ${id}`;
    // 임시 저장한 원소(hold)은 배열에서 빠져 있다. 그것까지 세면 전부여야 한다.
    const held = frame.marks.held ? 1 : 0;
    if (uniq.size + (held && !uniq.has(frame.marks.held.item.id) ? 1 : 0) !== ids.size) {
        return `원소 ${uniq.size + held}개, 있어야 할 것 ${ids.size}개`;
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
                /* **솎아 기록한 판은 「한 단계 = 한 걸음」이 아니다.** 화면이 그 사실을
                   밝히도록 `stride` 를 내보내고 있으니, 여기서는 그 값이 성한지만 본다. */
                if (!(out.stride >= 1) || out.frames.length < 2) {
                    bad(`${algo.id} · ${preset.id} n=${n} — 기록이 성하지 않다 `
                        + `(장 ${out.frames.length}, 간격 ${out.stride})`);
                }

                /* 알고리즘이 스스로 신고한 안정성과 **실제로 벌어진 일**을 맞춰 본다. */
                const stable = sortIsStable(out.frames, values);
                if (algo.stable && !stable) {
                    bad(`${algo.id} · ${preset.id} n=${n} seed=${seed} — `
                        + `안정 정렬이라고 적어 두었는데 같은 값의 앞뒤가 뒤집혔다`);
                }
                if (!stable) stableSeen = false;

                /* 스냅샷마다 원소가 성한지. 옮기다 흘리면 화면에서 상자가 사라진다. */
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

/* ================================================================
   페이지를 띄워 **종목마다 실제로 눌러 본다**

   위쪽 검사는 알고리즘의 계산만 본다. 그런데 종목마다 화면이 다르고(힙은 트리를
   함께 그린다), 그 화면을 만드는 코드는 계산이 성해도 죽을 수 있다.
   `check:sims` 는 **id 가 붙은 단추만** 눌러 보는데 종목을 고르는 칩에는 id 가 없어
   기본 종목 하나만 열어 본다 — 나머지 일곱은 아무도 안 여는 셈이었다.
   ================================================================ */

const page = loadSim('cs/sort', {box: {w: 900, h: 700}});
page.lifecycle();
for (const e of page.errors) bad(`페이지를 띄우다가 — ${e}`);

/** `#bars-host` 아래에 무엇이 몇 개 그려졌는지 센다. */
function drawn(sim) {
    const tally = {};
    const walk = (el) => {
        tally[el.tagName] = (tally[el.tagName] || 0) + 1;
        for (const c of el.children || []) walk(c);
    };
    for (const c of sim.el('bars-host').children) walk(c);
    return tally;
}

const SICK = /NaN|Infinity|undefined/;

function screenSick(sim) {
    for (const el of sim.byId.values()) {
        for (const v of [el._text, el._html]) {
            if (typeof v === 'string' && SICK.test(v)) return `#${el.id}: ${v.slice(0, 50)}`;
        }
    }
    return null;
}

function setSize(sim, idx) {
    const sl = sim.el('n-slider');
    sl.value = String(idx);
    sl.dispatchEvent({type: 'input', target: sl});
    sl.dispatchEvent({type: 'change', target: sl});
}

const pageRows = [];
for (const group of [...page.el('group-tabs').children]) {
    group.click();
    for (const chip of [...page.el('algo-tabs').children]) {
        const name = chip.textContent;
        for (const [label, idx] of [['기본', SORT_SIZES.indexOf(SORT_N_DEFAULT)], ['큰 배열', SORT_SIZES.length - 1]]) {
            const before = page.errors.length;
            chip.click();
            setSize(page, idx);
            page.el('btn-last').click();

            for (const e of page.errors.slice(before)) bad(`${name} · ${label} — ${e}`);

            const sick = screenSick(page);
            if (sick) bad(`${name} · ${label} — 화면에 성하지 않은 값: ${sick}`);

            const say = page.el('say').textContent;
            if (!say.includes('정렬이 끝났습니다')) {
                bad(`${name} · ${label} — 끝까지 갔는데 「정렬이 끝났습니다」가 아니다: ${say.slice(0, 40)}`);
            }

            const tally = drawn(page);
            if (label === '기본') {
                const n = SORT_N_DEFAULT;
                /* 막대·빈칸·자리번호가 자리마다 하나씩. 뷰가 조용히 안 그리면 여기서 걸린다. */
                if (!(tally.DIV >= n * 3)) bad(`${name} — 막대가 덜 그려졌다 (div ${tally.DIV || 0}개)`);
                pageRows.push(`${name}: ${page.el('step-label').textContent} · ${JSON.stringify(tally)}`);
            }
        }
    }
}

/* **그리는 동안 어떤 상자의 높이도 바뀌면 안 된다.**

   단계를 넘길 때 그림 상자가 늘었다 줄었다 하면 그 아래에 있는 단추가 아래위로
   움직이고, 그러면 **같은 자리를 되풀이해 누를 수가 없다** — 넘기기가 이 시뮬레이터에서
   가장 잦은 동작이라 조작이 통째로 어긋난다. 받침대는 배치를 계산하지 않지만
   «높이를 써 넣었는지»는 볼 수 있으므로, 그것으로 대신 지킨다. */
function heightMap(sim) {
    const out = new Map();
    const walk = (el, path) => {
        const h = el.style.height || '';
        if (h) out.set(path, h);
        (el.children || []).forEach((c, i) => walk(c, `${path}/${i}`));
    };
    sim.el('bars-host').children.forEach((c, i) => walk(c, String(i)));
    return out;
}

for (const group of [...page.el('group-tabs').children]) {
    group.click();
    for (const chip of [...page.el('algo-tabs').children]) {
        const name = chip.textContent;
        chip.click();
        setSize(page, SORT_SIZES.indexOf(SORT_N_DEFAULT));
        page.el('btn-first').click();
        const before = heightMap(page);

        /* **한 단계씩 넘기며 «매번» 대 본다.** 처음과 끝만 대 보면 안 된다 —
           임시 배열 칸은 중간에만 나타났다 사라지므로 양 끝의 높이는 같다.
           실제로 그렇게 짰다가, 일부러 되돌려 놓은 결함을 못 잡는 것을 보고 고쳤다. */
        /* **처음 장에 높이가 적혀 있던 상자만 본다.** 구간 띠처럼 도중에 생겼다
           사라지는 것은 세지 않는다 — 그것들은 «비워 둔 자리 안에서» 그려지므로
           바깥 높이를 흔들지 않는다. 흔드는 것은 자리를 잡아 둔 상자뿐이다. */
        let moved = null;
        for (let k = 0; k < 400 && !moved; k++) {
            if (page.el('btn-next').disabled) break;
            page.el('btn-next').click();
            const now = heightMap(page);
            for (const [path, h] of before) {
                if (now.get(path) !== h) {
                    moved = `${k + 1}단계 · ${path}: ${h} → ${now.get(path) || '(사라짐)'}`;
                    break;
                }
            }
        }
        if (moved) bad(`${name} — 단계를 넘기는 동안 상자 높이가 바뀌었다(${moved}). 단추가 움직인다`);
    }
}

/* **힙 정렬은 트리가 실제로 그려져야 한다.** 이 종목의 요점이 「배열이 곧 트리」인데
   트리가 없으면 그냥 배열 그림 하나짜리 종목이 된다. */
for (const group of [...page.el('group-tabs').children]) {
    group.click();
    const chip = [...page.el('algo-tabs').children].find((c) => c.textContent === '힙 정렬');
    if (!chip) continue;
    chip.click();
    setSize(page, SORT_SIZES.indexOf(SORT_N_DEFAULT));
    const tally = drawn(page);
    if (!tally.CIRCLE || tally.CIRCLE !== SORT_N_DEFAULT) {
        bad(`힙 정렬 — 트리 마디가 ${tally.CIRCLE || 0}개다(있어야 할 것 ${SORT_N_DEFAULT}개)`);
    }
    if (!tally.LINE || tally.LINE !== SORT_N_DEFAULT - 1) {
        bad(`힙 정렬 — 트리 가지가 ${tally.LINE || 0}개다(있어야 할 것 ${SORT_N_DEFAULT - 1}개)`);
    }
    // 마디가 많으면 트리를 그리지 않는다고 알려야 한다 — 조용히 사라지면 결함으로 보인다.
    setSize(page, SORT_SIZES.length - 1);
    const big = drawn(page);
    if (big.CIRCLE) bad(`힙 정렬 — 1000개인데 트리 마디를 ${big.CIRCLE}개 그렸다`);
}

/* **범례에 있는 색은 화면에 나타나야 한다.**
   쓰이지 않는 색이 범례에 남아 있으면 학생이 「아직 못 본 무언가가 있다」고 여기며
   찾게 된다. 실제로 피벗 색이 그랬다 — 퀵 정렬은 구간의 모든 칸을 피벗과 비교하는데
   비교 색이 피벗 색을 덮어써서 보라색이 한 번도 뜨지 않았다. */
const toneSeen = new Set(['idle']);
for (const algo of SORT_ALGOS) {
    const out = runSortAlgorithm(algo, makeSortData('random', SORT_N_DEFAULT, 7));
    for (const f of out.frames) {
        if (f.marks.compare) toneSeen.add('compare');
        if (f.marks.moving.length) toneSeen.add('moving');
        if (f.marks.held) toneSeen.add('held');
        if (f.marks.pivot !== null && f.marks.pivot !== undefined) toneSeen.add('pivot');
        if (f.marks.done.length) toneSeen.add('done');
    }
}
for (const key of ['idle', 'compare', 'moving', 'held', 'pivot', 'done']) {
    if (!toneSeen.has(key)) bad(`범례의 「${key}」 색이 어느 종목에서도 쓰이지 않는다`);
}

console.log('페이지를 띄워 종목마다 끝까지 돌려 보았다');
for (const r of pageRows) console.log('  ' + r);

console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
