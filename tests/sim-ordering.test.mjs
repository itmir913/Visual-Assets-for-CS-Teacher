/* 정렬 시뮬레이터의 **세는 값 · 단계마다의 불변식 · 화면 문장**을 대조한다.
 *
 * `sim-sort` 는 결과·안정성·화면이 죽지 않는지를 보고, 여기는 그 안쪽을 본다.
 * 파일을 나눈 까닭은 속도다 — `sim-sort` 는 큰 배열과 알고리즘 비교 화면을 끝까지 그려
 * 몇 분이 걸리는데, 세는 값에 심은 돌연변이를 확인할 때마다 그것까지 기다릴 까닭이 없다.
 * 이름에 `sort` 를 넣지 않은 것은 `check -- sim sort` · `mutate -- sim-sort` 와 겹치지 않게 하려는 것이다.
 *
 * **정답을 베끼지 않는다.** 기대값은 알고리즘을 다시 짜서 구하지 않고 정의에서 곧바로 나오는
 * 값으로 구한다 — 역순쌍 수, n(n−1)/2, 힙 속성, 분할의 좌우, 값의 도수, 아래 자리로 한 안정 정렬.
 */

import {test, expect} from 'vitest';
import {SORT_ALGOS, SORT_GROUPS, sortAlgosOfGroup} from '../src/entries/_lib/sort/sort-registry.js';
import {runSortAlgorithm} from '../src/entries/_lib/sort/sort-model.js';
import {
    makeSortData, SORT_PRESETS, SORT_N_MAX, parseSortInput, checkSortInput,
} from '../src/entries/_lib/sort/sort-data.js';
import {loadSim} from '../tools/_sim-harness.mjs';

const page = loadSim('cs/sort', {box: {w: 900, h: 700}});
page.lifecycle();

let fail2 = 0;
const bad2 = (m) => { fail2++; if (fail2 <= 40) console.log('  ✗ ' + m); };

const asc = (v) => [...v].sort((x, y) => x - y);
const vals = (f) => f.a.map((it) => (it ? it.v : null));
const range = (a, b) => Array.from({length: b - a + 1}, (_, i) => a + i);
const nonDecreasing = (v) => v.every((x, i) => i === 0 || v[i - 1] <= x);

/** 역순쌍 수 — i<j 인데 v[i]>v[j] 인 짝. **이웃끼리 교환하는 정렬의 교환 횟수가 정확히 이것이다.** */
function inversions(v) {
    let c = 0;
    for (let i = 0; i < v.length; i++) for (let j = i + 1; j < v.length; j++) if (v[i] > v[j]) c++;
    return c;
}
/** 앞의 모든 값보다 «엄격히» 작은 자리 수(0번 제외). 삽입 정렬이 멈춤 비교 없이 맨 앞까지 가는 횟수다. */
function strictPrefixMins(v) {
    let c = 0;
    let m = v[0];
    for (let i = 1; i < v.length; i++) if (v[i] < m) { c++; m = v[i]; }
    return c;
}
/** 앞 `size` 칸이 최대 힙인가 — 부모 (i−1)/2 가 자식보다 작지 않다. */
function isMaxHeap(v, size) {
    for (let i = 1; i < size; i++) if (v[(i - 1) >> 1] < v[i]) return false;
    return true;
}
/** 이 장에서 새로 확정으로 찍힌 칸. */
function newlyDone(frames, k) {
    const before = new Set(k > 0 ? frames[k - 1].marks.done : []);
    return frames[k].marks.done.filter((i) => !before.has(i));
}
/** 버킷 이름(`12~20` · `7`)을 구간으로. */
function keyRange(key) {
    const m = String(key).match(/^(-?\d+)(?:~(-?\d+))?$/);
    return m ? [Number(m[1]), Number(m[2] ?? m[1])] : null;
}

const CASES = [
    [5], [2, 1], [1, 2], [3, 3, 3, 3],
    range(1, 10), range(1, 10).reverse(), range(1, 16),
    [5, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5],
    [0, 9, 0, 9, 4, 4, 1, 8],
    [7, -2, 0, -2, 7, 3, -15],
    [1000000, 3, 999999, 42, 3, 70000],
    [1, 2, 3, 4, 6, 5, 7, 8],
];
for (const p of SORT_PRESETS) for (const n of [8, 16, 24]) for (const s of [3, 44]) CASES.push({preset: p.id, n, seed: s});

