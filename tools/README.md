# 저장소 도구

**루트가 부르는 스크립트를 모아 둔 곳이다.** 셋으로 나뉜다 —
빌드 플러그인(`vite/`), 강의노트를 고친 뒤 돌리는 **검사 스크립트**,
학생 배부용 `.docx`를 만드는 **문서 생성기**(`docx/`).

아래 검사 스크립트는 표준 라이브러리만 쓰므로 설치할 것이 없다.
생성기는 node 의존성이 있다 → [배부 문서 생성기](#배부-문서-생성기--docx).

| 파일 | 용도 | 언제 쓰나 |
|---|---|---|
| `check_html.py` | 태그 중첩 · 최소 글자 크기(CSS·SVG) · 테이블 래퍼 · 제목 일치 · 금지 요소 검사 | **파일을 고칠 때마다** |
| `check_dynamic_classes.py` | 런타임에 조립되는 Tailwind 클래스 검출 | **JS로 클래스를 붙이는 코드를 쓸 때마다** |
| `check_code.py` | 강의노트가 끌어다 쓰는 `.py`·`.c`의 구문 오류 + `data-src` 마커 해석 | **코드 파일을 고칠 때마다** |
| `check_dist.py` | **산출물** 검사 — `.docx` 링크 · CDN 잔존 · 태그 중첩 | 배포 전. `npm run ci`가 부른다 |
| `audit_pre.py` | `<pre>` 가로 넘침 방어 여부 점검 | 코드 블록을 넣거나 고쳤을 때 |
| `audit_svg_maxwidth.py` | 데스크톱에서 글자가 한없이 커지는 SVG 검출 | 도해를 넣거나 고쳤을 때 |
| `extract_prose.py` | HTML에서 학생이 실제로 읽는 글자만 추출 | 서술을 통독·감사할 때 |
| `subjects.py` | 루트 [`subjects.json`](../subjects.json)을 읽는 얇은 층 | 새 과목을 만들 때 |

**[`subjects.json`](../subjects.json)이 검사 대상의 단일 출처다.** 파이썬 검사 도구와
Vite가 **같은 파일을 읽어야** 해서 JSON으로 두었다. 예전에는 과목 목록이 빌드와 두 감사 도구에
따로 박혀 있었고 셋이 서로 달랐다. 「정보(고등학교)」가 빌드 쪽에만 들어가 있어서
**25개 파일이 두 감사에서 통째로 빠진 채** 한동안 남아 있었다 — 그 파일들에는
검사를 통과했다는 말이 아무 의미가 없었다.

## 명령은 `package.json`에 못박혀 있다

**실행점은 셋뿐이다.** IntelliJ 실행 구성도, GitHub Actions도 이것만 부른다.

| | |
|---|---|
| **`npm run dev`** | Vite 개발 서버. 저장하면 바로 반영된다 |
| **`npm run build`** | 배포와 같은 빌드 → `dist/` |
| **`npm run ci`** | 검사 → 빌드 → 산출물 검사. **CI가 하는 일과 같은 한 줄** |

나머지는 이 셋이 조립해 쓰는 조각이다. 사람이 따로 부를 일도 있어 이름을 붙여 두었다.

| | |
|---|---|
| `setup` | 최초 1회. node 의존성 |
| `build`가 부르는 것 | `vite build` → 배부 문서 생성 |
| `check:classes` · `check:code` | `check`가 부른다 |
| `check:dist` | 산출물 검사 |
| `check:html -- <파일>` | 파일 하나 검사 (아래 「사용」) |
| `audit:pre` · `audit:svg` | 가로 넘침 · SVG 글자 크기 감사 |
| `prose -- <글롭>` | 서술만 뽑기 |
| `docx` | 배부 문서 생성 |

**인자를 받는 것은 `--` 뒤에 넘긴다.** 앞에 두면 npm이 자기 것으로 가져간다.

### 빌드는 Vite가 한다

`build`는 `vite build`와 배부 문서 생성기를 부른다. Vite 설정은 조립만 하고,
하는 일은 [`vite/`](vite) 밑에 하나씩 나뉘어 있다.

| 파일 | 하는 일 |
|---|---|
| `units.js` | 무엇을 굽는가 — `subjects.json`을 읽는다 |
| `inject-code.js` | `data-src` 마커 자리에 실파일의 코드를 넣는다 |
| `vendor-public.js` | 이름이 그대로여야 하는 파일(MathJax 글꼴)만 `public/`으로 |
| `copy-lecture-assets.js` | 강의노트 딸림 파일(`.py`·`.c`)을 산출물로 |
| `strip-crossorigin.js` | 원본에 없던 속성 제거 |

**Tailwind는 단위마다 한 번씩** 굽는다. 파일마다 굽던 때는 146번이었고 3분 32초가 걸렸다.

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
d3·p5·ml5·chart·vis를 전부 받게 된다. 페이지마다 두면 그 페이지가 쓰는 것만 받고,
여러 페이지가 함께 쓰는 것은 Vite가 공통 청크로 뽑아 캐시된다.

**옮기며 밟은 함정 넷.** 새 라이브러리를 넣을 때 같은 것을 겪을 수 있다.

| | |
|---|---|
| **npm 판과 CDN 판의 API가 다를 수 있다** | lucide는 UMD 판이 `createIcons()`만으로 됐지만 npm 판은 아이콘 목록을 받는다. 호출부를 다 고치는 대신 진입점에서 감쌌다 |
| **최상위 `await`를 쓰지 않는다** | 모듈 완료가 `window.onload`보다 늦어져 그때 부르는 코드가 조용히 실패한다. Prism 하이라이팅이 그렇게 죽었다 |
| **전역에 얹는 순서** | Prism 언어 확장은 전역 `Prism`이 선 뒤에 평가되어야 한다. `_lib/prism.js`를 먼저 `import` 하는 정적 순서로 맞춘다 |
| **모듈은 defer다** | body 끝 인라인 스크립트가 **먼저** 돈다. 거기서 라이브러리를 바로 부르면 깨진다 — `DOMContentLoaded`로 미룬다 |

**이름이 그대로여야 하는 파일만 `public/`에 둔다.** 지금은 MathJax 글꼴뿐이다.
MathJax는 실행 중에 `${fontURL}/MathJax_Main-Regular.woff` 식으로 이름을 조립해
받아오므로 해시된 자산으로 바꾸면 못 찾는다. `public/`은 저장소에 담지 않고
빌드와 dev가 매번 `node_modules`에서 채운다.

## 사용

`check_html.py`는 **인자가 없으면 저장소 전체를 검사한다.** `npm run ci`가 이 길로 온다.

예전에는 손대는 파일만 `TARGETS` 배열에 적는 방식이었다. 그런데 **검사가 CI 밖에 있으니
손대지 않은 파일의 위반이 조용히 쌓였다** — 나중에 세어 보니 377건이었다.
지금은 반대로, 전체가 기본이고 좁히고 싶을 때만 인자를 준다.

```bash
npm run check:html                                  # 저장소 전체 (CI와 같다)
npm run check:html -- "인공지능기초/1-1-1.*.html"    # 인자를 주면 그것만
npm run audit:pre
npm run prose -- "데이터과학/1-*.html" --stats
npm run prose -- "인공지능기초/2-1-*.html" -o 본문.md
```

인자는 `--` **뒤에** 붙인다. 앞에 두면 npm이 자기 것으로 가져간다.

글롭은 **여러 개를 이어서** 줄 수 있다(`"…/3-1-*.html" "…/3-2-*.html"`).
경로는 현재 디렉터리 → 저장소 루트 순으로 찾으므로 어디서 실행해도 된다.

**위반이 있으면 종료 코드 1**로 끝난다(`확인 필요`는 0). 훅·CI·`&&` 체인에 걸어도 된다.

**지금 기준선은 위반 0 · 확인 필요 0이다**(2026-08-12). `확인 필요`는 CI를 막지 않지만
**0이 아니면 새로 생긴 것**이므로 그대로 두지 않는다. 예전에는 264건이 쌓여 있어서
새로 생긴 것이 묻혔다 — 0을 유지해야 이 신호가 쓸모 있다.
SVG 글자 크기로 걸렸다면 → [`docs/수정-레시피.md`](../docs/수정-레시피.md)

### 전체 검사에서 빠지는 둘

**경로를 검사기에 직접 적지 않는다.** 둘 다 `subjects.json`에서 읽으므로 폴더를 옮겨도 따라온다.

| 무엇 | 왜 | 언제 풀리나 |
|---|---|---|
| `standalone`(시뮬레이터)의 **글자 크기** | 글자 크기 규칙은 강의노트의 것이다 — 「시뮬레이터의 조작 UI는 이 규칙의 범위 밖」 | 안 풀린다. 제목·중첩·표 래퍼 등 나머지는 그대로 적용된다 |
| `프로그래밍(C)`·`(Python)` **전체** | 전면 재작성 대기(U5). 지금 고치면 파일명·번호 체계가 바뀌며 버려진다 | 재작성이 끝나면 `REWRITE_PENDING`을 비운다 |

**인자로 짚으면 예외 없이 검사한다.** `npm run check:html -- "프로그래밍(C)/2-1.*.html"`은
재작성 대기 파일도 그대로 본다 — 건너뛰는 것은 인자 없이 전체를 돌 때뿐이다.

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
> 그래서 `REWRITE_PENDING`으로 **전체 검사에서 빼 두었다** — 인자로 짚으면 그대로 걸린다.
> (인공지능기초·시뮬레이터의 옛 양식은 2026-08-12에 전부 맞췄다.)

## `check_dynamic_classes.py` — 클래스 이름을 코드로 만들지 않는다

배포본의 CSS는 Tailwind CLI가 파일을 텍스트로 훑어 **리터럴로 있는 클래스만** 구워서 만든다.
그래서 클래스 이름을 조립하면 그 클래스가 CSS에서 빠진다.

```html
<div class="bg-${lang.color}-50">          <!-- X — bg-yellow-50 이 CSS에 없다 -->
<div class="${lang.iconClass}">            <!-- O — 완성된 문자열을 데이터에 리터럴로 -->
```

**CDN을 쓰던 시절에는 런타임 JIT라 소스를 열면 멀쩡히 보였다.** 그래서 눈으로는 절대 안 잡혔다.
실제로 `프로그래밍(Python)/1-1-2`에서 클래스 8개 중 3개(`bg-amber-50`, `bg-yellow-50`,
`text-yellow-600`)가 빠진 채 오래 남아 있었다. 나머지 5개는 우연히 같은 파일 안에
리터럴로 또 있어서 살아남은 것뿐이다.

```bash
npm run check:classes                          # 저장소 전체
npm run check:classes -- "정보*/*.html"          # 글롭도 된다
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

## 코드는 HTML에 넣지 않는다 — `data-src` 마커와 빌드 주입

강의노트에 보일 `.py`·`.c`는 **실파일로 저장소에 두고**, HTML에는 어느 파일을 넣을지
가리키는 마커만 둔다. 빌드의 [`vite/inject-code.js`](vite/inject-code.js)가 그 자리를 채운다.

```html
<pre><code class="language-python" data-src="code/변수.py"></code></pre>
<pre><code class="language-c" data-src="code/조건.c#비교"></code></pre>
```

`#뒤`는 구역 이름이다. 없으면 파일 전체가 들어간다.

```c
#include <stdio.h>

int main(void) {
    int a = 3;
    // region: 비교
    if (a < 5) {
        printf("작다\n");
    }
    // endregion
    return 0;
}
```

구역만 뽑으면 **공통 들여쓰기가 벗겨져** 조각으로 자연스럽게 보인다. 파일 전체를 넣으면
`region`·`endregion` 표시줄은 빠진다. `<`·`>`·`&`는 주입할 때 자동으로 이스케이프되므로
**소스 파일에는 코드를 그냥 코드로 쓴다.**

### 왜 이렇게 하나

전에는 코드가 HTML 안에 이스케이프된 채로 들어 있어서 **오타 하나 고치기가 어려웠다.**
같은 블록 안에서 주석의 `<`는 raw, 코드의 `<`는 `&lt;`인 곳이 다섯 군데 있었는데
브라우저에서는 똑같이 보여 눈으로 찾을 수가 없었다. 실파일로 두면 편집기가 문법을 알고,
검사기가 구문 오류를 잡고, 학생이 받아 가는 파일과 화면에 뜨는 코드가 같아진다.

**런타임 `fetch`가 아니라 빌드 주입인 이유** — 페이지를 열 때 왕복이 한 번 더 생기지 않고,
마커가 깨졌으면 배포가 아니라 **빌드가 선다.** 웹이든 내려받은 사본이든 같은 파일이 된다.

**소스 HTML은 파일로 직접 열지 않는다.** 스타일도 코드도 빌드가 넣으므로
`npm run dev`로 봐야 한다.

### 지켜야 할 것

| | |
|---|---|
| 코드 파일은 **그 강의노트 옆 `code/`** 에 둔다 | 링크에 `../`가 없다. `check_code.py`도 `code/` 밑만 검사한다 |
| 코드 파일은 **`dist/`에 그대로 복사된다** | 화면에 보이기만 하는 것이 아니라 **학생이 내려받아 실행하는 파일**이다. 오프라인 zip에도 들어간다 |
| 마커가 없는 HTML은 **그대로 통과**한다 | 기존 파일을 건드리지 않고 새 파일부터 하나씩 옮겨 갈 수 있다 |
| 파일·구역이 없으면 **빌드가 선다** | 조용히 빈 블록이 배포되는 것보다 낫다. 있는 구역 목록을 함께 알려 준다 |
| 홀로 서지 않는 조각 모음은 **구문 검사에서 뺀다** | 아래 프론트매터 |

```python
# ---
# check: none
# ---
```

`---`를 그냥 첫 줄에 쓰면 `.c`가 컴파일되지 않으므로 **주석 안에** 넣는다.
프론트매터는 주입할 때 빠지므로 화면에는 안 보인다.

**되도록 `check: none`을 쓰지 않는다.** 파일 전체를 온전한 프로그램으로 두고
구역으로 일부만 뽑아 쓰면, 구문 검사도 받고 학생에게 통째로 줄 수도 있다.

```bash
npm run check:code
```

`.c` 검사에는 `gcc`가 필요하다. 없으면 건너뛰되 CI에서는 검사된다.

**마커가 가리키는 파일과 구역이 실제로 있는지는 빌드가 본다** —
`tools/vite/inject-code.js`가 못 찾으면 있는 구역 목록을 알려 주며 빌드를 세운다.
같은 검사를 두 곳에 두면 둘이 어긋나므로 검사기 쪽에서는 하지 않는다.

### 복사 버튼 — 위임 리스너 하나로

블록마다 `id`를 붙이고 `onclick="copyCode('code-98')"`을 쓰던 방식은 쓰지 않는다.
**id가 파일을 넘어 95개나 중복**돼 있었고, 코드가 실파일로 빠지면 id를 붙일 자리도 없다.
아래를 파일에 하나만 두면 블록이 몇 개든 동작한다.

```html
<script>
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-copy]');
        if (!btn) return;
        const code = btn.closest('.code-block')?.querySelector('code');
        if (!code) return;
        try {
            await navigator.clipboard.writeText(code.textContent);
        } catch {
            // file://은 보안 컨텍스트가 아니라 navigator.clipboard가 없다.
            // 오프라인 zip을 그대로 여는 학생이 있으므로 폴백을 지운다.
            const ta = document.createElement('textarea');
            ta.value = code.textContent;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } finally { ta.remove(); }
        }
        const before = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> 복사됨';
        setTimeout(() => { btn.innerHTML = before; }, 1500);
    });
</script>
```

`textContent`를 쓰므로 **주입된 코드가 그대로 복사된다.** 이스케이프를 되돌릴 필요가 없다.

## 미리보기 — 소스가 아니라 `dist/`를 연다

**소스 HTML을 파일로 직접 열면 아무것도 안 보인다.** 스타일도 라이브러리도 코드도
빌드가 넣는다. `npm run dev`로 보거나, 배포본을 확인할 일이면 `npm run build` 뒤 `dist/`를 연다.

```
IntelliJ 기본 웹서버 그대로 쓴다. 여는 주소만 바뀐다.
  http://localhost:63342/_Visual_Assets/dist/정보(고등학교)/1-1-1.….html
```

`dist/`는 gitignore돼 있어 커밋에 섞이지 않는다.

```bash
npm run dev       # Vite 개발 서버. 저장하면 바로 반영된다
npm run build     # 전체, 배포와 같은 것
```

dev도 빌드와 **같은 플러그인 사슬**을 지나므로 보이는 것이 곧 배포본이다.

`data-src`가 가리키는 `.py`·`.c`는 **페이지를 열 때마다** 주입된다. 새로고침하면 고친 코드가
그대로 뜨지만, 이 파일들은 **Vite의 모듈 그래프 밖이라 저장만으로 다시 뜨지는 않는다** —
HMR이 걸리지 않으므로 새로고침은 손으로 한다.

### 실행 구성은 `.idea/runConfigurations/`에 있다

**`dev` · `build` · `ci` 셋뿐이다.** 나머지는 터미널에서 `npm run …`으로 부른다 —
버튼을 명령 수만큼 늘리면 어느 것이 지금 쓰는 것인지 되레 흐려진다.

| 구성 | |
|---|---|
| `dev` | `npm run dev` — Vite 개발 서버 |
| `build` | `npm run build` — 배포와 같은 빌드 |
| `ci` | `npm run ci` — 검사 → 빌드 → 산출물 검사 |

`.gitignore`가 `.idea/*`를 막되 이 폴더만 되살린다. **`.idea/`(폴더째)로 막으면
git이 그 안으로 내려가지 않아 예외가 먹지 않는다** — 반드시 `.idea/*`여야 한다.
그래서 새 실행 구성을 넣을 때 `git add -f`가 필요 없다.

셋 다 **npm 실행 구성**(`js.build_tools.npm`)이라 Run 탭에서 바로 돈다.
셸을 거치지 않으므로 **Windows 전용 설정이 되지 않는다** — powershell 경로를 박으면
macOS·Linux에서 그대로 죽는다.

무엇을 실제로 돌릴지는 `package.json`에만 적혀 있으므로, 명령을 고치면
**IDE 버튼도 같이 바뀐다.**

### 새 컴퓨터에서 clone한 뒤 — 최초 1회

```bash
npm ci            # 루트: Vite · Tailwind · 글꼴 패키지
npm run setup     # docx 생성기의 node 의존성
```

**파이썬 쪽은 설치할 패키지가 없다.** 검사도 빌드도 **표준 라이브러리만** 쓰므로
시스템 `python`으로 그대로 돌아간다. venv는 IntelliJ의 파이썬 코드 지원이 필요할 때만
만들면 되고, 실행에는 쓰이지 않는다.

## 배부 문서 생성기 — `docx/`

학생에게 나눠 주는 보고서 양식 `.docx`를 만든다. node와 `docx` 패키지가 필요하다.

```bash
npm run setup                    # 최초 1회. 락파일이 추적되므로 install이 아니라 ci
npm run docx                     # 저장소 어디서든 실행 가능
```

**출력 루트는 기본이 `dist/`다.** 그래서 배포 빌드는 아무것도 넘기지 않는다.
다른 자리로 뽑아 볼 때만 `DOCX_OUT_ROOT`로 바꾼다.

```bash
npm run docx                        # dist/templates/py/… 로 나간다
DOCX_OUT_ROOT=/tmp/확인 npm run docx   # 다른 자리에 뽑아 볼 때만
```

| 파일 | 역할 |
|---|---|
| `build.js` | `make/*.js`를 전부 실행한다. 하나라도 실패하면 종료 코드 1 |
| `outpath.js` | **산출물이 어느 폴더로 나가는지 정하는 유일한 곳** |
| `make/*.js` | 양식의 «틀» 둘과, 틀에 넣을 «내용» 하나씩 |

**새 양식을 추가하는 법은 [`tools/docx/README.md`](docx/README.md)에 있다** —
틀과 내용을 나눈 구조, 데이터 필드, 파일명 규칙.

**출력 경로를 `make/*.js`에 적지 않는다.** `outpath.js`의 `DEST` 표에서 가져다 쓴다.

```javascript
const out = require('../outpath');
makeDocument({ … }, out('py', '3-2-1.docx'));
```

폴더를 옮길 때 `DEST` 한 곳만 고치면 된다. 예전에는 39개 파일에 `"../py/…"`가
흩어져 있어서 옮길 때마다 전부 손봐야 했다.

### 산출물은 저장소에 담지 않는다

**`.docx`는 git에 없다.** 배포 빌드가 `dist/` 안에 매번 새로 만든다.

담았던 시절에는 `make/`만 고치고 다시 만들지 않아 산출물이 조용히 어긋났다 — AI 양식 8개가
두 달 동안 스크립트는 `오렌지`, 문서는 `오렌지3`인 채로 남아 있었다. 생성기를 빌드에 넣으면서
이 실패 유형 자체가 사라졌다. **이제 `make/`를 고치면 다음 배포에 그대로 반영된다.**

생성기를 그냥 돌려도 결과는 `dist/`로 나간다. 소스 트리에는 떨어지지 않는다.

**산출물은 그것을 링크하는 강의노트 바로 옆 `docx/`에 둔다.** 그러면 링크에 `../`가 없어
파일이 옮겨져도 안 깨지고, 과목 폴더가 자기 자산을 갖는다. 저장소 `.gitignore`가
`**/docx/`를 통째로 무시하므로 **「`docx`라는 이름의 폴더는 전부 생성물」**이 이 저장소의 약속이다.

```
인공지능기초/ai-projects/ai-sample-1-….html  →  docx/ai_sample_1_….docx   (../ 없음)
templates/py, templates/c                     ← 프로그래밍의 옛 자리. 통합 때 옮긴다
```

`.docx`는 같은 코드로 다시 만들어도 **바이트가 달라진다** — `docProps/core.xml`에
생성 시각이 들어가기 때문이다. 내용이 같은지 보려면 그 항목을 빼고 zip 항목별로 비교해야 한다.

## 규칙은 `CLAUDE.md`에 있다

이 도구들은 규칙을 **기계적으로 확인해 주는 것**일 뿐이다.
무엇을 지켜야 하는지는 [`CLAUDE.md`](../CLAUDE.md),
왜 그런 규칙이 생겼는지는 [`docs/강의노트-작성-사례집.md`](../docs/강의노트-작성-사례집.md)에 있다.
