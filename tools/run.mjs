// 검사와 감사를 부르는 **유일한 러너.** 목록은 이 파일에만 있다.
//
//     npm run check                         모든 검사(산출물 검사 `dist` 는 뺀다)
//     npm run check -- prose html           이름을 준 것만
//     npm run check -- html 정보/1-1.….html  이름 뒤의 낱말은 그 검사에 넘긴다
//     npm run check -- sim                  시뮬레이터 동작 검사 전부
//     npm run check -- sim sort tree        그 가운데 이름을 준 것만
//     npm run check -- dist                 산출물 검사. 빌드 뒤에만 뜻이 있다
//     npm run audit -- lemma …              감사 도구 하나. 이름이 반드시 있어야 한다
//
// **검사는 Vitest 가 돈다.** 검사 하나가 `tests/` 의 테스트 파일 하나다 — 이 러너는 이름을
// 파일로 바꾸어 Vitest 에 넘기고, 이름 뒤의 인자는 `CHECK_ARGS` 로 건넨다. Vitest 는 파일 하나가
// 실패해도 **나머지를 다 돌고** 끝에 실패한 것을 모아 보인다. 한 번 돌려서 고칠 것을 다 알아야
// CI 를 한 번에 초록으로 되돌릴 수 있다.
//
// `package.json` 에 검사마다 이름을 붙여 두었더니 이름이 서른을 넘었고, 새 검사를 만들면
// `check` 줄에 잇는 것을 잊기 쉬웠다. 목록을 **여기 한 곳**에 두면 새 검사는 표에 한 줄을
// 더하는 것으로 끝나고 `npm run ci` 가 저절로 부른다.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// 이름 → 테스트 파일. 순서가 곧 도는 순서다 — 빠르고 넓게 걸리는 정적 검사를 앞에 둔다.
// 본체는 `tools/checks/<이름>.mjs` 이고, 테스트 파일은 그것을 부르는 껍데기다.
const CHECKS = {
    // 저장소 짜임
    'sim-index': 'tests/sim-index.test.mjs',
    'index-links': 'tests/index-links.test.mjs',
    'privacy': 'tests/privacy.test.mjs',
    'classes': 'tests/classes.test.mjs',
    'code': 'tests/code.test.mjs',
    // 글
    'html': 'tests/html.test.mjs',
    'terms': 'tests/terms.test.mjs',
    'verbs': 'tests/verbs.test.mjs',
    'prose': 'tests/prose.test.mjs',
    // 검사가 제 할 일을 하는가 — 일부러 틀리게 쓴 조각(`tests/fixtures/`)을 넣어 본다
    'fixtures': 'tests/fixtures.test.mjs',
    // 진짜 브라우저(Chromium)에서 잰 화면 — 겹침 · 넘침 · 닿지 않는 조작
    'layout': 'tests/browser/sim-layout.test.mjs',
    // 시뮬레이터 동작 — 아래 SIMS 표를 차례로 돈다. 뒤에 SIMS 의 이름을 주면 그것만.
    'sim': null,
    // 산출물. 빌드가 있어야 하므로 기본 목록에서 빠지고 이름으로만 부른다.
    'dist': 'tests/dist.test.mjs',
};

// 시뮬레이터 동작 검사. `check -- sim [이름…]` 으로만 부른다 — 이름이 서른 가까이라
// 최상위에 늘어놓으면 `sim` 과 `sims` 처럼 헷갈리는 이름이 생긴다(실제로 생겼다).
// 테스트 파일은 `tests/sim-<이름>.test.mjs` 다.
const SIMS = [
    // 모든 페이지 공통 — 뜨는가 · 캔버스 배율 · on* 핸들러가 가리키는 것이 있는가
    'pages', 'fullscreen',
    // 페이지마다
    'graph', 'graph-sim', 'heuristic-tree', 'puzzle', 'sort', 'ordering', 'ds', 'tree', 'find', 'compress',
    'least-squares', 'deep-learning', 'wumpus', 'nqueen', 'hanoi', 'river', 'decision-tree',
    'knn', 'logistic', 'svm', 'multiple-regression', 'gridworld', 'bandit', 'kmeans', 'vision',
];

// 이름으로만 부르는 검사. `npm run ci` 가 빌드 뒤에 따로 부른다.
const BY_NAME_ONLY = new Set(['dist']);

// 감사 도구 — 판정이 아니라 사람이 읽을 목록을 내놓는다. `ci` 에 넣지 않는다.
const AUDITS = {
    pre: 'tools/audits/pre.mjs',
    svg: 'tools/audits/svg.mjs',
    narrow: 'tools/audits/narrow.mjs',
    josa: 'tools/audits/josa.mjs',
    lemma: 'tools/audits/lemma.mjs',
};

const die = (m) => { console.error(`run: ${m}`); process.exit(2); };

/** `이름 인자… 이름 인자…` 를 `[[이름, [인자…]], …]` 로 가른다. */
function parse(argv, table) {
    const picked = [];
    for (const a of argv) {
        if (picked.length && picked.at(-1)[0] === 'sim' && SIMS.includes(a)) picked.at(-1)[1].push(a);
        else if (a in table) picked.push([a, []]);
        else if (picked.length) picked.at(-1)[1].push(a);
        else die(`모르는 이름 ${JSON.stringify(a)} — 있는 이름: ${Object.keys(table).join(', ')}`);
    }
    return picked;
}

async function audit(argv) {
    const [name, ...rest] = argv;
    if (!name) die(`감사 이름을 주어야 한다 — ${Object.keys(AUDITS).join(', ')}`);
    if (!(name in AUDITS)) die(`모르는 감사 ${JSON.stringify(name)} — 있는 이름: ${Object.keys(AUDITS).join(', ')}`);
    const mod = await import(new URL(AUDITS[name], `file:///${ROOT.replaceAll('\\', '/')}/`).href);
    await mod.run(rest);
}

function check(argv) {
    let picked = parse(argv, CHECKS);
    if (!picked.length) picked = Object.keys(CHECKS).filter((n) => !BY_NAME_ONLY.has(n)).map((n) => [n, []]);

    const files = [];
    let args = [];
    for (const [name, extra] of picked) {
        if (name === 'sim') {
            for (const n of extra.length ? extra : SIMS) {
                if (!SIMS.includes(n)) die(`모르는 시뮬레이터 검사 ${JSON.stringify(n)} — 있는 이름: ${SIMS.join(', ')}`);
                files.push(`tests/sim-${n}.test.mjs`);
            }
        } else {
            files.push(CHECKS[name]);
            if (extra.length) {
                // 인자는 검사 하나에만 뜻이 있다. 둘 이상에 인자를 주면 어느 쪽 것인지 흐려진다.
                if (args.length) die('인자는 검사 하나에만 줄 수 있다');
                args = extra;
            }
        }
    }
    // Vitest 는 위치 인자를 «경로에 들어 있는 글자»로 걸러 낸다. 테스트 파일 이름이 서로의 일부가
    // 되지 않게 지어야 한다 — `sim-graph.test.mjs` 는 `sim-graph-sim.test.mjs` 에 들어 있지 않다.
    const proc = spawnSync(process.execPath, [
        path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run',
        ...files,
    ], {cwd: ROOT, stdio: 'inherit', env: {...process.env, CHECK_ARGS: JSON.stringify(args)}});
    process.exit(proc.status ?? 1);
}

const [kind, ...rest] = process.argv.slice(2);
if (kind === 'check') check(rest);
else if (kind === 'audit') await audit(rest);
else die('쓰는 법 — run.mjs check|audit [이름 [인자…]]…');
