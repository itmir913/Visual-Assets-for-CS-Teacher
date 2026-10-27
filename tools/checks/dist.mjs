// 빌드 **산출물**을 검사한다. 소스가 아니라 `dist/` 를 본다.
//
// 소스 검사(`html` · `classes` · `code`)와 역할이 다르다. 여기서 보는 것들은
// **빌드가 저지를 수 있는 실수**라서 소스만 봐서는 알 수 없다.
//
// 1. **`.docx` 다운로드 링크** — `.docx` 는 저장소에 없고 빌드가 만든다.
//    생성기 쪽 파일명과 강의노트의 링크가 어긋나면 이 검사가 유일한 방어선이다.
//    **양쪽을 다 본다** — 링크가 가리키는 파일이 있는지, 그리고 만들어 놓고
//    아무도 가리키지 않는 파일이 있는지.
// 2. **로컬화되지 않은 CDN 참조** — 하나라도 남으면 CDN 을 막는 학교망에서 깨진다.
// 3. **태그 중첩** — 주입·치환이 구조를 망가뜨리지 않았는지 마지막으로 확인한다.
// 4. **CSS 가 가리키는 자산이 실제로 있는지** — 빌드가 글꼴을 깎아 이름을 다시 매기므로
//    (`tools/vite/subset-icon-font.js`), 참조 고치기를 한 군데라도 빠뜨리면 404 가 난다.
//    아이콘은 안 그려져도 페이지가 멀쩡해 보여서 **눈으로는 못 잡는다.**
// 5. **모듈 스크립트가 남아 있지 않은지, 스크립트가 가리키는 파일이 있는지** —
//    `<script type="module">` 은 `file://` 에서 CORS 로 통째로 막힌다. 릴리즈 zip 을 풀어
//    연 사람에게만 깨진 화면이 가므로 **사이트만 보아서는 알 수 없다.**
//    빌드가 평범한 스크립트로 바꾸어 놓는다 → `tools/vite/classic-scripts.js`.
// 6. **제3자 오픈소스 라이선스 고지** — 번들에 들어간 패키지의 저작권 표시와 라이선스
//    전문이 산출물에 함께 나가는지. **오프라인 zip 은 명백한 재배포**라서, 고지가 빠지면
//    사이트는 멀쩡해 보이는 채로 남의 라이선스를 어긴 배포본이 나간다
//    → `tools/vite/third-party-notices.js`.
// 7. **사이트 아이콘(파비콘)이 모든 페이지에 들어갔는지** — 빌드가 넣는다(`tools/vite/site-favicon.js`).
//    정본 주소를 가리키는지까지 본다. 사본을 두면 디자인이 갈라진다.
// 8. **`<meta charset>` 이 첫 1024바이트 안에 있는지** — 그 앞에 긴 머리 주석을 두면 밀려난다.
//    밀려나도 대개 멀쩡해 보여서 눈으로는 못 잡는다. 테마 스크립트는 빌드가 그 **뒤**에
//    끼운다(`tools/vite/theme-toggle.js`).
// 9. **검색 색인 조각이 산출물에 있고 소스와 같은 절을 담았는지** — 색인은 산출물을 읽어
//    구워지므로(`tools/vite/search-index.js`) 소스만 보아서는 알 수 없다. 플러그인 순서가
//    뒤바뀌면 조각이 쓸려 나가 **첫 화면에 주소만 남고 파일이 없다.**
//
// 사용법:
//     npm run check -- dist                 # dist/
//     npm run check -- dist <경로>          # 다른 산출물 폴더
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, read, rel, walk} from '../lib/repo.mjs';
import {Checker} from './html.mjs';
import {FAVICON_SVG, APPLE_TOUCH_ICON} from '../vite/site-favicon.js';
import {buildIndex, collect} from '../lib/search-index.mjs';
import {readInjected} from '../vite/search-index.js';

const DOCX_HREF_RE = /href="([^"]+\.docx)"/g;

// 강의노트가 **일부러** 링크하지 않는 양식. 수행평가용이라 학생 화면에 나오면 안 된다.
// 링크가 없으면 「누가 이 파일을 지켜 주는가」가 사라지므로 여기에 적어 검사가 지키게 한다.
//
// 이 표는 두 방향으로 작동한다.
//   · 여기 없는데 아무도 안 가리키면  → 링크를 빠뜨린 것이다
//   · 여기 있는데 안 만들어졌으면      → 이름이나 자리가 바뀐 것이다. **주소가 죽는다**
// 뒤쪽이 진짜 이유다. 링크가 없으니 이름을 바꿔도 아무 데서도 티가 나지 않는다.
const UNLINKED_OK = new Set([
    '인공지능기초/실습/docx/수행평가-양식.docx',
    '프로그래밍/실습/docx/수행평가-양식.py.docx',
    '프로그래밍/실습/docx/수행평가-양식.c.docx',
]);
const NOTICE_FILE = 'THIRD-PARTY-NOTICES.txt';
// 고지 생성기가 전문을 못 찾았을 때 적는 문구. 이것이 보이면 고지가 반쪽이다.
const NOTICE_MISSING_MARK = '라이선스 전문 파일을 동봉하지 않았습니다';
const CDN_RE = /https:\/\/(?:cdn|unpkg|cdnjs)[a-zA-Z0-9./_-]*/g;
const URL_RE = /url\(\s*['"]?([^'")]+)['"]?\s*\)/g;
const MODULE_SCRIPT_RE = /<script[^>]*type="module"/;
// 브라우저가 문자 집합을 찾으려고 앞머리만 훑는 폭(HTML 표준). 이 밖에 두면 한글이 깨질 수 있다.
const CHARSET_LIMIT = 1024;
const SCRIPT_SRC_RE = /<script[^>]*src="([^"]+)"/g;

