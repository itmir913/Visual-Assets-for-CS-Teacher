// 런타임에 조립되는 Tailwind 클래스를 찾는다.
//
// 배포본은 Tailwind 가 파일을 텍스트로 훑어 **리터럴로 존재하는 클래스만** 구워서 만든다.
// 그래서 아래처럼 클래스 이름을 코드로 조립하면 CSS에 그 클래스가 담기지 않는다.
//
//     <div class="bg-${lang.color}-50">        <!-- bg-yellow-50 이 CSS에 없다 -->
//     el.className = 'text-' + tone + '-600';
//
// CDN을 쓰던 시절에는 런타임 JIT라 소스를 열면 멀쩡히 보였다 — **눈으로는 안 잡힌다.**
// 실제로 `프로그래밍(Python)/1-1-2` 에서 8개 중 3개가 빠진 채로 오래 남아 있었다.
//
// 고치는 법 — 완성된 클래스 문자열을 데이터에 리터럴로 넣는다.
//
//     iconClass: 'bg-yellow-50 text-yellow-600',      // 리터럴이므로 Tailwind 가 찾는다
//     <div class="${lang.iconClass}">
//
// 사용:
//     npm run check -- classes                    # 저장소 전체
//     npm run check -- classes <파일>…            # 짚은 파일만
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, lineOf, read, rel, walk} from '../lib/repo.mjs';

// 값이 있는 Tailwind 유틸리티 접두사. 조립되면 CSS에서 빠지는 것들이다.
const PREFIX =
    '(?:bg|text|border|outline|ring|divide|from|via|to|fill|stroke|shadow|opacity' +
    '|w|h|min-w|min-h|max-w|max-h|size|basis' +
    '|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y|space-x|space-y' +
    '|grid-cols|grid-rows|col-span|row-span|order|z|leading|tracking|rounded' +
    '|translate-x|translate-y|rotate|scale|duration|delay)';

const RULES = [
    // class="bg-${x}-50"  /  `text-${tone}-600`
    [new RegExp('\\b' + PREFIX + '-(?:[a-z0-9-]*-)?\\$\\{', 'g'), '템플릿 리터럴로 조립'],
    // 'bg-' + x   /   "text-" + tone
    [new RegExp('[\'"`]' + PREFIX + '-(?:[a-z0-9-]*-)?[\'"`]\\s*\\+', 'g'), '문자열 결합으로 조립'],
];

const SKIP = (n) => ['node_modules', '.git', '.venv', '.idea'].includes(n) || n.startsWith('dist') || n.startsWith('.tmp');

export function check(args = []) {
    const r = new Report('check_classes');
    const picked = args.filter((a) => !a.startsWith('-'));
    const files = picked.length
        ? picked.map((a) => path.resolve(ROOT, a)).filter((p) => p.endsWith('.html') && fs.existsSync(p))
        : walk(ROOT, {ext: ['.html'], skip: SKIP}).filter((p) => !rel(p).startsWith('tests/fixtures/'));   // 일부러 틀리게 쓴 검사용 조각
    if (!files.length) { r.error('검사할 파일이 없다'); return r; }
    for (const p of files) {
        const text = read(p);
        for (const [re, label] of RULES) {
            for (const m of text.matchAll(re)) {
                const snippet = text.slice(Math.max(0, m.index - 40), m.index + m[0].length + 30).replace(/\s+/g, ' ').trim();
                r.error(`${rel(p)}:${lineOf(text, m.index)} [런타임 조립] ${label} — …${snippet}…`);
            }
        }
    }
    if (r.errors.length) r.error('완성된 클래스 문자열을 리터럴로 넣도록 고칠 것 (자세한 설명은 tools/checks/classes.mjs 머리 주석)');
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.filter((e) => e.includes('[런타임')).length}`);
}
