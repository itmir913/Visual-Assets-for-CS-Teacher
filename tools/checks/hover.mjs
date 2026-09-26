// 손으로 쓴 CSS 의 `:hover` 가 **호버가 되는 기기에서만** 켜지는가.
//
// 터치 기기에는 호버가 없는데, 브라우저는 누른 자리를 «호버된» 것으로 쳐서 다른 데를 누를
// 때까지 호버 모양을 붙여 둔다. 퀴즈 선택지를 누르고 나면 그 버튼만 호버 색으로 남아
// 정답 · 오답 색과 뒤섞인다.
//
// Tailwind 의 `hover:` 는 설정(`future.hoverOnlyWhenSupported`)으로 이미 막았다. 남는 것은
// 페이지 `<style>` 과 `src/styles/*.css` 에 **손으로 쓴** `:hover` 다. 이것은 반드시
//
//     @media (hover: hover) and (pointer: fine) {
//         .quiz-btn:hover { … }
//     }
//
// 안에 둔다. 조건에 `(hover: hover)` 가 든 `@media` 안이면 통과다(`not …` 으로 뒤집은 것은 아니다).
// 스크롤바 손잡이(`::-webkit-scrollbar-thumb:hover`)처럼 감싸도 무해한 것도 예외 없이 감싼다 —
// 예외를 두면 「이건 괜찮다」를 사람이 판정하게 된다.
//
// 사용:
//     npm run check -- hover                  # 저장소 전체
//     npm run check -- hover <파일>…          # 짚은 .html · .css 만
import fs from 'node:fs';
import path from 'node:path';
import postcss from 'postcss';
import {ROOT, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';

const SKIP = (n) => ['node_modules', '.git', '.venv', '.idea', 'scratchpad', 'public'].includes(n) ||
    n.startsWith('dist') || n.startsWith('.tmp') || n === 'fixtures';

/** 호버가 되는 기기로 좁힌 `@media` 인가. */
export const HOVER_MEDIA = (params) => /\(\s*hover\s*:\s*hover\s*\)/.test(params) && !/^\s*not\b/.test(params);

/** CSS 글에서 감싸지 않은 `:hover` 규칙 — [시작 위치, 선택자] 목록. */
export function bareHovers(css) {
    const out = [];
    postcss.parse(css).walkRules((rule) => {
        if (!rule.selector.includes(':hover')) return;
        for (let p = rule.parent; p && p.type !== 'root'; p = p.parent) {
            if (p.type === 'atrule' && p.name === 'media' && HOVER_MEDIA(p.params)) return;
        }
        out.push([rule.source.start.offset, rule.selector.replace(/\s+/g, ' ').trim()]);
    });
    return out;
}

/** HTML 의 `<style>` 본문 — [본문, 파일 안의 시작 위치]. */
const styleBlocks = (text) =>
    [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => [m[1], m.index + m[0].indexOf('>') + 1]);

export async function check(args = []) {
    const r = new Report('check_hover');
    const picked = args.filter((a) => !a.startsWith('-')).map((a) => path.resolve(ROOT, a)).filter((p) => fs.existsSync(p));
    const files = picked.length ? picked : [
        ...walk(ROOT, {ext: ['.html'], skip: SKIP}),
        ...walk(path.join(ROOT, 'src', 'styles'), {ext: ['.css']}),
    ];
    if (!files.length) { r.error('검사할 파일이 없다'); return r; }
    for (const p of files) {
        const text = read(p);
        const blocks = p.endsWith('.css') ? [[text, 0]] : styleBlocks(text);
        for (const [css, base] of blocks) {
            let found;
            try { found = bareHovers(css); } catch (e) { r.error(`${rel(p)}:${lineOf(text, base)} CSS 를 읽지 못했다 — ${e.reason || e.message}`); continue; }
            for (const [at, sel] of found) {
                r.error(`${rel(p)}:${lineOf(text, base + at)} [감싸지 않은 :hover] ${sel}`);
            }
        }
    }
    if (r.errors.length) r.error('@media (hover: hover) and (pointer: fine) { … } 안에 둘 것 (까닭은 tools/checks/hover.mjs 머리 주석)');
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.filter((e) => e.includes('[감싸지')).length}`);
}
