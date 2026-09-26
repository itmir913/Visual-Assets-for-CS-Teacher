// 시뮬레이터가 쓰는 말이 교과 용어인가 — **HTML 만이 아니라 JS 까지 본다.**
//
//     npm run check -- terms                     # 시뮬레이터 전부 (CI가 쓰는 방식)
//     npm run check -- terms <파일>…             # 짚은 파일만
//
// **왜 따로 있는가.** `html` 검사의 금지어는 HTML 만 읽는다. 그런데 시뮬레이터의 글은
// 거의 전부 JS 안에 있다 — 화면에 찍히는 문장, 버튼 이름, 비용표의 칸까지
// `*-registry.js` 와 `*-ops.js` 가 들고 있다. 그래서 「견주다」를 HTML 에서 다 걷어 내고도
// 시뮬레이터에서는 그대로 살아 있었다.
//
// **검사 범위는 손으로 적지 않는다.** `src/entries/simulator/` 의 진입점에서 `import` 를
// 따라가 실제로 그 페이지에 실리는 모듈만 본다(`simScope`). 새 시뮬레이터를 만들면
// 저절로 딸려 오고, 안 쓰는 모듈은 저절로 빠진다.
//
// **주석도 본다.** 주석에 남아 있으면 다음 사람이 그 말을 따라 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, byPath, lineOf, read, rel, walk} from '../lib/repo.mjs';
import {BANNED_WORDS} from './html.mjs';

// 진입점이 있는 자리. 여기 아래 `.js` 가 곧 「시뮬레이터 한 장」이다.
const ENTRY_DIR = path.join(ROOT, 'src', 'entries', 'simulator');
// 함께 보는 페이지.
const PAGE_DIR = path.join(ROOT, 'simulator');

// 아직 손질하지 않아 검사에서 빼 두는 폴더. **비어 있는 것이 정상이다.**
// 여기에 폴더를 적는 것은 손질을 미루겠다는 뜻이므로, 적을 때는 언제 뺄지도 함께 적는다.
const PENDING = [];

// **여러 줄에 걸친 import 를 놓치지 않는다.** `import {\n  a, b,\n} from '…'` 이 흔한데,
// 줄바꿈을 막아 두었더니 그렇게 적힌 모듈이 통째로 검사에서 빠졌다 —
// 일부러 심어 본 위반이 안 잡혀서 드러났다.
const IMPORT = /(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g;

// ── 용어표 ───────────────────────────────────────────────────────────────────
// [찾는 것, 쓴 말, 쓸 말]. **기준은 「틀린 말인가」가 아니라 「고등학교 정보 교과서와
// 수업에서 그 말을 쓰는가」다.** 옮겨 적은 티가 나는 말과, 순우리말로 풀어 쓰다가
// 교과 용어와 이름이 어긋나 버린 말을 잡는다.
//
// **「값」이 두 가지를 뜻하던 것이 가장 컸다** — 자료의 값과 연산의 비용을 같은
// 낱말로 적고 있었다. 비용은 「비용」으로만 적는다.
export const SIM_TERMS = [
    // 자료구조
    [/마디/g, '마디', '노드'],
    [/나무/g, '나무', '트리'],
    [/(?<![가-힣])잎(?![가-힣])/g, '잎', '단말 노드'],
    [/뿌리/g, '뿌리', '루트'],
    [/머리 포인터/g, '머리 포인터', 'head 포인터'],
    [/꼬리 포인터/g, '꼬리 포인터', 'tail 포인터'],
    [/꼭대기/g, '꼭대기', '맨 위'],
    [/자리 번호/g, '자리 번호', '인덱스'],
    // 자료 안의 위치(0부터 센다)는 「인덱스 3」이다(2026-09-26 사용자 확정). 「3번 칸」「k번째」는
    // 「3번 비교」「두 번째 회차」 같은 횟수·차례와 겉모양이 같아 학생이 둘을 섞는다.
    // 횟수·차례는 뒤에 칸·노드·자리가 붙지 않으므로 그 셋이 붙은 꼴과 변수 이름(i·j·k)만 잡는다.
    [/(?:[0-9}]|\b[ijkn])번째? ?(?:칸|노드|자리)|\b[ijk]번째/g, 'N번 칸 · k번째(위치)', '인덱스 N'],

    // 비용
    [/드는 값/g, '드는 값', '비용'],
    [/값이 싸|값이 비싸|비쌉니다|싸집니다|값을 치르/g, '값이 싸다·비싸다', '비용이 작다·크다'],

    // 동작
    [/훑/g, '훑다', '순차 탐색하다 · 순회하다'],
    // 앞에 한글이 붙으면 「절대 볼 수 없다」처럼 다른 말이다. 앞을 끊어 준다.
    [/(?<![가-힣])대 (보|본|볼|봅|봤|봄)/g, '대 보다', '비교하다 · 대조하다'],
    [/매달/g, '매달다', '연결하다'],
    [/떼어 ?내/g, '떼어 내다', '제거하다'],
    [/번호로 짚|바로 짚/g, '짚다', '접근하다'],

    // 화면·설명
    [/단추/g, '단추', '버튼'],
    // 앞에 한글이 붙으면 다른 말이다 — 「아무리」·「마무리」. 앞을 끊어 준다.
    [/(?<![가-힣])무리/g, '무리', '분류 · 그룹'],
    [/노릇/g, '노릇', '역할'],
    [/뒤엣것/g, '뒤엣것', '뒤에 있는 원소'],
    [/차례가|차례를|차례는|차례도/g, '차례', '순서'],
    // **「판」은 이 저장소에서 두 가지다** — 한 회차라는 뜻과, 퍼즐·체스의 «판»이다.
    // 뒤에 붙어 다른 낱말이 되는 것(판별·판단·판정)도 함께 걸러 낸다.
    [/(?<![가-힣])(?:한|앞|이|그) 판(?!별|단|정|사|례|독|매)|판마다|판이 끝/g, '판', '회차'],
];

