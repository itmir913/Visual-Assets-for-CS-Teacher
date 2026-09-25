// 런타임에 조립되는 Tailwind 클래스를 찾는다.
//
// 배포본은 Tailwind 가 파일을 텍스트로 훑어 **리터럴로 존재하는 클래스만** 구워서 만든다.
// 그래서 아래처럼 클래스 이름을 코드로 조립하면 CSS에 그 클래스가 담기지 않는다.
//
//     <div class="bg-${lang.color}-50">        <!-- bg-yellow-50 이 CSS에 없다 -->
//     el.className = 'text-' + tone + '-600';
//
// CDN을 쓰던 시절에는 런타임 JIT라 소스를 열면 멀쩡히 보였다 — **눈으로는 안 잡힌다.**
// 실제로 `프로그래밍(Python)/1-1-2` 에서 8개 중 3개가 빠진 채로 오래 남아 있었다.
//
// 고치는 법 — 완성된 클래스 문자열을 데이터에 리터럴로 넣는다.
//
//     iconClass: 'bg-yellow-50 text-yellow-600',      // 리터럴이므로 Tailwind 가 찾는다
//     <div class="${lang.iconClass}">
//
// 사용:
//     npm run check -- classes                    # 저장소 전체
//     npm run check -- classes <파일>…            # 짚은 파일만
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';

// 값이 있는 Tailwind 유틸리티 접두사. 조립되면 CSS에서 빠지는 것들이다.
const PREFIX =
    '(?:bg|text|border|outline|ring|divide|from|via|to|fill|stroke|shadow|opacity' +
    '|w|h|min-w|min-h|max-w|max-h|size|basis' +
    '|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y' +
    '|grid-cols|grid-rows|col-span|row-span|order|z|leading|tracking|rounded' +
    '|translate-x|translate-y|rotate|scale|duration|delay)';

const RULES = [
    // class="bg-${x}-50"  /  `text-${tone}-600`
    [new RegExp('\\b' + PREFIX + '-(?:[a-z0-9-]*-)?\\$\\{', 'g'), '템플릿 리터럴로 조립'],
    // 'bg-' + x   /   "text-" + tone
    [new RegExp('[\'"`]' + PREFIX + '-(?:[a-z0-9-]*-)?[\'"`]\\s*\\+', 'g'), '문자열 결합으로 조립'],
];

const SKIP = (n) => ['node_modules', '.git', '.venv', '.idea'].includes(n) || n.startsWith('dist') || n.startsWith('.tmp');

/* ── 둘째 규칙: JS 문자열에 Tailwind 클래스를 적지 않는다 ────────────────────────
 *
 * Tailwind 는 단위마다 `content` 에 적힌 **HTML 만** 읽는다(src/tailwind/*.config.js).
 * `src/entries/` 의 JS 는 읽지 않으므로, 거기 적은 클래스는 **같은 클래스가 우연히 HTML 에
 * 있을 때만** 살아 있다. 압축 시뮬레이터의 `min-h-[3rem]` 은 HTML 어디에도 없어 한 번도
 * 적용된 적이 없었다(2026-09-25 발견). CDN 으로 Tailwind 를 쓰던 시절의 흔적이다.
 *
 * 그래서 JS 에는 뜻을 가진 이름(`sim-badge`)만 적고 모양은 CSS 에서 `@apply` 로 준다
 * → src/styles/_sim-ui.css. 여기서는 JS 의 클래스 자리에 적힌 낱말을 모아 **Tailwind 에게
 * 직접 구워 보게 해서** 구워지는 것(= Tailwind 클래스)을 잡는다. 목록을 손으로 적지 않으니
 * 새 유틸리티도 빠짐없이 걸린다. (2026-09-25 사용자 확정)
 */

