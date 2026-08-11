# 배부 문서 생성기

학생에게 나눠 주는 보고서 양식 `.docx`를 만든다. **산출물은 저장소에 담지 않는다** —
배포 빌드가 매번 새로 만든다.

```bash
npm run docx      # 저장소 어디서든
```

**의존성은 루트 `package.json`에 있다.** `npm ci` 한 번이면 끝이고 이 폴더에는
`node_modules`도 락파일도 없다.

이 폴더의 `package.json`은 **의존성이 아니라 모듈 방식을 위해** 있다. 루트가
`"type": "module"`이라 표식이 없으면 `make/*.js` 41개의 `require()`가 전부 죽는다.
**지우지 말 것.** 명령과 의존성은 루트에만 둔다.

## 구조

```
tools/docx/
├─ build.js       make/*.js를 전부 실행한다. 하나라도 실패하면 종료 코드 1
├─ outpath.js     산출물이 어느 폴더로 나가는지 정하는 유일한 곳
└─ make/
   ├─ make_sw_template.js   프로그래밍 프로젝트 보고서의 «틀»
   ├─ make_ai_template.js   AI 기계학습 보고서의 «틀»
   └─ make_<주제>.js        틀에 넣을 «내용». 나머지 37개가 전부 이것
```

**틀과 내용을 나눈 것이 이 폴더의 핵심 설계다.** 틀 파일이 `makeDocument`를 내보내고,
내용 파일은 데이터만 넘긴다. 양식 디자인을 고치면 37개가 한꺼번에 바뀐다.

---

## 새 문서를 추가하는 법

### 1. 내용 파일 하나를 만든다

`make/` 안에 `make_<주제>.js`. **기존 파일을 복사해서 고치는 것이 가장 빠르다** —
프로그래밍은 `make_3-2-1_py.js`, AI는 `make_ai_1.js`가 표준 예시다.

```javascript
// 비만도 측정 프로그램 (Python) 완성 예시
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: { … },
}, out('py', '비만도-측정.docx'));
```

**세 줄이 규칙의 전부다.**

| 규칙 | 이유 |
|---|---|
| 틀은 `require('./make_sw_template')` 또는 `./make_ai_template` | 양식을 한 곳에서 고치기 위해 |
| 출력은 반드시 `out(그룹, 파일명)` | **경로를 파일에 적지 않는다.** 아래 「출력 경로」 |
| 파일명에 번호를 넣지 않는다 | 실습 순서가 바뀌면 URL이 깨진다. `비만도-측정.docx` |

### 2. 강의노트에서 링크한다

산출물은 **그것을 링크하는 강의노트 바로 옆 `docx/`**에 떨어진다. 그래서 링크에 `../`가 없다.

```html
<a href="docx/비만도-측정.docx">보고서 양식 내려받기</a>
```

### 3. 돌려서 확인한다

```bash
npm run docx
```

**산출물은 커밋하지 않는다.** `.gitignore`가 `*.docx`를 무시하고, 애초에 `dist/`로 나간다.

---

## 출력 경로 — `outpath.js` 한 곳에서만 정한다

```javascript
const DEST = {
    ai: '인공지능기초/ai-projects/docx',
    py: 'templates/py',   // 프로그래밍은 C·Python 통합 때 옮긴다
    c: 'templates/c',
};
```

**출력 루트는 기본이 `dist/`다.** 소스 트리에 `templates/` 폴더를 두지 않는다 —
생성기가 필요한 폴더를 스스로 만든다. `py`·`c`가 아직 옛 자리인 것은 강의노트 15개가
`../templates/py/…`를 링크하고 있어서다. 그 파일들을 다시 쓸 때 함께 옮긴다.

**`make/*.js`에 `"../py/…"` 같은 경로를 적지 않는다.** 예전에는 39개 파일에 흩어져 있어서
폴더를 옮길 때마다 전부 손봐야 했다. 지금은 이 표 한 줄만 고치면 된다.

**새 그룹을 추가할 때**는 `DEST`에 한 줄 넣고 `out('새그룹', '…')`으로 쓴다.
없는 그룹을 쓰면 생성기가 이름을 알려 주며 실패한다.

기본이 `dist/`이므로 **배포 빌드는 아무것도 넘기지 않는다.**
`DOCX_OUT_ROOT`는 다른 자리에 뽑아 볼 때만 쓴다.

```bash
npm run docx                        # dist/인공지능기초/ai-projects/docx/…
DOCX_OUT_ROOT=/tmp/확인 npm run docx   # 다른 자리에 뽑아 볼 때만
```

---

## 틀이 받는 데이터

### `make_sw_template` — 프로그래밍 프로젝트 보고서

프로그램 개발 4단계를 그대로 따른다. 섹션 다섯 개를 `s1`~`s5`로 넘긴다.

| 키 | 단계 | 필드 |
|---|---|---|
| `s1` | 기획 | `programName` `purpose` `targetUser` `features` `screenExample` |
| `s2` | 설계 · 입출력 | `programName` `inputDesign` `inputExample` `outputDesign` `outputExample` `constraints` |
| `s3` | 설계 · 알고리즘 | `programName` `flowchart` `pseudocode` |
| `s4` | 구현 | `programName` `code` `explanation` |
| `s5` | 테스트 | `programName` `errors` `improvements` `testCases` |

`testCases`는 `{input, expected, actual, pass}` 객체의 배열이다.
`programName`은 섹션마다 반복해서 넣는다 — 각 쪽 머리에 들어간다.

### `make_ai_template` — AI 기계학습 보고서

```javascript
makeDocument({ topic, mlType, tool, career }, out('ai', '…docx'));
```

`makeDocument`에 **문자열 하나만** 넘기면 빈 양식이 나온다(`make_ai_template.js` 맨 아래 참고).

---

## 지켜야 할 것

**① 산출물을 커밋하지 않는다.** 담았던 시절에는 `make/`만 고치고 다시 만들지 않아
AI 양식 8개가 **두 달 동안** 어긋나 있었다(스크립트는 `오렌지`, 문서는 `오렌지3`).
지금은 배포 빌드가 매번 만들므로 **`make/`를 고치면 다음 배포에 그대로 반영된다.**

**② 예시 데이터의 인물은 익명화한다.** `학생 A`, `학생 B`. 강의노트와 같은 규칙이다
→ [`CLAUDE.md`](../../CLAUDE.md).

**③ 문서 내용을 확인할 때는 zip 항목으로 비교한다.** `.docx`는 같은 코드로 다시 만들어도
**바이트가 달라진다** — `docProps/core.xml`에 생성 시각이 들어가기 때문이다.
그 항목만 빼면 나머지는 완전히 결정적이다.

**④ `build.js`는 하나라도 실패하면 종료 코드 1로 끝난다.** CI가 조용히 넘어가지 않도록
일부러 그렇게 두었다. 새 파일을 넣고 나면 반드시 전체를 한 번 돌려 볼 것.

---

규칙의 전체 그림은 [`tools/README.md`](../README.md)의 「배부 문서 생성기」 절에 있다.
