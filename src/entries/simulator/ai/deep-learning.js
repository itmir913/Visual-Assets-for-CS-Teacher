// 「simulator/ai/deep-learning.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 `window.Chart`로 쓴다 — 전역에 얹는 일은 `_lib/chartjs.js`가 한다.
// 전체 화면 버튼은 라이브러리가 아니라 시뮬레이터 공통 동작이라 여기서 함께 받는다.

import '../../_lib/canvas-dpr.js';
import '../../_lib/fullscreen.js';
import '../../_lib/sim-scroll.js';
import '../../_lib/chartjs.js';

