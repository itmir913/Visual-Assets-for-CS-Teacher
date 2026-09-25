// 탐색 시뮬레이터 두 페이지에서 **다른 검사가 보지 않던 탭 셋을 페이지 원문 그대로 돌려 본다.**
//
//   - 맹목적 탐색(search-bfs-dfs.html)의 **트리 탭** — BFS · DFS가 노드를 꺼내는 차례
//   - 맹목적 탐색의 **2D 격자 탭** — BFS의 최단 보장, DFS의 「꺼낼 때 방문 처리」와 그 차례,
//     탐색 트리에서 칠하는 길이 실제로 지나온 노드인가
//   - 정보 이용 탐색(search-heuristic.html)의 **격자 탭** — A*와 최상 우선 탐색
//
// 그래프 탭은 `sim-graph-sim.test.mjs`, 정보 이용 탐색의 트리 탭은 `sim-heuristic-tree.test.mjs`가 본다.
//
// **판정은 페이지 코드를 다시 쓰지 않고 다른 방법으로 구한다.**
//   - 트리의 DFS 차례는 **재귀 전위 순회**로, BFS 차례는 **깊이별로 모은 전위 순회**로 구한다
//     (페이지는 스택 · 큐로 돈다).
//   - 격자의 DFS 차례는 **재귀 DFS**로 구한다(페이지는 스택에 넣고 꺼낼 때 방문 처리한다 —
//     그 둘은 같은 차례를 내야 한다).
//   - 격자의 최단 거리는 여기서 따로 짠 BFS가, 맨해튼 거리는 여기서 따로 센다.

import {test, expect} from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

import {josa} from '../src/entries/_lib/josa.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIM = path.join(ROOT, 'simulator', 'ai');

let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + m);
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
    const fake = (id) => ({
        id, value: '', checked: false, innerHTML: '', max: '1000', min: '50',
        classList: {add() {}, remove() {}, toggle() {}, replace() {}, contains() { return false; }},
        addEventListener() {},
        set onclick(_) {},
    });
    const el = (id) => {
        if (!els.has(id)) els.set(id, fake(id));
        return els.get(id);
    };
    const view = {
        root: null,
        setData(d) { this.root = d; return this; },
        on() { return this; },
        update() { return this; },
        fit() { return this; },
        clear() { return this; },
        resize() { return this; },
        setActive() { return this; },
        setViewMode() { return this; },
    };
    const sandbox = {
        document: {getElementById: el, querySelectorAll: () => []},
        window: {josa, createTreeView: () => view, innerWidth: 1280, addEventListener() {}},
        setTimeout, clearTimeout,
        setInterval: () => 0,
        clearInterval: () => {},
        console,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    return {sandbox, el, fake, view};
}

