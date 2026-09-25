// 값이 들어갈 자리 뒤에 **손으로 적어 둔 조사**를 찾는다.
//
// `이(가)` 처럼 양쪽을 다 적은 것은 `html` 검사가 잡는다 — 그것은 보자마자 결함이다.
// **여기서 찾는 것은 한쪽만 적어 둔 것이다.** 「지도 5을」·「타일 2을」·「비용가 같은」처럼
// 값이 바뀌면 틀리는데, **값이 맞는 것으로 뽑히는 동안에는 화면에서 멀쩡해 보인다.**
// 그래서 눈으로도 검사로도 오래 살아남는다 — 실제로 다섯 자리가 그렇게 살아남았다.
//
// **`ci` 에 넣지 않는다. 사람이 봐야 판정이 갈리기 때문이다.**
// `${왼쪽/오른쪽}이` 처럼 나올 수 있는 값이 **모두 같은 받침**이면 그것은 맞는 코드다.
// 기계는 그 「나올 수 있는 값」을 모른다. 그러니 이 도구는 **찾아 놓기만 하고
// 판정은 사람에게 넘긴다** — `audit -- narrow` 를 `ci` 밖에 둔 것과 같은 까닭이다.
//
//     npm run audit -- josa            저장소 전체
//     npm run audit -- josa <파일>…    그 파일(폴더)만
//
// 고르는 일은 `src/entries/_lib/josa.js` 가 한다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, byPath, lineOf, read, rel, walk} from '../lib/repo.mjs';

// 값이 끝나는 자리.
//
// **값이 «바뀌는» 자리만 본다.** 글쓴이가 낱말을 아는 자리에서 조사를 적는 것은
// 당연히 맞는 코드다. 그런 것까지 세었더니 6천 곳이 나와 볼 수가 없었다. 그래서 둘만 본다.
//
//   1. `${...}` 바로 뒤            — 값이 그 자리에 그대로 들어간다
//   2. `${...}` 를 «품은» 강조 태그의 닫는 쪽 — `<b>${v}</b>은` 꼴.
const 값끝 = '(?:\\$\\{[^{}]{1,80}\\}|<(?:b|strong|code)\\b[^>]*>[^<]{0,80}\\$\\{[^{}]{1,80}\\}[^<]{0,40}</(?:b|strong|code)>)';
// 뒤에 붙는 조사. **긴 것을 먼저 적는다** — 「으로」가 「로」보다 앞이라야 통째로 잡힌다.
const 조사 = '(?:으로|이라고|라고|이라|은|는|이|가|을|를|과|와|로)';
// 조사가 낱말의 첫 글자가 아니라 «조사»이려면 뒤가 끊겨야 한다.
const 뒤 = '(?=[\\s.,!?)\\]<」』"\'&]|$)';
const PAT = new RegExp(`(${값끝})(${조사})${뒤}`, 'g');
// 이미 모듈을 거친 자리는 뺀다. 「${josa(...)}」·「${withJosa(...)}」가 그것이다.
const 지나감 = /^\$\{[^{}]*[jJ]osa\s*\(/;

const SKIP = new Set(['node_modules', 'dist', '.git', '__pycache__', '.idea']);
const collect = (base) => walk(base, {ext: ['.html', '.js'], skip: (n) => SKIP.has(n)});

/**
 * 인자가 폴더면 그 아래를 본다.
 * **폴더를 그냥 읽으려 들면 조용히 아무것도 안 한다.** 처음에 그렇게 만들어 두고
 * 「0곳」을 보고서 통과한 줄 알았다 — 안 본 것과 보고 없는 것이 같은 글자로 나왔다.
 */
function targets(args) {
    if (!args.length) return collect(ROOT);
    const out = [];
    for (const a of args) {
        const p = path.resolve(ROOT, a);
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) out.push(...collect(p));
        else if (fs.existsSync(p)) out.push(p);
        else console.log(`WARN  audit_josa: 없는 자리 — ${a}`);
    }
    return out.sort(byPath);
}

export function run(args) {
    let hits = 0, files = 0;
    for (const p of targets(args)) {
        const src = read(p);
        const found = [];
        for (const m of src.matchAll(PAT)) {
            if (지나감.test(m[1])) continue;
            // 그 줄을 그대로 보여 준다 — 앞말이 무엇인지 봐야 판정이 된다.
            const start = src.lastIndexOf('\n', m.index) + 1;
            const end = src.indexOf('\n', m.index + m[0].length);
            const line = src.slice(start, end > 0 ? end : src.length).trim();
            found.push([lineOf(src, m.index), m[2], [...line].slice(0, 150).join('')]);
        }
        if (!found.length) continue;
        files++;
        hits += found.length;
        console.log(`INFO  audit_josa: ${rel(p)} — ${found.length}곳`);
        for (const [ln, j, line] of found) console.log(`INFO  audit_josa:   ${rel(p)}:${ln} 「${j}」 ${line}`);
    }
    console.log(`INFO  audit_josa: 완료 — 손으로 적은 듯한 조사 ${hits}곳, 파일 ${files}개`);
    console.log('INFO  audit_josa: 나올 수 있는 값이 모두 같은 받침이면 그대로 두어도 된다 — 판정은 사람이 한다');
}