let bucketCompared = false;
let caseRuns = 0;

for (const algo of SORT_ALGOS) {
    for (const c of CASES) {
        const values = Array.isArray(c) ? c : makeSortData(c.preset, c.n, c.seed, algo.valueMax ?? null);
        if (checkSortInput(algo, values)) continue;   // 이 알고리즘이 받지 않는 자료는 화면이 막는다
        const tag = `${algo.id} [${values.slice(0, 8).join(' ')}${values.length > 8 ? ' …' : ''}]`;
        let out;
        try { out = runSortAlgorithm(algo, values); } catch (e) { bad2(`${tag} — 죽었다: ${e.message}`); continue; }
        caseRuns++;
        const n = values.length;
        const want = asc(values);
        const fr = out.frames;
        if (out.stride !== 1) { bad2(`${tag} — 걸음이 솎였다. 이 크기에서는 한 걸음씩 다 남아야 한다`); continue; }
        if (!out.sorted) { bad2(`${tag} — 정렬되지 않았다: ${out.values.join(' ')}`); continue; }

        const ids = fr.at(-1).a.map((it) => it.id).sort((x, y) => x - y);
        if (ids.join() !== range(0, n - 1).join()) bad2(`${tag} — 끝 장의 원소가 처음 원소와 한 벌이 아니다`);

        /* **안정 정렬이라 적었으면 끝 장이 (값, 처음 자리) 순서와 똑같아야 한다.** 기대값은 따로 정렬해 구한다. */
        if (algo.stable) {
            const expectIds = values.map((v, id) => ({v, id})).sort((x, y) => x.v - y.v || x.id - y.id).map((x) => x.id);
            if (fr.at(-1).a.map((it) => it.id).join() !== expectIds.join()) bad2(`${tag} — 안정 정렬이라 적었는데 같은 값의 앞뒤가 뒤집혔다`);
        }

        /* ---- 세는 값 ---- */
        for (const k of ['compare', 'move', 'access']) {
            if (fr.at(-1).counts[k] !== out.counts[k]) bad2(`${tag} — 끝 장의 ${k}(${fr.at(-1).counts[k]})가 합계(${out.counts[k]})와 다르다`);
            for (let i = 1; i < fr.length; i++) {
                if (fr[i].counts[k] < fr[i - 1].counts[k]) { bad2(`${tag} — ${k} 횟수가 ${i}번째 장에서 줄었다`); break; }
            }
        }

        /* **확정으로 칠한 칸은 그 순간 이미 최종 값이어야 한다.** 위쪽 검사는 «나중에 바뀌지
           않는가»만 봐서, 틀린 값을 끝까지 붙들고 있는 칸은 잡지 못한다. */
        outer: for (const f of fr) {
            for (const i of f.marks.done) {
                const it = f.a[i];
                if (it && it.v !== want[i]) {
                    bad2(`${tag} — ${i}번 칸을 확정으로 칠했는데 값 ${it.v}가 최종 값 ${want[i]}이 아니다`);
                    break outer;
                }
            }
        }

        const inv = inversions(values);
        const full = (n * (n - 1)) / 2;
        const distinct = new Set(values).size === n;
        const sortedIn = nonDecreasing(values);
        const reversedIn = distinct && nonDecreasing([...values].reverse());
        const {compare, move} = out.counts;

        if (algo.group === 'distribution') {
            if (algo.id === 'bucket') {
                if (compare > 0) bucketCompared = true;
                if (compare > full) bad2(`${tag} — 칸 안 비교가 ${compare}번으로 n(n−1)/2=${full}을 넘었다`);
            } else if (compare !== 0) {
                bad2(`${tag} — 원소끼리 비교하지 않는다고 적었는데 ${compare}번 비교했다`);
            }
        } else if (n >= 2 && compare < n - 1) {
            // 비교로 정렬을 «확인»하려면 적어도 n−1번은 비교해야 한다(비교 그래프가 이어져야 한다).
            bad2(`${tag} — 비교 정렬이 ${compare}번 비교로 끝났다(n−1=${n - 1}보다 적다)`);
        }

        switch (algo.id) {
        case 'bubble':
        case 'cocktail':
            if (move !== 2 * inv) bad2(`${tag} — 옮김 ${move}번, 역순쌍 ${inv}개의 두 배여야 한다`);
            if (sortedIn && n >= 2 && compare !== n - 1) bad2(`${tag} — 이미 정렬된 자료에서 ${compare}번 비교했다(n−1이어야 멈춤 장치가 선다)`);
            if (algo.id === 'bubble' && reversedIn && compare !== full) bad2(`${tag} — 역순에서 ${compare}번 비교했다(n(n−1)/2=${full})`);
            for (let k = 0; k < fr.length; k++) {
                if (fr[k].act.kind !== 'fix') continue;
                for (const e of newlyDone(fr, k)) {
                    if (!fr[k].say.includes(`인덱스 ${e}에`)) bad2(`${tag} — ${e}번 칸을 확정했는데 설명은 「${fr[k].say}」`);
                }
            }
            break;
        case 'insertion':
            if (move !== inv + Math.max(0, n - 1)) bad2(`${tag} — 옮김 ${move}번, 역순쌍 ${inv} + 내려놓기 ${n - 1}이어야 한다`);
            if (n >= 2 && compare !== inv + (n - 1) - strictPrefixMins(values)) {
                bad2(`${tag} — 비교 ${compare}번, 역순쌍 + 멈춤 비교 = ${inv + (n - 1) - strictPrefixMins(values)}이어야 한다`);
            }
            for (const f of fr) {
                const v = vals(f);
                if (f.act.kind === 'drop') {
                    const to = f.act.to;
                    const i = f.marks.cursors.i;
                    if (to === 0 ? !f.say.includes('맨 앞') : !(v[to - 1] <= v[to] && f.say.includes('작거나 같은'))) {
                        bad2(`${tag} — ${to}번에 내려놓은 장의 설명 「${f.say}」가 앞 칸(${v[to - 1]})·내려놓은 값(${v[to]})과 맞지 않다`);
                    }
                    for (let k = to + 1; k <= i; k++) {
                        if (!(v[k] > v[to])) { bad2(`${tag} — 뒤로 밀린 ${v[k]}가 내려놓은 ${v[to]}보다 크지 않다(같은 값을 밀면 불안정)`); break; }
                    }
                }
                if (f.act.kind === 'grow') {
                    const r = f.ranges[0];
                    if (!nonDecreasing(v.slice(r.lo, r.hi + 1))) bad2(`${tag} — 「정렬된 부분」 띠 ${r.lo}~${r.hi}가 정렬되어 있지 않다`);
                }
            }
            break;
        case 'selection':
            if (compare !== full) bad2(`${tag} — 비교 ${compare}번, 자료와 상관없이 n(n−1)/2=${full}이어야 한다`);
            if (move % 2 !== 0 || move > 2 * Math.max(0, n - 1)) bad2(`${tag} — 옮김 ${move}번, 교환 n−1번(옮김 ${2 * (n - 1)})을 넘었다`);
            for (const f of fr) {
                if (f.act.kind !== 'new-min') continue;
                const v = vals(f);
                const {i, j} = f.marks.cursors;
                const m = f.marks.cursors['최솟값'];
                if (m !== j || !(v[m] < Math.min(...v.slice(i, j)))) bad2(`${tag} — 「더 작은 값을 찾았다」는데 ${v[m]}가 ${i}~${j - 1}의 최솟값보다 작지 않다`);
            }
            break;
        case 'quick':
            if (((sortedIn && distinct) || reversedIn) && compare !== full) {
                bad2(`${tag} — 끝 값 피벗이 한쪽으로 쏠리는 자료인데 ${compare}번 비교했다(n(n−1)/2=${full})`);
            }
            for (let k = 0; k < fr.length; k++) {
                if (fr[k].act.kind !== 'fix') continue;
                const f = fr[k];
                const v = vals(f);
                const [w] = newlyDone(fr, k);
                const {lo, hi} = f.ranges[0];
                const pv = v[w];
                if (!v.slice(lo, w).every((x) => x < pv) || !v.slice(w + 1, hi + 1).every((x) => x >= pv)) {
                    bad2(`${tag} — 피벗 ${pv}를 ${w}번에 확정했는데 ${lo}~${hi} 구간의 좌우가 나뉘지 않았다: ${v.slice(lo, hi + 1).join(' ')}`);
                }
                if (!f.say.includes(`인덱스 ${w}에`)) bad2(`${tag} — 피벗을 ${w}번에 확정했는데 설명은 「${f.say}」`);
            }
            break;
        case 'merge': {
            const lg = Math.log2(n);
            if (n >= 2 && Number.isInteger(lg)) {
                // 층마다 복사해 오기 n + 되돌려 쓰기 n
                if (move !== 2 * n * lg) bad2(`${tag} — 옮김 ${move}번, 2·n·log n=${2 * n * lg}이어야 한다`);
                if (compare > n * lg - n + 1 || compare < (n / 2) * lg) bad2(`${tag} — 비교 ${compare}번이 [n/2·log n, n·log n − n + 1] 밖이다`);
            }
            for (const f of fr) {
                if (f.act.kind === 'merged') {
                    const r = f.ranges[0];
                    if (!nonDecreasing(vals(f).slice(r.lo, r.hi + 1))) bad2(`${tag} — 합쳤다는 ${r.lo}~${r.hi}가 정렬되어 있지 않다`);
                }
                if (f.act.kind === 'aux-fill' && f.act.block === 1) {
                    for (const b of f.aux) {
                        if (!nonDecreasing(b.items.map((it) => it.v))) bad2(`${tag} — 합치려고 복사해 온 「${b.label}」 부분 배열이 정렬되어 있지 않다`);
                    }
                }
            }
            break;
        }
        case 'heap': {
            if (n >= 2 && compare > 2 * n * Math.ceil(Math.log2(n + 1))) bad2(`${tag} — 비교 ${compare}번이 2·n·log n 을 넘었다`);
            let extractions = 0;
            for (let k = 0; k < fr.length; k++) {
                const f = fr[k];
                const v = vals(f);
                if (f.act.kind === 'heap-ready' && !isMaxHeap(v, n)) bad2(`${tag} — 「최대 힙이 되었습니다」인데 힙이 아니다: ${v.join(' ')}`);
                if (f.act.kind === 'swap' && fr[k + 1] && fr[k + 1].act.kind === 'shrink') {
                    extractions++;
                    const end = f.act.j;
                    if (f.act.i !== 0) bad2(`${tag} — 맨 위가 아닌 ${f.act.i}번을 꺼냈다`);
                    if (!isMaxHeap(vals(fr[k - 1]), end + 1)) bad2(`${tag} — 맨 위를 꺼내기 직전 0~${end}가 최대 힙이 아니다: ${vals(fr[k - 1]).join(' ')}`);
                }
                if (f.act.kind === 'settled') {
                    const r = f.marks.cursors['부모'];
                    const band = f.ranges.find((x) => x.state === 'heap');
                    const size = band.hi + 1;
                    const kids = [2 * r + 1, 2 * r + 2].filter((x) => x < size);
                    const ok = kids.length === 0 ? f.say.includes('자식이 없')
                        : kids.length === 2 ? f.say.includes('두 자식')
                            : f.say.includes('자식') && !f.say.includes('두 자식');
                    if (!ok) bad2(`${tag} — ${r}번 노드는 자식이 ${kids.length}개인데 설명은 「${f.say}」`);
                    if (kids.some((x) => v[x] > v[r])) bad2(`${tag} — ${r}번에서 멈췄는데 자식이 부모보다 크다`);
                }
            }
            if (extractions !== Math.max(0, n - 1)) bad2(`${tag} — 맨 위를 ${extractions}번 꺼냈다(n−1=${n - 1}번이어야 한다)`);
            break;
        }
        case 'counting': {
            const hist = new Map();
            for (const x of values) hist.set(x, (hist.get(x) || 0) + 1);
            let lastCount = null;
            for (const f of fr) {
                if (f.act.kind === 'strip-count') {
                    lastCount = f;
                    if (f.act.key !== f.a[f.act.i].v) bad2(`${tag} — 값 ${f.a[f.act.i].v}를 ${f.act.key} 칸에 세었다`);
                }
                const m = f.say.match(/값 (\d+)[이가] (\d+)개 있습니다/);
                if (m && hist.get(Number(m[1])) !== Number(m[2])) bad2(`${tag} — 「${f.say}」인데 실제로는 ${hist.get(Number(m[1])) || 0}개`);
                const z = f.say.match(/값 (\d+)[은는] 한 번도/);
                if (z && hist.has(Number(z[1]))) bad2(`${tag} — 「${f.say}」인데 실제로 나온다`);
            }
            if (lastCount) {
                for (const cell of lastCount.strip.cells) {
                    if (cell.count !== (hist.get(cell.key) || 0)) bad2(`${tag} — 다 센 뒤 ${cell.key} 칸이 ${cell.count}개, 실제 ${hist.get(cell.key) || 0}개`);
                }
            }
            break;
        }
        case 'radix': {
            const digits = String(Math.max(...values)).length;
            let d = -1;
            for (const f of fr) {
                const m = f.say.match(/자릿수는 (\d+)자리/);
                if (m && Number(m[1]) !== digits) bad2(`${tag} — 「${f.say}」인데 가장 큰 값은 ${digits}자리`);
                if (f.act.kind === 'strip-open') d++;
                if (f.act.kind === 'strip-put') {
                    const cell = f.strip.cells.find((x) => x.key === f.act.key);
                    const it = cell.items.at(-1);
                    if (Math.floor(it.v / 10 ** d) % 10 !== f.act.key) bad2(`${tag} — ${it.v}를 ${10 ** d}의 자리 ${f.act.key}번 칸에 넣었다`);
                }
                if (f.act.kind === 'pass-done' && d >= 0) {
                    /* **한 회차가 끝나면 «아래 d+1자리»로 안정 정렬한 것과 같아야 한다.**
                       기대값은 처음 원소를 (아래 자리 값, 처음 자리)로 따로 정렬해 구한다. */
                    const mod = 10 ** (d + 1);
                    const expect = values.map((v, id) => ({v, id}))
                        .sort((x, y) => (x.v % mod) - (y.v % mod) || x.id - y.id).map((x) => x.id);
                    if (f.a.map((it) => it.id).join() !== expect.join()) bad2(`${tag} — ${10 ** d}의 자리까지 돈 뒤의 순서가 아래 자리로 안정 정렬한 것과 다르다`);
                }
            }
            if (d + 1 !== digits) bad2(`${tag} — 자릿수 ${digits}인데 ${d + 1}회차를 돌았다`);
            break;
        }
        case 'bucket': {
            const lo = Math.min(...values);
            const hi = Math.max(...values);
            let checkedKeys = false;
            let checkedSorted = false;
            for (const f of fr) {
                const m = f.say.match(/값이 (-?\d+)~(-?\d+)입니다/);
                if (m && (Number(m[1]) !== lo || Number(m[2]) !== hi)) bad2(`${tag} — 「${f.say}」인데 값은 ${lo}~${hi}`);
                if (!f.strip) continue;
                const spans = f.strip.cells.map((cell) => keyRange(cell.key));
                if (!checkedKeys) {
                    checkedKeys = true;
                    // 칸 이름이 최솟값부터 최댓값까지 빈틈·겹침 없이 이어지는가
                    const okKeys = spans.every(Boolean) && spans[0][0] === lo && spans.at(-1)[1] === hi
                        && spans.every((s, i) => s[0] <= s[1] && (i === 0 || s[0] === spans[i - 1][1] + 1));
                    if (!okKeys) bad2(`${tag} — 칸 이름 ${f.strip.cells.map((x) => x.key).join(' · ')}가 ${lo}~${hi}를 빈틈없이 나누지 않는다`);
                }
                f.strip.cells.forEach((cell, b) => {
                    for (const it of cell.items) {
                        if (spans[b] && (it.v < spans[b][0] || it.v > spans[b][1])) bad2(`${tag} — ${it.v}가 「${cell.key}」 칸에 들어 있다`);
                    }
                });
                if (f.act.kind === 'strip-take' && !checkedSorted) {
                    checkedSorted = true;
                    for (const cell of f.strip.cells) {
                        const ok = cell.items.every((it, i) => i === 0
                            || cell.items[i - 1].v < it.v || (cell.items[i - 1].v === it.v && cell.items[i - 1].id < it.id));
                        if (!ok) bad2(`${tag} — 「${cell.key}」 칸을 정리했는데 순서가 틀리거나 같은 값의 앞뒤가 뒤집혔다`);
                    }
                }
            }
            break;
        }
        default:
            break;
        }
    }
}
if (!bucketCompared) bad2('버킷 정렬만 칸 안을 비교한다고 적었는데 어느 자료에서도 비교하지 않았다');
console.log(`세는 값·불변식 — ${caseRuns}판을 역순쌍 수 · n(n−1)/2 · 힙 속성 · 분할 좌우 · 도수로 대조했다`);

