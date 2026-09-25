// 강의노트 HTML 에서 「학생이 실제로 읽는 글자」만 뽑아낸다.
//
// 용도 — 서술 감사(Fable 등)에 넘길 입력을 만든다.
// 강의노트 HTML 은 **본문이 5분의 1 남짓**이고 나머지는 Tailwind 클래스와 SVG 좌표다.
// 원본을 통째로 넘기면 토큰의 대부분을 감사와 무관한 마크업에 쓴다.
// **비율은 파일마다 다르니 짐작하지 말고 `--stats` 로 잰다.**
//
// **섹션 구조를 남기는 것이 핵심이다.** 태그만 벗기면 감사자가 지적을 어디에
// 붙여야 할지 알 수 없어 "어딘가에 오개념이 있다" 수준의 보고만 돌아온다.
// 그래서 h1/h2/h3 와 section id 를 마크다운 제목으로 살려 둔다.
//
// 사용법
//     npm run prose -- "데이터과학/3-2-*.html"
//     npm run prose -- "인공지능기초/*.html" -o out.md
//     npm run prose -- "데이터과학/*.html" --stats   # 크기만 보고 싶을 때
//     npm run prose -- "인공지능기초/**/*.html" --digest -o d.md   # 과목 전체 요약판 → digest()
//     npm run prose -- --glossary -o g.md   # 과목 간 용어집 → glossary(). 글롭 없이 전 과목을 본다
//
// 과목 간 점검 — 요약판도 다섯 과목을 합치면 감사자 한 번에 읽기엔 크다. 과목 사이의 어긋남은
// «같은 개념을 두 과목이 다르게 말하는 것»이므로 과목이 아니라 용어 단위로 모은다(2026-09-25).
// 용어집을 주제 묶음(인공지능 · 데이터 · 알고리즘 · 시스템)별 감사자에게 주고, 지적은 전문판에서
// 원문을 확인한 것만 받는다. 기준 과목은 `subjects.json` 의 첫 과목이고 표의 맨 앞 열이 된다.
//
// 주의 — 추출본에는 **표의 열 구조와 그림이 남지 않는다.**
// "두 산점도를 나란히 놓아 비교시킨다" 같은 시각 장치는 감사 범위에서 빠진다.
// 서술만 볼 때 쓰는 도구이고, 레이아웃 점검은 브라우저 실측으로 따로 한다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ARIA, DROP, QUIZ, SVG, TAG, clean} from './lib/prose-text.mjs';
import {ROOT, SUBJECTS, walk} from './lib/repo.mjs';

const HEADING = /<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>/g;
const SECTION = /<section\b[^>]*\bid="([^"]+)"/g;
const SUMMARY = /<summary\b[^>]*>([\s\S]*?)<\/summary>/g;

/** [본문, 원본 길이] */
export function extract(file) {
    const src = fs.readFileSync(file, 'utf8').replace(/\r\n?/g, '\n');
    let body = src.replace(DROP, ' ');
    // 그림은 버리되 대체 텍스트는 남긴다 — 도해 설명도 감사 대상이다.
    body = body.replace(SVG, (_, attrs) => { const a = attrs.match(ARIA); return '\n[그림] ' + (a ? a[1] : '(설명 없음)') + '\n'; });
    // details 의 summary 는 접혀 있어도 학생이 보는 글이다. 표시를 남긴다.
    body = body.replace(SUMMARY, (_, s) => '\n[접기] ' + clean(s) + '\n');
    body = body.replace(QUIZ, (_, ok, t) => `\n[해설 ${ok === 'true' ? 'O' : 'X'}] ${t}\n`);
    // 섹션 경계와 제목을 마크다운으로 살린다.
    body = body.replace(SECTION, (_, id) => `\n\n@@SECTION ${id}@@\n`);
    body = body.replace(HEADING, (_, h, t) => `\n\n@@H${h[1]} ${clean(t)}@@\n`);
    // 태그는 줄을 나누기 «전에» 벗긴다. 여러 줄에 걸친 여는 태그를 줄마다 벗기면
    // 닫는 꺾쇠를 못 만나 클래스 목록이 본문으로 새어 나온다.
    body = body.replace(TAG, ' ');

    const out = [];
    let sec = null;
    for (const chunk of body.split('\n')) {
        const s = chunk.trim().match(/^@@SECTION (.+)@@/);
        if (s) { sec = s[1]; continue; }
        const h = chunk.trim().match(/^@@H(\d) (.*)@@/);
        if (h) {
            const tag = h[1] === '2' && sec ? ` \`#${sec}\`` : '';
            out.push(`\n${'#'.repeat(Number(h[1]) + 1)} ${h[2]}${tag}\n`);
            continue;
        }
        const t = clean(chunk);
        if (t) out.push(t);
    }
    return [out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), src.length];
}

