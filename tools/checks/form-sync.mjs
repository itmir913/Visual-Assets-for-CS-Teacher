// 배부 양식(.docx)과 화면판 보고서의 **문항 지시문 · 자기점검 체크리스트가 같은지** 본다.
//
//     npm run check -- form-sync            저장소 전체(`.q-header` 가 있는 HTML 전부)
//     npm run check -- form-sync <파일>…    그 파일만
//
// 인공지능기초 실습 보고서는 학생이 두 벌로 받는다 — 종이 양식(`tools/docx/make/make_ai_template.js`
// 가 굽는다)과 화면(`인공지능기초/실습/*.html`). 둘이 다르면 **어느 쪽이 맞는지 알 수 없다.**
// 한쪽만 고치는 일은 빌드도 화면도 멀쩡해서 아무도 모른다. 그래서 틀 파일의 `QUESTIONS` 표를
// 읽어 HTML 과 맞댄다.
//
// 맞대는 것
//   1. `.q-header` 의 수와 차례 — `.q-number` 가 「문항 N.」으로 시작하는가
//   2. 지시문 — `.q-number` 를 뺀 `.q-header` 의 글 = `promptText(i)`. 공백은 하나로 줄여 본다
//   3. 체크리스트 — `.checklist-box` 의 `<li>` 항목(앞의 ☑ 는 뺀다) = `QUESTIONS[i].checklist`
//
// 맞대지 않는 것
//   - 종이에만 있는 작은 안내(`note` — 예시 · 캡처 단축키)와 화면에만 있는 문항 이름(「문제 정의」)
//   - **예시 답안.** 종이에는 표를 글자로 그리고(`|` · `─`) 화면에만 있는 해설 상자의 요지를 학생
//     말투로 줄여 넣은 곳이 있어, 글자 그대로 맞대면 오탐이 너무 많다. 답안을 고칠 때는 생성기
//     (`tools/docx/make/ai/<이름>.js`) 머리 주석대로 두 쪽을 함께 고친다.
import path from 'node:path';
import {createRequire} from 'node:module';
import {decodeHTML} from 'entities';
import {ROOT, Report, htmlFiles, lineOf, read, rel} from '../lib/repo.mjs';

const require = createRequire(import.meta.url);
const TEMPLATE = 'tools/docx/make/make_ai_template.js';

const clean = (html) => decodeHTML(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();

const HEADER = /<div class="q-header">([\s\S]*?)<\/div>/g;
const NUMBER = /<p class="q-number">([\s\S]*?)<\/p>/;
const CHECKLIST = /<div class="checklist-box">([\s\S]*?)<\/div>/g;
const ITEM = /<li\b[^>]*>([\s\S]*?)<\/li>/g;

export function check(args = []) {
    const r = new Report('check_form_sync');
    const {QUESTIONS, promptText} = require(path.join(ROOT, TEMPLATE));
    const files = args.filter((a) => !a.startsWith('-'));
    const targets = files.length
        ? files.map((f) => path.resolve(ROOT, f))
        : htmlFiles().filter((p) => read(p).includes('class="q-header"'));

    for (const p of targets) {
        const src = read(p);
        const at = (idx) => `${rel(p)}:${lineOf(src, idx)}`;
        const headers = [...src.matchAll(HEADER)];
        const boxes = [...src.matchAll(CHECKLIST)];
        if (headers.length !== QUESTIONS.length) {
            r.error(`${rel(p)}: 문항 머리(.q-header)가 ${headers.length}개 — 배부 양식은 ${QUESTIONS.length}문항이다`);
        }
        if (boxes.length !== QUESTIONS.length) {
            r.error(`${rel(p)}: 체크리스트(.checklist-box)가 ${boxes.length}개 — 배부 양식은 ${QUESTIONS.length}문항이다`);
        }
        let bad = 0;
        headers.slice(0, QUESTIONS.length).forEach((m, i) => {
            const n = i + 1;
            const num = m[1].match(NUMBER);
            if (!num || !clean(num[1]).startsWith(`문항 ${n}.`)) {
                bad++;
                r.error(`${at(m.index)}: ${n}번째 문항 머리가 「문항 ${n}.」으로 시작하지 않는다`);
            }
            const screen = clean(m[1].replace(NUMBER, ''));
            const paper = promptText(i);
            if (screen !== paper) {
                bad++;
                r.error(`${at(m.index)}: 문항 ${n} 지시문이 배부 양식과 다르다\n      화면: ${screen}\n      종이: ${paper}`);
            }
        });
        boxes.slice(0, QUESTIONS.length).forEach((m, i) => {
            const screen = [...m[1].matchAll(ITEM)].map((x) => clean(x[1]).replace(/^☑\s*/, ''));
            const paper = QUESTIONS[i].checklist;
            if (screen.join('\n') !== paper.join('\n')) {
                bad++;
                r.error(`${at(m.index)}: 문항 ${i + 1} 체크리스트가 배부 양식과 다르다\n      화면: ${screen.join(' / ')}\n      종이: ${paper.join(' / ')}`);
            }
        });
        if (!bad) r.note(`${rel(p)}: OK`);
    }
    return r.done(`완료 — 화면판 ${targets.length}, 문항 ${QUESTIONS.length}, 위반 ${r.errors.length} (틀: ${TEMPLATE})`);
}
