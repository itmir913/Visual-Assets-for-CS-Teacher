// 정적 검사(`tools/checks/*.mjs`)를 Vitest 테스트 하나로 감싼다.
//
// 검사 본체는 `Report` 를 돌려주는 함수이고, 여기서 그 결과를 찍은 뒤 위반이 0 인지 본다.
// 인자(`npm run check -- html <파일>`)는 러너가 `CHECK_ARGS` 로 넘긴다.
import {test, expect} from 'vitest';
import {checkArgs} from '../tools/lib/repo.mjs';

export function defineCheck(name, fn) {
    test(name, async () => {
        const args = checkArgs();
        const r = await fn(args);
        r.print({verbose: args.some((a) => a === '-v' || a === '--verbose') || args.length > 0});
        expect(r.errors.length, `${name}: 위반 ${r.errors.length}건 — 위 ERROR 줄을 볼 것`).toBe(0);
    });
}