/* ---- 분류 설명이 등록부와 맞는가 ---- */
const KO_NUM = {둘: 2, 셋: 3, 넷: 4, 다섯: 5, 여섯: 6, 아홉: 9, 열: 10, 열한: 11, 열두: 12, 열세: 13};
{
    const raceBlurb = SORT_GROUPS.find((g) => g.id === 'race').blurb;
    const m = raceBlurb.match(/자료를 (\S+) 가지/);
    if (!m || KO_NUM[m[1]] !== SORT_ALGOS.length) bad2(`알고리즘 비교 설명이 「${m && m[1]} 가지」인데 알고리즘은 ${SORT_ALGOS.length}가지`);

    const simple = SORT_GROUPS.find((g) => g.id === 'simple');
    const s = simple.blurb.match(/(\S+) 다 최악이 (O\([^)]*\))/);
    const members = sortAlgosOfGroup('simple');
    if (!s || KO_NUM[s[1]] !== members.length || members.some((a) => a.complexity.worst !== s[2])) {
        bad2(`단순 정렬 설명 「${s && s[0]}」이 등록부(${members.map((a) => `${a.name} ${a.complexity.worst}`).join(', ')})와 다르다`);
    }
    const divide = SORT_GROUPS.find((g) => g.id === 'divide').blurb;
    const merge = SORT_ALGOS.find((a) => a.id === 'merge');
    const quick = SORT_ALGOS.find((a) => a.id === 'quick');
    if (!divide.includes(`병합 정렬은 최악도 ${merge.complexity.worst}`) || !divide.includes(`퀵 정렬의 최악은 ${quick.complexity.worst}`)) {
        bad2('분할 정복 설명의 최악 복잡도가 카드와 다르다');
    }
}

