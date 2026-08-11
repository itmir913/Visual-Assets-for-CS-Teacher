# 저장소 도구

강의노트 HTML을 고친 뒤 돌리는 **검사 스크립트**와, 학생 배부용 `.docx`를 만드는
**문서 생성기**(`docx/`)가 있다.

아래 검사 스크립트는 표준 라이브러리만 쓰므로 설치할 것이 없다.
생성기는 node 의존성이 있다 → [배부 문서 생성기](#배부-문서-생성기--docx).

| 파일 | 용도 | 언제 쓰나 |
|---|---|---|
| `check_html.py` | 태그 중첩 · 최소 글자 크기(CSS·SVG) · 테이블 래퍼 · 제목 일치 · 금지 요소 검사 | **파일을 고칠 때마다** |
| `check_dynamic_classes.py` | 런타임에 조립되는 Tailwind 클래스 검출 | **JS로 클래스를 붙이는 코드를 쓸 때마다** |
| `audit_pre.py` | `<pre>` 가로 넘침 방어 여부 점검 | 코드 블록을 넣거나 고쳤을 때 |
| `extract_prose.py` | HTML에서 학생이 실제로 읽는 글자만 추출 | 서술을 통독·감사할 때 |

## 사용

`check_html.py`는 **검사 대상을 파일 안에 적어 둔다.** 지금 손대는 파일만 `TARGETS`에 남기면
`python tools/check_html.py`만 쳐도 그것만 돈다. 끝난 파일은 지운다 —
**과거 파일이 계속 결과에 섞이지 않게 하는 것이 이 배열의 목적이다.**

```python
# tools/check_html.py 윗부분
TARGETS = [
    "인공지능기초/1-1-2.인공지능의-원리.html",
]
```

```bash
python tools/check_html.py                            # TARGETS만
python tools/check_html.py 인공지능기초/1-1-1.*.html   # 인자를 주면 인자가 우선
python tools/audit_pre.py
python tools/extract_prose.py "데이터과학/1-*.html" --stats
python tools/extract_prose.py "인공지능기초/2-1-*.html" -o 본문.md
```

글롭은 **여러 개를 이어서** 줄 수 있다(`"…/3-1-*.html" "…/3-2-*.html"`).
경로는 현재 디렉터리 → 저장소 루트 순으로 찾으므로 어디서 실행해도 된다.

**위반이 있으면 종료 코드 1**로 끝난다(`확인 필요`는 0). 훅·CI·`&&` 체인에 걸어도 된다.

## `check_html.py`가 잡는 것과 못 잡는 것

**잡는다**
- 태그 중첩 오류 — `html.parser` 스택으로 검사한다. 절을 나눈 직후 반드시 돌린다.
  오류는 `</section> 앞에 닫히지 않은 태그 <div>(N행)`처럼 **줄 번호를 짚어 준다.**
- `text-sm` 이하 클래스와 임의 크기(`text-[11px]` 등)
- CSS `font-size`의 px·rem·em을 px로 환산해 **12px 미만은 위반, 16px 미만은 확인 필요**
- **SVG의 `font-size` 속성** — viewBox 폭과 `min-width`·`max-width`로
  375px에서 실제로 몇 px이 되는지 환산한다. 브라우저 실측과 값이 일치한다.
  `viewBox="0 0 720 …"` 그림의 `font-size="16"`은 **약 7.6px**로 그려진다.
  `min-width`는 SVG 자신의 `style`뿐 아니라 **조상의 `style`과 Tailwind
  `min-w-[480px]` 클래스까지** 본다. 래퍼가 폭을 잡아 주는
  `<div class="min-w-[480px]"><svg class="w-full">` 형태를 오탐하지 않기 위해서다.
- `<table>`이 `overflow-x-auto` 요소 **안에 실제로 들어 있는지**(조상 스택으로 확인,
  「앞 6줄에 문자열이 있나」식 어림이 아니다)
- **제목이 파일명 · `<title>` · `<h1>` 세 곳에서 같은지.** 비교할 때
  태그와 HTML 엔티티를 풀고 **글자와 숫자만 남긴다** — 파일명은 공백을 `-`로 적고
  본문은 `&middot;`를 쓰므로, 구분 기호를 떼지 않으면 멀쩡한 파일이 걸린다.
  **nav 제목은 대조하지 않는다** — 좁은 nav 바에 맞춰 줄여 적는 것이 관행이라
  (`회귀 분석으로 행복 요건 찾기` → `회귀로 행복 요건 찾기`) 기계가 가릴 수 없다.
- **hero `<h1>` 안의 `<br>`**
- **`<sup>`/`<sub>`** — 브라우저가 `0.83em`으로 줄여 `text-base` 문단에서 12~13.5px이
  되는데, 소스에 `text-sm`이 없어 글자 크기 검사로는 통과한다. 그래서 따로 잡는다.
- **`list-inside`**
- **Font Awesome 버전** — `FA_VERSION`(6.7.2)과 다르면 위반

> 제목 검사는 **프로그래밍(Python)·(C) 44개에서 전부 걸린다.** 고장이 아니라
> 그 44개가 이 관행을 적용하지 않은 채로 남아 있기 때문이다(전면 재작성 대기 중).
> 인공지능기초 5개는 `<h1>`을 「부제, 제목」으로 적는 옛 양식이라 함께 걸린다.
> `TARGETS`나 인자로 대상을 좁혀 돌리므로 평소 작업에는 섞이지 않는다.

## `check_dynamic_classes.py` — 클래스 이름을 코드로 만들지 않는다

배포본의 CSS는 Tailwind CLI가 파일을 텍스트로 훑어 **리터럴로 있는 클래스만** 구워서 만든다.
그래서 클래스 이름을 조립하면 그 클래스가 CSS에서 빠진다.

```html
<div class="bg-${lang.color}-50">          <!-- X — bg-yellow-50 이 CSS에 없다 -->
<div class="${lang.iconClass}">            <!-- O — 완성된 문자열을 데이터에 리터럴로 -->
```

**소스를 그대로 열면(CDN 판) 런타임 JIT라 멀쩡히 보인다.** 그래서 눈으로는 절대 안 잡힌다.
실제로 `프로그래밍(Python)/1-1-2`에서 클래스 8개 중 3개(`bg-amber-50`, `bg-yellow-50`,
`text-yellow-600`)가 빠진 채 오래 남아 있었다. 나머지 5개는 우연히 같은 파일 안에
리터럴로 또 있어서 살아남은 것뿐이다.

```bash
python tools/check_dynamic_classes.py                 # 저장소 전체
python tools/check_dynamic_classes.py "정보*/*.html"   # 글롭도 된다
```

배포 워크플로가 빌드 전에 이 검사를 돌린다. 위반이 있으면 종료 코드 1.

**못 잡는다 — 브라우저 375px 실측이 필요하다**
- 섹션이 6화면을 넘는지
- 페이지 가로 넘침(`table-prose`를 flex 자식에 넣고 `min-w-0`을 빠뜨린 경우)
- `table-prose`를 붙여야 하는 표인지(열 개수·내용으로 판단하는 규칙이라 사람이 본다)

```javascript
// 375×812 뷰포트에서
JSON.stringify({
    docScrollW: document.documentElement.scrollWidth,          // 375여야 한다
    sections: [...document.querySelectorAll('main > section')].map(s => ({
        id: s.id, 화면수: +(s.getBoundingClientRect().height / 812).toFixed(1)
    }))
})
```

`clientWidth`가 정말 375인지 **매번 함께 찍어 확인한다.** 뷰포트가 바뀐 채로 재면 값이 전부 틀린다.

## `extract_prose.py`

HTML의 83%는 Tailwind 클래스와 SVG 좌표다. 서술만 보려면 이걸로 뽑는다.

- `h1`/`h2`/`h3`를 **섹션 id와 함께** 마크다운 제목으로 남겨 위치를 짚어 회신할 수 있다.
- `head`/`style`/`script`는 버리고, SVG는 `aria-label`만 `[그림] …`으로,
  `<summary>`는 `[접기] …`로 남긴다.
- 읽을 때는 `limit`을 파일 줄 수보다 크게 줘서 **한 번에** 읽는다. 나눠 읽으면 토큰이 몇 배가 된다.

## 미리보기 — 소스가 아니라 `dist/`를 연다

배포되는 것은 `.github/scripts/build_site.py`가 구운 번들이다. **소스를 열면 CDN 판이라
배포본과 다를 수 있다.** 375px 실측처럼 눈으로 재는 일은 반드시 `dist/` 쪽에서 한다.

```
IntelliJ 기본 웹서버 그대로 쓴다. 여는 주소만 바뀐다.
  http://localhost:63342/_Visual_Assets/dist/정보(고등학교)/1-1-1.….html
```

`dist/`는 gitignore돼 있어 커밋에 섞이지 않는다.

```bash
python .github/scripts/build_site.py --watch --out dist       # 저장하면 그 파일만 다시 굽는다
python .github/scripts/build_site.py --only "<상대경로>" --out dist
python .github/scripts/build_site.py --out dist               # 전체, 배포와 같은 것
```

`--watch`는 표준 라이브러리만 쓴다. 시작할 때 **밀린 파일만** 먼저 굽고, 그 뒤로는 저장된
파일 하나를 약 3~4초에 다시 굽는다. 프로필도 배포와 같은 것이라 **보이는 것이 곧 배포본**이다.

### 실행 구성은 `.run/`에 있다

`.idea/`는 gitignore라 실행 구성이 공유되지 않는다. IntelliJ는 `.run/`의 XML도
실행 구성으로 읽으므로 그쪽에 둔다. Run 드롭다운에 바로 뜬다.

| 구성 | 하는 일 |
|---|---|
| 미리보기 · 감시 (저장하면 자동) | `--watch`. 켜 두고 작업한다 |
| 미리보기 · 현재 파일 | 열어 둔 파일 하나만 다시 굽는다 |
| 미리보기 · 전체 (빠름, CDN 유지) | 146개를 훑어볼 때만. **배포본과 다르다** |
| 배포와 같은 빌드 (전체) | 최종 확인용 |
| 검사 · 현재 파일 | `check_html.py` |
| 검사 · 런타임 조립 클래스 | `check_dynamic_classes.py` |

「현재 파일」계열은 `$FilePathRelativeToProjectRoot$` 매크로를 쓴다 — 편집기에서 보고 있는
파일이 그대로 대상이 된다.

## 배부 문서 생성기 — `docx/`

학생에게 나눠 주는 보고서 양식 `.docx`를 만든다. node와 `docx` 패키지가 필요하다.

```bash
cd tools/docx && npm ci          # 최초 1회. 락파일이 추적되므로 install이 아니라 ci
node tools/docx/build.js         # 저장소 어디서든 실행 가능
```

출력 루트는 `DOCX_OUT_ROOT`로 바꿀 수 있다. 배포 빌드가 `dist/` 안으로 바로 뽑을 때 쓴다.

```bash
DOCX_OUT_ROOT=dist node tools/docx/build.js   # dist/templates/py/… 로 나간다
```

| 파일 | 역할 |
|---|---|
| `build.js` | `make/*.js`를 전부 실행한다. 하나라도 실패하면 종료 코드 1 |
| `outpath.js` | **산출물이 어느 폴더로 나가는지 정하는 유일한 곳** |
| `make/*.js` | 문서 하나씩의 내용. 39개 |

**출력 경로를 `make/*.js`에 적지 않는다.** `outpath.js`의 `DEST` 표에서 가져다 쓴다.

```javascript
const out = require('../outpath');
makeDocument({ … }, out('py', '3-2-1.docx'));
```

폴더를 옮길 때 `DEST` 한 곳만 고치면 된다. 예전에는 39개 파일에 `"../py/…"`가
흩어져 있어서 옮길 때마다 전부 손봐야 했다.

### 산출물은 코드를 고친 뒤 반드시 다시 만든다

`.docx`는 git에 커밋되는 **생성물**이라 스크립트만 고치면 조용히 어긋난다.
실제로 AI 양식 8개가 두 달 동안 낡은 채로 남아 있었다(스크립트는 `오렌지`,
문서는 `오렌지3`). **`make/`를 건드렸으면 `build.js`를 돌리고 결과까지 커밋한다.**

`.docx`는 같은 코드로 다시 만들어도 **바이트가 달라진다** — `docProps/core.xml`에
생성 시각이 들어가기 때문이다. 내용이 같은지 보려면 그 항목을 빼고 zip 항목별로 비교해야 한다.

## 규칙은 `CLAUDE.md`에 있다

이 도구들은 규칙을 **기계적으로 확인해 주는 것**일 뿐이다.
무엇을 지켜야 하는지는 [`CLAUDE.md`](../CLAUDE.md),
왜 그런 규칙이 생겼는지는 [`docs/강의노트-작성-사례집.md`](../docs/강의노트-작성-사례집.md)에 있다.
