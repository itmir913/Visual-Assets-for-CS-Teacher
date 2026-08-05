# 강의노트 점검 도구

강의노트 HTML을 고친 뒤 돌리는 검사 스크립트다. 표준 라이브러리만 쓰므로 설치할 것이 없다.

| 파일 | 용도 | 언제 쓰나 |
|---|---|---|
| `check_html.py` | 태그 중첩 · 최소 글자 크기 · 테이블 래퍼 검사 | **파일을 고칠 때마다** |
| `audit_pre.py` | `<pre>` 가로 넘침 방어 여부 점검 | 코드 블록을 넣거나 고쳤을 때 |
| `extract_prose.py` | HTML에서 학생이 실제로 읽는 글자만 추출 | 서술을 통독·감사할 때 |

## 사용

```bash
python tools/check_html.py 인공지능기초/1-1-1.*.html
python tools/check_html.py 인공지능기초/*.html          # 전체
python tools/audit_pre.py
python tools/extract_prose.py "데이터과학/1-*.html" --stats
python tools/extract_prose.py "인공지능기초/2-1-*.html" -o 본문.md
```

글롭은 **여러 개를 이어서** 줄 수 있다(`"…/3-1-*.html" "…/3-2-*.html"`).

## `check_html.py`가 잡는 것과 못 잡는 것

**잡는다**
- 태그 중첩 오류 — `html.parser` 스택으로 검사한다. 절을 나눈 직후 반드시 돌린다.
  오류는 `</section> 앞에 닫히지 않은 태그 <div>(N행)`처럼 **줄 번호를 짚어 준다.**
- `text-sm` 이하 클래스와 임의 크기(`text-[11px]` 등)
- `<table>`이 `overflow-x-auto` 래퍼 안에 있는지

**못 잡는다 — 브라우저 375px 실측이 필요하다**
- 섹션이 6화면을 넘는지
- 페이지 가로 넘침(`table-prose`를 flex 자식에 넣고 `min-w-0`을 빠뜨린 경우)
- `<sup>`/`<sub>`가 만드는 12~13.5px — 소스에 `text-sm`이 없어 통과한다

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

## 규칙은 `CLAUDE.md`에 있다

이 도구들은 규칙을 **기계적으로 확인해 주는 것**일 뿐이다.
무엇을 지켜야 하는지는 [`CLAUDE.md`](../CLAUDE.md),
왜 그런 규칙이 생겼는지는 [`docs/강의노트-작성-사례집.md`](../docs/강의노트-작성-사례집.md)에 있다.
