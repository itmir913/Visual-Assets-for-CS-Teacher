// 8-퍼즐 시뮬레이터의 **평가 함수를 페이지 원문 그대로 돌려 본다.**
//
// 이 페이지는 「어림값이 실제로 남은 수를 넘지 않을 때에만 최단 경로가 보장된다」고
// 글로 적어 두고, 이제 그 값을 화면에 보여 준다. **적어 둔 말이 참인지 값으로 본다.**
//
// 정답은 페이지의 A*가 아니라 **너비 우선 탐색으로 따로 구한다.** 같은 코드로 두 번
// 세면 틀린 것도 맞다고 나온다 — A*가 최적을 놓치고 있어도 드러나지 않는다.
import {test, expect} from 'vitest';

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'simulator', 'ai', 'search-8-puzzle.html');
const html = fs.readFileSync(FILE, 'utf8');

/* ---------- 페이지에서 계산에 쓰는 것만 떼어 낸다 ---------- */
function cut(fromMark, toMark) {
    const a = html.indexOf(fromMark), b = html.indexOf(toMark);
    if (a < 0 || b < 0 || b < a) {
        throw new Error(`토막을 못 찾았다: ${fromMark}\n페이지를 고쳤다면 이 검사의 표시도 함께 고쳐야 한다.`);
    }
    return html.slice(a, b);
}

const src = [
    cut('    // A* 알고리즘용 휴리스틱 함수 (맨해튼 거리)', '    async function solvePuzzleAI()'),
    cut('    function swapTiles(idx1, idx2) {', '    // A* 알고리즘용 휴리스틱 함수 (맨해튼 거리)'),
    cut('    /** 타일 하나가 제자리까지 떨어진 칸 수.', '    // 직전 배치의 맨해튼 거리.'),
].join('\n');

// 섞기가 부르는 화면 쪽은 아무것도 안 하게 둔다. 판(`currentState`)만 실제로 바뀐다.
const sandbox = {console, Math};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(
    'const GOAL_STATE = [1,2,3,4,5,6,7,8,0];\n' +
    'let currentState = [...GOAL_STATE], moveCount = 0, isAnimating = false, prevManhattan = null;\n' +
    'function hidePathUI() {} function updateBoardUI() {} function showToast() {}\n' + src +
    '\nglobalThis.__api = {findOptimalPath, getManhattanDistance, getMisplacedCount, tileDistance, getValidMoves, shufflePuzzle,' +
    ' board: () => [...currentState], setBoard: (s) => { currentState = [...s]; }};',
    sandbox);
const {findOptimalPath, getManhattanDistance, getMisplacedCount, tileDistance, getValidMoves, shufflePuzzle, board, setBoard} = sandbox.__api;

/* ---------- 정답은 너비 우선 탐색으로 따로 구한다 ---------- */
const GOAL = '123456780';

/** 빈칸과 자리를 바꿀 수 있는 칸 — **페이지의 `getValidMoves`를 쓰지 않고** 좌표로 따로 구한다. */
function neighborsOf(empty) {
    const out = [];
    for (let i = 0; i < 9; i++) {
        const d = Math.abs(Math.floor(i / 3) - Math.floor(empty / 3)) + Math.abs(i % 3 - empty % 3);
        if (d === 1) out.push(i);
    }
    return out;
}

/** 역순쌍(빈칸 빼고 앞 숫자가 뒤 숫자보다 큰 쌍)의 수. 3×3 판은 이것이 짝수일 때만 풀 수 있다. */
function inversions(state) {
    const t = state.filter(v => v !== 0);
    let n = 0;
    for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) if (t[i] > t[j]) n++;
    return n;
}

function trueRemaining(state) {
    const start = state.join('');
    if (start === GOAL) return 0;
    const seen = new Set([start]);
    let frontier = [state];
    let depth = 0;
    while (frontier.length && depth < 40) {
        depth++;
        const next = [];
        for (const cur of frontier) {
            const empty = cur.indexOf(0);
            for (const idx of neighborsOf(empty)) {
                const after = [...cur];
                [after[empty], after[idx]] = [after[idx], after[empty]];
                const key = after.join('');
                if (seen.has(key)) continue;
                if (key === GOAL) return depth;
                seen.add(key);
                next.push(after);
            }
        }
        frontier = next;
    }
    return Infinity;
}

/* ---------- 검사 ---------- */
let fail = 0;
const bad = (m) => {
    fail++;
    if (fail <= 20) console.log('  ✗ ' + m);
};

