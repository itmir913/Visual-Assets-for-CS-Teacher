// 「simulator/ai/supervised-decision-tree.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 전역으로 쓰므로 window에 얹는다.
// 전체 화면 단추는 라이브러리가 아니라 시뮬레이터 공통 동작이라 여기서 함께 받는다.

import '../../_lib/canvas-dpr.js';
import '../../_lib/fullscreen.js';
import '../../_lib/sim-scroll.js';
import {createTreeView} from '../../_lib/tree-view.js';
import {josa} from '../../_lib/josa.js';

window.createTreeView = createTreeView;
// 질문 라벨과 분류 결과에 과일 이름·특성 이름이 들어간다 — 「색깔이」와 「크기가」,
// 「수박으로」와 「사과로」가 갈리므로 손으로 적을 수가 없다.
window.josa = josa;
