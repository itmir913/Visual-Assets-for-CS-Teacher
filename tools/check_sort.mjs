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
import {runSortAlgorithm, sortIsStable, sortFrameBudget} from '../src/entries/_lib/sort/sort-model.js';
import {
    makeSortData, SORT_PRESETS, SORT_N_MAX, SORT_SIZES, SORT_N_DEFAULT,
} from '../src/entries/_lib/sort/sort-data.js';
import {buildSortRace, RACE_MAX_N} from '../src/entries/_lib/sort/sort-race.js';
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
    // 분배 정렬은 원소가 **칸 줄**에 가 있는 동안 배열이 비어 있다. 그것도 세야 한다.
    for (const c of (frame.strip && frame.strip.cells) || []) {
        for (const it of c.items) if (it) seen.push(it.id);
    }
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
                const values = makeSortData(preset.id, n, seed, algo.valueMax ?? null);
                const out = runSortAlgorithm(algo, values);
                runs++;
                maxFrames = Math.max(maxFrames, out.frames.length);

                if (!out.sorted) {
                    bad(`${algo.id} · ${preset.id} n=${n} seed=${seed} — 정렬되지 않았다: `
                        + out.values.slice(0, 12).join(' '));
                    continue;
                }
                /* **솎았으면 장 수가 예산 안이어야 한다.** 예전에는 `stride >= 1` 인지를
                   봤는데 그것은 참이 될 수 없는 조건이라 **아무것도 보지 않는 가지**였다. */
                if (out.frames.length > sortFrameBudget(n) + 2) {
                    bad(`${algo.id} · ${preset.id} n=${n} — 장이 예산을 넘었다 `
                        + `(${out.frames.length} > ${sortFrameBudget(n)})`);
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

                /* **「확정」으로 찍은 칸의 내용은 끝까지 바뀌면 안 된다.**
                   예전에는 「마지막 장이 전부 확정인가」를 봤는데, `finish()`가 어차피
                   전부 찍으므로 늘 통과하는 **죽은 가지**였다. 실제로 삽입 정렬이
                   아직 밀려날 자리를 확정으로 칠하고 있었고 그 검사는 통과했다. */
                const fixedAt = new Map();
                for (const f of out.frames) {
                    for (const i of f.marks.done) {
                        const it = f.a[i];
                        if (!it) continue;
                        if (fixedAt.has(i) && fixedAt.get(i) !== it.id) {
                            bad(`${algo.id} · ${preset.id} n=${n} — 확정으로 찍은 ${i}번 칸의 `
                                + '내용이 나중에 바뀐다. 확정이 아닌 것을 확정으로 칠하고 있다');
                            break;
                        }
                        if (!fixedAt.has(i)) fixedAt.set(i, it.id);
                    }
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

                /* **제자리 정렬이라 적었으면 배열 밖에 자리를 만들면 안 된다.**
                   신고값과 실제가 어긋나는 것은 카드가 거짓말을 하는 것이다. */
                if (algo.inPlace && out.frames.some((f) => (f.aux && f.aux.length) || f.strip)) {
                    bad(`${algo.id} — 제자리 정렬이라 적어 두고 배열 밖 칸을 쓴다`);
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
   페이지를 띄워 **알고리즘마다 실제로 눌러 본다**

   위쪽 검사는 알고리즘의 계산만 본다. 그런데 알고리즘마다 화면이 다르고(힙은 트리를
   함께 그린다), 그 화면을 만드는 코드는 계산이 성해도 죽을 수 있다.
   `check:sims` 는 **id 가 붙은 단추만** 눌러 보는데 알고리즘을 고르는 칩에는 id 가 없어
   기본 알고리즘 하나만 열어 본다 — 나머지 일곱은 아무도 안 여는 셈이었다.
   ================================================================ */

const page = loadSim('cs/sort', {box: {w: 900, h: 700}});
page.lifecycle();
for (const e of page.errors) bad(`페이지를 띄우다가 — ${e}`);

/** `#bars-host` 아래에 무엇이 몇 개 그려졌는지 센다. */
/* **태그 이름은 대문자로 맞춰 센다.** 진짜 DOM 에서 HTML 요소의 `tagName` 은 대문자인데
   **SVG 요소는 소문자 그대로다**(`svg` · `g` · `circle` · `line`). */
function drawn(sim) {
    const tally = {};
    const walk = (el) => {
        const 이름 = String(el.tagName).toUpperCase();
        tally[이름] = (tally[이름] || 0) + 1;
        for (const c of el.children || []) walk(c);
    };
    for (const c of sim.el('bars-host').children) walk(c);
    return tally;
}

const SICK = /NaN|Infinity|undefined/;

function screenSick(sim) {
    for (const el of sim.texts()) {
        for (const v of [el.text, el.html]) {
            if (typeof v === 'string' && SICK.test(v)) return `#${el.id}: ${v.slice(0, 50)}`;
        }
    }
    return null;
}

function setSize(sim, idx) {
    const sl = sim.el('n-slider');
    sl.value = String(idx);
    /* **진짜 사건을 쏜다.** 예전에는 `{type:'input'}` 같은 평범한 객체를 넘겼는데,
       받침대가 jsdom 으로 바뀌면서 그것은 사건이 아니라고 거절당한다. 잘된 일이다 —
       `target`·버블링·`preventDefault` 가 전부 진짜가 된다. */
    sl.dispatchEvent(new sim.window.Event('input', {bubbles: true}));
    sl.dispatchEvent(new sim.window.Event('change', {bubbles: true}));
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

            /* 끝 장의 말이 「끝났다」인가. 알고리즘 비교는 정렬이 아니라 판이 끝나는 것이므로
               제 나름의 말을 쓴다 — 낱말 하나로 묶어 둘 다 받는다. */
            const say = page.el('say').textContent;
            if (!say.includes('끝났습니다')) {
                bad(`${name} · ${label} — 끝까지 갔는데 끝났다는 말이 없다: ${say.slice(0, 40)}`);
            }
            if (!page.el('btn-next').disabled) {
                bad(`${name} · ${label} — 「끝으로」를 눌렀는데 「앞으로」가 아직 살아 있다`);
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
   움직이고, 그러면 **같은 자리를 거듭해 누를 수가 없다** — 넘기기가 이 시뮬레이터에서
   가장 잦은 동작이라 조작이 통째로 어긋난다. 받침대는 배치를 계산하지 않지만
   «높이를 써 넣었는지»는 볼 수 있으므로, 그것으로 대신 지킨다. */
function heightMap(sim) {
    const out = new Map();
    const walk = (el, path) => {
        /* **자리에서 띄워 놓은 상자는 세지 않는다.** 막대는 `position: absolute` 라
           높이가 바뀌어도 바깥 흐름을 밀지 않는다 — 알고리즘 비교 줄에서는 막대 높이가
           «곧 그림»이므로 그것까지 잡으면 검사가 헛돈다. 흐름을 미는 것,
           곧 자리를 잡고 있는 상자만 본다. */
        if (el.style.position === 'absolute') return;
        const h = el.style.height || '';
        if (h) out.set(path, h);
        [...(el.children || [])].forEach((c, i) => walk(c, `${path}/${i}`));
    };
    /* 진짜 DOM 의 `children` 은 배열이 아니라 `HTMLCollection` 이다 — 펴서 쓴다. */
    [...sim.el('bars-host').children].forEach((c, i) => walk(c, String(i)));
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

/* **힙 정렬은 트리가 실제로 그려져야 한다.** 이 알고리즘의 요점이 「배열이 곧 트리」인데
   트리가 없으면 그냥 배열 그림 하나짜리 알고리즘이 된다. */
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
    const out = runSortAlgorithm(algo, makeSortData('random', SORT_N_DEFAULT, 7, algo.valueMax ?? null));
    for (const f of out.frames) {
        if (f.marks.compare) toneSeen.add('compare');
        if (f.marks.moving.length) toneSeen.add('moving');
        if (f.marks.held) toneSeen.add('held');
        if (f.marks.pivot !== null && f.marks.pivot !== undefined) toneSeen.add('pivot');
        if (f.marks.done.length) toneSeen.add('done');
    }
}
for (const key of ['idle', 'compare', 'moving', 'held', 'pivot', 'done']) {
    if (!toneSeen.has(key)) bad(`범례의 「${key}」 색이 어느 알고리즘에서도 쓰이지 않는다`);
}

console.log('페이지를 띄워 알고리즘마다 끝까지 돌려 보았다');
for (const r of pageRows) console.log('  ' + r);

/* ================================================================
   비교가 공정한가

   화면이 「먼저 끝난 쪽이 실제로 일을 덜 한 것」이라고 말한다. 그 말이 참이려면
   **끝나는 차례가 작업량의 차례와 같아야** 한다. 처음에는 기록된 장을 하나씩
   나눠 주었는데, 한 장의 무게가 알고리즘마다 달라 **일을 가장 적게 한 계수 정렬이
   꼴찌로 끝났다.** 화면이 그렇게 말하는 한, 그 말을 검사가 붙들어야 한다.
   ================================================================ */

const RACE_SIZES = [8, 32, RACE_MAX_N];
let raceChecks = 0;

for (const preset of SORT_PRESETS) {
    for (const n of RACE_SIZES) {
        const values = makeSortData(preset.id, n, 20260825, null);

        /* 알고리즘 비교의 전제 — **어느 알고리즘도 걸음이 솎이지 않아야 한다.**
           한쪽만 솎이면 그 알고리즘만 성글게 기록되어 알고리즘 비교가 기울어진다. */
        for (const algo of SORT_ALGOS) {
            const out = runSortAlgorithm(algo, values);
            if (out.stride !== 1) {
                bad(`알고리즘 비교 ${preset.id} n=${n} — ${algo.name}이 ${out.stride}걸음마다 솎였다. `
                    + `크기 천장(${RACE_MAX_N})을 낮춰야 한다`);
            }
        }

        /* **작업량을 알고리즘 비교에게 묻지 않는다.** 알고리즘 비교가 내놓는 `finishedWork`로
           알고리즘 비교를 대조하면 축을 무엇으로 바꾸든 늘 통과하는 **순환 논리**가 된다
           (실제로 그렇게 짰다가, 옛 판으로 되돌려 놓고도 통과하는 것을 보고 고쳤다).
           기대값은 알고리즘을 따로 돌려 구한다. */
        const trueWork = new Map(SORT_ALGOS.map((algo) => {
            const out = runSortAlgorithm(algo, values, {countOnly: true});
            return [algo.id, out.counts.compare + out.counts.move + out.counts.access];
        }));

        const {frames} = buildSortRace(values);
        const lanes = frames[frames.length - 1].race;
        const order = lanes
            .map((l, k) => ({
                name: l.algo.name,
                work: trueWork.get(l.algo.id),
                at: frames.findIndex((f) => f.race[k].done),
            }))
            .sort((a, b) => a.at - b.at);
        for (let i = 1; i < order.length; i++) {
            if (order[i].work < order[i - 1].work) {
                bad(`알고리즘 비교 ${preset.id} n=${n} — ${order[i].name}(작업량 ${order[i].work})이 `
                    + `${order[i - 1].name}(${order[i - 1].work})보다 늦게 끝난다. 「먼저 끝난 쪽이 `
                    + '일을 덜 했다」가 거짓이 된다');
            }
        }
        raceChecks++;
    }
}
console.log(`알고리즘 비교 ${raceChecks}판 — 끝나는 차례가 작업량의 차례와 같은지 대조했다`);

/* ================================================================
   「직접 넣기」로 막아야 할 값을 넣어 본다

   계수·기수 정렬은 음수를 받으면 그 자리에서 죽는다. 막는 것은 `checkSortInput`
   하나뿐인데, 그 가드가 검사에 걸려 있지 않아 **깨져도 아무도 몰랐다.**
   ================================================================ */

for (const group of [...page.el('group-tabs').children]) {
    group.click();
    for (const chip of [...page.el('algo-tabs').children]) {
        const name = chip.textContent;
        chip.click();
        const before = page.errors.length;
        page.el('input-text').value = '-3 5 -1 8 2 -7 4 6';
        page.el('btn-apply-input').click();
        for (const e of page.errors.slice(before)) {
            bad(`${name} — 음수를 직접 넣었더니 죽었다: ${e}`);
        }
        const sick = screenSick(page);
        if (sick) bad(`${name} — 음수를 넣은 뒤 화면에 성하지 않은 값: ${sick}`);
        if (!page.el('say').textContent.trim()) {
            bad(`${name} — 음수를 넣은 뒤 설명이 비었다`);
        }

        /* **막아야 하는 알고리즘은 실제로 막았다고 말해야 한다.** 계수·기수는 값을 칸의
           자리로 쓰므로 음수를 받으면 그 자리에서 죽는다. 조용히 지나가면
           다음에 누가 가드를 지웠을 때 아무도 모른다. */
        const algo = SORT_ALGOS.find((a) => a.name === name);
        if (algo && algo.needs && algo.needs.nonNegative) {
            if (!page.el('input-error').textContent.trim()) {
                bad(`${name} — 음수를 막아야 하는데 아무 말도 하지 않았다`);
            }
        }
    }
}
console.log('직접 넣기 — 음수를 전체 알고리즘에 넣어 보았다');

console.log(fail === 0 ? '전부 통과' : '어긋난 것 ' + fail + '건');
process.exit(fail === 0 ? 0 : 1);
