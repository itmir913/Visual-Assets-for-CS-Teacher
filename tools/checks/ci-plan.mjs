// 액션이 `npm run ci` 를 잡 여럿으로 나눠 돌린다. **나눈 합이 한 줄로 돈 것과 같은가.**
//
// 나누면 조각이 조용히 빠질 수 있다 — 빠진 조각은 아무도 빨간불을 켜 주지 않으므로
// 「러너가 초록이니 괜찮다」가 뜻을 잃는다. 묶음(`tools/run.mjs` 의 `ciJobs()`)과
// 전부 돌리기(`npm run check`)를 **같은 함수(`filesFor`)로 테스트 파일 목록까지 풀어** 맞대어 본다.
//
//   1. 모든 검사가 어느 한 묶음에 **꼭 한 번** 들어간다(빠짐도 겹침도 없다).
//   2. 묶음에만 있고 `npm run check` 는 돌리지 않는 검사가 없다 — 로컬 초록과 러너 초록이 갈린다.
//   3. 브라우저 깃발이 내용과 맞다. 꺼진 묶음에 브라우저 검사가 들면 러너에 Chromium 이 없어 깨진다.
//   4. 워크플로가 **그 묶음을 실제로 부른다** — 매트릭스 · 빌드 · 산출물 검사를 `npm run` 이름으로.
//   5. 워크플로가 스크립트 경로를 직접 치지 않는다. 명령을 정하는 곳은 `package.json` 하나다.
//   6. 끊기 설정(`concurrency`)이 잡이 아니라 워크플로에 걸려 있다 — 잡에 걸면 형제 잡끼리 서로를 끊는다.
//   7. 설치(`npm ci`)가 감사를 부르지 않는다(`--no-audit`). 두 워크플로를 다 본다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report} from '../lib/repo.mjs';
import {BY_NAME_ONLY, SIM_HEAVY, ciJobs, filesFor} from '../run.mjs';

const WF = '.github/workflows/ci.yml';
const INSTALLERS = [WF, '.github/workflows/deploy.yml'];

export function check() {
    const r = new Report('check_ci-plan');
    const jobs = ciJobs();
    const of = (job) => filesFor(job.args.split(' ')).files;

    const whole = filesFor([]).files;
    const split = jobs.flatMap(of);
    for (const f of new Set(split.filter((f, i) => split.indexOf(f) !== i))) {
        r.error(`  ✗ ${f} 가 묶음 둘 이상에 들어 있다 — 같은 검사를 두 번 돈다`);
    }
    for (const f of whole) {
        if (!split.includes(f)) r.error(`  ✗ ${f} 가 어느 묶음에도 없다 — 러너에서 영영 돌지 않는다`);
    }
    for (const f of split) {
        if (!whole.includes(f)) r.error(`  ✗ ${f} 는 묶음에만 있다 — \`npm run check\` 가 돌리지 않으니 로컬 초록과 러너 초록이 갈린다`);
    }
    for (const job of jobs) {
        const browser = of(job).filter((f) => f.startsWith('tests/browser/'));
        if (browser.length && !job.browser) {
            r.error(`  ✗ 묶음 ${job.job}: 브라우저 검사(${browser.join(', ')})가 들었는데 browser 깃발이 꺼져 있다 — 러너가 Chromium 을 깔지 않는다`);
        }
        if (!browser.length && job.browser) {
            r.error(`  ✗ 묶음 ${job.job}: 브라우저 검사가 없는데 browser 깃발이 켜져 있다 — 쓰지 않는 Chromium 을 깐다`);
        }
        r.note(`묶음 ${job.job}: ${of(job).length}개${job.browser ? ' (Chromium)' : ''}`);
    }

    // 무거운 검사 목록의 이름이 실제로 도는 검사인가. 틀린 이름은 조용히 아무 일도 하지 않아
    // 묶음이 다시 기울고(러너는 같은 것을 다 돌므로 빨간불이 켜지지 않는다) 아무도 알아채지 못한다.
    for (const n of SIM_HEAVY) {
        if (!jobs.some((j) => j.job === `sim-${n}`)) r.error(`  ✗ SIM_HEAVY 의 ${JSON.stringify(n)} 은 ci 에서 도는 시뮬레이터 검사가 아니다 — 이름을 잘못 적었거나 그 검사가 없어졌다`);
    }

    // **실제로 도는 줄(`run:`)만 본다.** 주석과 `name:` 에도 같은 명령이 글로 적혀 있어,
    // 파일 전체를 글자로 뒤지면 「이름에는 있고 돌지는 않는」 꼴을 놓친다.
    const wf = fs.readFileSync(path.join(ROOT, WF), 'utf8');
    const runs = [...wf.matchAll(/^\s*run:[ \t]*(.+)$/gm)].map((m) => m[1]).join('\n');
    const wants = [
        ['npm run --silent plan', '묶음을 받아 오는 자리'],
        ['npm run check -- ${{ matrix.args }}', '묶음을 돌리는 자리'],
        ['npm run build', '빌드'],
        ...[...BY_NAME_ONLY].map((n) => [`npm run check -- ${n}`, `이름으로만 부르는 검사 ${n}`]),
    ];
    for (const [cmd, what] of wants) {
        if (!runs.includes(cmd)) r.error(`  ✗ ${WF} 에 ${what}가 없다 — 도는 줄에 \`${cmd}\` 가 있어야 한다`);
    }
    if (/node tools\//.test(runs)) {
        r.error(`  ✗ ${WF} 가 스크립트 경로를 직접 친다 — 명령은 package.json 의 이름으로만 부른다`);
    }
    // 주석에 적힌 것은 치지 않는다 — 설정 줄로 있어야 한다.
    if (!/^\s*fail-fast:\s*false\s*$/m.test(wf)) {
        r.error(`  ✗ ${WF} 에 fail-fast: false 가 없다 — 한 묶음이 빨간불이면 나머지가 끊겨 고칠 것을 한 번에 알 수 없다`);
    }
    const [head, tail = ''] = wf.split('\njobs:');
    if (!/\nconcurrency:/.test(head)) r.error(`  ✗ ${WF} 에 워크플로 차원의 concurrency 가 없다 — 잇달아 푸시하면 앞엣것이 남아 돈다`);
    if (/\n {2,}concurrency:/.test(tail)) r.error(`  ✗ ${WF} 가 잡에 concurrency 를 걸었다 — 같은 이름이면 형제 잡끼리 서로를 끊는다`);

    // 설치는 감사를 부르지 않는다. 의존성 경보는 Dependabot 이 따로 맡고 있고, 검사의 판정과 상관이 없다.
    // **배포 워크플로까지 본다** — 설치는 거기서도 돈다.
    for (const rel of INSTALLERS) {
        const text = fs.readFileSync(path.join(ROOT, rel), 'utf8');
        for (const [, cmd] of text.matchAll(/^\s*run:[ \t]*(npm ci\b.*)$/gm)) {
            if (!cmd.includes('--no-audit')) r.error(`  ✗ ${rel}: \`${cmd}\` 에 --no-audit 이 없다 — 설치마다 감사를 기다린다(경보는 Dependabot 이 맡는다)`);
        }
    }

    const scripts = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
    if (!scripts.plan) r.error('  ✗ package.json 에 plan 스크립트가 없다 — 워크플로가 묶음을 받아 올 길이 없다');

    return r.done(`완료 — 묶음 ${jobs.length}, 검사 ${whole.length}, 위반 ${r.errors.length}`);
}