// 요약판 — 과목 전체를 한 번에 읽혀 «파일 사이»의 어긋남(정의·조건·예시 값·퀴즈)을
// 찾게 할 때 쓴다. 전문판은 과목 하나가 감사자 한 번에 읽기엔 크다.
// 남기는 것: 파일 머리(제목·학습 목표), 모든 절 제목, 정의꼴 문장, 핵심 정리·퀴즈 절 전부.
// 버린 본문은 전문판에서 찾아 확인하게 한다 — 요약판만 보고 지적하면 헛짚는다.
const DEF = /(이란 |란 |을 말합니다|를 말합니다|라고 합니다|이라고 합니다|을 뜻합니다|를 뜻합니다|을 의미합니다|를 의미합니다|[가-힣]\s?\([A-Za-z][A-Za-z .,'-]+\))/;

export function digest(text) {
    const out = [];
    let mode = 'head';
    for (const line of text.split('\n')) {
        const h = line.match(/^(#{3,}) .*?(`#([\w-]+)`)?$/);
        if (h) {
            if (/핵심 정리/.test(line)) mode = 'keep';
            else if (h[1] === '###') mode = /summary|quiz/.test(h[3] || '') || /확인 퀴즈/.test(line) ? 'keep' : 'body';
            out.push(line);
            continue;
        }
        if (mode !== 'body' || DEF.test(line)) out.push(line);
    }
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 과목 간 용어집 — 두 과목 이상에 나오는 용어의 정의 문장을 과목별로 나란히 놓는다.
 *
 * 열쇠는 둘이다. 「한글(English)」 병기의 영어(소문자)와, 「X(이)란 」 정의꼴의 한글 X.
 * 영어를 열쇠로 삼으면 **같은 영어에 과목마다 다른 한글이 붙은 것**(인코딩 / 부호화 같은)이
 * 저절로 드러난다 — 그런 용어에는 ⚠ 를 단다. 뽑는 규칙이 느슨해 잡음이 섞이므로 판정은
 * 감사자가 원문을 보고 한다.
 * @param {{subj: string, name: string, text: string}[]} docs 과목 순서대로
 */
export function glossary(docs, subjects) {
    const sentences = (text) => text.split('\n').filter((l) => !/^#|^\[/.test(l) && !/class=/.test(l)).join(' ')
        .replace(/\s+/g, ' ').split(/(?<=[.?!])\s+|(?<=다)\s+(?=[가-힣「])/)
        .map((s) => s.trim()).filter((s) => s.length > 8 && s.length < 260);
    const files = docs.map((d) => ({...d, sents: sentences(d.text)}));
    const terms = new Map();
    const add = (k, ko, f, s) => {
        if (!terms.has(k)) terms.set(k, {ko: new Map(), hits: new Map()});
        const t = terms.get(k);
        if (ko) (t.ko.get(f.subj) ?? t.ko.set(f.subj, new Set()).get(f.subj)).add(ko);
        const arr = t.hits.get(f.subj) ?? t.hits.set(f.subj, []).get(f.subj);
        if (!arr.some(([, x]) => x === s)) arr.push([f.name, s, DEF.test(s)]);
    };
    for (const f of files) {
        for (const s of f.sents) {
            for (const m of s.matchAll(/([가-힣]+(?: [가-힣]+)?)\s?\(([A-Za-z][A-Za-z .'-]{1,40}?)\)/g)) {
                const en = m[2].trim().toLowerCase();
                if (en.length >= 3) add('en:' + en, m[1].split(' ').pop(), f, s);
            }
            for (const m of s.matchAll(/(?:^|[\s「])([가-힣]{2,12})(?:이)?란 /g)) add('ko:' + m[1], m[1], f, s);
        }
    }
    // 한글 열쇠는 그 낱말로 시작하는 정의꼴 문장을 다른 과목에서도 줍는다.
    for (const [k] of terms) {
        if (!k.startsWith('ko:')) continue;
        const w = k.slice(3);
        for (const f of files) for (const s of f.sents) if (s.includes(w) && DEF.test(s) && s.indexOf(w) < 25) add(k, w, f, s);
    }
    const out = ['# 과목 간 용어집', '', `두 과목 이상에 나오는 것만. 과목 순서: ${subjects.join(' · ')} (앞이 기준)`, ''];
    for (const [k, t] of [...terms].sort()) {
        if (t.hits.size < 2) continue;
        const kos = new Set([...t.ko.values()].flatMap((x) => [...x]));
        out.push(`## ${k.slice(3)}${kos.size > 1 ? `  ⚠ 한글 이름 ${[...kos].join(' / ')}` : ''}`);
        for (const subj of subjects) {
            const hs = t.hits.get(subj);
            if (!hs) continue;
            const pick = [...hs.filter((h) => h[2]), ...hs.filter((h) => !h[2])].slice(0, 2);
            out.push(`- **${subj}** (${hs.length}곳${t.ko.get(subj) ? ' · ' + [...t.ko.get(subj)].join('/') : ''})`);
            for (const [fn, s] of pick) out.push(`  - \`${fn}\` ${s.slice(0, 220)}`);
        }
        out.push('');
    }
    return out.join('\n');
}

function main(argv) {
    if (argv.includes('--glossary')) {
        const o = argv.indexOf('-o') >= 0 ? argv[argv.indexOf('-o') + 1] : null;
        const subjects = SUBJECTS.map((s) => s.dir);
        const docs = SUBJECTS.flatMap((s) => walk(path.join(ROOT, s.dir), {ext: ['.html']})
            .map((f) => ({subj: s.dir, name: path.basename(f, '.html'), text: extract(f)[0]})));
        const body = glossary(docs, subjects);
        if (o) { fs.writeFileSync(o, body); console.error(`용어집 ${(body.match(/^## /gm) || []).length}개 → ${o}`); }
        else process.stdout.write(body);
        return;
    }
    let outFile = null, stats = false, brief = false;
    const pats = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '-o' || argv[i] === '--out') outFile = argv[++i];
        else if (argv[i] === '--stats') stats = true;
        else if (argv[i] === '--digest') brief = true;
        else pats.push(argv[i]);
    }
    if (!pats.length) { console.error('쓰는 법 — npm run prose -- <HTML 파일 또는 글롭>… [-o 파일] [--stats] [--digest]'); process.exit(2); }
    const files = pats.flatMap((p) => { const hit = fs.globSync(p).sort(); return hit.length ? hit : (fs.existsSync(p) ? [p] : []); });
    if (!files.length) { console.error('대상 파일이 없다.'); process.exit(1); }

    const parts = [];
    let totRaw = 0, totTxt = 0;
    const fmt = (n) => n.toLocaleString('en-US');
    for (const f of files) {
        const [full, raw] = extract(f);
        const text = brief ? digest(full) : full;
        totRaw += raw;
        totTxt += text.length;
        const name = path.basename(f);
        parts.push('\n\n' + '='.repeat(70) + `\n# ${name}\n` + '='.repeat(70) + '\n\n' + text);
        console.error(`${[...name].slice(0, 46).join('').padEnd(46)} 원본 ${fmt(raw).padStart(7)}자 → 본문 ${fmt(text.length).padStart(6)}자 (${(text.length / raw * 100).toFixed(1).padStart(4)}%)`);
    }
    console.error('-'.repeat(80));
    console.error(`합계 ${files.length}개  원본 ${fmt(totRaw)}자 → 본문 ${fmt(totTxt)}자 (${(totTxt / totRaw * 100).toFixed(1)}%)   토큰 어림 ≈ ${fmt(Math.floor(totTxt / 1.5))} (한국어 1.5자/토큰)`);
    if (stats) return;
    const body = parts.join('').trim();
    if (outFile) { fs.writeFileSync(outFile, body); console.error(`→ ${outFile} 에 썼다.`); }
    else process.stdout.write(body);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
