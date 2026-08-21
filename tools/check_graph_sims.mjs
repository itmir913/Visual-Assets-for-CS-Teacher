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
//   - 균일 비용과 A*가 찾은 길은 늘 **비용이 가장 적은 길**이다.
//     A*는 닫은 노드를 다시 열지 않으므로, h가 일관적일 때만 성립한다 —
//     증명은 `graph-model.js`에 적혀 있지만 **여기서는 말이 아니라 값으로 본다**
//   - 어느 방법이든 찾았다는 길은 **실제로 이어져 있다**
//   - 방문 검사를 끄면 되돌아갈 길이 있는 한 끝나지 않고, 되돌아갈 길이 없으면 끝난다

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

import {GRAPH_PRESETS} from '../src/entries/_lib/graph-presets.js';
import * as M from '../src/entries/_lib/graph-model.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM = path.join(ROOT, '인공지능기초', 'simulator');

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
        setData() {
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

    return runs;
}

/* ================================================================
   2. 정보 이용 탐색 — A* · 최상 우선 · 너비 우선 · 깊이 우선
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

    let runs = 0, 그리디판 = 0, 그리디손해 = 0;
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

            for (const algo of ['astar', 'greedy', 'bfs', 'dfs']) {
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
    const 고친뒤에보기 = (무엇) => {
        for (const n of sim.graph.nodes) {
            const rest = M.cheapestCost(sim.graph, n.id, sim.graph.goal);
            if (Number.isFinite(rest) && M.hOf(sim.graph, n.id) > rest) {
                bad(`고치기 ${무엇}: h(${n.id})가 실제 남은 비용을 넘는다`);
            }
        }
        const best = M.cheapestCost(sim.graph);
        if (!Number.isFinite(best)) return;          // 길이 끊겼으면 비교할 것이 없다
        const r = sim.runSilently('astar');
        if (!r) return bad(`고치기 ${무엇}: 갈 수 있는데 A*가 길을 못 찾았다`);
        if (!pathIsReal(sim.graph, r.path)) bad(`고치기 ${무엇}: 찾은 길이 이어져 있지 않다`);
        if (r.cost !== best) bad(`고치기 ${무엇}: A*가 비용 ${r.cost}, 가장 싼 길은 ${best}`);
    };

    for (const preset of GRAPH_PRESETS) {
        const combo = {directed: false, weighted: true, cyclic: true};

        load(preset, combo);
        const 끊을것 = sim.graph.edges.find(e => e.extra) || sim.graph.edges[0];
        M.removeEdge(sim.graph, 끊을것.id);
        고친뒤에보기(`${preset.id} 간선 끊기`);

        load(preset, combo);
        // 아직 이어지지 않은 두 노드를 찾아 잇는다
        const ids = sim.graph.nodes.map(n => n.id);
        for (const a of ids) {
            const b = ids.find(x => x !== a && !M.neighborsOf(sim.graph, a).includes(x));
            if (b) {
                M.addEdge(sim.graph, a, b);
                break;
            }
        }
        고친뒤에보기(`${preset.id} 간선 잇기`);

        load(preset, combo);
        const 옮길것 = sim.graph.nodes[2] || sim.graph.nodes[0];
        M.moveNode(sim.graph, 옮길것.id, 옮길것.x + 60, 옮길것.y - 45);
        고친뒤에보기(`${preset.id} 노드 옮기기`);
    }

    // **볼 것이 없는 화면이 되지 않게 지킨다.** 최상 우선이 늘 A*와 같은 답을 낸다면
    // 「h만 보면 손해를 볼 수 있다」를 학생에게 보여 줄 수가 없다.
    if (그리디손해 === 0) {
        bad(`정보: 최상 우선이 손해 보는 지도가 하나도 없다(${그리디판}판) — 화면에서 볼 것이 사라졌다`);
    }
    console.log(`  최상 우선이 A*보다 비싼 길을 찾은 판: ${그리디판}판 중 ${그리디손해}판`);

    return runs;
}

/* ================================================================ */
console.log(`지도 ${GRAPH_PRESETS.length}장 × 조합 ${COMBOS.length}가지를 두 페이지에서 돌린다`);
const a = checkBlind();
const b = checkHeuristic();
console.log(`  돌린 횟수 — 맹목적 탐색 ${a}, 정보 이용 탐색 ${b}`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
