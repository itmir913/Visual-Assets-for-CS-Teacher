// 검사가 함께 쓰는 바탕 — 저장소 루트 · 과목 목록 · 파일 목록 · 결과 모양.
//
// **무엇을 굽는지는 `subjects.json` 이 혼자 정한다.** 빌드(`tools/vite/units.js`)와 검사가
// 같은 파일을 읽는다. 예전에는 과목 목록이 빌드와 감사 도구 세 군데에 따로 박혀 있었고,
// 「정보(고등학교)」가 빌드 쪽에만 들어가 25개 파일이 검사에서 통째로 빠진 채 남아 있었다.
//
// ## 출력 모양 — `Report` 하나가 정한다
//
// 옛 파이썬 로거의 모양(`수준 이름: 내용`)을 잇는다. **이모지를 쓰지 않는다** — 로그는
// 사람이 읽는 만큼 `grep` 으로도 읽힌다.
//
//     ERROR check_html: 프로그래밍/py/01-변수와-자료형.html:232 [제목 일치] 제목이 어긋난다
//     WARN  check_code: gcc가 없어 .c 구문 검사를 건너뛴다
//     INFO  check_html: 완료 — 파일 125, 위반 0, 확인 필요 0
//
//     ERROR  위반. 종료 코드를 1로 만든다
//     WARN   확인 필요. 사람이 판정할 것(종료 코드는 0)
//     INFO   끝맺음 한 줄. 어느 검사든 마지막에 하나 찍는다
//     DEBUG  파일별 `OK` 같은 「문제없음」의 반복. `-v` 일 때만
//
// **파일을 짚어 부르면 `-v` 없이도 `DEBUG` 가 켜진다**(`tests/_check.mjs`). 한 파일을 보려고
// 부른 사람은 항목마다 통과했는지 보고 싶은 것이고, 저장소 전체를 도는 CI 에서는 그 반복이
// 초록불을 수백 줄로 만든다. 표가 곧 결과물인 도구(`audit -- pre` · `prose`)는 이 모양을 쓰지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'subjects.json'), 'utf8'));

/** 강의노트 과목. dir / slug / theme */
export const SUBJECTS = CFG.subjects;
/** 강의노트는 아니지만 함께 배포되는 폴더(시뮬레이터 등). */
export const STANDALONE = CFG.standalone;
/** 최소 글자 크기 검사를 건너뛰는 폴더. **비어 있는 것이 목표다.** */
export const FONT_EXEMPT = CFG.font_exempt || [];
export const DIRS = [...SUBJECTS, ...STANDALONE].map((u) => u.dir);
export const FILES = CFG.files.map((p) => p.path);

/** 저장소 기준 상대 경로(`/` 구분). */
export const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

/** 상대 경로가 어느 과목에 속하는지. 어디에도 안 속하면 undefined. */
export function subjectOf(relPath) {
    const first = relPath.split('/')[0];
    return SUBJECTS.find((s) => s.dir === first);
}

/** 폴더 아래 파일 전부(재귀, 정렬). `skip` 이 참을 돌려주는 폴더 이름은 들어가지 않는다. */
export function walk(dir, {ext, skip = () => false} = {}) {
    const out = [];
    if (!fs.existsSync(dir)) return out;
    const go = (d) => {
        for (const e of fs.readdirSync(d, {withFileTypes: true})) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) { if (!skip(e.name)) go(p); }
            else if (!ext || ext.some((x) => e.name.toLowerCase().endsWith(x))) out.push(p);
        }
    };
    go(dir);
    return out.sort(byPath);
}

/** 파이썬 `sorted(Path)` 와 같은 차례 — 경로 조각을 코드 포인트로 비교한다. */
export function byPath(a, b) {
    const x = a.split(/[\\/]/), y = b.split(/[\\/]/);
    for (let i = 0; i < Math.min(x.length, y.length); i++) {
        if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    }
    return x.length - y.length;
}

/**
 * DIRS + FILES 에 해당하는 HTML 전부. 빌드와 검사가 같은 목록을 본다.
 * **단위는 겹칠 수 있으므로 중복을 없앤다.**
 */
export function htmlFiles() {
    const out = [], seen = new Set();
    for (const d of DIRS) {
        for (const p of walk(path.join(ROOT, d), {ext: ['.html']})) {
            if (!seen.has(p)) { seen.add(p); out.push(p); }
        }
    }
    for (const f of FILES) {
        const p = path.join(ROOT, f);
        if (fs.existsSync(p) && !seen.has(p)) { seen.add(p); out.push(p); }
    }
    return out;
}

/** 파일 글. 줄바꿈은 `\n` 하나로 맞춘다 — 윈도에서 받은 파일(`\r\n`)도 같은 결과를 내야 한다. */
export const read = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n?/g, '\n');

/** 줄 번호(1부터). */
export const lineOf = (text, idx) => {
    let n = 1;
    for (let i = text.indexOf('\n'); i !== -1 && i < idx; i = text.indexOf('\n', i + 1)) n++;
    return n;
};

/**
 * 검사 결과. `errors` 가 비어 있지 않으면 실패다. `warnings` 는 사람이 판정할 것,
 * `notes` 는 「문제없음」의 반복 같은 자세한 줄(파일을 짚어 부르면 보인다).
 */
export class Report {
    constructor(name) { this.name = name; this.errors = []; this.warnings = []; this.notes = []; this.summary = ''; }
    error(m) { this.errors.push(m); }
    warn(m) { this.warnings.push(m); }
    note(m) { this.notes.push(m); }
    done(m) { this.summary = m; return this; }
    /** 로그 모양은 옛 파이썬 로거(`ERROR name: …`)를 그대로 따른다 — `grep` 으로도 읽힌다. */
    print({verbose = false} = {}) {
        const out = [];
        if (verbose) for (const m of this.notes) out.push(`DEBUG ${this.name}: ${m}`);
        for (const m of this.warnings) out.push(`WARN  ${this.name}: ${m}`);
        for (const m of this.errors) out.push(`ERROR ${this.name}: ${m}`);
        if (this.summary) out.push(`INFO  ${this.name}: ${this.summary}`);
        if (out.length) console.log(out.join('\n'));
        return this;
    }
}

/** `npm run check -- <이름> <인자…>` 의 인자. 러너가 환경 변수로 넘긴다. */
export function checkArgs() {
    try { return JSON.parse(process.env.CHECK_ARGS || '[]'); } catch { return []; }
}

// 파이썬 `\w` · `\b` 는 유니코드를 보지만 JS 는 ASCII 만 본다. 한국어를 다루는 정규식은
// 이 조각으로 쓴다(`u` 플래그와 함께).
export const W = '[\\p{L}\\p{N}_]';
export const B_BEFORE = '(?<![\\p{L}\\p{N}_])';
export const B_AFTER = '(?![\\p{L}\\p{N}_])';
