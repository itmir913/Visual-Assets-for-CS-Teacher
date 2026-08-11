#!/usr/bin/env python3
"""런타임에 조립되는 Tailwind 클래스를 찾는다.

배포본은 Tailwind CLI가 파일을 텍스트로 훑어 **리터럴로 존재하는 클래스만** 구워서 만든다.
그래서 아래처럼 클래스 이름을 코드로 조립하면 CSS에 그 클래스가 담기지 않는다.

    <div class="bg-${lang.color}-50">        <!-- bg-yellow-50 이 CSS에 없다 -->
    el.className = 'text-' + tone + '-600';

CDN을 쓰던 시절에는 런타임 JIT라 소스를 열면 멀쩡히 보였다 — **눈으로는 안 잡힌다.**
실제로 `프로그래밍(Python)/1-1-2`에서 8개 중 3개가 빠진 채로 오래 남아 있었다.

고치는 법 — 완성된 클래스 문자열을 데이터에 리터럴로 넣는다.

    iconClass: 'bg-yellow-50 text-yellow-600',      // 리터럴이므로 CLI가 찾는다
    <div class="${lang.iconClass}">

사용:
    python tools/check_dynamic_classes.py                 # 저장소 전체
    python tools/check_dynamic_classes.py "정보*/*.html"   # 글롭도 된다

위반이 있으면 종료 코드 1.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 값이 있는 Tailwind 유틸리티 접두사. 조립되면 CSS에서 빠지는 것들이다.
PREFIX = (
    r"(?:bg|text|border|outline|ring|divide|from|via|to|fill|stroke|shadow|opacity"
    r"|w|h|min-w|min-h|max-w|max-h|size|basis"
    r"|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y"
    r"|grid-cols|grid-rows|col-span|row-span|order|z|leading|tracking|rounded"
    r"|translate-x|translate-y|rotate|scale|duration|delay)"
)

RULES = [
    # class="bg-${x}-50"  /  `text-${tone}-600`
    (re.compile(r"\b" + PREFIX + r"-(?:[a-z0-9-]*-)?\$\{"), "템플릿 리터럴로 조립"),
    # 'bg-' + x   /   "text-" + tone
    (re.compile(r"""['"`]""" + PREFIX + r"""-(?:[a-z0-9-]*-)?['"`]\s*\+"""), "문자열 결합으로 조립"),
]

SKIP_DIRS = {"dist", "node_modules", ".git", ".venv", ".idea"}


def iter_html(patterns: list[str]):
    if patterns:
        for pat in patterns:
            base = Path(pat)
            matched = sorted(base.parent.glob(base.name)) if base.parent.parts else sorted(ROOT.glob(pat))
            yield from (p for p in matched if p.suffix.lower() == ".html")
        return
    for p in sorted(ROOT.rglob("*.html")):
        rel = p.relative_to(ROOT)
        if any(part in SKIP_DIRS or part.startswith(("dist", ".tmp")) for part in rel.parts):
            continue
        yield p


def main() -> int:
    files = list(iter_html(sys.argv[1:]))
    if not files:
        print("검사할 파일이 없다.")
        return 1

    violations = 0
    for path in files:
        text = path.read_text(encoding="utf-8")
        for regex, label in RULES:
            for m in regex.finditer(text):
                line = text.count("\n", 0, m.start()) + 1
                snippet = re.sub(r"\s+", " ", text[max(0, m.start() - 40): m.end() + 30]).strip()
                try:
                    shown = path.relative_to(ROOT)
                except ValueError:
                    shown = path
                print(f"[런타임 조립] 위반 — {shown}:{line} ({label})")
                print(f"    …{snippet}…")
                violations += 1

    print(f"--- {len(files)}개 파일: 위반 {violations}건 ---")
    if violations:
        print("완성된 클래스 문자열을 리터럴로 넣도록 고칠 것. 자세한 설명은 이 파일 상단 주석에 있다.")
    return 1 if violations else 0


if __name__ == "__main__":
    sys.exit(main())
