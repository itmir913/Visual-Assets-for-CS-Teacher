// 얼려 넣은 프리셋과 렌더러 기하를 **다시 검사한다.**
//
// 만들어 낸 도구가 아니라 **저장소에 들어간 파일**을 읽는다. 옮겨 적는 사이에 값이
// 어긋나는 일이 실제로 있으므로, 통과 여부는 최종본으로 판정해야 한다.
//
// 렌더러는 DOM 없이 돌린다. `Object.create(prototype)`으로 생성자를 건너뛰고 기하 계산에
// 필요한 것만 채우면, **화면에 그리지 않고도 그리는 코드 그 자체를 잴 수 있다.**

import {GRAPH_PRESETS} from '../src/entries/_lib/graph-presets.js';
import {buildGraph, cheapestCost, costOf, hOf, isReachable, neighborsOf} from '../src/entries/_lib/graph-model.js';
import {GRAPH_VIEW_DEFAULTS, GraphView} from '../src/entries/_lib/graph-view.js';
import {TextMeasurer} from '../src/entries/_lib/text-measure.js';

let fail = 0;
const bad = (msg) => {
    fail++;
    if (fail <= 25) console.log('  ✗ ' + msg);
};

const COMBOS = [];
for (const directed of [false, true]) {
    for (const weighted of [false, true]) {
        for (const cyclic of [false, true]) COMBOS.push({directed, weighted, cyclic});
    }
}
const tag = (c) => `${c.directed ? '방향' : '무방향'}/${c.weighted ? '비용' : '균일'}/${c.cyclic ? '사이클' : '무사이클'}`;

/* ---------- 탐색 결과를 따로 구한다. 시뮬레이터 코드를 베끼지 않는다 ---------- */
function greedyCost(g) {
    const open = [g.start], closed = new Set(), from = new Map();
    let guard = 0;
    while (open.length && guard++ < 5000) {
        open.sort((p, q) => hOf(g, p) - hOf(g, q) || (p < q ? -1 : 1));
        const cur = open.shift();
        if (cur === g.goal) {
            let c = 0, n = cur;
            while (from.has(n)) {
                c += costOf(g, from.get(n), n);
                n = from.get(n);
            }
            return c;
        }
        if (closed.has(cur)) continue;
        closed.add(cur);
        for (const nb of neighborsOf(g, cur)) {
            if (closed.has(nb) || open.includes(nb)) continue;
            from.set(nb, cur);
            open.push(nb);
        }
    }
    return Infinity;
}

