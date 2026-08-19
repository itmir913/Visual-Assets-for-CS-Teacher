// 산출물의 `<script type="module">`을 **페이지마다 하나인 평범한 `<script defer>`**로 바꾼다.
//
// **왜 필요한가.** 릴리즈 zip을 풀어 `file://`로 열면 모듈 스크립트가 통째로 막힌다.
// 모듈은 CORS를 타는데 `file://`의 출처는 `null`이라 브라우저가 무조건 거절한다
// (`Cross origin requests are only supported for protocol schemes: … http, https`).
// 라이브러리를 window에 얹는 진입점이 실행되지 못하므로 인라인 스크립트가
// `vis is not defined`로 죽는다 — 그래프·트리·차트가 그려지지 않는다.
// 평범한 스크립트(`type` 없음)는 같은 자리에서 그냥 실행된다.
//
// **왜 산출물을 나누지 않는가.** Pages용과 zip용을 따로 구우면 zip 쪽에만 결함이 쌓인다.
// 여기서 만드는 파일은 http에서도 그대로 돌아가므로 산출물은 하나로 남는다.
//
// **하는 일.** 페이지가 받던 청크를 원래 순서대로 IIFE 하나에 눌러 담는다.
// 공통 청크를 여러 페이지가 나눠 쓰던 이득은 포기한다 — 대신 어디서 열어도 돈다.
// **페이지마다 스크립트가 하나여야 한다** — 청크를 따로따로 누르면 두 파일이 같은
// 라이브러리를 품을 수 있고, 그러면 뒤엣것이 앞엣것의 등록을 지운다(Prism 언어가 그렇다).
// 아무도 가리키지 않게 된 청크는 지운다.
//
// **`defer`인 것이 중요하다.** 모듈은 defer라 body 끝의 인라인 스크립트보다 늦게 돈다.
// `defer`를 붙이면 실행 순서가 그대로이므로, 인라인이 쓰는 load 핸들러가 계속 맞는다.
//
// **`closeBundle`에서 돈다** — 다른 플러그인이 디스크에 쓰기를 끝낸 뒤라야 한다.
// 글꼴을 깎아 이름을 다시 매기는 `subset-icon-font.js`보다 먼저 눌러 담으면
// 옛 글꼴 이름이 번들에 박힌다.
import { createHash } from 'node:crypto';
import { glob, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';

import { rolldown } from 'rolldown';

// 태그는 Vite가 한 줄에 하나씩 넣는다. 들여쓰기를 그대로 물려주려고 함께 잡는다.
const MODULE_SCRIPT_RE = /([ \t]*)<script\b[^>]*\btype="module"[^>]*><\/script>\n?/g;
const MODULEPRELOAD_RE = /[ \t]*<link\b[^>]*\brel="modulepreload"[^>]*>\n?/g;
const SRC_RE = /\bsrc="([^"]+)"/;
const ANY_SCRIPT_SRC_RE = /<script\b[^>]*\bsrc="([^"]+)"/g;
const PLACEHOLDER = '<!--classic-script-->'; // 자리 표시. 남으면 눈에 띄라고 주석으로 둔다

/** dist 안의 HTML 전부. */
async function htmlFiles(outDir) {
    const found = [];
    for await (const f of glob('**/*.html', { cwd: outDir })) found.push(resolve(outDir, f));
    return found.sort();
}

