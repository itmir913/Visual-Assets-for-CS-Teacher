// Prism을 전역에 올린다. **언어 확장보다 먼저 평가되어야 한다.**
//
// 언어 파일(prism-python.min.js 등)은 전역 `Prism`에 문법을 얹는 방식이라,
// 그것이 평가될 때 이미 전역이 서 있어야 한다. ES 모듈은 import 그래프 순서대로
// 평가되므로 본체를 먼저 받으면 된다.
//
// **이 파일을 진입점에서 직접 받지 않는다.** 그 순서를 페이지마다 지키는 대신
// 언어까지 묶어 둔 `prism-python.js`·`prism-c.js`를 받는다 —
// 진입점이 바깥 꾸러미 이름을 적지 않아야 검사 받침대가 그 진입점을 실제로 돌려 본다.
//
// 최상위 await(동적 import)로 순서를 맞추면 안 된다 — 모듈 완료가 늦어져
// `window.onload`가 먼저 떠 버리고, 그때 문법이 없어 하이라이팅이 조용히 실패한다.
import Prism from 'prismjs';

window.Prism = Prism;

export default Prism;
