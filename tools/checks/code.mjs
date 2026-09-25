// 강의노트가 끌어다 쓰는 소스 코드에 구문 오류가 없는지 본다.
//
// `.py` 는 파이썬 컴파일러에 넘겨 보고, `.c` 는 `gcc -fsyntax-only` 로 본다. **동작까지 보지는 않는다.**
// 오타를 잡는 것이 목적이다. 파이썬도 gcc 도 **검사 대상 언어의 컴파일러로만** 부른다 —
// 검사 자체는 이 파일이다. 둘 중 없는 것은 건너뛰고 경고한다(CI 러너에는 둘 다 있다).
//
// **강의노트 HTML 에 코드를 직접 적지 않았는지도 본다**(`checkInline`) — `<pre>` 안의 `<code>` 는
// `data-src` 마커여야 한다.
//
// 파일 이름이 규약을 지키는지도 함께 본다 → `CLAUDE.md` 의 「코드 파일 이름」.
//
// 조각 모음처럼 홀로 서지 않는 파일은 맨 위 주석 프론트매터로 뺀다.
//
//     # ---
//     # check: none
//     # ---
//
// `---` 를 그냥 첫 줄에 쓰면 `.c` 가 컴파일되지 않으므로 주석 안에 넣는다.
//
// **`check: none` 이어도 `.py` 는 구문을 본다.** `gcc` 는 컴파일하지만 파이썬 쪽은
// 파싱만 하므로, 홀로 서지 않는 조각이라도 오타는 잡힌다. **일부러 깨뜨려 둔 파일**
// (들여쓰기 오류를 보여 주는 예제 따위)만 `check: broken` 으로 아주 뺀다.
//
// **마커(`data-src`)가 가리키는 파일과 구역이 실제로 있는지는 빌드가 본다** —
// `tools/vite/inject-code.js` 가 못 찾으면 빌드를 세운다. 같은 검사를 두 곳에 두면
// 둘이 어긋나므로 여기서는 하지 않는다.
//
// 사용법:
//     npm run check -- code            # 저장소 전체
//     npm run check -- code <경로>     # 지정한 파일만
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, SUBJECTS, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';

const COMMENT_PREFIX = {'.py': '#', '.c': '//'};
const SKIP = (n) => ['.git', '.venv', 'node_modules', 'dist', '__pycache__'].includes(n) || n.startsWith('dist-');

/**
 * `code/` 폴더 안에 있는 소스만 대상으로 한다.
 * `tools/` 밑의 도구 스크립트까지 검사하지 않으려는 것이다.
 */
export function codeFiles() {
    return walk(ROOT, {ext: ['.py', '.c'], skip: SKIP})
        .filter((p) => path.relative(ROOT, p).split(path.sep).includes('code'));
}

const ext = (p) => path.extname(p).toLowerCase();

/** 맨 위 주석 프론트매터의 지시자를 읽는다. 없으면 빈 객체. */
export function directives(p) {
    const pfx = COMMENT_PREFIX[ext(p)];
    const fence = `${pfx} ---`;
    const lines = read(p).split(/\r?\n/);
    if (!lines.length || lines[0].trim() !== fence) return {};
    const out = {};
    for (const raw of lines.slice(1)) {
        if (raw.trim() === fence) return out;
        let body = raw.trim();
        if (body.startsWith(pfx)) {
            body = body.slice(pfx.length).trim();
            const i = body.indexOf(':');
            if (i !== -1) out[body.slice(0, i).trim()] = body.slice(i + 1).trim();
        }
    }
    throw new Error(`프론트매터가 \`${fence}\`로 닫히지 않았다`);
}

/** 먼저 찾은 실행 파일. 없으면 null. */
function which(...names) {
    for (const n of names) {
        const p = spawnSync(n, ['--version'], {encoding: 'utf8'});
        if (!p.error && p.status === 0) return n;
    }
    return null;
}

