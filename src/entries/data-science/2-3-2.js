// 「데이터과학/2-3-2.사과-데이터셋-탐색적-분석.html」가 쓰는 라이브러리만 담는다.
// 폴더 이름은 subjects.json 의 slug 를 쓴다 — 까닭은 src/entries/informatics 진입점에 있다.
import Prism from '../_lib/prism-python.js';

// 직접 부른다. 번들된 모듈에서는 Prism의 자동 하이라이팅이 도는지가 확실하지 않다.
Prism.highlightAll();
