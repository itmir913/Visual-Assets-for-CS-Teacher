// 검사와 감사를 부르는 **유일한 러너.** 목록은 이 파일에만 있다.
//
//     npm run check                         모든 검사(산출물 검사 `dist` 는 뺀다)
//     npm run check -- prose html           이름을 준 것만
//     npm run check -- html 정보/1-1.….html  이름 뒤의 낱말은 그 검사에 넘긴다
//     npm run check -- sim                  시뮬레이터 동작 검사 전부
//     npm run check -- sim sort tree        그 가운데 이름을 준 것만
//     npm run check -- dist                 산출물 검사. 빌드 뒤에만 뜻이 있다
//     npm run audit -- lemma …              감사 도구 하나. 이름이 반드시 있어야 한다
//     npm run plan                          액션이 잡을 나눌 묶음을 JSON 으로 찍는다(검사는 돌리지 않는다)
//
// **검사는 Vitest 가 돈다.** 검사 하나가 `tests/` 의 테스트 파일 하나다 — 이 러너는 이름을
// 파일로 바꾸어 Vitest 에 넘기고, 이름 뒤의 인자는 `CHECK_ARGS` 로 건넨다. Vitest 는 파일 하나가
// 실패해도 **나머지를 다 돌고** 끝에 실패한 것을 모아 보인다. 한 번 돌려서 고칠 것을 다 알아야
// CI 를 한 번에 초록으로 되돌릴 수 있다.
//
// `package.json` 에 검사마다 이름을 붙여 두었더니 이름이 너무 많아졌고, 새 검사를 만들면
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
    // 첫 화면의 전 과목 검색이 쓰는 색인 — 노트가 다 들었는가 · 앵커가 있는가 · 질의 변환이 같은가
    'search-index': 'tests/search-index.test.mjs',
    'privacy': 'tests/privacy.test.mjs',
    'classes': 'tests/classes.test.mjs',
    'hover': 'tests/hover.test.mjs',
    // 페이지 HTML이 스스로 정한 CSS(<style> · style="" · 임의 색 클래스) — 모양은 클래스로만 준다
    'inline-css': 'tests/inline-css.test.mjs',
    // 격자 트랙 목록의 `fr` 옆 `auto` — 옛 사파리에서 그 트랙이 0으로 접힌다
    'grid': 'tests/grid.test.mjs',
    'code': 'tests/code.test.mjs',
    // 배부 양식(.docx)의 문항 지시문 · 체크리스트가 화면판 보고서와 같은가
    'form-sync': 'tests/form-sync.test.mjs',
    // 인공지능 기초 2-1 노트의 기계학습 단계 줄 — 여섯 단계를 다 적고 그 노트의 단계만 켠다
    'steps': 'tests/steps.test.mjs',
    // 문서 — 규칙 문서의 줄 수 상한 · 날짜 금지, 판례 · 결정 기록의 형식, 문서 안 링크
    'docs': 'tests/docs.test.mjs',
    // 글
    'html': 'tests/html.test.mjs',
    'terms': 'tests/terms.test.mjs',
    'verbs': 'tests/verbs.test.mjs',
    'prose': 'tests/prose.test.mjs',
    // 검사가 제 할 일을 하는가 — 일부러 틀리게 쓴 조각(`tests/fixtures/`)을 넣어 본다
    'fixtures': 'tests/fixtures.test.mjs',
    // 돌연변이가 아직 과녁을 겨누는가(글자만 본다 — 돌연변이를 돌리는 것은 `npm run mutate`)
    'mutate-targets': 'tests/mutate-targets.test.mjs',
    // 액션이 잡으로 나눠 돈 합이 `npm run ci` 와 같은가(아래 `ciJobs()`)
    'ci-plan': 'tests/ci-plan.test.mjs',
    // 진짜 브라우저(Chromium)에서 잰 화면 — 겹침 · 넘침 · 닿지 않는 조작
    'layout': 'tests/browser/sim-layout.test.mjs',
    // 다크 테마 — 토글이 도는가 · 글자가 AAA 대비를 넘는가 · 밝은 칸이 남지 않았는가(진짜 브라우저)
    'dark': 'tests/browser/dark.test.mjs',
    // 강의노트 차례 메뉴 — 데스크톱에서 한 줄에 드는가(진짜 브라우저)
    'nav': 'tests/browser/nav.test.mjs',
    // 첫 화면의 전 과목 찾기 — 폰 폭 · 결과 줄 · 띄어쓰기 · 과목 좁히기(진짜 브라우저)
    'search': 'tests/browser/search.test.mjs',
    // 시뮬레이터 동작 — 아래 SIMS 표를 차례로 돈다. 뒤에 SIMS 의 이름을 주면 그것만.
    'sim': null,
    // 산출물. 빌드가 있어야 하므로 기본 목록에서 빠지고 이름으로만 부른다.
    'dist': 'tests/dist.test.mjs',
};

