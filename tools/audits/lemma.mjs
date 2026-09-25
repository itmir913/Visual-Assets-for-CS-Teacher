// 본문에 실제로 쓰인 **용언 표제어**를 빈도순으로 뽑는다 — 어휘 감사의 입력.
//
//     npm run audit -- lemma                          저장소의 강의노트 전부
//     npm run audit -- lemma "정보(고등학교)/*.html"   짚은 것만
//     npm run audit -- lemma --all                    「하다·되다」가 붙은 것까지
//     npm run audit -- lemma --min 3 --json out.json
//
// **`ci` 에 넣지 않는다.** 이 도구는 판정하지 않고 **찾아 놓기만 한다** —
// 어떤 낱말을 갈아 끼울지는 사람이 정한다. `audit -- narrow` · `audit -- josa` 와 같은 자리다.
//
// ## 왜 있는가 — 「목록에 없는 말은 못 본다」를 뒤집는다
//
// `verbs` 와 `html` 검사의 금지어는 **닫힌 목록**이다. 「견주다」를 찾으려면 이미 「견주다」를
// 알고 있어야 하고, **모르는 말은 영영 못 본다.** 여기서는 방향을 뒤집어 **본문이 쓴 «어휘»를
// 읽는다.** 한 과목의 한글 어절이 3만 꼴이어도 용언 표제어는 수백 개다 — 사람이(또는 모델이)
// **한 화면에서 전수로 판정할 수 있는 크기**가 된다. 처음 돌렸을 때 「재다」 일곱 곳이 나왔다.
// 금지어 목록에 있는데도 정규식에 `재던` · `재라` 가 없어 새어 나가던 자리였다.
//
// ## 형태소 분석기
//
// **한국어 동사는 활용해서 `grep` 으로 못 잡는다.** 어미가 어간의 마지막 음절과 한 글자로
// 합쳐지기 때문이다 — `펴` + `었` → **폈**, `견주` + `어` → **견줘**. 분석기는 어간과 어미를
// 갈라 준다. 분석기는 파이썬 꾸러미 `kiwipiepy` 를 **바깥 도구로만** 부른다(`code` 검사가
// gcc 를 부르는 것과 같다) — 본문 추출과 세기는 이 파일이 한다. 없으면 넣는 법을 알려 주고 멈춘다.
// **`ci` 가 부르지 않으므로 CI 는 이 의존성을 몰라도 된다.**
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, SUBJECTS, walk} from '../lib/repo.mjs';
import {extract} from '../extract-prose.mjs';

// 용언. VV 동사 · VA 형용사와 그 불규칙 갈래. 보조용언(VX)과 지정사(VCP/VCN)는 뺀다 —
// 「~고 있다」의 「있」까지 세면 표가 조사로 뒤덮인다.
const VERB_TAGS = new Set(['VV', 'VA', 'VV-I', 'VA-I', 'VV-R', 'VA-R']);
// 「하·되·시키」로 끝나는 표제어는 이미 한자어 + 접사다. 찾는 것은 그 반대쪽이다.
const SINO = /(하|되|시키|당하)$/;
const HANGUL = /^[가-힣]+$/;

// 줄 하나를 받아 「형태\t품사」를 줄마다 돌려준다. 줄 사이는 빈 줄로 가른다.
const KIWI = [
    'import sys, json',
    'from kiwipiepy import Kiwi',
    'kiwi = Kiwi()',
    'lines = json.load(sys.stdin)',
    'out = [[[t.form, t.tag] for t in kiwi.tokenize(l)] for l in lines]',
    'sys.stdout.write(json.dumps(out, ensure_ascii=False))',
].join('\n');

function targets(patterns) {
    if (!patterns.length) return SUBJECTS.flatMap((s) => walk(path.join(ROOT, s.dir), {ext: ['.html']}));
    return patterns.flatMap((p) => {
        const hit = fs.globSync(p, {cwd: ROOT}).sort().map((x) => path.resolve(ROOT, x));
        if (!hit.length) console.log(`ERROR audit_lemma: 일치하는 파일 없음: ${p}`);
        return hit;
    });
}

export function run(argv) {
    let all = false, json = null, min = 1;
    const pats = [];
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--all') all = true;
        else if (argv[i] === '--json') json = argv[++i];
        else if (argv[i] === '--min') min = Number(argv[++i]);
        else pats.push(argv[i]);
    }
    const files = targets(pats);
    if (!files.length) { console.log('ERROR audit_lemma: 대상 파일이 없다.'); process.exitCode = 2; return; }

    const lines = [];   // [파일 이름, 줄]
    for (const f of files) {
        const [text] = extract(f);
        for (let line of text.split('\n')) {
            line = line.trim();
            if (line && !line.startsWith('#')) lines.push([path.basename(f), line]);
        }
    }
    const env = {...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8'};
    let proc;
    for (const py of ['python3', 'python']) {
        proc = spawnSync(py, ['-c', KIWI], {input: JSON.stringify(lines.map(([, l]) => l)), encoding: 'utf8', env, maxBuffer: 1 << 30});
        if (!proc.error && proc.status === 0) break;
    }
    if (proc.error || proc.status !== 0) {
        console.log('ERROR audit_lemma: 형태소 분석기를 부르지 못했다. `pip install kiwipiepy` 로 넣는다.');
        console.log('ERROR audit_lemma: 이 도구는 `ci` 가 부르지 않으므로 CI 에는 넣지 않아도 된다.');
        if (proc.stderr) console.log(proc.stderr.trim().split('\n').slice(-3).join('\n'));
        process.exitCode = 2;
        return;
    }
    const toks = JSON.parse(proc.stdout);
    const freq = new Map(), ex = new Map();
    toks.forEach((row, k) => {
        const [name, line] = lines[k];
        for (const [form, tag] of row) {
            if (!VERB_TAGS.has(tag) || !HANGUL.test(form)) continue;
            if (!all && SINO.test(form)) continue;
            freq.set(form, (freq.get(form) || 0) + 1);
            if (!ex.has(form)) ex.set(form, []);
            if (ex.get(form).length < 3 && [...line].length < 140) ex.get(form).push([name, line]);
        }
    });
    console.log(`INFO  audit_lemma: 파일 ${files.length}개 · 용언 표제어 ${freq.size}개`);
    const sorted = [...freq].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    for (const [w, n] of sorted) {
        if (n < min) continue;
        const [where, line] = ex.get(w)[0] || ['', ''];
        console.log(`INFO  audit_lemma:   ${String(n).padStart(5)}  ${w.padEnd(6)}  ${[...where].slice(0, 34).join('')} :: ${[...line].slice(0, 70).join('')}`);
    }
    if (json) {
        fs.writeFileSync(json, JSON.stringify(sorted.map(([w, n]) => ({lemma: w, n, ex: ex.get(w)})), null, 1));
        console.log(`INFO  audit_lemma: → ${json} 에 썼다.`);
    }
    console.log('INFO  audit_lemma: 판정은 사람이 한다 — 갈아 끼우기로 한 말은 tools/checks/verbs.mjs 나 html.mjs 의 목록에 넣어 기계가 지키게 한다.');
}
