// 문서가 다시 불어나거나 섞이지 않게 지킨다. 문서 구조의 규칙은 `CLAUDE.md` 「쓰는 자리」에 있다.
//
//     npm run check -- docs                 저장소 전체 (CI가 쓰는 방식)
//     npm run check -- docs <파일.md>…       인자만. 파일 이름으로 종류를 가른다(아래)
//
// 보는 것 넷.
//
//   1. **규칙 문서의 줄 수 상한** — `RULE_DOC_MAX_LINES`. 넘으면 실패한다. 늘리려면 이 상수를 고치는
//      커밋을 따로 한다 — 규칙 문서가 커지는 것을 «결정»으로 남기려는 것이다.
//   2. **규칙 문서에 날짜 금지** — `YYYY-MM-DD`꼴. 날짜가 붙는 글은 판례다(`docs/cases/`).
//      꼭 필요한 자리는 `DATE_OK`에 까닭과 함께 적는다.
//   3. **판례 형식** — `docs/cases/*.md`의 `###` 소절은 `### YYYY-MM-DD · 제목`으로 시작하고,
//      `→ 규칙: <경로> 「<절 이름>」` 줄을 하나 이상 가지며, 그 절이 실제로 있어야 한다.
//      결정 기록(`결정.md`)은 `### D-번호 · 제목`과 `상태:` 줄을 가지고, 번호가 겹치지 않으며,
//      「대체됨(→ D-번호)」이 가리키는 번호가 있어야 한다.
//   4. **문서 안의 상대 링크가 실제 파일을 가리키는지** — 코드 블록과 인라인 코드는 뺀다.
//
// 인자로 파일을 주면 이름으로 종류를 가른다 — `CLAUDE.md` 또는 `*-규칙.md`는 규칙 문서,
// `cases/` 아래는 판례, `cases/결정.md`는 결정 기록. 줄 수 상한은 `RULE_DOC_MAX_LINES`에 적힌 경로만 본다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, read, rel, walk} from '../lib/repo.mjs';

/** 규칙 문서의 줄 수 상한. 2026-09-27 문서 구조 정리 직후의 줄 수에서 시작했다. */
export const RULE_DOC_MAX_LINES = {
    'CLAUDE.md': 133,
    'docs/강의노트-작성-규칙.md': 205,
    'docs/시뮬레이터-규칙.md': 52,
};

/** 규칙 문서에 날짜를 남겨도 되는 줄. `{'경로': ['그 줄에 든 글', '까닭']}` 꼴. 비어 있는 것이 목표다. */
const DATE_OK = {};

const CASES_DIR = 'docs/cases';
const DECISIONS = 'decisions';
const NOT_CASES = new Set(['README.md', '이관-표.md']);
const SKIP_DIRS = new Set(['node_modules', 'dist', 'dist-shots', '.git', 'public', 'fixtures', '.idea']);

const DATE = /\b20\d\d-\d\d-\d\d\b/;
const CASE_HEAD = /^### (\d{4}-\d{2}-\d{2}) · \S/;
const DECISION_HEAD = /^### D-(\d{3}) · \S/;
const STATUS = /^상태: (미결정|결정됨|폐기|대체됨 \(→ D-(\d{3})\))(?: \(.+\))?$/;
const RULE_REF = /^→ 규칙: (\S+) 「([^」]+)」\s*$/;

const kindOf = (r) => {
    if (/(^|\/)cases\/결정\.md$/.test(r)) return DECISIONS;
    if (/(^|\/)cases\/[^/]+\.md$/.test(r)) return NOT_CASES.has(path.basename(r)) ? 'other' : 'case';
    if (r === 'CLAUDE.md' || /-규칙\.md$/.test(r)) return 'rule';
    return 'other';
};

