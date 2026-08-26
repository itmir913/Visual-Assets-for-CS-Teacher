// 탐색 시뮬레이터 두 페이지의 **그래프 탭을 페이지 원문 그대로 돌려 본다.**
//
// 옮겨 적은 사본을 검사하면 페이지가 실제로 무엇을 하는지 알 수 없다. 그래서 HTML에서
// 클래스 원문을 잘라 내 그대로 실행하고, DOM은 그 클래스가 부르는 것만 흉내 낸다.
//
// **판정은 탐색 결과를 따로 구해서 한다.** 같은 코드로 두 번 세면 틀린 것도 맞다고 나온다.
// 정답은 `graph-model.js`의 `cheapestCost`(다익스트라)와 `fewestHops`(너비 우선)가 따로 구한다.
//
// 못박는 것.
//   - 너비 우선이 찾은 길은 늘 **칸 수가 가장 적은 길**이다
//   - 균일 비용 · 다익스트라 · A*가 찾은 길은 늘 **비용이 가장 적은 길**이다.
//     A*는 닫은 노드를 다시 열지 않으므로, h가 일관적일 때만 성립한다 —
//     증명은 `graph-model.js`에 적혀 있지만 **여기서는 말이 아니라 값으로 본다**
//   - 다익스트라가 연 노드는 **시작점에서 목표보다 가까운 노드 전부**다 —
//     h를 슬쩍 보고 있으면 이 집합이 목표 쪽으로 치우쳐 곧바로 걸린다
//   - 어느 방법이든 찾았다는 길은 **실제로 이어져 있다**
//   - 방문 검사를 끄면 되돌아갈 길이 있는 한 끝나지 않고, 되돌아갈 길이 없으면 끝난다

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

import {GRAPH_PRESETS} from '../src/entries/_lib/graph-presets.js';
import * as M from '../src/entries/_lib/graph-model.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM = path.join(ROOT, 'simulator', 'ai');

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 20) console.log('  ✗ ' + m);
};

const COMBOS = [];
for (const directed of [false, true]) {
    for (const weighted of [false, true]) {
        for (const cyclic of [false, true]) COMBOS.push({directed, weighted, cyclic});
    }
}
const tag = (c) => `${c.directed ? '방향' : '무방향'}/${c.weighted ? '비용' : '균일'}/${c.cyclic ? '사이클' : '무사이클'}`;

/* ================================================================
   페이지에서 클래스 원문을 떼어 내 돌릴 수 있게 만든다
   ================================================================ */

/**
 * **잘라 낸 끝이 주석 한가운데면 안 된다.** 다음 절 머리말(`/* ===`)이 열린 채로 남으면
 * 이어 붙인 코드가 통째로 주석 속으로 들어가, 엉뚱한 자리에서 문법 오류가 난다.
 */
function cut(html, fromMark, toMark) {
    const a = html.indexOf(fromMark);
    const b = html.indexOf(toMark);
    if (a < 0 || b < 0 || b < a) {
        throw new Error(`토막을 못 찾았다: ${fromMark} … ${toMark}\n` +
            '페이지의 절 머리말을 고쳤다면 이 검사의 표시도 함께 고쳐야 한다.');
    }
    const piece = html.slice(a, b);
    const openComment = piece.lastIndexOf('    /* =');
    return openComment < 0 ? piece : piece.slice(0, openComment);
}