// 시뮬레이터 동작 검사. `check -- sim [이름…]` 으로만 부른다 — 이름이 많아
// 최상위에 늘어놓으면 `sim` 과 `sims` 처럼 헷갈리는 이름이 생긴다(실제로 생겼다).
// 테스트 파일은 `tests/sim-<이름>.test.mjs` 다.
const SIMS = [
    // 모든 페이지 공통 — 뜨는가 · 캔버스 배율 · on* 핸들러가 가리키는 것이 있는가
    'pages', 'fullscreen',
    // 페이지마다
    'graph', 'graph-sim', 'heuristic-tree', 'search-tabs', 'puzzle', 'sort', 'ordering', 'ds', 'tree', 'find', 'compress',
    'least-squares', 'deep-learning', 'wumpus', 'nqueen', 'hanoi', 'river', 'decision-tree',
    'knn', 'logistic', 'svm', 'multiple-regression', 'gridworld', 'bandit', 'kmeans', 'vision',
];

// 이름으로만 부르는 검사. `npm run ci` 가 빌드 뒤에 따로 부른다.
export const BY_NAME_ONLY = new Set(['dist']);

// 이름으로만 부르는 시뮬레이터 검사 — `check -- sim` 을 이름 없이 부르면(= `npm run ci`) 빠진다.
// `sort` 는 한 번에 몇 분이 걸린다(큰 배열 화면 · n=64 비교 장). 정렬 로직을 건드리는 일은 드물어
// 매번 `ci` 에서 기다릴 까닭이 없다(사용자가 정함). 단계 불변식 · 세는 값 · 화면 문장은
// 빠른 `ordering` 이 `ci` 에서 지킨다. **정렬을 고쳤으면 `npm run check -- sim sort` 를 손으로 돌린다.**
const SIM_BY_NAME_ONLY = new Set(['sort']);