function hasCycle(g) {
    if (g.directed) {
        const state = new Map();
        const walk = (id) => {
            state.set(id, 0);
            for (const nb of neighborsOf(g, id)) {
                if (state.get(nb) === 0) return true;
                if (state.get(nb) === undefined && walk(nb)) return true;
            }
            state.set(id, 1);
            return false;
        };
        return g.nodes.some(n => state.get(n.id) === undefined && walk(n.id));
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
    return g.nodes.some(n => !seen.has(n.id) && walk(n.id, null));
}

/* ---------- 렌더러를 DOM 없이 세운다 ---------- */
// 시뮬레이터가 실제로 넘길 것과 같은 설정. 라벨은 **탐색이 한창일 때의 세 줄**로 둔다 —
// 상자가 가장 커지는 순간이 겹치는지가 문제이기 때문이다.
const VIEW_OPTS = {
    fontSize: 14,
    edgeLabelSize: 13,
    label: (n) => [
        {text: n.id, bold: true},
        {text: 'g 18 · h 14', bold: false},
        {text: 'f 32', bold: false},
    ],
};

function makeView(graph) {
    const gv = Object.create(GraphView.prototype);
    gv.opt = {...GRAPH_VIEW_DEFAULTS, ...VIEW_OPTS};
    gv.nodes = graph.nodes;
    gv.edges = graph.edges;
    gv.nodeById = graph.byId;
    gv._sizes = new Map();
    gv.measurer = new TextMeasurer(null);   // DOM이 없으면 글자 종류로 어림한다
    gv._layoutEdges();
    return gv;
}

/* ---------- 검사 ---------- */
console.log(`프리셋 ${GRAPH_PRESETS.length}장 × 조합 ${COMBOS.length}가지를 본다\n`);

const seenIds = new Set();
for (const preset of GRAPH_PRESETS) {
    if (seenIds.has(preset.id)) bad(`${preset.id}: id가 겹친다`);
    seenIds.add(preset.id);
    if (!preset.nodes.some(n => n.id === preset.start)) bad(`${preset.id}: 시작점이 없다`);
    if (!preset.nodes.some(n => n.id === preset.goal)) bad(`${preset.id}: 목표가 없다`);
    if (preset.start === preset.goal) bad(`${preset.id}: 시작과 목표가 같다`);

    let greedyLoss = 0, hopLoss = 0;

    for (const c of COMBOS) {
        const g = buildGraph(preset, c);
        const where = `${preset.id} ${tag(c)}`;

        // 1) 갈 수 있는가
        if (!isReachable(g)) bad(`${where}: 목표까지 갈 수 없다`);

        // 2) h(n)이 남은 실제 최소 비용을 넘지 않는가 — A*의 최적성이 여기 걸려 있다
        for (const n of g.nodes) {
            const rest = cheapestCost(g, n.id, g.goal);
            if (Number.isFinite(rest) && hOf(g, n.id) > rest) {
                bad(`${where}: h(${n.id})=${hOf(g, n.id)} > 실제 남은 비용 ${rest}`);
            }
        }
        if (hOf(g, g.goal) !== 0) bad(`${where}: 목표의 h가 0이 아니다`);

        // 3) 사이클을 껐으면 정말로 없는가
        if (!c.cyclic && hasCycle(g)) bad(`${where}: 사이클 없음인데 사이클이 있다`);
        if (!c.cyclic && g.edges.length !== g.nodes.length - 1) {
            bad(`${where}: 사이클 없음인데 간선이 ${g.edges.length}개다(노드 ${g.nodes.length})`);
        }

        // 4) 비용이 균일하면 전부 1인가
        if (!c.weighted && g.edges.some(e => e.cost !== 1)) bad(`${where}: 균일인데 비용이 1이 아니다`);

        // 5) 방향을 껐으면 화살표가 없는가
        if (!c.directed && g.edges.some(e => e.directed !== false)) bad(`${where}: 무방향인데 방향이 붙었다`);

        // 6) 그리는 기하 — 간선 끝이 상자 밖에서 멈추는가, 비용 글자가 상자에 묻히지 않는가
        const gv = makeView(g);
        for (const e of g.edges) {
            const gm = gv._geom(e);
            if (!gm) {
                bad(`${where}: 간선 ${e.id}의 기하를 못 구했다`);
                continue;
            }
            for (const [pt, id] of [[gm.p0, e.a], [gm.p1, e.b]]) {
                const node = g.byId.get(id);
                const size = gv._size(node);
                // 테두리에서 gap 만큼 나가 있어야 한다. 안쪽이면 화살촉이 상자에 파묻힌다.
                const dx = Math.abs(pt.x - node.x) - size.w / 2;
                const dy = Math.abs(pt.y - node.y) - size.h / 2;
                if (Math.max(dx, dy) < gv.opt.gapFromNode - 0.5) {
                    bad(`${where}: 간선 ${e.id}의 끝이 ${id} 상자 안에 있다`);
                }
            }
            // 비용 글자가 어느 노드 상자와도 겹치지 않아야 한다.
            // **숫자판 크기는 실제로 그릴 크기로 잰다** — 「가운데니까 괜찮겠지」가 아니라
            // 판의 네 귀퉁이가 상자 밖에 있는지를 본다.
            const text = String(e.cost);
            const half = {
                w: (gv.measurer.width(text, gv.opt.edgeLabelSize, true) + 8) / 2,
                h: (gv.opt.edgeLabelSize + 5) / 2,
            };
            const lp = gv._labelPoint(gm, e, half.w, half.h);
            for (const n of g.nodes) {
                const s = gv._size(n);
                if (Math.abs(lp.x - n.x) < s.w / 2 + half.w && Math.abs(lp.y - n.y) < s.h / 2 + half.h) {
                    bad(`${where}: 간선 ${e.id}의 비용 ${text}이 ${n.id} 상자에 겹친다`);
                    break;
                }
            }
            if (!Number.isFinite(gm.p0.x + gm.p0.y + gm.p1.x + gm.p1.y)) {
                bad(`${where}: 간선 ${e.id} 좌표가 숫자가 아니다`);
            }
            if (e.directed && !gv._arrowPath(gm)) bad(`${where}: 간선 ${e.id}에 화살촉이 없다`);
            if (e.directed === 'both' && !gv._arrowPath(gm, true)) {
                bad(`${where}: 양방향 간선 ${e.id}에 반대쪽 화살촉이 없다`);
            }
        }

        // 7) 상자끼리 겹치지 않는가 — 값이 세 줄로 늘어난 최대 크기로 본다
        for (let i = 0; i < g.nodes.length; i++) {
            for (let j = i + 1; j < g.nodes.length; j++) {
                const p = g.nodes[i], q = g.nodes[j];
                const sp = gv._size(p), sq = gv._size(q);
                const overlapX = Math.abs(p.x - q.x) < (sp.w + sq.w) / 2 + 6;
                const overlapY = Math.abs(p.y - q.y) < (sp.h + sq.h) / 2 + 6;
                if (overlapX && overlapY) bad(`${where}: ${p.id}와 ${q.id} 상자가 겹친다`);
            }
        }

        if (c.weighted && c.cyclic) {
            const best = cheapestCost(g);
            if (greedyCost(g) > best) greedyLoss++;
            // 칸 수만 세는 방법(BFS)이 찾는 길의 비용
            const from = new Map(), seen = new Set([g.start]), q = [g.start];
            let hopCost = Infinity;
            while (q.length) {
                const cur = q.shift();
                if (cur === g.goal) {
                    hopCost = 0;
                    let n = cur;
                    while (from.has(n)) {
                        hopCost += costOf(g, from.get(n), n);
                        n = from.get(n);
                    }
                    break;
                }
                for (const nb of neighborsOf(g, cur)) {
                    if (seen.has(nb)) continue;
                    seen.add(nb);
                    from.set(nb, cur);
                    q.push(nb);
                }
            }
            if (hopCost > best) hopLoss++;
        }
    }

    // 8) 수업에서 볼 것이 있는가
    if (greedyLoss < 2) bad(`${preset.id}: 최상 우선이 손해 보는 조합이 ${greedyLoss}/2뿐이다`);
    if (hopLoss < 2) bad(`${preset.id}: 칸 수만 세면 손해 보는 조합이 ${hopLoss}/2뿐이다`);
}

console.log(fail === 0 ? '\n전부 통과' : `\n어긋난 것 ${fail}건`);
process.exit(fail === 0 ? 0 : 1);