// 파일 여러 개를 한 번에 파싱한다. 오류는 「경로\t메시지」 줄로 돌려준다.
const PY_COMPILE = [
    'import sys',
    'for p in sys.argv[1:]:',
    '    try:',
    '        compile(open(p, "rb").read(), p, "exec", dont_inherit=True)',
    '    except SyntaxError as e:',
    '        print(p + "\\t" + f"{type(e).__name__}: {e.msg} (line {e.lineno})")',
].join('\n');

function checkSyntax(files, r) {
    let checked = 0, skipped = 0;
    const py = [], c = [];
    for (const p of files) {
        let meta;
        try { meta = directives(p); } catch (e) { r.error(`${rel(p)}: ${e.message}`); continue; }
        if (meta.check === 'broken') { skipped++; continue; }
        // .c 조각은 gcc가 «컴파일»하므로 홀로 서지 못하면 검사할 수 없다.
        // .py는 «파싱만» 하므로 조각이어도 구문은 볼 수 있다.
        if (meta.check === 'none' && ext(p) !== '.py') { skipped++; continue; }
        (ext(p) === '.py' ? py : c).push(p);
    }

    if (py.length) {
        const python = which('python3', 'python');
        if (!python) {
            skipped += py.length;
            r.warn('파이썬이 없어 .py 구문 검사를 건너뛴다 (CI에서는 검사된다)');
        } else {
            const bad = new Map();
            // 명령줄 길이 제한(Windows)을 넘지 않게 나눠 넘긴다.
            for (let i = 0; i < py.length; i += 100) {
                const proc = spawnSync(python, ['-c', PY_COMPILE, ...py.slice(i, i + 100)],
                    {encoding: 'utf8', env: {...process.env, PYTHONUTF8: '1', PYTHONDONTWRITEBYTECODE: '1'}});
                if (proc.status !== 0) throw new Error(`파이썬 구문 검사가 죽었다: ${proc.stderr}`);
                for (const line of proc.stdout.split(/\r?\n/).filter(Boolean)) {
                    const [p, msg] = line.split('\t');
                    bad.set(path.resolve(p), msg);
                }
            }
            for (const p of py) {
                if (bad.has(p)) r.error(`${rel(p)}: ${bad.get(p)}`);
                else { checked++; r.note(`OK ${rel(p)}`); }
            }
        }
    }

    if (c.length) {
        if (!which('gcc')) {
            skipped += c.length;
            r.warn('gcc가 없어 .c 구문 검사를 건너뛴다 (CI에서는 검사된다)');
        } else {
            for (const p of c) {
                const proc = spawnSync('gcc', ['-fsyntax-only', p], {encoding: 'utf8'});
                if (proc.status !== 0) r.error(`${rel(p)}: | ${proc.stderr.trim().replace(/\r?\n/g, ' | ')}`);
                else { checked++; r.note(`OK ${rel(p)}`); }
            }
        }
    }
    return {checked, skipped};
}

/**
 * 코드 파일 이름에 공백이 없는지 본다 → CLAUDE.md 「코드 파일 이름」.
 *
 * **앞머리가 강의노트와 맞는지는 보지 않는다.** 실습은 차시 번호가 없고 이름도
 * 줄여 붙이므로 기계가 「알아볼 수 있는 이름인가」를 판정할 수 없다.
 */
function checkNames(files, r) {
    for (const p of files) {
        if (/\s/.test(path.basename(p))) r.error(`${rel(p)}: 이름에 공백이 있다. 띄어 쓸 자리는 \`-\`로 잇는다`);
    }
}

/**
 * 강의노트 HTML 에 코드 본문이 직접 들어 있지 않은가 — `CLAUDE.md` 「코드 자체는 HTML에 쓰지 않는다」.
 *
 * `<pre>` 안의 `<code>` 는 반드시 `data-src` 마커이고 속이 비어 있어야 한다. `<code>` 없는
 * `<pre>`(표 · 주소 같은 고정폭 글)는 코드가 아니므로 둔다. 시뮬레이터는 강의노트가 아니라 뺀다.
 */
