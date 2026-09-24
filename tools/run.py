#!/usr/bin/env python3
"""검사와 감사를 부르는 **유일한 러너.** 목록은 이 파일에만 있다.

    npm run check                         모든 검사(산출물 검사 `dist` 는 뺀다)
    npm run check -- prose html           이름을 준 것만
    npm run check -- html 정보/1-1.….html  이름 뒤의 낱말은 그 검사에 넘긴다
    npm run check -- sim                  시뮬레이터 동작 검사 전부
    npm run check -- sim sort tree        그 가운데 이름을 준 것만
    npm run check -- dist                 산출물 검사. 빌드 뒤에만 뜻이 있다
    npm run audit -- lemma …              감사 도구 하나. 이름이 반드시 있어야 한다

`package.json` 에 검사마다 이름을 붙여 두었더니 이름이 서른을 넘었고, 새 검사를 만들면
`check` 줄에 잇는 것을 잊기 쉬웠다. 목록을 **여기 한 곳**에 두면 새 검사는 표에 한 줄을
더하는 것으로 끝나고 `npm run ci` 가 저절로 부른다.

검사 하나가 실패해도 **나머지를 다 돌고** 끝에 실패한 이름을 모아 보인다. 한 번 돌려서
고칠 것을 다 알아야 CI 를 한 번에 초록으로 되돌릴 수 있다.
"""
from __future__ import annotations

import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]

# 이름 → 부를 명령. 순서가 곧 도는 순서다 — 빠르고 넓게 걸리는 정적 검사를 앞에 둔다.
CHECKS: dict[str, list[str]] = {
    # 저장소 짜임
    "sim-index": ["tools/gen_simulator_index.py", "--check"],
    "index-links": ["tools/check_index_links.py"],
    "privacy": ["tools/check_privacy.py"],
    "classes": ["tools/check_dynamic_classes.py"],
    "code": ["tools/check_code.py"],
    # 글
    "html": ["tools/check_html.py"],
    "terms": ["tools/check_sim_terms.py"],
    "verbs": ["tools/check_verbs.py"],
    "prose": ["tools/check_prose.py"],
    # 시뮬레이터 동작 — 아래 SIMS 표를 차례로 돈다. 뒤에 SIMS 의 이름을 주면 그것만.
    "sim": [],
    # 산출물. 빌드가 있어야 하므로 기본 목록에서 빠지고 이름으로만 부른다.
    "dist": ["tools/check_dist.py", "dist"],
}

# 시뮬레이터 동작 검사. `check -- sim [이름…]` 으로만 부른다 — 이름이 서른 가까이라
# 최상위에 늘어놓으면 `sim` 과 `sims` 처럼 헷갈리는 이름이 생긴다(실제로 생겼다).
SIMS: dict[str, list[str]] = {
    # 모든 페이지 공통 — 뜨는가 · 캔버스 배율 · on* 핸들러가 가리키는 것이 있는가
    "pages": ["tools/check_sim_pages.mjs"],
    "fullscreen": ["tools/check_fullscreen.mjs"],
    # 페이지마다
    "graph": ["tools/check_graph_presets.mjs"],
    "graph-sim": ["tools/check_graph_sims.mjs"],
    "heuristic-tree": ["tools/check_heuristic_tree.mjs"],
    "puzzle": ["tools/check_puzzle_heuristic.mjs"],
    "sort": ["tools/check_sort.mjs"],
    "ds": ["tools/check_ds.mjs"],
    "tree": ["tools/check_tree.mjs"],
    "find": ["tools/check_find.mjs"],
    "compress": ["tools/check_compress.mjs"],
    "least-squares": ["tools/check_least_squares.mjs"],
    "deep-learning": ["tools/check_deep_learning.mjs"],
    "wumpus": ["tools/check_wumpus.mjs"],
    "nqueen": ["tools/check_nqueen.mjs"],
    "hanoi": ["tools/check_hanoi.mjs"],
    "river": ["tools/check_river.mjs"],
    "decision-tree": ["tools/check_decision_tree.mjs"],
    "knn": ["tools/check_knn.mjs"],
    "logistic": ["tools/check_logistic.mjs"],
    "svm": ["tools/check_svm.mjs"],
    "multiple-regression": ["tools/check_multiple_regression.mjs"],
    "gridworld": ["tools/check_gridworld.mjs"],
    "bandit": ["tools/check_bandit.mjs"],
    "kmeans": ["tools/check_kmeans.mjs"],
    "vision": ["tools/check_vision.mjs"],
}

