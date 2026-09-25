// `simulator/index.html` 을 **루트 `index.html` 에서 만들어 낸다.**
//
// 시뮬레이터만 담은 입구가 따로 있어야 그 주소만 떼어 심의를 받을 수 있다.
// 그런데 같은 화면을 두 벌 손으로 관리하면 **한쪽이 조용히 낡는다** — 낡아도
// 아무도 빨간불을 켜 주지 않으므로, 틀린 줄 모른 채 몇 달이 간다.
//
// 그래서 손으로 쓰지 않는다. 루트 `index.html` 하나만 고치고 여기서 굽는다.
//
//     npm run gen:sim-index        다시 굽는다 (index.html 을 고쳤으면 이것)
//     npm run check -- sim-index   구운 결과와 저장소의 파일이 같은지 본다 (`npm run check` 가 부른다)
//
// **굽는 것을 저장소에 담는 까닭** — `npm run dev` 가 소스 폴더를 그대로 서빙하고
// Vite 도 디스크의 `simulator/**/*.html` 을 보고 입력을 정한다. 파일이 없으면
// 개발 서버에서 열리지 않고 빌드 입력에도 안 잡힌다.
//
// 여기서 하는 일은 `build()` 의 다섯 단계뿐이다. **하나라도 자기 자리를 못 찾으면 죽는다** —
// 루트가 바뀌었는데 조용히 반쪽짜리를 굽는 것이 이 도구가 막으려는 바로 그 일이다.
//
// 덤으로 **아무 데서도 링크되지 않는 시뮬레이터**를 찾는다. 새 시뮬레이터를 만들고
// `index.html` 에 걸지 않으면 학생에게 가는 길이 없는데, **화면은 멀쩡해 보인다** —
// 없는 것은 눈에 띄지 않기 때문이다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT, Report, read, walk} from '../lib/repo.mjs';

const SRC = 'index.html';
const OUT = 'simulator/index.html';

// 남길 섹션. 루트 index.html 의 `<section id="...">` 와 같아야 한다.
const KEEP_ID = 'simulator';

const BANNER = `<!-- ┌──────────────────────────────────────────────────────────────────────┐
     │ 이 파일은 루트 index.html에서 **만들어 낸 것이다. 손으로 고치지 않는다.**   │
     │ 고칠 곳은 index.html이고, 고친 뒤 \`npm run gen:sim-index\`를 돌린다.    │
     │ \`npm run check\`가 어긋남을 잡으므로 손으로 고친 것은 CI에서 되돌아온다.   │
     └──────────────────────────────────────────────────────────────────────┘ -->
`;

const SECTION_RE = /\n {4}<!--[^\n]*-->\n {4}<section class="scroll-mt-24" id="(?<id>[\w-]+)">[\s\S]*?\n {4}<\/section>\n/g;
const NAV_LINK_RE = /\n *<a class="[^"]*"\n *href="#(?<id>[\w-]+)" data-target="\k<id>">[^<]*<\/a>/g;
const SIM_HREF_RE = /href="simulator\//g;
// 머리말의 「시뮬레이터 모아보기」 버튼. **여기서는 제 페이지를 가리키게 된다.**
const SHORTCUT_RE = /\n *<a id="simulator-shortcut"[\s\S]*?<\/a>/g;
const SHORTCUT_NOTE_RE = /\n *<!-- 시뮬레이터만 모은 입구[\s\S]*?-->/g;
// 루트를 기준으로 적힌 주소. 한 단 안에서 보려면 앞에 한 단을 더 붙여야 한다.
// **하나씩 못박는다.** 루트 푸터에 링크가 하나 더 붙었는데 여기 안 적으면
// 입구에서만 죽는 주소가 되는데, 그건 아무도 안 눌러 보는 자리다.
const ROOT_HREFS = [
    ['href="./THIRD-PARTY-NOTICES.txt"', 'href="../THIRD-PARTY-NOTICES.txt"'],
    ['href="privacy/index.html"', 'href="../privacy/index.html"'],
];

// **일부러** index.html 에 걸지 않는 시뮬레이터. 지금은 없다.
// 적을 때는 왜 안 거는지도 함께 적는다 — 안 적으면 「빠뜨린 것」과 구별되지 않는다.
const UNLINKED_OK = new Set();

/** 루트 index.html 이 이 도구가 아는 모양이 아니다. */
class Stale extends Error {}

function subOnce(re, repl, text, what) {
    const n = (text.match(re) || []).length;
    if (n !== 1) throw new Stale(`${what}: ${n}곳을 찾았다 (1곳이어야 한다)`);
    return text.replace(re, repl);
}

const sameSet = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort());

