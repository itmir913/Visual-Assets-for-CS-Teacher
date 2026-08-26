#!/usr/bin/env python3
"""시뮬레이터가 쓰는 말이 교과 용어인가 — **HTML만이 아니라 JS까지 본다.**

    python tools/check_sim_terms.py            # 시뮬레이터 전부 (CI가 쓰는 방식)
    python tools/check_sim_terms.py <파일>…    # 짚은 파일만

위반이 하나라도 있으면 종료 코드 1.

**왜 따로 있는가.** `check_html.py`의 금지어 검사는 HTML만 읽는다. 그런데
시뮬레이터의 글은 거의 전부 JS 안에 있다 — 화면에 찍히는 문장, 버튼 이름,
비용표의 칸까지 `*-registry.js`와 `*-ops.js`가 들고 있다. 그래서 「견주다」를
HTML에서 다 걷어 내고도 시뮬레이터에서는 그대로 살아 있었다.

**검사 범위는 손으로 적지 않는다.** `src/entries/simulator/`의 진입점에서
`import`를 따라가 실제로 그 페이지에 실리는 모듈만 본다. 새 시뮬레이터를
만들면 저절로 딸려 오고, 안 쓰는 모듈은 저절로 빠진다.

**주석도 본다.** 주석에 남아 있으면 다음 사람이 그 말을 따라 쓴다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from check_html import BANNED_WORDS  # noqa: E402
from logs import get_logger  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent

# 진입점이 있는 자리. 여기 아래 `.js`가 곧 「시뮬레이터 한 장」이다.
ENTRY_DIR = ROOT / "src" / "entries" / "simulator"

# 함께 보는 페이지. 진입점 이름과 같은 이름의 HTML이 이 아래에 있다.
PAGE_DIR = ROOT / "simulator"

# 아직 손질하지 않아 검사에서 빼 두는 폴더. **비어 있는 것이 정상이다.**
# simulator/ai는 2026-08-26 감사의 범위 밖이었다가 2026-08-27에 손질해 목록이 비었다.
# 여기에 폴더를 적는 것은 손질을 미루겠다는 뜻이므로, 적을 때는 언제 뺄지도 함께 적는다.
PENDING: list[str] = []

# **여러 줄에 걸친 import를 놓치지 않는다.** `import {\n  a, b,\n} from '…'`이 흔한데,
# 줄바꿈을 막아 두었더니 그렇게 적힌 모듈이 통째로 검사에서 빠졌다 —
# 일부러 심어 본 위반이 안 잡혀서 드러났다.
IMPORT = re.compile(r"""(?:^|\n)\s*(?:import|export)\b[^;]*?from\s*['"]([^'"]+)['"]|"""
                    r"""(?:^|\n)\s*import\s*['"]([^'"]+)['"]""")


# ── 용어표 ───────────────────────────────────────────────────────────────────
# (찾는 것, 쓴 말, 쓸 말). **기준은 「틀린 말인가」가 아니라 「고등학교 정보 교과서와
# 수업에서 그 말을 쓰는가」다.** 옮겨 적은 티가 나는 말과, 순우리말로 풀어 쓰다가
# 교과 용어와 이름이 어긋나 버린 말을 잡는다.
#
# **「값」이 두 가지를 뜻하던 것이 가장 컸다** — 자료의 값과 연산의 비용을 같은
# 낱말로 적고 있었다. 학생은 「넣고 꺼내는 값이 싸다」를 읽고 그 「값」을 자료의
# 값으로 읽는다. 비용은 「비용」으로만 적는다.
SIM_TERMS = [
    # 자료구조
    (r"마디", "마디", "노드"),
    (r"나무", "나무", "트리"),
    (r"(?<![가-힣])잎(?![가-힣])", "잎", "단말 노드"),
    (r"뿌리", "뿌리", "루트"),
    (r"머리 포인터", "머리 포인터", "head 포인터"),
    (r"꼬리 포인터", "꼬리 포인터", "tail 포인터"),
    (r"꼭대기", "꼭대기", "맨 위"),
    (r"자리 번호", "자리 번호", "인덱스"),

    # 비용
    (r"드는 값", "드는 값", "비용"),
    (r"값이 싸|값이 비싸|비쌉니다|싸집니다|값을 치르", "값이 싸다·비싸다", "비용이 작다·크다"),

    # 동작
    (r"훑", "훑다", "순차 탐색하다 · 순회하다"),
    # 앞에 한글이 붙으면 「절대 볼 수 없다」처럼 다른 말이다. 앞을 끊어 준다.
    (r"(?<![가-힣])대 (보|본|볼|봅|봤|봄)", "대 보다", "비교하다 · 대조하다"),
    (r"매달", "매달다", "연결하다"),
    (r"떼어 ?내", "떼어 내다", "제거하다"),
    (r"번호로 짚|바로 짚", "짚다", "접근하다"),

    # 화면·설명
    (r"단추", "단추", "버튼"),
    # 앞에 한글이 붙으면 다른 말이다 — 「아무리」·「마무리」. 앞을 끊어 준다.
    (r"(?<![가-힣])무리", "무리", "분류 · 그룹"),
    (r"노릇", "노릇", "역할"),
    (r"뒤엣것", "뒤엣것", "뒤에 있는 원소"),
    (r"차례가|차례를|차례는|차례도", "차례", "순서"),
    # **「판」은 이 저장소에서 두 가지다** — 한 회차라는 뜻과, 퍼즐·체스의 «판»이다.
    # 뒤에 붙어 다른 낱말이 되는 것(판별·판단·판정)도 함께 걸러 낸다.
    (r"(?<![가-힣])(?:한|앞|이|그) 판(?!별|단|정|사|례|독|매)|판마다|판이 끝", "판", "회차"),
]

# 값이 들어갈 자리에 조사를 손으로 적은 흔적. HTML은 check_html이 보지만
# 시뮬레이터의 문장은 거의 JS 안에 있어 그쪽에서는 걸리지 않았다.
JOSA = re.compile(r"(?<!_)(이\(가\)|가\(이\)|은\(는\)|는\(은\)|"
                  r"을\(를\)|를\(을\)|과\(와\)|와\(과\)|\(으\)로)")


def _line_of(src: str, pos: int) -> int:
    return src[:pos].count("\n") + 1


def under(path: Path, dirs) -> bool:
    try:
        rel = path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return False
    return any(rel == d or rel.startswith(d.rstrip("/") + "/") for d in dirs)


def reachable(entry: Path) -> set[Path]:
    """진입점에서 import를 따라가 실제로 실리는 모듈 전부."""
    seen: set[Path] = set()
    stack = [entry]
    while stack:
        cur = stack.pop()
        if cur in seen or not cur.exists():
            continue
        seen.add(cur)
        src = cur.read_text(encoding="utf-8")
        for m in IMPORT.finditer(src):
            spec = m.group(1) or m.group(2)
            if not spec.startswith("."):
                continue          # npm 패키지는 우리 글이 아니다
            stack.append((cur.parent / spec).resolve())
    return seen


def scope() -> list[Path]:
    """검사할 파일 — 진입점에서 닿는 JS 전부 + 시뮬레이터 HTML 전부."""
    out: set[Path] = set()
    for entry in sorted(ENTRY_DIR.rglob("*.js")):
        if under(entry, PENDING):
            continue
        out |= reachable(entry)
    for page in sorted(PAGE_DIR.rglob("*.html")):
        if not under(page, PENDING):
            out.add(page.resolve())
    return sorted(out)


def check(path: Path, log) -> int:
    src = path.read_text(encoding="utf-8")
    shown = path.relative_to(ROOT).as_posix()
    bad: list[tuple[int, str]] = []

    for pattern, 쓴말, 쓸말 in list(BANNED_WORDS) + SIM_TERMS:
        for m in re.finditer(pattern, src):
            bad.append((_line_of(src, m.start()),
                        f"「{쓴말}」 — 「{쓸말}」로 쓴다 :: {m.group(0)}"))

    # josa.js는 **이 결함을 고치는 모듈**이라, 어떤 꼴이 잘못인지를 주석에 적어 둔다.
    # 고치는 쪽을 잡으면 검사가 자기 발등을 찍는다.
    if path.name != "josa.js":
        for m in JOSA.finditer(src):
            bad.append((_line_of(src, m.start()),
                        f"「{m.group(0)}」 — 조사를 손으로 적지 않는다. "
                        f"josa()가 값을 보고 고른다"))

    for line, msg in sorted(bad):
        log.error("%s:%d %s", shown, line, msg)
    if not bad:
        log.debug("%s OK", shown)
    return len(bad)


def main() -> int:
    args = [a for a in sys.argv[1:] if a not in ("-v", "--verbose")]
    log = get_logger("check_sim_terms", len(args) != len(sys.argv[1:]) or bool(args))

    if args:
        files = [Path(a).resolve() for a in args]
    else:
        files = scope()
    if not files:
        log.error("검사할 파일이 없다")
        return 2

    total = sum(check(f, log) for f in files)
    log.info("완료 — 파일 %d, 위반 %d", len(files), total)
    return 1 if total else 0


if __name__ == "__main__":
    sys.exit(main())
