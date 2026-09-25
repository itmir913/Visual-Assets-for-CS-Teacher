// 강의노트와 시뮬레이터의 문장 정제에서 물러난 말이 다시 들어오지 않았는가.
//
//     npm run check -- prose                 # 모든 과목 + 시뮬레이터 (CI가 쓰는 방식)
//     npm run check -- prose <파일>…         # 짚은 파일만 — 정제 중에 쓴다
//     npm run check -- prose --report        # 정제 전 파일까지 과목별로 센다 (통과로 끝난다)
//
// ## 왜 있는가 — 한 번 배운 것을 다음 과목이 공짜로 받게
//
// 문장 정제(2026-09-24, 데이터과학부터)는 사람이 읽고 고치는 일이다. 그런데 고친 말의
// **대부분은 다른 과목에도 똑같이 있다.** 데이터과학에서 「짚다」를 「파악하다」로 갈았다면
// 다른 과목의 「짚다」는 읽지 않고도 찾을 수 있어야 한다. 그래서 **정제에서 한 번 물러난
// 말은 이 파일의 목록에 올린다** — 다음 과목의 검수는 이 목록을 먼저 돌리고 시작한다.
//
// ## 시뮬레이터도 같은 기준으로 막는다
//
// 강의노트와 시뮬레이터가 다른 기준으로 막히면 둘의 말이 서로 갈라진다(2026-09-24 사용자
// 지시). 범위는 `terms` 검사의 `simScope()` 를 그대로 쓴다 — 시뮬레이터 페이지 HTML 과, 그
// 진입점에서 `import` 로 닿는 JS 다. **JS 와 인라인 `<script>` 는 문자열 리터럴 속만 본다.**
// 주석 · 식별자 · 코드는 학생 화면에 나오지 않는다. HTML 주석과 `<style>` 도 같은 까닭으로
// 뺀다. 강의노트에만 맞는 규칙은 `LECTURE_ONLY` 에 적는다.
//
// `verbs` 검사와 나뉘는 자리 — 그쪽은 **누르는 것의 이름**을 보고, 이쪽은 **강의노트와
// 시뮬레이터의 문장**을 본다. 「고르다」는 버튼 이름으로는 물러났지만 문장에서는 그대로 쓴다.
//
// ## 톱니 — 정제를 마친 파일만 막는다
//
// 목록은 모든 과목을 돌지만 **`isDone()` 이 참인 파일에서만 위반으로 친다** — `DONE` 에
// 적힌 강의노트와, 통째로 막는 시뮬레이터다. 2026-09-24에 다섯 과목과 시뮬레이터가 모두
// 정제를 마쳐 지금은 전체가 막힌다. `DONE` 은 새 과목 폴더가 생길 때 그 과목을 정제하는
// 동안 빼 두는 자리로 남긴다 — 걸린 자리는 `--report` 가 작업 목록으로 내놓는다.
// **한 번 올린 파일은 되돌아가지 않는다.**
//
// ## 목록에 올리는 법
//
// 1. **활용형 정규식**을 쓴다. 한국어 동사는 어미가 어간과 한 글자로 합쳐져
//    (`짚`+`어` → 짚어, `따지`+`어` → **따져**) 어간 접두로는 새어 나간다.
// 2. **`예` 에 실제로 걸려야 할 꼴을 적는다.** 이 파일은 돌 때마다 먼저 자기 목록을 시험해
//    (`selfTest`) `예` 가 하나라도 안 걸리면 멈춘다. 「재다」가 금지어였는데도 `재던` · `재라` 가 빠져
//    일곱 곳이 살아 있던 일을 반복하지 않으려는 장치다.
// 3. **`아님` 에 걸리면 안 되는 꼴을 적는다.** 「갈리다」를 막으며 「헷갈리다」를
//    잡으면 다음 사람이 목록 자체를 안 믿는다.
// 4. **넣기 전에 `--report` 로 전체를 돌려 오탐이 없는지 본다.**
//
// **설명하려고 막은 말을 적어야 하는 줄에는 `prose: 예시` 를 단다.**
//
// ## 문체 기준서 — 두 갈래로 막는다
//
// 문체 기준서(2026-09-24 사용자 확정)는 CLAUDE.md 「문체 기준서」 절에 있다. 그 가운데
// **기계로 고칠 수 있어 저장소 전체를 한 번에 고친 것**은 `STYLE_NOW` · `EMOJI` ·
// `quizHead()` 가 곧바로 막는다. **사람이 읽고 고쳐야 하는 것**은 `styleLater()` 가 보고,
// `STYLE_DONE` 에 올린 과목에서만 막는다 — 나머지는 `--report` 가 과목별 · 규칙별로 센다.
// 2026-09-25에 다섯 과목이 모두 올라 지금은 전체가 막힌다.
//
// 정규식의 `\w` · `\b` 는 파이썬처럼 한글까지 낱말 글자로 보도록 `u` 플래그와 `\p{L}` 로 적는다.
import path from 'node:path';
import {ROOT, SUBJECTS, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';
import {proseText, unescape} from '../lib/prose-text.mjs';
import {simScope} from './terms.mjs';

const SKIP_LINE = 'prose: 예시';

// ── 정제를 마친 파일 ─────────────────────────────────────────────────────────
// 글롭. 사용자 확인까지 끝난 것만 올린다. `*` 는 폴더를 건너지 못한다.
const DONE = [
    '데이터과학/*.html',   // 2026-09-24 전 중단원 정제 마감. 사용자 실측은 모든 과목 뒤에 한다
    '인공지능기초/*.html',       // 2026-09-24 Ⅰ~Ⅳ단원 정제 마감
    '인공지능기초/실습/*.html',  // 2026-09-24 실습 보고서 일곱 편 정제 마감
    '정보(고등학교)/*.html',     // 2026-09-24 Ⅰ~Ⅴ단원 정제 마감
    '소프트웨어와생활/*.html',   // 2026-09-24 Ⅰ~Ⅴ단원 정제 마감
    // 프로그래밍은 하위 폴더가 넷이다. `*` 는 폴더를 건너지 못하므로 따로 적는다.
    '프로그래밍/기초/*.html',    // 2026-09-24 정제 마감
    '프로그래밍/실습/*.html',    // 2026-09-24 정제 마감
    '프로그래밍/c/*.html',       // 2026-09-24 C 01~17 정제 마감
    '프로그래밍/py/*.html',      // 2026-09-24 파이썬 01~15 정제 마감
];

// 파이썬 `\w` 와 같은 낱말 글자.
const W = '[\\p{L}\\p{N}_]';
const re = (s) => new RegExp(s, 'gu');

// ── 물러난 말 ────────────────────────────────────────────────────────────────
// [정규식, 쓴 말, 쓸 말, 예 — 걸려야 하는 꼴, 아님 — 걸리면 안 되는 꼴]
// **순우리말 동사는 꼭 필요한 자리가 아니면 한자어 동사로 쓴다**(2026-09-24 사용자 확정).
// 한국 학생에게 교과서 문장으로 읽히는 쪽이 그쪽이다.
const H = '(?<![가-힣])';   // 낱말 첫머리 — 「헷갈리다」 속의 「갈리다」 같은 것을 거른다
const VERBS = [
    // 「짚은 · 짚음 · 짚자」는 프로그래밍에서 새어 나간 꼴이다.
    [H + '짚(?:[다고어었는을으은음자지게기]|습|읍)', '짚다', '파악하다 · 지적하다 · 확인하다',
        ['짚다', '짚어 보면', '짚을 수', '짚고', '짚습니다', '앞서 짚은', '짚음', '짚자'], ['짚신']],
    ['뜯어\\s?(?:보|봅|봐|봤|볼|본)', '뜯어보다', '분석하다 · 하나씩 살펴보다',
        ['뜯어봅시다', '뜯어 보면', '뜯어본'], []],
    ['펼(?:치|쳐|쳤|칠|친|침)|' + H + '(?:펴[다고서며면]|폈)', '펼치다 · 펴다', '확장하다 · 전개하다 · 나열하다',  // verbs: 예시
        ['펼쳤지만', '넓게 펼쳤다가', '한 줄로 펴면', '폈다'], ['살펴보다', '살펴서']],  // verbs: 예시
    ['들여다\\s?(?:보|봅|봐|봤|볼|본)', '들여다보다', '살펴보다',
        ['들여다봅시다', '들여다보면', '들여다 봐야'], []],
    [H + '손(?:보[다고는며면아았야지기]|봅|봐|봤|볼 |본 )', '손보다', '정리하다 · 점검하다 · 수정하다',
        ['손보는 일', '미리 손봅니다', '손봐야'], ['손 보호']],
    // 「따지지 않」은 시뮬레이터에서 새어 나간 꼴이다.
    [H + '따(?:지[다고는며면자지]|져|졌|질 |진 |집)', '따지다', '비교하다 · 검토하다',
        ['따져 볼', '따지면', '따집니다', '순서를 따지지 않고'], ['따지막']],
    // 「솎다 · 돌리다(실행) · 뒤지지 않고」는 시뮬레이터 정제(2026-09-24)에서 물러났다.
    [H + '솎(?:[다고는아았을으지기]|습)', '솎다', '건너뛰다 · 제외하다',
        ['가지를 솎아 내면', '솎는다', '솎습니다'], []],
    // 실행의 뜻만 막는다 — 「되돌리다 · 돌려주다 · 돌려보내다 · 눈을 돌리다 · ~문제로
    // 돌리다(귀속) · 모터를 돌리다(회전) · 설문지를 돌리다(배부) · 원형 큐의 인덱스를
    // 돌리다(회전)」는 다른 말이다. 앞말로 가르는 것은 그 뜻이 실제로 쓰인 자리다.
    [H + '(?<!눈을 )(?<!고개를 )(?<!문제로 )(?<!탓으로 )(?<!모터를 )(?<!장치를 )(?<!설문지를 )' +
        '(?<!발전을 )(?<!함께 )(?<!미리 )(?<!칸 )(?<!자리를 )(?<!인덱스를 )(?<!인덱스만 )' +
        '(?<!방향을 )돌(?:리(?![라])|린|릴|립|려(?!\\s?(?:주|줄|준|줍|줘|줬|받|보[내낸냈낼냅]|놓|놨|지|진)))',
    '돌리다(실행)', '실행하다',
    ['한 번 돌려서', '돌려 보면', '직접 돌려봅시다', '돌리면', '다시 돌려도',  // verbs: 예시
        '돌린 결과', '돌릴 때마다', '다시 돌려 비교', '여러 번 돌린다', '돌립니다', '돌리기 전에'],  // verbs: 예시
    ['되돌려서', '돌려주는', '돌려줄', '돌려받은', '눈을 돌려 보면', '돌려보내다', '돌려보낸',  // verbs: 예시
        '돌려보냅니다', '모터를 돌린다', '의지 문제로 돌리면', '설문지를 돌리고',  // verbs: 예시
        '인덱스를 돌려 쓰면', '자동으로 돌려지지는']],  // verbs: 예시
    ['뒤져서|뒤져\\s?(?:보|찾)|뒤지지\\s?않(?!는)', '뒤지다', '찾아보다 · 탐색하다',
        ['뒤져서 찾아봄', '뒤져 보면', '전부 뒤지지 않고'], ['뒤지지 않는']],
    // 갈래에 속한다는 뜻의 「들다」만 막는다(2026-09-25 사용자 지시) — 「힘이 듭니다 · 점 하나에
    // 드는 칸 · 손에 드는 기기 · 마음에 드는」은 다른 말이라 「드는」은 보지 않는다.
    ['(?:여기|[가-힣]에)\\s(?:듭니다|든다)(?![가-힣])', '(~에) 들다', '포함되다 · 속하다',
        ['여기 듭니다', '여기에 든다', '분포 시각화에 듭니다'], ['힘이 듭니다', '점 하나에 드는 칸', '마음에 드는 결과']],
    ['뽑아\\s?(?:내|낸|냈|낼|냅)', '뽑아내다', '추출하다 · 추리다',
        ['뽑아내며', '뽑아 낸'], []],
    ['흉내\\s?(?:내|낸|냈|낼|냅)', '흉내 내다', '따라 하다 · 활용하다',
        ['흉내 내면', '흉내낸'], []],
    ['밀어\\s?올(?:리|린|렸|릴|립|려)', '밀어 올리다', '높이다 · 증가시키다',
        ['밀어 올린', '밀어올렸다'], []],
    // 「갈린다 · 갈릴까」는 인공지능기초에서 새어 나간 꼴이다. 「갈릴레이」는 사람 이름이다.
    [H + '갈(?:리[는고며면지다]|린|렸|릴(?!레)|립)', '갈리다', '구분되다 · 나뉘다',
        ['갈리는 지점', '갈립니다', '갈린 ', '답이 갈린다', '왜 갈릴까'],
        ['헷갈리는', '헷갈립니다', '갈릴레이']],
    // 「가릅니다 · 갈랐 · 갈라 보기」는 소프트웨어와생활에서 새어 나간 꼴이다.
    // 「갈라 내다 · 갈라 놓다 · 갈라 두다」는 프로그래밍·정보에서 새어 나간 꼴이다.
    // 「갈라 처리 · 갈라야 · 갈라서」처럼 뒤에 무엇이 붙든 「갈라」 꼴은 전부 막는다.
    // 자동사 「갈라지다」도 함께 물러났다(→ 나뉘다). 「갈라파고스 · 갈라쇼」는 다른 낱말이다.
    [H + '(?:갈라(?!파고스|쇼)|가른|가를|가르[는고며면기]|가릅|갈랐)',
        '가르다 · 갈라지다', '구분하다 · 나누다 · 나뉘다',
        ['갈라 줍니다', '가르는 기준', '가른다', '가릅니다', '무엇이 갈랐을까', '갈라 보기',
            '승부를 가른 것', '둘을 가를 때',
            '갈라 낼 수', '갈라놓을 수', '갈라 놓는 일', '갈라 두었기',
            '갈라 처리한다', '갈라야 한다', '갈라 적은', '갈라서', '갈라지는', '갈라졌다', '갈라집니다', '재질별로 가르기'],
        ['가르치는', '가르쳐', '갈라파고스', '갈라쇼', '여러 갈래']],
    [H + '(?:가릴\\s?수|가리기(?!\\s?때문)|가려\\s?(?:내|낸|낼|냅|보(?!이)|봅|봐|봤|볼|본))', '가리다(구별)', '구별하다 · 판단하다',
        ['가릴 수 있을까', '가려낸다', '가려 보는 것', '가려봅시다', '넘겼는지 가리기'],
        ['가려진', '가리키는', '가려 보이지', '가리키기', '글자를 가리기 때문']],
    // 크롤링을 「긁어 오다」로 풀어 썼다 — 교과서와 이어지는 말은 수집이다(소프트웨어와생활 3-1-3).
    ['긁어\\s?(?:오|온|올|와|옵|모으|모아|모은)', '긁어 오다', '수집하다',
        ['긁어 오기', '긁어 온다', '긁어 와서', '긁어 모으기'], ['긁어내다']],
    ['이리저리', '이리저리', '여러 방향으로 · 다양하게',
        ['이리저리 살펴보는'], []],
    // 전처리를 파일마다 「다듬는 일」「정리하는 일」로 달리 불렀다 — 한 개념에 한 낱말.
    [H + '다듬(?:[다고는어었을으지기]|습)', '다듬다', '정리하다 · 손질하다',
        ['다듬는 일', '다듬어야', '다듬습니다'], []],
];

// ── 물러난 틀 ────────────────────────────────────────────────────────────────
// 낱말이 아니라 **문장의 모양**이다. 사람이 쓴 글에 드물고 생성된 글에 흔한 것만 올린다.
const PATTERNS = [
    // 과목 사이에서 갈리던 복합 용어 표기(2026-09-25 사용자 확정) — 인공지능기초 표기가 기준이고,
    // 그 과목에 없는 「운영 체제」는 정보 표기를 따른다.
    ['결정계수', '결정계수', '결정 계수', ['결정계수(R²)'], ['결정 계수']],
    ['표준편차', '표준편차', '표준 편차', ['표준편차가 크다'], ['표준 편차']],
    ['상자그림', '상자그림', '상자 그림', ['상자그림으로'], ['상자 그림']],
    ['의사\\s코드', '의사 코드', '의사코드', ['의사 코드로 적는다'], ['의사코드']],
    ['운영체제', '운영체제', '운영 체제', ['운영체제가'], ['운영 체제']],
    ['꺾은선|' + H + '선\\s그래프|(?:막대|선|파이)\\s차트', '꺾은선 · 선 그래프 · ~ 차트',
        '선그래프 · 막대그래프 · 원그래프', ['꺾은선 그래프', '꺾은선으로', '선 그래프', '막대 차트', '파이 차트'],
        ['선그래프', '막대그래프', '직선 그래프']],
    ['데이터\\s세트', '데이터 세트', '데이터셋', ['붓꽃 데이터 세트'], ['데이터셋']],
    ['K-평균', 'K-평균', 'k-평균', ['K-평균 군집화'], ['k-평균']],
    // 「첨자 · 자리 번호(인덱스 뜻)」는 과목 간 점검(2026-09-25)에서 물러났다 — 교과 용어는 인덱스.
    ['(?<!아래\\s?)첨자|자리\\s번호', '첨자 · 자리 번호', '인덱스(메모리 번호라면 주소)', ['첨자는 0부터', '자리 번호로 꺼낸다'], ['인덱스', '아래첨자']],
    ['[이가]\\s+곧\\s+[가-힣 ]{1,15}입니다', '「A가 곧 B입니다」 격언투',
        '사실을 평서문으로 적는다', ['이름이 곧 설명입니다', '이유가 곧 실력입니다'], []],
    // 「~의 정체입니다 · 남는 장사 · 헤쳐모여 · 타보기」는 시뮬레이터 정제(2026-09-24)에서 물러났다.
    ['의 정체(?:입니다|이다|다\\.)', '「~의 정체입니다」 격언투', '사실을 평서문으로 적는다',
        ['이것이 과적합의 정체입니다'], ['정체된 도로']],
    ['남는\\s?장사', '「남는 장사」', '「이득」', ['충분히 남는 장사입니다'], []],
    ['헤쳐\\s?모여', '「헤쳐모여」', '「다시 모으기 · 재배치」', ['헤쳐모여!'], []],
    [H + '타\\s?보기', '「타보기」', '「체험」', ['타보기', '직접 타 보기'], ['데이터 보기']],
    ['판단의 열쇠', '「판단의 열쇠」', '판단 기준', ['판단의 열쇠'], []],
    ['한 걸음 더 들어가', '「한 걸음 더 들어가서」', '빼고 바로 말한다',
        ['한 걸음 더 들어가서'], []],
    ['흔한 오해\\s*&mdash;|흔한 오해\\s*—', '「흔한 오해 —」 머리말', '문장으로 풀어 쓴다',
        ['흔한 오해 &mdash;', '흔한 오해 —'], []],
    ['쉽게 말하면(?:</strong>)?\\s*(?:&mdash;|—)', '「쉽게 말하면 —」 머리말', '「예를 들어」로 문장을 잇는다',
        ['<strong>쉽게 말하면</strong> &mdash;', '쉽게 말하면 —'], ['쉽게 말하면 이렇습니다']],
    ['잘하는 것</strong>\\s*&mdash;|잘하는 것\\s*—', '「잘하는 것 —」 머리말', '문장으로 풀어 쓴다',
        ['<strong>잘하는 것</strong> &mdash;', '잘하는 것 —'], []],
    // 「오늘」은 수업 시간을 전제한다. 강의노트는 혼자 읽히기도 하고 차시가 바뀌기도 한다.
    ['오늘 배운', '「오늘 배운」', '「배운」', ['오늘 배운 내용을 확인해 봅시다'], []],
    // 앞 차시를 가리키는 말(2026-09-24 사용자 확정). 뒤 차시 예고를 막은 까닭과 같다 —
    // 강의노트는 낱개로 읽히고 순서가 바뀌므로, 「앞 시간」은 없는 시간이나 다른 차시를
    // 가리키게 된다. 필요한 개념은 그 자리에서 짧게 다시 말한다.
    // 「소절」은 강의노트 한 편을 가리킨다 — 「앞 소절」은 앞 파일이다(데이터과학 2-2).
    ['(?:앞|지난|이전)\\s?(?:시간|차시|수업|단원|소절)|앞 절에서', '앞 차시 참조',
        '그 자리에서 개념을 다시 말한다',
        ['앞 시간에 배운', '지난 시간', '이전 차시', '앞 절에서 배웠습니다', '앞 단원에서 배운',
            '앞 소절에서 내려받은'],
        ['앞에서 본', '앞 절반']],
    // 단원 번호로 다른 단원을 가리키는 말, 실습끼리의 차례(소프트웨어와생활에서 새어 나갔다).
    ['[ⅠⅡⅢⅣⅤ]\\s?단원(?:에서|의|과)|앞\\s?실습', '앞 단원 참조',
        '그 자리에서 개념을 다시 말한다',
        ['Ⅰ단원에서 배운', 'Ⅱ단원의 네 기준', '앞 실습에서는'], ['이 단원에서', '다섯 단원이', 'Ⅱ단원 ']],
    // 번호로 다른 강의노트를 가리키는 말(프로그래밍에서 새어 나갔다). 차시 번호 ·
    // 아라비아 숫자 단원 · 「2-1에서」 같은 강의노트 번호는 순서가 바뀌면 다른 파일을 가리킨다.
    ['(?<![\\d\\-])\\d{1,2}\\s?차시(?:의|에서|에|와|과|를|을|로|부터|까지|가|는)', '차시 번호 참조',
        '그 자리에서 개념을 다시 말한다',
        ['01차시의 변수', '04차시에서 본', '3 차시와'], ['차시마다', '이 차시에서', '1-2차시']],
    ['(?<![\\d가-힣ⅠⅡⅢⅣⅤ])\\d\\s?단원(?:에서|의|과|을|를|로)', '단원 번호 참조',
        '그 자리에서 개념을 다시 말한다',
        ['3단원에서 배운', '2 단원의'], ['이 단원에서', '다섯 단원의', 'Ⅲ단원에서 다시']],
    [`(?<![\\p{L}\\p{N}_.\\-/#:])\\d-\\d(?:-\\d)?\\s?(?:에서|의\\s|장|절|차시)`, '강의노트 번호 참조',
        '그 자리에서 개념을 다시 말한다',
        ['2-1에서 본', '1-2의 표', '3-2-6에서'],
        ['6-4의', 'x-1의', '2023-2-1에서', 'code/1-2.조건.c', '#2-1에서', '10-2에서']],
    // 「배웠습니다 · 앞에서 배운 대로」는 앞 차시를 전제한다(프로그래밍에서 새어 나갔다).
    // 인공지능이 「배운 대로 답한다」처럼 학습을 말하는 문장은 걸지 않는다.
    ['배웠(?:습니다|듯이|던|지요|죠)|(?:앞에서|이미|전에|때|에서)\\s?배운\\s?(?:대로|것처럼|바와)',
        '배운 것 참조', '그 자리에서 개념을 다시 말한다',
        ['이미 배웠습니다', '배웠듯이', '앞에서 배운 대로', '수업에서 배운 것처럼'],
        ['배운 대로 답할 뿐', '배운 내용', '배운 규칙으로']],
    ['고치는 값', '「고치는 값」', '「고치는 비용」', ['고치는 값이 커진다'], []],
    // 뒤 차시 예고는 `html` 검사가 막지만 「다음 소절」은 그 그물을 빠져나갔다(데이터과학 2-1-2).
    ['다음 소절', '뒤 차시 예고(다음 소절)', '「지금은 ~까지만 씁니다」',
        ['다음 소절에서 처리 방법을 배웁니다'], []],
    // 데이터과학 3-1 에서 새어 나간 예고의 꼴들.
    ['이 단원 뒤쪽|(?:이어서|다시) 만나게|단원에서 다시 만나', '뒤 차시 예고', '「지금은 ~까지만 씁니다」',
        ['이 단원 뒤쪽에서', '이어서 만나게 됩니다', 'Ⅲ단원에서 다시 만나게 됩니다'], ['다시 만나지 않을']],
    // 「지금까지 배운」은 앞 차시를 전제한다 — 앞 차시 참조 그물을 빠져나갔다(데이터과학 3-2).
    ['지금까지 배운', '「지금까지 배운」', '배운 내용을 이름으로 말한다',
        ['지금까지 배운 것을 한 번에'], ['지금까지 회귀 모델이']],
    ['오늘의 목표', '「오늘의 목표」', '「이 실습의 목표」', ['오늘의 목표'], []],
    // 다른 강의노트로 거는 링크(2026-09-24 사용자 확정). 용어에 건 링크도 앞 차시로 가는
    // 바로가기다 — 순서가 바뀌면 뒤 차시를 가리키고, 글은 링크 없이 읽혀야 한다.
    // 목록(../index.html) · 시뮬레이터(../simulator/) · 바깥 주소는 강의노트가 아니다.
    ['href="(?!\\.\\./|https?:|#|/)[^"]+\\.html', '다른 강의노트로 가는 링크',
        '링크를 빼고 그 자리에서 뜻을 말한다',
        ['href="3-4-1.연관-분석의-이해.html"'],
        ['href="../index.html"', 'href="../simulator/ai/unsupervised-k-means.html"',
            'href="https://example.com/a.html"', 'href="#quiz"']],
    // 어원 풀이가 같은 틀로 반복되었다 — 「한자의 前과 영어의 pre-가 같은 자리에
    // 있습니다」 「preview의 그 pre-입니다」가 파일마다 새로 나왔다.
    ['같은 자리에 있습니다', '「같은 자리에 있습니다」 어원 틀', '「모두 ~를 뜻합니다」',
        ['pre-가 같은 자리에 있습니다'], []],
    ['의 그 (?:<strong>)?[A-Za-z]+(?:</strong>)?-?입니다', '「~의 그 X-입니다」 어원 틀',
        '예시는 한 번만, 「~가 그 예입니다」',
        ['preview(미리 보기)의 그 pre-입니다', '의 그 <strong>dependent</strong>입니다'], []],
];

// ── 문체 기준서: 곧바로 막는 것 ──────────────────────────────────────────────
// 문체 기준서(2026-09-24 사용자 확정, CLAUDE.md 「문체 기준서」 절) 가운데 **기계로 고칠 수
// 있어 한 번에 다 고친 것**이다. 과목을 가리지 않고 시뮬레이터 화면 글에도 건다.
const STYLE_NOW = [
    // 기준서 2 — 정답 해설은 감탄사 없이 이유부터. 오답 해설은 「맞습니다」로 열지 않는다
    // (「틀린 것은?」 문항에서 오답을 누른 학생이 「맞았다」로 읽는다).
    ['(?:맞습니다|정확합니다|정답입니다|정답|훌륭합니다|잘했습니다)!', '해설 첫머리 감탄사',
        '감탄사를 빼고 첫 문장에서 이유를 말한다', ['맞습니다!', '정답입니다! 잘 이해했습니다.'],
        ['맞습니다.', '정답은 셋입니다!']],
    ["checkAnswer\\(this,\\s*true,\\s*'(?:맞습니다|정확합니다|정답입니다|정답)[.!]|" +
    "checkAnswer\\(this,\\s*true,\\s*'[^'.!?]{0,40}!|" +
    "checkAnswer\\(this,\\s*false,\\s*'(?:맞습니다|아쉽습니다|옳습니다|사실입니다|" +
    '(?:맞는|옳은|올바른|바른|정확한) (?:설명|말|내용|진술)입니다)',
    '해설 첫머리 판정', '첫 문장에서 그 선택지의 내용이나 까닭을 말한다',
    ["checkAnswer(this, true, '맞습니다. 표본이", "checkAnswer(this, true, '이것이 알맞지 않습니다! 기기",
        "checkAnswer(this, false, '맞습니다. 그래서", "checkAnswer(this, false, '맞는 설명입니다. 풀링은",
        "checkAnswer(this, false, '옳은 설명입니다."],
    ["checkAnswer(this, true, '표본이 작으면", "checkAnswer(this, true, '정답 없이 묶는다",
        "checkAnswer(this, false, '넣은 이유를 검토하는 것은 올바른 태도입니다."]],
    // 기준서 3 — 인용·강조 부호는 「 」 하나.
    ['[‘’“”«»]|&[lr][sd]quo;|&[lr]aquo;', '굽은 따옴표 · 겹화살괄호', '「 」',
        ['&lsquo;안다&rsquo;', '“네”', '«자리»'], ['「자리」', "'a'"]],
    // 기준서 12 — 라벨 · 영문 머리표 · 해시태그. 「지어낸 예)」처럼 괄호를 닫는 「예」는 라벨이 아니다.
    // 「예:」「예시:」도 라벨이다. 괄호 속 「(예: …)」는 문장에 덧붙인 것이라 둔다.
    [`(?<!${W})VS(?!${W})(?!\\s?Code)|CHECK-?UP|※|&#8251;|핵심 해석\\s*:|(?<![가-힣] )(?<![가-힣])예\\)\\s*[^\\s<]|` +
    '(?<![가-힣A-Za-z(])예(?:시)?\\s?:',
    '라벨 · 머리표', '문장으로 풀어 쓰고, 상자 이름은 공통 어휘로',
    ['A VS B', 'CHECK-UP', '※ 참고', '<strong>핵심 해석:</strong>', '예) 긴 가래떡', '(예) 분실물',
        '예: 나이, 키', '<strong>예시:</strong> 매점', '로봇 청소기 예시:', 'placeholder="예: 사과"'],
    ['VS Code', '(수업에서 원리를 확인하려고 지어낸 예)', '(수업용 예)</p>', '(예: 로봇 팔, 스피커)',
        '사례: 가', '해 보기: 주제']],
    [`(?<![&\\p{L}\\p{N}_/#"'])#[가-힣]`, '해시태그', '낱말을 가운뎃점으로 잇는다',
        ['#얼굴인식 #음성인식'], ['href="#퀴즈"', "'#결과'", '&#8251;']],
];

const RULES = [...VERBS, ...PATTERNS, ...STYLE_NOW].map(([p, 쓴, 쓸, 예, 아님]) => [re(p), 쓴, 쓸, 예, 아님]);
const hit = (rx, s) => { rx.lastIndex = 0; return rx.test(s); };

// 기준서 12의 이모지 — **강의노트에만** 쓴다. 시뮬레이터 화면의 이모지는 지우지 않는다
// (2026-09-24 사용자 확정). 시뮬레이터에서 이모지는 라벨이 아니라 화면의 그래픽이다.
const EMOJI = /[\u{1F300}-\u{1FAFF}✅❌⚠✨✋✂✏⭐❗❓⏰⌛☕✈❤☀]\u{FE0F}?(?:\u{200D}[\u{1F300}-\u{1FAFF}☀-➿]\u{FE0F}?)*/gu;
const EMOJI_EXAMPLES = [['💡 예', '✏️ 스스로 활동', '🎉 목표 도달'], ['☑ 확인', '✓ 정답', '★', '➔']];

// 기준서 12 — 상자 이름으로 쓴 배지는 그 절의 제목과 같아야 한다(2026-09-24 사용자 확정).
// 퀴즈 절에 「스스로 점검하기」 배지를 달고 제목을 「확인 퀴즈」로 두면 한 머리에 이름이 둘이다.
const BADGE_NAMES = ['스스로 점검하기'];
const BADGE_HEAD = new RegExp(`<span(?!${W})[^>]*(?<!${W})rounded-full(?!${W})[^>]*>\\s*([^<]*?)\\s*</span>\\s*<h2(?!${W})[^>]*>([\\s\\S]*?)</h2>`, 'gu');
const BADGE_EXAMPLES = [['<span class="rounded-full">스스로 점검하기</span>\n<h2 class="x">확인 퀴즈</h2>'],
    ['<span class="rounded-full">스스로 점검하기</span>\n<h2 class="x">스스로 점검하기</h2>',
        '<span class="rounded-full">CHAPTER 1</span>\n<h2>확인 퀴즈</h2>']];

const plain = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function badgeHead(body) {
    return [...body.matchAll(BADGE_HEAD)]
        .filter((m) => BADGE_NAMES.includes(m[1]) && plain(m[2]) !== m[1])
        .map((m) => [m.index, `배지 「${m[1]}」와 절 제목 「${plain(m[2])}」가 다르다 — 배지를 지우거나 제목을 맞춘다`]);
}

const isSim = (p) => { const r = rel(p); return r.startsWith('simulator/') || r.startsWith('src/'); };

const emojiHits = (p, body) => (isSim(p) ? [] : [...body.matchAll(EMOJI)].map((m) => [m.index, m[0]]));

// 기준서 15 — 퀴즈 머리말. 저장소에서 가장 많이 쓴 제목과 부제로 맞춘다(2026-09-24).
// 부제가 없는 퀴즈도 막는다 — 없던 파일에는 그 파일의 제목 줄 모양대로 부제를 넣었다.
const QUIZ_TITLE = '확인 퀴즈';
const QUIZ_LEAD = '배운 내용을 확인해 봅시다.';
const QUIZ_HEAD = new RegExp(`<section(?!${W})[^>]*(?<!${W})id="quiz"[\\s\\S]*?<h2(?!${W})[^>]*>([\\s\\S]*?)</h2>` +
    `\\s*(?:<div(?!${W})[^>]*>\\s*</div>\\s*)?(?:<p(?!${W})[^>]*>([\\s\\S]*?)</p>)?`, 'du');

function quizHead(src) {
    // 퀴즈가 없으면 정규식을 돌리지 않는다. `<section[^>]*` 가 닫히지 않은 채 긴 글을 만나면
    // 되짚기가 폭주해 한 파일에 1분이 걸렸다(search-n-queen, 2026-09-25).
    if (!src.includes('id="quiz"')) return [];
    const m = src.match(QUIZ_HEAD);
    if (!m) return [];
    const bad = [];
    const at1 = m.indices[1][0];
    if (plain(m[1]) !== QUIZ_TITLE) bad.push([at1, `퀴즈 제목 「${plain(m[1])}」 — 「${QUIZ_TITLE}」로 쓴다`]);
    if (m[2] === undefined) bad.push([at1, `퀴즈 부제가 없다 — 제목 아래에 「${QUIZ_LEAD}」를 넣는다`]);
    else if (plain(m[2]) !== QUIZ_LEAD) bad.push([m.indices[2][0], `퀴즈 부제 「${plain(m[2])}」 — 「${QUIZ_LEAD}」로 쓴다`]);
    return bad;
}

const QUIZ_EXAMPLES = [
    ['<section id="quiz"><h2>퀴즈</h2>', '<section id="quiz"><h2>확인 퀴즈</h2><p>배운 내용을 확인해 봅시다!</p>',
        '<section id="quiz"><h2>확인 퀴즈</h2><div class="grid">'],
    ['<section id="quiz"><h2>확인 퀴즈</h2><div class="w-20"></div><p>배운 내용을 확인해 봅시다.</p>',
        '<section id="quiz"><h2>확인 퀴즈</h2>\n<p class="a">배운 내용을 확인해 봅시다.</p>']];

// 기준서 3 — 학생 글 속의 곧은따옴표(2026-09-24). 코드(<code> · <pre> · 코드의 문자열)와
// 태그의 속성 따옴표는 글이 아니다. 학생이 보는 속성(aria-label · title · alt · placeholder)과
// 퀴즈 해설 문자열은 글로 본다. 글 토막(블록 태그 · 스크립트 줄) 안에서 따옴표를 차례로
// 짝짓고, 한글이 든 짝만 잡는다 — 「S'」 같은 프라임이나 영어 코드 조각은 비켜 간다.
const Q_CODE = /<(code|pre|kbd|samp|script|style|svg|math)\b[\s\S]*?<\/\1>|<!--[\s\S]*?-->/g;
const Q_TAG = /<[^>]*>/g;
const Q_ATTR = new RegExp(`(?<!${W})(?:aria-label|title|alt|placeholder)="([^"]*)"`, 'gdu');
const Q_EXPL = /checkAnswer\(this,\s*(?:true|false),\s*'((?:[^'\\]|\\.)*)'/gd;
const Q_BLOCK = /<\/?(?:p|li|h[1-6]|td|th|div|button|label|option|section|ul|ol|table|tr)\b[^>]*>/g;

