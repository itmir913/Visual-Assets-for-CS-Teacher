#!/usr/bin/env python3
"""오프라인 배포용 정적 빌드 스크립트.

읽기: 레포 소스(HTML)만 읽는다.
쓰기: --out(기본 dist/)에만 쓴다. 소스 트리에는 절대 쓰지 않는다.

사용법:
    python .github/scripts/build_offline.py                    # 전체 빌드
    python .github/scripts/build_offline.py --only <상대경로>   # 파일 하나만 (파일럿·디버그용)

전제:
    - node/npx로 tailwindcss CLI(v3)를 받아 쓸 수 있어야 한다 (인터넷 필요).
    - 실행 중 CDN에서 자산을 내려받는다 (인터넷 필요). 이미 받은 자산은 --out 안의
      assets/ 캐시를 재사용한다.
"""
from __future__ import annotations

import argparse
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
SCRIPT_DIR = Path(__file__).resolve().parent

TARGET_DIRS = ["인공지능기초", "데이터과학", "프로그래밍(Python)", "프로그래밍(C)", "simulator/ai"]
TARGET_FILES = ["index.html"]

FA_VERSION = "6.7.2"
FA_CSS_URL = f"https://cdnjs.cloudflare.com/ajax/libs/font-awesome/{FA_VERSION}/css/all.min.css"
PRETENDARD_CSS_URL = (
    "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/"
    "dist/web/variable/pretendardvariable-dynamic-subset.min.css"
)

# 그대로 한 파일로 내려받아 assets/vendor/에 저장하면 되는 CDN 자산.
# key: 소스에 쓰인 정확한 URL, value: 로컬 파일명
VENDOR_MAP = {
    "https://cdn.jsdelivr.net/npm/chart.js": "chart.min.js",
    "https://unpkg.com/lucide@1.28.0": "lucide.min.js",
    "https://unpkg.com/vis-network/standalone/umd/vis-network.min.js": "vis-network.min.js",
    "https://unpkg.com/ml5@1.3.1/dist/ml5.min.js": "ml5.min.js",
    "https://d3js.org/d3.v7.min.js": "d3.v7.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.9.0/p5.min.js": "p5.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/prism.min.js": "prism.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css": "prism-tomorrow.min.css",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-python.min.js": "prism-python.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-c.min.js": "prism-c.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-java.min.js": "prism-java.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-javascript.min.js": "prism-javascript.min.js",
}
UNSUPPORTED_CDN_SUBSTRINGS: list[str] = []

# MathJax: tex-chtml.js는 렌더링 시점에 자기 스크립트 경로를 기준으로 상대경로를 계산해
# 폰트(es5/output/chtml/fonts/woff-v2/*.woff)를 추가로 받아온다. 그래서 파일 하나만 받으면
# 안 되고, CDN과 "같은 상대 디렉터리 구조"로 폰트까지 함께 받아야 로컬에서도 그 상대경로
# 계산이 그대로 맞는다. (jsDelivr 패키지 목록 API로 확인한 3.2.2 기준 23개 파일)
MATHJAX_VERSION = "3.2.2"
MATHJAX_JS_URL_RE = re.compile(r"https://cdn\.jsdelivr\.net/npm/mathjax@[^/]+/es5/tex-chtml\.js")
MATHJAX_JS_URL = f"https://cdn.jsdelivr.net/npm/mathjax@{MATHJAX_VERSION}/es5/tex-chtml.js"
MATHJAX_FONT_FILES = [
    "MathJax_AMS-Regular.woff", "MathJax_Calligraphic-Bold.woff", "MathJax_Calligraphic-Regular.woff",
    "MathJax_Fraktur-Bold.woff", "MathJax_Fraktur-Regular.woff", "MathJax_Main-Bold.woff",
    "MathJax_Main-Italic.woff", "MathJax_Main-Regular.woff", "MathJax_Math-BoldItalic.woff",
    "MathJax_Math-Italic.woff", "MathJax_Math-Regular.woff", "MathJax_SansSerif-Bold.woff",
    "MathJax_SansSerif-Italic.woff", "MathJax_SansSerif-Regular.woff", "MathJax_Script-Regular.woff",
    "MathJax_Size1-Regular.woff", "MathJax_Size2-Regular.woff", "MathJax_Size3-Regular.woff",
    "MathJax_Size4-Regular.woff", "MathJax_Typewriter-Regular.woff", "MathJax_Vector-Bold.woff",
    "MathJax_Vector-Regular.woff", "MathJax_Zero.woff",
]