// **rolldown이 CommonJS를 품은 공통 청크를 내보내지 못한다**(1.2.3·1.2.4에서 확인).
// `(function(e){ … return e.t=…,e})({});` 꼴로 굽고 **`export` 문을 빠뜨리므로**,
// 그 청크를 가리키는 쪽이 「does not provide an export named 't'」로 죽는다.
// **file://만의 문제가 아니다** — 같은 산출물이 http에서도 똑같이 깨진다.
// 여기 걸리는 것은 prismjs를 나눠 쓰는 청크와 rolldown 제 런타임 청크다.
//
// 눌러 담기 전에 되살려 준다. 위쪽이 고쳐지면(=export 문이 있으면) 손대지 않는다.
const WRAPPED_HEAD_RE = /^\(function\(([\w$]+)\)\{/;
const WRAPPED_TAIL = '})({});';
const EXPORT_RE = /\bexport\s*[{*]/;
const NAME_RE = /^[A-Za-z_$][\w$]*$/;

/** `(function(e){ … return e.i=u,e.t=s,e})({});` → 같은 것을 내보내는 모듈로 바꾼다. */
function reexportWrappedChunk() {
    return {
        name: 'reexport-wrapped-chunk',
        async load(id) {
            if (!id.endsWith('.js')) return null;
            const code = (await readFile(id, 'utf8')).trim();
            if (EXPORT_RE.test(code) || !code.endsWith(WRAPPED_TAIL)) return null;
            const param = WRAPPED_HEAD_RE.exec(code.slice(0, 40))?.[1];
            if (!param) return null;

            // 마지막 return이 내보낼 것들을 그 매개변수에 달아 준다. 그 이름을 그대로 쓴다.
            // 하나라도 놓치면 rolldown이 「Missing export」로 세우므로 조용히 틀릴 수 없다.
            const RETURN = 'return ';
            const names = [];
            for (const piece of code.slice(code.lastIndexOf(RETURN) + RETURN.length).split(',')) {
                const eq = piece.indexOf('=');
                if (eq === -1 || !piece.startsWith(`${param}.`)) continue;
                const name = piece.slice(param.length + 1, eq);
                if (NAME_RE.test(name) && !names.includes(name)) names.push(name);
            }
            if (!names.length) {
                throw new Error(`classic-scripts: 내보낼 것을 못 찾았다 — ${id}`
                    + ' (rolldown이 고쳐졌다면 이 되살리기를 통째로 지운다)');
            }
            return [
                `const __chunk = ${code.slice(0, -1)};`,
                `export const { ${names.join(', ')} } = __chunk;`,
            ].join('\n');
        },
    };
}

/** 페이지가 받던 것들을 **원래 순서대로** 부르는 가상 진입점. */
const VIRTUAL_ENTRY = '\0classic-scripts:entry';

function virtualEntry(sources) {
    const code = sources.map((s) => `import ${JSON.stringify(s)};`).join('\n');
    return {
        name: 'classic-scripts-entry',
        resolveId: (id) => (id === VIRTUAL_ENTRY ? id : null),
        load: (id) => (id === VIRTUAL_ENTRY ? code : null),
    };
}

/** 한 페이지 몫을 IIFE 하나로 눌러 담아 `assets/`에 쓰고, 페이지에서 부를 주소를 준다.
 *  이름은 Vite가 쓰던 꼴(`assets/<페이지 경로>-<해시>.js`)을 그대로 따른다 —
 *  내용이 바뀌면 이름도 바뀌므로 브라우저가 옛 파일을 계속 쓰는 일이 없다. */
async function flattenPage(page, sources, outDir) {
    const bundle = await rolldown({
        input: VIRTUAL_ENTRY,
        platform: 'browser',
        treeshake: false, // 이미 Vite가 흔들어 놓았다. 여기서 또 흔들 이유가 없다.
        plugins: [virtualEntry(sources), reexportWrappedChunk()],
    });
    const { output } = await bundle.generate({ format: 'iife', minify: true });
    await bundle.close();
    if (output.length !== 1) {
        throw new Error(`classic-scripts: ${page}가 청크 하나로 눌리지 않았다 (${output.length}개)`);
    }

    const code = output[0].code;
    const hash = createHash('sha256').update(code).digest('base64url').slice(0, 8);
    const dest = resolve(outDir, 'assets', `${relative(outDir, page)}-${hash}.js`);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, code, 'utf8');
    return relative(dirname(page), dest).split(sep).join('/');
}

export default function classicScripts() {
    let outDir;
    let logger;
    return {
        name: 'classic-scripts',
        apply: 'build',
        configResolved(config) {
            outDir = resolve(config.root, config.build.outDir);
            logger = config.logger;
        },
        async closeBundle() {
            const pages = await htmlFiles(outDir);

            // 1. 페이지마다 무엇을 어떤 순서로 받고 있었는지 모으고, 자리를 표시해 둔다.
            const plan = new Map();
            for (const page of pages) {
                const sources = [];
                const html = (await readFile(page, 'utf8'))
                    .replace(MODULEPRELOAD_RE, '') // 평범한 스크립트에는 쓸모가 없다
                    .replace(MODULE_SCRIPT_RE, (tag, pad) => {
                        const src = tag.match(SRC_RE)?.[1];
                        if (!src) return tag; // 인라인 모듈은 건드리지 않는다
                        sources.push(resolve(dirname(page), src));
                        if (sources.length > 1) return ''; // 첫 자리 하나로 합친다
                        return `${pad}${PLACEHOLDER}\n`;
                    });
                if (sources.length) plan.set(page, { html, sources });
            }

            // 2. 누르는 것이 먼저다 — 지우기 전에 청크가 남아 있어야 한다.
            for (const [page, p] of plan) {
                const href = await flattenPage(page, p.sources, outDir);
                await writeFile(page, p.html.replace(PLACEHOLDER, `<script defer src="${href}"></script>`), 'utf8');
            }

            // 3. 이제 아무 페이지도 가리키지 않는 청크를 지운다.
            const referenced = new Set();
            for (const page of pages) {
                const html = await readFile(page, 'utf8');
                for (const [, src] of html.matchAll(ANY_SCRIPT_SRC_RE)) {
                    if (!/^(?:https?:)?\/\//.test(src)) referenced.add(resolve(dirname(page), src));
                }
            }
            const orphans = [];
            for await (const f of glob('assets/**/*.js', { cwd: outDir })) {
                const abs = resolve(outDir, f);
                if (!referenced.has(abs)) orphans.push(abs);
            }
            for (const f of orphans.sort()) await rm(f);

            logger?.info(`[classic-scripts] 페이지 ${plan.size}개를 스크립트 하나씩으로 눌러 담고`
                + ` 남은 청크 ${orphans.length}개를 지웠다`);
        },
    };
}
