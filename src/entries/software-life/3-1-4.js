// 「소프트웨어와생활/3-1-4.표로-된-데이터-다루기.html」가 쓰는 라이브러리만 담는다.
// 폴더 이름은 subjects.json 의 slug 를 쓴다 — 까닭은 src/entries/informatics 진입점에 있다.
import Prism from '../_lib/prism-python.js';

// 직접 부른다. 번들된 모듈에서는 Prism의 자동 하이라이팅이 도는지가 확실하지 않다.
Prism.highlightAll();
