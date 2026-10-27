// 첫 화면의 전 과목 검색이 **찾을 것을 다 담고 있는가** — 색인을 만들어 보고 따진다.
//
// 색인은 저장소에 담기지 않고 빌드가 굽는다(`tools/vite/search-index.js`). 그래서 소스만 보아서는
// 「무엇이 빠졌는지」를 알 수 없고, 빠져도 **화면은 멀쩡하다** — 찾는 말이 안 나오는 것뿐이라
// 학생은 그 편이 없는 줄 안다. 여기서 기계가 지킨다.
//
//   1. 강의노트가 모두 색인에 있는가            길이 없는 노트는 복습에서 사라진다
//   2. 절 제목 · 본문이 빈 레코드가 없는가       결과에 떠도 무엇인지 알 수 없고 읽을 것도 없다
//   3. 절의 이름이 겹치지 않는가                 겹치면 뒤엣것이 앞엣것의 본문을 덮어 한 절이 사라진다
//   4. 머리 색인과 과목 조각이 짝이 맞는가       짝이 없으면 본문 일치가 점수에 얹히지 않는다
//   5. 푸터의 글이 절에 섞이지 않았는가          섞이면 아무 질의나 모든 편에 걸려 결과가 쓸모없다
//   6. 첫 화면의 질의 변환이 생성기와 같은가     둘이 어긋나면 색인에 있는 말을 못 찾는다
//
// 사용:
//     npm run check -- search-index                  저장소 전체
//     npm run check -- search-index <파일>…          짚은 HTML만 색인해 본다(틀린 조각을 넣어 볼 때)
import path from 'node:path';
import {ROOT, Report, read, rel} from '../lib/repo.mjs';
import {buildIndex, collect, looseSource, normalize} from '../lib/search-index.mjs';
import {readInjected} from '../vite/search-index.js';

const PAGE = 'index.html';

// 첫 화면의 인라인 스크립트에서 질의 변환 세 줄을 꺼낸다. **거기 사본이 있는 것이 정상이다** —
// 평범한 스크립트라 저장소의 모듈을 가져올 수 없다. 그래서 여기서 둘을 같은 말로 돌려 견준다.
const CLIENT_RE = /const normalize = [\s\S]*?const looseSource = [^\n]*\n/;

// 어긋나면 학생이 못 찾게 되는 꼴들. 띄어쓰기 · 대소문자 · 정규식에서 뜻을 갖는 글자.
const PROBES = ['탐색', '기계 학습', '비지도 학습', 'Python', 'for 문', 'C++', 'a.b', '최소제곱법', '  겹친  공백  '];

// 푸터의 저작권 줄. **모든 노트의 푸터에 있고 본문에는 없다** — 색인이 `<main>`보다 큰 그릇을
// 담으면 이 글이 절에 들어온다. 푸터에서 글을 뽑아 견주는 길은 쓰지 않는다 — 속성에 `>`가 든
// 클래스(`[&>*]:min-w-…`)가 있으면 태그를 벗기는 정규식이 거기서 끊겨 뽑은 것이 글이 아니다.
const FOOTER_MARK = 'luminousky';

/** 첫 화면 사본을 함수로 만들어 돌려준다. 못 찾으면 `null`. */
function clientLoose(html) {
    const m = html.match(CLIENT_RE);
    if (!m) return null;
    return new Function(`${m[0]}\nreturn looseSource;`)();
}

