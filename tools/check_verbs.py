#!/usr/bin/env python3
"""동작의 이름이 한자어인가 — **저장소 전체를 돈다.**

    python tools/check_verbs.py            # 저장소 전부 (CI가 쓰는 방식)
    python tools/check_verbs.py <파일>…    # 짚은 파일만
    python tools/check_verbs.py --report   # 빼 둔 자리까지 세기만 (종료 코드 0)

위반이 하나라도 있으면 종료 코드 1. 규칙은 CLAUDE.md 「동작의 이름은 한자어로 쓴다」에
있고, **이 파일은 그 규칙의 목록을 든다** — 사람이 판단할 자리가 아니라 조회할 자리다.

## 무엇을 보는가 — 「누르는 것의 글자」

**문장의 일반 동사는 안 본다.** 「값을 고릅니다」·「자료를 나눕니다」는 그냥 동사이고,
거기까지 가면 번역투가 된다. 보는 것은 **학생이 누르는 것의 이름**이다.

    HTML  <button> · <option> · <summary> 안의 글자, title= · aria-label= 값
    JS    innerHTML · textContent · label · name · title 이 있는 줄의 문자열

**퀴즈 선택지는 뺀다.** `checkAnswer(`를 부르는 버튼은 누르는 것이지만 그 글자는
조작의 이름이 아니라 **문제의 답**이다. 이름 규칙을 문장에 들이대는 자리가 된다.

**「-기」로 끝나는 꼴만 찾으면 될 것 같지만 안 된다.** 그 「-기」는 이름을 만드는 씨이자
어미이기도 해서, 「바꾸기 **때문에**」·「옮기기 **어렵다**」·「담기**지 않는다**」가 통째로
걸린다(저장소에서 670곳이 걸렸고 그 대부분이 이것이었다). **자리로 좁히고 낱말로 찾는다.**

## 예외 — 어디에 있든 막는 것

**어색한 순우리말 동사**는 이름이 아니라 문장에서도 막는다 → `RETIRED_ANYWHERE`.
「지도를 폈습니다」는 버튼 이름이 아니지만 모어 화자에게 매우 어색하게 들린다.

## 활용형

**한국어 동사는 활용해서 `grep`으로 못 잡는다.** 어미가 어간의 마지막 음절과 한 글자로
합쳐지기 때문이다 — `펴` + `었` → **폈**, `지우` + `었` → **지웠**. 그래서 어간 접두로
찾으면 새어 나간다. **줄을 세울 때 그 낱말의 `-ㄹ`/`-ㅂ` 꼴부터 적는다.**

**한자어와 겹치는 어간은 형태를 하나씩 적는다** — `담`은 「부담·담당」을, `재`는
「현재·존재·소재」를 잡는다. 넣기 전에 **지금 0건인지 확인한다.** 오탐이 한 번 나면
다음 사람이 목록 자체를 안 믿는다.

**못 보는 것 둘.** 목록에 없는 새 순우리말은 못 본다 — 허용 목록이 닫혀 있다는 것은
사람만 안다. 그리고 **줄바꿈에 쪼개진 낱말**도 못 본다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

SUFFIXES = {".html", ".js", ".mjs", ".py", ".css", ".md"}

# 저장소 것이 아니거나 사람이 쓴 글이 아닌 자리.
SKIP_DIRS = {"node_modules", "dist", ".git", ".idea", "public", ".github"}

# **아직 손질하지 않아 검사에서 빼 두는 자리.** 비어 있는 것이 목표다.
# 강의노트 셋이 노드 확장을 「펼친다」라는 이름으로 단원 전체에서 쓰고 있어, 고치는 것이
# 곧 그 단원의 용어 교체다. 강의노트는 파일 단위로 확인받고 넘어가는 것이라
# → CLAUDE.md 「커밋 규칙」, 여기 담아 두고 함께 뺀다.
# `--report`로 부르면 이 목록까지 세어 준다. **뺄 때는 이 줄도 함께 지운다.**
PENDING = [
    "인공지능기초",
    "정보(고등학교)",
    "프로그래밍",
]

# 그 줄에 이 표시가 있으면 넘어간다. **규칙을 설명하려면 막은 말을 적어야 한다.**
SKIP_LINE = "verbs: 예시"


# ── 닫힌 허용 목록 ───────────────────────────────────────────────────────────
# **동작의 이름으로 쓸 수 있는 순우리말은 이것이 전부다.** 여기 없으면 한자어를 찾는다.
# 줄마다 **왜 남는지**를 적는다 — 까닭이 없는 줄은 다음 사람이 판단으로 늘린 것이다.
ALLOWED = {
    "열기": "윈도와 한글의 파일 메뉴",
    "닫기": "같은 메뉴",
    "불러오기": "같은 메뉴. 저장한 것을 도로 여는 자리",
    "내보내기": "같은 메뉴",
    "가져오기": "한글·엑셀의 Import",
    "만들기": "「새로 만들기」",
    "되돌리기": "실행 취소",
    "미리보기": "인쇄 미리 보기",
    "끌어다 놓기": "파일을 끌어 옮기는 동작의 이름",
    "멈추기": "재생 중단. 영어도 Stop이고 「중지」보다 교실에서 읽힌다",
    "지우개": "그림 도구의 이름. 그림판·한글이 그렇게 부른다. 「삭제 도구」가 아니다",
    "더하기": "산수 연산의 이름. 「빼기·곱하기·나누기」와 한 짝이다",
    "빼기": "산수 연산의 이름 — 위 「더하기」의 짝일 때만. 자료구조 연산은 「삭제」다",
    "곱하기": "산수 연산의 이름",
    "나누기": "산수 연산의 이름 — 「곱하기」의 짝일 때만. 자료를 가르는 것은 「분할」이다",
}


# ── 물러난 이름 ──────────────────────────────────────────────────────────────
# (활용형 정규식, 쓸 말, 까닭). **누르는 것의 글자에서만 본다.**
# 앞선 저장소(ml-playgrounds)가 화면 문구를 전수 교체하며 세운 목록을 옮겨 왔다.
RETIRED_NAMES = [
    (r"지우[기고는며]|지웁|지웠|지울|지워", "삭제", "자료가 실제로 없어진다"),
    (r"비우[기고는]|비웁|비웠", "전체 삭제", "영어가 Clear이고 실제로 지운다"),
    (r"떼[기고는]|뗀 |뗐", "해제", "설정이나 지정을 푼다"),
    (r"고르[기고는]|고릅|골라|골랐", "선택", ""),
    (r"뽑[기고는아았을]|뽑습", "추출", ""),
    (r"담기|담고|담는|담습|담았|담은 |담을 ", "추가", ""),
    (r"채우[기고는]|채웁|채웠|채워", "대체", ""),
    (r"매기[기고는]|매긴 |매길 |매겼", "평가", ""),
    (r"다듬[기고는어]", "정제 · 조정", ""),
    (r"내려받[기고는아]|내려받습", "다운로드", "브라우저가 부르는 말이다"),
    (r"고치[기고는]|고칩|고쳐", "수정 · 편집", "문서를 통째로 손보는 자리면 「편집」"),
    (r"옮기[기고는]|옮깁|옮겼|옮겨", "이동", ""),
    (r"들어가기", "열기", "닫힌 허용 목록에 이미 「열기」가 있다"),
    (r"바꾸[기고는]|바꿉|바꿨|바꿔", "변경 · 교체 · 조정",
     "이름은 변경, 밀어내고 넣으면 교체, 값을 옮기면 조정"),
    (r"마치기", "완료", ""),
    (r"꾸러미", "압축 파일", "지어낸 말이다"),
]

# ── 어디에 있든 막는 것 ──────────────────────────────────────────────────────
# 이름이 아니라 **문장에서도** 막는다. 모어 화자에게 어색하게 들리는 동사다.
#   펴다   — 펴고 · 펴서 · 펴는 · 펴야 · 펴 · 폈다 · 폈습니다 · 폅니다 · 펼 (수)
#   펼치다 — 펼치고 · 펼쳐 · 펼쳤다 · 펼친 · 펼칠 · 펼침 · 펼칩니다
#   (「피다」의 과거도 `폈`이라 같은 그물에 걸린다. 그 뜻으로 쓰는 자리가 없다.)
RETIRED_ANYWHERE = [
    (r"(?<![가-힣])("
     r"폈[다습어으지는던을고]"
     r"|폅니다"
     r"|펴[고서는며야지도]"
     r"|펴(?=[\s.,)」』\"'])"
     r"|펼[치쳐친칠침칩]"
     r"|펼(?=\s)"
     r")", "전개하다 · 확장하다 · 생성하다", "모어 화자에게 매우 어색하게 들린다"),
]

NAME_RULES = [(re.compile(p), 쓸말, 까닭) for p, 쓸말, 까닭 in RETIRED_NAMES]
ANY_RULES = [(re.compile(p), 쓸말, 까닭) for p, 쓸말, 까닭 in RETIRED_ANYWHERE]


# ── 「누르는 것의 글자」를 뽑아낸다 ───────────────────────────────────────────
CONTROL = re.compile(r"<(button|option|summary)\b([^>]*)>(.*?)</\1>", re.S)
QUIZ = re.compile(r"checkAnswer\s*\(")

# **`title`·`aria-label`은 누르는 것에 붙었을 때만 이름이다.** 그림(`<svg role="img">`)에
# 붙은 같은 속성은 **도해를 소리로 읽어 주는 글**이라 문장이다 — 거기까지 이름 규칙을
# 들이대면 「상자 다섯이 이어진다. 문제 모으기, 고르기, …」가 통째로 걸린다.
CONTROL_ATTR = re.compile(r"<(?:button|a|input|select|summary|label|option)\b([^>]*)>", re.S)
ATTR_VALUE = re.compile(r"""\b(?:title|aria-label)\s*=\s*(['"])(.*?)\1""", re.S)

# **JS 에서는 그 «값»만 집는다.** 줄에 `title:`이 있다고 그 줄의 문자열을 다 집으면,
# `{title: '…', body: '설명 문장'}`의 설명까지 이름으로 읽힌다.
JS_LABEL = re.compile(
    r"""(?:innerHTML|textContent)\s*=\s*(['"`])((?:\\.|(?!\1)[^\n])*?)\1"""
    r"""|(?:\blabel|\bname|\btitle)\s*:\s*(['"`])((?:\\.|(?!\3)[^\n])*?)\3""")

TAG = re.compile(r"<[^>]+>")


def _line_of(src: str, pos: int) -> int:
    return src.count("\n", 0, pos) + 1


def names_in(src: str):
    """(줄, 이름) — 누르는 것의 글자만. 마크업과 아이콘은 걷어낸 알맹이를 준다."""
    for m in CONTROL.finditer(src):
        # 퀴즈 선택지는 조작의 이름이 아니라 문제의 답이다.
        if QUIZ.search(m.group(2)):
            continue
        yield _line_of(src, m.start(3)), TAG.sub(" ", m.group(3))

    for tag in CONTROL_ATTR.finditer(src):
        if QUIZ.search(tag.group(1)):
            continue
        for m in ATTR_VALUE.finditer(tag.group(1)):
            yield _line_of(src, tag.start() + m.start(2)), m.group(2)

    for m in JS_LABEL.finditer(src):
        글자 = m.group(2) if m.group(2) is not None else m.group(4)
        if 글자 and re.search(r"[가-힣]", 글자):
            yield _line_of(src, m.start()), TAG.sub(" ", 글자)


def allowed_at(글자: str, at: int, 걸린말: str) -> bool:
    """그 자리가 닫힌 허용 목록의 말인가. **겹쳐 있으면 허용 쪽이 이긴다.**"""
    창 = 글자[max(0, at - 6):at + len(걸린말) + 6]
    return any(허용 in 창 for 허용 in ALLOWED)


def check(path: Path, log, level="error") -> int:
    # **이 파일은 자기 그물에 걸린다.** 목록을 여기 적어 두었기 때문이다.
    # 고치는 쪽을 잡으면 검사가 자기 발등을 찍는다 →
    # `check_sim_terms.py`가 `josa.js`를 빼 두는 것과 같은 까닭.
    if path.resolve() == Path(__file__).resolve():
        return 0

    src = path.read_text(encoding="utf-8")
    shown = path.relative_to(ROOT).as_posix()
    lines = src.splitlines()
    bad: list[tuple[int, str]] = []

    def 적는다(line: int, msg: str) -> None:
        if 0 < line <= len(lines) and SKIP_LINE in lines[line - 1]:
            return
        bad.append((line, msg))

    for line, 글자 in names_in(src):
        for pat, 쓸말, 까닭 in NAME_RULES:
            for m in pat.finditer(글자):
                if allowed_at(글자, m.start(), m.group(0)):
                    continue
                꼬리 = f" — {까닭}" if 까닭 else ""
                적는다(line, f"동작의 이름 「{m.group(0)}」 — 「{쓸말}」로 쓴다{꼬리}"
                             f" :: {' '.join(글자.split())[:40]}")

    for pat, 쓸말, 까닭 in ANY_RULES:
        for m in pat.finditer(src):
            적는다(_line_of(src, m.start()),
                  f"「{m.group(0)}」 — 「{쓸말}」로 쓴다 — {까닭}")

    for line, msg in sorted(bad):
        getattr(log, level)("%s:%d %s", shown, line, msg)
    if not bad:
        log.debug("%s OK", shown)
    return len(bad)


def under(path: Path, dirs: list[str]) -> bool:
    rel = path.resolve().relative_to(ROOT).as_posix()
    return any(rel == d or rel.startswith(d + "/") for d in dirs)


def scope(include_pending: bool = False) -> list[Path]:
    out = []
    for p in sorted(ROOT.rglob("*")):
        if not p.is_file() or p.suffix not in SUFFIXES:
            continue
        if any(part in SKIP_DIRS for part in p.relative_to(ROOT).parts):
            continue
        if not include_pending and under(p, PENDING):
            continue
        out.append(p)
    return out


def main() -> int:
    argv = sys.argv[1:]
    report = "--report" in argv
    args = [a for a in argv if a not in ("-v", "--verbose", "--report")]
    log = get_logger("check_verbs", len(args) != len(argv) - report or bool(args))

    files = [Path(a).resolve() for a in args] if args else scope(include_pending=report)
    if not files:
        log.error("검사할 파일이 없다")
        return 2

    total = sum(check(f, log, "warning" if report else "error") for f in files)
    if report:
        log.info("훑어보기 — 파일 %d(빼 둔 자리까지), 걸린 것 %d", len(files), total)
        return 0
    log.info("완료 — 파일 %d, 위반 %d, 빼 둔 자리 %d", len(files), total, len(PENDING))
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
