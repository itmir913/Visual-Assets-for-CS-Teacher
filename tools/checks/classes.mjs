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
import {ROOT, Report, SUBJECTS, lineOf, read, rel, walk} from '../lib/repo.mjs';

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

/** 인라인 `<script>` 까지 보는 HTML — 시뮬레이터 페이지 · 강의노트 · 틀린 조각.
 *  강의노트는 퀴즈 스크립트(`checkAnswer` · `showToast`)와 조작 몇 곳이 Tailwind 를 적고 있어서
 *  2026-09-26 에 뜻 이름으로 옮기고 이 검사 안에 넣었다 — 퀴즈 모양은 src/styles/_quiz.css,
 *  한 페이지에만 있는 조작의 모양은 그 페이지 `<style>` 에 둔다.
 *  `simulator/index.html` 은 루트 `index.html` 에서 구워 낸 입구라 뺀다. */
const INLINE_SCOPE = (p) => {
    const r = rel(p);
    return (r.startsWith('simulator/') && !r.endsWith('/index.html')) || r.startsWith('tests/fixtures/') ||
        SUBJECTS.some((s) => r.startsWith(s.dir + '/'));
};

/** 인라인 스크립트의 Tailwind 를 아직 옮기지 못한 시뮬레이터. **비어 있는 것이 목표다** —
 *  옮긴 페이지는 여기서 지운다. 새 페이지는 여기 넣지 않는다(처음부터 뜻 이름으로 쓴다). */
const INLINE_PENDING = new Set([
]);

async function tailwindMade(tokens) {
    const [{default: postcss}, {default: tailwind}] = await Promise.all([import('postcss'), import('tailwindcss')]);
    const raw = tokens.map((t) => `<div class="${t}"></div>`).join('\n');
    const out = await postcss([tailwind({content: [{raw}], corePlugins: {preflight: false}})])
        .process('@tailwind components; @tailwind utilities;', {from: undefined});
    const esc = (t) => t.replace(/([^a-zA-Z0-9_-])/g, '\\$1');
    /* 선택자 머리에 온 `.이름` 만 센다. 그냥 `includes` 로 보면 `0.5rem` 의 `.5` 가
       「5」라는 클래스로 읽힌다. */
    const reEsc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new Set(tokens.filter((t) =>
        new RegExp('(^|[\\s,}>~+])\\.' + reEsc(esc(t)) + '(?=[\\s{:,.\\[>~+)])', 'm').test(out.css)));
}

/** HTML 의 인라인 `<script>` 본문 — [본문, 파일 안의 시작 위치]. `src=` 가 있는 것은 뺀다. */
const inlineScripts = (text) =>
    [...text.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)]
        .map((m) => [m[1], m.index + m[0].indexOf('>') + 1]);

/** `classList.add('a', 'b')` 의 **인자 전부**. 위 `JS_SITES` 는 첫 인자만 본다. */
const CLASSLIST_ARGS = /classList\.(?:add|remove|toggle|contains|replace)\(([^)]*)\)/g;

/** 문자열 리터럴 전부. 템플릿은 `${…}` 를 뺀 조각으로 나눈다. */
const STRING_LIT = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g;

