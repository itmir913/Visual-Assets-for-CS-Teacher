# 저장소 도구

**루트가 부르는 스크립트를 모아 둔 곳이다.** 전부 Node 로 돈다 — 빌드 플러그인(`vite/`),
강의노트를 고친 뒤 돌리는 **검사**(`checks/`)와 **감사**(`audits/`), 둘이 함께 쓰는 바탕(`lib/`),
학생 배부용 `.docx`를 만드는 **문서 생성기**(`docx/`).

**이 문서에는 무엇이 어디 있는지만 적는다.** 사용법(명령 · 인자 · 요령)은 그 스크립트의 머리
주석에만 있다 — 두 군데에 적으면 반드시 갈라진다. 명령 이름은 [`package.json`](../package.json),
검사 · 감사 이름과 부르는 법은 [`run.mjs`](run.mjs) 머리에 있다.

**검사는 Vitest 가 돈다.** 검사 하나가 `tests/`의 테스트 파일 하나다. 정적 검사는 본체가
`tools/checks/<이름>.mjs`이고 `tests/<이름>.test.mjs`는 그것을 부르는 껍데기다. 시뮬레이터 동작
검사(`tests/sim-<이름>.test.mjs`)와 브라우저 검사(`tests/browser/`)는 테스트 파일이 곧 본체다.
`tests/fixtures.test.mjs`는 일부러 틀리게 쓴 조각(`tests/fixtures/`)을 넣어 **검사가 제 할 일을
하는지** 본다 — 저장소가 깨끗하면 「위반 0」은 검사가 망가졌을 때도 똑같이 나오기 때문이다.
2026-09-25 까지 정적 검사는 파이썬이었고, 옮길 때의 대조 결과가 `tests/fixtures/__expected__/`에 있다.

**출력 모양**(`ERROR` · `WARN` · `INFO` · `DEBUG`, `-v`)은 [`lib/repo.mjs`](lib/repo.mjs) 머리에 있다.

## 러너 · 검사 · 감사

| 파일 | 하는 일 |
|---|---|
| `run.mjs` | **검사 · 감사 러너.** 목록(`CHECKS` · `SIMS` · `AUDITS`)이 여기에만 있다 |
| `checks/html.mjs` | 태그 중첩 · 최소 글자 크기(CSS · SVG) · 테이블 래퍼 · 제목 일치 · 금지 요소 · **금지 낱말**(`BANNED_WORDS`) · 중복 id. **못 잡는 것도 머리에 적혀 있다** |
| `checks/classes.mjs` | 코드로 조립되는 Tailwind 클래스 · JS(진입점 · 시뮬레이터와 강의노트의 인라인 스크립트)에 적은 Tailwind 클래스 |
| `checks/hover.mjs` | 손으로 쓴 CSS(페이지 `<style>` · `src/styles`)의 `:hover` 가 `@media (hover: hover)` 안에 있는가 |
| `checks/code.mjs` | 강의노트가 끌어다 쓰는 `.py` · `.c`의 구문 오류 · 파일 이름의 공백 · `.c` 의 홀수 판별(`% 2 == 1`) · `<pre><code>`에 직접 적은 코드 · Prism 진입점 |
| `checks/prose.mjs` | 정제에서 물러난 말과 문체 기준서 — 강의노트 · 시뮬레이터 · 배부 양식 생성기(`docx/make/`)의 문장. `--report` 는 막지 않는 감사 목록까지 내놓는다 |
| `checks/verbs.mjs` | 동작의 이름이 한자어인가 |
| `checks/terms.mjs` | 시뮬레이터의 말이 교과 용어인가(진입점의 `import` 를 따라간다) |
| `checks/index-links.mjs` | 첫 화면과 강의노트가 서로를 놓치지 않았는가 |
| `checks/privacy.mjs` | 개인정보 처리방침이 아직 참인가 |
| `checks/sim-index.mjs` | `simulator/index.html`을 루트 `index.html`에서 굽고, 검사로 부르면 같은지만 본다 |
| `checks/dist.mjs` | 산출물 검사 — `.docx` 링크 · CDN 잔존 · 태그 중첩 · 제3자 라이선스 고지 · 사이트 아이콘 |
| `audits/pre.mjs` · `svg.mjs` · `lemma.mjs` … | 판정 없이 목록만 내놓는 감사. `ci` 밖이다 |
| `mutate.mjs` | 돌연변이 검사 — 검사가 지키는 대상에 버그를 심고 빨간불이 켜지는지 본다. `ci` 밖이다 |
| `_sim-harness.mjs` | 시뮬레이터 페이지를 원문 그대로 node(jsdom)에서 돌리는 받침대. 직접 부르지 않는다 |
| `gen_graph_presets.mjs` | 그래프 시뮬레이터의 지도를 새로 뽑는다(`gen:graph`) |
| `extract-prose.mjs` | HTML 에서 학생이 읽는 글자만 뽑는다(`prose`) |
| `lib/repo.mjs` | `subjects.json` 을 읽는 얇은 층 · 파일 목록 · 결과 모양(`Report`) |
| `lib/html-tokens.mjs` | HTML 을 **적힌 그대로** 태그 조각으로 가른다(틀린 중첩을 고쳐 버리는 파서를 피한다) |
| `lib/prose-text.mjs` | 학생이 읽는 글만 남기기. `prose` 추출과 `check -- prose`가 같은 판단을 쓴다 |

