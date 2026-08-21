// 그래프 탐색 시뮬레이터의 **프리셋 지도를 만들어 내는 도구**.
//
// 만들어 낸 결과는 `src/entries/_lib/graph-presets.js`에 **글자 그대로 얼려 넣는다.**
// 런타임에 무작위로 만들지 않는 이유는 하나다 — 무작위 지도에서는 최상 우선 탐색이
// 대개 A*와 같은 답을 내서 **수업에서 볼 것이 안 나온다.**
//
// 여기서 거르는 조건은 아래 CRITERIA 참고.

import {
    buildGraph, cheapestCost, isReachable, neighborsOf, hOf, costOf,
} from '../src/entries/_lib/graph-model.js';

const W = 720, H = 460, MARGIN = 70;
const MIN_NODE_GAP = 132;     // 노드 상자(약 100×54)가 겹치지 않을 중심 간격
const MAX_EDGE_LEN = 275;     // 이보다 길면 지도처럼 안 보인다
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/* ---------- 씨앗 고정 난수. 같은 결과를 다시 낼 수 있어야 한다 ---------- */
function rng(seed) {
    let s = seed >>> 0;
    return () => {
        s = (s * 1664525 + 1013904223) >>> 0;
        return s / 4294967296;
    };
}

/* ---------- 1. 노드 자리 ---------- */
function placeNodes(rand, n) {
    const pts = [];
    let guard = 0;
    while (pts.length < n && guard++ < 20000) {
        const x = MARGIN + rand() * (W - MARGIN * 2);
        const y = MARGIN + rand() * (H - MARGIN * 2);
        if (pts.every(p => Math.hypot(p.x - x, p.y - y) >= MIN_NODE_GAP)) {
            pts.push({x: Math.round(x), y: Math.round(y)});
        }
    }
    if (pts.length < n) return null;
    // 왼쪽 위부터 이름을 붙인다. 지도를 읽는 순서와 이름 순서가 맞아야 헷갈리지 않는다.
    pts.sort((p, q) => (p.x + p.y * 0.6) - (q.x + q.y * 0.6));
    return pts.map((p, i) => ({id: LETTERS[i], x: p.x, y: p.y}));
}

/* ---------- 2. 간선 후보: 가까운 이웃 + 교차 제거 ---------- */
const seg = (a, b) => ({x1: a.x, y1: a.y, x2: b.x, y2: b.y});

function crosses(p, q) {
    const d = (ax, ay, bx, by, cx, cy) => (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d1 = d(p.x1, p.y1, p.x2, p.y2, q.x1, q.y1);
    const d2 = d(p.x1, p.y1, p.x2, p.y2, q.x2, q.y2);
    const d3 = d(q.x1, q.y1, q.x2, q.y2, p.x1, p.y1);
    const d4 = d(q.x1, q.y1, q.x2, q.y2, p.x2, p.y2);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0));
}

function candidateEdges(nodes) {
    const byId = new Map(nodes.map(n => [n.id, n]));
    const all = [];
    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const len = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
            if (len <= MAX_EDGE_LEN) all.push({a: nodes[i].id, b: nodes[j].id, len});
        }
    }
    all.sort((p, q) => p.len - q.len);

    // 짧은 것부터 넣되, 이미 넣은 간선과 **교차하면 버린다.** 교차가 있으면 지도가
    // 실타래처럼 보여 경로를 눈으로 따라갈 수가 없다.
    const kept = [];
    for (const e of all) {
        const s = seg(byId.get(e.a), byId.get(e.b));
        const bad = kept.some(k => {
            if (k.a === e.a || k.a === e.b || k.b === e.a || k.b === e.b) return false;
            return crosses(s, seg(byId.get(k.a), byId.get(k.b)));
        });
        if (!bad) kept.push(e);
    }
    return kept;
}

