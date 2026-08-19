// MathJax 본체보다 **먼저** 평가되어야 하는 설정.
//
// MathJax는 실행 중에 `${fontURL}/MathJax_Main-Regular.woff` 식으로 이름을 조립해
// 글꼴을 받아온다. 해시된 자산으로는 못 찾으므로 이름이 그대로인 public/ 쪽을 가리킨다.
// 번들 안에서는 자기 <script>의 src를 읽는 자동 탐지도 되지 않아 명시가 필요하다.
//
// **경로를 상수로 박으면 안 된다.** 페이지마다 깊이가 다르고, 배포 주소도 저장소
// 이름이 붙은 하위 경로다(`/Visual-Assets-for-CS-Teacher/`). 그래서 이미 해결되어
// 있는 자산 링크에서 산출물 루트를 거꾸로 읽어 낸다 — 빌드에서는 `../assets/…`,
// dev에서는 `/src/…`라 어느 쪽이든 맞는 값이 나온다.
function distRoot() {
    // 빌드에서는 CSS·JS 둘 다 `assets/`를 지나가고, dev에서는 `/src/…`라 앞이 `/`다.
    const el = document.querySelector('link[rel="stylesheet"][href*="assets/"], script[src]');
    const ref = el?.getAttribute('href') ?? el?.getAttribute('src') ?? '';
    const cut = ref.indexOf('assets/');
    if (cut >= 0) return ref.slice(0, cut);          // 빌드: '', '../', '../../'
    return ref.startsWith('/') ? '/' : './';          // dev: 루트에서 서빙된다
}

window.MathJax = window.MathJax || {};
window.MathJax.chtml = {
    ...(window.MathJax.chtml || {}),
    fontURL: new URL(`${distRoot()}vendor/mathjax/es5/output/chtml/fonts/woff-v2`,
        document.baseURI).href,
};