function checkInline(r) {
    for (const s of SUBJECTS) {
        for (const html of walk(path.join(ROOT, s.dir), {ext: ['.html']})) {
            const src = read(html);
            for (const m of src.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)) {
                for (const c of m[1].matchAll(/<code\b([^>]*)>([\s\S]*?)<\/code>/gi)) {
                    const [, attrs, body] = c;
                    if (attrs.includes('data-src') && !body.trim()) continue;
                    const why = attrs.includes('data-src') ? '마커 안에 코드가 들어 있다' : 'data-src 없이 코드를 직접 적었다';
                    r.error(`${rel(html)}:${lineOf(src, m.index)} <pre><code> — ${why}. code/ 실파일로 빼고 data-src 로 건다`);
                }
            }
        }
    }
}

/** 진입점에서 상대 import 를 따라가며 실리는 모듈의 글과 바깥 꾸러미 이름을 모은다. */
function importGraph(entry, seen = new Set()) {
    if (seen.has(entry) || !fs.existsSync(entry)) return seen;
    seen.add(entry);
    for (const m of read(entry).matchAll(/import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g)) {
        if (m[1].startsWith('.')) importGraph(path.resolve(path.dirname(entry), m[1]), seen);
        else seen.add('pkg:' + m[1]);
    }
    return seen;
}

/**
 * 코드 블록이 있는 강의노트가 Prism 하이라이팅을 실제로 싣는가(2026-09-25 사용자 지시).
 *
 * 코드 본문은 빌드가 넣어 주지만 **배경색과 색칠은 Prism 이 `<pre>` 에 `language-*` 를 옮겨
 * 붙여야 생긴다.** 진입점이 없으면 코드는 보이는데 바탕 없이 흐린 글자로 나와, 화면만으로는
 * 빠진 줄 알기 어렵다 — 소프트웨어와생활 여섯 편 · 데이터과학 두 편이 그렇게 나가 있었다.
 * 페이지가 거는 진입점에서 import 를 따라가, `highlightAll` 을 부르는지와 쓰인 언어마다
 * `prismjs/components/prism-<언어>` 가 실리는지 본다.
 */
function checkHighlight(r, htmls) {
    for (const html of htmls) {
        const src = read(html);
        const langs = new Set([...src.matchAll(/<code\b[^>]*\bclass="[^"]*\blanguage-([\w-]+)[^>]*\bdata-src=/g)].map((m) => m[1]));
        if (!langs.size) continue;
        const graph = new Set();
        for (const m of src.matchAll(/<script\b[^>]*\bsrc="\/(src\/entries\/[^"]+)"/g)) importGraph(path.join(ROOT, m[1]), graph);
        const files = [...graph].filter((g) => !g.startsWith('pkg:'));
        const where = `${rel(html)}:${lineOf(src, src.search(/data-src=/))}`;
        if (!files.some((f) => /\bhighlightAll\s*\(/.test(read(f)))) {
            r.error(`${where} 코드 블록이 있는데 Prism.highlightAll() 을 부르는 진입점이 없다 — 코드에 배경과 색이 붙지 않는다`);
            continue;
        }
        for (const lang of langs) {
            if (!graph.has(`pkg:prismjs/components/prism-${lang}.min.js`) && !graph.has(`pkg:prismjs/components/prism-${lang}.js`))
                r.error(`${where} language-${lang} 코드가 있는데 진입점이 그 문법(prism-${lang})을 싣지 않는다`);
        }
    }
}

export function check(args = []) {
    const r = new Report('check_code');
    const picked = args.filter((a) => !a.startsWith('-'));
    const files = picked.length ? picked.map((a) => path.resolve(ROOT, a)).filter((p) => fs.existsSync(p)) : codeFiles();
    const {checked, skipped} = checkSyntax(files.filter((f) => !f.endsWith('.html')), r);
    checkNames(files.filter((f) => !f.endsWith('.html')), r);
    if (!picked.length) checkInline(r);
    checkHighlight(r, picked.length ? files.filter((f) => f.endsWith('.html'))
        : SUBJECTS.flatMap((s) => walk(path.join(ROOT, s.dir), {ext: ['.html']})));
    return r.done(`완료 — 구문 검사 ${checked}, 건너뜀 ${skipped}, 문제 ${r.errors.length}`);
}
