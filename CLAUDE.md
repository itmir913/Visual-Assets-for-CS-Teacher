# CLAUDE.md

고등학교 정보·인공지능 수업용 웹 강의안과 시뮬레이터 저장소입니다.

## 저장소 구조

| 경로 | 내용 |
|---|---|
| `인공지능기초/` | 「인공지능 기초」 강의노트 HTML (단원번호.제목.html) |
| `프로그래밍(Python)/` | 「프로그래밍」 Python 강의노트 HTML |
| `프로그래밍(C)/` | 「프로그래밍」 C 강의노트 HTML |
| `simulator/ai/` | AI 시뮬레이터 16종 (단일 HTML, 자체 완결형) |
| `templates/ai/` | 보고서·프로젝트 템플릿 (.docx) |
| `docs/simulator-review/` | 시뮬레이터 교육적 검증 리포트 |

---

## 커밋 규칙

- **커밋 메시지에 AI 협업 표시 문구를 남기지 않는다.** 다음은 모두 금지:
  - `Co-Authored-By: Claude ...`
  - `🤖 Generated with [Claude Code](...)`
  - `coworked`, `Generated with`, `Assisted by` 등 도구·협업자 표기 일체
- 제목은 한국어 한 줄 요약. 본문은 필요할 때만, 무엇을 왜 바꿨는지 항목으로.
- **커밋 메시지는 사용자와 소통하는 창구가 아니다.** 수정 내용과 근거만 남긴다.
  `검토 요망`, `판단 요망`, `확인 부탁` 같이 사용자에게 무언가를 요청하는 문구를 쓰지 않는다.
  판단이 갈렸던 지점이나 확인이 필요한 사항은 **채팅 응답으로 보고**한다.
  (2026-08-05 지적. 이력은 나중에 읽는 사람에게 변경의 근거를 설명해야 하는데,
  그 시점에는 이미 끝난 검토 요청이 남아 있으면 읽는 사람이 혼란스럽다.)
- **강의노트는 파일 하나를 만들 때마다 사용자가 직접 확인한다.** 여러 개를 몰아서 만들지 않는다.
  커밋 메시지로 검토를 대신할 수 없으므로, `생성 → 커밋 → 사용자 확인 → 수정 → 다음 파일` 순서를 지킨다.
  한 번 지적받은 사항은 규칙이 되어 이후 파일 전체에 적용되므로, 피드백 없이 여러 개를 찍어 내면
  같은 실수가 그대로 복제된다.
- 커밋과 푸시는 사용자가 요청했을 때만 수행한다.
  - 예외: 사용자가 "점검 → 수정 → 커밋 → 다음" 같은 반복 워크플로를 지시한 경우, 그 워크플로가 끝날 때까지 파일 단위로 커밋을 이어간다.
- 이 저장소는 `master`에 직접 커밋한다. (기존 이력이 그렇게 되어 있음)

---

## HTML 강의안 작성 규칙

- **글자 크기는 최소 `text-base`.** 교실 뒷자리·빔프로젝터 기준이라 그보다 작으면 안 읽힌다.
- **테이블은 반드시 `overflow-x-auto` 컨테이너로 감싼다.** 모바일에서 가로로 깨지는 것을 막는다.
  단, **래퍼만으로는 부족하다.** `table { width: 100% }`라 표는 넘치지 않고 **눌린다.**
  아래 `table-prose` 규칙을 함께 봐야 한다.
- Tailwind CDN + Font Awesome + Pretendard 조합을 사용한다. 각 HTML은 단일 파일로 자체 완결.
- **CDN 의존은 의도된 설계다.** 학교 현장은 온라인 환경이므로 로컬 번들링·오프라인 대응을 제안하지 말 것.
- 375px 폭에서 가로 스크롤이 생기지 않아야 한다.

### 사이트 주소는 반드시 하이퍼링크로 단다

`kaggle.com/datasets/...` 같은 주소를 **글자로만 적어 두지 않는다.** 학생이 손으로 옮겨 적게 된다.

```css
a.ext-link { color:#4338ca; font-weight:600; text-decoration:underline;
             text-underline-offset:2px; word-break:break-all; }
a.ext-link:hover { color:#312e81; }
```

```html
<a class="ext-link" href="https://www.kaggle.com/datasets/geoffnel/evs-one-electric-vehicle-dataset"
   target="_blank" rel="noopener noreferrer">kaggle.com/datasets/geoffnel/evs-one-electric-vehicle-dataset</a>
```

