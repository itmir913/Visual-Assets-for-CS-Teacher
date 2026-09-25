// SVG 글자가 데스크톱에서 한없이 커지는 파일을 찾는다.
//
// `<svg viewBox="..." class="w-full">` 는 부모 컨테이너 폭에 맞춰 늘어난다.
// `min-width`(모바일에서 줄어들지 않게 하는 바닥)만 있고 `max-width`(데스크톱에서
// 커지지 않게 하는 천장)가 없으면, 화면이 넓어질수록 `<text font-size="...">` 가
// viewBox 대비 비율만큼 계속 커진다.
//
// 글자(<text font-size="...">)가 있는 SVG 중 `max-width` 가 없는 것을 찾아 파일별로 보고한다.
// 수정은 하지 않는다 — 각 SVG 의 실제 배치 폭(그리드 칼럼 등)에 따라 적절한 max-width 값이
// 다르므로 사람이 정해야 한다.
//
// 이어서 **브라우저 실측**을 한다 — 그림 속 글자가 서로 겹치거나 12px 보다 작게 그려지는지
// (→ tests/browser/svg-text.test.mjs). 정적 검사로는 알 수 없는 것이다. SVG 를 고쳤을 때 부른다.
//
//     npm run audit -- svg                     # 저장소 전체(실측 포함, 1~2분)
//     npm run audit -- svg 인공지능기초         # 디렉터리 지정 — 실측도 그 폴더만
//     npm run audit -- svg --static            # 정적 목록만
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, htmlFiles, read, rel, walk} from '../lib/repo.mjs';
import {tokens} from '../lib/html-tokens.mjs';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Tailwind 의 폭 천장 클래스. max-w-full · max-w-none 은 천장 구실을 못 하므로 뺀다.
// 끝에 \b 를 쓰면 안 된다 — `max-w-[200px]` 는 `]` 다음이 공백이라 경계가 서지 않아
// 통째로 안 잡힌다. 대신 클래스 구분자가 오는지를 본다.
const MAXW_CLASS_RE = /(?:^|\s)max-w-(?:\[[^\]]+\]|xs|sm|md|lg|\d?xl|screen-\w+|prose|fit|min|max)(?=\s|$)/;
// 폭 · 높이가 값으로 박혀 있으면(% 가 아니면) 아예 늘어나지 않는다.
const FIXED_LEN_RE = /^\s*[\d.]+\s*(px)?\s*$/;

