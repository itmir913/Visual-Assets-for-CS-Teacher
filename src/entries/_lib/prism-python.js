// Prism 본체와 **파이썬 문법**을 함께 싣는다.
//
// 언어 파일은 전역 `Prism`에 문법을 얹는 방식이라 본체보다 늦게 평가되어야 한다.
// 그 순서를 페이지마다 지키게 하는 대신 여기 한 번 적어 둔다 —
// **진입점은 이 파일 하나만 받으면 된다.**
import Prism from './prism.js';
import 'prismjs/components/prism-python.min.js';

export default Prism;
