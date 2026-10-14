// 인공지능 기초 2-1 강의노트의 **기계학습 단계 줄**이 지금 단계를 바로 가리키는가.
//
// 2-1 노트는 「문제 정의 → … → 성능 평가」 여섯 단계를 차례로 다룬다. 노트마다 첫머리에
// `data-ml-steps` 를 단 줄을 하나 두고, 그 안의 자식 여섯이 STEP1~STEP6 을 차례로 적는다.
// 꺼진 단계는 `bg-slate-100` · `bg-slate-200` 바탕이고, 켜진 단계는 그 밖의 바탕이다.
//
//  - 줄이 정확히 하나 있다.
//  - 자식이 여섯이고, 글자(공백을 뺀 것)가 STEPS 와 차례대로 같다 — 단계를 묶거나 빼지 않는다.
//  - 켜진 단계가 그 노트의 몫(CURRENT)과 같다 — 「다음 단계」를 미리 켜지 않는다.
//
// 노트는 파일 이름 앞머리(`2-1-5` 따위)로 CURRENT 를 찾는다. 새 2-1 노트를 더하면 CURRENT 에 한 줄 더한다.
//
// 사용:
//     npm run check -- steps                  # 인공지능기초/2-1-*.html 전체
//     npm run check -- steps <파일>…          # 짚은 파일만
import fs from 'node:fs';
import path from 'node:path';
import {JSDOM} from 'jsdom';
import {ROOT, Report, read, rel} from '../lib/repo.mjs';

export const STEPS = ['문제 정의', '데이터 수집', '데이터 전처리', '유형·알고리즘 선정', '모델 생성', '성능 평가']
    .map((name, i) => `STEP${i + 1}${name}`.replace(/\s+/g, ''));

/** 노트마다 켜 둘 단계(1부터). */
export const CURRENT = {
    '2-1-1': [1, 2],
    '2-1-2': [2],
    '2-1-3': [2],
    '2-1-4': [3],
    '2-1-5': [3],
    '2-1-6': [4],
    '2-1-7': [5, 6],
};

const OFF = /\bbg-slate-(100|200)\b/;
const DIR = path.join(ROOT, '인공지능기초');

export async function check(args = []) {
    const r = new Report('check_steps');
    const picked = args.filter((a) => !a.startsWith('-')).map((a) => path.resolve(ROOT, a)).filter((p) => fs.existsSync(p));
    const files = picked.length ? picked : fs.readdirSync(DIR).filter((n) => /^2-1-\d+\..*\.html$/.test(n)).map((n) => path.join(DIR, n));
    if (!files.length) { r.error('검사할 파일이 없다'); return r; }
    for (const p of files) {
        const key = path.basename(p).split('.')[0];
        const want = CURRENT[key];
        if (!want) { r.error(`${rel(p)} [단계 몫 없음] tools/checks/steps.mjs 의 CURRENT 에 ${key} 를 더할 것`); continue; }
        const rows = new JSDOM(read(p)).window.document.querySelectorAll('[data-ml-steps]');
        if (rows.length !== 1) { r.error(`${rel(p)} [단계 줄] data-ml-steps 줄이 ${rows.length}개 — 하나여야 한다`); continue; }
        const items = [...rows[0].children];
        const texts = items.map((e) => e.textContent.replace(/\s+/g, ''));
        if (texts.join('|') !== STEPS.join('|')) {
            r.error(`${rel(p)} [단계 빠짐 · 묶음] ${texts.join(' / ')} — STEP1~STEP6 을 하나씩 차례로 적을 것`);
            continue;
        }
        const on = items.map((e, i) => (OFF.test(e.className) ? 0 : i + 1)).filter(Boolean);
        if (on.join(',') !== want.join(',')) {
            r.error(`${rel(p)} [켜진 단계] ${on.join(',') || '없음'} — ${want.join(',')} 만 켤 것`);
        }
    }
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.length}`);
}
