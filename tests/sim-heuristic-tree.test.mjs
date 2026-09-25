// 정보 이용 탐색 시뮬레이터의 **트리 탭을 페이지 원문 그대로 돌려 본다.**
//
// 그래프 탭은 `sim-graph-sim.test.mjs`가 본다. 트리 탭은 오래도록 아무도 안 보고 있었고,
// 그 사이에 **화면에 적힌 말과 어긋난 것 둘**이 남아 있었다.
//
//   - 동점일 때 h가 작은 쪽을 골랐다. 목표 노드의 h는 0이라 **언제나 그 규칙을 이긴다** —
//     f가 같은 노드가 아무리 앞서 발견되어 있어도 목표부터 꺼내 탐색이 거기서 끝났다.
//   - 간선 비용이 1~3이라 h(= 남은 칸 수)를 뒤집을 수 없었다. 그래서 **목표가 없는 가지로
//     내려갔다 되돌아오는 장면**이 좀처럼 안 나왔다.
//
// 못박는 것.
//   - 꺼내는 노드는 언제나 **f가 가장 작은 것, 같으면 먼저 발견한 것**이다
//   - 동점이 실제로 일어나고, **목표를 발견해 놓고도 다른 노드를 먼저 여는 판**이 나온다
//   - 새 트리는 **목표가 없는 가지로 두 칸 이상 내려갔다 되돌아온다**
//   - h(n)은 **목표까지의 칸 수 그대로**이고, 남은 비용을 넘지 않는다(admissible)
//   - 네 방법이 찾는 길은 트리에 하나뿐인 그 길이다
//
// **판정은 페이지 코드를 다시 쓰지 않고 따로 구한다.** 부모 사슬·칸 수·비용·유일한 길을
// 여기서 직접 세어 대조한다.

import {test, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

import {josa} from '../src/entries/_lib/josa.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = path.join(ROOT, 'simulator', 'ai', 'search-heuristic.html');

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 20) console.log('  ✗ ' + m);
};

/** **잘라 낸 끝이 주석 한가운데면 안 된다** — 까닭은 `sim-graph-sim.test.mjs`에 적어 두었다. */
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
                id, value: '', innerHTML: '',
                classList: {
                    add() {}, remove() {}, toggle() {}, replace() {},
                },
                addEventListener() {},
                set onclick(_) {},
            });
        }
        return els.get(id);
    };

    // **트리를 참조로 붙든다.** 진짜 렌더러도 그렇게 한다 — 아무것도 안 하는 스텁으로
    // 두면 「모델과 화면이 갈라졌다」를 검사가 못 본다.
    const view = {
        root: null,
        handlers: {},
        setData(d) { this.root = d; return this; },
        on(name, cb) { this.handlers[name] = cb; return this; },
        update() { return this; },
        fit() { return this; },
        clear() { return this; },
        resize() { return this; },
    };

    const sandbox = {
        document: {getElementById: el},
        window: {josa, createTreeView: () => view},
        setTimeout, clearTimeout,
        setInterval: () => 0,
        clearInterval: () => {},
        console,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    return {sandbox, el, view};
}

/* ================================================================
   페이지를 보지 않고 따로 구하는 값들
   ================================================================ */

/** 시뮬레이터가 내놓은 트리를 **여기서 다시 읽는다.** */
function readTree(sim) {
    const parent = new Map();
    sim.childrenOf.forEach((kids, from) => kids.forEach(to => parent.set(to, from)));
    const cost = new Map();
    sim.nodeMap.forEach((n, id) => cost.set(id, n.edgeCost));
    return {parent, cost, children: sim.childrenOf, start: sim.startNode, goal: sim.goalNode};
}

/** 시작점에서 목표까지 — 트리라서 길은 하나뿐이다. */
function onlyPath(t) {
    const up = [];
    for (let c = t.goal; c !== undefined; c = t.parent.get(c)) up.push(c);
    return up.reverse();
}

/** n에서 목표 길목까지 올라간 칸 수 + 거기서 목표까지의 칸 수. */
function hops(t, chain, id) {
    let d = 0;
    for (let c = id; c !== undefined; c = t.parent.get(c), d++) {
        if (chain.has(c)) return d + chain.get(c);
    }
    return Infinity;
}

