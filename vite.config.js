// 강의노트 146개를 페이지 146개로 굽는 다중 진입점(MPA) 설정.
//
// **소스 HTML은 한 줄도 고치지 않는다.** 소스는 지금처럼 Tailwind CDN을 그대로 두고,
// 빌드가 그 <script>를 걷어낸 자리에 구워 놓은 스타일시트를 꽂는다.
// build_site.py가 하던 일과 같은 일을, 파이썬 대신 Vite가 한다.
//
// 마이그레이션 중이라 과목마다 `vite: true/false`로 나뉘어 있다.
// false인 과목은 아직 build_site.py가 맡는다 → subjects.json
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(resolve(ROOT, 'subjects.json'), 'utf-8'));

/** Vite가 맡기로 한 과목만. */
const viteSubjects = cfg.subjects.filter((s) => s.vite);

/**
 * 소스의 Tailwind CDN <script>를 걷어내고 그 과목의 스타일시트를 꽂는다.
 *
 * 링크를 미리 심어 두고 Vite가 알아서 묶기를 기대하면 안 된다 — 주입된 <link>는
 * Vite의 HTML 스캔에 잡히지 않아 그대로 남는다(실측). 그래서 CSS를 별도 진입점으로
 * 굽고, 번들에서 실제로 나온 파일 이름을 찾아 상대경로로 꽂는다.
 */
const tailwindSwap = {
    name: 'tailwind-swap',
    transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
            // dev 서버에서는 ctx.path가 URL 인코딩된 상태로 온다. 폴더 이름이
            // 한글이라 풀지 않으면 어느 과목인지 못 알아본다.
            const rel = decodeURIComponent(ctx.path).replace(/^\//, '');
            const subject = viteSubjects.find((s) => rel.startsWith(s.dir));
            if (!subject) return html;

            let href;
            if (ctx.bundle) {
                // 빌드 — 실제로 나온 파일 이름을 번들에서 찾아 상대경로로 꽂는다.
                const asset = Object.keys(ctx.bundle).find(
                    (f) => f.endsWith('.css') && f.includes(subject.slug),
                );
                if (!asset) {
                    throw new Error(
                        `「${subject.dir}」의 스타일시트를 번들에서 찾지 못했다. ` +
                        `src/styles/${subject.slug}.css가 진입점에 있는지 확인할 것.`,
                    );
                }
                href = '../'.repeat(rel.split('/').length - 1) + asset;
            } else {
                // dev — 번들이 없다. Vite dev 서버가 소스 CSS를 그대로 서빙하고
                // PostCSS(Tailwind)를 태워 주므로 루트 절대경로로 가리키면 된다.
                href = `/src/styles/${subject.slug}.css`;
            }
            const before = html;
            html = html.replace(
                /[ \t]*<script src="https:\/\/cdn\.tailwindcss\.com"[^>]*><\/script>\n?/,
                '',
            );
            if (html === before) {
                // CDN 스크립트가 없는 파일에 스타일시트만 꽂으면 스타일이 두 번 실린다.
                // 조용히 넘기지 않는다.
                throw new Error(`${rel}: Tailwind CDN <script>를 찾지 못했다`);
            }
            return html.replace(
                /<\/title>\n?/,
                `</title>\n    <link rel="stylesheet" href="${href}">\n`,
            );
        },
    },
};

/**
 * CDN에서 받던 글꼴 자산을 npm 패키지에서 가져다 쓴다.
 *
 * 빌드에 네트워크가 필요 없어지고 버전이 락파일에 고정된다. CDN을 막는 학교망에서
 * 사이트가 도는 것이 로컬화의 원래 목적이므로, 이 단계까지 와야 그 목적이 선다.
 *
 * 두 패키지 모두 CSS가 **자기 폴더 기준 상대경로**로 글꼴을 참조한다.
 * 그래서 폴더 구조를 그대로 옮겨야 한다.
 */
const VENDOR = [
    { from: 'node_modules/@fortawesome/fontawesome-free/css/all.min.css', to: 'assets/vendor/fontawesome/css/all.min.css' },
    { from: 'node_modules/@fortawesome/fontawesome-free/webfonts', to: 'assets/vendor/fontawesome/webfonts' },
    { from: 'node_modules/pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css', to: 'assets/vendor/pretendard/pretendardvariable-dynamic-subset.css' },
    { from: 'node_modules/pretendard/dist/web/variable/woff2-dynamic-subset', to: 'assets/vendor/pretendard/woff2-dynamic-subset' },
];

// 소스에 적힌 CDN 주소 → 옮겨 놓은 자리. 값은 dist 루트 기준 상대경로다.
const CDN_MAP = {
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.7.2/css/all.min.css':
        'assets/vendor/fontawesome/css/all.min.css',
    'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css':
        'assets/vendor/pretendard/pretendardvariable-dynamic-subset.css',
};

const vendorAssets = {
    name: 'vendor-assets',
    apply: 'build',
    async writeBundle(options) {
        const { cp, mkdir } = await import('node:fs/promises');
        for (const { from, to } of VENDOR) {
            const dest = resolve(options.dir, to);
            await mkdir(dirname(dest), { recursive: true });
            await cp(resolve(ROOT, from), dest, { recursive: true });
        }
    },
    transformIndexHtml: {
        order: 'post',
        handler(html, ctx) {
            const rel = decodeURIComponent(ctx.path).replace(/^\//, '');
            if (!viteSubjects.some((s) => rel.startsWith(s.dir))) return html;
            const prefix = '../'.repeat(rel.split('/').length - 1);
            for (const [url, local] of Object.entries(CDN_MAP)) {
                html = html.split(url).join(prefix + local);
            }
            return html;
        },
    },
};

/**
 * Vite는 서브리소스에 crossorigin을 붙인다. 지금은 문제가 없지만 이 산출물은
 * 릴리즈 zip으로도 나가므로, 원본과 다른 속성을 굳이 남기지 않는다.
 */
const stripCrossorigin = {
    name: 'strip-crossorigin',
    transformIndexHtml: {
        order: 'post',
        handler: (html) => html.replace(/\s+crossorigin(?==|(?=[\s>]))/g, ''),
    },
};

/** 진입점 — 과목 HTML 전부 + 과목별 CSS. */
const input = {};
for (const s of viteSubjects) {
    input[`style-${s.slug}`] = resolve(ROOT, `src/styles/${s.slug}.css`);
}
const htmlEntries = await Promise.all(
    viteSubjects.map(async (s) => {
        const { glob } = await import('node:fs/promises');
        const files = [];
        for await (const f of glob(`${s.dir}/**/*.html`, { cwd: ROOT })) files.push(f);
        return files.sort();
    }),
);
for (const files of htmlEntries) {
    for (const f of files) input[f.replace(/\\/g, '/')] = resolve(ROOT, f);
}

export default {
    root: ROOT,
    base: './',
    // 포트를 못 박지 않는다. 다른 것이 쓰고 있으면 환경변수로 넘겨받는다.
    server: { port: Number(process.env.PORT) || 5173 },
    plugins: [tailwindSwap, vendorAssets, stripCrossorigin],
    build: {
        // 파이썬 빌더가 아직 맡고 있는 과목과 같은 dist를 쓴다. 둘이 겹치지 않도록
        // 저쪽은 subjects.json에서 vite:true인 과목을 건너뛴다.
        outDir: 'dist',
        emptyOutDir: false,
        rollupOptions: {
            input,
            output: { assetFileNames: 'assets/[name]-[hash][extname]' },
        },
    },
};
