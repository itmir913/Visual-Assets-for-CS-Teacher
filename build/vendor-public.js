// npm 패키지의 브라우저 번들을 `public/vendor/`로 옮겨 둔다.
//
// **왜 public인가** — 이 라이브러리들은 전역(`Prism`, `lucide`, `Chart` …)으로 쓰인다.
// 모듈 진입점으로 바꾸면 `<script type="module">`이 defer라 **body 끝의 인라인
// 스크립트보다 늦게** 실행된다. 48개 파일이 거기서 라이브러리를 바로 부르므로
// 전부 깨진다. `public/`에 두고 클래식 스크립트로 부르면 실행 순서가 그대로다.
//
// `public/`은 저장소에 담지 않는다. 여기서 매번 새로 채우므로 node_modules와
// 어긋날 수 없다. dev 서버와 빌드 양쪽에서 돈다.
import { resolve, dirname } from 'node:path';

import { ROOT } from './units.js';

const NM = 'node_modules';
const PRISM_LANGS = ['python', 'c', 'java', 'javascript'];

/**
 * 버전은 소스가 쓰던 CDN 주소와 맞춘다. 그냥 최신을 받으면 조용히 깨진다 —
 * Font Awesome은 7에서 아이콘 이름이 바뀌고, p5는 2에서 호환이 깨진다.
 * 소스가 버전을 안 박았던 chart.js·d3·vis-network는 이제 락파일이 대신 박는다.
 */
export const VENDOR = [
    { from: `${NM}/lucide/dist/umd/lucide.min.js`, to: 'vendor/lucide.min.js' },
    { from: `${NM}/prismjs/prism.js`, to: 'vendor/prism/prism.js' },
    { from: `${NM}/prismjs/themes/prism-tomorrow.css`, to: 'vendor/prism/prism-tomorrow.css' },
    ...PRISM_LANGS.map((l) => ({
        from: `${NM}/prismjs/components/prism-${l}.min.js`,
        to: `vendor/prism/prism-${l}.min.js`,
    })),
    { from: `${NM}/chart.js/dist/chart.umd.js`, to: 'vendor/chart.js' },
    { from: `${NM}/d3/dist/d3.min.js`, to: 'vendor/d3.min.js' },
    { from: `${NM}/p5/lib/p5.min.js`, to: 'vendor/p5.min.js' },
    { from: `${NM}/ml5/dist/ml5.min.js`, to: 'vendor/ml5.min.js' },
    { from: `${NM}/vis-network/standalone/umd/vis-network.min.js`, to: 'vendor/vis-network.min.js' },
    // MathJax는 렌더링 시점에 **자기 스크립트 경로 기준으로** 글꼴을 더 받아온다.
    // 파일 하나만 옮기면 안 되고 그 상대 구조를 그대로 지켜야 한다.
    { from: `${NM}/mathjax/es5/tex-chtml.js`, to: 'vendor/mathjax/es5/tex-chtml.js' },
    { from: `${NM}/mathjax/es5/output/chtml/fonts/woff-v2`, to: 'vendor/mathjax/es5/output/chtml/fonts/woff-v2' },
];

async function sync() {
    const { cp, mkdir } = await import('node:fs/promises');
    for (const { from, to } of VENDOR) {
        const dest = resolve(ROOT, 'public', to);
        await mkdir(dirname(dest), { recursive: true });
        await cp(resolve(ROOT, from), dest, { recursive: true });
    }
}

export default function vendorPublic() {
    return {
        name: 'vendor-public',
        buildStart: sync,
        configureServer: sync,
    };
}
