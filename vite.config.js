// 페이지마다 하나씩 굽는 다중 진입점(MPA) 설정. 무엇을 굽는지는 subjects.json이 정한다.
//
// **소스 HTML은 CDN을 쓰지 않는다.** 스타일은 `/src/styles/<단위>.css` 하나를 링크하고,
// 그 CSS가 Tailwind와 글꼴·아이콘을 npm에서 `@import` 한다. Vite가 글꼴 파일까지 함께
// 묶어 해시된 자산으로 내보낸다.
//
// JS 라이브러리는 **페이지별 진입점(`src/entries/`)에서 import** 한다. 전역으로 쓰는
// 것이면 거기서 `window`에 얹는다. `public/`에 남는 것은 MathJax 글꼴뿐이다 —
// 실행 중에 이름을 조립해 받아오므로 해시된 자산으로 바꾸면 못 찾는다.
//
// **모듈은 defer라 body 끝의 인라인 스크립트보다 늦게 돈다.** 인라인이 최상위에서
// 라이브러리를 바로 부르면 ReferenceError로 죽고 기다려도 낫지 않는다 → load 핸들러로 감싼다.
//
// **빌드 설정은 이 파일 하나다.** CSS 파이프라인도 여기 있고 postcss.config.js는 두지 않는다.
// 이 파일은 **조립만** 한다. 실제로 하는 일은 tools/vite/ 밑에 하나씩 나뉘어 있다.
//
//   tools/vite/units.js               무엇을 굽는가 (subjects.json을 읽는다)
//   tools/vite/inject-code.js         data-src 마커 자리에 실파일의 코드를 넣는다
//   tools/vite/vendor-public.js       이름이 그대로여야 하는 파일(MathJax 글꼴)만 public/으로
//   tools/vite/copy-lecture-assets.js 강의노트 딸림 파일(.py·.c)을 산출물로
//   tools/vite/strip-crossorigin.js   원본에 없던 속성 제거
//   tools/vite/copy-code-button.js    코드 블록마다 복사 버튼을 얹는다
//   tools/vite/drop-ttf-fallback.js   아무도 받지 않는 ttf 대체 경로를 지운다 (PostCSS)
//   tools/vite/subset-icon-font.js    아이콘 폰트를 실제로 쓰는 글자만 남기고 깎는다
import { resolve } from 'node:path';

import autoprefixer from 'autoprefixer';
import tailwindcss from 'tailwindcss';

import { ROOT, UNITS } from './tools/vite/units.js';
import injectCode from './tools/vite/inject-code.js';
import vendorPublic from './tools/vite/vendor-public.js';
import copyLectureAssets from './tools/vite/copy-lecture-assets.js';
import stripCrossorigin from './tools/vite/strip-crossorigin.js';
import copyCodeButton from './tools/vite/copy-code-button.js';
import dropTtfFallback from './tools/vite/drop-ttf-fallback.js';
import subsetIconFont from './tools/vite/subset-icon-font.js';

/**
 * 진입점 — 페이지 전부.
 * CSS는 넣지 않는다. HTML이 직접 링크하므로 Vite가 스캔해서 알아서 묶는다.
 */
const { glob } = await import('node:fs/promises');
const input = {};
for (const u of UNITS) {
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
    // CSS 파이프라인. 별도 postcss.config.js를 두지 않는다 — 빌드 설정은 이 파일 하나다.
    // 단위별 설정은 각 CSS가 @config 로 자기 것을 가리키므로 여기 base는 기본값일 뿐이다.
    css: {
        postcss: {
            plugins: [
                tailwindcss({ config: resolve(ROOT, 'src/tailwind/base.config.js') }),
                autoprefixer(),
                // 자산으로 굽히기 전에 지워야 한다 — 참조가 남으면 파일도 남는다.
                dropTtfFallback(),
            ],
        },
    },
    plugins: [
        // 코드 주입이 먼저다 — 넣은 코드가 나중 단계의 치환에 걸리지 않도록.
        injectCode(),
        // 주입이 끝난 뒤에 감싼다 — 주입된 코드에도 버튼이 붙어야 한다.
        copyCodeButton(),
        vendorPublic(),
        copyLectureAssets(),
        stripCrossorigin(),
        // 마지막이다 — 최종 HTML을 봐야 어떤 아이콘을 쓰는지 알 수 있다.
        subsetIconFont(),
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
