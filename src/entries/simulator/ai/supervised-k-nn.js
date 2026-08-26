// 「simulator/ai/supervised-k-nn.html」의 진입점.
// 이 페이지는 외부 라이브러리를 쓰지 않는다 — 시뮬레이터 공통 동작만 받는다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 전역으로 쓰므로 window에 얹는다.

import '../../_lib/canvas-dpr.js';
import '../../_lib/fullscreen.js';
import '../../_lib/sim-scroll.js';
import {josa} from '../../_lib/josa.js';

// K값이 1·3·5…29로 바뀌므로 「로/으로」가 값마다 갈린다 — 3은 「삼」이라 으로, 5는 「오」라 로다.
window.josa = josa;