/** 클래스가 적히는 자리. 그 밖의 문자열(`display: 'flex'` 같은 스타일 값)은 보지 않는다. */
const JS_SITES = [
    /class=\\?["']([^"']*)/g,                                                  // HTML 조각 속 class="…"
    /className\s*=\s*[`'"]([^`'"]*)/g,                                           // el.className = '…'
    /classList\.(?:add|remove|toggle|contains|replace)\(\s*[`'"]([^`'"]*)/g,    // classList.add('…')
    /\b\w*Class\s*=\s*[`'"]([^`'"]*)/g,                                         // strongClass = '…'
];

/** **`hidden` 만은 둔다.** HTML 이 처음 상태로 `class="hidden"` 을 적어 두고 JS 가 그것을
 *  켜고 끄는 상태 표시라, 이름을 바꾸면 페이지마다 HTML 과 JS 를 함께 갈아야 한다.
 *  HTML 에 늘 있으므로 Tailwind 가 반드시 굽는다. */
const JS_ALLOWED = new Set(['hidden']);

async function tailwindMade(tokens) {
    const [{default: postcss}, {default: tailwind}] = await Promise.all([import('postcss'), import('tailwindcss')]);
    const raw = tokens.map((t) => `<div class="${t}"></div>`).join('\n');
    const out = await postcss([tailwind({content: [{raw}], corePlugins: {preflight: false}})])
        .process('@tailwind components; @tailwind utilities;', {from: undefined});
    const esc = (t) => t.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    return new Set(tokens.filter((t) => out.css.includes('.' + esc(t))));
}

async function checkJs(r, files) {
    const seen = [];   // [token, 파일, 줄]
    for (const p of files) {
        const text = read(p);
        for (const re of JS_SITES) {
            for (const m of text.matchAll(re)) {
                for (const t of m[1].split(/\s+/)) {
                    if (!t || t.includes('${') || JS_ALLOWED.has(t)) continue;
                    seen.push([t, p, lineOf(text, m.index)]);
                }
            }
        }
    }
    const made = await tailwindMade([...new Set(seen.map(([t]) => t))]);
    for (const [t, p, line] of seen) {
        if (made.has(t)) r.error(`${rel(p)}:${line} [JS 속 Tailwind] 「${t}」 — JS 는 Tailwind 가 읽지 않는다`);
    }
}

export async function check(args = []) {
    const r = new Report('check_classes');
    const picked = args.filter((a) => !a.startsWith('-'));
    const resolved = picked.map((a) => path.resolve(ROOT, a)).filter((p) => fs.existsSync(p));
    const fixture = (p) => rel(p).startsWith('tests/fixtures/');   // 일부러 틀리게 쓴 검사용 조각
    const files = picked.length
        ? resolved.filter((p) => p.endsWith('.html'))
        : walk(ROOT, {ext: ['.html'], skip: SKIP}).filter((p) => !fixture(p));
    const jsFiles = picked.length
        ? resolved.filter((p) => p.endsWith('.js'))
        : walk(path.join(ROOT, 'src', 'entries'), {ext: ['.js'], skip: SKIP});
    if (!files.length && !jsFiles.length) { r.error('검사할 파일이 없다'); return r; }
    if (jsFiles.length) await checkJs(r, jsFiles);
    for (const p of files) {
        const text = read(p);
        for (const [re, label] of RULES) {
            for (const m of text.matchAll(re)) {
                const snippet = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim();
                r.error(`${rel(p)}:${lineOf(text, m.index)} [런타임 조립] ${label} — …${snippet}…`);
            }
        }
    }
    if (r.errors.some((e) => e.includes('[런타임'))) r.error('완성된 클래스 문자열을 리터럴로 넣도록 고칠 것 (자세한 설명은 tools/checks/classes.mjs 머리 주석)');
    if (r.errors.some((e) => e.includes('[JS 속'))) r.error('JS 에는 뜻을 가진 이름만 적고 모양은 src/styles/_sim-ui.css 에서 @apply 로 줄 것');
    return r.done(`완료 — HTML ${files.length} · JS ${jsFiles.length}, 위반 ${r.errors.filter((e) => e.includes('[런타임') || e.includes('[JS 속')).length}`);
}
