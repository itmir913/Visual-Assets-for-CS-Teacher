// **번들에 녹이면 안 되는 파일**만 `public/`에 둔다.
//
// 라이브러리는 페이지별 진입점(src/entries/)에서 import 하므로 Vite가 번들에 넣는다.
// 여기 남는 것은 **번들에 녹이면 안 되는 것**뿐이고, 이유는 둘이다 — 이름이 그대로여야
// 하거나(MathJax 글꼴), 라이선스가 그것을 요구하거나(p5는 LGPL-2.1)다.
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
    // MathJax 글꼴. 실행 중에 `${fontURL}/MathJax_Main-Regular.woff` 식으로
    // **이름을 조립해서** 받아오므로 해시된 자산으로 바꾸면 못 찾는다.
    // JS 본체는 진입점에서 import 하므로 여기 없다.
    { from: `${NM}/mathjax/es5/output/chtml/fonts/woff-v2`, to: 'vendor/mathjax/es5/output/chtml/fonts/woff-v2' },

    // p5는 **LGPL-2.1이라 번들에 녹이지 않는다.** LGPL은 받은 사람이 라이브러리를
    // 고쳐 **다시 링크할 수 있을 것**을 요구하는데, 미니파이된 청크에 녹아 있으면
    // 그럴 수가 없다. 원본 그대로 실어 두면 이 파일만 갈아 끼우면 된다.
    // 전문도 옆에 함께 둔다 — 「라이선스를 동봉하라」는 LGPL·OFL 공통 요구다.
    // 쓰는 페이지는 computer-vision-ml5 하나뿐이고, 그 페이지가 직접 <script>로 건다.
    { from: `${NM}/p5/lib/p5.min.js`, to: 'vendor/p5/p5.min.js' },
    { from: `${NM}/p5/license.txt`, to: 'vendor/p5/LICENSE.txt' },
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
