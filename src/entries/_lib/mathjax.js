// MathJax 설정과 본체를 순서대로 싣는다.
//
// 설정(`mathjax-config.js`)이 **본체보다 먼저** 평가되어야 글꼴 주소가 잡힌다.
// 그 순서를 페이지마다 지키게 하는 대신 여기 한 번 적어 둔다.
import './mathjax-config.js';
import 'mathjax/es5/tex-chtml.js';
