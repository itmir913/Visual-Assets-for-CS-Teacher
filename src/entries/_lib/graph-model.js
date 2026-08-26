// 탐색 시뮬레이터의 **그래프 자료 모델**. 맹목적 탐색과 정보 이용 탐색이 함께 쓴다.
//
// 그리는 일은 `graph-view.js`가 하고, 여기서는 **무엇을 그릴지**만 정한다.
//
// ## 지도 하나가 여덟 가지 그래프를 낳는다
//
// 화면의 토글은 셋(방향 · 비용 · 사이클)이라 조합이 여덟이다. 조합마다 지도를 따로
// 그리면 지도가 여든 장 필요하다. 그러지 않으려고 **프리셋에 「이 간선을 빼면 사이클이
// 없어진다」는 표시(`extra`)와 「방향을 켜면 이쪽으로만 간다」는 표시(`dir`)를 미리
// 넣어 둔다.** 토글은 그 표시를 읽어 간선을 걸러 내거나 방향을 붙일 뿐이다.
//
// ## 비용과 휴리스틱은 좌표 하나에서 나온다
//
// h(n)은 **목표까지의 직선거리**다. 지도 위에서 자로 측정한 거리라 학생이 곧바로 이해하고,
// 노드 좌표가 고정이라 값이 흔들리지 않는다. 간선 비용도 같은 자로 측정한다.
//
// **올림과 내림을 일부러 어긋나게 준다.** 비용은 올림, h는 내림이다. 이렇게 두면
// h(n)이 실제로 남은 비용을 **넘을 수 없다**(admissible) — 어떤 경로든 그 간선 길이의
// 합이 직선거리보다 짧을 수 없기 때문이다. 학생이 「A*가 더 비싼 길을 찾았다」를 보는
// 일이 생기지 않는다.

/** 좌표 20px를 비용 1로 친다. 프리셋 좌표가 700 언저리라 비용이 한두 자리로 떨어진다. */
export const GRAPH_SCALE = 20;

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 프리셋과 토글로 **실제로 탐색할 그래프**를 만든다.
 *
 * @param {object} preset  `{id, name, nodes, edges, start, goal}`
 *   - `nodes`: `{id, x, y}`
 *   - `edges`: `{a, b, dir, extra}` — `dir`은 'both' | 'a2b' | 'b2a',
 *     `extra`가 참이면 **이 간선이 사이클을 만든다**(빼면 트리가 된다)
 * @param {object} opts  `{directed, weighted, cyclic}`
 * @returns {object} 아래 GraphData
 */
export function buildGraph(preset, opts = {}) {
    const directed = !!opts.directed;
    const weighted = !!opts.weighted;
    const cyclic = opts.cyclic !== false;

    const nodes = preset.nodes.map(n => ({id: n.id, x: n.x, y: n.y}));
    const byId = new Map(nodes.map(n => [n.id, n]));

    // 사이클을 끄면 **덧붙은 간선을 걷어낸다.** 남는 것이 뼈대(신장 트리)라,
    // 무방향이면 그대로 트리가 되고 방향이면 방향 트리가 된다.
    const raw = preset.edges.filter(e => cyclic || !e.extra);

    // **사이클을 끄면서 방향까지 켜면 뼈대의 방향을 다시 매긴다.**
    //
    // 방향 그래프에서는 **양방향 간선 한 쌍이 그 자체로 사이클**이다(A→B→A).
    // 프리셋에 적힌 방향을 그대로 쓰면 「사이클 없음」이라 적어 놓고 DFS가 두 노드
    // 사이를 맴도는 일이 생긴다. 그래서 이 조합에서는 뼈대를 **시작점에서 바깥으로**
    // 향하게 매긴다 — 그러면 사이클이 하나도 없고, 모든 노드에 갈 수 있다.
    const outward = (directed && !cyclic) ? orientAwayFromRoot(raw, preset.start) : null;

    const edges = [];
    for (const e of raw) {
        if (!byId.has(e.a) || !byId.has(e.b)) continue;
        const dir = (outward && outward.get(`${e.a}|${e.b}`)) || e.dir || 'both';
        if (!directed) {
            edges.push({id: `${e.a}~${e.b}`, a: e.a, b: e.b, directed: false, extra: !!e.extra});
        } else if (dir === 'both') {
            // 양쪽으로 다 갈 수 있는 길은 **선 하나에 화살촉을 양끝에** 단다.
            // 화살표 없는 선을 섞으면 「이건 방향이 없나?」로 읽고, 선을 둘로 나누면
            // 지도의 선이 배로 늘어 어느 것이 어느 길인지 안 보인다.
            edges.push({id: `${e.a}~${e.b}`, a: e.a, b: e.b, directed: 'both', extra: !!e.extra});
        } else if (dir === 'a2b') {
            edges.push({id: `${e.a}>${e.b}`, a: e.a, b: e.b, directed: true, extra: !!e.extra});
        } else {
            edges.push({id: `${e.b}>${e.a}`, a: e.b, b: e.a, directed: true, extra: !!e.extra});
        }
    }

    const graph = {
        presetId: preset.id,
        presetName: preset.name,
        note: preset.note || '',
        directed, weighted, cyclic,
        nodes, edges,
        byId,
        start: preset.start,
        goal: preset.goal,
    };

    recompute(graph);
    return graph;
}

