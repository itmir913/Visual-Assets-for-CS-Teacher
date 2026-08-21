#!/usr/bin/env python3
"""검사 스크립트가 함께 쓰는 로거. **출력 모양을 정하는 유일한 곳이다.**

표준 `logging`을 그대로 쓴다. 직접 짠 출력 함수를 두지 않는다 —
수준(level)이라는 개념을 이미 가진 물건을 다시 만들 이유가 없다.

    ERROR check_html: 프로그래밍/py/01-….html:232 제목이 어긋난다
    WARN  check_html: 데이터과학/2-1-1.….html:88 SVG 글자 14px — 확인 필요
    INFO  check_html: 완료 — 파일 125, 위반 0, 경고 0

수준을 이렇게 나눈다. **무엇을 어느 수준에 넣을지가 이 파일의 전부다.**

| 수준 | 무엇 | 기본 |
|---|---|---|
| `ERROR` | 위반. 종료 코드를 1로 만드는 것 | always |
| `WARN` | 확인 필요. 사람이 판정할 것 | always |
| `INFO` | 검사 끝맺음 한 줄 | always |
| `DEBUG` | 파일별 `OK` 같은 「문제없음」의 반복 | `-v`일 때만 |

**파일을 짚어 부르면 `-v` 없이도 `DEBUG`가 켜진다.** 한 파일을 보려고 부른 사람은
그 파일이 각 항목을 통과했는지를 보고 싶은 것이지 침묵을 원한 것이 아니다.
반대로 저장소 전체를 도는 CI에서는 그 반복이 초록불 1,500줄을 만든다.

이모지를 쓰지 않는다. 로그는 사람이 읽는 만큼 `grep`으로도 읽힌다.
"""
from __future__ import annotations

import logging
import sys

# 기본 이름은 WARNING(7자)이라 한 칸에 맞지 않는다. 폭을 5로 맞춘다.
logging.addLevelName(logging.WARNING, "WARN")

FORMAT = "%(levelname)-5s %(name)s: %(message)s"


def get_logger(name: str, verbose: bool = False) -> logging.Logger:
    """`name`으로 로거를 만든다. 두 번 불러도 처리기가 겹치지 않는다."""
    log = logging.getLogger(name)
    log.setLevel(logging.DEBUG if verbose else logging.INFO)
    if not log.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(logging.Formatter(FORMAT))
        log.addHandler(h)
    log.propagate = False
    return log