/* ---------- 3. 뼈대(신장 트리)와 덧붙은 간선 ---------- */
function splitTreeAndExtra(nodes, edges, maxExtra) {
    const parent = new Map(nodes.map(n => [n.id, n.id]));
    const find = (x) => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x))), parent.get(x)));

    const tree = [], extra = [];
    for (const e of edges) {          // 이미 길이순
        const ra = find(e.a), rb = find(e.b);
        if (ra !== rb) {
            parent.set(ra, rb);
            tree.push(e);
        } else {
            extra.push(e);
        }
    }
    const roots = new Set(nodes.map(n => find(n.id)));
    if (roots.size !== 1) return null;        // 끊긴 지도는 버린다

    // 덧붙은 간선은 **가장 짧은 것부터** 골라 남긴다. 사이클이 눈에 잘 들어온다.
    return {tree, extra: extra.slice(0, maxExtra)};
}

/* ---------- 4. 방향 배정 ---------- */
function assignDirs(rand, tree, extra) {
    const out = [];
    for (const e of tree) {
        // 뼈대는 대부분 양방향으로 둔다. 전부 일방통행이면 방향 지도에서 갈 데가 없다.
        const r = rand();
        out.push({...e, dir: r < 0.72 ? 'both' : (r < 0.86 ? 'a2b' : 'b2a'), extra: false});
    }
    for (const e of extra) {
        // 덧붙은 간선은 **일방통행 쪽으로 기운다.** 「돌아서 오는 지름길이 한쪽으로만
        // 열려 있다」가 방향 그래프에서 볼 만한 장면이다.
        const r = rand();
        out.push({...e, dir: r < 0.3 ? 'both' : (r < 0.65 ? 'a2b' : 'b2a'), extra: true});
    }
    return out;
}

/* ---------- 5. 최상 우선 탐색(그리디)을 흉내 내 결과 비용을 잰다 ---------- */
function greedyCost(graph) {
    const open = [graph.start];
    const closed = new Set();
    const from = new Map();
    let guard = 0;
    while (open.length && guard++ < 5000) {
        open.sort((p, q) => hOf(graph, p) - hOf(graph, q) || (p < q ? -1 : 1));
        const cur = open.shift();
        if (cur === graph.goal) {
            let c = 0, node = cur;
            while (from.has(node)) {
                c += costOf(graph, from.get(node), node);
                node = from.get(node);
            }
            return c;
        }
        if (closed.has(cur)) continue;
        closed.add(cur);
        for (const nb of neighborsOf(graph, cur)) {
            if (closed.has(nb) || open.includes(nb)) continue;
            from.set(nb, cur);
            open.push(nb);
        }
    }
    return Infinity;
}

/** 간선 수가 가장 적은 길의 **비용**. 비용을 안 보는 BFS가 내는 답이다. */
function bfsPathCost(graph) {
    const from = new Map();
    const seen = new Set([graph.start]);
    const q = [graph.start];
    while (q.length) {
        const cur = q.shift();
        if (cur === graph.goal) {
            let c = 0, node = cur;
            while (from.has(node)) {
                c += costOf(graph, from.get(node), node);
                node = from.get(node);
            }
            return c;
        }
        for (const nb of neighborsOf(graph, cur)) {
            if (seen.has(nb)) continue;
            seen.add(nb);
            from.set(nb, cur);
            q.push(nb);
        }
    }
    return Infinity;
}

/**
 * 간선이 **상관없는 노드 위를 지나가지 않는지** 본다.
 *
 * 교차만 막아서는 부족하다. A–C 간선이 그 사이에 있는 B의 상자를 그대로 관통하면
 * 학생은 「B를 거쳐 가는 길」로 읽는다. 교차 검사는 이것을 잡지 못한다 —
 * 선과 선이 만나는 것이 아니라 선이 상자를 스치는 것이기 때문이다.
 */