/** 제목(`##` · `###`) 목록 — 판례가 가리키는 절이 있는지 볼 때 쓴다. */
const headingsCache = new Map();
function headingsOf(p) {
    if (!headingsCache.has(p)) {
        const set = new Set();
        if (fs.existsSync(p)) for (const m of read(p).matchAll(/^#{2,3} (.+?)\s*$/gm)) set.add(m[1]);
        headingsCache.set(p, set);
    }
    return headingsCache.get(p);
}

/** 코드 블록과 인라인 코드를 같은 길이의 빈칸으로 지운다 — 줄 번호를 지키려고. */
const blankCode = (s) => s
    .replace(/^```[\s\S]*?^```/gm, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/`[^`\n]*`/g, (m) => ' '.repeat(m.length));

function checkRule(r, file, text, rp) {
    const max = RULE_DOC_MAX_LINES[rp];
    const lines = text.split('\n');
    const count = text.endsWith('\n') ? lines.length - 1 : lines.length;
    if (max !== undefined && count > max) {
        r.error(`  ✗ ${rp}: ${count}줄 — 상한 ${max}줄을 넘는다. 규칙을 영역 규칙 문서로 옮기거나, 늘리기로 했다면 RULE_DOC_MAX_LINES를 고치는 커밋을 따로 한다`);
    }
    const ok = DATE_OK[rp] || [];
    const code = blankCode(text).split('\n');
    lines.forEach((l, i) => {
        if (DATE.test(code[i] || '') && !ok.some(([s]) => l.includes(s))) {
            r.error(`  ✗ ${rp}:${i + 1} 규칙 문서에 날짜 — 날짜가 붙는 글은 판례(${CASES_DIR}/)로 옮긴다: ${l.trim().slice(0, 60)}`);
        }
    });
}

function sections(text) {
    const out = [];
    let cur = null;
    text.split('\n').forEach((l, i) => {
        if (l.startsWith('### ')) { cur = {head: l, line: i + 1, body: []}; out.push(cur); }
        else if (cur) cur.body.push(l);
    });
    return out;
}

function checkRuleRef(r, rp, line, ref) {
    const [, target, heading] = ref;
    const p = path.join(ROOT, target);
    if (!fs.existsSync(p)) r.error(`  ✗ ${rp}:${line} 「→ 규칙」이 없는 파일을 가리킨다: ${target}`);
    else if (!headingsOf(p).has(heading)) r.error(`  ✗ ${rp}:${line} 「→ 규칙」이 가리키는 절이 없다: ${target} 「${heading}」`);
}

function checkCases(r, rp, text) {
    for (const s of sections(text)) {
        if (!CASE_HEAD.test(s.head)) r.error(`  ✗ ${rp}:${s.line} 판례 머리는 「### YYYY-MM-DD · 제목」이다: ${s.head.slice(0, 50)}`);
        const refs = s.body.map((l, i) => [RULE_REF.exec(l), s.line + 1 + i]).filter(([m]) => m);
        if (!refs.length) r.error(`  ✗ ${rp}:${s.line} 판례가 가리키는 규칙이 없다 — 「→ 규칙: <경로> 「<절 이름>」」 줄을 단다`);
        for (const [m, line] of refs) checkRuleRef(r, rp, line, m);
    }
}

function checkDecisions(r, rp, text) {
    const seen = new Map();
    const replaced = [];
    for (const s of sections(text)) {
        const m = DECISION_HEAD.exec(s.head);
        if (!m) { r.error(`  ✗ ${rp}:${s.line} 결정 기록 머리는 「### D-번호 · 제목」이다: ${s.head.slice(0, 50)}`); continue; }
        if (seen.has(m[1])) r.error(`  ✗ ${rp}:${s.line} 결정 번호 D-${m[1]}이 겹친다(${seen.get(m[1])}행에도 있다) — 번호는 재사용하지 않는다`);
        seen.set(m[1], s.line);
        const st = s.body.map((l) => STATUS.exec(l)).find(Boolean);
        if (!st) r.error(`  ✗ ${rp}:${s.line} D-${m[1]}에 상태가 없다 — 「상태: 미결정 · 결정됨 · 대체됨 (→ D-번호) · 폐기」`);
        else if (st[2]) replaced.push([st[2], s.line]);
    }
    for (const [to, line] of replaced) {
        if (!seen.has(to)) r.error(`  ✗ ${rp}:${line} 「대체됨」이 없는 번호 D-${to}를 가리킨다`);
    }
}

function checkLinks(r, p, rp, text) {
    const src = blankCode(text);
    for (const m of src.matchAll(/\]\(([^)\s]+)\)/g)) {
        const href = m[1];
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) continue;
        const target = decodeURIComponent(href.split('#')[0]);
        if (!target) continue;
        if (!fs.existsSync(path.resolve(path.dirname(p), target))) {
            const line = src.slice(0, m.index).split('\n').length;
            r.error(`  ✗ ${rp}:${line} 없는 파일을 가리키는 링크: ${href}`);
        }
    }
}

export function check(args = []) {
    const r = new Report('check_docs');
    const files = args.filter((a) => !a.startsWith('-')).length
        ? args.filter((a) => !a.startsWith('-')).map((a) => path.resolve(ROOT, a))
        : walk(ROOT, {ext: ['.md'], skip: (n) => SKIP_DIRS.has(n)});
    const counts = {rule: 0, case: 0, [DECISIONS]: 0, other: 0};
    for (const p of files) {
        const rp = rel(p);
        const text = read(p);
        const kind = kindOf(rp);
        counts[kind]++;
        if (kind === 'rule') checkRule(r, p, text, rp);
        if (kind === 'case') checkCases(r, rp, text);
        if (kind === DECISIONS) checkDecisions(r, rp, text);
        checkLinks(r, p, rp, text);
    }
    if (!args.length) {
        for (const rp of Object.keys(RULE_DOC_MAX_LINES)) {
            if (!fs.existsSync(path.join(ROOT, rp))) r.error(`  ✗ RULE_DOC_MAX_LINES에 적힌 규칙 문서가 없다: ${rp}`);
        }
    }
    return r.done(`완료 — 문서 ${files.length}(규칙 ${counts.rule} · 판례 ${counts.case} · 결정 ${counts[DECISIONS]}), 위반 ${r.errors.length}`);
}
