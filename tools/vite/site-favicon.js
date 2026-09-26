// 모든 페이지의 <head> 에 사이트 아이콘(파비콘) 두 줄을 넣는다. **HTML 은 아무것도 적지 않는다.**
//
// **정본은 luminousky.com 에 있다.** 아이콘은 itmir913/itmir913.github.io 저장소가 관리하고
// luminousky.com 아래의 모든 프로젝트가 같은 파일을 쓴다. 이 저장소에 사본을 두면 나중에 디자인이
// 달라지므로 **반드시 절대 주소로만 가리킨다**(2026-09-26 사용자 지시). 그래서 로컬 개발 서버에서도
// 배포된 파일을 불러오고, 오프라인 묶음을 인터넷 없이 열면 아이콘이 보이지 않는다 — 정상이다.
//
// **왜 빌드가 하는가.** 페이지가 220쪽이 넘는다. 손으로 적으면 새 강의노트마다 빠뜨리기 쉽다.
// 여기서 넣으면 새 페이지도 저절로 받는다. 빠짐없이 들어갔는지는 `check -- dist` 가 본다.
export const FAVICON_SVG = 'https://luminousky.com/favicon.svg';
export const APPLE_TOUCH_ICON = 'https://luminousky.com/apple-touch-icon.png';

export default function siteFavicon() {
    return {
        name: 'site-favicon',
        transformIndexHtml: {
            order: 'pre',
            handler: () => [
                {tag: 'link', attrs: {rel: 'icon', href: FAVICON_SVG, type: 'image/svg+xml'}, injectTo: 'head'},
                {tag: 'link', attrs: {rel: 'apple-touch-icon', href: APPLE_TOUCH_ICON}, injectTo: 'head'},
            ],
        },
    };
}
