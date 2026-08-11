# 저장소 도구

강의노트 HTML을 고친 뒤 돌리는 **검사 스크립트**와, 학생 배부용 `.docx`를 만드는
**문서 생성기**(`docx/`)가 있다.

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

**[`subjects.json`](../subjects.json)이 검사 대상의 단일 출처다.** 파이썬(검사·구 빌더)과
Vite가 **같은 파일을 읽어야** 해서 JSON으로 두었다. 예전에는 과목 목록이 빌드와 두 감사 도구에
따로 박혀 있었고 셋이 서로 달랐다. 「정보(고등학교)」가 빌드 쪽에만 들어가 있어서
**25개 파일이 두 감사에서 통째로 빠진 채** 한동안 남아 있었다 — 그 파일들에는
검사를 통과했다는 말이 아무 의미가 없었다.

## 명령은 `package.json`에 못박혀 있다

**스크립트를 직접 부르지 않는다.** 경로와 인자를 외울 일이 없도록 루트
[`package.json`](../package.json)에 이름을 붙여 두었다. **CI도 같은 이름을 부른다** —
로컬에서 통과한 것이 CI에서 다르게 도는 일을 없애려는 것이다.

| 명령 | 하는 일 |
|---|---|
| `npm run setup` | 최초 1회. node 의존성(docx 생성기 · tailwindcss) 설치 |
| `npm run check` | **소스** 검사 — 런타임 조립 클래스 + 강의노트 코드 |
| `npm run build` | 배포와 같은 빌드 → `dist/` |
| `npm run check:dist` | **산출물** 검사 |
| **`npm run ci`** | **위 셋을 순서대로.** CI가 하는 일과 같다 |
| `npm run preview` | `--watch`. 켜 두고 작업한다 |
| `npm run build:fast` | CDN 유지, 훑어보기용. **배포본과 다르다** |
| `npm run docx` | 배부용 `.docx`만 다시 만든다 |
| `npm run check:html -- <파일>` | 파일 하나 검사 (아래 「사용」) |
| `npm run audit:pre` | `<pre>` 가로 넘침 방어 감사 |
| `npm run audit:svg` | 데스크톱에서 글자가 한없이 커지는 SVG 감사 |
| `npm run prose -- <글롭>` | 서술만 뽑기 |
| `npm run check:inject` | 코드 주입기 자체 검사 |
| `npm run setup:venv` | `.venv` 만들기. **실행에는 필요 없다** — IntelliJ 파이썬 코드 지원용 |

**인자를 받는 것은 `--` 뒤에 넘긴다.** 앞에 두면 npm이 자기 것으로 가져간다.

검사 스크립트는 표준 라이브러리만 쓰므로 **venv 없이도 돈다.** `npm run setup`이 필요한
것은 node 쪽뿐이다.

`check_dist.py`는 **배포 빌드 결과에만** 쓴다. `build:fast`는 CDN을 일부러 남기므로
그 결과에 돌리면 CDN 잔존으로 걸린다.

## 사용

`check_html.py`는 **검사 대상을 파일 안에 적어 둔다.** 지금 손대는 파일만 `TARGETS`에 남기면
`npm run check:html`만 쳐도 그것만 돈다. 끝난 파일은 지운다 —
**과거 파일이 계속 결과에 섞이지 않게 하는 것이 이 배열의 목적이다.**

```python
# tools/check_html.py 윗부분
TARGETS = [
    "정보(고등학교)/1-1-1.네트워크란-무엇인가.html",
]
```

```bash
npm run check:html                                  # TARGETS만
npm run check:html -- "인공지능기초/1-1-1.*.html"    # 인자를 주면 인자가 우선
npm run audit:pre
npm run prose -- "데이터과학/1-*.html" --stats
npm run prose -- "인공지능기초/2-1-*.html" -o 본문.md
```

인자는 `--` **뒤에** 붙인다. 앞에 두면 npm이 자기 것으로 가져간다.

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
가리키는 마커만 둔다. `.github/scripts/build_site.py`가 빌드할 때 그 자리를 채운다.

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

그래서 **`data-src`를 쓰는 강의노트는 소스를 직접 열면 코드 자리가 비어 있다.**
`npm run dev`로 본다. 실측도 원래 소스가 아니라 빌드 결과에서 하게 되어 있다.

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
`npm run check:inject`로 주입기 자체를 확인할 수 있다.

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

배포되는 것은 `.github/scripts/build_site.py`가 구운 번들이다. **소스를 열면 CDN 판이라
배포본과 다를 수 있다.** 375px 실측처럼 눈으로 재는 일은 반드시 `dist/` 쪽에서 한다.

```
IntelliJ 기본 웹서버 그대로 쓴다. 여는 주소만 바뀐다.
  http://localhost:63342/_Visual_Assets/dist/정보(고등학교)/1-1-1.….html
```

`dist/`는 gitignore돼 있어 커밋에 섞이지 않는다.

