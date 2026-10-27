// 첫 화면의 전 과목 검색이 쓰는 색인을 만든다. **빌드 · 개발 서버 · 검사가 이 파일 하나를 부른다.**
//
// 색인의 단위는 파일이 아니라 **절**이다 — `<main>` 안의 `<section>` 하나가 레코드 하나다.
// 학생은 복습하려고 찾으므로 결과를 누르면 그 절로 떨어져야 한다. 파일 맨 위로 보내면 긴
// 노트에서 다시 찾아 내려가야 한다.
//
// ## 머리말 · 목차 · 푸터를 어떻게 빼는가
//
// **구조로 뺀다.** 노트마다 `<header>`(hero) · `<nav>`(목차) · `<footer>`가 똑같이 있어서,
// 그대로 담으면 아무 질의나 모든 편에 걸려 결과가 쓸모없어진다. `<main>` 안만 보면 셋이 함께
// 빠진다 — 편마다 속성을 달아 빼는 길(197편 편집)을 택하지 않은 까닭이다. 짜임이 한결같은지는
// `check -- search-index`가 지킨다(`<main>`이 하나인가 · 절에 앵커가 있는가).
//
// ## 두 벌이 아니라 한 벌
//
// 레코드는 **머리 색인**(절마다 과목 · 파일 · 문서 제목 · 절 제목)과 **과목별 본문**으로 나뉜다.
// 첫 화면은 머리 색인만 받아 제목으로 답하고, 본문은 학생이 처음 칠 때 과목 조각으로 받는다.
// 둘은 `f`(파일) + `s`(절 앵커)로 맞붙으므로 제목이 두 번 담기지 않는다.
//
// ## 본문을 원문 그대로 담는다
//
// 소문자 사본도 공백 없는 사본도 담지 않는다 — 색인이 배로 커지고, 사본에서 찾은 자리는
// 원문의 자리가 아니라 발췌와 표시가 어긋난다. 찾을 때 `looseSource()`가 만드는 정규식 하나가
// 대소문자와 띄어쓰기를 함께 받는다(「기계 학습」으로 「기계학습」을 찾는다).
import path from 'node:path';

import {clean, proseText} from './prose-text.mjs';
import {ROOT, SUBJECTS, rel, subjectOf, walk} from './repo.mjs';

const MAIN = /<main\b[^>]*>([\s\S]*)<\/main>/;
const SECTION = /<section\b([^>]*)>/g;
const ID = /\bid="([^"]+)"/;
const HEADING = /<(h[23])\b[^>]*>([\s\S]*?)<\/\1>/;
const TITLE = /<title>([\s\S]*?)<\/title>/;

/** 색인과 질의가 **같은 꼴**이 되게 고른다. 둘이 어긋나면 있는 말을 못 찾는다. */
export const normalize = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * 질의를 **띄어쓰기를 눈감아 주는** 정규식 소스로 바꾼다.
 *
 * 과목 사이에 「기계학습 / 기계 학습」처럼 띄어쓰기가 갈리는 말이 있고, 학생은 들은 대로
 * 친다. 글자 사이에 공백을 허용하면 질의의 띄어쓰기와 본문의 띄어쓰기가 달라도 만난다.
 *
 * **첫 화면에는 이것의 사본이 있다** — 평범한 스크립트라 저장소의 모듈을 가져올 수 없다.
 * 둘이 같은 답을 내는지는 `check -- search-index`가 두 함수를 같은 말로 돌려 견준다.
 */
export const looseSource = (q) => [...normalize(q).replace(/\s+/g, '')].map(esc).join('\\s*');

/**
 * 절 하나 — 차례 · 앵커 · 절 제목 · 본문. 본문이 빈 절은 담지 않는다(그림만 있는 칸).
 *
 * **레코드를 가리키는 이름은 앵커가 아니라 차례(`i`)다.** 앵커(`id`)가 없는 절이 더러 있어
 * (`<section>`에 `id`를 안 단 곳), 앵커로 이름을 매기면 그런 절들이 한 이름에 몰려
 * 머리 색인과 본문이 서로 다른 절을 가리킨다 — 본문 일치가 엉뚱한 절에 얹힌다.
 * 앵커는 **누르면 갈 자리**로만 쓰고, 없으면 파일 맨 위로 간다.
 */