/* ---- 직접 입력을 읽는 규칙 ---- */
{
    const cases = [
        ['', null], ['7', null], ['1 2 x', null], ['1.5 2', null],
        ['3,1 2\n-5', [3, 1, 2, -5]], ['0 0', [0, 0]],
        [range(1, SORT_N_MAX).join(' '), range(1, SORT_N_MAX)], [range(1, SORT_N_MAX + 1).join(' '), null],
    ];
    for (const [text, want] of cases) {
        const got = parseSortInput(text);
        const ok = want === null ? (got.error && !got.values.length) : (!got.error && got.values.join() === want.join());
        if (!ok) bad2(`직접 입력 「${text.slice(0, 20)}」 — ${JSON.stringify(got).slice(0, 80)}`);
    }
    const byId = (id) => SORT_ALGOS.find((a) => a.id === id);
    const guard = [
        ['counting', [0, 9], false], ['counting', [0, 10], true], ['counting', [-1, 3], true],
        ['radix', [123456, 0], false], ['radix', [-1, 3], true], ['bucket', [-1, 3], false],
        ['bubble', [-5, 1000000], false],
    ];
    for (const [id, v, blocked] of guard) {
        if (Boolean(checkSortInput(byId(id), v)) !== blocked) bad2(`${id} 에 [${v}]를 ${blocked ? '막아야' : '받아야'} 하는데 반대로 했다`);
    }
    // 막는 까닭이 알고리즘에 맞는가 — 기수 정렬은 값이 아니라 자릿수를 칸으로 쓴다
    if (!checkSortInput(byId('radix'), [-1, 3]).includes('자릿수를 칸의')) bad2('기수 정렬이 음수를 막는 까닭을 「자릿수」로 말하지 않는다');
    if (!checkSortInput(byId('counting'), [-1, 3]).includes('값을 칸의')) bad2('계수 정렬이 음수를 막는 까닭을 「값」으로 말하지 않는다');
}

