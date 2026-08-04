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
- 커밋과 푸시는 사용자가 요청했을 때만 수행한다.
  - 예외: 사용자가 "점검 → 수정 → 커밋 → 다음" 같은 반복 워크플로를 지시한 경우, 그 워크플로가 끝날 때까지 파일 단위로 커밋을 이어간다.
- 이 저장소는 `master`에 직접 커밋한다. (기존 이력이 그렇게 되어 있음)

---

## HTML 강의안 작성 규칙

- **글자 크기는 최소 `text-base`.** 교실 뒷자리·빔프로젝터 기준이라 그보다 작으면 안 읽힌다.
- **테이블은 반드시 `overflow-x-auto` 컨테이너로 감싼다.** 모바일에서 가로로 깨지는 것을 막는다.
- Tailwind CDN + Font Awesome + Pretendard 조합을 사용한다. 각 HTML은 단일 파일로 자체 완결.
- **CDN 의존은 의도된 설계다.** 학교 현장은 온라인 환경이므로 로컬 번들링·오프라인 대응을 제안하지 말 것.
- 375px 폭에서 가로 스크롤이 생기지 않아야 한다.

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