export function check(args = []) {
    const picked = args.filter((a) => a.toLowerCase().endsWith('.html'));
    const r = new Report('check_search_index');

    // 짚어 부르면 그 파일만 색인한다 — 과목 폴더 밖의 조각도 색인에 들도록 과목을 하나 지어 준다.
    const notes = picked.length
        ? picked.map((a) => ({rel: rel(path.resolve(ROOT, a)), html: readInjected(rel(path.resolve(ROOT, a))) ?? ''}))
        : collect(readInjected);
    const {heads, parts} = buildIndex(notes, picked.length ? {slug: 'fixture'} : null);

    // 1. 노트마다 레코드가 있는가
    const seen = new Set(heads.map((h) => h.f));
    for (const {rel: f} of notes) {
        if (!seen.has(f)) r.error(`  ✗ ${f}: 색인에 레코드가 없다 — <main> 안에 <section>이 있는가`);
    }

    // 2·3. 글과 짝. 레코드의 이름은 절의 차례다 — 겹치면 본문이 엉뚱한 절에 얹힌다.
    const bodies = new Map();
    const dup = new Set();
    for (const rows of Object.values(parts)) {
        for (const [f, i, b] of rows) {
            const key = `${f}#${i}`;
            if (bodies.has(key)) dup.add(key);
            bodies.set(key, b);
        }
    }
    for (const key of [...dup].sort()) {
        r.error(`  ✗ ${key}: 절의 이름이 겹친다 — 그 절 하나가 색인에서 사라진다`);
    }
    for (const h of heads) {
        const key = `${h.f}#${h.i}`;
        if (!h.t) r.error(`  ✗ ${h.f}: 문서 제목이 비었다 — <title>`);
        if (!h.h) r.error(`  ✗ ${key}: 절 제목이 비었다 — 그 절의 <h2> · <h3>`);
        if (!bodies.has(key)) r.error(`  ✗ ${key}: 머리 색인에 있는데 과목 조각에 본문이 없다`);
        else if (!bodies.get(key).trim()) r.error(`  ✗ ${key}: 본문이 비었다`);
    }

    // 4. 과목 조각에만 있는 레코드
    const headKeys = new Set(heads.map((h) => `${h.f}#${h.i}`));
    for (const key of bodies.keys()) {
        if (!headKeys.has(key)) r.error(`  ✗ ${key}: 과목 조각에 있는데 머리 색인에 없다`);
    }

    // 5. 틀이 섞였는가 — 색인이 담는 그릇이 `<main>`보다 커지면(`<body>` 따위) 머리말 · 목차 ·
    // 푸터가 절에 들어가 아무 질의나 모든 편에 걸린다.
    const leak = [...bodies].filter(([, b]) => b.includes(FOOTER_MARK));
    if (leak.length) {
        r.error(`  ✗ 푸터의 저작권 줄(「${FOOTER_MARK}」)이 절 ${leak.length}곳에 들었다`
            + ` (${leak[0][0]} 따위) — 색인이 <main>보다 큰 그릇을 담는다 (tools/lib/search-index.mjs 의 MAIN)`);
    }

    // 6. 첫 화면의 사본이 생성기와 같은 답을 내는가. 짚어 부른 때는 보지 않는다 — 조각과 무관하다.
    if (!picked.length) {
        const loose = clientLoose(read(path.join(ROOT, PAGE)));
        if (!loose) {
            r.error(`  ✗ ${PAGE}: 질의 변환(normalize · looseSource)을 찾지 못했다`
                + ' — 이름을 바꿨다면 tools/checks/search-index.mjs 의 CLIENT_RE도 함께 고친다');
        } else {
            for (const q of PROBES) {
                const mine = looseSource(q);
                const theirs = loose(q);
                if (mine !== theirs) {
                    r.error(`  ✗ ${PAGE}: 질의 「${q}」의 변환이 생성기와 다르다 (화면 ${theirs} ≠ 생성기 ${mine})`);
                }
            }
            if (normalize('  겹친  공백  ') !== '겹친 공백') r.error('  ✗ normalize가 공백을 한 칸으로 모으지 않는다');
        }
    }

    const files = new Set(heads.map((h) => h.f)).size;
    return r.done(`완료 — 강의노트 ${files}, 절 ${heads.length}, 과목 조각 ${Object.keys(parts).length}, 위반 ${r.errors.length}`);
}