export function check(args = []) {
    const r = new Report('check_dist');
    const root = path.resolve(ROOT, args.find((a) => !a.startsWith('-')) || 'dist');
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) { r.error(`산출물 폴더가 없다: ${root}`); return r; }
    const files = walk(root, {ext: ['.html']});
    if (!files.length) { r.error(`${root}에 HTML이 하나도 없다`); return r; }
    const src = new Map(files.map((h) => [h, read(h)]));
    const shown = (p) => rel(p);

    // 1. docx 링크 — 양쪽 방향
    let docxTotal = 0;
    const linked = new Set();
    for (const [h, html] of src) {
        for (const m of html.matchAll(DOCX_HREF_RE)) {
            docxTotal++;
            const target = path.resolve(path.dirname(h), m[1]);
            linked.add(target);
            if (!fs.existsSync(target)) r.error(`깨진 다운로드 링크: ${shown(h)} -> ${m[1]}`);
        }
    }
    const built = walk(root, {ext: ['.docx']}).map((d) => [d, path.relative(root, d).split(path.sep).join('/')]);
    for (const [abs, relp] of built.sort((a, b) => (a[1] < b[1] ? -1 : 1))) {
        if (!linked.has(abs) && !UNLINKED_OK.has(relp)) {
            r.error(`아무도 링크하지 않는 양식: ${relp} (일부러 그렇다면 tools/checks/dist.mjs 의 UNLINKED_OK에 적는다)`);
        }
    }
    const builtSet = new Set(built.map(([, x]) => x));
    for (const x of [...UNLINKED_OK].sort()) {
        if (!builtSet.has(x)) r.error(`UNLINKED_OK에 적힌 양식이 만들어지지 않았다: ${x} (이름이나 자리가 바뀌었다면 주소가 죽는다)`);
    }

    // 2. CDN
    for (const [h, html] of src) {
        const found = [...new Set(html.match(CDN_RE) || [])].sort();
        if (found.length) r.error(`로컬화되지 않은 CDN 참조: ${shown(h)} -> ${found.slice(0, 3).join(', ')}`);
    }

    // 7. 사이트 아이콘 — 정본 두 줄이 모든 페이지에
    for (const [h, html] of src) {
        const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
        for (const [what, href] of [['icon', FAVICON_SVG], ['apple-touch-icon', APPLE_TOUCH_ICON]]) {
            const ok = [...head.matchAll(/<link\b[^>]*>/g)].some((m) =>
                new RegExp(`rel="${what}"`).test(m[0]) && m[0].includes(`href="${href}"`));
            if (!ok) r.error(`사이트 아이콘 빠짐: ${shown(h)} — <head> 에 rel="${what}" href="${href}" 가 없다(tools/vite/site-favicon.js)`);
        }
    }

    // 8. 문자 집합 선언이 첫 1024바이트 안에
    for (const [h, html] of src) {
        const at = html.search(/<meta\s+charset=/i);
        if (at < 0) { r.error(`<meta charset> 이 없다: ${shown(h)}`); continue; }
        const bytes = Buffer.byteLength(html.slice(0, at), 'utf8');
        if (bytes > CHARSET_LIMIT) r.error(`<meta charset> 이 ${CHARSET_LIMIT}바이트 밖에 있다: ${shown(h)} — 머리 주석을 <meta charset> 뒤로 옮긴다`);
    }

    // 3. 태그 중첩
    for (const [h, html] of src) {
        const c = new Checker();
        c.feed(html);
        for (const p of c.nesting) r.error(`태그 중첩 위반: ${shown(h)} -> ${p}`);
    }

    // 4. CSS 가 가리키는 자산
    let refTotal = 0;
    for (const css of walk(root, {ext: ['.css']})) {
        for (const [, ref] of read(css).matchAll(URL_RE)) {
            if (['data:', 'http:', 'https:', '//', '#'].some((x) => ref.startsWith(x))) continue;
            refTotal++;
            const target = ref.startsWith('/') ? path.join(root, ref.replace(/^\/+/, '')) : path.resolve(path.dirname(css), ref);
            if (!fs.existsSync(target)) r.error(`CSS가 없는 파일을 가리킨다: ${shown(css)} -> ${ref}`);
        }
    }

    // 5. 스크립트 — 모듈이 남았는가, 가리키는 파일이 있는가
    let scriptTotal = 0;
    for (const [h, html] of src) {
        if (MODULE_SCRIPT_RE.test(html)) r.error(`모듈 스크립트가 남았다(file://에서 막힌다): ${shown(h)}`);
        for (const [, s] of html.matchAll(SCRIPT_SRC_RE)) {
            if (['http://', 'https://', '//', 'data:'].some((x) => s.startsWith(x))) continue;
            scriptTotal++;
            if (!fs.existsSync(path.resolve(path.dirname(h), s))) r.error(`스크립트가 없는 파일을 가리킨다: ${shown(h)} -> ${s}`);
        }
    }

    // 6. 제3자 라이선스 고지. MIT · ISC · BSD · Apache · OFL · CC-BY 는 하나같이 재배포본에
    // 저작권 표시와 라이선스 전문을 함께 넣으라고 요구한다.
    const notice = path.join(root, NOTICE_FILE);
    if (!fs.existsSync(notice)) {
        r.error(`제3자 라이선스 고지가 없다: ${NOTICE_FILE} (tools/vite/third-party-notices.js가 굽는다)`);
    } else {
        // 식별자만 적고 전문이 빠지면 「전문을 함께 배포하라」를 지킨 것이 아니다.
        const n = read(notice).split(NOTICE_MISSING_MARK).length - 1;
        if (n) r.error(`라이선스 전문이 빠진 패키지가 ${n}개 있다: ${NOTICE_FILE}`);
        // 아무도 가리키지 않으면 있으나 마나다. 받는 사람이 찾을 수 있어야 한다.
        if (![...src.values()].some((html) => html.includes(NOTICE_FILE))) r.error(`아무 페이지도 고지를 링크하지 않는다: ${NOTICE_FILE}`);
    }

    // 9. 검색 색인 — 소스에서 센 절과 산출물의 조각이 같은가.
    searchIndex(r, root);

    return r.done(`완료 — HTML ${files.length}, docx 링크 ${docxTotal}, CSS 자산 참조 ${refTotal}, 스크립트 ${scriptTotal}, 문제 ${r.errors.length}`);
}

