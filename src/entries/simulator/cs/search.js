// 「simulator/cs/search.html」이 쓰는 것을 담는다.
//
// **이 페이지는 인라인 스크립트가 없다.** HTML은 뼈대만 두고 화면을 여기서 채운다.
//
// **여러 <script>로 쪼개어 걸지 않는다.** 릴리즈 zip을 `file://`로 열면 모듈 스크립트가
// 출처 `null` 때문에 CORS로 막힌다. 진입점 하나로 모으면 빌드가 평범한 스크립트
// 하나로 눌러 담는다 → tools/vite/classic-scripts.js

import '../../_lib/fullscreen.js';
import '../../_lib/sim-scroll.js';
import {mountFindSimulator} from '../../_lib/find/find-ui.js';

// 모듈 진입점은 파싱이 끝난 뒤 도므로 이 시점에 뼈대는 이미 DOM에 있다.
// 그래도 `readyState`를 본다 — 빌드가 이 파일을 head의 `defer` 스크립트로 바꾸기 때문이다.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountFindSimulator);
} else {
    mountFindSimulator();
}
