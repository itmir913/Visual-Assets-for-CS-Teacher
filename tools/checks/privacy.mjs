// 개인정보 처리방침이 **아직 참인지** 본다.
//
// `privacy/index.html` 은 바깥에 내놓는 정본이고, 그 안에는 코드에 매인 단정이 넷 있다.
//
//     제4조  브라우저 저장소에 아무것도 남기지 않는다
//     제7조  바깥으로 나가는 요청은 밝힌 것뿐이다
//     제8조  카메라를 쓰는 시뮬레이터는 컴퓨터 비전 하나뿐이다
//     (링크) 첫 화면과 시뮬레이터 입구에서 이 방침으로 가는 길이 있다
//
// **산문은 고쳐도 CI가 보지 않으므로 조용히 거짓이 된다.** 시뮬레이터 하나에
// `localStorage` 한 줄을 넣는 순간 방침이 틀린 말이 되는데, 화면은 멀쩡하고
// 검사는 초록이고 아무도 그 문서를 다시 읽지 않는다. 그래서 여기서 기계가 지킨다.
//
// **여기서 빨간불이 나면 둘 중 하나를 골라야 한다** — 그 코드를 되돌리거나,
// 방침을 고치고 시행일을 새로 적거나. 검사를 느슨하게 푸는 것은 답이 아니다.
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, Report, htmlFiles, read, rel, walk} from '../lib/repo.mjs';

const POLICY = 'privacy/index.html';

// 제4조 — 「쿠키를 심지 않고 브라우저 저장소에 자료를 남기지 않는다」.
const STORAGE_RE = /\b(localStorage|sessionStorage|indexedDB|document\.cookie)\b/g;

// 제7조 — 소스가 스스로 부르는 바깥 요청. 방침의 표에 적힌 것과 같아야 한다.
const FETCH_RE = /fetch\(\s*['"]https?:\/\/([^/'"]+)/g;
const ALLOWED_FETCH_HOSTS = new Set([
    // 첫 화면과 시뮬레이터 입구가 「오프라인 묶음이 언제 만들어졌는지」를 묻는다.
    'api.github.com',
]);

// 제8조 — 카메라를 켜는 페이지. **하나뿐이라는 것이 방침의 단정이다.**
const CAMERA_RE = /\bgetUserMedia\b|\bcreateCapture\s*\(/;
const CAMERA_PAGES = new Set(['simulator/ai/computer-vision-ml5.html']);

// 방침으로 가는 길을 두어야 하는 입구.
const ENTRANCES = {
    'index.html': 'privacy/index.html',
    'simulator/index.html': '../privacy/index.html',
};

export function check() {
    const r = new Report('check_privacy');
    if (!fs.existsSync(path.join(ROOT, POLICY))) {
        r.error(`✗ ${POLICY}이 없다. 사이트가 방침 없이 나간다`);
        return r;
    }
    const files = [...htmlFiles(), ...walk(path.join(ROOT, 'src/entries'), {ext: ['.js']})];
    const cameras = new Set();
    for (const p of files) {
        const f = rel(p), src = read(p);
        for (const m of src.matchAll(STORAGE_RE)) {
            r.error(`  ✗ ${f}: 「${m[1]}」 — 방침 제4조가 「브라우저 저장소에 자료를 남기지 않는다」고 못박았다`);
        }
        for (const m of src.matchAll(FETCH_RE)) {
            if (!ALLOWED_FETCH_HOSTS.has(m[1])) {
                r.error(`  ✗ ${f}: 밝히지 않은 바깥 요청 ${m[1]} — 방침 제7조의 표에 적거나, ` +
                    '괜찮다면 tools/checks/privacy.mjs 의 ALLOWED_FETCH_HOSTS에 적는다');
            }
        }
        if (CAMERA_RE.test(src)) cameras.add(f);
    }
    for (const f of [...cameras].filter((x) => !CAMERA_PAGES.has(x)).sort()) {
        r.error(`  ✗ ${f}: 카메라를 쓴다 — 방침 제8조는 컴퓨터 비전 하나뿐이라고 적었다`);
    }
    for (const f of [...CAMERA_PAGES].filter((x) => !cameras.has(x)).sort()) {
        r.error(`  ✗ ${f}: 카메라를 쓰지 않게 되었다 — 방침 제8조를 그대로 두면 없는 것을 설명한다`);
    }
    for (const [f, href] of Object.entries(ENTRANCES).sort()) {
        const p = path.join(ROOT, f);
        if (!fs.existsSync(p)) r.error(`  ✗ ${f}이 없다 — 방침으로 가는 길을 둘 자리다`);
        else if (!read(p).includes(`href="${href}"`)) r.error(`  ✗ ${f}: 개인정보 처리방침 링크가 없다 (href="${href}")`);
    }
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.length}`);
}