function edgeClearsNodes(preset, minGap = 72) {
    const byId = new Map(preset.nodes.map(n => [n.id, n]));
    const distToSeg = (p, a, b) => {
        const dx = b.x - a.x, dy = b.y - a.y;
        const L2 = dx * dx + dy * dy || 1;
        let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    };
    for (const e of preset.edges) {
        const A = byId.get(e.a), B = byId.get(e.b);
        for (const n of preset.nodes) {
            if (n.id === e.a || n.id === e.b) continue;
            if (distToSeg(n, A, B) < minGap) return false;
        }
    }
    return true;
}

/**
 * 사이클이 있는지 본다.
 *
 * 방향 그래프는 **뒤로 가는 간선(back edge)**을 찾는다 — 마주 보는 화살표 한 쌍도 여기 걸린다.
 * 무방향 그래프는 부모로 되돌아간 것만 빼고 이미 본 노드를 다시 만나면 사이클이다.
 */
function hasCycle(g) {
    const anyDirected = g.edges.some(e => e.directed === true);
    if (anyDirected || g.directed) {
        const state = new Map();   // 0 = 보는 중, 1 = 다 봄
        const walk = (id) => {
            state.set(id, 0);
            for (const nb of neighborsOf(g, id)) {
                if (state.get(nb) === 0) return true;
                if (state.get(nb) === undefined && walk(nb)) return true;
            }
            state.set(id, 1);
            return false;
        };
        for (const n of g.nodes) if (state.get(n.id) === undefined && walk(n.id)) return true;
        return false;
    }
    const seen = new Set();
    const walk = (id, parent) => {
        seen.add(id);
        for (const nb of neighborsOf(g, id)) {
            if (nb === parent) continue;
            if (seen.has(nb)) return true;
            if (walk(nb, id)) return true;
        }
        return false;
    };
    for (const n of g.nodes) if (!seen.has(n.id) && walk(n.id, null)) return true;
    return false;
}

/* ---------- 6. 조건 검사 ---------- */
const COMBOS = [];
for (const directed of [false, true]) {
    for (const weighted of [false, true]) {
        for (const cyclic of [false, true]) COMBOS.push({directed, weighted, cyclic});
    }
}

function evaluate(preset) {
    const report = {ok: true, reasons: [], lessons: {greedy: 0, bfs: 0}, combos: 0};

    for (const c of COMBOS) {
        const g = buildGraph(preset, c);
        if (!isReachable(g)) {
            report.ok = false;
            report.reasons.push(`도달 불가: ${JSON.stringify(c)}`);
            continue;
        }
        report.combos++;

        // 허용성 — h(n)이 남은 실제 최소 비용을 넘으면 안 된다. **A*의 최적성이 여기 걸려 있다.**
        for (const n of g.nodes) {
            const rest = cheapestCost(g, n.id, g.goal);
            if (Number.isFinite(rest) && hOf(g, n.id) > rest) {
                report.ok = false;
                report.reasons.push(`h 과대평가 ${n.id}: h=${hOf(g, n.id)} > 실제 ${rest} @ ${JSON.stringify(c)}`);
            }
        }

        // 「사이클 없음」이 정말로 사이클이 없는지 본다. 방향 그래프에서는 마주 보는
        // 화살표 한 쌍도 사이클이므로, 무방향 판정을 그대로 쓰면 놓친다.
        if (!c.cyclic && hasCycle(g)) {
            report.ok = false;
            report.reasons.push(`사이클 없음인데 사이클 있음 @ ${JSON.stringify(c)}`);
        }

        if (c.weighted && c.cyclic) {
            const best = cheapestCost(g);
            if (greedyCost(g) > best) report.lessons.greedy++;
            if (bfsPathCost(g) > best) report.lessons.bfs++;
        }
    }
    return report;
}