/** 클래스가 부르는 것만 갖춘 가짜 DOM. */
function makeSandbox() {
    const els = new Map();
    const el = (id) => {
        if (!els.has(id)) {
            els.set(id, {
                id, value: '', checked: false, innerHTML: '', max: '1000', min: '50',
                classList: {
                    add() {
                    }, remove() {
                    }, toggle() {
                    }, replace() {
                    },
                },
                addEventListener() {
                },
                scrollIntoView() {
                },
                set onclick(_) {
                },
            });
        }
        return els.get(id);
    };

    // 그리는 일은 하지 않되 **부르는 것은 다 있어야 한다.** 하나라도 빠지면 검사가
    // 화면 문제로 죽어, 정작 보려던 탐색 결과를 못 본다.
    const view = {
        viewMode: 'fit',
        // **진짜 뷰와 똑같이 배열을 참조로 붙든다.** 여기서 사본을 뜨거나 아무것도 안 하면
        // 「모델에서는 지웠는데 화면에는 남아 있다」가 검사에 보이지 않는다. 실제로 그랬다.
        edges: [],
        setData(d) {
            this.edges = (d && d.edges) || [];
            return this;
        },
        drawnEdgeIds() {
            return this.edges.map(e => e.id);
        },
        setViewMode(mode) {
            this.viewMode = mode;
            return this;
        },
        setActive() {
            return this;
        },
        focus() {
            return this;
        },
        clear() {
            return this;
        },
        update() {
            return this;
        },
        fit() {
            return this;
        },
        resize() {
            return this;
        },
        on() {
            return this;
        },
    };

    const sandbox = {
        document: {getElementById: el},
        window: {GraphModel: M, GRAPH_PRESETS, createGraphView: () => view},
        setTimeout, clearTimeout,
        setInterval: () => 0,
        clearInterval: () => {
        },
        console,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    return {sandbox, el};
}

/** 찾은 길이 실제로 이어져 있는가. 그래프를 직접 보고 판정한다. */
function pathIsReal(graph, p) {
    if (!p || !p.length) return false;
    if (p[0] !== graph.start || p[p.length - 1] !== graph.goal) return false;
    for (let i = 0; i + 1 < p.length; i++) {
        if (!M.neighborsOf(graph, p[i]).includes(p[i + 1])) return false;
    }
    return true;
}

/* ================================================================
   1. 맹목적 탐색 — 너비 우선 · 깊이 우선 · 균일 비용
   ================================================================ */
function checkBlind() {
    const html = fs.readFileSync(path.join(SIM, 'search-bfs-dfs.html'), 'utf8');
    const src = cut(html, '    class GraphSearchSimulator {', '       3. Grid Search Simulator');

    const {sandbox, el} = makeSandbox();
    vm.runInContext(src + '\nglobalThis.__Sim = GraphSearchSimulator;', sandbox);
    const Sim = sandbox.__Sim;
    const sim = new Sim();

    const run = (preset, combo, algo, revisit = true) => {
        el('graph-opt-directed').checked = combo.directed;
        el('graph-opt-weighted').checked = combo.weighted;
        el('graph-opt-cyclic').checked = combo.cyclic;
        el('graph-opt-revisit').checked = revisit;
        el('graph-algo').value = (algo === 'ucs' ? 'bfs' : algo);

        sim.loadPreset(preset);
        sim.forcedAlgo = (algo === 'ucs') ? 'ucs' : null;
        sim.initSearch();

        let guard = 0;
        while (sim.step() && guard++ < 5000) { /* 끝날 때까지 */
        }
        return sim.search;
    };

    let runs = 0;
    for (const preset of GRAPH_PRESETS) {
        for (const combo of COMBOS) {
            const truth = M.buildGraph(preset, combo);
            const bestCost = M.cheapestCost(truth);
            const bestHops = M.fewestHops(truth);

            for (const algo of ['bfs', 'dfs', 'ucs']) {
                const st = run(preset, combo, algo);
                runs++;
                const where = `맹목 ${preset.id} ${tag(combo)} ${algo}`;

                if (st.status !== 'finished') {
                    bad(`${where}: 끝나지 않았다`);
                    continue;
                }
                if (!st.path) {
                    bad(`${where}: 길을 못 찾았다(도달 가능한 지도인데)`);
                    continue;
                }
                if (!pathIsReal(sim.graph, st.path)) {
                    bad(`${where}: 찾았다는 길이 실제로 이어져 있지 않다 — ${st.path.join('→')}`);
                    continue;
                }

                const hops = st.path.length - 1;
                const cost = sim.pathCost(st.path);
                if (algo === 'bfs' && hops !== bestHops) bad(`${where}: 칸 수 ${hops}, 최소는 ${bestHops}`);
                if (algo === 'ucs' && cost !== bestCost) bad(`${where}: 비용 ${cost}, 최소는 ${bestCost}`);
                if (cost < bestCost) bad(`${where}: 비용 ${cost} < 최소 ${bestCost} — 계산이 어긋났다`);
                if (hops < bestHops) bad(`${where}: 칸 수 ${hops} < 최소 ${bestHops} — 계산이 어긋났다`);
                if (st.closed.size > truth.nodes.length) bad(`${where}: 연 노드가 노드 수보다 많다`);
            }
        }
    }

    // 방문 검사를 끄면 **되돌아갈 길이 아예 없을 때만** 끝난다.
    // 무방향 간선은 사이클이 없어도 왔던 길로 되돌아가므로 끝나지 않는다.
    for (const preset of GRAPH_PRESETS) {
        const 방향무사이클 = run(preset, {directed: true, weighted: false, cyclic: false}, 'dfs', false);
        if (방향무사이클.steps > Sim.MAX_STEPS) {
            bad(`맹목 ${preset.id}: 방향+무사이클인데 상한에 걸렸다 — 되돌아갈 길이 없어야 한다`);
        }
        const 무방향무사이클 = run(preset, {directed: false, weighted: false, cyclic: false}, 'dfs', false);
        if (무방향무사이클.steps <= Sim.MAX_STEPS) {
            bad(`맹목 ${preset.id}: 무방향+무사이클인데 끝났다 — 왔던 길로 되돌아가야 한다`);
        }
        if (무방향무사이클.status !== 'finished') {
            bad(`맹목 ${preset.id}: 상한에 걸리고도 멈추지 못했다`);
        }
    }

    checkCutting(sim, el, '맹목');

    return runs;
}

/**
 * 간선 끊기 — **누르는 흐름을 그대로 밟고, 화면이 무엇을 들고 있는지까지 본다.**
 *
 * 한 번 이렇게 깨졌다. `removeEdge` 가 `graph.edges` 를 **새 배열로 갈아 끼우는데**
 * 뷰는 옛 배열을 참조로 붙들고 있어서, 모델에서 지운 간선이 화면에 그대로 남았다.
 * 학생은 그 선을 또 누르고, 화면은 「끊었습니다」라고 다시 알린다.
 * **모델만 보아서는 드러나지 않는다** — 뷰가 무엇을 들고 있는지 함께 보아야 잡힌다.
 */
function checkCutting(sim, el, 이름) {
    el('graph-opt-edit').checked = true;
    sim.setEditing(true);

    const 끊을것 = sim.graph.edges[0].id;
    sim.onEdgeClick(끊을것);
    if (sim.graph.edges.some(e => e.id === 끊을것)) {
        bad(`${이름} 끊기: 간선을 눌렀는데 모델에서 끊기지 않았다`);
    }
    if (view0(sim).includes(끊을것)) {
        bad(`${이름} 끊기: 모델에서는 끊겼는데 화면에는 그대로 남아 있다`);
    }

    // 이미 없는 간선을 또 눌러도 「끊었습니다」라고 하지 않는다
    el('graph-status').innerHTML = '';
    sim.onEdgeClick(끊을것);
    if (el('graph-status').innerHTML.includes('끊었습니다')) {
        bad(`${이름} 끊기: 없는 간선을 눌렀는데 끊었다고 알린다`);
    }

    // 끊기를 끄면 간선을 눌러도 끊기지 않는다
    sim.setEditing(false);
    el('graph-opt-edit').checked = false;
    const 남은것 = sim.graph.edges[0].id;
    sim.onEdgeClick(남은것);
    if (!sim.graph.edges.some(e => e.id === 남은것)) {
        bad(`${이름} 끊기를 껐는데 간선이 끊겼다`);
    }

    // 되돌리면 원래 지도로 돌아간다 — 화면까지 함께 돌아와야 한다
    sim.restore();
    if (!sim.graph.edges.some(e => e.id === 끊을것)) bad(`${이름} 되돌리기: 끊은 간선이 살아나지 않았다`);
    if (!view0(sim).includes(끊을것)) bad(`${이름} 되돌리기: 모델은 돌아왔는데 화면이 그대로다`);

    // 새 지도를 뽑으면 끊기가 꺼진다 — 켠 채로 두면 지도를 살펴보려던 클릭이 간선을 끊는다
    el('graph-opt-edit').checked = true;
    sim.setEditing(true);
    sim.newMap();
    if (el('graph-opt-edit').checked) bad(`${이름} 끊기: 새 지도를 폈는데 끊기가 켜진 채다`);

    // 노드 클릭은 **끊기를 켜 두어도** 목표 지정이다
    el('graph-opt-edit').checked = true;
    sim.setEditing(true);
    const 딴노드 = sim.graph.nodes.map(n => n.id).find(id => id !== sim.graph.start && id !== sim.graph.goal);
    sim.onNodeClick(딴노드);
    if (sim.graph.goal !== 딴노드) bad(`${이름} 끊기를 켠 채로 노드를 눌렀는데 목표가 바뀌지 않았다`);
    sim.setEditing(false);
    el('graph-opt-edit').checked = false;
}

/** 화면이 지금 그리고 있는 간선 id. **모델이 아니라 뷰에게 묻는다.** */
function view0(sim) {
    return sim.view.drawnEdgeIds();
}

/**
 * **다익스트라가 연 노드가 맞는가 — 화면의 코드를 쓰지 않고 따로 구해서 본다.**
 *
 * 다익스트라는 g가 작은 것부터 꺼내고 목표를 꺼내는 순간 멈춘다. 그러므로 닫힌 집합은
 * **시작점에서의 최단 비용이 목표보다 싼 노드 전부**이고, 그보다 비싼 노드는 하나도
 * 들어 있지 않다(같은 값인 노드는 꺼내는 차례에 따라 들어갈 수도 아닐 수도 있다).
 *
 * **이것만으로는 「h를 보지 않는다」가 지켜지지 않는다.** 동점에서만 h로 고르게 바꿔 보니
 * 이 검사도 「가장 싼 길」 검사도 통과했다(연 노드 수만 조금 줄었다). 값이 아니라
 * **꺼내는 차례**가 틀어지는 것이라 집합으로는 안 잡힌다 — 그 자리는 `checkDijkstraBlind`가 본다.
 */
function checkDijkstraClosed(graph, closed, bestCost, where, bad) {
    for (const id of closed) {
        const d = M.cheapestCost(graph, graph.start, id);
        if (d > bestCost) {
            bad(`${where}: 목표보다 비싼 노드 ${id}(${d} > ${bestCost})를 열었다 — 싼 것부터 꺼내지 않았다`);
            return;
        }
    }
    for (const n of graph.nodes) {
        if (n.id === graph.start || n.id === graph.goal) continue;
        const d = M.cheapestCost(graph, graph.start, n.id);
        if (d < bestCost && !closed.has(n.id)) {
            bad(`${where}: 목표보다 가까운 노드 ${n.id}(${d} < ${bestCost})를 열지 않고 지나쳤다`);
            return;
        }
    }
}

/**
 * **다익스트라가 h를 정말 안 보는가 — h를 통째로 0으로 만들고 다시 돌려 본다.**
 *
 * 안 본다면 h가 무엇이든 결과가 한 글자도 달라질 수 없다. 그래서 **연 노드를 꺼낸
 * 차례까지 그대로**여야 한다(`Set`은 넣은 차례를 지키므로 이어 붙이면 그게 곧 차례다).
 *
 * **집합만 대 보아서는 모자란다.** 동점일 때만 h로 고르게 바꾸어 보면 비용도 그대로고
 * 연 노드의 집합도 그대로인데 **꺼내는 차례만** 바뀐다. 화면에서 「사방으로 고르게
 * 번져 나간다」고 적어 둔 것이 어긋나는 자리가 바로 거기다 — 눈에는 보이는데
 * 값으로는 안 잡히므로, 이렇게 h를 없애고 대 보는 수밖에 없다.
 */
function checkDijkstraBlind(sim, where, bad) {
    const 진짜 = sim.runSilently('dijkstra');
    if (!진짜) return;

    const 원래h = sim.graph.h;
    sim.graph.h = new Map([...원래h.keys()].map(k => [k, 0]));
    const 눈감고 = sim.runSilently('dijkstra');
    sim.graph.h = 원래h;

    if (!눈감고) return bad(`${where}: h를 0으로 두었더니 길을 못 찾았다`);
    if (진짜.path.join() !== 눈감고.path.join()) {
        bad(`${where}: h를 0으로 두니 찾는 길이 달라졌다 — h를 보고 있다`);
    }
    const 차례 = (r) => [...r.engine.closedSet].join(',');
    if (차례(진짜) !== 차례(눈감고)) {
        bad(`${where}: h를 0으로 두니 노드를 여는 차례가 달라졌다 — h를 보고 있다
` +
            `      h 그대로: ${차례(진짜)}
      h를 0으로: ${차례(눈감고)}`);
    }
}

/* ================================================================
   2. 정보 이용 탐색 — A* · 다익스트라 · 최상 우선 · 너비 우선 · 깊이 우선
   ================================================================ */
function checkHeuristic() {
    const html = fs.readFileSync(path.join(SIM, 'search-heuristic.html'), 'utf8');
    const engine = cut(html, '    class HeuristicSearch {', '       2. Tree Search Simulator');
    const graph = cut(html, '    class GraphSearchSimulator {', '       5. Main UI Controller');

    const {sandbox, el} = makeSandbox();
    vm.runInContext(engine + '\n' + graph + '\nglobalThis.__Sim = GraphSearchSimulator;', sandbox);
    const sim = new sandbox.__Sim();

    const load = (preset, combo) => {
        el('graph-opt-directed').checked = combo.directed;
        el('graph-opt-weighted').checked = combo.weighted;
        el('graph-opt-cyclic').checked = combo.cyclic;
        sim.loadPreset(preset);
    };

    let runs = 0, 그리디판 = 0, 그리디손해 = 0, 다익판 = 0, A별로덜엶 = 0;
    for (const preset of GRAPH_PRESETS) {
        for (const combo of COMBOS) {
            load(preset, combo);
            const truth = M.buildGraph(preset, combo);
            const bestCost = M.cheapestCost(truth);
            const bestHops = M.fewestHops(truth);

            // h(n)이 실제로 남은 비용을 넘지 않는가 — **A*의 최적성이 여기 걸려 있다.**
            for (const n of sim.graph.nodes) {
                const rest = M.cheapestCost(sim.graph, n.id, sim.graph.goal);
                if (Number.isFinite(rest) && M.hOf(sim.graph, n.id) > rest) {
                    bad(`정보 ${preset.id} ${tag(combo)}: h(${n.id})가 실제 남은 비용을 넘는다`);
                }
            }

            for (const algo of ['astar', 'dijkstra', 'greedy', 'bfs', 'dfs']) {
                const r = sim.runSilently(algo);
                runs++;
                const where = `정보 ${preset.id} ${tag(combo)} ${algo}`;

                if (!r) {
                    bad(`${where}: 길을 못 찾았다(도달 가능한 지도인데)`);
                    continue;
                }
                if (!pathIsReal(sim.graph, r.path)) {
                    bad(`${where}: 찾았다는 길이 실제로 이어져 있지 않다 — ${r.path.join('→')}`);
                    continue;
                }
                if (r.cost < bestCost) bad(`${where}: 비용 ${r.cost} < 최소 ${bestCost} — 계산이 어긋났다`);
                if (r.hops < bestHops) bad(`${where}: 칸 수 ${r.hops} < 최소 ${bestHops} — 계산이 어긋났다`);
                if (algo === 'astar' && r.cost !== bestCost) {
                    bad(`${where}: A*가 비용 ${r.cost}인 길을 찾았는데 가장 싼 길은 ${bestCost}`);
                }
                if (algo === 'dijkstra') {
                    if (r.cost !== bestCost) {
                        bad(`${where}: 다익스트라가 비용 ${r.cost}인 길을 찾았는데 가장 싼 길은 ${bestCost}`);
                    }
                    checkDijkstraClosed(sim.graph, r.engine.closedSet, bestCost, where, bad);
                    checkDijkstraBlind(sim, where, bad);

                    // **A*가 다익스트라보다 덜 여는 판이 있어야 한다.** 없으면 h(n)을 얹은
                    // 보람이 화면에 하나도 안 나온다 — 「A*는 다익스트라에 h를 더한 것」이라고
                    // 적어 놓고 정작 더한 값이 아무 일도 안 하는 셈이 된다.
                    다익판++;
                    const a = sim.runSilently('astar');
                    if (a && a.opened < r.opened) A별로덜엶++;
                    if (a && a.opened > r.opened) {
                        bad(`${where}: A*가 ${a.opened}개, 다익스트라가 ${r.opened}개 — h가 일관적이면 A*가 더 열 수 없다`);
                    }
                }
                if (algo === 'bfs' && r.hops !== bestHops) {
                    bad(`${where}: 너비 우선이 ${r.hops}칸인 길을 찾았는데 최소는 ${bestHops}칸`);
                }
                if (algo === 'greedy' && combo.weighted && combo.cyclic) {
                    그리디판++;
                    if (r.cost > bestCost) 그리디손해++;
                }
                if (r.opened > truth.nodes.length) bad(`${where}: 연 노드가 노드 수보다 많다`);
            }
        }
    }

    /* ---- 지도를 고친 뒤에도 값이 성립하는가 ----
       간선을 끊고 잇고 노드를 옮기는 것은 **좌표와 간선을 바꾸는 일**이다. 비용과 h(n)이
       거기서 나오므로, 고치고 나서도 h가 실제 남은 비용을 넘지 않아야 하고 A*가 여전히
       가장 싼 길을 찾아야 한다. 고치기를 넣으면서 이것이 깨지면 아무도 모르게 깨진다. */
    const 끊은뒤에보기 = (무엇) => {
        for (const n of sim.graph.nodes) {
            const rest = M.cheapestCost(sim.graph, n.id, sim.graph.goal);
            if (Number.isFinite(rest) && M.hOf(sim.graph, n.id) > rest) {
                bad(`끊기 ${무엇}: h(${n.id})가 실제 남은 비용을 넘는다`);
            }
        }
        const best = M.cheapestCost(sim.graph);
        if (!Number.isFinite(best)) return;          // 길이 끊겼으면 비교할 것이 없다
        const r = sim.runSilently('astar');
        if (!r) return bad(`끊기 ${무엇}: 갈 수 있는데 A*가 길을 못 찾았다`);
        if (!pathIsReal(sim.graph, r.path)) bad(`끊기 ${무엇}: 찾은 길이 이어져 있지 않다`);
        if (r.cost !== best) bad(`끊기 ${무엇}: A*가 비용 ${r.cost}, 가장 싼 길은 ${best}`);
    };

    for (const preset of GRAPH_PRESETS) {
        const combo = {directed: false, weighted: true, cyclic: true};

        load(preset, combo);
        const 끊을것 = sim.graph.edges.find(e => e.extra) || sim.graph.edges[0];
        M.removeEdge(sim.graph, 끊을것.id);
        끊은뒤에보기(`${preset.id} 간선 끊기`);

    }

    // **볼 것이 없는 화면이 되지 않게 지킨다.** 최상 우선이 늘 A*와 같은 답을 낸다면
    // 「h만 보면 손해를 볼 수 있다」를 학생에게 보여 줄 수가 없다.
    if (그리디손해 === 0) {
        bad(`정보: 최상 우선이 손해 보는 지도가 하나도 없다(${그리디판}판) — 화면에서 볼 것이 사라졌다`);
    }
    console.log(`  최상 우선이 A*보다 비싼 길을 찾은 판: ${그리디판}판 중 ${그리디손해}판`);

    if (A별로덜엶 === 0) {
        bad(`정보: A*가 다익스트라보다 덜 여는 지도가 하나도 없다(${다익판}판) — h(n)을 얹은 값이 화면에 안 나온다`);
    }
    console.log(`  A*가 다익스트라보다 노드를 덜 연 판: ${다익판}판 중 ${A별로덜엶}판`);

    checkCutting(sim, el, '정보');
    checkCompareTable(sim, el);

    return runs;
}

/**
 * **「나란히 돌려 보기」 단추를 실제로 눌러 본다.**
 *
 * 표를 만드는 코드는 탐색이 끝난 뒤에야 도는 자리라, 위의 480판을 다 돌려도
 * 한 번도 안 지나간다. 화면을 띄우지 않고 이 자리를 밟아 볼 길은 이것뿐이다.
 *
 * 채운 글자에 `undefined`나 `NaN`이 없는지까지 본다 — 서식 문자열에서 이름을
 * 하나 잘못 적으면 값이 아니라 그 글자가 그대로 학생 화면에 나온다.
 */
function checkCompareTable(sim, el) {
    for (const preset of GRAPH_PRESETS) {
        el('graph-opt-directed').checked = false;
        el('graph-opt-weighted').checked = true;
        el('graph-opt-cyclic').checked = true;
        sim.loadPreset(preset);
        sim.compare();

        const 표 = el('graph-compare-body').innerHTML;
        const 알림 = el('graph-status').innerHTML;
        for (const 이름 of ['최상 우선 탐색', '다익스트라', 'A* 탐색']) {
            if (!표.includes(이름)) bad(`나란히 ${preset.id}: 표에 「${이름}」 줄이 없다`);
        }
        for (const 글자 of ['undefined', 'NaN', 'null']) {
            if (표.includes(글자)) bad(`나란히 ${preset.id}: 표에 ${글자}가 찍혔다`);
            if (알림.includes(글자)) bad(`나란히 ${preset.id}: 알림에 ${글자}가 찍혔다`);
        }
        if (!알림.includes('A*가 찾은 길')) bad(`나란히 ${preset.id}: 지도에 무엇을 그렸는지 알리지 않는다`);
        // 화면에 남는 자취는 A*의 것이어야 한다 — 표에서 읽은 길을 지도에서 곧바로 찾을 수 있어야 하므로.
        if (sim.engine.type !== 'astar') bad(`나란히 ${preset.id}: 지도에 남은 자취가 ${sim.engine.type}의 것이다`);
    }
}

/* ================================================================ */
console.log(`지도 ${GRAPH_PRESETS.length}장 × 조합 ${COMBOS.length}가지를 두 페이지에서 돌린다`);
const a = checkBlind();
const b = checkHeuristic();
console.log(`  돌린 횟수 — 맹목적 탐색 ${a}, 정보 이용 탐색 ${b}`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