/**
 * 뼈대 간선의 방향을 **루트에서 바깥으로** 매긴다. 결과는 방향 트리라 사이클이 없다.
 *
 * @returns {Map<string,string>} `"a|b"` → 'a2b' | 'b2a'
 */
function orientAwayFromRoot(edges, root) {
    const nb = new Map();
    const push = (from, to) => {
        if (!nb.has(from)) nb.set(from, []);
        nb.get(from).push(to);
    };
    for (const e of edges) {
        push(e.a, e.b);
        push(e.b, e.a);
    }
    const dirs = new Map();
    const seen = new Set([root]);
    const queue = [root];
    while (queue.length) {
        const cur = queue.shift();
        for (const next of (nb.get(cur) || []).slice().sort()) {
            if (seen.has(next)) continue;
            seen.add(next);
            queue.push(next);
            dirs.set(`${cur}|${next}`, 'a2b');
            dirs.set(`${next}|${cur}`, 'b2a');
        }
    }
    return dirs;
}

/**
 * 좌표에서 비용·휴리스틱·인접 목록을 다시 만든다.
 *
 * 간선을 잇거나 끊은 뒤에 부른다. **좌표가 곧 비용이므로** 새로 놓은 간선의 비용도
 * 여기서 두 점 사이 거리로 정해진다.
 */
export function recompute(graph) {
    const {byId, weighted} = graph;

    let maxLen = 1;
    for (const e of graph.edges) {
        const len = dist(byId.get(e.a), byId.get(e.b));
        e._len = len;
        if (len > maxLen) maxLen = len;
    }

    for (const e of graph.edges) {
        // **비용은 올림.** h가 내림이므로, 둘을 어긋나게 두어야 h가 실제 비용을 넘지 않는다.
        e.cost = weighted ? Math.max(1, Math.ceil(e._len / GRAPH_SCALE)) : 1;
    }

    // 인접 목록. **간선 방향을 여기서 한 번만 풀어 둔다.** 탐색 쪽이 방향을 다시
    // 따지게 두면 알고리즘마다 같은 실수를 반복한다.
    const adj = new Map(graph.nodes.map(n => [n.id, []]));
    for (const e of graph.edges) {
        adj.get(e.a).push({to: e.b, cost: e.cost, edgeId: e.id});
        // 방향이 없는 간선과 양방향 간선은 반대로도 갈 수 있다.
        if (e.directed !== true) adj.get(e.b).push({to: e.a, cost: e.cost, edgeId: e.id});
    }
    // 이웃 순서를 이름순으로 고정한다. 순서가 흔들리면 **같은 지도에서 DFS가 매번 다른
    // 길로 가** 학생이 「왜 아까와 다르죠」를 묻게 된다.
    for (const list of adj.values()) list.sort((p, q) => (p.to < q.to ? -1 : p.to > q.to ? 1 : 0));
    graph.adj = adj;
    graph.maxEdgeLen = maxLen;

    computeHeuristics(graph);
    return graph;
}

/**
 * h(n)을 다시 매긴다. **목표까지의 직선거리**다.
 *
 * - 비용을 쓰는 지도: `내림(직선거리 ÷ 스케일)`.
 *   간선 비용이 `올림(길이 ÷ 스케일)`이라 어떤 경로의 비용 합도 이 값 이상이다.
 * - 비용을 안 쓰는 지도(전부 1): 값이 「남은 간선 수」여야 하므로
 *   `올림(직선거리 ÷ 가장 긴 간선)`. 한 번에 가장 긴 간선보다 멀리 갈 수는 없으니
 *   실제 남은 간선 수가 이보다 적을 수 없다.
 */
export function computeHeuristics(graph) {
    const goal = graph.byId.get(graph.goal);
    graph.h = new Map();
    if (!goal) return graph;

    for (const n of graph.nodes) {
        const d = dist(n, goal);
        graph.h.set(n.id, graph.weighted
            ? Math.floor(d / GRAPH_SCALE)
            : Math.ceil(d / graph.maxEdgeLen));
    }
    return graph;
}

/** 이웃 목록(이름순). 탐색 알고리즘이 이것만 본다. */
export function neighborsOf(graph, id) {
    return (graph.adj.get(id) || []).map(x => x.to);
}

/** a에서 b로 갈 때 드는 비용. 같은 쌍에 간선이 여럿이면 가장 싼 것. */
export function costOf(graph, a, b) {
    let best = Infinity;
    for (const x of graph.adj.get(a) || []) {
        if (x.to === b && x.cost < best) best = x.cost;
    }
    return Number.isFinite(best) ? best : 1;
}

/** h(n) */
export function hOf(graph, id) {
    return graph.h.get(id) ?? 0;
}

