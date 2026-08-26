"""값이 들어갈 자리 뒤에 **손으로 적어 둔 조사**를 찾는다.

`이(가)`처럼 양쪽을 다 적은 것은 `check_html`이 잡는다 — 그것은 보자마자 결함이다.
**여기서 찾는 것은 한쪽만 적어 둔 것이다.** 「지도 5을」·「타일 2을」·「비용가 같은」처럼
값이 바뀌면 틀리는데, **값이 맞는 것으로 뽑히는 동안에는 화면에서 멀쩡해 보인다.**
그래서 눈으로도 검사로도 오래 살아남는다 — 실제로 다섯 자리가 그렇게 살아남았다.

**`ci`에 넣지 않는다. 사람이 봐야 판정이 갈리기 때문이다.**
`${왼쪽/오른쪽}이`처럼 나올 수 있는 값이 **모두 같은 받침**이면 그것은 맞는 코드다.
기계는 그 「나올 수 있는 값」을 모른다. 그러니 이 스크립트는 **찾아 놓기만 하고
판정은 사람에게 넘긴다** — `audit:narrow`를 `ci` 밖에 둔 것과 같은 까닭이다.

    npm run audit:josa            저장소 전체
    npm run audit:josa -- <파일>   그 파일만

고르는 일은 `src/entries/_lib/josa.js`가 한다.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
log = get_logger("audit_josa")

# 값이 끝나는 자리.
#
# **값이 «바뀌는» 자리만 본다.** 글쓴이가 낱말을 아는 자리에서 조사를 적는 것은
# 당연히 맞는 코드다 — 「<strong>원주율의 어림값</strong>을」에 잘못이 있을 수 없다.
# 그런 것까지 세었더니 6천 곳이 나와 볼 수가 없었다. 그래서 둘만 본다.
#
#   1. `${...}` 바로 뒤            — 값이 그 자리에 그대로 들어간다
#   2. `${...}`를 «품은» 강조 태그의 닫는 쪽 — `<b>${v}</b>은` 꼴.
#      이 저장소는 값을 굵게 두는 일이 잦아, 조사가 태그 밖으로 밀려 나 있다.
값끝 = r"(?:\$\{[^{}]{1,80}\}|<(?:b|strong|code)\b[^>]*>[^<]{0,80}\$\{[^{}]{1,80}\}[^<]{0,40}</(?:b|strong|code)>)"

# 뒤에 붙는 조사. **긴 것을 먼저 적는다** — 「으로」가 「로」보다 앞이라야 통째로 잡힌다.
조사 = r"(?:으로|이라고|라고|이라|은|는|이|가|을|를|과|와|로)"

# 조사가 낱말의 첫 글자가 아니라 «조사»이려면 뒤가 끊겨야 한다.
뒤 = r"(?=[\s.,!?)\]<」』\"'&]|$)"

PAT = re.compile(f"({값끝})({조사}){뒤}")

# 이미 모듈을 거친 자리는 뺀다. 「${josa(...)}」·「${withJosa(...)}」가 그것이다.
지나감 = re.compile(r"\$\{[^{}]*[jJ]osa\s*\(")

SUFFIX = (".html", ".js")
SKIP_DIRS = {"node_modules", "dist", ".git", "__pycache__", ".idea"}


def walk(base: Path) -> list[Path]:
    out = []
    for p in base.rglob("*"):
        if p.suffix not in SUFFIX or not p.is_file():
            continue
        if any(part in SKIP_DIRS for part in p.parts):
            continue
        out.append(p)
    return out


def targets(args: list[str]) -> list[Path]:
    """인자가 폴더면 그 아래를 훑는다.

    **폴더를 그냥 읽으려 들면 조용히 아무것도 안 한다.** 처음에 그렇게 만들어 두고
    「0곳」을 보고서 통과한 줄 알았다 — 안 본 것과 보고 없는 것이 같은 글자로 나왔다.
    """
    if not args:
        return sorted(walk(ROOT))
    out = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            out += walk(p)
        elif p.is_file():
            out.append(p)
        else:
            log.warning("없는 자리 — %s", a)
    return sorted(out)


def main() -> int:
    hits = 0
    files = 0
    for path in targets(sys.argv[1:]):
        try:
            src = path.read_text(encoding="utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        found = []
        for m in PAT.finditer(src):
            if 지나감.match(m.group(1)):
                continue
            line = src.count("\n", 0, m.start()) + 1
            # 그 줄을 그대로 보여 준다 — 앞말이 무엇인지 봐야 판정이 된다.
            start = src.rfind("\n", 0, m.start()) + 1
            end = src.find("\n", m.end())
            줄 = src[start:end if end > 0 else len(src)].strip()
            found.append((line, m.group(2), 줄[:150]))

        if found:
            files += 1
            hits += len(found)
            rel = path.relative_to(ROOT) if path.is_absolute() else path
            log.info("%s — %d곳", rel, len(found))
            for line, 조, 줄 in found:
                log.info("  %s:%d 「%s」 %s", rel, line, 조, 줄)

    log.info("완료 — 손으로 적은 듯한 조사 %d곳, 파일 %d개", hits, files)
    log.info("나올 수 있는 값이 모두 같은 받침이면 그대로 두어도 된다 — 판정은 사람이 한다")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
