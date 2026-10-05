// 시뮬레이터 화면을 찍어 사람이 눈으로 본다 — **판정하지 않는다.**
//
//     npm run audit -- shots                 dist-shots/ 에 찍는다
//     npm run audit -- shots dist-shots/새   폴더를 정한다(저장소 안이어야 한다 — Vite 가 바깥 쓰기를 막는다)
//
// 실제로 찍는 것은 진짜 브라우저다 → tests/browser/shots.test.mjs(무엇을 어떤 폭으로 찍는지가 거기 있다).
// **ci 에 넣지 않는다** — 「그림이 화면을 넉넉히 쓰는가 · 보기 좋은가」는 기계가 판정할 수 없다.
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {ROOT} from '../lib/repo.mjs';

export function run(argv) {
    const out = argv[0] || 'dist-shots';
    const proc = spawnSync(process.execPath, [
        path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', '--project', 'browser',
        'tests/browser/shots.test.mjs',
    ], {
        cwd: ROOT, stdio: 'inherit',
        env: {...process.env, VITE_SHOTS: out},
    });
    process.exitCode = proc.status ?? 1;
}
