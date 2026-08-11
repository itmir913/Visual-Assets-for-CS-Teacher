// 「프로그래밍(C)/2-4.제어문-3-중첩제어구조.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 전역으로 쓰므로 window에 얹는다.

import { createIcons, icons } from 'lucide';
import '../_lib/prism.js';
import 'prismjs/components/prism-c.min.js';

// npm 판의 createIcons는 아이콘 목록을 인자로 받는다. CDN 판(UMD)은 받지 않았다.
// 인라인 스크립트는 전부 `lucide.createIcons()`로 부르므로 그 모양을 지켜 준다.
window.lucide = { createIcons: (opts = {}) => createIcons({ icons, ...opts }) };