const blank = (s) => s.replace(/[^\n]/g, ' ');

/** 학생 글만 남긴 원문 — 길이와 자리가 원문과 같다. */
function quoteBody(p, src) {
    if (path.extname(p) === '.js') return jsStrings(src).replace(Q_TAG, blank);
    const tag = (t) => {
        const keep = Array.from({length: t.length}, () => ' ');
        for (const rx of [Q_ATTR, Q_EXPL]) {
            for (const a of t.matchAll(rx)) {
                const [s, e] = a.indices[1];
                for (let k = s; k < e; k++) keep[k] = t[k];
            }
        }
        return keep.join('').split('&quot;').join('      ');
    };
    let s = src.replace(Q_CODE, blank).replace(Q_TAG, tag);
    if (isSim(p)) {
        for (const m of src.matchAll(SCRIPT)) {
            const [a, b] = m.indices[2];
            s = s.slice(0, a) + jsStrings(m[2]).replace(Q_TAG, blank) + s.slice(b);
        }
    }
    return s;
}

function straightQuotes(p, src) {
    const body = quoteBody(p, src);
    const cuts = new Set([0, src.length]);
    for (const m of src.matchAll(Q_BLOCK)) cuts.add(m.index);
    const scripts = path.extname(p) === '.js' ? [[0, src.length]] : [...src.matchAll(SCRIPT)].map((m) => m.indices[2]);
    for (const [a, b] of scripts) for (let i = a; i < b; i++) if (src[i] === '\n') cuts.add(i);
    const sorted = [...cuts].sort((x, y) => x - y);
    const isAsciiAlpha = (c) => /^[A-Za-z]$/.test(c);
    const out = [];
    for (let k = 0; k + 1 < sorted.length; k++) {
        const a0 = sorted[k], b0 = sorted[k + 1];
        const seg = body.slice(a0, b0);
        for (const qc of ['\'', '"']) {
            const pos = [];
            for (let i = 0; i < seg.length; i++) {
                if (seg[i] !== qc) continue;
                if (i && '=\\'.includes(seg[i - 1])) continue;
                if (i > 0 && i < seg.length - 1 && isAsciiAlpha(seg[i - 1]) && isAsciiAlpha(seg[i + 1])) continue;
                pos.push(a0 + i);
            }
            if (pos.length % 2) continue;
            for (let i = 0; i < pos.length; i += 2) {
                const a = pos[i], b = pos[i + 1];
                if (/[가-힣]/.test(body.slice(a, b)) && b - a < 200) out.push([a, src.slice(a, b + 1).replace(/\s+/g, ' ')]);
            }
        }
    }
    return out;
}

