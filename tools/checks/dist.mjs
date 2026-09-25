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
//
// 사용법:
//     npm run check -- dist                 # dist/
//     npm run check -- dist <경로>          # 다른 산출물 폴더
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, read, rel, walk} from '../lib/repo.mjs';
import {Checker} from './html.mjs';

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

    return r.done(`완료 — HTML ${files.length}, docx 링크 ${docxTotal}, CSS 자산 참조 ${refTotal}, 스크립트 ${scriptTotal}, 문제 ${r.errors.length}`);
}