/* ---------- 7. 만들어서 거른다 ---------- */
function makeCandidate(seed) {
    const rand = rng(seed);
    const n = 9 + Math.floor(rand() * 4);        // 9 ~ 12
    const nodes = placeNodes(rand, n);
    if (!nodes) return null;

    const cand = candidateEdges(nodes);
    const split = splitTreeAndExtra(nodes, cand, 2 + Math.floor(rand() * 3));   // 덧붙은 간선 2~4
    if (!split || split.extra.length < 2) return null;

    const edges = assignDirs(rand, split.tree, split.extra);

    // 시작과 목표는 **가장 멀리 떨어진 두 노드**로 둔다. 지도를 가로질러야 볼 것이 나온다.
    let start = null, goal = null, far = -1;
    for (const p of nodes) {
        for (const q of nodes) {
            const d = Math.hypot(p.x - q.x, p.y - q.y);
            if (d > far) {
                far = d;
                start = p.id;
                goal = q.id;
            }
        }
    }

    return {
        id: `map-${seed}`, name: `지도 ${seed}`, seed,
        nodes,
        edges: edges.map(e => ({a: e.a, b: e.b, dir: e.dir, extra: e.extra})),
        start, goal,
    };
}

const winners = [];
const wanted = Number(process.argv[2] || 12);
const tally = {만듦: 0, 도달실패: 0, 겹침: 0, 교훈없음: 0};
for (let seed = 1; seed < 20000; seed++) {
    const p = makeCandidate(seed);
    if (!p) continue;
    tally.만듦++;
    if (!edgeClearsNodes(p)) {
        tally.겹침++;
        continue;
    }
    const r = evaluate(p);
    if (!r.ok || r.combos < 8) {
        tally.도달실패++;
        continue;
    }
    // **교훈이 나오는 지도만 남긴다.** 여덟 조합 중 「비용 있음 + 사이클 있음」인 둘
    // 모두에서, 최상 우선도 칸 수만 세는 방법도 최적을 놓쳐야 한다.
    if (r.lessons.greedy < 2 || r.lessons.bfs < 2) {
        tally.교훈없음++;
        continue;
    }
    winners.push({preset: p, report: r});
}
console.log('거른 내역', tally, '통과', winners.length);

// **크기를 골고루 섞는다.** 통과한 것을 그냥 앞에서부터 자르면 아홉 개짜리만 남아
// 「새 지도」를 눌러도 늘 같은 크기가 나온다.
const bySize = new Map();
for (const w of winners) {
    const k = w.preset.nodes.length;
    if (!bySize.has(k)) bySize.set(k, []);
    bySize.get(k).push(w);
}
const sizes = [...bySize.keys()].sort((a, b) => a - b);
const chosen = [];
for (let round = 0; chosen.length < wanted && round < 40; round++) {
    for (const s of sizes) {
        const list = bySize.get(s);
        if (round < list.length && chosen.length < wanted) chosen.push(list[round]);
    }
}
console.log('크기별 통과 수', Object.fromEntries(sizes.map(s => [s, bySize.get(s).length])));
console.log(`후보 ${winners.length}개 중 ${chosen.length}개 선택`);
for (const w of chosen) {
    console.log(` ${w.preset.id}: 노드 ${w.preset.nodes.length} 간선 ${w.preset.edges.length}` +
        ` 그리디손해 ${w.report.lessons.greedy}/2 칸수손해 ${w.report.lessons.bfs}/2`);
}

// **결과를 곧바로 `graph-presets.js`로 적는다.** 중간 파일을 두면 그 파일과 최종본이
// 어긋난 채 굳는다. 적고 나면 `npm run check:graph`가 최종본을 다시 판정한다.
const fs = await import('node:fs');
const {emit} = await import('./gen_graph_presets_emit.mjs');
fs.writeFileSync(new URL('../src/entries/_lib/graph-presets.js', import.meta.url),
    emit(chosen.map(w => w.preset)), 'utf8');
console.log('src/entries/_lib/graph-presets.js 를 다시 적었다');