# 이름으로만 부르는 검사. `npm run ci` 가 빌드 뒤에 따로 부른다.
BY_NAME_ONLY = {"dist"}

# 감사 도구 — 판정이 아니라 사람이 읽을 목록을 내놓는다. `ci` 에 넣지 않는다.
AUDITS: dict[str, list[str]] = {
    "pre": ["tools/audit_pre.py"],
    "svg": ["tools/audit_svg_maxwidth.py"],
    "narrow": ["tools/audit_narrow.py"],
    "josa": ["tools/audit_josa.py"],
    "lemma": ["tools/audit_lemma.py"],
}


def command(cmd: list[str], extra: list[str]) -> list[str]:
    runner = "node" if cmd[0].endswith((".mjs", ".js")) else sys.executable
    return [runner, *cmd, *extra]


def parse(argv: list[str], table: dict[str, list[str]]) -> list[tuple[str, list[str]]]:
    """`이름 인자… 이름 인자…` 를 `[(이름, [인자…]), …]` 로 가른다."""
    picked: list[tuple[str, list[str]]] = []
    for a in argv:
        if picked and picked[-1][0] == "sim" and a in SIMS:
            picked[-1][1].append(a)
        elif a in table:
            picked.append((a, []))
        elif picked:
            picked[-1][1].append(a)
        else:
            raise SystemExit(f"run: 모르는 이름 {a!r} — 있는 이름: {', '.join(table)}")
    return picked


def run(kind: str, argv: list[str]) -> int:
    table = CHECKS if kind == "check" else AUDITS
    picked = parse(argv, table)
    if not picked:
        if kind == "audit":
            raise SystemExit(f"run: 감사 이름을 주어야 한다 — {', '.join(AUDITS)}")
        picked = [(n, []) for n in CHECKS if n not in BY_NAME_ONLY]

    # `sim [이름…]` 을 SIMS 의 검사들로 풀어 놓는다.
    flat: list[tuple[str, list[str], list[str]]] = []
    for name, extra in picked:
        if name == "sim":
            for n in (extra or list(SIMS)):
                if n not in SIMS:
                    raise SystemExit(f"run: 모르는 시뮬레이터 검사 {n!r} — 있는 이름: {', '.join(SIMS)}")
                flat.append((f"sim {n}", SIMS[n], []))
        else:
            flat.append((name, table[name], extra))

    failed: list[str] = []
    for name, cmd, extra in flat:
        print(f"==> {kind} {name}", flush=True)
        t = time.monotonic()
        code = subprocess.run(command(cmd, extra), cwd=REPO_ROOT).returncode
        if code:
            failed.append(name)
            print(f"<== {kind} {name} 실패 (종료 코드 {code}, {time.monotonic() - t:.1f}s)", flush=True)

    if len(flat) > 1:
        print(f"\n{kind}: {len(flat) - len(failed)}/{len(flat)} 통과", flush=True)
    if failed:
        print(f"{kind}: 실패 — {' '.join(failed)}", flush=True)
        return 1
    return 0


def main() -> int:
    if len(sys.argv) < 2 or sys.argv[1] not in ("check", "audit"):
        raise SystemExit("run: 쓰는 법 — run.py check|audit [이름 [인자…]]…")
    return run(sys.argv[1], sys.argv[2:])


if __name__ == "__main__":
    sys.exit(main())