/* ---- 화면의 숫자가 기록과 같은가 ----
   받침대로 띄운 페이지에서 끝까지 넘긴 뒤 세 숫자를 읽는다. 버블 정렬의 옮김은 역순쌍 수로 따로 구한다. */
{
    const mine = [5, 3, 9, 0, 3, 7, 1, 8];
    page.el('input-text').value = mine.join(' ');
    page.el('btn-apply-input').click();
    for (const group of [...page.el('group-tabs').children]) {
        group.click();
        for (const chip of [...page.el('algo-tabs').children]) {
            const algo = SORT_ALGOS.find((a) => a.name === chip.textContent);
            if (!algo) continue;
            chip.click();
            page.el('btn-last').click();
            const want = runSortAlgorithm(algo, mine);
            const shown = {
                compare: Number(page.el('count-compare').textContent),
                move: Number(page.el('count-move').textContent),
                access: Number(page.el('count-access').textContent),
            };
            for (const k of Object.keys(shown)) {
                if (shown[k] !== want.counts[k]) bad2(`${algo.name} — 화면의 ${k} ${shown[k]}, 기록 ${want.counts[k]}`);
            }
            if (algo.id === 'bubble' && shown.move !== 2 * inversions(mine)) bad2(`버블 정렬 — 화면의 옮김 ${shown.move}, 역순쌍의 두 배 ${2 * inversions(mine)}`);
            if (page.el('step-label').textContent !== `${want.frames.length - 1} / ${want.frames.length - 1} 단계`) {
                bad2(`${algo.name} — 끝 단계 표시 「${page.el('step-label').textContent}」가 기록 ${want.frames.length - 1}장과 다르다`);
            }
        }
    }

    /* 알고리즘 비교 줄마다 붙는 「끝 · 작업량」이 따로 센 작업량과 같은가.
       **직접 넣은 값으로 비교해야 한다** — 예전에는 개수만 가져가고 프리셋 자료로 돌았다. */
    const raceTab = [...page.el('group-tabs').children].find((b) => b.textContent === '알고리즘 비교');
    const workOf = (algos, v) => algos.map((algo) => {
        const o = runSortAlgorithm(algo, v, {countOnly: true});
        return o.counts.compare + o.counts.move + o.counts.access;
    });
    const readTallies = () => {
        const out = [];
        const walk = (el) => {
            const t = el.children.length === 0 ? el.textContent : '';
            const m = t.match(/^끝 · ([\d,]+)$/);
            if (m) out.push(Number(m[1].replace(/,/g, '')));
            for (const c of el.children) walk(c);
        };
        walk(page.el('bars-host'));
        return out;
    };
    raceTab.click();
    page.el('btn-last').click();
    let tallies = readTallies();
    let expectWork = workOf(SORT_ALGOS, mine);
    if (tallies.join() !== expectWork.join()) bad2(`알고리즘 비교 — 줄마다 적힌 작업량 ${tallies.join(' ')}이 넣은 값으로 따로 센 ${expectWork.join(' ')}과 다르다`);

    /* 음수를 넣으면 계수 · 기수 정렬만 빠지고 나머지는 넣은 값으로 돈다. 뺀 까닭을 알린다. */
    const withNeg = [4, -2, 7, 0, -5, 3];
    page.el('input-text').value = withNeg.join(' ');
    page.el('btn-apply-input').click();
    page.el('btn-last').click();
    const ok = SORT_ALGOS.filter((a) => !checkSortInput(a, withNeg));
    tallies = readTallies();
    expectWork = workOf(ok, withNeg);
    if (tallies.join() !== expectWork.join()) bad2(`알고리즘 비교(음수) — 작업량 ${tallies.join(' ')}이 받을 수 있는 ${ok.length}개로 따로 센 ${expectWork.join(' ')}과 다르다`);
    if (ok.length === SORT_ALGOS.length) bad2('음수 자료인데 빠진 알고리즘이 없다 — 검사 자료가 틀렸다');
    const err = page.el('input-error').textContent;
    if (!err.includes('이번 비교에서 뺐습니다')) bad2(`알고리즘 비교(음수) — 뺀 까닭을 알리지 않는다: 「${err}」`);

    /* 섞기를 누르면 입력값을 버리고 프리셋 자료로 돌아간다. */
    page.el('btn-shuffle').click();
    page.el('btn-last').click();
    tallies = readTallies();
    if (tallies.length !== SORT_ALGOS.length) bad2(`섞기 뒤 알고리즘 비교 — 줄이 ${tallies.length}개, 열한 줄이어야 한다(입력값이 남아 있다)`);
    for (const e of page.errors) bad2(`페이지 — ${e}`);
}

console.log(fail2 === 0 ? '세는 값·불변식 전부 통과' : '어긋난 것 ' + fail2 + '건');
test('sort-invariants', () => { expect(fail2, '위 ✗ 줄을 볼 것').toBe(0); });