// 씨앗을 고정해 같은 배치를 다시 낼 수 있게 한다.
function rng(seed) {
    let s = seed >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** 목표에서 무작위로 몇 수 물러난 배치. 이렇게 만들면 늘 풀 수 있다. */
function shuffled(rand, steps) {
    const state = [1, 2, 3, 4, 5, 6, 7, 8, 0];
    let prev = -1;
    for (let i = 0; i < steps; i++) {
        const empty = state.indexOf(0);
        let moves = neighborsOf(empty).filter(m => m !== prev);
        if (!moves.length) moves = neighborsOf(empty);
        const pick = moves[Math.floor(rand() * moves.length)];
        [state[empty], state[pick]] = [state[pick], state[empty]];
        prev = empty;
    }
    return state;
}

const rand = rng(20260821);
let 판수 = 0, 어림이줄어도나쁜수 = 0;

for (let i = 0; i < 120; i++) {
    const state = shuffled(rand, 4 + (i % 12));
    판수++;
    const 실제 = trueRemaining(state);
    const 맨해튼 = getManhattanDistance(state);
    const 제자리아님 = getMisplacedCount(state);

    // 1) A*가 정말로 가장 적은 수의 길을 찾는가 — 정답은 너비 우선이 따로 구했다
    const path = findOptimalPath(state);
    if (!path) {
        bad(`${state.join('')}: A*가 길을 못 찾았다`);
        continue;
    }
    if (path.length !== 실제) bad(`${state.join('')}: A*가 ${path.length}수, 최소는 ${실제}수`);

    // 2) 두 어림값이 실제를 넘지 않는가 — 화면에 그렇게 적어 두었다
    if (맨해튼 > 실제) bad(`${state.join('')}: 맨해튼 ${맨해튼} > 실제 ${실제}`);
    if (제자리아님 > 실제) bad(`${state.join('')}: 제자리 아닌 타일 ${제자리아님} > 실제 ${실제}`);

    // 3) 타일마다의 거리를 다 더하면 맨해튼 거리 합이 되는가 — 판 위 뱃지의 근거다
    let 합 = 0;
    for (let k = 0; k < 9; k++) 합 += tileDistance(state, k);
    if (합 !== 맨해튼) bad(`${state.join('')}: 뱃지 합 ${합} != 맨해튼 ${맨해튼}`);

    // 3-1) 두 어림값을 **정의대로 여기서 따로 센다** — 타일 v 의 제자리는 v-1 번 칸, 빈칸은 세지 않는다
    let 참맨해튼 = 0, 참제자리아님 = 0;
    state.forEach((v, i) => {
        if (v === 0) return;
        참맨해튼 += Math.abs(Math.floor(i / 3) - Math.floor((v - 1) / 3)) + Math.abs(i % 3 - (v - 1) % 3);
        if (i !== v - 1) 참제자리아님++;
    });
    if (맨해튼 !== 참맨해튼) bad(`${state.join('')}: 맨해튼 ${맨해튼}, 따로 세면 ${참맨해튼}`);
    if (제자리아님 !== 참제자리아님) bad(`${state.join('')}: 제자리 아닌 타일 ${제자리아님}, 따로 세면 ${참제자리아님}`);

    // 4) 한 수는 맨해튼 거리를 정확히 1 늘리거나 1 줄이는가 — 뱃지가 ±1만 적는 근거다
    const empty = state.indexOf(0);
    const 옮길칸 = getValidMoves(empty);
    if ([...옮길칸].sort().join() !== neighborsOf(empty).join()) {
        bad(`빈칸 ${empty}: 옮길 수 있는 칸이 ${옮길칸.join(',')}인데 붙은 칸은 ${neighborsOf(empty).join(',')}`);
    }
    for (const idx of neighborsOf(empty)) {
        const after = [...state];
        [after[empty], after[idx]] = [after[idx], after[empty]];
        const diff = getManhattanDistance(after) - 맨해튼;
        if (diff !== 1 && diff !== -1) bad(`${state.join('')}: 한 수에 맨해튼이 ${diff} 변했다`);

        // 5) 「어림값은 줄지만 실제로는 멀어지는 수」가 정말 있는가.
        //    화면이 그런 수를 짚어 주므로, 그런 일이 아예 없다면 그 문구가 거짓이 된다.
        const 뒤 = trueRemaining(after);
        if (diff < 0 && 뒤 > 실제) 어림이줄어도나쁜수++;
        // 「실제로도 1 줄어듦 / 실제로는 1 늘어남」— 한 수에 실제로 남은 수도 꼭 1만 변해야 그 말이 맞다
        if (Math.abs(뒤 - 실제) !== 1) bad(`${state.join('')}: 한 수에 실제로 남은 수가 ${뒤 - 실제} 변했다`);
    }
}

if (어림이줄어도나쁜수 === 0) {
    bad('「어림값은 줄지만 실제로는 멀어지는 수」가 한 번도 안 나왔다 — 화면 문구를 뒷받침할 수 없다');
}

/* 6) **섞기가 내놓는 판은 늘 풀 수 있는가.** 3×3 판은 역순쌍이 짝수일 때만 풀린다.
      페이지는 목표에서 한 칸씩 옮겨 섞으므로 그래야 하지만, 섞기를 「무작위로 늘어놓기」로
      바꾸는 순간 절반은 풀 수 없는 판이 된다 — 그때 「AI가 풀기」는 18만 판을 뒤진 끝에 실패한다. */
setBoard([1, 2, 3, 4, 5, 6, 7, 8, 0]);
for (let k = 0; k < 300; k++) {
    shufflePuzzle();
    const s = board();
    if ([...s].sort().join() !== '0,1,2,3,4,5,6,7,8') { bad(`섞은 판 ${s.join('')}이 0~8을 한 번씩 담고 있지 않다`); break; }
    if (inversions(s) % 2 !== 0) { bad(`섞은 판 ${s.join('')}의 역순쌍이 홀수다 — 풀 수 없는 판`); break; }
    if (k % 30 === 0) {
        const p = findOptimalPath(s);
        if (!p || p.length !== trueRemaining(s)) bad(`섞은 판 ${s.join('')}: A*가 최단을 못 찾았다`);
    }
}
// 풀 수 없는 판(1과 2를 맞바꾼 판, 역순쌍 1개)에는 길이 없다고 답해야 한다
if (findOptimalPath([2, 1, 3, 4, 5, 6, 7, 8, 0]) !== null) bad('풀 수 없는 판인데 A*가 길을 내놓았다');

console.log(`배치 ${판수}개를 보았다. 어림값이 줄어도 실제로는 멀어지는 수: ${어림이줄어도나쁜수}번`);
console.log(fail === 0 ? '전부 통과' : `어긋난 것 ${fail}건`);
test('puzzle', () => { expect(fail, '위 ✗ 줄을 볼 것').toBe(0); });