// ── 문체 기준서: 정제를 마친 과목부터 막는 것 ─────────────────────────────────
// 사람이 읽고 고쳐야 하는 규칙이다. `STYLE_DONE` 에 올린 과목에서만 위반으로 치고, 나머지는
// `--report` 가 과목별 작업 목록으로 센다. **강의노트에만 건다.** 톱니는 `DONE` 과 같다 —
// 사용자 확인이 끝난 것만 올리고, 한 번 올린 것은 되돌리지 않는다.
const STYLE_DONE = [
    // 2026-09-25 인공지능기초 문체 정제 마감
    '인공지능기초/*.html',
    '인공지능기초/실습/*.html',
    // 2026-09-25 데이터과학 문체 정제 마감
    '데이터과학/*.html',
    // 2026-09-25 소프트웨어와생활 문체 정제 마감
    '소프트웨어와생활/*.html',
    // 2026-09-25 정보(고등학교) 문체 정제 마감
    '정보(고등학교)/*.html',
    // 2026-09-25 프로그래밍 문체 정제 마감 — 이로써 다섯 과목 전부
    '프로그래밍/기초/*.html',
    '프로그래밍/실습/*.html',
    '프로그래밍/c/*.html',
    '프로그래밍/py/*.html',
];

const P_BLOCK = /<p\b[^>]*>([\s\S]*?)<\/p>/g;
const SECTION = /<section\b[\s\S]*?<\/section>/g;
const DASH = /—|&mdash;/g;
const BOLD = /<(?:strong|b)\b/g;
const VERDICT = /(?:[이가] (?:요점|핵심|열쇠|요령)입니다|그것이 [^.]{1,30} 점입니다)\.?\s*$/;
const SEAT = /이 자리의|바로 이 자리|자리가 바로/g;
// 쉼표 뒤 빈칸은 `\s{1,20}` 으로 묶는다. `\s+` 이던 때는 스크립트를 빈칸으로 지운 시뮬레이터
// 페이지(search-n-queen)에서 되짚기가 폭주해 한 파일에 1분이 걸렸다(2026-09-25).
const LIST_AND = /(?:[^,.<>]{1,15},\s{1,20}){2,}[^,.<>]{1,15}\s등의\s[^.]{0,40}?하여\s[^.]{0,80}?다\./g;
const REREAD = /다시 읽어|가리고 [가-힣 ]{0,10}(?:적어|써)|위 (?:설명|내용)을 다시/g;
const AI_BOX = /AI와 함께 정리/g;

