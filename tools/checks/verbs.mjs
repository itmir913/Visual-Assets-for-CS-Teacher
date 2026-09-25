// 동작의 이름이 한자어인가 — **저장소 전체를 돈다.**
//
//     npm run check -- verbs                 # 저장소 전부 (CI가 쓰는 방식)
//     npm run check -- verbs <파일>…         # 짚은 파일만
//     npm run check -- verbs --report        # 빼 둔 자리까지 세기만 (통과로 끝난다)
//
// 규칙은 CLAUDE.md 「동작의 이름은 한자어로 쓴다」에 있고, **이 파일은 그 규칙의 목록을 든다** —
// 사람이 판단할 자리가 아니라 조회할 자리다.
//
// ## 무엇을 보는가 — 「누르는 것의 글자」
//
// **문장의 일반 동사는 안 본다.** 「값을 고릅니다」·「자료를 나눕니다」는 그냥 동사이고,
// 거기까지 가면 번역투가 된다. 보는 것은 **학생이 누르는 것의 이름**이다.
//
//     HTML  <button> · <option> · <summary> 안의 글자, title= · aria-label= 값
//     JS    innerHTML · textContent · label · name · title 이 있는 줄의 문자열
//
// **퀴즈 선택지는 뺀다.** `checkAnswer(` 를 부르는 버튼은 누르는 것이지만 그 글자는
// 조작의 이름이 아니라 **문제의 답**이다.
//
// **「-기」로 끝나는 꼴만 찾으면 될 것 같지만 안 된다.** 그 「-기」는 이름을 만드는 씨이자
// 어미이기도 해서, 「바꾸기 **때문에**」·「옮기기 **어렵다**」·「담기**지 않는다**」가 통째로
// 걸린다(저장소에서 670곳이 걸렸고 그 대부분이 이것이었다). **자리로 좁히고 낱말로 찾는다.**
//
// ## 예외 — 어디에 있든 막는 것
//
// **어색한 순우리말 동사**는 이름이 아니라 문장에서도 막는다 → `RETIRED_ANYWHERE`.
//
// ## 활용형
//
// **한국어 동사는 활용해서 `grep` 으로 못 잡는다.** 어미가 어간의 마지막 음절과 한 글자로
// 합쳐지기 때문이다 — `펴` + `었` → **폈**, `지우` + `었` → **지웠**. 그래서 어간 접두로
// 찾으면 새어 나간다. **줄을 세울 때 그 낱말의 `-ㄹ`/`-ㅂ` 꼴부터 적는다.**
//
// **한자어와 겹치는 어간은 형태를 하나씩 적는다** — `담` 은 「부담·담당」을, `재` 는
// 「현재·존재·소재」를 잡는다. 넣기 전에 **지금 0건인지 확인한다.** 오탐이 한 번 나면
// 다음 사람이 목록 자체를 안 믿는다.
//
// **못 보는 것 둘.** 목록에 없는 새 순우리말은 못 본다 — 허용 목록이 닫혀 있다는 것은
// 사람만 안다. 그리고 **줄바꿈에 쪼개진 낱말**도 못 본다.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';

const SELF = fileURLToPath(import.meta.url);
const SUFFIXES = ['.html', '.js', '.mjs', '.py', '.css', '.md'];
// 저장소 것이 아니거나 사람이 쓴 글이 아닌 자리.
const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '.idea', 'public', '.github']);

// **아직 손질하지 않아 검사에서 빼 두는 자리.** 비어 있는 것이 목표이고, 지금 비어 있다
// (2026-09-08에 강의노트의 「펼치다」 110곳을 갈아 끼우고 마지막 셋을 뺐다).
// 여기에 폴더를 적는 것은 손질을 미루겠다는 뜻이므로, 적을 때는 언제 뺄지도 함께 적는다.
const PENDING = [];

// 그 줄에 이 표시가 있으면 넘어간다. **규칙을 설명하려면 막은 말을 적어야 한다.**
const SKIP_LINE = 'verbs: 예시';

// ── 닫힌 허용 목록 ───────────────────────────────────────────────────────────
// **동작의 이름으로 쓸 수 있는 순우리말은 이것이 전부다.** 여기 없으면 한자어를 찾는다.
// 줄마다 **왜 남는지**를 적는다 — 까닭이 없는 줄은 다음 사람이 판단으로 늘린 것이다.
const ALLOWED = {
    '열기': '윈도와 한글의 파일 메뉴',
    '닫기': '같은 메뉴',
    '불러오기': '같은 메뉴. 저장한 것을 도로 여는 자리',
    '내보내기': '같은 메뉴',
    '가져오기': '한글·엑셀의 Import',
    '만들기': '「새로 만들기」',
    '되돌리기': '실행 취소',
    '미리보기': '인쇄 미리 보기',
    '끌어다 놓기': '파일을 끌어 옮기는 동작의 이름',
    '멈추기': '재생 중단. 영어도 Stop이고 「중지」보다 교실에서 읽힌다',
    '지우개': '그림 도구의 이름. 그림판·한글이 그렇게 부른다. 「삭제 도구」가 아니다',
    '더하기': '산수 연산의 이름. 「빼기·곱하기·나누기」와 한 짝이다',
    '빼기': '산수 연산의 이름 — 위 「더하기」의 짝일 때만. 자료구조 연산은 「삭제」다',
    '곱하기': '산수 연산의 이름',
    '나누기': '산수 연산의 이름 — 「곱하기」의 짝일 때만. 자료를 가르는 것은 「분할」이다',
};

