// 「정보(고등학교)/3-2-3.입력과-출력.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
//
// **폴더 이름이 `정보(고등학교)`가 아니라 `informatics`인 이유** — 폴더 이름에 괄호가
// 들어가면 번들러가 경로를 다루는 방식이 도구마다 갈린다. `subjects.json`이 과목마다
// ASCII 별명(slug)을 두는 것과 같은 이유이고, 그 slug를 그대로 쓴다.
import Prism from '../_lib/prism.js';
import 'prismjs/components/prism-python.min.js';

// 직접 부른다. Prism의 자동 하이라이팅은 `DOMContentLoaded`에 걸리는데,
// 번들된 모듈은 `document.currentScript`가 없어 그 등록이 도는지가 확실하지 않다.
Prism.highlightAll();
