// 격자 트랙 목록에 **`fr` 트랙과 `auto` 최솟값을 함께 두지 않는다.**
//
// 격자 칸의 자식에 `min-height: 0`(열이면 `min-width: 0`)이 걸리면, 그 칸의 «최소 기여»는 0이 된다.
// 요즘 브라우저는 `auto` 트랙을 최소 기여로 잡은 뒤 `fr` 을 나누기 «전»에 내용 크기까지 키운다.
// **옛 사파리(구형 아이패드)는 키우지 않고 남는 크기를 전부 `fr` 에 준다.** 그래서 `auto` 트랙이
// 0으로 접힌다. 선형 자료구조의 「나란히 비교」에서 배열 줄이 테두리만 남고 이름 줄이 노드 줄
// 위로 넘쳤다(2026-09-27, `auto minmax(0, 1fr)`).
//
// 진짜 브라우저로는 잡을 수 없다 — `check -- layout` 의 Chromium 도 Playwright 의 WebKit 도
// 최신판이라 옛 계산을 되살리지 못한다. 그래서 **모양으로 막는다.** 자식에 `min-*: 0` 이
// 걸렸는지는 Tailwind 클래스 · 인라인 스타일 · 부모 규칙으로 흩어져 있어 판정하지 않는다 —
// `fr` 과 함께 쓴 `auto` 는 그것만으로 위반이다.
//
// 걸리는 꼴 — 같은 트랙 목록에 `fr` 이 있고, 트랙이
//     auto · minmax(auto, …) · fit-content(…)      (fit-content 의 최솟값도 auto 다)
// 대신 쓸 것 — 행은 `max-content`, 열은 `minmax(min-content, max-content)`.
// 둘 다 최소 기여가 아니라 내용 크기를 바닥으로 삼아 `min-*: 0` 에 흔들리지 않는다.
//
// 보는 곳 — `src/styles/*.css` 와 HTML `<style>` 의 선언, HTML `style=""` · JS 문자열의
// `grid-template…:` · `gridTemplate…`, Tailwind 임의값 클래스 `grid-rows-[…]` · `grid-cols-[…]`.
//
// 못 보는 것 — **명시하지 않은 암묵 트랙.** `grid-template-rows: minmax(0, 1fr)` 인 격자에
// 자식이 둘이면 둘째는 `grid-auto-rows`(기본 `auto`) 행에 앉아 같은 꼴이 된다. 자식 수는
// 화면 폭과 JS 에 달려 있어 정적으로 셀 수 없다 — `fr` 행을 둘 때는 자식 수만큼 행을 적는다.
//
// 사용:
//     npm run check -- grid                  # 저장소 전체
//     npm run check -- grid <파일>…          # 짚은 .html · .css · .js 만
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {ROOT, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';

const SKIP = (n) => ['node_modules', '.git', '.venv', '.idea', 'scratchpad', 'public'].includes(n) ||
    n.startsWith('dist') || n.startsWith('.tmp') || n === 'fixtures';

const PROPS = /^grid-template(?:-rows|-columns)?$|^grid$/;

/** 트랙 목록이 `fr` 과 `auto` 최솟값을 함께 갖는가. 걸리면 걸린 트랙 글을 돌려준다. */
export function autoBesideFr(value) {
    const v = value.toLowerCase();
    if (!/\d(?:\.\d+)?fr\b/.test(v)) return null;
    const bad = v.match(/(?<![-\w])auto(?![-\w])|minmax\(\s*auto\s*,|fit-content\(/);
    return bad ? bad[0].replace(/\s+/g, '') : null;
}

/** CSS 글의 위반 — [시작 위치, 속성, 값, 걸린 트랙]. */
function fromCss(css) {
    const out = [];
    postcss.parse(css).walkDecls((d) => {
        if (!PROPS.test(d.prop)) return;
        const bad = autoBesideFr(d.value);
        if (bad) out.push([d.source.start.offset, d.prop, d.value, bad]);
    });
    return out;
}

/** CSS 밖의 글(HTML 속성 · JS 문자열 · Tailwind 클래스)의 위반. */
function fromText(text) {
    const out = [];
    const rules = [
        // style="grid-template-rows: auto 1fr" · 'grid-template-rows: auto 1fr' · setProperty('grid-template-rows', 'auto 1fr')
        [/(grid-template(?:-rows|-columns)?)['"]?\s*[:,]\s*['"`]?([^;"'`}\n]+)/g, (m) => m[2]],
        // el.style.gridTemplateRows = 'auto 1fr' · {gridTemplateRows: 'auto 1fr'}
        [/(gridTemplate(?:Rows|Columns)?)\s*[:=]\s*(['"`])(.*?)\2/g, (m) => m[3]],
        // grid-rows-[auto_1fr]
        [/(grid-(?:rows|cols))-\[([^\]\s"'`]+)\]/g, (m) => m[2].replaceAll('_', ' ')],
    ];
    for (const [rx, valueOf] of rules) {
        for (const m of text.matchAll(rx)) {
            const value = valueOf(m);
            const bad = autoBesideFr(value);
            if (bad) out.push([m.index, m[1], value.trim(), bad]);
        }
    }
    return out;
}

const styleBlocks = (text) =>
    [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => [m[1], m.index + m[0].indexOf('>') + 1, m.index + m[0].length]);

export async function check(args = []) {
    const r = new Report('check_grid');
    const picked = args.filter((a) => !a.startsWith('-')).map((a) => path.resolve(ROOT, a)).filter((p) => fs.existsSync(p));
    const files = picked.length ? picked : [
        ...walk(ROOT, {ext: ['.html'], skip: SKIP}),
        ...walk(path.join(ROOT, 'src', 'styles'), {ext: ['.css']}),
        ...walk(path.join(ROOT, 'src', 'entries'), {ext: ['.js']}),
    ];
    if (!files.length) { r.error('검사할 파일이 없다'); return r; }

    let n = 0;
    const report = (p, text, at, prop, value, bad) => {
        n++;
        r.error(`${rel(p)}:${lineOf(text, at)} [fr 옆의 auto] ${prop}: ${value}  ← ${bad}`);
    };
    for (const p of files) {
        const text = read(p);
        if (p.endsWith('.css')) {
            try { for (const f of fromCss(text)) report(p, text, ...f); }
            catch (e) { r.error(`${rel(p)} CSS 를 읽지 못했다 — ${e.reason || e.message}`); }
            continue;
        }
        let rest = text;
        if (p.endsWith('.html')) {
            // <style> 은 postcss 로 읽고(주석을 건너뛴다), 나머지 글에서는 그 자리를 비운다.
            for (const [css, base, end] of styleBlocks(text)) {
                try { for (const [at, ...f] of fromCss(css)) report(p, text, base + at, ...f); }
                catch (e) { r.error(`${rel(p)}:${lineOf(text, base)} CSS 를 읽지 못했다 — ${e.reason || e.message}`); }
                rest = rest.slice(0, base) + ' '.repeat(end - base) + rest.slice(end);
            }
        }
        for (const f of fromText(rest)) report(p, text, ...f);
    }
    if (n) r.error('행은 max-content, 열은 minmax(min-content, max-content) 로 쓸 것 (까닭은 tools/checks/grid.mjs 머리 주석)');
    return r.done(`완료 — 파일 ${files.length}, 위반 ${n}`);
}
