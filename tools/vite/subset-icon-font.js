/**
 * Font Awesome 웹폰트를 **실제로 쓰는 아이콘만** 남기고 깎는다.
 *
 * FA 무료판의 solid 한 벌은 아이콘 1,000종이 넘는데, 이 저장소가 쓰는 것은 그 일부다.
 * 나머지는 방문자가 전부 받아 놓고 한 글자도 그리지 않는다.
 *
 * **왜 빌드 마지막에 하는가.** 어떤 아이콘을 쓰는지는 최종 HTML을 봐야 안다 —
 * 복사 버튼(`copy-code-button.js`)처럼 빌드가 넣는 아이콘이 있어서, 소스만 훑으면
 * 그 글자가 빠진 폰트가 나온다.
 *
 * 쓰는 아이콘은 두 갈래로 모은다.
 *   1. `class="… fa-house …"` → FA CSS의 `.fa-house{--fa:"…"}`에서 글자를 찾는다.
 *   2. HTML에 직접 박힌 사용자 영역(PUA) 글자. `--fa`를 손으로 지정한 자리를 위한 보험이다.
 *
 * 깎은 뒤에는 **파일 이름의 해시도 다시 매긴다.** 내용이 달라졌는데 이름이 같으면
 * 브라우저가 캐시에 둔 옛 폰트를 계속 쓴다.
 *
 * 얼마나 줄었는지는 빌드 로그가 찍는다 — 문서에 적지 않는다.
 */
import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, rm, stat } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import subsetFont from 'subset-font';

// `.fa-a,.fa-b{--fa:"X"}` 꼴에서 선택자와 글자를 뜯는다. 최소화된 CSS는 글자가
// 그대로 박혀 있고, 최소화 전에는 `015` 꼴로 이스케이프되어 있다. 둘 다 받는다.
//
// **정규식으로 규칙 하나를 통째로 잡지 않는다.** `([^{}]+)\{--fa:` 꼴은 최소화된
// 수백 KB짜리 CSS에서 되짚기가 폭발해 빌드가 십수 초 느려졌다. 표시자를 찾아
// 앞뒤로 잘라 내는 선형 훑기로 바꾼다.
const MARK = '{--fa:"';

function parseIconGlyphs(css, into) {
    let i = css.indexOf(MARK);
    while (i !== -1) {
        const end = css.indexOf('"', i + MARK.length);
        if (end === -1) return;
        const value = css.slice(i + MARK.length, end);
        // 선택자는 바로 앞의 규칙 경계까지다.
        let start = i;
        while (start > 0 && css[start - 1] !== '}' && css[start - 1] !== '{' && css[start - 1] !== ';') start -= 1;
        const ch = unescapeCss(value);
        if (ch.length === 1) {
            for (const [, name] of css.slice(start, i).matchAll(/[.]fa-([a-z0-9-]+)/g)) into.set(name, ch);
        }
        i = css.indexOf(MARK, end);
    }
}

const CLASS_RE = /class="([^"]*)"/g;
const PUA_RE = /[\uE000-\uF8FF]/g;

function unescapeCss(value) {
    return value.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)));
}

export default function subsetIconFont() {
    let logger;
    let outDir;
    return {
        name: 'subset-icon-font',
        apply: 'build',
        configResolved(config) {
            logger = config.logger;
            outDir = resolve(config.root, config.build.outDir);
        },
        // **번들이 아니라 디스크를 고친다.** rolldown은 generateBundle에서 bundle에
        // 대입하거나 지우는 것을 무시한다 — 그렇게 했더니 폰트 파일이 통째로 빠졌다.
        async writeBundle() {
            const all = [];
            for (const f of await readdir(outDir, { recursive: true })) {
                const full = join(outDir, f);
                if ((await stat(full)).isFile()) all.push(full);
            }
            const textFiles = all.filter((f) => /[.](html|css|js)$/.test(f));
            const fontFiles = all.filter((f) => /^fa-.*[.]woff2$/.test(basename(f)));
            if (!fontFiles.length) return;

            // 한 번만 읽는다. 뒤에서 이름 바뀐 글꼴을 반영할 때 다시 쓴다.
            const source = new Map();
            for (const f of textFiles) source.set(f, await readFile(f, 'utf8'));

            // 아이콘 이름 → 글자
            const glyphOf = new Map();
            for (const [f, css] of source) {
                if (f.endsWith('.css') && css.includes(MARK)) parseIconGlyphs(css, glyphOf);
            }
            if (!glyphOf.size) return;

            // **HTML만 보면 모자란다.** 지금은 JS가 아이콘을 만들어 넣지 않지만,
            // 나중에 그런 코드가 생기면 그 아이콘만 빠진 글꼴이 나가고 네모가 보인다.
            const used = new Set();
            for (const [f, src] of source) {
                if (f.endsWith('.css')) continue;
                for (const [, cls] of src.matchAll(CLASS_RE)) {
                    for (const token of cls.split(/\s+/)) {
                        const name = token.slice(3);
                        if (token.startsWith('fa-') && glyphOf.has(name)) used.add(glyphOf.get(name));
                    }
                }
                for (const ch of src.match(PUA_RE) || []) used.add(ch);
            }
            if (!used.size) return;

            const keep = [...used].join('');
            logger?.info(`[subset-icon-font] 쓰는 아이콘 ${used.size}종`);
            const kb = (n) => `${(n / 1024).toFixed(0)} KB`;
            const renames = new Map();

            for (const font of fontFiles) {
                const before = await readFile(font);
                let after;
                try {
                    after = await subsetFont(before, keep, { targetFormat: 'woff2' });
                } catch (err) {
                    // 깎다 실패하면 원본을 그대로 둔다. 아이콘이 사라지는 것보다 낫다.
                    logger?.warn(`[subset-icon-font] ${basename(font)} 건너뜀 — ${err.message}`);
                    continue;
                }
                if (after.length >= before.length) continue;

                // 내용이 바뀌었으니 이름의 해시도 바꾼다. 안 바꾸면 캐시가 옛것을 준다.
                const hash = createHash('sha256').update(after).digest('base64url').slice(0, 8);
                const renamed = font.replace(/-[^-]+\.woff2$/, `-${hash}.woff2`);
                await writeFile(renamed, after);
                if (renamed !== font) await rm(font);
                renames.set(basename(font), basename(renamed));
                logger?.info(`[subset-icon-font] ${basename(font)} ${kb(before.length)} → ${kb(after.length)}`);
            }
            if (!renames.size) return;

            for (const [f, src] of source) {
                let out = src;
                for (const [oldBase, newBase] of renames) {
                    if (out.includes(oldBase)) out = out.split(oldBase).join(newBase);
                }
                if (out !== src) await writeFile(f, out);
            }
        },
    };
}