/** 목표를 바꾸고 h를 다시 매긴다. */
export function setGoal(graph, id) {
    if (!graph.byId.has(id)) return graph;
    graph.goal = id;
    return computeHeuristics(graph);
}

/** 시작을 바꾼다. h는 목표만 보므로 다시 매길 것이 없다. */
export function setStart(graph, id) {
    if (graph.byId.has(id)) graph.start = id;
    return graph;
}

/**
 * 시작에서 목표까지 **갈 수 있는지** 본다.
 *
 * 방향 그래프에서는 지도를 그려 놓고도 길이 없을 수 있다. 프리셋을 뽑을 때 이것으로
 * 걸러 내고, 사람이 간선을 끊었을 때도 이것으로 알린다.
 */
export function isReachable(graph, from = graph.start, to = graph.goal) {
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
        const cur = queue.shift();
        if (cur === to) return true;
        for (const nb of neighborsOf(graph, cur)) {
            if (!seen.has(nb)) {
                seen.add(nb);
                queue.push(nb);
            }
        }
    }
    return from === to;
}

/**
 * 가장 싼 길의 비용. **정답을 따로 구해 두는 자리다.**
 *
 * 화면에서 「최상 우선 탐색이 찾은 길은 얼마나 손해인가」를 말하려면 최적값을 알아야
 * 한다. 탐색 알고리즘이 내놓은 값을 그대로 믿지 않고 여기서 따로 구한다.
 */
export function cheapestCost(graph, from = graph.start, to = graph.goal) {
    const best = new Map([[from, 0]]);
    const rest = new Set(graph.nodes.map(n => n.id));
    while (rest.size) {
        let cur = null, curCost = Infinity;
        for (const id of rest) {
            const c = best.get(id);
            if (c !== undefined && c < curCost) {
                cur = id;
                curCost = c;
            }
        }
        if (cur === null) break;
        rest.delete(cur);
        if (cur === to) return curCost;
        for (const x of graph.adj.get(cur) || []) {
            const next = curCost + x.cost;
            if (best.get(x.to) === undefined || next < best.get(x.to)) best.set(x.to, next);
        }
    }
    return best.get(to) ?? Infinity;
}

/** 가장 적은 간선으로 가는 길의 간선 수. 「칸 수와 비용은 다르다」를 말할 때 쓴다. */
export function fewestHops(graph, from = graph.start, to = graph.goal) {
    const hops = new Map([[from, 0]]);
    const queue = [from];
    while (queue.length) {
        const cur = queue.shift();
        if (cur === to) return hops.get(cur);
        for (const nb of neighborsOf(graph, cur)) {
            if (!hops.has(nb)) {
                hops.set(nb, hops.get(cur) + 1);
                queue.push(nb);
            }
        }
    }
    return hops.get(to) ?? Infinity;
}

/**
 * 토글에 맞는 지도를 하나 뽑는다.
 *
 * **고르게 하지 않고 뽑는 이유는 조작을 줄이기 위해서다.** 지도 이름을 읽고 고르는 일은
 * 수업에서 배울 것이 없다. 대신 **방금 쓴 지도는 피해** 「새 지도」를 누를 때마다 같은
 * 것이 나오는 일이 없게 한다.
 *
 * @param {Array} presets  프리셋 목록
 * @param {object} opts    `{directed, weighted, cyclic}`
 * @param {string} [avoid] 방금 쓴 프리셋 id
 */
export function pickPreset(presets, opts, avoid) {
    const usable = presets.filter(p => {
        const g = buildGraph(p, opts);
        return isReachable(g);
    });
    if (usable.length === 0) return presets[0];

    const pool = usable.length > 1 ? usable.filter(p => p.id !== avoid) : usable;
    return pool[Math.floor(Math.random() * pool.length)];
}

/* ================================================================
   간선 끊기 — 손대는 자리를 좁게 둔다

   **끊는 것만 있다.** 노드를 더하거나 지우거나 옮기는 것도, 간선을 새로 놓는 것도 없다.
   프리셋 좌표는 간선이 교차하지 않고 상관없는 노드를 관통하지 않도록 골라 둔 것이고
   (`check:graph`가 그것을 지킨다), **새 간선에는 그 보증이 없다** — 학생이 놓은 선이
   엉뚱한 노드를 뚫고 지나가면 지도를 읽을 수가 없다. 끊는 것은 선이 없어질 뿐이라
   그 보증을 건드리지 않는다.
   ================================================================ */

/**
 * 간선을 끊는다.
 *
 * **배열을 갈아 끼우지 않고 제자리에서 뺀다.** `graph-view.js`의 `setData` 가
 * `graph.edges` 를 **참조로** 붙들고 있어서, 새 배열로 바꾸면 그 뒤로 화면과 모델이
 * 영영 갈라진다 — 끊은 간선이 계속 그려지고 그 뒤의 변화가 하나도 안 보인다.
 * 한 번 그렇게 깨졌다.
 */
export function removeEdge(graph, edgeId) {
    const i = graph.edges.findIndex(e => e.id === edgeId);
    if (i < 0) return false;
    graph.edges.splice(i, 1);
    recompute(graph);
    return true;
}