/* 씨앗을 고정해 같은 판을 다시 낼 수 있게 한다. */
function rng(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/* ================================================================
   1. 맹목적 탐색 — 트리 탭
   ================================================================ */
function checkBlindTree() {
    const html = fs.readFileSync(path.join(SIM, 'search-bfs-dfs.html'), 'utf8');
    const src = cut(html, '    class TreeSearchSimulator {', '       2. Graph Search Simulator');
    const {sandbox, el} = makeSandbox();
    vm.runInContext(src + '\nglobalThis.__Tree = TreeSearchSimulator;', sandbox);
    const Tree = sandbox.__Tree;

    /** 탐색을 끝까지 돌리며 **꺼낸 노드의 차례**를 모은다. */
    const run = (sim, algo) => {
        el('tree-algo').value = algo;
        sim.resetSearch();
        sim.initSearch();
        const popped = [];
        for (let guard = 0; guard < 5000; guard++) {
            const more = sim.step();
            if (sim.searchState.currentNode !== null && popped.at(-1) !== sim.searchState.currentNode) {
                popped.push(sim.searchState.currentNode);
            }
            if (!more) break;
        }
        return popped;
    };

    let 판 = 0;
    for (const [depth, kids] of [[2, 1], [3, 2], [4, 3], [5, 2], [6, 4]]) {
        el('tree-max-depth').value = String(depth);
        el('tree-max-children').value = String(kids);
        const sim = new Tree();
        for (let i = 0; i < 40; i++) {
            sim.generateTree();
            판++;
            const where = `트리 깊이${depth}/자식${kids} #${i}`;

            // 트리를 여기서 다시 읽는다 — 전위 순회는 재귀로, 깊이도 함께 센다.
            const pre = [], depthOf = new Map();
            let 최대깊이 = 0, 최대자식 = 0;
            const walk = (n, d) => {
                pre.push(n.id);
                depthOf.set(n.id, d);
                최대깊이 = Math.max(최대깊이, d);
                최대자식 = Math.max(최대자식, n.children.length);
                n.children.forEach(c => walk(c, d + 1));
            };
            walk(sim.root, 0);
            if (new Set(pre).size !== pre.length) bad(`${where}: 노드 번호가 겹친다`);
            if (pre.length !== sim.nodeMap.size) bad(`${where}: 트리에 ${pre.length}개, 표에 ${sim.nodeMap.size}개`);
            if (최대깊이 > depth) bad(`${where}: 깊이가 ${최대깊이}로 최대 깊이 ${depth}를 넘는다`);
            if (최대자식 > kids) bad(`${where}: 자식이 ${최대자식}개로 최대 ${kids}개를 넘는다`);
            for (const n of sim.nodeMap.values()) {
                const 인접 = sim.adjList[n.id] || [];
                if (인접.join() !== n.children.map(c => c.id).join()) bad(`${where}: ${n.id}의 인접 목록이 그린 자식과 다르다`);
            }
            if (sim.goalNode === sim.root.id) bad(`${where}: 목표가 루트다`);

            const goal = sim.goalNode;
            // DFS — 재귀 전위 순회에서 목표까지
            const 깊이우선 = pre.slice(0, pre.indexOf(goal) + 1);
            // BFS — 전위 순회를 깊이별로 모으면 같은 깊이 안에서 왼쪽부터다
            const 층 = [...pre].sort((a, b) => depthOf.get(a) - depthOf.get(b));   // sort 는 안정적이다
            const 너비우선 = 층.slice(0, 층.indexOf(goal) + 1);

            for (const [algo, 참] of [['dfs', 깊이우선], ['bfs', 너비우선]]) {
                const 꺼냄 = run(sim, algo);
                if (꺼냄.join() !== 참.join()) {
                    bad(`${where} ${algo}: 꺼낸 차례 ${꺼냄.join(',')} — 맞는 차례 ${참.join(',')}`);
                }
                if (sim.searchState.status !== 'finished') bad(`${where} ${algo}: 목표를 꺼내고도 끝나지 않았다`);
                const 말 = el('tree-status').innerHTML;
                if (!말.includes(`<b>${goal}</b>`) || !말.includes('찾았습니다')) bad(`${where} ${algo}: 찾았다는 말이 없다 — ${말}`);
                // 회색(done)으로 칠한 노드 수 = 목표 전에 확장한 노드 수
                const 회색 = [...sim.nodeMap.values()].filter(n => n.state === 'done').length;
                if (회색 !== 참.length - 1) bad(`${where} ${algo}: 회색이 ${회색}개, 확장한 노드는 ${참.length - 1}개`);
            }

            // 도는 중에는 목표를 못 바꾼다
            el('tree-algo').value = 'bfs';
            sim.resetSearch();
            sim.initSearch();
            sim.step();
            if (sim.searchState.status === 'running') {
                const 다른것 = pre.find(id => id !== goal && id !== sim.root.id);
                if (다른것 !== undefined) {
                    sim.setGoalNode(다른것);
                    if (sim.goalNode !== goal) bad(`${where}: 탐색 도중에 목표가 바뀌었다`);
                }
            }
            sim.resetSearch();
        }
    }

    // 입력 경계 — 범위 밖의 값을 넣어도 죽지 않고 범위 안으로 들어온다
    const sim = new Tree();
    for (const [d, c] of [['99', '99'], ['-3', '-3'], ['abc', ''], ['1', '0']]) {
        el('tree-max-depth').value = d;
        el('tree-max-children').value = c;
        sim.generateTree();
        const dv = Number(el('tree-max-depth').value), cv = Number(el('tree-max-children').value);
        if (!(dv >= 2 && dv <= 6)) bad(`입력 ${d}: 최대 깊이가 ${dv}로 2~6 밖이다`);
        if (!(cv >= 1 && cv <= 4)) bad(`입력 ${c}: 최대 자식이 ${cv}로 1~4 밖이다`);
        if (!sim.root || sim.nodeMap.size < 2) bad(`입력 ${d}/${c}: 트리가 만들어지지 않았다`);
    }
    return 판;
}

/* ================================================================
   격자 공통 — 여기서 따로 짠 BFS
   ================================================================ */
const DIRS4 = [[-1, 0], [0, 1], [1, 0], [0, -1]];   // 위 · 오른쪽 · 아래 · 왼쪽 (r, c)

function gridDist(n, wall, s) {
    const d = Array.from({length: n}, () => Array(n).fill(Infinity));
    d[s.r][s.c] = 0;
    const q = [s];
    for (let i = 0; i < q.length; i++) {
        const {r, c} = q[i];
        for (const [dr, dc] of DIRS4) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= n || nc >= n || wall(nr, nc) || d[nr][nc] !== Infinity) continue;
            d[nr][nc] = d[r][c] + 1;
            q.push({r: nr, c: nc});
        }
    }
    return d;
}