// 감사 도구 — 판정이 아니라 사람이 읽을 목록을 내놓는다. `ci` 에 넣지 않는다.
const AUDITS = {
    pre: 'tools/audits/pre.mjs',
    svg: 'tools/audits/svg.mjs',
    // CSS를 옮기기 전후의 계산된 스타일 견주기(save → 고친다 → diff)
    styles: 'tools/audits/styles.mjs',
    narrow: 'tools/audits/narrow.mjs',
    josa: 'tools/audits/josa.mjs',
    lemma: 'tools/audits/lemma.mjs',
    // 시뮬레이터 화면을 찍어 사람이 본다(판정 없음)
    shots: 'tools/audits/shots.mjs',
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

/**
 * `check` 에 준 낱말 → Vitest 에 넘길 테스트 파일과 검사에 건넬 인자.
 * **`check` 와 `plan` 이 같은 길로 간다** — 묶음의 합이 한 줄로 돈 것과 같은지를
 * `check -- ci-plan` 이 이 함수로 견준다.
 */
export function filesFor(argv) {
    let picked = parse(argv, CHECKS);
    if (!picked.length) picked = Object.keys(CHECKS).filter((n) => !BY_NAME_ONLY.has(n)).map((n) => [n, []]);

    const files = [];
    let args = [];
    for (const [name, extra] of picked) {
        if (name === 'sim') {
            for (const n of extra.length ? extra : SIMS.filter((s) => !SIM_BY_NAME_ONLY.has(s))) {
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
    return {files, args};
}

function check(argv) {
    const {files, args} = filesFor(argv);
    // Vitest 는 위치 인자를 «경로에 들어 있는 글자»로 걸러 낸다. 테스트 파일 이름이 서로의 일부가
    // 되지 않게 지어야 한다 — `sim-graph.test.mjs` 는 `sim-graph-sim.test.mjs` 에 들어 있지 않다.
    const proc = spawnSync(process.execPath, [
        path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run',
        ...files,
    ], {cwd: ROOT, stdio: 'inherit', env: {...process.env, CHECK_ARGS: JSON.stringify(args)}});
    process.exit(proc.status ?? 1);
}

// 액션이 **잡을 나누는 데 쓰는 묶음.** 러너에서는 벽시계가 합이 아니라 가장 긴 묶음이 되고,
// 사람이 치는 입구는 그대로 `npm run ci` 한 줄이다(그쪽은 묶음을 모르고 전부를 차례로 돈다).
//
// **이름을 늘어놓지 않고 규칙으로 가른다** — 새 검사를 `CHECKS` 에 더하면 저절로 어느 묶음에
// 들어가므로 워크플로 파일은 고칠 것이 없다. 묶음의 합이 `npm run check` 와 같은지,
// 워크플로가 이 묶음을 실제로 부르는지는 `check -- ci-plan` 이 지킨다.
//
//   static            정적 검사 — 다 합쳐도 짧다
//   layout · dark     진짜 브라우저가 필요한 검사. **하나가 곧 한 잡이다**(둘 다 오래 걸린다).
//                     이 잡만 Chromium 을 깐다
//   sim-<이름>        혼자 한 잡을 차지할 만큼 오래 걸리는 시뮬레이터 검사(`SIM_HEAVY`)
//   sim-1 · sim-2 …   나머지 시뮬레이터 검사를 `SIM_SHARDS` 개로 돌려 가며 나눈다
//
// **파일 하나는 더 나뉘지 않는다** — 가장 오래 걸리는 검사 하나가 벽시계의 바닥이다.
// 묶음을 늘려도 잡마다 checkout · 의존성 설치를 다시 하므로, 가른 만큼 그대로 빨라지지는 않는다.
const SIM_SHARDS = 2;

// 혼자 한 잡을 차지할 시뮬레이터 검사. **고르게 나누기 위한 눈금일 뿐**이라, 낡아도 러너는
// 같은 것을 다 돌고 벽시계만 나빠진다. 다시 재려면 `npm run check -- sim <이름>` 을 하나씩 돌려 견준다.
export const SIM_HEAVY = new Set(['nqueen', 'gridworld', 'least-squares', 'deep-learning', 'compress', 'pages']);

export function ciJobs() {
    const named = Object.keys(CHECKS).filter((n) => n !== 'sim' && !BY_NAME_ONLY.has(n));
    const isBrowser = (n) => CHECKS[n].startsWith('tests/browser/');
    const sims = SIMS.filter((s) => !SIM_BY_NAME_ONLY.has(s));
    const jobs = [['static', named.filter((n) => !isBrowser(n)), false]];
    for (const n of named.filter(isBrowser)) jobs.push([n, [n], true]);
    for (const n of sims.filter((s) => SIM_HEAVY.has(s))) jobs.push([`sim-${n}`, ['sim', n], false]);
    const light = sims.filter((s) => !SIM_HEAVY.has(s));
    for (let i = 0; i < SIM_SHARDS; i++) {
        const mine = light.filter((_, j) => j % SIM_SHARDS === i);
        if (mine.length) jobs.push([`sim-${i + 1}`, ['sim', ...mine], false]);
    }
    return jobs.filter(([, names]) => names.length).map(([job, names, browser]) => ({job, args: names.join(' '), browser}));
}

const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
    const [kind, ...rest] = process.argv.slice(2);
    if (kind === 'check') check(rest);
    else if (kind === 'audit') await audit(rest);
    // 액션의 매트릭스가 그대로 받아 쓴다 — `{include:[…]}` 한 줄이어야 한다.
    else if (kind === 'plan') console.log(JSON.stringify({include: ciJobs()}));
    else die('쓰는 법 — run.mjs check|audit [이름 [인자…]]… | plan');
}
