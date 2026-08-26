// 「simulator/ai/search-bfs-dfs.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 전역으로 쓰므로 window에 얹는다.
// 전체 화면 버튼은 라이브러리가 아니라 시뮬레이터 공통 동작이라 여기서 함께 받는다.

import '../../_lib/fullscreen.js';
import '../../_lib/sim-scroll.js';
import {createTreeView} from '../../_lib/tree-view.js';
import {createGraphView} from '../../_lib/graph-view.js';
import * as graphModel from '../../_lib/graph-model.js';
import {GRAPH_PRESETS} from '../../_lib/graph-presets.js';
import {josa} from '../../_lib/josa.js';

window.createTreeView = createTreeView;
window.createGraphView = createGraphView;
window.GraphModel = graphModel;
window.GRAPH_PRESETS = GRAPH_PRESETS;
// 지도 이름이 「지도 5」처럼 숫자로 끝난다. 「을/를」이 그 숫자를 읽은 소리로 갈리므로
// 손으로 박아 둘 수가 없다 — 5는 「오」라서 를, 6은 「육」이라서 을이다.
window.josa = josa;
