// CDN에서 받던 자산을 npm 패키지에서 가져다 쓴다.
//
// 빌드에 네트워크가 필요 없어지고 **버전이 락파일에 고정된다.** CDN을 막는 학교망에서
// 사이트가 도는 것이 로컬화의 원래 목적이므로, 이 단계까지 와야 그 목적이 선다.
//
// **버전은 소스에 적힌 CDN 주소와 맞춘다.** 그냥 최신을 받으면 조용히 깨진다 —
// Font Awesome은 7에서 아이콘 이름이 바뀌고, p5는 2에서 호환이 깨진다.
// 소스가 버전을 안 박은 것(chart.js·d3·vis-network)은 이제 락파일이 대신 박아 준다.
import { dirname, resolve } from 'node:path';

import { ROOT, relPath, unitOf, upToRoot } from './units.js';

const NM = 'node_modules';
const PRISM_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0';
const PRISM_LANGS = ['python', 'c', 'java', 'javascript'];

/** node_modules에서 dist로 그대로 옮길 것. 폴더면 통째로 옮긴다. */
export const VENDOR = [
    // 글꼴 둘은 CSS가 **자기 폴더 기준 상대경로**로 글꼴을 참조한다.
    // 그래서 폴더 구조를 그대로 옮겨야 한다.
    { from: `${NM}/@fortawesome/fontawesome-free/css/all.min.css`, to: 'assets/vendor/fontawesome/css/all.min.css' },
    { from: `${NM}/@fortawesome/fontawesome-free/webfonts`, to: 'assets/vendor/fontawesome/webfonts' },
    { from: `${NM}/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css`, to: 'assets/vendor/pretendard/pretendardvariable-dynamic-subset.css' },
    { from: `${NM}/pretendard/dist/web/variable/woff2-dynamic-subset`, to: 'assets/vendor/pretendard/woff2-dynamic-subset' },

    { from: `${NM}/lucide/dist/umd/lucide.min.js`, to: 'assets/vendor/lucide/lucide.min.js' },
    { from: `${NM}/prismjs/prism.js`, to: 'assets/vendor/prism/prism.js' },
    { from: `${NM}/prismjs/themes/prism-tomorrow.css`, to: 'assets/vendor/prism/prism-tomorrow.css' },
    ...PRISM_LANGS.map((l) => ({
        from: `${NM}/prismjs/components/prism-${l}.min.js`,
        to: `assets/vendor/prism/components/prism-${l}.min.js`,
    })),

    { from: `${NM}/chart.js/dist/chart.umd.js`, to: 'assets/vendor/chart.js' },
    { from: `${NM}/d3/dist/d3.min.js`, to: 'assets/vendor/d3.min.js' },
    { from: `${NM}/p5/lib/p5.min.js`, to: 'assets/vendor/p5.min.js' },
    { from: `${NM}/ml5/dist/ml5.min.js`, to: 'assets/vendor/ml5.min.js' },
    { from: `${NM}/vis-network/standalone/umd/vis-network.min.js`, to: 'assets/vendor/vis-network.min.js' },

    // MathJax는 렌더링 시점에 **자기 스크립트 경로 기준으로** 글꼴을 더 받아온다.
    // 파일 하나만 옮기면 안 되고 그 상대 구조를 그대로 지켜야 한다.
    { from: `${NM}/mathjax/es5/tex-chtml.js`, to: 'assets/vendor/mathjax/es5/tex-chtml.js' },
    { from: `${NM}/mathjax/es5/output/chtml/fonts/woff-v2`, to: 'assets/vendor/mathjax/es5/output/chtml/fonts/woff-v2' },
];

/** 소스에 적힌 CDN 주소 → 옮겨 놓은 자리. 값은 dist 루트 기준 상대경로다. */
export const CDN_MAP = {
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css':
        'assets/vendor/fontawesome/css/all.min.css',
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css':
        'assets/vendor/pretendard/pretendardvariable-dynamic-subset.css',
    // unpkg는 경로 없는 주소를 패키지의 unpkg 필드로 푼다 — 1.28.0에서 이 파일이다.
    'https://unpkg.com/lucide@1.28.0': 'assets/vendor/lucide/lucide.min.js',
    // npm 패키지에는 min이 없다. 압축 여부만 다르고 내용은 같다.
    [`${PRISM_CDN}/prism.min.js`]: 'assets/vendor/prism/prism.js',
    [`${PRISM_CDN}/themes/prism-tomorrow.min.css`]: 'assets/vendor/prism/prism-tomorrow.css',
    ...Object.fromEntries(PRISM_LANGS.map((l) => [
        `${PRISM_CDN}/components/prism-${l}.min.js`,
        `assets/vendor/prism/components/prism-${l}.min.js`,
    ])),
    'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js':
        'assets/vendor/mathjax/es5/tex-chtml.js',
    'https://cdn.jsdelivr.net/npm/chart.js': 'assets/vendor/chart.js',
    'https://d3js.org/d3.v7.min.js': 'assets/vendor/d3.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js': 'assets/vendor/p5.min.js',
    'https://unpkg.com/ml5@1.3.1/dist/ml5.min.js': 'assets/vendor/ml5.min.js',
    'https://unpkg.com/vis-network/standalone/umd/vis-network.min.js': 'assets/vendor/vis-network.min.js',
};

export default function vendorAssets() {
    return {
        name: 'vendor-assets',
        apply: 'build',
        async writeBundle(options) {
            const { cp, mkdir } = await import('node:fs/promises');
            for (const { from, to } of VENDOR) {
                const dest = resolve(options.dir, to);
                await mkdir(dirname(dest), { recursive: true });
                await cp(resolve(ROOT, from), dest, { recursive: true });
            }
        },
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                const rel = relPath(ctx);
                if (!unitOf(rel)) return html;
                const prefix = upToRoot(rel);
                for (const [url, local] of Object.entries(CDN_MAP)) {
                    html = html.split(url).join(prefix + local);
                }
                return html;
            },
        },
    };
}