시뮬레이터 동작 검사 `tests/sim-*.test.mjs`와 브라우저 검사 `tests/browser/*.test.mjs`는
**파일마다 무엇을 보는지 머리에 적혀 있다.** 이름은 `run.mjs`의 `SIMS` · `CHECKS`에 있다.

**[`subjects.json`](../subjects.json)이 검사 대상의 단일 출처다.** 검사 도구와 Vite가 **같은 파일을
읽어야** 해서 JSON으로 두었다. 까닭은 `lib/repo.mjs` 머리에 있다.

## 빌드 — `vite/`

Vite 설정(`vite.config.js`)은 조립만 하고, 하는 일은 여기 하나씩 나뉘어 있다.

| 파일 | 하는 일 |
|---|---|
| `units.js` | 무엇을 굽는가 — `subjects.json`을 읽는다 |
| `inject-code.js` | `data-src` 마커 자리에 실파일의 코드를 넣는다. **코드 주입 규약은 이 파일 머리에** |
| `vendor-public.js` | **번들에 녹이면 안 되는 파일**을 `public/`으로 — 이름이 그대로여야 하거나(MathJax 글꼴) 라이선스가 요구하거나(p5는 LGPL) |
| `copy-lecture-assets.js` | 강의노트 딸림 파일(`.py` · `.c`)을 산출물로 |
| `strip-crossorigin.js` | 원본에 없던 속성 제거 |
| `classic-scripts.js` | 페이지가 받던 청크를 **평범한 `<script defer>` 하나로** 눌러 담는다 |
| `copy-code-button.js` | 모든 `<pre>` 오른쪽 위에 복사 버튼을 얹는다 |
| `site-favicon.js` | 모든 페이지 `<head>`에 사이트 아이콘 두 줄을 넣는다 |
| `drop-ttf-fallback.js` | 아무도 받지 않는 `ttf` 대체 경로를 지운다 (PostCSS) |
| `subset-icon-font.js` | 아이콘 폰트를 **실제로 쓰는 글자만 남기고** 깎는다 |
| `third-party-notices.js` | 번들에 실제로 들어간 패키지의 라이선스 고지를 `THIRD-PARTY-NOTICES.txt`로 굽는다 |

**소스 HTML은 파일로 직접 열지 않는다.** 스타일도 라이브러리도 코드도 빌드가 넣는다.
`npm run dev`로 보고, 배포본을 확인할 일이면 `npm run build` 뒤 `dist/`를 연다.
dev도 빌드와 **같은 플러그인 사슬**을 지난다.