/** [줄, viewBox 폭, min-width, 종류('천장'|'정렬'), 까닭] */
export function scanFile(src) {
    const stack = [];   // [tag, line, attrs, uid]
    const hasText = new Set();
    const flagged = [];
    let uid = 0;

    function checkSvg([, line, a], ancestors) {
        const vb = a.viewbox;
        if (!vb) return;
        const parts = vb.trim().split(/[\s,]+/);
        if (parts.length !== 4) return;
        const vbW = Number(parts[2]);
        if (parts[2] === '' || !Number.isFinite(vbW)) return;
        const style = a.style || '', cls = a.class || '';
        const words = cls.split(/\s+/);
        // 글자가 한없이 커지지 않게 막는 방법은 폭 천장만이 아니다. 높이가 묶여도
        // preserveAspectRatio 때문에 확대 배율이 함께 묶인다. 가운데 정렬을 따로 챙겨야 하는
        // 것은 **폭 천장이 있을 때뿐**이다 — 높이로 묶으면 기본값이 이미 가운데 놓는다.
        let why = null, widthCapped = null;
        const mc = cls.match(MAXW_CLASS_RE);
        if (FIXED_LEN_RE.test(a.width || '')) why = widthCapped = 'width 속성 고정';
        else if (/max-width\s*:/.test(style)) why = widthCapped = 'style max-width';
        else if (mc) why = widthCapped = `Tailwind ${mc[0].trim()}`;
        else if (FIXED_LEN_RE.test(a.height || '')) why = 'height 속성 고정';
        else if (/max-height\s*:/.test(style)) why = 'style max-height';
        else if (words.includes('h-full') || /\bheight\s*:/.test(style)) {
            // 높이가 고정된 조상 안에서 h-full 이면 배율이 그 높이로 묶인다.
            if (ancestors.some(([, , pa]) => /\bheight\s*:\s*[\d.]+(px|rem|vh)/.test(pa.style || ''))) why = '높이 고정 조상';
        }
        const m = style.match(/min-width\s*:\s*([\d.]+)(px|rem)/);
        const minW = m ? parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16) : null;
        if (why) {
            if (!widthCapped) return;
            // 폭 천장은 있는데 가운데 정렬이 없으면 좁아진 그림이 왼쪽에 붙는다.
            const centered = words.includes('mx-auto') || /margin\s*:\s*[^;]*auto|margin-inline\s*:/.test(style) ||
                ancestors.slice(-3).some(([, , pa]) => ['items-center', 'justify-center', 'text-center'].some((c) => (pa.class || '').includes(c)));
            if (!centered) flagged.push([line, vbW, minW, '정렬', why]);
            return;
        }
        flagged.push([line, vbW, minW, '천장', null]);
    }

    function end(tag) {
        for (let i = stack.length - 1; i >= 0; i--) {
            if (stack[i][0] === tag) {
                const node = stack[i];
                stack.length = i;
                if (tag === 'svg' && hasText.has(node[3])) checkSvg(node, stack.slice());
                return;
            }
        }
    }

    for (const t of tokens(src)) {
        if (t.type === 'end') { end(t.tag); continue; }
        stack.push([t.tag, t.line, t.attrs, ++uid]);
        if (t.tag === 'text' && 'font-size' in t.attrs) {
            for (let i = stack.length - 1; i >= 0; i--) if (stack[i][0] === 'svg') { hasText.add(stack[i][3]); break; }
        }
        if (VOID.has(t.tag)) stack.pop();
        else if (t.selfClosing) end(t.tag);   // `<text …/>` 는 열고 곧바로 닫는다
    }
    return flagged;
}

const g = (x) => String(x);

export function run(argv) {
    const args = argv.filter((a) => a !== '-v' && a !== '--verbose' && a !== '--static');
    const files = args.length
        ? [...new Set(args.flatMap((d) => walk(path.resolve(ROOT, d), {ext: ['.html']})))].sort()
        : htmlFiles();
    let hit = 0;
    const counts = {천장: 0, 정렬: 0};
    for (const f of files) {
        const flagged = scanFile(read(f));
        if (!flagged.length) continue;
        hit++;
        for (const [line, vbW, minW, kind, why] of flagged) {
            counts[kind]++;
            const minS = minW !== null ? `${g(minW)}px` : '없음';
            if (kind === '천장') console.log(`WARN  audit_svg: ${rel(f)}:${line} [천장 없음] viewBox 폭 ${g(vbW)}, min-width=${minS} — 화면이 넓어질수록 글자가 계속 커진다`);
            else console.log(`WARN  audit_svg: ${rel(f)}:${line} [가운데 정렬 없음] viewBox 폭 ${g(vbW)}, 천장=${why} — 좁아진 그림이 왼쪽에 붙는다`);
        }
    }
    console.log(`INFO  audit_svg: 완료 — 파일 ${files.length}, 걸린 파일 ${hit}, 천장 없음 ${counts['천장']}, 가운데 정렬 없음 ${counts['정렬']}`);
    if (argv.includes('--static')) return;

    // 둘째 단계 — 진짜 브라우저로 그림 속 글자를 잰다(겹침 · 12px 미만) → tests/browser/svg-text.test.mjs.
    // **ci 에 넣지 않았다**(2026-09-25 사용자 결정). 197편을 다 재면 1~2분이라 매번 돌릴 값어치가 없다.
    // SVG 를 고친 뒤에 폴더를 주어 부른다.
    console.log('INFO  audit_svg: 브라우저 실측 — 글자가 든 그림이 있는 페이지만 잰다');
    const proc = spawnSync(process.execPath, [
        path.join(ROOT, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'tests/browser/svg-text.test.mjs',
    ], {cwd: ROOT, stdio: 'inherit', env: {...process.env, VITE_SVG_DIRS: JSON.stringify(args)}});
    process.exitCode = proc.status ?? 1;
}
