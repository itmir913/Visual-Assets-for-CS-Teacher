#!/usr/bin/env python3
"""본문에 실제로 쓰인 **용언 표제어**를 빈도순으로 뽑는다 — 어휘 감사의 입력.

    npm run audit -- lemma                      저장소의 강의노트 전부
    npm run audit -- lemma "정보(고등학교)/*.html"   짚은 것만
    npm run audit -- lemma --all             「하다·되다」가 붙은 것까지

**`ci`에 넣지 않는다.** 이 스크립트는 판정하지 않고 **찾아 놓기만 한다** —
어떤 낱말을 갈아 끼울지는 사람이 정한다. `audit -- narrow`·`audit -- josa`와 같은 자리다.

## 왜 있는가 — 「목록에 없는 말은 못 본다」를 뒤집는다

`check_verbs.py`와 `check_html.py`의 금지어는 **닫힌 목록**이다. 「견주다」를
찾으려면 이미 「견주다」를 알고 있어야 하고, **모르는 말은 영영 못 본다.**
그래서 감사 때마다 「이번에는 무엇을 놓쳤을까」가 남았다.

여기서는 방향을 뒤집는다. **본문을 읽는 대신 본문이 쓴 «어휘»를 읽는다.**
강의노트 한 과목의 한글 어절이 3만 꼴이어도 용언 표제어는 수백 개다 —
사람이(또는 모델이) **한 화면에서 전수로 판정할 수 있는 크기**가 된다.

실제로 이 도구를 처음 돌렸을 때 「재다」 일곱 곳이 나왔다. 금지어 목록에
있는데도 정규식에 `재던`·`재라`가 없어 새어 나가던 자리였다.

## 왜 형태소 분석기가 필요한가

**한국어 동사는 활용해서 `grep`으로 못 잡는다.** 어미가 어간의 마지막 음절과
한 글자로 합쳐지기 때문이다 — `펴` + `었` → **폈**, `견주` + `어` → **견줘**.
어간 접두로 찾으면 새어 나가고, 넓게 찾으면 명사가 딸려 온다.

분석기는 어간과 어미를 갈라 준다. 그래서 **표제어로 세고, 어미는 그대로 떼어
두었다가 갈아 끼울 때 도로 붙일 수 있다** — 「견주/VV + 어/EC」의 어간만
「비교하」로 바꾸면 「비교하여」가 나온다.

`kiwipiepy`가 없으면 어떻게 넣는지 알려 주고 멈춘다. **`ci`가 부르지 않으므로
CI 는 이 의존성을 몰라도 된다** — 넣는 것은 감사를 도는 사람뿐이다.
"""
from __future__ import annotations

import argparse
import glob
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_prose import extract  # noqa: E402
from logs import get_logger  # noqa: E402
from subjects import SUBJECTS  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
log = get_logger("audit_lemma")

# 용언. VV 동사 · VA 형용사와 그 불규칙 갈래. 보조용언(VX)과 지정사(VCP/VCN)는 뺀다 —
# 「~고 있다」의 「있」까지 세면 표가 조사로 뒤덮인다.
VERB_TAGS = {"VV", "VA", "VV-I", "VA-I", "VV-R", "VA-R"}

# 「하·되·시키」로 끝나는 표제어는 이미 한자어 + 접사다. 찾는 것은 그 반대쪽이다.
SINO = re.compile(r"(하|되|시키|당하)$")

HANGUL = re.compile(r"^[가-힣]+$")


def targets(patterns: list[str]) -> list[Path]:
    """인자가 없으면 subjects.json 이 아는 과목 폴더를 전부 돈다."""
    if patterns:
        out: list[Path] = []
        for pat in patterns:
            hit = sorted(Path(p) for p in glob.glob(pat, recursive=True))
            if not hit and Path(pat).exists():
                hit = [Path(pat)]
            if not hit:
                log.error("일치하는 파일 없음: %s", pat)
            out += hit
        return out
    out = []
    for subject in SUBJECTS:
        out += sorted((ROOT / subject["dir"]).rglob("*.html"))
    return out


def main() -> int:
    ap = argparse.ArgumentParser(description="본문의 용언 표제어를 빈도순으로 뽑는다.")
    ap.add_argument("paths", nargs="*", help="HTML 파일 또는 글롭 (없으면 과목 전부)")
    ap.add_argument("--all", action="store_true", help="「하다·되다」가 붙은 표제어까지 센다")
    ap.add_argument("--json", metavar="파일", help="보기 문맥까지 JSON 으로 쓴다")
    ap.add_argument("--min", type=int, default=1, help="이 횟수 미만은 적지 않는다")
    args = ap.parse_args()

    try:
        from kiwipiepy import Kiwi
    except ImportError:
        log.error("형태소 분석기가 없다. `pip install kiwipiepy` 로 넣는다.")
        log.error("이 도구는 `ci` 가 부르지 않으므로 CI 에는 넣지 않아도 된다.")
        return 2

    files = targets(args.paths)
    if not files:
        log.error("대상 파일이 없다.")
        return 2

    kiwi = Kiwi()
    freq: Counter[str] = Counter()
    보기: defaultdict[str, list[tuple[str, str]]] = defaultdict(list)

    for path in files:
        text, _ = extract(str(path))
        이름 = path.name
        for line in text.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            for tok in kiwi.tokenize(line):
                if tok.tag not in VERB_TAGS or not HANGUL.match(tok.form):
                    continue
                if not args.all and SINO.search(tok.form):
                    continue
                freq[tok.form] += 1
                if len(보기[tok.form]) < 3 and len(line) < 140:
                    보기[tok.form].append((이름, line))

    log.info("파일 %d개 · 용언 표제어 %d개", len(files), len(freq))
    for 표제어, n in sorted(freq.items(), key=lambda x: (-x[1], x[0])):
        if n < args.min:
            continue
        어디, 글 = 보기[표제어][0] if 보기[표제어] else ("", "")
        log.info("  %5d  %-6s  %s :: %s", n, 표제어, 어디[:34], 글[:70])

    if args.json:
        Path(args.json).write_text(json.dumps(
            [{"lemma": w, "n": n, "ex": 보기[w]} for w, n in freq.most_common()],
            ensure_ascii=False, indent=1), encoding="utf-8")
        log.info("→ %s 에 썼다.", args.json)

    log.info("판정은 사람이 한다 — 갈아 끼우기로 한 말은 "
             "check_verbs.py 나 check_html.py 의 목록에 넣어 기계가 지키게 한다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