- `target="_blank"` + `rel="noopener noreferrer"`를 항상 붙인다.
- `word-break: break-all`이 없으면 **긴 주소가 375px를 뚫는다.**
- 표시 글자는 `https://www.`를 뺀 짧은 형태로 두되, `href`에는 전체 주소를 넣는다.
- (2026-08-05 지적. 데이터과학 3개 파일 13곳 일괄 적용.)

### 표가 375px에서 눌려 찌그러지는 문제 — `table-prose`

`overflow-x-auto` 래퍼가 있어도 **표는 넘치지 않는다.** `table { width: 100% }`가 표를
컨테이너 폭에 맞춰 **줄여 버리기** 때문이다. 375px에서 `section-card`(좌우 패딩 2.5rem)
안에 들어가면 쓸 수 있는 폭이 약 250px뿐이라, 본문이 긴 셀은 **80~140px까지 눌려
글자가 한 줄에 두세 자씩 흐르는 세로 리본**이 된다.

```css
/* 최소 너비를 주면 눌리는 대신 래퍼 안에서 가로 스크롤된다. */
table.table-prose { min-width: 32rem; }
```

- **붙이는 기준** — 셀에 본문 성격의 긴 글이 있거나, **열이 4개 이상**인 표.
- **붙이지 않는 기준** — 값이 짧은 2열 표(`성별 / 인원` 같은 것). 굳이 넓혀 스크롤을 만들 이유가 없다.
- 라벨 열에 `w-64`처럼 큰 고정 폭을 주지 않는다. 32rem 안에서 본문 열이 다시 좁아진다.
  라벨 열은 `w-28`~`w-44` 범위로 둔다.
- 표를 카드로 바꾸지 않는다. 교과서가 표로 제시한 것은 표로 두어야 학생이 나란히 놓고 볼 수 있다.
- (2026-08-05 사용자가 2-2-1 `결측치 해결 방법` 표에서 발견. 실측해 보니 2-1-2·2-2-1
  두 파일에 걸친 구조적 문제였고, 표 19개 중 14개에 적용했다.)

### 예시 데이터의 인물은 반드시 익명화한다

**교과서에 실명형 이름이 있어도 그대로 옮기지 않는다.** `김지윤`, `문서영` 같은 실제 사람
이름처럼 보이는 값은 **`학생 A`, `학생 B`, `학생 C`** 로 바꾼다.

```html
<td>학생 A</td>   <!-- O -->
<td>김지윤</td>    <!-- X : 교과서 표기라도 금지 -->
```

- 학생·교사·환자 등 **사람을 가리키는 예시 값 전부**에 적용한다.
  학교 밖 사례도 마찬가지다(예: 환자 이름 → `환자 A`).
- 학번·점수·날짜처럼 **사람을 특정하지 않는 값은 교과서 그대로** 둔다.
- 이유: 강의노트는 웹에 올라가는 공개 자료이고, 실명형 예시는 실제 재학생과 이름이 겹칠 때
  당사자를 지목하는 것처럼 읽힌다. 익명 표기는 표를 읽기 쉽게 만드는 부수 효과도 있다.
- 새 파일을 만들 때뿐 아니라 **교과서 표를 옮겨 적는 순간마다** 확인한다.
  (2026-08-04 데이터과학 `1-2-1`에서 교과서 [표 Ⅰ-1]을 그대로 옮겼다가 지적받음)

### 목록은 `list-outside`만 쓴다 (`list-inside` 금지)

```html
<ol class="space-y-1 text-base font-medium text-slate-800 list-decimal list-outside pl-5">
<ul class="space-y-2 text-base text-slate-700 list-disc list-outside pl-5">
```

- `list-inside`는 마커가 콘텐츠 박스 안에 들어가서 **줄바꿈된 둘째 줄이 번호 아래 맨 왼쪽으로
  붙는다.** 좁은 화면일수록 줄바꿈이 잦아 더 자주 깨진다. `list-outside`라야 둘째 줄이 첫 줄
  글자에 맞춰 들여쓰기된다(행잉 인덴트).
- `list-outside`는 마커가 콘텐츠 박스 **밖**에 그려지므로 **왼쪽 패딩을 반드시 함께 준다.**
  `pl-5`(1.25rem)가 기본이고, 이보다 작으면 두 자리 번호에서 마커가 잘린다.
- **학습 목표 번호는 `①②③` 같은 원문자 대신 `list-decimal` 자동 번호를 쓴다.**
  원문자는 보조기기가 읽는 방식이 제각각이고, 항목을 넣거나 빼면 손으로 다시 매겨야 하며,
  글꼴 폴백 시 두부(□)로 깨진다. (2026-08-04 전 과목 24개 파일 일괄 교정 완료)

