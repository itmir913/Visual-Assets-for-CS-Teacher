// 첫 화면(`index.html`)과 강의노트가 **서로를 놓치지 않았는지** 본다.
//
//     1. `index.html` 이 거는 저장소 안 주소가 **실제로 있는 파일인지**
//     2. 과목 폴더의 강의노트 가운데 **`index.html` 이 한 번도 걸지 않은 것이 있는지**
//
// 강의노트 이름을 바꾸면 첫 화면의 링크가 함께 바뀌어야 한다. 한쪽만 바뀌어도 빌드는
// 멀쩡히 끝나고 화면도 멀쩡해 보인다 — 끊긴 링크는 **누르기 전에는 모르고**, 걸리지
// 않은 강의노트는 **학생에게 가는 길이 없는데 아무도 알려 주지 않는다.**
//
// 시뮬레이터 쪽 고아는 `sim-index` 검사가 본다. 여기서는 과목 폴더만 본다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, SUBJECTS, Report, read, rel, walk} from '../lib/repo.mjs';

const INDEX = 'index.html';

// 소스에는 없고 빌드가 굽는 파일. 산출물에 있는지는 `dist` 검사가 본다.
const BUILT = new Set(['THIRD-PARTY-NOTICES.txt']);

// 일부러 첫 화면에 걸지 않는 강의노트. **왜 걸지 않는지와 함께** 적는다.
const UNLINKED_OK = {};

/** 저장소 안을 가리키는 href — 바깥 주소 · 같은 문서 안 앵커 · mailto 는 뺀다. */
export function localTargets(html) {
    const out = [];
    for (const [, href] of html.matchAll(/\bhref="([^"]+)"/g)) {
        if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#') || href.startsWith('//')) continue;
        const p = decodeURIComponent(href.split('#')[0].split('?')[0]);
        if (p) out.push(p);
    }
    return out;
}

export function check() {
    const r = new Report('check_index_links');
    const targets = localTargets(read(path.join(ROOT, INDEX)));
    const linked = new Set();
    for (const t of targets) {
        let p = path.resolve(ROOT, t.replace(/^\/+/, ''));
        if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
        if (!fs.existsSync(p) && !BUILT.has(path.basename(p))) r.error(`  ✗ ${INDEX}: 없는 파일을 건다 (href="${t}")`);
        linked.add(p);
    }
    let notes = 0;
    for (const s of SUBJECTS) {
        for (const p of walk(path.join(ROOT, s.dir), {ext: ['.html']})) {
            notes++;
            if (!linked.has(p) && !(rel(p) in UNLINKED_OK)) {
                r.error(`  ✗ ${rel(p)}: ${INDEX}에서 가는 링크가 없다` +
                    ' (일부러 그렇다면 tools/checks/index-links.mjs 의 UNLINKED_OK에 까닭과 함께 적는다)');
            }
        }
    }
    for (const f of Object.keys(UNLINKED_OK).sort()) {
        const p = path.join(ROOT, f);
        if (!fs.existsSync(p)) r.error(`  ✗ UNLINKED_OK에 적힌 파일이 없다: ${f}`);
        else if (linked.has(p)) r.error(`  ✗ UNLINKED_OK에 적혔는데 ${INDEX}가 건다 — 목록에서 뺀다: ${f}`);
    }
    return r.done(`완료 — 링크 ${targets.length}, 강의노트 ${notes}, 위반 ${r.errors.length}`);
}
