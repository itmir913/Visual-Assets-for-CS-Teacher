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
    ['prose', NOTE, ...afterH1('<p>결정계수는 0에 가깝습니다.</p>'), '과목 간 표기 「결정계수」'],
    ['prose', 'simulator/ai/unsupervised-k-means.html', '</main>', '<p>리스트의 자리 번호로 꺼냅니다.</p></main>', '시뮬레이터에 「자리 번호」'],
    ['prose', 'simulator/cs/sort.html', '</main>', '<p><b>가</b>와 <b>나</b>를 봅니다.</p></main>', '시뮬레이터 문단에 볼드 둘(문체 기준서)'],
    ['classes', NOTE, ...afterH1('<div class="bg-${x}-50"></div>'), '조립한 클래스'],
    ['code', '데이터과학/code/2-3-2.영을-결측치로.py', '\n', '\ndef (:\n', '.py 구문 오류'],
    ['code', NOTE, ...afterH1('<pre><code>print(1)</code></pre>'), 'HTML 에 코드를 직접'],
    ['code', '소프트웨어와생활/3-1-4.표로-된-데이터-다루기.html', '<script type="module" src="/src/entries/software-life/3-1-4.js"></script>', '', 'Prism 진입점 빠짐'],
    ['code', 'src/entries/data-science/3-1-2.js', "import '../_lib/prism-r.js';", '', '진입점에 R 문법 빠짐'],
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
    ['fixtures', 'tools/checks/prose.mjs', "const later = path.extname(f) === '.html' ? checkLater(f) : [];", 'const later = [];', 'prose: 문체 기준서(사람 몫) 끔'],
    ['fixtures', 'tools/checks/classes.mjs', "'템플릿 리터럴로 조립'],", "'템플릿 리터럴로 조립'].slice(0, 0),", 'classes: 템플릿 규칙 끔'],
    ['fixtures', 'tools/checks/classes.mjs', 'if (made.has(t)) r.error(', 'if (false) r.error(', 'classes: JS 속 Tailwind 규칙 끔'],
    ['fixtures', 'tools/checks/classes.mjs', "const JS_ALLOWED = new Set(['hidden']);", "const JS_ALLOWED = new Set(['hidden', 'px-3', 'min-h-[3rem]']);", 'classes: JS 예외 목록이 새어 Tailwind 클래스를 통과시킴'],
    ['fixtures', 'tools/checks/code.mjs', 'if (/\\s/.test(path.basename(p)))', 'if (false)', 'code: 공백 이름 규칙 끔'],

    // ── 진짜 브라우저 레이아웃 — 화면을 망가뜨린다 ───────────────────────────
    ['browser/sim-layout', 'simulator/cs/sort.html', '</body>', '<div style="width:640px;height:8px"></div></body>', '375 에서 넓은 상자로 가로 넘침'],
    ['browser/sim-layout', 'simulator/cs/linear.html', '</body>', '<style>body{overflow-x:hidden}</style><button style="position:absolute;left:420px;top:0">x</button></body>', '375 에서 버튼이 화면 오른쪽 밖(넘침은 가림)'],
    ['browser/sim-layout', 'simulator/cs/tree.html', '</head>', '<style>#stage button{position:absolute!important;top:120px!important;left:40px!important}</style></head>', '버튼끼리 한 자리에 겹침'],
    // 무대 자체의 overflow 는 심지 않는다 — 무대는 넘치지 않고(fs-fill 이 남는 높이를 나눈다) 넘침은
    // 안쪽 칸이 받으므로 뜻이 같은(등가) 돌연변이다. 넘침을 받는 안쪽 칸의 스크롤을 끈다.
    ['browser/sim-layout', 'src/styles/simulator.css', '    min-height: 0;\n    overflow-y: auto;\n    scrollbar-gutter: stable;', '    min-height: 0;\n    overflow-y: hidden;\n    scrollbar-gutter: stable;', '전체 화면 조작 칸이 스크롤되지 않아 아래 조작에 못 닿음'],
    ['browser/sim-layout', 'simulator/ai/wumpus-world.html', '</head>', '<style>.fs-on .fs-fill{margin-left:1500px}</style></head>', '전체 화면에서 조작이 화면 가로 밖으로'],
    ['browser/sim-layout', 'src/styles/simulator.css', '        height: calc(1.625em * 3 + 1.5rem);', '        height: auto;', 'sim-deck 설명 띠 높이를 풀어 단계마다 그림이 들썩임'],
    ['browser/sim-layout', 'src/styles/simulator.css', '    order: -1;', '    order: 0;', 'sim-deck 조작 칸이 그림 뒤로'],
    ['browser/sim-layout', 'src/styles/simulator.css', '    height: max(62rem, calc(100dvh - 2rem));', '    height: calc(100dvh - 2rem);', '낮은 화면에서 무대 바닥이 없어 그림이 칸 안에서 스크롤됨'],

    // ── 시뮬레이터 — 알고리즘에 그럴듯한 버그를 심는다 ────────────────────────
    ['sim-pages', 'src/entries/_lib/canvas-dpr.js', 'const dpr = window.devicePixelRatio || 1;', 'const dpr = 1;', '캔버스가 화면 배율을 무시'],
    ['sim-fullscreen', 'src/styles/simulator.css', '.fs-stage:is(:fullscreen, .fs-on) {', '.fs-stage:is(:fullscreen) {', '전체 화면 CSS 가 fs-on 을 안 봄'],
    ['sim-graph.', 'src/entries/_lib/graph-model.js', '? Math.floor(d / GRAPH_SCALE)', '? Math.floor(d / GRAPH_SCALE) + 3', 'h 가 실제 비용을 넘음'],
    ['sim-graph-sim', 'simulator/ai/search-bfs-dfs.html', "if (st.algo === 'bfs') return st.frontier.shift();", "if (st.algo === 'bfs') return st.frontier.pop();", 'BFS 가 스택으로 꺼냄'],
    ['sim-heuristic-tree', 'simulator/ai/search-heuristic.html', 'return fDiff !== 0 ? fDiff : this.foundAt.get(a) - this.foundAt.get(b);', 'return fDiff !== 0 ? fDiff : this.foundAt.get(b) - this.foundAt.get(a);', '동점을 나중 발견부터'],
    ['sim-puzzle', 'simulator/ai/search-8-puzzle.html', 'return Math.abs(targetX - index % 3) + Math.abs(targetY - Math.floor(index / 3));', 'return Math.abs(targetX - index % 3) + Math.abs(targetY - Math.floor(index / 3)) + 1;', '뱃지 맨해튼 거리 +1'],
    // 탐색 넷(맹목 트리 · 그래프 · 격자, 정보 이용 트리 · 그래프 · 격자, 8-퍼즐) — 정답은 검사 쪽에서 따로 구한다
    ['sim-search-tabs', 'simulator/ai/search-bfs-dfs.html', "const insertOrder = st.algo === 'dfs' ? [...children].reverse() : children;", 'const insertOrder = children;', '트리 DFS 가 자식을 거꾸로 넣지 않음'],
    ['sim-search-tabs', 'simulator/ai/search-bfs-dfs.html', "const current = st.algo === 'bfs' ? st.dataStructure.shift() : st.dataStructure.pop();", "const current = st.algo === 'bfs' ? st.dataStructure.pop() : st.dataStructure.shift();", '트리 BFS · DFS 뒤바뀜'],
    ['sim-search-tabs', 'simulator/ai/search-bfs-dfs.html', 'const pushOrder = isBFS ? [0, 1, 2, 3] : [3, 2, 1, 0];', 'const pushOrder = [0, 1, 2, 3];', '격자 DFS 가 방향을 거꾸로 넣지 않음'],
    ['sim-search-tabs', 'simulator/ai/search-bfs-dfs.html', 'if (visited[current.r][current.c]) continue;', '', '격자 DFS 가 꺼낼 때 방문 검사를 안 함'],
    ['sim-search-tabs', 'simulator/ai/search-bfs-dfs.html', "yield {type: 'path', node: {...path[i], treeId: visitTreeId[path[i].r][path[i].c]}};", "yield {type: 'path', node: {...path[i], treeId: 0}};", '격자 길을 탐색 트리의 다른 노드에 칠함'],
    ['sim-search-tabs', 'simulator/ai/search-bfs-dfs.html', 'this.setStatus(isBFS', 'this.setStatus(!isBFS', '격자 BFS · DFS 알림 뒤바뀜'],
    ['sim-search-tabs', 'simulator/ai/search-heuristic.html', '(idx) => this.getManhattan(idx, goalIdx),', '(idx) => 2 * this.getManhattan(idx, goalIdx),', '격자 h 를 두 배로(과대 추정)'],
    ['sim-search-tabs', 'simulator/ai/search-heuristic.html', 'const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];', 'const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1]];', '격자에 대각 이동'],
    ['sim-graph-sim', 'simulator/ai/search-bfs-dfs.html', "if (st.algo === 'dfs') neighbors = [...neighbors].reverse();", "if (false) neighbors = [...neighbors].reverse();", '그래프 DFS 가 이웃을 거꾸로 넣지 않음'],
    ['sim-graph-sim', 'simulator/ai/search-bfs-dfs.html', 'if (st.g.get(st.frontier[i]) < st.g.get(st.frontier[best])) best = i;', 'if (st.g.get(st.frontier[i]) > st.g.get(st.frontier[best])) best = i;', '균일 비용이 비싼 것부터'],
    ['sim-graph-sim', 'simulator/ai/search-heuristic.html', "if (this.type === 'greedy') return hVal;", "if (this.type === 'greedy') return gVal + hVal;", '최상 우선이 g 도 봄'],
    ['sim-graph-sim', 'simulator/ai/search-heuristic.html', "if (this.type === 'astar') return gVal + hVal;", "if (this.type === 'astar') return gVal;", 'A* 가 h 를 안 봄'],
    ['sim-graph-sim', 'simulator/ai/search-heuristic.html', "return this.type === 'astar' || this.type === 'dijkstra';", "return this.type === 'astar';", '다익스트라가 더 싼 길로 부모를 갈지 않음'],
    ['sim-graph-sim', 'simulator/ai/search-heuristic.html', "if (this.type === 'dfs') neighbors = [...neighbors].reverse();", "if (false) neighbors = [...neighbors].reverse();", '정보 이용 DFS 가 이웃을 거꾸로 넣지 않음'],
    ['sim-graph-sim', 'src/entries/_lib/graph-model.js', 'if (e.directed !== true) adj.get(e.b).push({to: e.a, cost: e.cost, edgeId: e.id});', 'if (e.directed === false) adj.get(e.b).push({to: e.a, cost: e.cost, edgeId: e.id});', '양방향 간선을 한쪽으로만'],
    ['sim-graph-sim', 'src/entries/_lib/graph-model.js', 'e.cost = weighted ? Math.max(1, Math.ceil(e._len / GRAPH_SCALE)) : 1;', 'e.cost = weighted ? Math.max(1, Math.round(e._len / GRAPH_SCALE)) : 1;', '간선 비용을 반올림'],
    ['sim-graph-sim', 'src/entries/_lib/graph-model.js', 'if (best.get(x.to) === undefined || next < best.get(x.to)) best.set(x.to, next);', 'if (best.get(x.to) === undefined) best.set(x.to, next);', '정답(cheapestCost)이 더 싼 길로 고치지 않음'],
    ['sim-heuristic-tree', 'simulator/ai/search-heuristic.html', '그래서 확장한 노드가 많아지기 쉽습니다.', '그래서 확장한 노드가 가장 많습니다.', '너비 우선이 늘 가장 많이 확장한다고 적음'],
    ['sim-heuristic-tree', 'simulator/ai/search-heuristic.html', 'const 연노드 = this.closedSet.size;', 'const 연노드 = this.closedSet.size + 1;', '알림의 확장한 노드 수 +1'],
    ['sim-puzzle', 'simulator/ai/search-8-puzzle.html', 'if (row < 2) moves.push(emptyIndex + 3); // 하', 'if (row < 3) moves.push(emptyIndex + 3); // 하', '빈칸이 판 밖으로 내려감'],
    ['sim-puzzle', 'simulator/ai/search-8-puzzle.html', 'if (state[i] !== 0 && state[i] !== GOAL_STATE[i]) count++;', 'if (state[i] !== GOAL_STATE[i]) count++;', '제자리 아닌 타일에 빈칸도 셈'],
    ['sim-puzzle', 'simulator/ai/search-8-puzzle.html', 'const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];', 'const randomMove = Math.floor(Math.random() * 9);', '섞기가 빈칸을 아무 칸과 맞바꿈(풀 수 없는 판)'],
    ['sim-puzzle', 'simulator/ai/search-8-puzzle.html', 'if (a[parent].priority <= a[i].priority) break;', 'if (a[parent].priority >= a[i].priority) break;', '힙 올리기 부등호 뒤집힘'],
    ['sim-sort', 'src/entries/_lib/sort/algo/insertion.js', 'rec.cmpHeld(j) > 0', 'rec.cmpHeld(j) >= 0', '삽입 정렬이 불안정'],
    // 정렬의 세는 값 · 단계 불변식 · 화면 문장은 `sim-ordering` 이 본다(`sim-sort` 는 몇 분이 걸려 나눴다)
    // 줄바꿈이 든 글은 심지 않는다 — 작업 사본의 줄 끝(CRLF · LF)에 따라 자리를 못 찾는다.
    ['sim-ordering', 'src/entries/_lib/sort/sort-model.js', 'counts.move += 2;', 'counts.move += 1;', '정렬: 교환을 옮김 하나로 셈'],
    // 첫 `counts.compare++` 는 `cmp` 의 것이다
    ['sim-ordering', 'src/entries/_lib/sort/sort-model.js', 'counts.compare++;', '', '정렬: 두 자리 비교를 안 셈'],
    ['sim-ordering', 'src/entries/_lib/sort/sort-model.js', 'auxBlocks[blockIdx].items.push(a[i]);', 'auxBlocks[blockIdx].items.push(a[i]); counts.move--;', '정렬: 병합의 복사를 옮김으로 안 셈'],
    ['sim-ordering', 'src/entries/_lib/sort/sort-model.js', 'const item = cell.items.shift();', 'const item = cell.items.pop();', '정렬: 칸에서 뒤부터 꺼냄(분배 정렬 불안정)'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/bubble.js', 'if (rec.cmp(i, i + 1) > 0) {', 'if (rec.cmp(i, i + 1) >= 0) {', '버블 정렬이 같은 값도 교환'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/bubble.js', '${end}번 칸이 확정', '${end + 1}번 칸이 확정', '버블 정렬 설명의 자리 번호 하나 어긋남'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/cocktail.js', 'for (let i = hi; i > lo; i--) {', 'for (let i = hi; i > lo + 1; i--) {', '칵테일 정렬이 왼쪽 끝까지 안 끌어옴'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/selection.js', 'for (let j = i + 1; j < n; j++) {', 'for (let j = i + 1; j < n - 1; j++) {', '선택 정렬이 마지막 칸을 안 봄'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/insertion.js', 'rec.say(j < 0', 'rec.say(j <= 0', '삽입 정렬 설명이 맨 앞을 잘못 짚음'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/heap.js', 'if (rec.cmp(right, big) > 0) big = right;', 'if (rec.cmp(right, r) > 0) big = right;', '힙: 오른쪽 자식을 부모하고만 비교'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/heap.js', 'for (let i = Math.floor(n / 2) - 1; i >= 0; i--)', 'for (let i = Math.floor(n / 2) - 2; i >= 0; i--)', '힙: 만들 때 노드 하나를 빠뜨림'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/heap.js', "kids === 2 ? '두 자식' : '자식'", "'두 자식'", '힙: 자식 수와 다른 설명'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/quick.js', 'if (rec.cmp(j, hi) < 0) {', 'if (rec.cmp(j, hi) <= 0) {', '퀵: 피벗과 같은 값을 왼쪽으로'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/quick.js', '`피벗이 ${wall}번 칸에', '`피벗이 ${wall + 1}번 칸에', '퀵: 설명의 피벗 자리 어긋남'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/merge.js', 'if (rec.auxCmp(0, x, 1, y) <= 0)', 'if (rec.auxCmp(0, x, 1, y) < 0)', '병합: 같으면 오른쪽 먼저(불안정)'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/counting.js', 'rec.say(`값 ${withJosa(v, \'이가\')} ${have}개', 'rec.say(`값 ${withJosa(v, \'이가\')} ${have + 1}개', '계수: 설명의 개수 하나 더'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/radix.js', 'const digit = Math.floor(rec.peek(i) / place) % 10;', 'const digit = Math.floor(rec.peek(i) / (place * 10)) % 10;', '기수: 한 자리 위를 봄'],
    ['sim-ordering', 'src/entries/_lib/sort/algo/bucket.js', 'const bucketOf = (v) => Math.min(k - 1, Math.floor(((v - lo) * k) / span));', 'const bucketOf = (v) => Math.min(k - 1, Math.round(((v - lo) * k) / span));', '버킷: 칸 이름과 다른 칸에 넣음'],
    ['sim-ordering', 'src/entries/_lib/sort/sort-race.js', 'f.counts.compare + f.counts.move + f.counts.access', 'f.counts.compare + f.counts.move', '알고리즘 비교: 작업량에서 배열 접근을 뺌'],
    ['sim-ordering', 'src/entries/_lib/sort/sort-ui.js', "$('count-move').textContent = String(frame.counts.move);", "$('count-move').textContent = String(frame.counts.access);", '정렬 화면: 옮김 칸에 배열 접근을 적음'],
    ['sim-ordering', 'src/entries/_lib/sort/sort-registry.js', "blurb: '이웃끼리, 또는 남은 것 전부와 하나씩 비교합니다. 넷 다", "blurb: '이웃끼리, 또는 남은 것 전부와 하나씩 비교합니다. 셋 다", '정렬: 분류 설명의 개수가 등록부와 다름'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'const pushed = rec.size - i;', 'const pushed = rec.size - i + 1;', '밀어낸 개수 하나 더 셈'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'const pulled = rec.size - 1 - i;', 'const pulled = rec.size - i;', '당긴 개수 하나 더 셈'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'seen++;', 'seen += 0;', '리스트 찾기가 지나온 노드를 안 셈'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', "rec.link(after.id, before ? before.id : null, 'prev');", "rec.link(after.id, before ? target.id : null, 'prev');", '이중 연결 리스트 삭제가 역방향 링크를 빼는 노드에 둠'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 's.rear = next;', 's.rear = next % (rec.cap - 1);', '원형 큐 rear 가 한 칸 일찍 돌아옴'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', "run: (rec) => peekEnd(rec, rec.size - 1, '맨 위'),", "run: (rec) => peekEnd(rec, 0, '맨 위'),", '배열 스택 peek 이 맨 아래를 봄'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', '**노드를 ${k + 1}개 지나왔습니다**', '**노드를 ${k}개 지나왔습니다**', '리스트 읽기 설명의 지나온 노드 수 하나 모자람'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'if (i >= rec.size && rec.state.hasTail) {', 'if (i > rec.size && rec.state.hasTail) {', 'tail 포인터가 있어도 끝까지 따라감'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', '**${i + 1}번 확인했습니다.**', '**${i}번 확인했습니다.**', '배열 찾기 설명의 확인 수 하나 모자람'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'return `${seen - 1}번 노드에서 찾았습니다.', 'return `${seen}번 노드에서 찾았습니다.', '리스트 찾기 끝 장의 노드 번호를 1부터 셈'],
    ['sim-ds', 'src/entries/_lib/ds/ds-ops.js', 'return `${k}번 노드는 ${nd.v}입니다.', 'return `${k + 1}번 노드는 ${nd.v}입니다.', '리스트 읽기 끝 장의 노드 번호를 1부터 셈'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', "const side = d < 0 ? 'left' : 'right';", "const side = d < 0 ? 'right' : 'left';", 'BST 가 작은 값을 오른쪽에 넣음'],
    // 한 줄로 심는다 — 작업 사본의 줄 끝이 CRLF 라 여러 줄 글은 자리를 못 찾는다.
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', 'const succ = successorOf(rec, target);', 'const succ = ((n) => { let a = rec.node(n.left); while (a.right !== null) a = rec.node(a.right); return a; })(target);', 'BST 삭제가 후계자 대신 전임자를 올림'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-model.js', 'return h(nd.left) - h(nd.right);', 'return h(nd.right) - h(nd.left);', 'AVL 균형 인수 부호 뒤집힘'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', 'if (balanceOf(rec.state, left) < 0) {', 'if (balanceOf(rec.state, left) <= 0) {', 'AVL: 왼쪽 자식이 반듯해도 두 번 회전'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', "rec.say(`${at.v}의 균형 인수는 ${b}입니다.", "rec.say(`${at.v}의 균형 인수는 ${-b}입니다.", 'AVL 설명의 균형 인수 부호 뒤집힘'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', 'swaps++;', 'swaps += 0;', '힙 삽입이 올라간 횟수를 안 셈'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', 'steps++;', 'steps += 0;', 'BST 탐색 설명의 비교 횟수 0'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', 'const parentOf = (i) => Math.floor((i - 1) / 2);', 'const parentOf = (i) => Math.floor(i / 2);', '힙 부모 인덱스 틀림'],
    ['sim-tree.', 'src/entries/_lib/ds/tree-ops.js', 'if (r < rec.size && rec.heapCompare(r, l) > 0) big = r;', 'if (r < rec.size && rec.heapCompare(r, l) < 0) big = r;', '힙 꺼내기가 작은 자식과 바꿈'],
    // `d <= 0` 은 심지 않는다 — 바로 위에서 `d === 0` 이 먼저 돌아가므로 뜻이 같은(등가) 돌연변이다.
    ['sim-find', 'src/entries/_lib/find/find-model.js', 'const at = (h + k) % st.cap;', 'const at = (h + k + 1) % st.cap;', '선형 탐사가 제자리를 건너뜀'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'const mid = Math.floor((lo + hi) / 2);', 'const mid = Math.ceil((lo + hi) / 2);', '이진 탐색 가운데를 올림으로 잡음'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'rec.ruleOut(lo, mid);', 'rec.ruleOut(lo, mid + 1);', '이진 탐색이 버리는 칸을 하나 더 칠함'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'looked += 1;', 'looked += 0;', '이진 탐색 끝 장의 비교 수를 안 셈'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'for (let i = 0; i < rec.size; i++) {', 'for (let i = 0; i < rec.size - 1; i++) {', '순차 탐색이 마지막 칸을 안 봄'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', '**${i + 1}번 비교했습니다.**', '**${i}번 비교했습니다.**', '순차 탐색 끝 장의 비교 수 하나 모자람'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'if (walkChain(rec, at, v) >= 0) {', 'if (walkChain(rec, at, v) > 0) {', '체이닝 삽입이 리스트 머리의 같은 값을 못 봄'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', '**계산 한 번에 비교 ${k + 1}번입니다.**', '**계산 한 번에 비교 ${k}번입니다.**', '체이닝 찾기 끝 장의 비교 수 하나 모자람'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'const spot = tombAt >= 0 ? tombAt : at;', 'const spot = at;', '개방 주소법 삽입이 지나온 묘비를 다시 쓰지 않음'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'const dist = (spot - home + rec.cap) % rec.cap;', 'const dist = (at - home + rec.cap) % rec.cap;', '개방 주소법 삽입 끝 장이 앉은 자리 대신 본 칸으로 밀린 칸을 셈'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', '**계산한 자리에서 ${k}칸 밀린 곳입니다.**', '**계산한 자리에서 ${k + 1}칸 밀린 곳입니다.**', '개방 주소법 찾기 끝 장의 밀린 칸 수 하나 많음'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'rec.erase(at, null, true);', 'rec.erase(at, null, false);', '개방 주소법 삭제가 묘비 대신 빈 칸을 남김'],
    ['sim-find', 'src/entries/_lib/find/find-ops.js', 'const reallyThere = rec.state.slots.some((it) => it && it.v === v);', 'const reallyThere = false;', '이진 탐색이 놓친 까닭을 말하지 않음'],
    ['sim-find', 'src/entries/_lib/find/find-model.js', 'return ((v % cap) + cap) % cap;', 'return ((v % (cap - 1)) + cap) % cap;', '해시 함수가 칸 수 하나 적게 나눔'],
    ['sim-find', 'src/entries/_lib/find/find-model.js', 'counts.hash += 1;', 'counts.hash += 2;', '해시 계산을 두 번으로 셈'],
    ['sim-find', 'src/entries/_lib/find/find-model.js', "snap({kind: 'visit', i});", "counts.access -= 1; snap({kind: 'visit', i});", '해시 칸 접근을 안 셈'],
    ['sim-find', 'src/entries/_lib/find/find-model.js', 'else s.buckets[i].push(it);', 'else s.buckets[i].unshift(it);', '체이닝이 새 값을 리스트 머리에 붙임'],
    ['sim-find', 'src/entries/_lib/find/find-compare.js', 'export const findRaceCap = (n) => Math.max(4, n * 2);', 'export const findRaceCap = (n) => Math.max(4, 10);', '작업량 측정에서 해시 표를 키우지 않음'],
    ['sim-find', 'src/entries/_lib/find/find-compare.js', 'while (cursor[k] + 1 < r.out.frames.length && r.work[cursor[k] + 1] <= t) cursor[k]++;', 'while (cursor[k] + 1 < r.out.frames.length && r.work[cursor[k] + 1] <= t + 1) cursor[k]++;', '나란히 비교가 한 칸 앞선 장을 보임'],
    ['sim-find', 'src/entries/_lib/find/find-ui.js', 'const kept = values.filter((v) => now.has(v) || !had.has(v));', 'const kept = values.filter((v) => now.has(v));', '개방 주소법이 담지 못한 값을 찾기 한 번에 잃음'],
    ['sim-compress', 'src/entries/_lib/compress/compress-rle.js', 'n: j - i,', 'n: j - i + 1,', 'RLE 길이 하나 더'],
    ['sim-compress', 'src/entries/_lib/compress/compress-huffman.js', '(x.n - y.n) || (x.seq - y.seq)', '(x.n - y.n) || (y.seq - x.seq)', '허프만 동점에서 나중에 만든 것부터 꺼냄'],
    ['sim-compress', 'src/entries/_lib/compress/compress-huffman.js', '(x.n - y.n) || (x.seq - y.seq)', '(y.n - x.n) || (x.seq - y.seq)', '허프만이 가장 큰 둘을 묶음'],
    ['sim-compress', 'src/entries/_lib/compress/compress-huffman.js', '(b.n > a.n) || (b.n === a.n && b.seq < a.seq) ? [b, a] : [a, b]', '(b.n < a.n) || (b.n === a.n && b.seq < a.seq) ? [b, a] : [a, b]', '허프만이 드문 쪽을 왼쪽(0)에 둠'],
    ['sim-compress', 'src/entries/_lib/compress/compress-huffman.js', 'codes.set(root.ch, \'0\');', 'codes.set(root.ch, \'\');', '한 가지뿐인 글의 코드가 0비트'],
    ['sim-compress', 'src/entries/_lib/compress/compress-huffman.js', 'bits += width + code.length;', 'bits += code.length;', '코드표에서 글자 비트를 안 셈'],
    ['sim-compress', 'src/entries/_lib/compress/compress-huffman.js', 'picked: [a.seq, b.seq]', 'picked: [a.seq, a.seq]', '고르는 장이 엉뚱한 둘을 가리킴'],
    ['sim-compress', 'src/entries/_lib/compress/compress-model.js', 'for (const ch of text) map.set(ch, (map.get(ch) || 0) + 1);', 'for (const ch of text) map.set(ch, 1);', '글자 횟수를 안 셈'],
    ['sim-compress', 'src/entries/_lib/compress/compress-model.js', 'return Math.max(1, Math.ceil(Math.log2(k)));', 'return Math.max(1, Math.floor(Math.log2(k)));', '글자 폭을 내림으로 냄'],
    ['sim-compress', 'src/entries/_lib/compress/compress-model.js', 'return Math.max(1, Math.ceil(Math.log2(Math.max(1, maxValue) + 1)));', 'return Math.max(1, Math.ceil(Math.log2(Math.max(1, maxValue))));', '런 렝스 횟수 칸이 가장 긴 반복을 못 담음'],
    ['sim-compress', 'src/entries/_lib/compress/compress-model.js', 'return Math.round((1 - afterBits / beforeBits) * 1000) / 10;', 'return Math.round((afterBits / beforeBits) * 1000) / 10;', '압축률을 남은 비율로 냄'],
    ['sim-compress', 'src/entries/_lib/compress/compress-keyword.js', 'if (!best || gain > best.gain) best = {piece, times, gain, len};', 'if (!best || gain >= best.gain) best = {piece, times, gain, len};', '키워드 동점에서 짧은·뒤 조각을 고름'],
    ['sim-compress', 'src/entries/_lib/compress/compress-keyword.js', 'for (let len = maxLen; len >= 2; len--) {', 'for (let len = maxLen; len >= 3; len--) {', '키워드가 두 글자 조각을 안 봄'],
    ['sim-compress', 'src/entries/_lib/compress/compress-keyword.js', 'if (text.startsWith(piece, i)) { n++; i += piece.length; } else i++;', 'if (text.startsWith(piece, i)) { n++; i++; } else i++;', '키워드가 겹친 조각까지 셈'],
    ['sim-compress', 'src/entries/_lib/compress/compress-keyword.js', 'return (len) => wBody + len * wDict;', 'return (len) => len * wDict;', '사전 한 줄에서 기호를 안 셈'],
    ['sim-compress', 'src/entries/_lib/compress/compress-keyword.js', 'return best && best.gain > 0 ? best : null;', 'return best && best.gain >= 0 ? best : null;', '이득이 0인 조각도 바꿈'],
    ['sim-compress', 'src/entries/_lib/compress/compress-ui.js', '? (부모.children[0] === 대상 ? \'0\' : \'1\')', '? (부모.children[0] === 대상 ? \'1\' : \'0\')', '허프만 트리 간선에 0·1을 뒤바꿔 적음'],
    ['sim-compress', 'src/entries/_lib/compress/compress-ui.js', '${rate === 최고 && rate > 0 ?', '${rate === 최고 ?', '늘어난 판에도 「가장 많이 줄임」'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'this.b -= this.learningRate * db;', 'this.b += this.learningRate * db;', '절편을 기울기 방향으로'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'dw += (pred - p.y) * p.x;', 'dw += (pred - p.y);', '기울기의 미분에서 x 를 빠뜨림'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'dw = (2 / N) * dw;', 'dw = (1 / N) * dw;', '기울기 미분의 2 빠뜨림'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'if (Math.abs(dw) < 0.00001 && Math.abs(db) < 0.00001) return true;', 'if (Math.abs(dw) < 0.01 && Math.abs(db) < 0.01) return true;', '최솟값에 닿기 전에 수렴이라 함'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'rb = (-this.model.w * b.minX / rX + this.model.b) * rY + b.minY;', 'rb = (-this.model.w * b.minX / rX + this.model.b) * rY;', '절편 되돌리기에서 y 의 시작점 빠뜨림'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'm.innerText = (mse / this.dataManager.points.length).toFixed(3);', 'm.innerText = (mse / (this.dataManager.points.length - 1)).toFixed(3);', '평균제곱오차를 N-1 로 나눔'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'e.innerText = this.model.epoch;', 'e.innerText = this.model.epoch + 1;', '회차 칸 하나 밀림'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', '} else if (lr <= 0.5) {', '} else if (lr <= 1.0) {', '발산하는 학습률을 「적당」이라 안내'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', '} else if (lr <= 1.2) {', '} else if (lr <= 2.0) {', '「거의 항상 발산」 칸이 좁아짐'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'y = 300 / x + 10', 'y = 3 * x + 10', 'WiFi 예제가 설명과 반대 방향'],
    ['sim-least-squares', 'simulator/ai/supervised-linear-regression.html', 'if (!this.model.hasStarted || this.model.diverged) this.model.init();', 'if (!this.model.hasStarted) this.model.init();', '발산한 값을 이어 받아 다시 발산'],
    ['sim-deep-learning', 'simulator/ai/deep-learning.html', 'ctx.lineTo(V.toX(this.w + span), V.toYRaw(l + g * span));', 'ctx.lineTo(V.toX(this.w + span), V.toYRaw(l + 2 * g * span));', '접선 기울기 두 배'],
    ['sim-wumpus', 'simulator/ai/wumpus-world.html', 'if (adj.x === this.wumpus.x && adj.y === this.wumpus.y) stench = true;', 'if (adj.x === this.wumpus.x && adj.y === this.wumpus.y) breeze = true;', '냄새를 바람으로 지각'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'if (state[i] === col || Math.abs(state[i] - col) === Math.abs(i - row)) {', 'if (state[i] === col) {', '대각선 충돌을 안 봄'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'generateMoves(n - 1, aux, src, dst, moves);', 'generateMoves(n - 1, src, aux, dst, moves);', '재귀 해법의 기둥 순서 틀림'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'if (state[i] === col || Math.abs(state[i] - col) === Math.abs(i - row)) {', 'if (Math.abs(state[i] - col) === Math.abs(i - row)) {', '같은 열 충돌을 안 봄'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'tempState[row] = -1;', '', '되짚을 때 퀸을 거두지 않음'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'if (yield* dfsGenerator(row + 1, nextPath, tempState)) return true;', 'yield* dfsGenerator(row + 1, nextPath, tempState);', '첫 해에서 멈추지 않음'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'totalNodesVisited++;', '', '방문 수를 안 셈'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'const sameRow = r1 === r2;', 'const sameRow = false;', '직접 해 보기: 같은 행 충돌을 안 봄'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', 'const sameCol = c1 === c2;', 'const sameCol = false;', '직접 해 보기: 같은 열 충돌을 안 봄'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', '<strong>[방문] 876칸</strong>', '<strong>[방문] 875칸</strong>', '설명문의 방문 칸 수 틀림'],
    ['sim-nqueen', 'simulator/ai/search-n-queen.html', '16,777,216가지', '16,777,215가지', '설명문의 완전탐색 가짓수 틀림'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'pegs[to][pegs[to].length - 1] < top', 'pegs[to][pegs[to].length - 1] > top', '작은 원판 위에 큰 원판을 허용'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'const detail = manualMovesCount <= minM', 'const detail = manualMovesCount <= minM + 2', '돌아간 풀이도 최적이라 함'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'if (manualPegs[2].length === manualN) {', 'if (manualPegs[2].length === manualN || manualPegs[1].length === manualN) {', 'B 에 모아도 성공'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'if (manualPegs[2].length === manualN) return;', '', '다 옮긴 판이 잠기지 않음'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', 'Math.pow(3,n).toLocaleString()', 'Math.pow(2,n).toLocaleString()', '큰 n 의 상태 수를 2ⁿ 으로'],
    ['sim-hanoi', 'simulator/ai/search-tower-of-hanoi.html', '<td class="border border-slate-200 px-4 py-3 text-center">243</td>', '<td class="border border-slate-200 px-4 py-3 text-center">81</td>', '표의 상태 수 틀림'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', 'if (sh === ca && f !== sh) return false;', '', '양과 양배추를 두어도 안전'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', 'if (wo === sh && f !== wo) return false;', '', '늑대와 양을 두어도 안전'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', 'if (cargo >= 0 && s[cargo + 1] !== f) continue; // 같은 쪽에 있어야', '// 같은 쪽 확인 빠짐', '건너편의 짐도 태움'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', 'const { state, path } = queue.shift();', 'const { state, path } = queue.pop();', '너비 우선 대신 깊이 우선'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', "document.getElementById('successDetail').textContent = manualMoves <= 7", "document.getElementById('successDetail').textContent = manualMoves <= 9", '돌아간 풀이도 최적이라 함'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', '} else if (visited.has(k)) {', '} else if (false) {', '트리에서 이미 방문한 상태를 또 확장함'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', 'else if (i === d - 1)', 'else if (i === d)', '트리의 정답 경로 표시가 한 층 어긋남'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', "const CARGO_NAME = ['늑대와', '양과', '양배추와'];", "const CARGO_NAME = ['양과', '늑대와', '양배추와'];", '트리 덧글의 짐 이름이 뒤바뀜'],
    ['sim-river', 'simulator/ai/search-river-crossing.html', '그중 유효 상태 <strong>10개', '그중 유효 상태 <strong>12개', '설명문의 유효 상태 수 틀림'],
    ['sim-decision-tree', 'simulator/ai/supervised-decision-tree.html', 'gini -= p * p;', 'gini -= p;', '지니 불순도 식 틀림'],
    ['sim-knn', 'simulator/ai/supervised-k-nn.html', 'let d = Math.sqrt(Math.pow(p.rx - q.rx, 2) + Math.pow(p.ry - q.ry, 2));', 'let d = Math.abs(p.rx - q.rx) + Math.abs(p.ry - q.ry);', '유클리드 대신 맨해튼'],
    // 비율 좌표를 그릴 때 판 크기를 안 보면 옛 결함(픽셀로 담아 크기가 바뀌어도 제자리)과 같다
    ['sim-knn', 'simulator/ai/supervised-k-nn.html', 'return {x: ox + p.rx * size, y: oy + p.ry * size};', 'return {x: p.rx * 400, y: p.ry * 400};', '판 크기가 바뀌어도 옛 픽셀 자리에 그림'],
    ['sim-knn', 'simulator/ai/supervised-k-nn.html', 'return {x: ox + p.rx * size, y: oy + p.ry * size};', 'return {x: p.rx * this.actualWidth, y: p.ry * this.actualHeight};', 'x·y 를 다른 척도로 그림'],
    ['sim-kmeans', 'simulator/ai/unsupervised-k-means.html', 'return {x: ox + p.rx * size, y: oy + p.ry * size};', 'return {x: p.rx * 400, y: p.ry * 400};', '판 크기가 바뀌어도 옛 픽셀 자리에 그림'],
    ['sim-kmeans', 'simulator/ai/unsupervised-k-means.html', 'dataManager.addPoint(rx, ry);', 'dataManager.addPoint(e.clientX - rect.left, e.clientY - rect.top);', '누른 자리를 픽셀로 담음'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'return 1 / (1 + Math.exp(-z));', 'return 1 / (1 + Math.exp(-2 * z));', '시그모이드 기울기 두 배'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'dw += (pred - p.y) * p.x;', 'dw += (p.y - pred) * p.x;', 'w 의 기울기 부호 뒤집음'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'db += (pred - p.y);', 'db += (pred - p.y) * p.x;', 'b 의 기울기에 x 를 곱함'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'if (Math.abs(dw) < 0.0001 && Math.abs(db) < 0.0001) return true;', 'if (Math.abs(dw) < 0.1 && Math.abs(db) < 0.1) return true;', '최솟값에 닿기 전에 멈춤'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'if (this.badWindows >= 2) {', 'if (this.badWindows >= 200) {', '손실이 튀어도 발산을 알리지 않음'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'let boundary_nx = -model.b / model.w;', 'let boundary_nx = model.b / model.w;', '결정 경계 부호 틀림'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'let boundary_x = bounds.minX + boundary_nx', 'let boundary_x = bounds.maxX + boundary_nx', '경계 글자의 되돌리기 기준점 틀림'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'const rb = -this.model.w * b.minX / rX + this.model.b;', 'const rb = this.model.b;', '식의 절편을 되돌리지 않음'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'const isClass1 = p >= 0.5;', 'const isClass1 = p < 0.5;', '예측 클래스 뒤집음'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'x = y === 1 ? -8 + Math.random() * 22', 'x = y === 0 ? -8 + Math.random() * 22', '난방 예제의 두 반을 바꿈'],
    ['sim-logistic', 'simulator/ai/supervised-logistic-regression.html', 'const lx = outLeft ? p.left : outRight ? w - p.right : px;', 'const lx = px;', '칸 밖 예측의 확률 글자가 잘림'],
    ['sim-svm', 'simulator/ai/supervised-svm.html', 'if (margin < 1) {', 'if (margin < 0) {', '힌지 손실 여백 0'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'this.w2 -= this.learningRate * dw2;', 'this.w2 -= this.learningRate * dw1;', 'w2 를 dw1 로 갱신'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'let err = pred - p.y;', 'let err = p.y - pred;', '오차 부호 뒤집음(오르막으로 감)'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'dw1 = (2 / N) * dw1;', 'dw1 = (1 / N) * dw1;', 'w1 기울기의 2 빠뜨림'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'db += err;', 'db += err * p.x1;', 'b 의 기울기에 x1 을 곱함'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'const realW2 = this.model.w2 * (scaleY / scaleX2);', 'const realW2 = this.model.w2 * (scaleY / scaleX1);', 'w2 를 x1 의 폭으로 되돌림'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'const realB = (this.model.b * scaleY) + b.minY - (realW1 * b.minX1) - (realW2 * b.minX2);', 'const realB = (this.model.b * scaleY) + b.minY - (realW1 * b.minX1);', '절편 되돌리기에서 x2 몫 빠뜨림'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'vm.innerText = (mse / this.dataManager.points.length).toFixed(3);', 'vm.innerText = (mse / (this.dataManager.points.length - 1)).toFixed(3);', '평균제곱오차를 N-1 로 나눔'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 've.innerText = this.model.epoch;', 've.innerText = this.model.epoch + 1;', '회차 칸 하나 밀림'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'if (this.epoch > this.epochCap) {', 'if (this.epoch > this.epochCap * 100) {', '회차 상한이 걸리지 않음'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', 'y = (x1 * 100) - (x2 * 20)', 'y = (x1 * 100) + (x2 * 20)', '집값 예제의 거리 부호가 설명과 반대'],
    ['sim-multiple-regression', 'simulator/ai/supervised-multiple-linear-regression.html', '} else if (lr <= 0.3) {', '} else if (lr <= 0.8) {', '발산하는 학습률을 「적당」이라 안내'],
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