// 값이 들어갈 자리에 조사를 손으로 적은 흔적. HTML 은 `html` 검사가 보지만
// 시뮬레이터의 문장은 거의 JS 안에 있어 그쪽에서는 걸리지 않았다.
const JOSA = /(?<!_)(이\(가\)|가\(이\)|은\(는\)|는\(은\)|을\(를\)|를\(을\)|과\(와\)|와\(과\)|\(으\)로)/g;

const under = (p, dirs) => {
    const r = rel(p);
    return dirs.some((d) => r === d || r.startsWith(d.replace(/\/+$/, '') + '/'));
};

/** 진입점에서 import 를 따라가 실제로 실리는 모듈 전부. */
export function reachable(entry) {
    const seen = new Set(), stack = [entry];
    while (stack.length) {
        const cur = stack.pop();
        if (seen.has(cur) || !fs.existsSync(cur)) continue;
        seen.add(cur);
        for (const m of read(cur).matchAll(IMPORT)) {
            const spec = m[1] ?? m[2];
            if (!spec.startsWith('.')) continue;   // npm 패키지는 우리 글이 아니다
            stack.push(path.resolve(path.dirname(cur), spec));
        }
    }
    return seen;
}

/** 검사할 파일 — 진입점에서 닿는 JS 전부 + 시뮬레이터 HTML 전부. */
export function simScope() {
    const out = new Set();
    for (const entry of walk(ENTRY_DIR, {ext: ['.js']})) {
        if (!under(entry, PENDING)) for (const p of reachable(entry)) out.add(p);
    }
    for (const page of walk(PAGE_DIR, {ext: ['.html']})) if (!under(page, PENDING)) out.add(page);
    return [...out].sort(byPath);
}

function checkFile(p, r) {
    const src = read(p);
    const bad = [];
    for (const [re, 쓴말, 쓸말] of [...BANNED_WORDS, ...SIM_TERMS]) {
        for (const m of src.matchAll(re)) bad.push([lineOf(src, m.index), `「${쓴말}」 — 「${쓸말}」로 쓴다 :: ${m[0]}`]);
    }
    // josa.js 는 **이 결함을 고치는 모듈**이라, 어떤 꼴이 잘못인지를 주석에 적어 둔다.
    // 고치는 쪽을 잡으면 검사가 자기 발등을 찍는다.
    if (path.basename(p) !== 'josa.js') {
        for (const m of src.matchAll(JOSA)) {
            bad.push([lineOf(src, m.index), `「${m[0]}」 — 조사를 손으로 적지 않는다. josa()가 값을 보고 고른다`]);
        }
    }
    bad.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    for (const [line, m] of bad) r.error(`${rel(p)}:${line} ${m}`);
    if (!bad.length) r.note(`${rel(p)} OK`);
}

export function check(args = []) {
    const r = new Report('check_sim_terms');
    const picked = args.filter((a) => a !== '-v' && a !== '--verbose');
    const files = picked.length ? picked.map((a) => path.resolve(ROOT, a)) : simScope();
    if (!files.length) { r.error('검사할 파일이 없다'); return r; }
    for (const f of files) checkFile(f, r);
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.length}`);
}
