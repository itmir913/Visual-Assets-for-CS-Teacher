// 「프로그래밍/기초/1-2.프로그래밍-언어의-종류와-특징.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 이 페이지는 언어별 생김새를 나란히 보여 주므로 두 문법을 함께 싣는다.
import Prism from '../../_lib/prism.js';
import 'prismjs/components/prism-c.min.js';
import 'prismjs/components/prism-python.min.js';

// 직접 부른다. Prism의 자동 하이라이팅은 `DOMContentLoaded`에 걸리는데,
// 번들된 모듈은 `document.currentScript`가 없어 그 등록이 도는지가 확실하지 않다.
// 모듈 진입점은 파싱이 끝난 뒤 도므로 이 시점에 코드 블록은 이미 DOM에 있다
// (코드는 런타임 fetch가 아니라 빌드가 넣는다).
Prism.highlightAll();