### 코드 요소의 한글 글꼴

`code, pre` 같은 **요소 선택자만 쓰면 Tailwind CDN이 나중에 주입하는 Preflight의 동일 특이도
규칙에 밀려** 한글이 시스템 글꼴로 떨어진다. `body`를 붙여 특이도를 올려야 한다.

```css
body code, body kbd, body samp, body pre,
body .font-mono { font-family: ui-monospace, …, "Pretendard Variable", …, monospace; }
```

### 코드 블록 가로 넘침

`<pre>`는 기본값이 `white-space: pre`라 **긴 줄이 줄바꿈되지 않고 화면 밖으로 빠져나간다.**
`<pre>`를 쓰는 모든 파일에 아래 규칙을 넣는다.

```css
body pre {
    overflow-x: auto;   /* 넘치는 줄은 코드 블록 안에서만 가로 스크롤 */
    max-width: 100%;
    min-width: 0;       /* flex 자식일 때 정상적으로 줄어들도록 */
}
```

- **`white-space: pre-wrap`으로 접지 않는다.** 코드는 들여쓰기가 의미를 가지므로 원형을 지키고,
  스크롤은 코드 블록 안에 가둔다.
- 래퍼 `div`를 끼우는 방식은 쓰지 않는다. 코드 블록 마크업이 `rounded-xl overflow-hidden`,
  `flex-1`, 탭 콘텐츠 등으로 제각각이라 래퍼를 넣으면 둥근 모서리와 flex 레이아웃이 깨진다.
- (2026-08-04 `<pre>` 사용 50개 파일 일괄 적용. 적용 전 39개 파일이 무방비였다.
  적용 후 375px에서 50개 전부 가로 넘침 0 확인.)

---

## 시뮬레이터 검증 워크플로

`simulator/ai/` 16개 파일을 **한 번에 하나씩** 검증한다. 진행 현황과 공통 이슈는
`docs/simulator-review/_공통이슈.md`, 파일별 리포트는 `docs/simulator-review/<파일명>.md`.

### 대상 및 기준
- 학생 수준: **고등학교 「인공지능 기초」** (수식은 개념 수준, 코드 이해는 선택적)
- 방법: 핵심 알고리즘 함수 + 디자인 부분만 정독 → 브라우저 실행 → 리포트 → 수정 → 커밋

### 루브릭 4축
| 축 | 확인 내용 |
|---|---|
| A. 개념 정확성 | 구현이 교과서 정의와 일치하는가 (자료구조, 갱신식, 최적성 보장 조건) |
| B. 시각화 정합성 | 화면에 보이는 것이 내부 상태와 같은가, 오개념을 심지 않는가 |
| **C. 안정성** | 콘솔 에러, 경계 케이스(빈 데이터·극단값·봉쇄), 무한 루프 |
| **D. 접근성·반응형** | 터치 조작, 375px 레이아웃, 터치 타깃 크기, 키보드·색상 접근성 |

C와 D가 최우선이다.

### 감점하지 않는 항목 (사용자가 명시적으로 제외함)
- **형성평가·퀴즈 부재** — 문제 아님. 퀴즈 추가를 제안하지 말 것.
- **CDN 전면 의존** — 의도된 설계. 위 HTML 규칙 참조.

### 정독 범위
파일당 730~1,630줄이므로 **전체 정독 금지.** grep으로 구조를 스캔한 뒤
핵심 알고리즘 함수와 레이아웃·반응형 부분만 읽는다.

### 검증 순서
탐색(bfs-dfs → heuristic → 8-puzzle → n-queen → wumpus-world)
→ 회귀(linear → polynomial → logistic)
→ 분류(k-NN → SVM → decision-tree)
→ 비지도(k-means)
→ 강화학습(multi-armed-bandit → gridworld)
→ 딥러닝/CV(deep-learning → computer-vision-ml5)

---

## 알려진 수정 레시피

### 터치 드래그 지원
`mousedown`/`mouseenter`만 바인딩된 격자·캔버스는 태블릿에서 드래그 조작이 안 된다.

```javascript
cell.addEventListener('pointerdown', onDown);
cell.addEventListener('pointerenter', onEnter);
document.onpointerup = document.onpointercancel = () => isDrawing = false;

function onDown(e) {
    // 터치는 첫 요소에 포인터가 암묵 캡처되어 이웃의 pointerenter가 발생하지 않는다 → 반드시 해제
    if (e.pointerId !== undefined && e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
    }
    ...
}
```

컨테이너에 `touch-action: none;` 을 함께 지정해 드래그 중 페이지 스크롤을 막는다.
