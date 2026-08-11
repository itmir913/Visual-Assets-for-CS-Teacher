#!/usr/bin/env python3
"""강의노트 HTML에 소스 코드를 빌드 타임에 넣는다.

저장소에는 코드가 `.py`·`.c` 실파일로만 있고, HTML에는 어느 파일을 넣을지 가리키는
마커만 둔다. 빌드가 그 자리를 채운다.

    <pre><code class="language-python" data-src="code/변수.py"></code></pre>
    <pre><code class="language-c" data-src="code/변수.c#선언"></code></pre>

`#뒤`는 파일 안의 구역 이름이다. 없으면 파일 전체가 들어간다.

**런타임 fetch를 쓰지 않는 이유** — 오프라인 zip은 `file://`로 열리는데 거기서는
CORS가 fetch를 막는다. 빌드가 넣어 두면 웹이든 zip이든 똑같이 동작한다.

`data-src`가 없는 HTML은 그대로 통과시킨다. 그래서 기존 파일을 건드리지 않고
새 파일부터 하나씩 옮겨 갈 수 있다.

단독 실행:
    python .github/scripts/inject_code.py --self-test
"""
from __future__ import annotations

import argparse
import html as html_mod
import re
import sys
import textwrap
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# data-src를 가진 <code> 요소. 속성 순서는 자유롭게 둔다.
CODE_TAG_RE = re.compile(
    r'(<code\b[^>]*\bdata-src="([^"]+)"[^>]*>)(.*?)(</code>)',
    re.DOTALL,
)

# 확장자별 한 줄 주석 기호. 여기 없는 확장자는 주입 대상이 아니다.
COMMENT_PREFIX = {
    ".py": "#",
    ".c": "//", ".h": "//", ".java": "//", ".js": "//",
}


class InjectError(RuntimeError):
    """마커가 가리키는 것을 찾지 못했다. 빌드를 세운다."""


def comment_prefix(path: Path) -> str:
    try:
        return COMMENT_PREFIX[path.suffix.lower()]
    except KeyError:
        raise InjectError(
            f"주입할 수 없는 확장자: {path.suffix} ({path.name}). "
            f"가능: {', '.join(sorted(COMMENT_PREFIX))}"
        ) from None


def split_frontmatter(lines: list[str], pfx: str) -> tuple[list[str], dict[str, str]]:
    """주석 프론트매터를 떼어 내고 (본문, 지시자)로 돌려준다.

        # ---
        # check: none
        # ---

    `---`를 그냥 첫 줄에 쓰면 .c가 컴파일되지 않으므로 주석 안에 넣는다.
    """
    fence = f"{pfx} ---"
    if not lines or lines[0].strip() != fence:
        return lines, {}
    for i in range(1, len(lines)):
        if lines[i].strip() == fence:
            meta: dict[str, str] = {}
            for raw in lines[1:i]:
                body = raw.strip()
                if not body.startswith(pfx):
                    continue
                body = body[len(pfx):].strip()
                if ":" in body:
                    k, v = body.split(":", 1)
                    meta[k.strip()] = v.strip()
            return lines[i + 1:], meta
    raise InjectError(f"프론트매터가 `{fence}`로 닫히지 않았다")


def read_directives(path: Path) -> dict[str, str]:
    """파일의 프론트매터 지시자만 읽는다. 구문 검사기가 쓴다."""
    pfx = comment_prefix(path)
    lines = path.read_text(encoding="utf-8").splitlines()
    return split_frontmatter(lines, pfx)[1]


def _region_start(line: str, pfx: str) -> str | None:
    m = re.match(rf"^\s*{re.escape(pfx)}\s*region:\s*(.+?)\s*$", line)
    return m.group(1) if m else None


def _is_region_end(line: str, pfx: str) -> bool:
    return re.match(rf"^\s*{re.escape(pfx)}\s*endregion\s*$", line) is not None


def extract_region(lines: list[str], region: str, pfx: str, path: Path) -> list[str]:
    out: list[str] = []
    depth = 0
    for line in lines:
        name = _region_start(line, pfx)
        if name is not None:
            if name == region and depth == 0:
                depth = 1
                out = []
            elif depth:
                depth += 1
                out.append(line)
            continue
        if _is_region_end(line, pfx):
            if depth:
                depth -= 1
                if depth == 0:
                    return out
                out.append(line)
            continue
        if depth:
            out.append(line)
    if depth:
        raise InjectError(f"{path.name}: 구역 '{region}'이 `{pfx} endregion`으로 닫히지 않았다")
    known = [n for n in (_region_start(l, pfx) for l in lines) if n]
    raise InjectError(
        f"{path.name}에 구역 '{region}'이 없다. "
        + (f"있는 구역: {', '.join(known)}" if known else "이 파일에는 구역이 하나도 없다")
    )


