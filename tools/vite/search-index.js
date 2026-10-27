// 첫 화면의 전 과목 검색이 받아 가는 색인 조각을 굽는다. 색인을 만드는 일 자체는
// `tools/lib/search-index.mjs` 하나가 하고(검사도 같은 파일을 부른다), 여기서는 **어디서 읽어
// 어디에 쓰는지**만 정한다.
//
// ## 빌드 — `closeBundle`에서, `classic-scripts` 뒤에서
//
// **`dist/`의 HTML을 읽는다.** 거기서는 코드 주입 · 복사 버튼 · 테마 스크립트가 모두 끝나 있어
// 학생이 보는 글과 색인이 같아진다. 소스를 읽으면 빌드가 넣는 `.py` · `.c` 코드가 색인에서 빠진다.
//
// **`closeBundle`이고, `vite.config.js`의 `plugins`에서 `classicScripts()` 뒤에 둔다.**
// 그쪽이 「아무도 가리키지 않는 청크」를 지우는데, 조각을 먼저 써 두면 머리 조각이 태그에 걸리기
// 전에 지워진다. 뒤에서 쓰면 쓸고 간 자리에 남는다. 순서를 바꾸면 `check -- dist`가 빨간불이다.
//
// ## 개발 서버 — 같은 생성기로 즉석에서
//
// 주소만 다르다(`/@search/…`). 소스에는 주입이 안 끝나 있으므로 `inject-code`의 `readCode()`를
// 거쳐 같은 HTML을 만든다.
//
// ## 조각을 평범한 스크립트로 두는 까닭
//
// `file://`에서는 모듈과 `fetch`가 통째로 막힌다(오프라인 zip → tools/vite/classic-scripts.js).
// 그래서 조각은 전역에 담는 평범한 스크립트이고, 과목 조각은 실행 중에 `<script>` 태그를 꽂아
// 받는다. **첫 화면에는 데이터를 적지 않는다** — 해시된 조각 주소만 적는다.
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

import {ROOT, relPath} from './units.js';
import {readCode} from './inject-code.js';
import {SUBJECTS} from '../lib/repo.mjs';
import {buildIndex, collect, partScript} from '../lib/search-index.mjs';

const PAGE = 'index.html';
const DEV_BASE = '/@search/';
const CODE_TAG = /(<code\b[^>]*\bdata-src="([^"]+)"[^>]*>)([\s\S]*?)(<\/code>)/g;
// 조각 주소와 머리 조각 태그를 끼울 자리. 첫 화면의 검색 칸이 이 변수를 읽는다.
const MANIFEST = /<\/head>/;

const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 8);

/** 소스에서 읽어 코드 주입까지 마친 HTML — 개발 서버와 검사가 쓰는 길. */
export function readInjected(rel) {
    const abs = resolve(ROOT, rel);
    let html;
    try {
        html = readFileSync(abs, 'utf-8');
    } catch {
        return null;
    }
    if (!html.includes('data-src')) return html;
    return html.replace(CODE_TAG, (_m, open, spec, _old, close) =>
        open + readCode(spec, dirname(abs), rel) + close);
}

/** 첫 화면에 끼우는 두 줄 — 머리 조각 태그와 과목 조각 주소. */
function inject(html, headsHref, partHrefs) {
    const tags = `    <script defer src="${headsHref}"></script>\n`
        + `    <script>window.LN_SEARCH_PARTS = ${JSON.stringify(partHrefs)};</script>\n`;
    return html.replace(MANIFEST, `${tags}</head>`);
}

export default function searchIndex() {
    let outDir = 'dist';
    return {
        name: 'search-index',

        configResolved(cfg) {
            outDir = cfg.build?.outDir ?? outDir;
        },

        // 개발 서버 — 조각을 즉석에서 만들어 준다. 한 번 만든 것은 들고 있다가 **HTML이 바뀌면 버린다**
        // (조각 하나를 받을 때마다 197편을 다시 읽으면 고칠 때마다 기다리게 된다).
        configureServer(server) {
            let made = null;
            for (const ev of ['change', 'add', 'unlink']) {
                server.watcher.on(ev, (file) => { if (file.endsWith('.html')) made = null; });
            }
            server.middlewares.use((req, res, next) => {
                const url = (req.url || '').split('?')[0];
                if (!url.startsWith(DEV_BASE)) return next();
                const name = decodeURIComponent(url.slice(DEV_BASE.length)).replace(/\.js$/, '');
                const {heads, parts} = made ??= buildIndex(collect(readInjected));
                const body = name === 'heads'
                    ? partScript('heads', heads)
                    : parts[name] ? partScript(name, parts[name]) : null;
                if (body === null) { res.statusCode = 404; res.end(''); return; }
                res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
                res.end(body);
            });
        },

        transformIndexHtml: {
            order: 'post',
            handler(html, ctx) {
                if (ctx.server === undefined || relPath(ctx) !== PAGE) return html;
                const parts = {};
                for (const s of SUBJECTS) parts[s.slug] = `${DEV_BASE}${s.slug}.js`;
                return inject(html, `${DEV_BASE}heads.js`, parts);
            },
        },

        // 빌드 — 산출물을 읽어 산출물에 쓴다. **`classic-scripts` 뒤라야 한다**(머리 주석).
        closeBundle() {
            const dir = resolve(ROOT, outDir);
            const page = resolve(dir, PAGE);
            let html;
            try {
                html = readFileSync(page, 'utf-8');
            } catch {
                return; // 첫 화면을 굽지 않은 빌드다 — 넣을 자리가 없다
            }
            const {heads, parts} = buildIndex(collect((rel) => {
                try {
                    return readFileSync(resolve(dir, rel), 'utf-8');
                } catch {
                    return null;
                }
            }));
            const write = (slug, rows) => {
                const body = partScript(slug, rows);
                const href = `assets/search-${slug}-${hash(body)}.js`;
                writeFileSync(resolve(dir, href), body);
                return href;
            };
            const partHrefs = {};
            for (const [slug, rows] of Object.entries(parts)) partHrefs[slug] = write(slug, rows);
            const headsHref = write('heads', heads);
            writeFileSync(page, inject(html, headsHref, partHrefs));
            this.info(`검색 색인 — 절 ${heads.length}개, 과목 조각 ${Object.keys(partHrefs).length}개`);
        },
    };
}