/** 루트 index.html 의 원문을 받아 simulator/index.html 의 원문을 돌려준다. */
export function build(src) {
    // 1. 시뮬레이터 말고 다른 과목 섹션을 뺀다.
    const ids = [...src.matchAll(SECTION_RE)].map((m) => m.groups.id);
    if (!ids.includes(KEEP_ID)) throw new Stale(`섹션 id="${KEEP_ID}"를 못 찾았다 (찾은 것: ${ids.join(', ')})`);
    if (ids.length < 2) throw new Stale(`섹션이 ${ids.length}개뿐이다 — 뺄 것이 없다면 이 도구가 필요 없다`);
    let out = src.replace(SECTION_RE, (m, ...a) => (a.at(-1).id === KEEP_ID ? m : ''));

    // 2. 그 섹션들을 가리키던 nav 링크도 함께 뺀다. 남는 것 하나는 그대로 둔다.
    const navIds = [...out.matchAll(NAV_LINK_RE)].map((m) => m.groups.id);
    if (!sameSet(navIds, ids)) throw new Stale(`nav 링크와 섹션이 짝이 안 맞는다: nav=${navIds} 섹션=${ids}`);
    out = out.replace(NAV_LINK_RE, (m, ...a) => (a.at(-1).id === KEEP_ID ? m : ''));

    // 3. 제 페이지를 가리키게 되는 바로가기 버튼은 뺀다.
    out = subOnce(SHORTCUT_RE, '', out, '머리말의 시뮬레이터 바로가기');
    out = subOnce(SHORTCUT_NOTE_RE, '', out, '그 버튼에 달린 주석');

    // 4. 링크는 한 단 안에서 본 주소가 된다. `simulator/cs/…` → `cs/…`
    if (!SIM_HREF_RE.test(out)) throw new Stale('시뮬레이터 링크를 하나도 못 찾았다');
    out = out.replace(SIM_HREF_RE, 'href="');

    // 5. 루트를 기준으로 적힌 주소는 한 단 올라간다.
    for (const [from, to] of ROOT_HREFS) {
        const n = out.split(from).length - 1;
        if (n !== 1) throw new Stale(`${from}: ${n}곳을 찾았다 (1곳이어야 한다)`);
        out = out.replace(from, to);
    }
    // **제목은 손대지 않는다.** `<title>` 은 `<h1>` 과 같아야 한다는 규칙이 있고
    // (`html` 검사의 「제목 일치」), hero 의 `<h1>` 은 사이트 이름이라 바꿀 것이 아니다.
    return out.replace('<!DOCTYPE html>\n', '<!DOCTYPE html>\n' + BANNER);
}

/** `simulator/` 안에 있는데 그 입구가 가리키지 않는 페이지. */
function unlinkedSimulators(page) {
    const linked = new Set([...page.matchAll(/href="([\w./-]+\.html)"/g)].map((m) => m[1]));
    const bad = [];
    const base = path.join(ROOT, 'simulator');
    for (const p of walk(base, {ext: ['.html']})) {
        const r = path.relative(base, p).split(path.sep).join('/');
        if (r === 'index.html' || UNLINKED_OK.has(r)) continue;
        if (!linked.has(r)) {
            bad.push(`아무도 링크하지 않는 시뮬레이터: simulator/${r} (일부러 그렇다면 tools/checks/sim-index.mjs 의 UNLINKED_OK에 적는다)`);
        }
    }
    for (const r of [...UNLINKED_OK].sort()) {
        if (!fs.existsSync(path.join(base, r))) bad.push(`UNLINKED_OK에 적힌 시뮬레이터가 없다: simulator/${r}`);
    }
    return bad;
}

/** 줄 단위로 처음 어긋나는 곳 몇 줄. */
function firstDiff(have, made, limit = 20) {
    const a = have.split('\n'), b = made.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const out = [`--- ${OUT}`, `+++ ${SRC}에서 구운 것`, `@@ ${i + 1}행부터 @@`];
    for (let k = i; k < Math.min(i + limit / 2, a.length); k++) out.push('-' + a[k]);
    for (let k = i; k < Math.min(i + limit / 2, b.length); k++) out.push('+' + b[k]);
    return out;
}

/** `write` 가 참이면 굽고, 아니면 저장소의 파일과 같은지만 본다. */
export function check(args = [], {write = false} = {}) {
    const r = new Report(write ? 'gen:sim-index' : 'sim-index');
    let made;
    try {
        made = build(read(path.join(ROOT, SRC)));
    } catch (e) {
        if (!(e instanceof Stale)) throw e;
        r.error(`✗ ${SRC}이 이 도구가 아는 모양이 아니다 — ${e.message}`);
        r.error(`  ${SRC}을 고쳤다면 tools/checks/sim-index.mjs 의 규칙도 함께 고친다.`);
        return r;
    }
    const bad = unlinkedSimulators(made);
    const target = path.join(ROOT, OUT);
    if (write) {
        fs.writeFileSync(target, made);
        r.note(`${OUT} — ${made.split('\n').length}줄`);
    } else {
        const have = fs.existsSync(target) ? read(target) : '';
        if (have !== made) {
            r.error(`✗ ${OUT}이 ${SRC}과 어긋난다. \`npm run gen:sim-index\`로 다시 굽는다.`);
            for (const line of firstDiff(have, made)) r.error('  ' + line);
        }
    }
    for (const b of bad) r.error('  ✗ ' + b);
    if (!r.errors.length) r.done(`✓ ${OUT}: ${SRC}과 같다. 링크가 빠진 시뮬레이터도 없다.`);
    return r;
}

// `npm run gen:sim-index` — 굽는다.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const r = check([], {write: true}).print({verbose: true});
    process.exit(r.errors.length ? 1 : 0);
}
