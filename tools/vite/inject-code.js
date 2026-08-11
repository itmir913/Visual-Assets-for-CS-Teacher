// 강의노트가 가리키는 코드를 실파일에서 읽어 HTML에 넣는다.
//
//   <pre><code class="language-c" data-src="code/조건.c#비교"></code></pre>
//
// 코드를 HTML 안에 두면 이스케이프가 섞여 오타 하나 고치기가 어려워진다. 실제로
// 같은 블록 안에서 주석의 `<`는 raw, 코드의 `<`는 `&lt;`인 곳이 있었는데 브라우저에서
// 똑같이 보여 눈으로 찾을 수가 없었다. 실파일로 두면 편집기가 문법을 알고, 검사기가
// 구문 오류를 잡고, 학생이 받아 가는 파일과 화면에 뜨는 코드가 같아진다.
//
// **마커가 없는 HTML은 그대로 지나간다** — 그래서 파일을 하나씩 옮겨 갈 수 있다.
// 규약 전체는 tools/README.md의 「코드는 HTML에 넣지 않는다」에 있다.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { ROOT, relPath } from './units.js';

/** 확장자별 한 줄 주석 기호. 여기 없는 확장자는 주입 대상이 아니다. */
const COMMENT_PREFIX = {
    '.py': '#',
    '.c': '//', '.h': '//', '.java': '//', '.js': '//',
};

const CODE_TAG = /(<code\b[^>]*\bdata-src="([^"]+)"[^>]*>)([\s\S]*?)(<\/code>)/g;

/**
 * 주석 프론트매터를 떼어 낸다.
 *
 *     # ---
 *     # check: none
 *     # ---
 *
 * `---`를 그냥 첫 줄에 쓰면 `.c`가 컴파일되지 않으므로 주석 안에 넣는다.
 */
function stripFrontmatter(lines, pfx) {
    const fence = `${pfx} ---`;
    if (lines[0]?.trim() !== fence) return lines;
    const end = lines.findIndex((l, i) => i > 0 && l.trim() === fence);
    if (end < 0) throw new Error(`프론트매터가 \`${fence}\`로 닫히지 않았다`);
    return lines.slice(end + 1);
}

const startOf = (pfx) => new RegExp(`^\\s*${pfx.replace('/', '\\/')}\\s*region:\\s*(.+?)\\s*$`);
const endOf = (pfx) => new RegExp(`^\\s*${pfx.replace('/', '\\/')}\\s*endregion\\s*$`);

/** 구역 하나를 뽑는다. 구역 이름이 없으면 파일 전체에서 표시줄만 걷어낸다. */
function readRegion(lines, region, pfx, name) {
    const start = startOf(pfx);
    const end = endOf(pfx);
    if (!region) return lines.filter((l) => !start.test(l) && !end.test(l));

    const out = [];
    let depth = 0;
    for (const line of lines) {
        const m = line.match(start);
        if (m) {
            if (m[1] === region && depth === 0) depth = 1;
            else if (depth) { depth += 1; out.push(line); }
            continue;
        }
        if (end.test(line)) {
            if (depth && --depth === 0) return out;
            if (depth) out.push(line);
            continue;
        }
        if (depth) out.push(line);
    }
    const known = lines.map((l) => l.match(start)).filter(Boolean).map((m) => m[1]);
    throw new Error(
        `${name}에 구역 '${region}'이 없다. ` +
        (known.length ? `있는 구역: ${known.join(', ')}` : '이 파일에는 구역이 하나도 없다'),
    );
}

/** 앞뒤 빈 줄을 버리고 공통 들여쓰기를 벗긴다 — 조각이 조각답게 보이도록. */
function dedent(lines) {
    while (lines.length && !lines[0].trim()) lines.shift();
    while (lines.length && !lines.at(-1).trim()) lines.pop();
    const indents = lines.filter((l) => l.trim()).map((l) => l.match(/^\s*/)[0].length);
    const cut = indents.length ? Math.min(...indents) : 0;
    return lines.map((l) => l.slice(cut)).join('\n');
}

const escapeHtml = (s) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** 마커 하나가 가리키는 코드를 읽어 이스케이프까지 마친 문자열로 돌려준다. */
export function readCode(spec, baseDir, where) {
    const [relFile, region] = spec.split('#');
    const file = resolve(baseDir, relFile);
    if (!file.startsWith(resolve(ROOT))) {
        throw new Error(`${where}: 저장소 밖을 가리킨다 — ${spec}`);
    }
    const pfx = COMMENT_PREFIX[relFile.slice(relFile.lastIndexOf('.')).toLowerCase()];
    if (!pfx) {
        throw new Error(
            `${where}: 주입할 수 없는 확장자 — ${spec} ` +
            `(가능: ${Object.keys(COMMENT_PREFIX).join(', ')})`,
        );
    }
    let text;
    try {
        text = readFileSync(file, 'utf-8');
    } catch {
        throw new Error(`${where}: 코드 파일이 없다 — ${spec}`);
    }
    const lines = stripFrontmatter(text.split(/\r?\n/), pfx);
    return escapeHtml(dedent(readRegion(lines, region, pfx, relFile)));
}

export default function injectCode() {
    return {
        name: 'inject-code',
        transformIndexHtml: {
            order: 'pre',
            handler(html, ctx) {
                if (!html.includes('data-src')) return html;
                const rel = relPath(ctx);
                const base = dirname(resolve(ROOT, rel));
                return html.replace(CODE_TAG, (_m, open, spec, _old, close) =>
                    open + readCode(spec, base, rel) + close);
            },
        },
    };
}
