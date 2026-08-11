// 소스의 Tailwind CDN <script>를 걷어내고 그 단위의 스타일시트를 꽂는다.
//
// **소스 HTML은 한 줄도 고치지 않는다.** 파일 하나를 열면 CDN 판으로 그대로 보이고,
// 배포본만 구워진 CSS를 쓴다.
//
// 링크를 미리 심어 두고 Vite가 알아서 묶기를 기대하면 안 된다 — 주입된 <link>는
// Vite의 HTML 스캔에 잡히지 않아 그대로 남는다(실측). 그래서 CSS를 별도 진입점으로
// 굽고, 번들에서 실제로 나온 파일 이름을 찾아 상대경로로 꽂는다.
import { relPath, unitOf, upToRoot } from './units.js';

const CDN_SCRIPT = /[ \t]*<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>\n?/;

export default function tailwindSwap() {
    return {
        name: 'tailwind-swap',
        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                const rel = relPath(ctx);
                const unit = unitOf(rel);
                if (!unit) return html;

                let href;
                if (ctx.bundle) {
                    const asset = Object.keys(ctx.bundle).find(
                        (f) => f.endsWith('.css') && f.includes(`style-${unit.slug}-`),
                    );
                    if (!asset) {
                        throw new Error(
                            `「${unit.dir ?? unit.file}」의 스타일시트를 번들에서 찾지 못했다. ` +
                            `src/styles/${unit.slug}.css가 진입점에 있는지 확인할 것.`,
                        );
                    }
                    href = upToRoot(rel) + asset;
                } else {
                    // dev — 번들이 없다. Vite dev 서버가 소스 CSS를 그대로 서빙하고
                    // PostCSS(Tailwind)를 태워 주므로 루트 절대경로로 가리키면 된다.
                    href = `/src/styles/${unit.slug}.css`;
                }

                const stripped = html.replace(CDN_SCRIPT, '');
                if (stripped === html) {
                    // CDN 스크립트가 없는 파일에 스타일시트만 꽂으면 스타일이 두 번 실린다.
                    // 조용히 넘기지 않는다.
                    throw new Error(`${rel}: Tailwind CDN <script>를 찾지 못했다`);
                }
                return stripped.replace(
                    /<\/title>\n?/,
                    `</title>\n    <link rel="stylesheet" href="${href}">\n`,
                );
            },
        },
    };
}