// ── 물러난 이름 ──────────────────────────────────────────────────────────────
// [활용형 정규식, 쓸 말, 까닭]. **누르는 것의 글자에서만 본다.**
// 앞선 저장소(ml-playgrounds)가 화면 문구를 전수 교체하며 세운 목록을 옮겨 왔다.
const RETIRED_NAMES = [
    [/지우[기고는며]|지웁|지웠|지울|지워/g, '삭제', '자료가 실제로 없어진다'],
    [/비우[기고는]|비웁|비웠/g, '전체 삭제', '영어가 Clear이고 실제로 지운다'],
    [/떼[기고는]|뗀 |뗐/g, '해제', '설정이나 지정을 푼다'],
    [/고르[기고는]|고릅|골라|골랐/g, '선택', ''],
    [/뽑[기고는아았을]|뽑습/g, '추출', ''],
    [/담기|담고|담는|담습|담았|담은 |담을 /g, '추가', ''],
    [/채우[기고는]|채웁|채웠|채워/g, '대체', ''],
    [/매기[기고는]|매긴 |매길 |매겼/g, '평가', ''],
    [/다듬[기고는어]/g, '정제 · 조정', ''],
    [/내려받[기고는아]|내려받습/g, '다운로드', '브라우저가 부르는 말이다'],
    [/고치[기고는]|고칩|고쳐/g, '수정 · 편집', '문서를 통째로 손보는 자리면 「편집」'],
    [/옮기[기고는]|옮깁|옮겼|옮겨/g, '이동', ''],
    [/들어가기/g, '열기', '닫힌 허용 목록에 이미 「열기」가 있다'],
    [/바꾸[기고는]|바꿉|바꿨|바꿔/g, '변경 · 교체 · 조정', '이름은 변경, 밀어내고 넣으면 교체, 값을 옮기면 조정'],
    [/마치기/g, '완료', ''],
    [/꾸러미/g, '압축 파일', '지어낸 말이다'],
];

// ── 어디에 있든 막는 것 ──────────────────────────────────────────────────────
// 이름이 아니라 **문장에서도** 막는다. 모어 화자에게 어색하게 들리는 동사다.
//   펴다   — 펴고 · 펴서 · 펴는 · 펴야 · 펴 · 폈다 · 폈습니다 · 폅니다 · 펼 (수)
//   펼치다 — 펼치고 · 펼쳐 · 펼쳤다 · 펼친 · 펼칠 · 펼침 · 펼칩니다
//   (「피다」의 과거도 `폈` 이라 같은 그물에 걸린다. 그 뜻으로 쓰는 자리가 없다.)
const RETIRED_ANYWHERE = [
    [new RegExp('(?<![가-힣])(' +
        '폈[다습어으지는던을고]' +
        '|폅니다' +
        '|펴[고서는며야지도]' +
        '|펴(?=[\\s.,)」』"\'])' +
        '|펼[치쳐친칠침칩]' +
        '|펼(?=\\s)' +
        ')', 'g'), '전개하다 · 확장하다 · 생성하다', '모어 화자에게 매우 어색하게 들린다'],
];