/** 길목 밖으로 몇 칸이나 내려갔다 왔는가. 자식은 부모를 연 뒤에야 열린다. */
function detourDepth(t, chain, closed) {
    let best = 0;
    for (const id of closed) {
        if (chain.has(id)) continue;
        let d = 0;
        for (let c = id; c !== undefined && !chain.has(c); c = t.parent.get(c)) d++;
        best = Math.max(best, d);
    }
    return best;
}

/* ================================================================
   한 판을 끝까지 돌리며 **꺼내는 규칙을 회차마다 본다**
   ================================================================ */
function runWatched(sim, algo, el, where) {
    el('tree-algo').value = algo;
    sim.resetSearch();
    sim.initSearchEngine();
    const engine = sim.searchEngine;

    let 동점 = 0, 목표두고다른것 = 0, 골라낸것 = null;
    for (let 걸음 = 0; !engine.isFinished && 걸음 < 20000; 걸음++) {
        // 꺼내기 직전의 Open Set을 그대로 뜬다. **규칙은 여기서 따로 계산한다.**
        const 후보 = engine.state === 'SELECT' ? null : [...engine.openSet];
        const res = engine.step();
        if (!res) break;
        if (res.type === 'success') 골라낸것 = res;
        if (!후보 || (res.type !== 'select' && res.type !== 'success')) continue;

        if (algo === 'bfs' || algo === 'dfs') {
            const 맞는것 = algo === 'bfs' ? 후보[0] : 후보[후보.length - 1];
            if (res.node !== 맞는것) bad(`${where} ${algo}: ${맞는것}을 꺼내야 하는데 ${res.node}를 꺼냈다`);
            continue;
        }

        // **f가 가장 작은 것, 같으면 먼저 발견한 것.**
        const f = (id) => engine.fScore.get(id);
        const 최소f = Math.min(...후보.map(f));
        const 동점자 = 후보.filter(id => f(id) === 최소f);
        const 맞는것 = 동점자.reduce((a, b) => engine.foundAt.get(a) <= engine.foundAt.get(b) ? a : b);
        if (동점자.length > 1) 동점++;
        if (res.node !== 맞는것) {
            bad(`${where} ${algo}: f=${최소f} 동점 ${동점자.join(',')} 가운데 ` +
                `먼저 발견한 ${맞는것}을 꺼내야 하는데 ${res.node}를 꺼냈다`);
        }
        // **버그의 장면 그대로다** — 목표가 Open Set에 있는데 다른 노드를 꺼내는 회차.
        if (후보.includes(sim.goalNode) && res.node !== sim.goalNode) 목표두고다른것++;
    }
    return {engine, 결과: 골라낸것, 동점, 목표두고다른것};
}

/* ================================================================
   본 검사
   ================================================================ */
const html = fs.readFileSync(PAGE, 'utf8');
const engineSrc = cut(html, '    class HeuristicSearch {', '       2. Tree Search Simulator');
const treeSrc = cut(html, '    class TreeSearchSimulator {', '       3. Grid Search Simulator');

const {sandbox, el} = makeSandbox();
vm.runInContext(engineSrc + '\n' + treeSrc + '\nglobalThis.__Sim = TreeSearchSimulator;', sandbox);
const Sim = sandbox.__Sim;

const N = 60;
let 동점본판 = 0, 목표두고본판 = 0, 헛걸음모자란판 = 0, 판 = 0;