function sectionsOf(html) {
    const main = html.match(MAIN);
    if (!main) return [];
    const body = main[1];
    const marks = [...body.matchAll(SECTION)];
    const out = [];
    for (let i = 0; i < marks.length; i++) {
        const open = marks[i];
        const chunk = body.slice(open.index, marks[i + 1]?.index ?? body.length);
        const text = normalize(proseText(chunk));
        if (!text) continue;
        out.push({i, s: chunk.match(ID)?.[1] ?? '', h: clean(chunk.match(HEADING)?.[2] ?? ''), b: text});
    }
    return out;
}

/**
 * 노트 하나의 레코드. 과목에 속하지 않는 파일은 `null`.
 * `as`를 주면 그 과목으로 센다 — 과목 폴더 밖의 조각을 색인해 보는 검사가 쓴다.
 */
export function noteRecords(relPath, html, as = null) {
    const subject = as ?? subjectOf(relPath);
    if (!subject) return null;
    const title = clean(html.match(TITLE)?.[1] ?? '');
    return sectionsOf(html).map((sec) => ({
        j: subject.slug, f: relPath, t: title, i: sec.i, s: sec.s, h: sec.h, b: sec.b,
    }));
}

/**
 * 색인에 드는 강의노트 — **목록은 `subjects.json`이 정한다**(`walk`). 어디서 읽을지는 부르는 쪽이
 * 정하고(빌드는 `dist/`, 개발 서버와 검사는 주입을 거친 소스), 목록은 늘 한 곳에서 온다.
 */
export const noteFiles = () =>
    SUBJECTS.flatMap((s) => walk(path.join(ROOT, s.dir), {ext: ['.html']}).map(rel));

/** `read(rel)` 가 돌려주는 HTML 로 `{rel, html}` 목록을 모은다. `null` 은 건너뛴다. */
export function collect(read) {
    const out = [];
    for (const r of noteFiles()) {
        const html = read(r);
        if (html !== null && html !== undefined) out.push({rel: r, html});
    }
    return out;
}

/**
 * 색인 한 벌. `notes` 는 `{rel, html}` 목록이고 **주입이 끝난 HTML** 이어야 한다
 * (빌드는 `dist/`를, 검사는 `inject-code`의 `readCode()`를 거친 소스를 넘긴다).
 *
 *     heads  [{j, f, t, i, s, h}, …]        첫 화면이 바로 받는다
 *     parts  {<과목 slug>: [[f, i, b], …]}  학생이 처음 칠 때 받는다
 *
 * 둘은 파일 `f` 와 절의 차례 `i` 로 맞붙는다(앵커가 아니다 — `sectionsOf()` 머리 주석).
 */
export function buildIndex(notes, as = null) {
    const heads = [];
    const parts = {};
    for (const {rel, html} of notes) {
        const recs = noteRecords(rel, html, as);
        if (!recs) continue;
        for (const r of recs) {
            heads.push({j: r.j, f: r.f, t: r.t, i: r.i, s: r.s, h: r.h});
            (parts[r.j] ??= []).push([r.f, r.i, r.b]);
        }
    }
    return {heads, parts};
}

/**
 * 조각 파일의 내용. 평범한 스크립트다 — `file://`에서 모듈 · fetch 가 막힌다.
 *
 * **줄에 담아 두고 부르지 않는다.** 머리 조각은 `defer`라 첫 화면의 검색 스크립트보다 늦게 돌고,
 * 과목 조각은 실행 중에 꽂으므로 더 늦게 온다. 어느 쪽이 먼저 와도 잃지 않게 줄에 밀어 넣고,
 * 받을 쪽이 있으면 그때 비운다.
 */
export const partScript = (slug, rows) =>
    `(window.LN_SEARCH_Q=window.LN_SEARCH_Q||[]).push([${JSON.stringify(slug)},${JSON.stringify(rows)}]);`
    + 'window.LN_SEARCH&&window.LN_SEARCH.drain();\n';