function randomBoard(rand, n) {
    const density = rand() * 0.45;
    const walls = Array.from({length: n}, () => Array.from({length: n}, () => rand() < density));
    const pick = () => ({r: Math.floor(rand() * n), c: Math.floor(rand() * n)});
    const s = pick();
    let e = pick();
    while (e.r === s.r && e.c === s.c) e = pick();
    walls[s.r][s.c] = false;
    walls[e.r][e.c] = false;
    return {walls, s, e};
}

const adjacent = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;

/* ================================================================
   2. 맹목적 탐색 — 2D 격자 탭
   ================================================================ */
function checkBlindGrid() {
    const html = fs.readFileSync(path.join(SIM, 'search-bfs-dfs.html'), 'utf8');
    const src = cut(html, '    class GridSearchSimulator {', '       4. Main UI Controller');
    const {sandbox, el, fake, view} = makeSandbox();
    vm.runInContext(src + '\nglobalThis.__Grid = GridSearchSimulator;', sandbox);
    const Grid = sandbox.__Grid;

    const rand = rng(20260926);
    let 판 = 0, 막힌판 = 0, 깊이우선이긴판 = 0;
    for (const n of [6, 7, 8, 10]) {
        for (let i = 0; i < 60; i++) {
            const {walls, s, e} = randomBoard(rand, n);
            const where = `격자 ${n}×${n} #${i}`;
            판++;

            // 생성자를 건너뛰고 탐색에 쓰는 것만 채운다.
            const g = Object.create(Grid.prototype);
            g.rows = g.cols = n;
            g.state = walls.map(row => row.map(w => (w ? 1 : 0)));
            g.startNode = {...s};
            g.endNode = {...e};

            const dist = gridDist(n, (r, c) => walls[r][c], s);
            const 참거리 = dist[e.r][e.c];
            if (!Number.isFinite(참거리)) 막힌판++;

            for (const algo of ['bfs', 'dfs']) {
                const it = g.createGenerator(algo);
                const visits = [], paths = [], parentOf = new Map(), cellOf = new Map();
                let r, guard = 0;
                while (!(r = it.next()).done && guard++ < 20000) {
                    const {type, node} = r.value;
                    if (type === 'add_node') {
                        parentOf.set(node.treeId, node.parentTreeId);
                        cellOf.set(node.treeId, `${node.r},${node.c}`);
                    } else if (type === 'visit') visits.push(node);
                    else if (type === 'path') paths.push(node);
                }
                const 찾음 = r.value;
                const w = `${where} ${algo}`;

                if (찾음 !== Number.isFinite(참거리)) {
                    bad(`${w}: 길이 ${Number.isFinite(참거리) ? '있는데' : '없는데'} 결과가 ${찾음}이다`);
                    continue;
                }
                // 같은 칸을 두 번 방문하지 않는다
                const 방문키 = visits.map(v => `${v.r},${v.c}`);
                if (new Set(방문키).size !== 방문키.length) bad(`${w}: 같은 칸을 두 번 방문했다`);
                if (visits.some(v => walls[v.r][v.c])) bad(`${w}: 벽을 방문했다`);

                if (algo === 'bfs') {
                    // 가까운 칸부터 — 방문한 칸의 거리가 줄어드는 일이 없다
                    for (let k = 1; k < visits.length; k++) {
                        if (dist[visits[k].r][visits[k].c] < dist[visits[k - 1].r][visits[k - 1].c]) {
                            bad(`${w}: ${k}번째 방문이 앞 칸보다 가깝다 — 가까운 칸부터 확장하지 않았다`);
                            break;
                        }
                    }
                } else {
                    // 재귀 DFS의 방문 차례와 같아야 한다 — 위 · 오른쪽 · 아래 · 왼쪽 순서로 파고든다
                    const seen = new Set(), 차례 = [];
                    let done = false;
                    const dfs = (rr, cc) => {
                        seen.add(`${rr},${cc}`);
                        차례.push(`${rr},${cc}`);
                        if (rr === e.r && cc === e.c) { done = true; return; }
                        for (const [dr, dc] of DIRS4) {
                            const nr = rr + dr, nc = cc + dc;
                            if (nr < 0 || nc < 0 || nr >= n || nc >= n || walls[nr][nc] || seen.has(`${nr},${nc}`)) continue;
                            dfs(nr, nc);
                            if (done) return;
                        }
                    };
                    dfs(s.r, s.c);
                    if (방문키.join(' ') !== 차례.join(' ')) {
                        bad(`${w}: 방문 차례가 재귀 DFS와 다르다\n      페이지: ${방문키.join(' ')}\n      재귀  : ${차례.join(' ')}`);
                    }
                }

                if (!찾음) continue;
                // 길 — 시작에서 목표까지 이웃한 칸으로 이어지고 벽이 없다
                const 칸 = paths.map(p => ({r: p.r, c: p.c}));
                if (!칸.length || 칸[0].r !== s.r || 칸[0].c !== s.c || 칸.at(-1).r !== e.r || 칸.at(-1).c !== e.c) {
                    bad(`${w}: 길이 시작에서 목표까지가 아니다`);
                    continue;
                }
                for (let k = 1; k < 칸.length; k++) {
                    if (!adjacent(칸[k - 1], 칸[k])) bad(`${w}: 길의 ${k}번째 칸이 앞 칸과 붙어 있지 않다(대각 이동?)`);
                    if (walls[칸[k].r][칸[k].c]) bad(`${w}: 길이 벽을 지난다`);
                }
                const 길이 = 칸.length - 1;
                if (algo === 'bfs' && 길이 !== 참거리) bad(`${w}: BFS 길이 ${길이}칸, 최단은 ${참거리}칸`);
                if (길이 < 참거리) bad(`${w}: 길이 ${길이}칸이 최단 ${참거리}칸보다 짧다 — 셈이 틀렸다`);
                if (algo === 'dfs' && 길이 > 참거리) 깊이우선이긴판++;

                // 탐색 트리에서 칠하는 노드가 **실제로 지나온 사슬**인가 — 부모를 따라 이어져야 한다
                for (let k = 0; k < paths.length; k++) {
                    const id = paths[k].treeId;
                    if (cellOf.get(id) !== `${paths[k].r},${paths[k].c}`) bad(`${w}: 길의 ${k}번째 칸에 다른 칸의 트리 노드를 칠한다`);
                    if (k > 0 && parentOf.get(id) !== paths[k - 1].treeId) {
                        bad(`${w}: 트리에 칠한 길이 끊겼다(${k}번째 노드의 부모가 앞 노드가 아니다)`);
                        break;
                    }
                }
            }

            // 화면에 적는 말 — BFS만 최단이라고 말한다
            for (const algo of ['bfs', 'dfs']) {
                el('algo-select').value = algo;
                g.grid = Array.from({length: n}, () => Array.from({length: n}, () => fake('cell')));
                g.statusText = el('status-text');
                g.btnPlay = el('btn-play');
                g.view = view;
                g.treeMap = new Map();
                g.treeRoot = null;
                g.generator = null;
                g.resetTree = () => {};
                let guard = 0;
                while (g.processStep() && guard++ < 20000) { /* 끝까지 */ }
                const 말 = el('status-text').innerHTML;
                if (!Number.isFinite(참거리)) {
                    if (!말.includes('길이 없습니다')) bad(`${where} ${algo}: 막힌 판인데 「길이 없다」고 하지 않는다 — ${말}`);
                } else if (algo === 'bfs' && !말.includes('최단 경로')) {
                    bad(`${where} bfs: 최단 경로라고 알리지 않는다 — ${말}`);
                } else if (algo === 'dfs' && !말.includes('보장은 없습니다')) {
                    bad(`${where} dfs: DFS가 찾은 길을 최단인 것처럼 적는다 — ${말}`);
                }
            }
        }
    }
    if (막힌판 === 0) bad('격자: 길이 막힌 판이 하나도 없었다 — 「길 없음」을 검사가 보지 못했다');
    if (깊이우선이긴판 === 0) bad('격자: DFS가 최단보다 긴 길을 찾은 판이 없다 — 「보장은 없다」를 보여 줄 판이 없다');
    console.log(`  맹목 격자 ${판}판 (막힌 판 ${막힌판}, DFS가 돌아간 판 ${깊이우선이긴판})`);
    return 판;
}

