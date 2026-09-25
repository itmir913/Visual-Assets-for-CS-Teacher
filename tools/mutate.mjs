// 돌연변이 검사 — **검사가 실제로 우는가.**
//
//     npm run mutate                 전부
//     npm run mutate -- sort html    대상 테스트 이름이 든 것만
//
// 초록인데 오류를 못 잡는 검사는 없는 것보다 나쁘다 — 「통과했다」는 말에 뜻이 없는데 사람은 믿는다.
// 그래서 검사가 지키는 대상(강의노트 · 시뮬레이터 · 산출물 · 검사 규칙 자체)에 **돌연변이를 하나씩 심고**
// 그 검사만 돌려 **빨간불이 켜지는지** 본다. 켜지지 않으면(«살아남은» 돌연변이) 그 검사는 헛돈다.
//
// 돌연변이마다 파일을 바이트 그대로 되돌린다. 도중에 죽어도 되돌리도록 `finally` 에 둔다.
// **`ci` 에 넣지 않는다.** 시뮬레이터 검사를 돌연변이마다 다시 돌려 오래 걸린다 — 검사를 새로 쓰거나
// 크게 고쳤을 때 돌린다. 새 검사를 만들면 여기에 돌연변이를 하나 이상 더한다.
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT} from './lib/repo.mjs';

const NOTE = '데이터과학/1-1-1.데이터-과학과-의사-결정.html';
const afterH1 = (html) => ['</h1>', `</h1>${html}`];

