// 「인공지능기초/1-2-4.지식의-표현과-논리-추론.html」가 쓰는 라이브러리만 담는다.
// 페이지마다 진입점을 따로 두어 그 페이지가 안 쓰는 것을 받지 않게 한다.
// 여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑는다.
// 인라인 스크립트가 전역으로 쓰므로 window에 얹는다.
import '../_lib/mathjax-config.js';
import 'mathjax/es5/tex-chtml.js';
