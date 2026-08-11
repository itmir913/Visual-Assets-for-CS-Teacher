// outpath.js
// 산출물이 어느 폴더로 나가는지는 여기 한 곳에서만 정한다.
// 폴더를 옮길 때 아래 DEST 표만 고치면 make/*.js 39개는 건드릴 필요가 없다.
//
// 사용: const out = require('../outpath');
//       makeDocument({...}, out('py', '3-2-1.docx'));

const fs = require('fs');
const path = require('path');

// 이 파일 기준으로 저장소 루트를 잡는다. 스크립트를 어느 폴더에서 실행하든 결과가 같다.
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// 기본 출력 루트는 dist/다. 산출물은 저장소에 담지 않으므로 소스 트리로 떨어질
// 이유가 없다. 환경변수를 쓰던 방식은 Windows의 npm 스크립트에서 먹지 않아 버렸다.
const OUT_ROOT = process.env.DOCX_OUT_ROOT
    ? path.resolve(process.env.DOCX_OUT_ROOT)
    : path.join(REPO_ROOT, 'dist');

// 산출물은 그것을 링크하는 강의노트 바로 옆에 둔다. 그러면 링크에 ../가 없어
// 파일이 옮겨져도 안 깨지고, 과목 폴더가 자기 자산을 갖게 된다.
// docx/ 라는 이름의 폴더는 전부 생성물이다 — 저장소 .gitignore가 그렇게 잡고 있다.
const DEST = {
    ai: '인공지능기초/ai-projects/docx',
    // 프로그래밍은 C·Python 통합 때 함께 옮긴다. 지금 옮기면 링크를 두 번 고치게 된다.
    py: 'templates/py',
    c: 'templates/c',
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
