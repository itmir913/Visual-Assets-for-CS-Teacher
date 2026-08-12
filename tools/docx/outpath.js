// outpath.js
// 산출물이 어느 폴더로 나가는지는 여기 한 곳에서만 정한다.
// 폴더를 옮길 때 아래 DEST 표만 고치면 make/ 아래 생성기는 건드릴 필요가 없다.
//
// 사용: const out = require('../outpath');
//       makeDocument({...}, out('programming', '비만도-측정.py.docx'));

const fs = require('fs');
const path = require('path');

// 이 파일 기준으로 저장소 루트를 잡는다. 스크립트를 어느 폴더에서 실행하든 결과가 같다.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// 기본 출력 루트는 dist/다. 산출물은 저장소에 담지 않으므로 소스 트리로 떨어질
// 이유가 없다. 그래서 배포 빌드는 아무것도 넘기지 않는다 — 예전에는 npm 스크립트에서
// DOCX_OUT_ROOT를 넘겼는데 Windows에서 먹지 않아 기본값 쪽으로 옮겼다.
// 환경변수는 다른 자리에 뽑아 볼 때를 위해 남겨 둔다.
const OUT_ROOT = process.env.DOCX_OUT_ROOT
    ? path.resolve(process.env.DOCX_OUT_ROOT)
    : path.join(REPO_ROOT, 'dist');

// 산출물은 그것을 링크하는 강의노트 바로 옆에 둔다. 그러면 링크에 ../가 없어
// 파일이 옮겨져도 안 깨지고, 과목 폴더가 자기 자산을 갖게 된다.
// docx/ 라는 이름의 폴더는 전부 생성물이다 — 저장소 .gitignore가 그렇게 잡고 있다.
const DEST = {
    ai: '인공지능기초/실습/docx',
    // 그룹 이름은 **과목**이다. 어느 과목의 산출물인지 이름만 보고 알아야 한다.
    // 프로그래밍은 py·c를 한 폴더에 담고 파일 이름의 `.py.`·`.c.`로 가른다 —
    // 강의노트가 언어별로 나뉘지 않으므로 폴더를 나눌 이유가 없다.
    programming: '프로그래밍/실습/docx',
};

module.exports = function out(group, filename) {
    const dir = DEST[group];
    if (!dir) {
        throw new Error(`알 수 없는 산출물 그룹: '${group}' (가능: ${Object.keys(DEST).join(', ')})`);
    }
    const abs = path.join(OUT_ROOT, dir, filename);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    return abs;
};