/* ================================================================
   3. 정보 이용 탐색 — 격자 탭(A* · 최상 우선)
   ================================================================ */
function checkHeuristicGrid() {
    const html = fs.readFileSync(path.join(SIM, 'search-heuristic.html'), 'utf8');
    const engine = cut(html, '    class HeuristicSearch {', '       2. Tree Search Simulator');
    const grid = cut(html, '    class GridSearchSimulator {', '       3. Graph Search Simulator');
    const {sandbox, el} = makeSandbox();
    vm.runInContext(engine + '\n' + grid + '\nglobalThis.__Grid = GridSearchSimulator;', sandbox);
    const Grid = sandbox.__Grid;

    const rand = rng(20260927);
    const N = 15;
    let 판 = 0, 막힌판 = 0, 최상손해 = 0, 최상더엶 = 0;
    for (let i = 0; i < 150; i++) {
        const {walls, s, e} = randomBoard(rand, N);
        const where = `정보 격자 #${i}`;
        판++;

        const g = Object.create(Grid.prototype);
        g.gridSize = N;
        // 페이지는 {x, y}, 칸 번호는 y * 15 + x 다
        g.startNode = {x: s.c, y: s.r};
        g.goalNode = {x: e.c, y: e.r};
        g.walls = new Set();
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (walls[r][c]) g.walls.add(r * N + c);

        const 시작거리 = gridDist(N, (r, c) => walls[r][c], s);
        const 목표거리 = gridDist(N, (r, c) => walls[r][c], e);
        const 참거리 = 시작거리[e.r][e.c];
        if (!Number.isFinite(참거리)) 막힌판++;
        const rc = (idx) => ({r: Math.floor(idx / N), c: idx % N});
        const 맨해튼 = (idx) => { const p = rc(idx); return Math.abs(p.r - e.r) + Math.abs(p.c - e.c); };

        const 결과 = {};
        for (const algo of ['astar', 'greedy']) {
            el('grid-algo').value = algo;
            g.initSearchEngine();
            const en = g.searchEngine;
            const w = `${where} ${algo}`;

            // h(n)은 맨해튼 거리 그대로이고, 남은 실제 거리를 넘지 않는다
            for (let idx = 0; idx < N * N; idx += 7) {
                if (en.getH(idx) !== 맨해튼(idx)) bad(`${w}: h(${idx})=${en.getH(idx)}인데 맨해튼 거리는 ${맨해튼(idx)}`);
                const p = rc(idx);
                if (en.getH(idx) > 목표거리[p.r][p.c]) bad(`${w}: h(${idx})가 실제로 남은 거리 ${목표거리[p.r][p.c]}를 넘는다`);
            }
            // 이웃은 네 방향 · 벽 아님 · 판 안
            for (const idx of [0, N - 1, N * N - 1, 7 * N + 7]) {
                for (const nb of en.getNeighbors(idx)) {
                    if (!adjacent(rc(idx), rc(nb))) bad(`${w}: ${idx}의 이웃 ${nb}가 붙어 있지 않다`);
                    if (g.walls.has(nb)) bad(`${w}: 벽 ${nb}을 이웃으로 준다`);
                }
            }

            let res = null, guard = 0;
            while (!en.isFinished && guard++ < 20000) {
                const 후보 = en.state === 'SELECT' ? null : [...en.openSet];
                const r = en.step();
                if (r.type === 'success' || r.type === 'fail') res = r;
                if (!후보 || (r.type !== 'select' && r.type !== 'success')) continue;
                // 꺼낸 노드의 값이 열린 목록에서 가장 작은가 — 값은 여기서 따로 센 맨해튼으로 낸다
                const 값 = (id) => (algo === 'astar' ? en.gScore.get(id) + 맨해튼(id) : 맨해튼(id));
                const 최소 = Math.min(...후보.map(값));
                if (값(r.node) !== 최소) bad(`${w}: ${algo === 'astar' ? 'f' : 'h'}=${값(r.node)}인 노드를 꺼냈는데 열린 목록의 최소는 ${최소}`);
                // A* — h가 일관적이라 꺼내는 순간의 g가 곧 시작점에서의 최단 거리다
                if (algo === 'astar') {
                    const p = rc(r.node);
                    if (en.gScore.get(r.node) !== 시작거리[p.r][p.c]) {
                        bad(`${w}: 노드 ${r.node}를 g=${en.gScore.get(r.node)}로 닫았는데 최단 거리는 ${시작거리[p.r][p.c]}`);
                    }
                }
            }
            if (!res) { bad(`${w}: 끝나지 않았다`); continue; }
            if (!Number.isFinite(참거리)) {
                if (res.type !== 'fail') bad(`${w}: 막힌 판인데 길을 찾았다고 한다`);
                continue;
            }
            if (res.type !== 'success') { bad(`${w}: 길이 있는데 못 찾았다`); continue; }
            const 칸 = res.path.map(rc);
            if (칸[0].r !== s.r || 칸[0].c !== s.c || 칸.at(-1).r !== e.r || 칸.at(-1).c !== e.c) bad(`${w}: 길의 양 끝이 시작 · 목표가 아니다`);
            for (let k = 1; k < 칸.length; k++) {
                if (!adjacent(칸[k - 1], 칸[k]) || walls[칸[k].r][칸[k].c]) { bad(`${w}: 길이 끊겼거나 벽을 지난다`); break; }
            }
            const 길이 = 칸.length - 1;
            if (res.cost !== 길이) bad(`${w}: 비용 ${res.cost}라고 적었는데 길은 ${길이}칸이다`);
            if (algo === 'astar' && 길이 !== 참거리) bad(`${w}: A*가 ${길이}칸, 최단은 ${참거리}칸`);
            if (길이 < 참거리) bad(`${w}: ${길이}칸이 최단 ${참거리}칸보다 짧다 — 셈이 틀렸다`);
            결과[algo] = {길이, 연: en.closedSet.size};
            if (!res.msg.includes(`${길이}칸`)) bad(`${w}: 알림의 칸 수가 길과 다르다 — ${res.msg}`);
        }
        if (결과.greedy && 결과.astar) {
            if (결과.greedy.길이 > 결과.astar.길이) 최상손해++;
            if (결과.greedy.연 > 결과.astar.연) 최상더엶++;
        }
    }
    if (막힌판 === 0) bad('정보 격자: 막힌 판이 없었다 — 「경로 없음」을 검사가 보지 못했다');
    if (최상손해 === 0) bad('정보 격자: 최상 우선이 A*보다 긴 길을 찾은 판이 없다 — 화면에서 볼 것이 사라졌다');
    console.log(`  정보 격자 ${판}판 (막힌 판 ${막힌판}, 최상 우선이 더 긴 길 ${최상손해}판, 더 많이 확장 ${최상더엶}판)`);
    return 판;
}

/* ================================================================ */
const a = checkBlindTree();
const b = checkBlindGrid();
const c = checkHeuristicGrid();
console.log(`  맹목 트리 ${a}판 · 맹목 격자 ${b}판 · 정보 격자 ${c}판`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
test('search-tabs', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