/**
 * 색인은 **산출물의 HTML을 읽어** 구워진다(`tools/vite/search-index.js`) — 소스에는 없다.
 * 그래서 두 가지가 소스만 보아서는 안 잡힌다.
 *
 *   · 조각이 지워졌는가 — `classic-scripts`가 아무도 가리키지 않는 청크를 쓸고 간다.
 *     플러그인 순서가 뒤바뀌면 **첫 화면에 주소만 남고 파일이 없다.**
 *   · 산출물에서 센 절이 소스에서 센 절과 같은가 — 주입 · 치환이 `<main>` · `<section>`을
 *     건드리면 학생이 보는 글과 색인이 어긋난다.
 */
function searchIndex(r, root) {
    const page = path.join(root, 'index.html');
    if (!fs.existsSync(page)) return;
    const html = read(page);
    const manifest = html.match(/window\.LN_SEARCH_PARTS = (\{[^\n]*?\});/);
    if (!manifest) {
        r.error('첫 화면에 검색 색인 조각 주소가 없다 (tools/vite/search-index.js가 넣는다)');
        return;
    }
    const heads = html.match(/<script defer src="(assets\/search-heads-[^"]+)"><\/script>/);
    if (!heads) {
        r.error('첫 화면에 머리 색인 태그가 없다 (tools/vite/search-index.js가 넣는다)');
        return;
    }
    /** 조각 하나를 가짜 window 로 돌려 레코드를 꺼낸다. 평범한 스크립트라 그대로 돈다. */
    const rows = (href) => {
        const file = path.resolve(root, href);
        if (!fs.existsSync(file)) { r.error(`검색 색인 조각이 없다: ${href} (classic-scripts보다 먼저 쓰면 함께 지워진다)`); return null; }
        const win = {LN_SEARCH_Q: []};
        new Function('window', read(file))(win);
        return win.LN_SEARCH_Q.map(([, data]) => data).flat();
    };
    const got = rows(heads[1]);
    let bodies = 0;
    for (const href of Object.values(JSON.parse(manifest[1]))) {
        const part = rows(href);
        if (part) bodies += part.length;
    }
    if (!got) return;
    // 소스 쪽 답. 같은 생성기이므로 **절의 수와 앵커가 같아야** 한다(본문은 주입 때문에 길어진다).
    const want = buildIndex(collect(readInjected)).heads;
    const key = (h) => `${h.f}#${h.i}`;
    const missing = want.filter((w) => !new Set(got.map(key)).has(key(w)));
    if (got.length !== want.length || missing.length) {
        r.error(`검색 색인의 절이 소스와 다르다: 산출물 ${got.length} · 소스 ${want.length}`
            + (missing.length ? ` — 빠진 절 ${missing.slice(0, 3).map(key).join(', ')}` : ''));
    }
    if (bodies !== got.length) {
        r.error(`검색 색인의 본문이 머리 색인과 짝이 안 맞는다: 본문 ${bodies} · 절 ${got.length}`);
    }
}
