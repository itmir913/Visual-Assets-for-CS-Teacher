/**
 * @font-face의 truetype 대체 경로를 지운다 — PostCSS 플러그인.
 *
 * Font Awesome은 `src: url(...woff2) format("woff2"), url(...ttf) format("truetype")`
 * 꼴로 쓴다. woff2를 아는 브라우저는 앞의 것만 받고 ttf는 **한 번도 내려받지 않는다.**
 * 그런데 Vite는 CSS 안의 url()을 모두 자산으로 굽기 때문에, 아무도 받지 않는 ttf가
 * 산출물에 남는다. 참조를 지우면 자산으로도 굽히지 않는다.
 *
 * woff2는 2016년 이후 브라우저가 전부 안다. 이 저장소는 이미 ES 모듈과 CSS 그리드를
 * 쓰므로 그보다 오래된 브라우저는 애초에 대상이 아니다.
 *
 * 지운 양은 `npm run check:dist`가 센다 — 여기 적지 않는다.
 */
export default function dropTtfFallback() {
    return {
        postcssPlugin: 'drop-ttf-fallback',
        Declaration: {
            src(decl) {
                if (!/format\(\s*["']?truetype/i.test(decl.value)) return;
                // 쉼표로 끊되 url(...) 안의 쉼표는 건드리지 않는다.
                const parts = decl.value.split(/,(?![^(]*\))/);
                const kept = parts.filter((p) => !/format\(\s*["']?truetype/i.test(p));
                // 남는 것이 없으면 그대로 둔다 — ttf뿐인 글꼴까지 지우면 글자가 사라진다.
                if (kept.length) decl.value = kept.join(',').trim();
            },
        },
    };
}
dropTtfFallback.postcss = true;
