// 검사가 **제 할 일을 하는가.** 저장소가 깨끗하면 검사는 「위반 0」을 말하는데, 그 말은
// 검사가 아무것도 못 보게 망가졌을 때도 똑같이 나온다. 그래서 일부러 틀리게 쓴 조각
// (`tests/fixtures/`)을 넣어 **무엇이 걸리는지를 통째로** 기록해 둔다.
//
// 기록(`tests/fixtures/__expected__/`)은 2026-09-25 에 파이썬 검사를 이 JS 검사로 옮기면서
// **옛 파이썬 검사의 출력과 한 줄씩 대조해 같음을 확인한 것**이다. 규칙을 일부러 바꿨다면
// `npx vitest run tests/fixtures.test.mjs -u` 로 기록을 다시 쓰고, 달라진 줄을 눈으로 확인한다.
//
// 이 조각들은 저장소 전체를 도는 검사에서 빠진다(`verbs` · `classes` · `hover` 가 `tests/fixtures/` 를 뺀다).
import fs from 'node:fs';
import path from 'node:path';
import {describe, expect, test} from 'vitest';
import {ROOT} from '../tools/lib/repo.mjs';
import {check as html} from '../tools/checks/html.mjs';
import {check as terms} from '../tools/checks/terms.mjs';
import {check as verbs} from '../tools/checks/verbs.mjs';
import {check as prose} from '../tools/checks/prose.mjs';
import {check as classes} from '../tools/checks/classes.mjs';
import {check as code} from '../tools/checks/code.mjs';
import {check as hover} from '../tools/checks/hover.mjs';
import {check as formSync} from '../tools/checks/form-sync.mjs';

const F = 'tests/fixtures';
const codeFiles = fs.readdirSync(path.join(ROOT, F, 'codefiles')).map((n) => `${F}/codefiles/${n}`);

const CASES = [
    ['html', html, [`${F}/html/1-1.틀린-제목.html`]],
    ['terms', terms, [`${F}/verbs-terms.js`]],
    ['verbs', verbs, [`${F}/verbs-terms.js`]],
    ['prose', prose, [`${F}/prose.html`]],
    // 배부 양식 생성기 — 문자열 리터럴 속만, 코드인 칸(code · pseudocode · flowchart)은 빼고 본다.
    ['prose-docx', prose, [`${F}/docx/make/prose.js`]],
    // 감사 목록은 `--report` 에서만 나오고 전부 경고다 — 막지 않는 유형이라 경고가 곧 «잡았다»는 뜻이다.
    ['prose-report', (a) => prose([...a, '--report']), [`${F}/prose-report.html`], 'warn'],
    ['classes', classes, [`${F}/classes.html`, `${F}/classes.js`]],
    ['hover', hover, [`${F}/hover.html`]],
    // 배부 양식과 화면판 보고서 — 문항 수 · 번호 · 지시문 · 체크리스트
    ['form-sync', formSync, [`${F}/form-sync.html`]],
    ['code', code, [...codeFiles, `${F}/highlight-none.html`, `${F}/highlight-lang.html`]],
];

describe('일부러 틀린 조각을 검사가 잡는가', () => {
    for (const [name, fn, args, kind] of CASES) {
        test(name, async () => {
            const r = await fn(args);
            // 순서가 아니라 «무엇이 걸렸는가»를 본다.
            const lines = [...r.errors.map((e) => 'ERROR ' + e), ...r.warnings.map((w) => 'WARN  ' + w)].sort();
            const caught = kind === 'warn' ? r.warnings.length : r.errors.length;
            expect(caught, `${name}: 틀린 조각에서 아무것도 못 잡았다 — 검사가 헛돈다`).toBeGreaterThan(0);
            await expect(lines.join('\n') + '\n').toMatchFileSnapshot(`fixtures/__expected__/${name}.txt`);
        });
    }
});
