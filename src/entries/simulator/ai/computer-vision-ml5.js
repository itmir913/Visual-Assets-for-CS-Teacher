// 「simulator/ai/computer-vision-ml5.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 전역으로 쓰므로 window에 얹는다.
//
// **p5는 여기서 import 하지 않는다.** LGPL-2.1이라 번들에 녹이면 받은 사람이
// 라이브러리를 갈아 끼울 수 없다. 페이지가 vendor/p5/p5.min.js를 직접 <script>로
// 걸고, 그 파일은 tools/vite/vendor-public.js가 원본 그대로 실어 나른다.
// p5는 전역 모드로 도므로 window에 얹을 필요도 없다.
// 전체 화면 단추는 라이브러리가 아니라 시뮬레이터 공통 동작이라 여기서 함께 받는다.

import '../../_lib/fullscreen.js';
import '../../_lib/sim-scroll.js';
import * as ml5 from 'ml5';

window.ml5 = ml5;