### 코드는 HTML에 넣지 않는다

강의노트의 `.py` · `.c`는 강의노트 옆 `code/`에 실파일로 두고, HTML에는 `data-src` 마커만 둔다.
마커 문법 · 구역 · 프론트매터 · 까닭은 [`vite/inject-code.js`](vite/inject-code.js) 머리,
구문 검사는 [`checks/code.mjs`](checks/code.mjs) 머리, 복사 버튼은
[`vite/copy-code-button.js`](vite/copy-code-button.js) 머리에 있다.

### 의존성은 전부 npm이다 — 새 라이브러리를 넣는 법

HTML에 CDN 주소를 쓰지 않는다. 어디에 넣을지는 **CSS냐 JS냐**로 갈린다.

**CSS라면** 그 단위의 `src/styles/<단위>.css`에 `@import` 한다.

```css
@import "@fortawesome/fontawesome-free/css/all.min.css";
```

**JS라면** 그 페이지의 `src/entries/<페이지>.js`에서 `import` 한다.
인라인 스크립트가 전역으로 쓰면 거기서 `window`에 얹는다.

```js
import Chart from 'chart.js/auto';
window.Chart = Chart;
```

**진입점을 페이지마다 두는 이유** — 단위로 묶으면 시뮬레이터 한 장을 열 때
d3 · p5 · ml5 · chart · vis를 전부 받게 된다. 페이지마다 두면 그 페이지가 쓰는 것만 받는다.

**산출물에서는 페이지마다 스크립트가 하나다.** 까닭은
[`vite/classic-scripts.js`](vite/classic-scripts.js) 머리에 있고, 모듈이 남지 않았는지는
`npm run check -- dist`가 지킨다.

새 라이브러리를 넣을 때 밟기 쉬운 함정(npm 판 API 차이 · 최상위 `await` · 전역에 얹는 순서 · defer)은
[사례집 「CDN에서 npm + Vite로」](../docs/강의노트-작성-사례집.md)에 있다.

**이름이 그대로여야 하는 파일만 `public/`에 둔다.** MathJax는 실행 중에 글꼴 이름을 조립해
받아오므로 해시된 자산으로 바꾸면 못 찾는다. `public/`은 저장소에 담지 않고 빌드와 dev가
매번 `node_modules`에서 채운다(`vite/vendor-public.js`).

## 배부 문서 생성기 — `docx/`

학생에게 나눠 주는 보고서 양식 `.docx`를 만든다. `npm run build`가 부른다.
부르는 법은 [`docx/build.js`](docx/build.js) 머리, 구조와 새 양식을 더하는 법은
[`docx/README.md`](docx/README.md)에 있다.

## 새 컴퓨터에서 · IDE

`npm ci` 하나면 된다. **검사도 빌드도 Node 하나로 돈다** — 파이썬과 `gcc`는 강의노트의
`.py` · `.c`를 컴파일해 보는 바깥 도구로만 쓰인다(`checks/code.mjs`). 브라우저 검사는 처음 한 번
`npx playwright install chromium`이 필요하다.

IntelliJ용 npm 실행 구성이 `.idea/runConfigurations/`에 있지만 편의용이다 — 어느 편집기에서든
터미널에서 `npm run`으로 부르면 된다. `.gitignore`가 `.idea/*`를 막고 이 폴더만 되살린다
(**`.idea/`로 막으면 git이 그 안으로 내려가지 않아 예외가 먹지 않는다**).

## 규칙은 `CLAUDE.md`에 있다

이 도구들은 규칙을 **기계적으로 확인해 주는 것**일 뿐이다.
무엇을 지켜야 하는지는 [`CLAUDE.md`](../CLAUDE.md),
왜 그런 규칙이 생겼는지는 [`docs/강의노트-작성-사례집.md`](../docs/강의노트-작성-사례집.md)에 있다.
