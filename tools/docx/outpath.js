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

const DEST = {
    ai: 'templates/ai',
    py: 'templates/py',
    c: 'templates/c',
};

module.exports = function out(group, filename) {
    const dir = DEST[group];
    if (!dir) {
        throw new Error(`알 수 없는 산출물 그룹: '${group}' (가능: ${Object.keys(DEST).join(', ')})`);
    }
    const abs = path.join(REPO_ROOT, dir, filename);
    fs.mkdirSync(path.dirname(abs), {recursive: true});
    return abs;
};