for (const [depth, maxChild] of [[4, 3], [5, 3], [3, 2], [6, 4]]) {
    el('tree-max-depth').value = String(depth);
    el('tree-max-children').value = String(maxChild);
    const sim = new Sim();

    for (let i = 0; i < N; i++) {
        sim.generateTree();
        판++;
        const where = `깊이${depth}/자식${maxChild} #${i}`;
        const t = readTree(sim);

        // 목표 길목을 따로 세운다.
        const chain = new Map();
        for (let c = t.goal, d = 0; c !== undefined; c = t.parent.get(c), d++) chain.set(c, d);

        // 1) h(n)은 화면에 적힌 그대로 「목표까지 남은 칸 수」인가.
        for (const id of t.children.keys()) {
            const 참값 = hops(t, chain, id);
            const 쓴값 = sim.nodeDataMap.get(id).h;
            if (Number.isFinite(참값) && 쓴값 !== 참값) {
                bad(`${where}: h(${id})=${쓴값}인데 목표까지 ${참값}칸이다`);
            }
        }

        // 2) h(n)이 남은 «비용»을 넘지 않는가 — A*의 최적성이 여기 걸려 있다.
        //    목표로 내려갈 수 있는 것은 길목 위의 노드뿐이므로 그 노드들을 본다.
        let 아래비용 = 0;
        for (let c = t.goal; c !== t.start; c = t.parent.get(c)) {
            아래비용 += t.cost.get(c);
            const 위 = t.parent.get(c);
            if (sim.nodeDataMap.get(위).h > 아래비용) {
                bad(`${where}: h(${위})가 실제 남은 비용 ${아래비용}을 넘는다`);
            }
        }

        // 3) 간선 비용이 정해 둔 범위 안인가.
        for (const [id, c] of t.cost) {
            if (id === t.start) continue;
            if (!(c >= 1 && c <= Sim.MAX_EDGE_COST)) {
                bad(`${where}: 간선 비용 ${c}(노드 ${id})가 1~${Sim.MAX_EDGE_COST} 밖이다`);
            }
        }

        // 4) 네 방법을 돌려 꺼내는 규칙과 찾은 길을 본다.
        const 유일한길 = onlyPath(t).join(',');
        let 이판동점 = 0, 이판목표두고 = 0;
        for (const algo of ['astar', 'greedy', 'bfs', 'dfs']) {
            const r = runWatched(sim, algo, el, where);
            if (!r.결과) {
                bad(`${where} ${algo}: 목표에 닿지 못했다`);
                continue;
            }
            if (r.결과.path.join(',') !== 유일한길) {
                bad(`${where} ${algo}: 트리에 길은 ${유일한길} 하나뿐인데 ${r.결과.path.join(',')}를 찾았다`);
            }
            이판동점 += r.동점;
            이판목표두고 += r.목표두고다른것;

            // 5) A*는 목표가 없는 가지로 두 칸 이상 내려갔다 되돌아와야 한다.
            if (algo === 'astar') {
                const 길목 = new Set(chain.keys());
                const 깊이 = detourDepth(t, 길목, r.engine.closedSet);
                // **모양이 애초에 허락하지 않는 판도 있다** — 곁가지가 맨 아래층에만
                // 있으면 거기서 더 내려갈 데가 없다. 그 판은 빼고 센다.
                const 가능최대 = detourDepth(t, 길목, [...t.children.keys()]);
                if (가능최대 >= Sim.WANT_DETOUR && 깊이 < Sim.WANT_DETOUR) 헛걸음모자란판++;
            }
        }
        if (이판동점) 동점본판++;
        if (이판목표두고) 목표두고본판++;
    }
}

/* ---- 검사가 헛돌지 않았는가 ----
   동점이 한 번도 안 일어났다면 「동점이면 먼저 발견한 것」은 아무것도 못 본 것이다.
   목표를 두고 다른 노드를 여는 판이 하나도 없으면 고친 그 장면이 화면에 안 나온다. */
if (동점본판 === 0) bad('f(n) 동점이 한 판도 없었다 — 동점 규칙을 검사가 보지 못했다');
if (목표두고본판 === 0) bad('목표를 Open Set에 두고 다른 노드를 여는 판이 하나도 없다');
if (헛걸음모자란판 > 판 * 0.02) {
    bad(`헛걸음할 수 있는 모양인데 A*가 헛걸음하지 않은 판이 ${헛걸음모자란판}/${판}판이다 — ` +
        '「곁가지를 파고들었다 되돌아오는」 장면을 못 보여 준다');
}

console.log(`  트리 ${판}판 × 네 방법을 돌렸다 ` +
    `(동점을 본 판 ${동점본판} · 목표를 두고 다른 것을 연 판 ${목표두고본판} · ` +
    `헛걸음이 모자란 판 ${헛걸음모자란판})`);

if (fail) {
    console.log(`\n✗ 정보 이용 탐색(트리): ${fail}건`);
    throw new Error('heuristic-tree: 검사를 더 진행할 수 없다');
}
console.log('✓ 정보 이용 탐색(트리)');

test('heuristic-tree', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
