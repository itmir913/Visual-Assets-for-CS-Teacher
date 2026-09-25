// 「인공지능기초/3-1-1.인공지능의-발전과-사회-변화.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
import Prism from '../_lib/prism-python.js';

// 직접 부른다. Prism의 자동 하이라이팅은 `DOMContentLoaded`에 걸리는데,
// 번들된 모듈은 `document.currentScript`가 없어 그 등록이 도는지가 확실하지 않다.
Prism.highlightAll();