// ── 「누르는 것의 글자」를 뽑아낸다 ───────────────────────────────────────────
const CONTROL = /<(button|option|summary)\b([^>]*)>([\s\S]*?)<\/\1>/g;
const QUIZ = /checkAnswer\s*\(/;

// **`title` · `aria-label` 은 누르는 것에 붙었을 때만 이름이다.** 그림(`<svg role="img">`)에
// 붙은 같은 속성은 **도해를 소리로 읽어 주는 글**이라 문장이다.
const CONTROL_ATTR = /<(?:button|a|input|select|summary|label|option)\b([^>]*)>/g;
const ATTR_VALUE = /(?<![\p{L}\p{N}_])(?:title|aria-label)\s*=\s*(['"])([\s\S]*?)\1/gu;

// **JS 에서는 그 «값»만 집는다.** 줄에 `title:` 이 있다고 그 줄의 문자열을 다 집으면,
// `{title: '…', body: '설명 문장'}` 의 설명까지 이름으로 읽힌다.
const JS_LABEL = new RegExp(
    '(?:innerHTML|textContent)\\s*=\\s*([\'"`])((?:\\\\.|(?!\\1)[^\\n])*?)\\1' +
    '|(?:(?<![\\p{L}\\p{N}_])label|(?<![\\p{L}\\p{N}_])name|(?<![\\p{L}\\p{N}_])title)\\s*:\\s*([\'"`])((?:\\\\.|(?!\\3)[^\\n])*?)\\3', 'gu');

const TAG = /<[^>]+>/g;

/** [줄, 이름] — 누르는 것의 글자만. 마크업과 아이콘은 걷어낸 알맹이를 준다. */
function* namesIn(src) {
    for (const m of src.matchAll(CONTROL)) {
        // 퀴즈 선택지는 조작의 이름이 아니라 문제의 답이다.
        if (QUIZ.test(m[2])) continue;
        const start3 = m.index + m[0].indexOf('>') + 1;
        yield [lineOf(src, start3), m[3].replace(TAG, ' ')];
    }
    for (const tag of src.matchAll(CONTROL_ATTR)) {
        if (QUIZ.test(tag[1])) continue;
        const attrsAt = tag.index + tag[0].indexOf(tag[1]);
        for (const m of tag[1].matchAll(ATTR_VALUE)) {
            const valAt = m.index + m[0].length - 1 - m[2].length;
            yield [lineOf(src, attrsAt + valAt), m[2]];
        }
    }
    for (const m of src.matchAll(JS_LABEL)) {
        const text = m[2] ?? m[4];
        if (text && /[가-힣]/.test(text)) yield [lineOf(src, m.index), text.replace(TAG, ' ')];
    }
}

/** 그 자리가 닫힌 허용 목록의 말인가. **겹쳐 있으면 허용 쪽이 이긴다.** */
function allowedAt(text, at, hit) {
    const win = text.slice(Math.max(0, at - 6), at + hit.length + 6);
    return Object.keys(ALLOWED).some((w) => win.includes(w));
}

function checkFile(p, r, report) {
    // **이 파일은 자기 그물에 걸린다.** 목록을 여기 적어 두었기 때문이다.
    if (path.resolve(p) === SELF) return;
    const src = read(p);
    const lines = src.split('\n');
    const bad = [];
    const put = (line, msg) => {
        if (line > 0 && line <= lines.length && lines[line - 1].includes(SKIP_LINE)) return;
        bad.push([line, msg]);
    };
    for (const [line, text] of namesIn(src)) {
        for (const [re, 쓸말, 까닭] of RETIRED_NAMES) {
            for (const m of text.matchAll(re)) {
                if (allowedAt(text, m.index, m[0])) continue;
                const tail = 까닭 ? ` — ${까닭}` : '';
                const shown = [...text.split(/\s+/).filter(Boolean).join(' ')].slice(0, 40).join('');
                put(line, `동작의 이름 「${m[0]}」 — 「${쓸말}」로 쓴다${tail} :: ${shown}`);
            }
        }
    }
    for (const [re, 쓸말, 까닭] of RETIRED_ANYWHERE) {
        for (const m of src.matchAll(re)) put(lineOf(src, m.index), `「${m[0]}」 — 「${쓸말}」로 쓴다 — ${까닭}`);
    }
    bad.sort((a, b) => a[0] - b[0] || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0));
    for (const [line, m] of bad) (report ? r.warn : r.error).call(r, `${rel(p)}:${line} ${m}`);
    if (!bad.length) r.note(`${rel(p)} OK`);
}

const under = (p, dirs) => { const x = rel(p); return dirs.some((d) => x === d || x.startsWith(d + '/')); };

function scope(includePending) {
    return walk(ROOT, {skip: (n) => SKIP_DIRS.has(n)})
        .filter((p) => SUFFIXES.includes(path.extname(p)))
        .filter((p) => !rel(p).startsWith('tests/fixtures/'))   // 일부러 틀리게 쓴 검사용 조각
        .filter((p) => includePending || !under(p, PENDING));
}

export function check(args = []) {
    const r = new Report('check_verbs');
    const report = args.includes('--report');
    const picked = args.filter((a) => !['-v', '--verbose', '--report'].includes(a));
    const files = picked.length ? picked.map((a) => path.resolve(ROOT, a)) : scope(report);
    if (!files.length) { r.error('검사할 파일이 없다'); return r; }
    for (const f of files) checkFile(f, r, report);
    if (report) return r.done(`살펴보기 — 파일 ${files.length}(빼 둔 자리까지), 걸린 것 ${r.warnings.length}`);
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.length}, 빼 둔 자리 ${PENDING.length}`);
}