async function checkJs(r, files, htmlFiles = []) {
    const seen = [];   // [token, 파일, 줄] — 클래스 자리에 적힌 낱말
    /* 클래스 자리가 아닌 곳에 **클래스 뭉치를 변수로 먼저 담는** 꼴도 있다 —
       `const active = 'px-3 py-1 …'; el.className = active;`. 이름이 무엇이든 잡도록,
       **낱말 둘 이상이 전부 Tailwind 클래스인 문자열**을 따로 모은다. 낱말 하나(`'flex'`)는
       스타일 값과 구별이 안 되므로 보지 않는다. */
    const bundles = [];   // [낱말들, 파일, 줄]
    // 주석 속 `…` 가 문자열로 읽히지 않게 주석을 같은 길이의 빈칸으로 덮는다(줄 번호는 그대로)
    const blank = (s) => s.replace(/[^\n]/g, ' ');
    const noComments = (code) => code
        .replace(/\/\*[\s\S]*?\*\//g, blank)
        .replace(/(^|[\s;{}(),])(\/\/[^\n]*)/g, (_, a, c) => a + blank(c));
    const scan = (p, text, raw, base) => {
        const code = noComments(raw);
        const at = (i) => lineOf(text, base + i);
        const push = (s, i) => {
            for (const t of s.split(/\s+/)) {
                if (!t || t.includes('${') || JS_ALLOWED.has(t)) continue;
                seen.push([t, p, at(i)]);
            }
        };
        for (const re of JS_SITES) for (const m of code.matchAll(re)) push(m[1], m.index);
        for (const m of code.matchAll(CLASSLIST_ARGS)) {
            for (const q of m[1].matchAll(/[`'"]([^`'"]*)[`'"]/g)) push(q[1], m.index);
        }
        for (const m of code.matchAll(STRING_LIT)) {
            const parts = m[3] !== undefined ? m[3].split(/\$\{[^}]*\}/) : [m[1] ?? m[2]];
            for (const s of parts) {
                const ts = s.trim().split(/\s+/).filter(Boolean);
                if (ts.length >= 2) bundles.push([ts, p, at(m.index)]);
            }
        }
    };
    for (const p of files) { const text = read(p); scan(p, text, text, 0); }
    // 페이지 안의 인라인 스크립트도 같은 JS 다 — 예전에는 `src/entries/` 만 보아 여기가 샜다
    for (const p of htmlFiles) {
        const text = read(p);
        for (const [code, base] of inlineScripts(text)) scan(p, text, code, base);
    }
    const bundleTokens = bundles.flatMap(([ts]) => ts).filter((t) => /^[a-z0-9:[\]\/.#%()_-]+$/i.test(t) && !t.includes('${'));
    const made = await tailwindMade([...new Set([...seen.map(([t]) => t), ...bundleTokens])]);
    const said = new Set();
    for (const [t, p, line] of seen) {
        if (!made.has(t) || said.has(`${p}:${line}:${t}`)) continue;
        said.add(`${p}:${line}:${t}`);
        r.error(`${rel(p)}:${line} [JS 속 Tailwind] 「${t}」 — ` +
            (p.endsWith('.html') ? '스크립트는 뜻 이름만 적는다' : 'JS 는 Tailwind 가 읽지 않는다'));
    }
    for (const [ts, p, line] of bundles) {
        if (!ts.every((t) => made.has(t) || JS_ALLOWED.has(t))) continue;
        const left = ts.filter((t) => !JS_ALLOWED.has(t) && !said.has(`${p}:${line}:${t}`));
        if (!left.length) continue;
        left.forEach((t) => said.add(`${p}:${line}:${t}`));
        r.error(`${rel(p)}:${line} [JS 속 Tailwind] 「${left.join(' ')}」 — 클래스 뭉치를 문자열로 들고 있다`);
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
    // `--pending` 이면 아직 옮기지 못한 페이지까지 본다 — 남은 일을 셀 때
    const withPending = args.includes('--pending');
    const inlineHtml = files.filter((p) => INLINE_SCOPE(p) && (withPending || !INLINE_PENDING.has(rel(p))));
    if (jsFiles.length || inlineHtml.length) await checkJs(r, jsFiles, inlineHtml);
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
    if (r.errors.some((e) => e.includes('[JS 속'))) r.error('JS 에는 뜻을 가진 이름만 적고 모양은 CSS 에서 @apply 로 줄 것 (시뮬레이터는 src/styles/_sim-ui.css, 강의노트 퀴즈는 src/styles/_quiz.css)');
    return r.done(`완료 — HTML ${files.length} · JS ${jsFiles.length}, 위반 ${r.errors.filter((e) => e.includes('[런타임') || e.includes('[JS 속')).length}`);
}