// [대상 테스트, 파일, 찾을 글, 바꿀 글, 무엇을 망가뜨렸나]
const MUTANTS = [
    // ── 정적 검사 — 지키는 대상(글)에 위반을 심는다 ─────────────────────────
    ['html', NOTE, ...afterH1('<p class="text-sm">작은 글</p>'), '강의노트에 text-sm'],
    ['html', NOTE, ...afterH1('<div><span></div>'), '태그 중첩 깨짐'],
    ['html', NOTE, ...afterH1('<table><tr><td>x</td></tr></table>'), '래퍼 없는 표'],
    ['html', NOTE, ...afterH1('<p>다음 차시에서 다룹니다</p>'), '뒤 차시 예고'],
    ['html', NOTE, ...afterH1('<p id="quiz"></p>'), '중복 id'],
    ['terms', 'src/entries/_lib/sort/sort-registry.js', '\n', "\nconst __m = '마디';\n", '시뮬레이터 JS 에 「마디」'],
    ['verbs', 'simulator/cs/sort.html', '</body>', "<button>지우기</button></body>", '버튼 이름 「지우기」'],  // verbs: 예시
    ['prose', NOTE, ...afterH1('<p>짚어 보면 알 수 있습니다.</p>'), '물러난 말 「짚다」'],
    ['prose', NOTE, ...afterH1('<p>앞 시간에 배운 대로</p>'), '앞 차시 참조'],
    ['classes', NOTE, ...afterH1('<div class="bg-${x}-50"></div>'), '조립한 클래스'],
    ['code', '데이터과학/code/2-3-2.영을-결측치로.py', '\n', '\ndef (:\n', '.py 구문 오류'],
    ['code', NOTE, ...afterH1('<pre><code>print(1)</code></pre>'), 'HTML 에 코드를 직접'],
    ['index-links', 'index.html', 'href="데이터과학/1-1-1.데이터-과학과-의사-결정.html"', 'href="데이터과학/없는-파일.html"', '첫 화면의 끊긴 링크'],
    ['privacy', 'src/entries/_lib/josa.js', '\n', '\nlocalStorage.setItem("a", "b");\n', '브라우저 저장소 사용'],
    ['sim-index', 'simulator/index.html', '</body>', '<!-- 손으로 고침 --></body>', '구운 입구를 손으로 고침'],
    ['dist', 'dist/index.html', '</body>', '<script type="module" src="x.js"></script></body>', '산출물에 모듈 스크립트'],

    // ── 검사 규칙 자체 — 규칙 하나를 끄면 틀린 조각 기록이 달라져야 한다 ──────
    ['fixtures', 'tools/checks/html.mjs', 'for (const m of src.matchAll(FORWARD_LESSON))', 'for (const m of [])', 'html: 뒤 차시 규칙 끔'],
    ['fixtures', 'tools/checks/html.mjs', "report('중복 id', idRules(src));", '', 'html: 중복 id 규칙 끔'],
    ['fixtures', 'tools/checks/html.mjs', "report('세로로 쌓은 칸', stackRules(src));", '', 'html: 세로 칸 규칙 끔'],
    ['fixtures', 'tools/checks/html.mjs', "report('머리말', headRules(src));", '', 'html: 머리말 규칙 끔'],
    ['fixtures', 'tools/checks/html.mjs', "report('좁은 화면 여백', gutterRules(src));", '', 'html: 여백 규칙 끔'],
    ['fixtures', 'tools/checks/html.mjs', "report('제목 일치', titleRules(file, src));", '', 'html: 제목 규칙 끔'],
    ['fixtures', 'tools/checks/html.mjs', "report('고정폭 래퍼', c.wideUnwrapped);", '', 'html: 고정폭 래퍼 끔'],
    ['fixtures', 'tools/checks/html.mjs', 'if (!this.wrapped()) this.unwrapped.push(line);', '', 'html: 표 래퍼 끔'],
    ['fixtures', 'tools/checks/html.mjs', 'const MIN_PX = 12.0;', 'const MIN_PX = 0;', 'html: 글자 크기 바닥 0'],
    ['fixtures', 'tools/checks/html.mjs', "this.nesting.push(`${t.line}행: </${tag}> 앞에 닫히지 않은 태그", "void (`${t.line}행: </${tag}> 앞에 닫히지 않은 태그", 'html: 중첩 규칙 끔'],
    ['fixtures', 'tools/checks/terms.mjs', "[/마디/g, '마디', '노드'],", '', 'terms: 「마디」 뺌'],
    ['fixtures', 'tools/checks/verbs.mjs', '[/지우[기고는며]|지웁|지웠|지울|지워/g', '[/(?!)/g', 'verbs: 「지우다」 뺌'],
    ['fixtures', 'tools/checks/verbs.mjs', 'if (QUIZ.test(m[2])) continue;', '', 'verbs: 퀴즈 선택지 예외 뺌'],
    ['fixtures', 'tools/checks/prose.mjs', 'for (const [pos, e] of straightQuotes(p, src))', 'for (const [pos, e] of [])', 'prose: 곧은따옴표 끔'],
    ['fixtures', 'tools/checks/prose.mjs', 'const later = checkLater(f);', 'const later = [];', 'prose: 문체 기준서(사람 몫) 끔'],
    ['fixtures', 'tools/checks/classes.mjs', "'템플릿 리터럴로 조립'],", "'템플릿 리터럴로 조립'].slice(0, 0),", 'classes: 템플릿 규칙 끔'],
    ['fixtures', 'tools/checks/code.mjs', 'if (/\\s/.test(path.basename(p)))', 'if (false)', 'code: 공백 이름 규칙 끔'],

    // ── 진짜 브라우저 레이아웃 — 화면을 망가뜨린다 ───────────────────────────
    ['browser/sim-layout', 'simulator/cs/sort.html', '</body>', '<div style="width:640px;height:8px"></div></body>', '375 에서 넓은 상자로 가로 넘침'],
    ['browser/sim-layout', 'simulator/cs/linear.html', '</body>', '<style>body{overflow-x:hidden}</style><button style="position:absolute;left:420px;top:0">x</button></body>', '375 에서 버튼이 화면 오른쪽 밖(넘침은 가림)'],
    ['browser/sim-layout', 'simulator/cs/tree.html', '</head>', '<style>#stage button{position:absolute!important;top:120px!important;left:40px!important}</style></head>', '버튼끼리 한 자리에 겹침'],
    // 무대 자체의 overflow 는 심지 않는다 — 무대는 넘치지 않고(fs-fill 이 남는 높이를 나눈다) 넘침은
    // 안쪽 칸이 받으므로 뜻이 같은(등가) 돌연변이다. 넘침을 받는 안쪽 칸의 스크롤을 끈다.
    ['browser/sim-layout', 'src/styles/simulator.css', '    min-height: 0;\n    overflow-y: auto;\n    scrollbar-gutter: stable;', '    min-height: 0;\n    overflow-y: hidden;\n    scrollbar-gutter: stable;', '전체 화면 조작 칸이 스크롤되지 않아 아래 조작에 못 닿음'],
    ['browser/sim-layout', 'simulator/ai/wumpus-world.html', '</head>', '<style>.fs-on .fs-fill{margin-left:1500px}</style></head>', '전체 화면에서 조작이 화면 가로 밖으로'],
    ['browser/sim-layout', 'src/styles/simulator.css', '    height: calc(1.625em * 4 + 1.5rem);', '    height: auto;', 'sim-deck 설명 띠 높이를 풀어 단계마다 그림이 들썩임'],
    ['browser/sim-layout', 'src/styles/simulator.css', '    order: -1;', '    order: 0;', 'sim-deck 조작 칸이 그림 뒤로'],

    // ── 시뮬레이터 — 알고리즘에 그럴듯한 버그를 심는다 ────────────────────────
    ['sim-pages', 'src/entries/_lib/canvas-dpr.js', 'const dpr = window.devicePixelRatio || 1;', 'const dpr = 1;', '캔버스가 화면 배율을 무시'],
    ['sim-fullscreen', 'src/styles/simulator.css', '.fs-stage:is(:fullscreen, .fs-on) {', '.fs-stage:is(:fullscreen) {', '전체 화면 CSS 가 fs-on 을 안 봄'],
    ['sim-graph.', 'src/entries/_lib/graph-model.js', '? Math.floor(d / GRAPH_SCALE)', '? Math.floor(d / GRAPH_SCALE) + 3', 'h 가 실제 비용을 넘음'],
    ['sim-graph-sim', 'simulator/ai/search-bfs-dfs.html', "if (st.algo === 'bfs') return st.frontier.shift();", "if (st.algo === 'bfs') return st.frontier.pop();", 'BFS 가 스택으로 꺼냄'],
    ['sim-heuristic-tree', 'simulator/ai/search-heuristic.html', 'return fDiff !== 0 ? fDiff : this.foundAt.get(a) - this.foundAt.get(b);', 'return fDiff !== 0 ? fDiff : this.foundAt.get(b) - this.foundAt.get(a);', '동점을 나중 발견부터'],
    ['sim-puzzle', 'simulator/ai/search-8-puzzle.html', 'return Math.abs(targetX - index % 3) + Math.abs(targetY - Math.floor(index / 3));', 'return Math.abs(targetX - index % 3) + Math.abs(targetY - Math.floor(index / 3)) + 1;', '뱃지 맨해튼 거리 +1'],
    ['sim-sort', 'src/entries/_lib/sort/algo/insertion.js', 'rec.cmpHeld(j) > 0', 'rec.cmpHeld(j) >= 0', '삽입 정렬이 불안정'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'const pushed = rec.size - i;', 'const pushed = rec.size - i + 1;', '밀어낸 개수 하나 더 셈'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', "const side = d < 0 ? 'left' : 'right';", "const side = d < 0 ? 'right' : 'left';", 'BST 가 작은 값을 오른쪽에 넣음'],
    // `d <= 0` 은 심지 않는다 — 바로 위에서 `d === 0` 이 먼저 돌아가므로 뜻이 같은(등가) 돌연변이다.
    ['sim-find', 'src/entries/_lib/find/find-model.js', 'const at = (h + k) % st.cap;', 'const at = (h + k + 1) % st.cap;', '선형 탐사가 제자리를 건너뜀'],
    ['sim-compress', 'src/entries/_lib/compress/compress-rle.js', 'n: j - i,', 'n: j - i + 1,', 'RLE 길이 하나 더'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'this.b -= this.learningRate * db;', 'this.b += this.learningRate * db;', '절편을 기울기 방향으로'],
    ['sim-deep-learning', 'simulator/ai/deep-learning.html', 'ctx.lineTo(V.toX(this.w + span), V.toYRaw(l + g * span));', 'ctx.lineTo(V.toX(this.w + span), V.toYRaw(l + 2 * g * span));', '접선 기울기 두 배'],
    ['sim-wumpus', 'simulator/ai/wumpus-world.html', 'if (adj.x === this.wumpus.x && adj.y === this.wumpus.y) stench = true;', 'if (adj.x === this.wumpus.x && adj.y === this.wumpus.y) breeze = true;', '냄새를 바람으로 지각'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'if (state[i] === col || Math.abs(state[i] - col) === Math.abs(i - row)) {', 'if (state[i] === col) {', '대각선 충돌을 안 봄'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'generateMoves(n - 1, aux, src, dst, moves);', 'generateMoves(n - 1, src, aux, dst, moves);', '재귀 해법의 기둥 순서 틀림'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', 'if (sh === ca && f !== sh) return false;', '', '양과 양배추를 두어도 안전'],
    ['sim-decision-tree', 'simulator/ai/supervised-decision-tree.html', 'gini -= p * p;', 'gini -= p;', '지니 불순도 식 틀림'],
    ['sim-knn', 'simulator/ai/supervised-k-nn.html', 'let d = Math.sqrt(Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2));', 'let d = Math.abs(p.x - q.x) + Math.abs(p.y - q.y);', '유클리드 대신 맨해튼'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'return 1 / (1 + Math.exp(-z));', 'return 1 / (1 + Math.exp(-2 * z));', '시그모이드 기울기 두 배'],
    ['sim-svm', 'simulator/ai/supervised-svm.html', 'if (margin < 1) {', 'if (margin < 0) {', '힌지 손실 여백 0'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'this.w2 -= this.learningRate * dw2;', 'this.w2 -= this.learningRate * dw1;', 'w2 를 dw1 로 갱신'],
    ['sim-gridworld', 'simulator/ai/reinforcement-gridworld.html', 'return Math.max(...this.qTable[y][x]);', 'return Math.min(...this.qTable[y][x]);', 'max Q 대신 min Q'],
    ['sim-bandit', 'simulator/ai/reinforcement-multi-armed-bandit.html', 'machine.qValue += (reward - machine.qValue) / machine.count;', 'machine.qValue += (reward - machine.qValue) / (machine.count + 1);', '표본 평균 분모 틀림'],
    ['sim-kmeans', 'simulator/ai/unsupervised-k-means.html', 'if (dist < minDist) {', 'if (dist > minDist) {', '가장 먼 중심에 배정'],
    ['sim-vision', 'simulator/ai/computer-vision-ml5.html', 'if (mirrorMode) x = width - x - w; // 거울 모드 좌표 반전', 'if (mirrorMode) x = width - x; // 거울 모드 좌표 반전', '거울 모드에서 상자 폭을 안 뺌'],
];

function runTest(name) {
    // 이름 끝의 `.` 은 「sim-tree.」처럼 다른 이름(sim-heuristic-tree)과 겹치지 않게 못박은 것이다.
    const file = `tests/${name.replace(/\.$/, '')}.test.mjs`;
    const p = spawnSync(process.execPath, [path.join(ROOT, 'node_modules/vitest/vitest.mjs'), 'run', file],
        {cwd: ROOT, encoding: 'utf8', env: {...process.env, CHECK_ARGS: '[]'}});
    return p.status;
}

const want = process.argv.slice(2);
const todo = MUTANTS.filter(([t, , , , why]) => !want.length || want.some((w) => t.includes(w) || why.includes(w)));
const rows = [];
for (const [test, rel, from, to, why] of todo) {
    const file = path.join(ROOT, rel);
    const orig = fs.readFileSync(file);
    const text = orig.toString('utf8');
    if (!text.includes(from)) { rows.push([test, why, '돌연변이를 심을 자리가 없다']); console.log(`?? ${test} — ${why}: 자리 없음`); continue; }
    try {
        fs.writeFileSync(file, text.replace(from, to));
        const code = runTest(test);
        const verdict = code === 0 ? '살아남음 ✗' : '잡힘';
        rows.push([test, why, verdict]);
        console.log(`${code === 0 ? '✗ 살아남음' : '✓ 잡힘   '}  ${test.padEnd(24)} ${why}`);
    } finally {
        fs.writeFileSync(file, orig);
    }
}
const alive = rows.filter((r) => r[2] !== '잡힘');
console.log(`\n돌연변이 ${rows.length}개 — 잡힘 ${rows.length - alive.length}, 살아남음·자리 없음 ${alive.length}`);
for (const r of alive) console.log(`  ${r[0]} — ${r[1]}: ${r[2]}`);
process.exit(alive.length ? 1 : 0);