def _trim(lines: list[str]) -> str:
    while lines and not lines[0].strip():
        lines.pop(0)
    while lines and not lines[-1].strip():
        lines.pop()
    return textwrap.dedent("\n".join(lines))


def read_code(path: Path, region: str | None) -> str:
    pfx = comment_prefix(path)
    lines = path.read_text(encoding="utf-8").splitlines()
    lines, _meta = split_frontmatter(lines, pfx)
    if region:
        lines = extract_region(lines, region, pfx, path)
    else:
        # 구역 표시줄은 화면에 보일 것이 아니다
        lines = [l for l in lines
                 if _region_start(l, pfx) is None and not _is_region_end(l, pfx)]
    return _trim(lines)


def inject(html: str, src_html: Path, repo_root: Path = REPO_ROOT) -> tuple[str, int]:
    """HTML의 data-src 마커를 실제 코드로 채운다. (결과, 채운 개수)를 돌려준다."""
    base = src_html.parent
    count = 0

    def repl(m: re.Match[str]) -> str:
        nonlocal count
        open_tag, spec, _old, close_tag = m.groups()
        rel, _, region = spec.partition("#")
        path = (base / rel).resolve()
        if not path.is_relative_to(repo_root.resolve()):
            raise InjectError(f"{src_html.name}: 저장소 밖을 가리킨다 — {spec}")
        if not path.exists():
            raise InjectError(f"{src_html.name}: 코드 파일이 없다 — {spec}")
        code = read_code(path, region or None)
        count += 1
        return open_tag + html_mod.escape(code, quote=False) + close_tag

    return CODE_TAG_RE.sub(repl, html), count


def markers(html: str) -> list[str]:
    """HTML 안의 data-src 값 목록. 검사기가 쓴다."""
    return [m.group(2) for m in CODE_TAG_RE.finditer(html)]


# ---------------------------------------------------------------- self-test

SELF_TEST_PY = """\
# ---
# check: none
# ---
# region: 인사
name = "학생 A"
print(f"안녕, {name}")
# endregion


# region: 조건
if 1 < 2:
    print("<참>")
# endregion
"""

SELF_TEST_HTML = """\
<pre><code class="language-python" data-src="code/t.py#인사"></code></pre>
<pre><code data-src="code/t.py#조건" class="language-python"></code></pre>
<pre><code class="language-python">손대지 않는다</code></pre>
"""


def self_test() -> int:
    import tempfile

    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        (root / "code").mkdir()
        (root / "code" / "t.py").write_text(SELF_TEST_PY, encoding="utf-8")
        src = root / "a.html"
        src.write_text(SELF_TEST_HTML, encoding="utf-8")

        out, n = inject(SELF_TEST_HTML, src, repo_root=root)
        checks = [
            (n == 2, f"주입 개수 2가 나와야 하는데 {n}"),
            ('print(f"안녕, {name}")' in out, "구역 '인사' 내용이 없다"),
            ("&lt;참&gt;" in out, "꺾쇠가 이스케이프되지 않았다"),
            ("region:" not in out, "구역 표시줄이 새어 나갔다"),
            ("check: none" not in out, "프론트매터가 새어 나갔다"),
            ("손대지 않는다" in out, "마커 없는 블록이 훼손됐다"),
            (read_directives(root / "code" / "t.py") == {"check": "none"}, "지시자 파싱 실패"),
        ]
        bad = [msg for ok, msg in checks if not ok]

        # 없는 구역은 반드시 세워야 한다
        src2 = root / "b.html"
        src2.write_text('<code data-src="code/t.py#없음"></code>', encoding="utf-8")
        try:
            inject(src2.read_text(encoding="utf-8"), src2, repo_root=root)
            bad.append("없는 구역인데 통과했다")
        except InjectError:
            pass

    if bad:
        for msg in bad:
            print(f"[inject_code] 실패: {msg}")
        return 1
    print("[inject_code] 자체 검사 통과")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--self-test", action="store_true", help="주입기 자체 검사")
    args = parser.parse_args()
    if args.self_test:
        return self_test()
    parser.print_help()
    return 0


if __name__ == "__main__":
    sys.exit(main())
