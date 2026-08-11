// 이름이 그대로여야 하는 파일만 `public/`에 둔다.
//
// 라이브러리는 페이지별 진입점(src/entries/)에서 import 하므로 Vite가 번들에 넣는다.
// 다만 MathJax의 글꼴은 그럴 수 없다 — 실행 중에 파일 이름을 조립해서 받아오므로
// 해시된 자산으로 바꾸면 못 찾는다. Vite에서 이름을 지켜야 하는 파일의 자리가 public/ 이다.
//
// `public/`은 저장소에 담지 않는다. 여기서 매번 새로 채우므로 node_modules와
// 어긋날 수 없다. dev 서버와 빌드 양쪽에서 돈다.
import { resolve, dirname } from 'node:path';

import { ROOT } from './units.js';

const NM = 'node_modules';

/**
 * 버전은 소스가 쓰던 CDN 주소와 맞춘다. 그냥 최신을 받으면 조용히 깨진다 —
 * Font Awesome은 7에서 아이콘 이름이 바뀌고, p5는 2에서 호환이 깨진다.
 * 소스가 버전을 안 박았던 chart.js·d3·vis-network는 이제 락파일이 대신 박는다.
 */
export const VENDOR = [
    // MathJax만 남는다. 실행 중에 `${fontURL}/MathJax_Main-Regular.woff` 식으로
    // **이름을 조립해서** 글꼴을 받아오므로 해시된 자산으로 바꾸면 못 찾는다.
    // 이름이 그대로여야 하는 파일을 두는 자리가 public/ 이다.
    // JS 본체는 진입점에서 import 하므로 여기 없다.
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