TAILWIND_SCRIPT_RE = re.compile(r'[ \t]*<script src="https://cdn\.tailwindcss\.com"[^>]*></script>\n?')
FA_LINK_RE = re.compile(r'<link[^>]*href="' + re.escape(FA_CSS_URL) + r'"[^>]*/?>')
# 따옴표(홑/겹) 혼용, <style> 안 @import와 <link> 태그(속성이 여러 줄에 걸친 경우 포함)
# 두 형태 다 실제로 쓰이고 있어서 둘 다 잡는다.
PRETENDARD_IMPORT_RE = re.compile(r"""@import url\((['"])""" + re.escape(PRETENDARD_CSS_URL) + r"""\1\);""")
PRETENDARD_LINK_RE = re.compile(
    r'<link\b(?:(?!/?>).)*?href="' + re.escape(PRETENDARD_CSS_URL) + r'"(?:(?!/?>).)*?/?>',
    re.DOTALL,
)


def log(msg: str) -> None:
    print(f"[build_offline] {msg}", flush=True)


def fetch(url: str, dest: Path) -> None:
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    log(f"내려받는 중: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "offline-build-script"})
    with urllib.request.urlopen(req, timeout=30) as resp, open(dest, "wb") as f:
        shutil.copyfileobj(resp, f)


def discover_html_files() -> list[Path]:
    files: list[Path] = []
    for d in TARGET_DIRS:
        base = REPO_ROOT / d
        if base.exists():
            files.extend(sorted(base.rglob("*.html")))
    for f in TARGET_FILES:
        p = REPO_ROOT / f
        if p.exists():
            files.append(p)
    return files


def depth_prefix(rel_path: Path) -> str:
    """dist 안 해당 파일 위치에서 dist 루트로 돌아가는 상대 경로 접두어."""
    depth = len(rel_path.parts) - 1
    return "../" * depth


def _resolve_tailwind_bin() -> str:
    """매 파일마다 `npx -y tailwindcss@3`를 부르면 그때마다 레지스트리 확인 등으로
    호출당 십수 초씩 걸려 121개 기준 수십 분이 든다. .github/scripts/에 미리
    `npm install`(package.json)해 둔 로컬 바이너리를 직접 부르면 그 오버헤드가 없다.
    로컬 설치가 없으면 npx로 폴백한다(최초 1회 느린 대신 그냥 동작은 한다)."""
    local_bin = SCRIPT_DIR / "node_modules" / ".bin" / ("tailwindcss.cmd" if sys.platform == "win32" else "tailwindcss")
    if local_bin.exists():
        return str(local_bin)
    log("경고: .github/scripts/node_modules가 없습니다. 먼저 `npm install --prefix .github/scripts`를 "
        "실행하면 훨씬 빠릅니다. 지금은 npx로 폴백합니다 (파일마다 느림).")
    return (shutil.which("npx") or "npx")  # Windows는 subprocess가 .cmd 셰임을 못 찾아 전체 경로가 필요


TAILWIND_BIN = _resolve_tailwind_bin()
TAILWIND_VIA_NPX = TAILWIND_BIN.lower().endswith(("npx", "npx.cmd"))


def build_tailwind_css(src_html: Path, out_css: Path) -> None:
    out_css.parent.mkdir(parents=True, exist_ok=True)
    base_css = SCRIPT_DIR / "tailwind-base.css"
    cmd = [TAILWIND_BIN]
    if TAILWIND_VIA_NPX:
        cmd += ["-y", "tailwindcss@3"]
    cmd += [
        "-i", str(base_css),
        "-o", str(out_css),
        "--content", str(src_html),
        "--minify",
    ]
    # npx를 파일마다 반복 호출하면 드물게 죽는다(관찰된 사례: Windows에서
    # STATUS_STACK_BUFFER_OVERRUN, 재시도하면 재현 안 됨) — 몇 번 재시도한다.
    last_err: subprocess.CalledProcessError | None = None
    for attempt in range(1, 4):
        try:
            subprocess.run(cmd, check=True, cwd=REPO_ROOT, capture_output=True, text=True)
            return
        except subprocess.CalledProcessError as e:
            last_err = e
            log(f"  tailwindcss 실패(시도 {attempt}/3, exit={e.returncode}): {src_html.name}")
    raise RuntimeError(f"tailwindcss 빌드 3회 모두 실패: {src_html}\n{last_err.stderr if last_err else ''}")


def localize_fontawesome(assets_dir: Path) -> None:
    fa_dir = assets_dir / "fontawesome"
    css_dest = fa_dir / "css" / "all.min.css"
    if css_dest.exists():
        return
    fetch(FA_CSS_URL, css_dest)
    css_text = css_dest.read_text(encoding="utf-8")
    for rel in sorted(set(re.findall(r"url\((\.\./webfonts/[^)]+?)(?:\?[^)]*)?\)", css_text))):
        font_url = urllib.parse.urljoin(FA_CSS_URL, rel)
        fetch(font_url, fa_dir / "webfonts" / Path(rel).name)


def localize_pretendard(assets_dir: Path) -> None:
    out_dir = assets_dir / "fonts" / "pretendard"
    css_dest = out_dir / "pretendard-dynamic-subset.css"
    if css_dest.exists():
        return
    out_dir.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(PRETENDARD_CSS_URL, headers={"User-Agent": "offline-build-script"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        css_text = resp.read().decode("utf-8")
    rel_urls = sorted(set(re.findall(r"url\(([^)]+\.woff2)\)", css_text)))
    for rel in rel_urls:
        abs_url = urllib.parse.urljoin(PRETENDARD_CSS_URL, rel)
        fetch(abs_url, out_dir / Path(rel).name)
        css_text = css_text.replace(f"url({rel})", f"url({Path(rel).name})")
    css_dest.write_text(css_text, encoding="utf-8")


def localize_mathjax(assets_dir: Path) -> None:
    base = assets_dir / "vendor" / "mathjax" / "es5"
    js_dest = base / "tex-chtml.js"
    fetch(MATHJAX_JS_URL, js_dest)
    font_dir = base / "output" / "chtml" / "fonts" / "woff-v2"
    for name in MATHJAX_FONT_FILES:
        url = f"https://cdn.jsdelivr.net/npm/mathjax@{MATHJAX_VERSION}/es5/output/chtml/fonts/woff-v2/{name}"
        fetch(url, font_dir / name)


def localize_vendor(assets_dir: Path, url: str) -> str:
    """VENDOR_MAP에 등록된 단일 파일 CDN 자산을 내려받고 로컬 파일명을 돌려준다."""
    filename = VENDOR_MAP[url]
    fetch(url, assets_dir / "vendor" / filename)
    return filename


def build_one(src_html: Path, dist_root: Path, assets_dir: Path) -> list[str]:
    """src_html 하나를 빌드한다. 처리 못 한(로컬화 미지원) CDN URL 목록을 돌려준다."""
    rel = src_html.relative_to(REPO_ROOT)
    prefix = depth_prefix(rel)
    html = src_html.read_text(encoding="utf-8")
    unsupported: list[str] = []

    # 1) Tailwind CDN 스크립트 제거 + 파일 전용 정적 CSS 빌드
    # 산출물 최상위에 자동 생성 폴더가 assets/ 하나만 있으면 되도록 css/도 그 밑에 둔다.
    if "cdn.tailwindcss.com" in html:
        css_rel = rel.with_suffix(".css")
        build_tailwind_css(src_html, dist_root / "assets" / "css" / css_rel)
        html = TAILWIND_SCRIPT_RE.sub("", html, count=1)
        link_tag = f'    <link rel="stylesheet" href="{prefix}assets/css/{css_rel.as_posix()}">\n'
        # </title> 다음 줄에 삽입 (관례상 CDN 스크립트가 있던 자리 근처)
        html = re.sub(r"(</title>\n)", r"\1" + link_tag, html, count=1)

    # 2) Font Awesome
    if FA_CSS_URL in html:
        localize_fontawesome(assets_dir)
        html = FA_LINK_RE.sub(
            f'<link rel="stylesheet" href="{prefix}assets/cdn/fontawesome/css/all.min.css">', html
        )

    # 3) Pretendard — <style> 안 @import 형태와 <link> 태그 형태 둘 다 쓰인다
    if PRETENDARD_CSS_URL in html:
        localize_pretendard(assets_dir)
        local_css = f"{prefix}assets/cdn/fonts/pretendard/pretendard-dynamic-subset.css"
        html = PRETENDARD_IMPORT_RE.sub(f'@import url("{local_css}");', html)
        html = PRETENDARD_LINK_RE.sub(f'<link rel="stylesheet" href="{local_css}"/>', html)

    # 4) MathJax (폰트까지 상대 구조 그대로 로컬화)
    if MATHJAX_JS_URL_RE.search(html):
        localize_mathjax(assets_dir)
        html = MATHJAX_JS_URL_RE.sub(f"{prefix}assets/cdn/vendor/mathjax/es5/tex-chtml.js", html)

    # 5) 단순 1파일 vendor 자산
    for url, filename in VENDOR_MAP.items():
        if url in html:
            localize_vendor(assets_dir, url)
            local = f"{prefix}assets/cdn/vendor/{filename}"
            html = html.replace(f'src="{url}"', f'src="{local}"')
            html = html.replace(f'href="{url}"', f'href="{local}"')

    # 6) 남은 CDN 참조 탐지 (콘텐츠 인용 링크는 예외)
    for m in re.finditer(r'<(?:script|link)[^>]*https://[^>]*>', html):
        tag = m.group(0)
        if any(sub in tag.lower() for sub in UNSUPPORTED_CDN_SUBSTRINGS):
            unsupported.append(tag)

    out_path = dist_root / rel
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(html, encoding="utf-8")
    return unsupported


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default=str(REPO_ROOT / "dist"), help="출력 루트 (기본 dist/)")
    parser.add_argument("--only", help="이 상대경로 파일 하나만 빌드 (파일럿·디버그용)")
    args = parser.parse_args()

    dist_root = Path(args.out).resolve()
    # assets/ 밑을 캐시 대상(cdn/ — CDN에서 받은 것)과 매번 새로 빌드되는 것(css/)으로
    # 나눠서, 워크플로가 cdn/ 통째로 캐싱할 수 있게 한다. dist 루트에는 여전히 assets/
    # 하나만 자동 생성된다.
    assets_dir = dist_root / "assets" / "cdn"

    if args.only:
        files = [REPO_ROOT / args.only]
    else:
        files = discover_html_files()

    log(f"대상 파일 {len(files)}개, 출력: {dist_root}")

    all_unsupported: dict[str, list[str]] = {}
    failed: list[tuple[str, str]] = []
    for i, f in enumerate(files, 1):
        rel = str(f.relative_to(REPO_ROOT))
        log(f"({i}/{len(files)}) {rel}")
        try:
            unsupported = build_one(f, dist_root, assets_dir)
        except Exception as e:  # 파일 하나가 실패해도 나머지는 계속 진행
            failed.append((rel, str(e)))
            continue
        if unsupported:
            all_unsupported[rel] = unsupported

    if all_unsupported:
        log("=== 로컬화 미지원 CDN 참조 (수동 확인 필요) ===")
        for path, tags in all_unsupported.items():
            for tag in tags:
                log(f"  {path}: {tag}")

    if failed:
        log(f"=== 빌드 실패 {len(failed)}건 ===")
        for path, err in failed:
            log(f"  {path}: {err}")
        return 1

    log("빌드 완료.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
