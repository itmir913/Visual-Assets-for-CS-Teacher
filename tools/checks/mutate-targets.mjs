// 돌연변이(tools/mutate.mjs 의 `MUTANTS`)가 **아직 과녁을 겨누고 있는가** — 테스트는 돌리지 않고 글자만 본다.
//
// 돌연변이는 대상 파일의 글을 **글자 그대로** 찾아 바꾼다. 코드를 옮기거나 고치면 그 글이 사라져 돌연변이가
// 조용히 과녁을 잃는데, mutate 는 ci 밖이라 한참 뒤에야 「자리 없음」으로 드러난다. 여기서 ci 마다 본다.
//
//   1. 대상 파일이 있고, 찾을 글이 그 안에 있다. 산출물(`dist/`)을 겨누는 것은 **여기서 보지 않는다** —
//      `npm run ci`의 첫 `check`는 빌드보다 먼저 돌아서, 남아 있는 `dist/`는 지난 빌드의 찌꺼기다.
//      그것을 읽으면 결과가 기기의 상태에 따라 갈린다. 산출물 과녁은 빌드 뒤 `check -- dist`가
//      아래 `distTargets()`로 본다.
//   2. 설명에 작업 묶음 꼬리표 · 날짜가 없다(`감수0926` 꼴 — 글자 바로 뒤에 붙은 네 자리 숫자).
//   3. 대상 테스트 파일이 있다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report} from '../lib/repo.mjs';
import {MUTANTS} from '../mutate.mjs';

const TAG = /[가-힣A-Za-z]\d{4}[a-z]?(?![\d])/;

export function check() {
    const r = new Report('check_mutate-targets');
    let skipped = 0;
    MUTANTS.forEach(([test, rel, from, , why], i) => {
        const at = `MUTANTS[${i}] ${test} — ${why}`;
        if (TAG.test(why)) r.error(`  ✗ ${at}: 설명에 작업 꼬리표 · 날짜가 붙어 있다 — 무엇이 망가졌는지만 적는다`);
        const testFile = path.join(ROOT, 'tests', `${test.replace(/\.$/, '')}.test.mjs`);
        if (!fs.existsSync(testFile)) r.error(`  ✗ ${at}: 대상 테스트 tests/${test.replace(/\.$/, '')}.test.mjs 가 없다`);
        if (rel.startsWith('dist/')) { skipped++; return; }
        target(r, at, rel, from);
    });
    return r.done(`완료 — 돌연변이 ${MUTANTS.length}, 산출물 과녁은 check -- dist로 미룸 ${skipped}, 위반 ${r.errors.length}`);
}

/** 산출물(`dist/`)을 겨누는 돌연변이가 과녁을 찾는가. 빌드 직후에만 부른다(`check -- dist`). */
export function distTargets(r) {
    MUTANTS.forEach(([test, rel, from, , why], i) => {
        if (rel.startsWith('dist/')) target(r, `MUTANTS[${i}] ${test} — ${why}`, rel, from);
    });
}

const cache = new Map();
function target(r, at, rel, from) {
    if (!cache.has(rel)) {
        const p = path.join(ROOT, rel);
        cache.set(rel, fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null);
    }
    const text = cache.get(rel);
    if (text === null) r.error(`  ✗ ${at}: 대상 파일 ${rel} 이 없다`);
    else if (!text.includes(from)) r.error(`  ✗ ${at}: ${rel} 에 찾을 글이 없다 — 코드를 옮겼다면 돌연변이도 새 자리로 옮긴다`);
}