```bash
npm run preview                       # 저장하면 그 파일만 다시 굽는다
npm run build:one -- "<상대경로>"       # 파일 하나만
npm run build                         # 전체, 배포와 같은 것
```

`--watch`는 표준 라이브러리만 쓴다. 시작할 때 **밀린 파일만** 먼저 굽고, 그 뒤로는 저장된
파일 하나를 약 3~4초에 다시 굽는다. 프로필도 배포와 같은 것이라 **보이는 것이 곧 배포본**이다.

`data-src`가 가리키는 `.py`·`.c`도 함께 지켜본다. **코드 파일을 저장하면 그것을 쓰는
강의노트가 다시 구워진다.** 그래서 코드를 HTML 밖으로 빼도 편집 흐름이 끊기지 않는다.

### 실행 구성은 `.idea/runConfigurations/`에 있다

`.gitignore`가 `.idea/*`를 막되 이 폴더만 되살린다. **`.idea/`(폴더째)로 막으면
git이 그 안으로 내려가지 않아 예외가 먹지 않는다** — 반드시 `.idea/*`여야 한다.
그래서 새 실행 구성을 넣을 때 `git add -f`가 필요 없다.

| 구성 | 하는 일 |
|---|---|
| 미리보기 · 감시 (저장하면 자동) | `--watch`. 켜 두고 작업한다 |
| 미리보기 · 현재 파일 | 열어 둔 파일 하나만 다시 굽는다 |
| 미리보기 · 전체 (빠름, CDN 유지) | 146개를 훑어볼 때만. **배포본과 다르다** |
| 배포와 같은 빌드 (전체) | 최종 확인용 |
| **개발 서버 · Vite (권장)** | `npm run dev` |
| 빌드 · Vite → dist-vite | `npm run build:vite` |
| 검사 · 현재 파일 | `npm run check:html -- <파일>` |
| 검사 · 런타임 조립 클래스 | `npm run check:classes` |
| 검사 · 강의노트 코드 | `npm run check:code` |
| 검사 · 전체 (CI와 같은 것) | `npm run ci` |
| 최초 설정 · node 의존성 | `npm run setup` |
| 최초 설정 · venv 만들기 | `npm run setup:venv` |

**실행 구성은 전부 `npm run`을 부른다**(`ShConfigurationType` + powershell). 무엇을 실제로 돌릴지는
`package.json`에만 적혀 있으므로, 명령을 고치면 **IDE 버튼도 같이 바뀐다.**

전에는 실행 구성이 `.py`를 직접 부르고 인터프리터를 `.venv/Scripts/python.exe`로 못박아
두었다. 그래서 **인자와 경로가 `package.json`과 실행 구성 두 곳에 적혀 어긋났고**
(`build:fast`에 `--skip-docx`가 빠져 있었다), Windows 경로가 박혀 macOS·Linux에서는
파일마다 고쳐야 했다. npm을 거치면 둘 다 사라진다.

「현재 파일」계열은 `$FilePathRelativeToProjectRoot$` 매크로를 쓴다 — 편집기에서 보고 있는
파일이 그대로 대상이 된다.

### 새 컴퓨터에서 clone한 뒤 — 최초 1회

Run 드롭다운의 **「최초 설정 · node 의존성」** 하나면 된다(`npm run setup`).
실행 구성이 powershell로 npm을 부르므로 **`.venv`가 없어도 전부 돈다.**

```bash
npm run setup       # docx 생성기 + tailwindcss
```

**파이썬 쪽은 설치할 패키지가 없다.** 검사 스크립트도 빌드 스크립트도 **표준 라이브러리만**
쓰므로 시스템 `python`으로 그대로 돌아간다.

`npm run setup:venv`(`.venv` 만들기)는 **IntelliJ의 파이썬 코드 지원용**으로만 남겨 두었다.
실행에는 필요 없다. `--without-pip`으로 만들어도 충분하다(약 3초).

## 배부 문서 생성기 — `docx/`

학생에게 나눠 주는 보고서 양식 `.docx`를 만든다. node와 `docx` 패키지가 필요하다.

```bash
npm run setup                    # 최초 1회. 락파일이 추적되므로 install이 아니라 ci
npm run docx                     # 저장소 어디서든 실행 가능
```

출력 루트는 `DOCX_OUT_ROOT`로 바꿀 수 있다. 배포 빌드가 `dist/` 안으로 바로 뽑을 때 쓴다.

```bash
DOCX_OUT_ROOT=dist npm run docx   # dist/templates/py/… 로 나간다
```

| 파일 | 역할 |
|---|---|
| `build.js` | `make/*.js`를 전부 실행한다. 하나라도 실패하면 종료 코드 1 |
| `outpath.js` | **산출물이 어느 폴더로 나가는지 정하는 유일한 곳** |
| `make/*.js` | 문서 하나씩의 내용. 39개 |

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

생성기를 그냥 돌리면(`DOCX_OUT_ROOT` 없이) 결과가 소스 트리에 떨어지는데
**그건 로컬 확인용이고 gitignore돼 있다.**

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
