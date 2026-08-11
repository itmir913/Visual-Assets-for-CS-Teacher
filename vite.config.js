// 페이지 146개를 굽는 다중 진입점(MPA) 설정.
//
// **소스 HTML은 한 줄도 고치지 않는다.** 소스는 지금처럼 Tailwind CDN을 그대로 두고,
// 빌드가 그 <script>를 걷어낸 자리에 구워 놓은 스타일시트를 꽂는다. 나머지 CDN 자산도
// npm 패키지에서 가져다 놓고 주소만 바꿔친다.
//
// 이 파일은 **조립만** 한다. 실제로 하는 일은 build/ 밑에 하나씩 나뉘어 있다.
//
//   build/units.js               무엇을 굽는가 (subjects.json을 읽는다)
//   build/inject-code.js         data-src 마커 자리에 실파일의 코드를 넣는다
//   build/tailwind-swap.js       Tailwind CDN <script> → 구워진 스타일시트
//   build/vendor-assets.js       CDN 자산 → npm 패키지
//   build/copy-lecture-assets.js 강의노트 딸림 파일(.py·.c)을 산출물로
//   build/strip-crossorigin.js   원본에 없던 속성 제거
import { resolve } from 'node:path';

import { ROOT, UNITS } from './build/units.js';
import injectCode from './build/inject-code.js';
import tailwindSwap from './build/tailwind-swap.js';
import vendorAssets from './build/vendor-assets.js';
import copyLectureAssets from './build/copy-lecture-assets.js';
import stripCrossorigin from './build/strip-crossorigin.js';

/** 진입점 — 페이지 전부 + 단위별 CSS. */
const { glob } = await import('node:fs/promises');
const input = {};
for (const u of UNITS) {
    input[`style-${u.slug}`] = resolve(ROOT, `src/styles/${u.slug}.css`);
    if (u.file) {
        input[u.file] = resolve(ROOT, u.file);
        continue;
    }
    const files = [];
    for await (const f of glob(`${u.dir}/**/*.html`, { cwd: ROOT })) files.push(f);
    for (const f of files.sort()) input[f.replace(/\\/g, '/')] = resolve(ROOT, f);
}

export default {
    root: ROOT,
    base: './',
    // 포트를 못 박지 않는다. 다른 것이 쓰고 있으면 환경변수로 넘겨받는다.
    server: { port: Number(process.env.PORT) || 5173 },
    plugins: [
        // 코드 주입이 먼저다 — 넣은 코드가 나중 단계의 치환에 걸리지 않도록
        // 순서를 pre로 두었다.
        injectCode(),
        tailwindSwap(),
        vendorAssets(),
        copyLectureAssets(),
        stripCrossorigin(),
    ],
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        rollupOptions: {
            input,
            output: { assetFileNames: 'assets/[name]-[hash][extname]' },
        },
    },
};
