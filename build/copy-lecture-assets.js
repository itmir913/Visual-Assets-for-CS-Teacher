// 강의노트 옆 `code/`의 .py·.c 같은 딸림 파일을 산출물로 옮긴다.
//
// 코드는 화면에 보이기만 하는 것이 아니라 **학생이 내려받아 실행하는 파일**이라
// 오프라인 zip에도 들어가야 한다.
//
// .html은 Vite가 굽고 .docx는 생성기가 따로 만들므로 여기서는 건너뛴다.
import { dirname, resolve } from 'node:path';

import { ROOT, UNITS } from './units.js';

const SKIP = /\.(html|docx)$/i;

export default function copyLectureAssets() {
    return {
        name: 'copy-lecture-assets',
        apply: 'build',
        async writeBundle(options) {
            const { cp, mkdir, glob } = await import('node:fs/promises');
            let n = 0;
            for (const u of UNITS) {
                if (!u.dir) continue;
                for await (const f of glob(`${u.dir}/**/*`, { cwd: ROOT, withFileTypes: true })) {
                    if (!f.isFile()) continue;
                    const rel = `${f.parentPath ?? f.path}/${f.name}`
                        .replace(ROOT, '')
                        .replace(/^[\\/]/, '')
                        .replace(/\\/g, '/');
                    if (SKIP.test(rel)) continue;
                    const dest = resolve(options.dir, rel);
                    await mkdir(dirname(dest), { recursive: true });
                    await cp(resolve(ROOT, rel), dest);
                    n += 1;
                }
            }
            if (n) this.info(`강의노트 딸림 파일 ${n}개 복사`);
        },
    };
}