const text = (s) => unescape(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

// 기준서 5의 볼드는 **본문 문단만** 센다(2026-09-24 사용자 확정). 퀴즈 · 표 · 카드(핵심 정리 ·
// 상자) · 「스스로 확인」 밴드 안의 볼드는 뺀다. 상자는 배경이나 테두리를 가진 요소로 가른다 —
// 절을 싸는 `section-card` 만은 본문 바탕이라 상자가 아니다.
const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'source', 'wbr', 'area', 'col', 'path',
    'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'use']);
const BOX_CLASS = /(?:^|\s)(?:bg-|border(?:\s|-|$)|rounded|shadow)/;
const TAG_TOKEN = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(\/?)>/g;

/** 본문이 아닌 요소의 [시작, 끝]. */
function boxSpans(body) {
    const spans = [], stack = [];
    for (const m of body.matchAll(TAG_TOKEN)) {
        const [, close, rawName, attrs, selfclose] = m;
        const name = rawName.toLowerCase();
        if (VOID.has(name) || selfclose) continue;
        if (!close) {
            const c = attrs.match(new RegExp(`(?<!${W})class="([^"]*)"`, 'u'));
            const cls = c ? c[1] : '';
            const box = name === 'table' || name === 'button' || attrs.includes('id="quiz"') ||
                (name !== 'section' && !cls.includes('section-card') && BOX_CLASS.test(cls));
            stack.push([name, m.index, box]);
            continue;
        }
        // 닫는 태그 — 짝이 맞는 가장 가까운 여는 태그까지 걷어 낸다(어긋난 HTML에도 버틴다)
        for (let k = stack.length - 1; k >= 0; k--) {
            if (stack[k][0] === name) {
                const [, start, box] = stack[k];
                stack.length = k;
                const end = m.index + m[0].length;
                if (box || (name === 'section' && body.slice(start, end).includes('checkAnswer'))) spans.push([start, end]);
                break;
            }
        }
    }
    return spans;
}

/** 태그를 같은 길이의 공백으로 지운다 — 자리가 원문과 맞도록. */
const stripKeep = (s) => s.replace(/<[^>]+>/g, (t) => ' '.repeat(t.length));

/** [자리, 규칙, 알림]. 문단 · 절의 경계는 HTML 구조(<p>, <section>)로 가른다. */
function styleLater(body) {
    const out = [];
    const boxes = boxSpans(body);
    const inBox = (pos) => boxes.some(([a, b]) => a <= pos && pos < b);
    const proseP = [];
    for (const m of body.matchAll(P_BLOCK)) {
        const inner = m[1], t = text(inner);
        if ((inner.match(DASH) || []).length >= 2) out.push([m.index, '4 줄표', '한 문단에 줄표가 둘 이상 — 한 번까지 쓴다']);
        if (!inBox(m.index)) {
            const n = (inner.match(BOLD) || []).length;
            proseP.push([m.index, n]);
            if (n >= 2) out.push([m.index, '5 볼드', '한 문단에 볼드가 둘 이상 — 한 구절만']);
        }
        if (VERDICT.test(t)) out.push([m.index, '7 판정문', '문단을 판정문으로 닫았다 — 요점은 첫 문장에']);
    }
    for (const m of body.matchAll(SECTION)) {
        const end = m.index + m[0].length;
        if (proseP.filter(([pos]) => m.index <= pos && pos < end).reduce((s, [, n]) => s + n, 0) > 3) {
            out.push([m.index, '5 볼드', '한 절의 본문 문단에 볼드가 셋을 넘는다']);
        }
    }
    for (const m of body.matchAll(SEAT)) out.push([m.index, '6 자리', `「${m[0]}」 — 단계 · 역할 · 대목이면 그 낱말로`]);
    for (const m of stripKeep(body).matchAll(LIST_AND)) out.push([m.index, '8 나열', '명사 셋 나열 + 「등의 …하여」 — 구체적 예 하나로']);
    for (const m of body.matchAll(/스스로 확인/g)) {
        const after = m.index + m[0].length;
        const end = body.indexOf('</section>', after);
        const seg = body.slice(after, end > 0 ? end : after + 2000);
        for (const r of stripKeep(seg).matchAll(REREAD)) {
            out.push([after + r.index, '9 되읽기', `「스스로 확인」에 되읽기 지시 「${r[0]}」 — 새 상황 하나로`]);
        }
    }
    for (const m of body.matchAll(AI_BOX)) out.push([m.index, '11 AI 정리', '「AI와 함께 정리하기」 — 「핵심 정리」에 흡수하고 지운다']);
    return out;
}

const STYLE_LATER_EXAMPLES = [
    ['<p>가 — 나 — 다</p>', '4 줄표'], ['<p><strong>가</strong>와 <b>나</b></p>', '5 볼드'],
    ['<p>그래서 이것이 핵심입니다.</p>', '7 판정문'], ['<p>바로 이 자리에서</p>', '6 자리'],
    ['<p>나이, 성별, 지역 등의 자료를 분석하여 예측합니다.</p>', '8 나열'],
    ['스스로 확인</p><p>위 설명을 다시 읽어 보세요.</p></section>', '9 되읽기'],
    ['<h2>AI와 함께 정리하기</h2>', '11 AI 정리'],
];
const STYLE_LATER_NOT = ['<p>가 — 나</p>', '<p><strong>가</strong>입니다</p>', '<p>핵심은 이렇습니다. 그래서 씁니다.</p>',
    '<p>빈 자리에 놓습니다</p>',
    '<div class="bg-sky-50 p-4"><p><strong>가</strong>와 <b>나</b></p></div>',
    '<table><tr><td><p><strong>가</strong><b>나</b></p></td></tr></table>',
    '<section id="quiz"><p><strong>가</strong><b>나</b></p></section>'];

// 강의노트에만 거는 규칙(쓴 말로 가리킨다). 시뮬레이터는 강의노트가 아니므로 다른
// 시뮬레이터 페이지로 거는 링크가 앞 차시 바로가기가 되지 않는다. 나머지 규칙은
// 둘 다에 건다 — 같은 기준으로 막아야 강의노트와 시뮬레이터의 말이 갈라지지 않는다.
const LECTURE_ONLY = new Set(['다른 강의노트로 가는 링크']);

/** 목록의 정규식이 제 예시를 잡는지, 잡으면 안 되는 것을 비껴가는지. */
export function selfTest() {
    const errs = [];
    for (const [rx, 쓴, , 예, 아님] of RULES) {
        for (const e of 예) if (!hit(rx, e)) errs.push(`「${쓴}」이 「${e}」를 못 잡는다`);
        for (const e of 아님) if (hit(rx, e)) errs.push(`「${쓴}」이 「${e}」를 잘못 잡는다`);
    }
    for (const e of EMOJI_EXAMPLES[0]) if (!hit(EMOJI, e)) errs.push(`이모지가 「${e}」를 못 잡는다`);
    for (const e of EMOJI_EXAMPLES[1]) if (hit(EMOJI, e)) errs.push(`이모지가 「${e}」를 잘못 잡는다`);
    for (const e of BADGE_EXAMPLES[0]) if (!badgeHead(e).length) errs.push(`배지 검사가 「${e}」를 못 잡는다`);
    for (const e of BADGE_EXAMPLES[1]) if (badgeHead(e).length) errs.push(`배지 검사가 「${e}」를 잘못 잡는다`);
    for (const e of QUIZ_EXAMPLES[0]) if (!quizHead(e).length) errs.push(`퀴즈 머리말이 「${e}」를 못 잡는다`);
    for (const e of QUIZ_EXAMPLES[1]) if (quizHead(e).length) errs.push(`퀴즈 머리말이 「${e}」를 잘못 잡는다`);
    const here = path.join(ROOT, 'tools', 'check_prose.html');   // 가짜 경로 — 강의노트 HTML 로 다룬다
    for (const e of ["<p>인공지능은 '학습'을 합니다.</p>", '<p>"이게 탐색이랑 무슨 상관이지?"</p>',
        '<button aria-label="\'시작\' 버튼">']) {
        if (!straightQuotes(here, e).length) errs.push(`곧은따옴표가 「${e}」를 못 잡는다`);
    }
    for (const e of ["<p><code>print('안녕')</code></p>", '<p class="a">위치(S\') 정보</p>',
        '<button onclick="checkAnswer(this, true, \'&quot;점수: &quot;는 글자\')">']) {
        if (straightQuotes(here, e).length) errs.push(`곧은따옴표가 「${e}」를 잘못 잡는다`);
    }
    for (const [e, rule] of STYLE_LATER_EXAMPLES) {
        if (!styleLater(e).some(([, r]) => r === rule)) errs.push(`문체 「${rule}」이 「${e}」를 못 잡는다`);
    }
    for (const e of STYLE_LATER_NOT) if (styleLater(e).length) errs.push(`문체 규칙이 「${e}」를 잘못 잡는다`);
    return errs;
}

// ── 스크립트에서 학생이 보는 글만 남기기 ────────────────────────────────────────
// 시뮬레이터의 글은 거의 전부 문자열 리터럴 안에 있다. **주석 · 식별자 · 코드는 보지
// 않는다** — 개발 주석은 학생에게 보이지 않고, 거기 적힌 옛말은 `terms` 검사 몫이다.
// 문자열 밖은 공백으로 지우되 줄바꿈은 남겨 위반을 원래 파일의 줄 번호로 짚는다.
// 정규식 한 줄로 자르면 템플릿 안의 `${ … `…` … }` 나 정규식 리터럴 속 따옴표(/'/)에서
// 문자열 경계를 잃고, 그 뒤의 주석이 통째로 문자열로 읽힌다. 그래서 손으로 한 글자씩 돈다.
const SCRIPT = /(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gd;
// 이 글자 뒤의 `/` 는 나눗셈이 아니라 정규식 리터럴의 시작이다.
const REGEX_BEFORE = new Set('(,=:[!&|?{};+-*%<>~^');
const REGEX_KEYWORDS = new Set(['return', 'typeof', 'case', 'in', 'of', 'delete', 'void', 'throw']);

/** 문자열 리터럴의 속만 남기고 나머지는 공백으로 — 줄바꿈은 그대로. */
export function jsStrings(src) {
    const out = [];
    for (let k = 0; k < src.length; k++) out.push(src[k] === '\n' ? '\n' : ' ');
    const n = src.length;
    let i = 0;
    // 템플릿 안의 `${` 에 들어가면 그 깊이의 중괄호 수를 쌓아 둔다.
    const stack = [];
    const prevSig = (k) => {
        k--;
        while (k >= 0 && ' \t\r\n'.includes(src[k])) k--;
        return k >= 0 ? src[k] : '';
    };
    const keywordBefore = (k) => {
        const m = src.slice(Math.max(0, k - 12), k).match(/([A-Za-z_$]+)\s*$/);
        return !!m && REGEX_KEYWORDS.has(m[1]);
    };
    /** `k` 는 여는 ` 다음. 닫는 ` 다음 자리를 돌려준다(`${` 를 만나면 코드로 돌아간다 — 음수). */
    const template = (k) => {
        while (k < n) {
            const c = src[k];
            if (c === '\\') {
                out[k] = src[k];
                if (k + 1 < n) out[k + 1] = src[k + 1];
                k += 2;
            } else if (c === '`') {
                return k + 1;
            } else if (c === '$' && src.startsWith('${', k)) {
                stack.push(0);
                return -(k + 2);
            } else {
                out[k] = c;
                k++;
            }
        }
        return n;
    };
    while (i < n) {
        const c = src[i];
        if (src.startsWith('//', i)) {
            const j = src.indexOf('\n', i);
            i = j < 0 ? n : j;
        } else if (src.startsWith('/*', i)) {
            const j = src.indexOf('*/', i + 2);
            i = j < 0 ? n : j + 2;
        } else if (c === '"' || c === '\'') {
            let j = i + 1;
            while (j < n && src[j] !== c && src[j] !== '\n') j += src[j] === '\\' ? 2 : 1;
            for (let k = i + 1; k < Math.min(j, n); k++) out[k] = src[k];
            i = j + 1;
        } else if (c === '`') {
            const r = template(i + 1);
            i = r < 0 ? -r : r;
        } else if (c === '{' && stack.length) {
            stack[stack.length - 1]++;
            i++;
        } else if (c === '}' && stack.length) {
            if (stack.at(-1) === 0) {
                stack.pop();
                const r = template(i + 1);   // `${ … }` 가 닫히면 템플릿 글로 돌아간다
                i = r < 0 ? -r : r;
            } else {
                stack[stack.length - 1]--;
                i++;
            }
        } else if (c === '/' && (REGEX_BEFORE.has(prevSig(i)) || prevSig(i) === '' || keywordBefore(i))) {
            let j = i + 1, cls = false;   // 정규식 리터럴 — 글이 아니므로 건너뛴다
            while (j < n && src[j] !== '\n') {
                if (src[j] === '\\') { j += 2; continue; }
                if (src[j] === '[') cls = true;
                else if (src[j] === ']') cls = false;
                else if (src[j] === '/' && !cls) break;
                j++;
            }
            i = j + 1;
        } else {
            i++;
        }
    }
    return out.join('');
}

const HIDDEN = /<!--[\s\S]*?-->|<style\b[\s\S]*?<\/style>/g;

/**
 * HTML 은 태그째 두되 인라인 `<script>` 는 문자열 리터럴로 줄이고, 주석과
 * `<style>` 은 지운다 — 학생 화면에 나오지 않는 글이다.
 */
export function htmlWithScriptStrings(src) {
    src = src.replace(HIDDEN, blank);
    return src.replace(SCRIPT, (_, a, body, c) => a + jsStrings(body) + c);
}

/** 학생 화면에 나오는 글만 남긴 원문 — 길이와 줄이 원문과 같다. */
export const visibleText = (p, src) => (path.extname(p) === '.js' ? jsStrings(src) : htmlWithScriptStrings(src));

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function checkFile(p, sim) {
    const src = read(p);
    const lines = src.split('\n');
    // 태그나 개체(&nbsp;)가 낱말을 끊으면(「갈라</strong> 준다」) 원문으로는 못 잡는다.
    // 본문도 함께 본다. 무엇이 본문인지는 `proseText` 가 정한다 — `npm run prose` 와 같은 판단이다.
    // 원문 패스는 남긴다 — 링크 규칙처럼 태그 속을 봐야 하는 규칙이 있다.
    const bodies = path.extname(p) === '.js' ? [jsStrings(src)] : [htmlWithScriptStrings(src), proseText(src)];
    const bad = new Map();
    const add = (body, pos, msg) => {
        const n = lineOf(body, pos);
        if (!lines[n - 1].includes(SKIP_LINE)) bad.set(`${n}\u0000${msg}`, [n, msg]);
    };
    for (const [rx, 쓴, 쓸] of RULES) {
        if (sim && LECTURE_ONLY.has(쓴)) continue;
        for (const body of bodies) for (const m of body.matchAll(rx)) add(body, m.index, `「${m[0]}」(${쓴}) — 「${쓸}」로 쓴다`);
    }
    for (const [pos, e] of emojiHits(p, bodies[0])) {
        // 퀴즈 알림의 ✅/❌ 는 글이 아니라 정답·오답 표시다. 감탄사를 뺀 뒤로는 이것이
        // 알림에 남은 유일한 표지라 지우면 맞혔는지 알 수 없다(2026-09-24 되살림).
        if (lines[lineOf(bodies[0], pos) - 1].includes('showToast(')) continue;
        add(bodies[0], pos, `「${e}」(이모지) — 지우고 문장으로 쓴다`);
    }
    for (const [pos, msg] of badgeHead(bodies[0])) add(bodies[0], pos, msg);
    for (const [pos, e] of straightQuotes(p, src)) add(src, pos, `${e}(곧은따옴표) — 「 」로 쓴다`);
    if (!sim) for (const [pos, msg] of quizHead(bodies[0])) add(bodies[0], pos, msg);
    return [...bad.values()].sort((a, b) => a[0] - b[0] || cmp(a[1], b[1]));
}

/** 정제를 마친 과목부터 막는 문체 규칙 — [줄, 규칙, 알림]. */
function checkLater(p) {
    const src = read(p);
    const lines = src.split('\n');
    const body = visibleText(p, src);
    const out = new Map();
    // 시뮬레이터의 퀴즈 머리말(기준서 15)은 강의노트와 달리 여기서 톱니를 탄다 —
    // 맞출 자리가 simulator/ai 에 남아 있어 한꺼번에 막을 수 없었다(2026-09-25).
    const hits = [...styleLater(body)];
    if (isSim(p) && path.extname(p) === '.html') for (const [pos, msg] of quizHead(body)) hits.push([pos, '15 퀴즈 머리말', msg]);
    for (const [pos, rule, msg] of hits) {
        const n = lineOf(body, pos);
        if (!lines[n - 1].includes(SKIP_LINE)) out.set(`${n}\u0000${rule}\u0000${msg}`, [n, rule, msg]);
    }
    return [...out.values()].sort((a, b) => a[0] - b[0] || cmp(a[1], b[1]) || cmp(a[2], b[2]));
}

/** 파이썬 `PurePath.match` — 글롭을 경로의 오른쪽 끝에 맞춘다. `*` 는 폴더를 건너지 못한다. */
function pathMatch(relPath, glob) {
    const ps = relPath.split('/'), gs = glob.split('/');
    if (gs.length > ps.length) return false;
    const tail = ps.slice(ps.length - gs.length);
    return gs.every((g, i) => new RegExp('^' + g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$').test(tail[i]));
}

const isStyleDone = (p) => STYLE_DONE.some((g) => pathMatch(rel(p), g));

// 시뮬레이터의 문체 기준서 사람 몫(4~9 · 15)을 막는 톱니 — `STYLE_DONE` 과 같은 뜻이다.
// 2026-09-25에 두 폴더가 모두 올랐다. 새 폴더는 정제를 마치면 올리고, 올린 뒤에는 되돌리지 않는다.
// 남은 자리는 `npm run check -- prose --report` 가 센다.
const SIM_STYLE_DONE = [
    'simulator/cs/*.html',   // 2026-09-25
    'simulator/ai/*.html',   // 2026-09-25
];
const isSimStyleDone = (p) => SIM_STYLE_DONE.some((g) => pathMatch(rel(p), g));

// 시뮬레이터는 전부 정제를 마쳤다(2026-09-24). 범위가 import 그래프라 글롭으로
// 적을 수 없으므로 DONE 에 올리지 않고 통째로 막는다.
const isDone = (p) => isSim(p) || DONE.some((g) => pathMatch(rel(p), g));

const lectureNotes = () => SUBJECTS.flatMap((s) => walk(path.join(ROOT, s.dir), {ext: ['.html']}));

export function check(args = []) {
    const r = new Report('check_prose');
    const report = args.includes('--report');
    const picked = args.filter((a) => !['-v', '--verbose', '--report'].includes(a));

    const errs = selfTest();
    for (const e of errs) r.error(`목록 자체가 틀렸다 — ${e}`);
    if (errs.length) return r;

    // 짚은 파일은 정제 중인 것이므로 DONE 이 아니어도 막는다.
    const files = picked.length ? picked.map((a) => path.resolve(ROOT, a)) : [...lectureNotes(), ...simScope()];
    let total = 0;
    const pending = new Map(), stylePending = new Map();
    for (const f of files) {
        const bad = checkFile(f, isSim(f));
        const shown = rel(f);
        if (picked.length || isDone(f)) {
            for (const [n, m] of bad) r.error(`${shown}:${n} ${m}`);
            total += bad.length;
        } else {
            const subj = shown.split('/')[0];
            pending.set(subj, (pending.get(subj) || 0) + bad.length);
            if (report) for (const [n, m] of bad) r.warn(`${shown}:${n} ${m}`);
        }
        // 문체 기준서의 사람 몫. **시뮬레이터도 강의노트와 같이 본다**(2026-09-25 사용자 지시) —
        // 화면 글도 학생이 읽는 글이다. 이 규칙들은 문단(<p>) · 절(<section>) 구조로 가르므로 HTML 에만 건다.
        const later = path.extname(f) === '.html' ? checkLater(f) : [];
        if (picked.length || (isSim(f) ? isSimStyleDone(f) : isStyleDone(f))) {
            for (const [n, , m] of later) r.error(`${shown}:${n} 문체 — ${m}`);
            total += later.length;
        } else if (path.extname(f) === '.html') {
            const subj = shown.split('/')[0];
            if (!stylePending.has(subj)) stylePending.set(subj, new Map());
            const c = stylePending.get(subj);
            for (const [, rule] of later) c.set(rule, (c.get(rule) || 0) + 1);
        }
    }
    const left = [...pending].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ') || '없음';
    let summary = `완료 — 파일 ${files.length}, 위반 ${total}, 정제 전 자리 ${left}`;
    if (report) {
        // 문체 기준서의 사람 몫 — STYLE_DONE 에 올리기 전 과목의 남은 자리를 규칙별로 센다.
        const sum = (c) => [...c.values()].reduce((a, b) => a + b, 0);
        for (const [subj, c] of [...stylePending].sort((a, b) => sum(b[1]) - sum(a[1]))) {
            const byRule = [...c].sort((a, b) => cmp(a[0], b[0])).map(([k, v]) => `${k} ${v}`).join(', ');
            summary += `\n문체 정제 전 — ${subj} ${sum(c)} (${byRule || '없음'})`;
        }
        // 세기만 한다 — 위반을 경고로 내려 통과시킨다.
        r.warnings.push(...r.errors);
        r.errors.length = 0;
    }
    return r.done(summary);
}
