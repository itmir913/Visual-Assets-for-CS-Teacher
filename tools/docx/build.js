// build.js
// 실행: 저장소 어디서든  node tools/docx/build.js
//
// make/*.js 를 전부 실행해 .docx 를 생성한다.
// 산출물이 어느 폴더로 나가는지는 outpath.js 의 DEST 표 한 곳에서만 정한다.
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const makeDir = path.join(__dirname, 'make');

// 1. make 폴더가 존재하는지 확인
if (!fs.existsSync(makeDir)) {
    console.error(`❌ '${makeDir}' 폴더를 찾을 수 없습니다.`);
    process.exit(1);
}

// 2. make 폴더 아래의 모든 .js 파일 읽기 — 하위 폴더까지 내려간다.
//    폴더로 묶은 생성기를 **말없이 건너뛰지 않기 위해** 재귀로 훑는다.
//    예전에는 readdirSync 한 번이라 make/실습/ 을 만들면 30개가 조용히 빠졌다.
const walk = (dir, prefix = '') => fs.readdirSync(dir, {withFileTypes: true})
    .flatMap(e => e.isDirectory()
        ? walk(path.join(dir, e.name), prefix + e.name + '/')
        : (e.name.endsWith('.js') ? [prefix + e.name] : []));
const files = walk(makeDir).sort();

if (files.length === 0) {
    console.log("ℹ️ make/ 폴더에 실행할 JS 파일이 없습니다.");
    process.exit(0);
}

console.log(`🚀 총 ${files.length}개의 스크립트를 실행합니다...\n`);

// 3. 파일 순차 실행
let failed = 0;
files.forEach(file => {
    const filePath = path.join(makeDir, file);
    console.log(`▶️ 실행 중: make/${file}`);
    try {
        // 출력 경로는 outpath.js가 저장소 루트 기준 절대 경로로 만들어 주므로
        // cwd는 결과에 영향을 주지 않는다. 상대 require를 위해 그 파일이 있는 폴더로 잡는다.
        execSync(`node "${filePath}"`, {
            stdio: 'inherit',
            cwd: path.dirname(filePath)
        });
        console.log(`✅ 완료: make/${file}\n`);
    } catch (error) {
        console.error(`❌ 에러 발생 (make/${file}):`, error.message);
        failed += 1;
    }
});

if (failed > 0) {
    // 한 개라도 실패하면 0이 아닌 코드로 끝낸다. CI에서 조용히 넘어가지 않게 하기 위함이다.
    console.error(`\n❌ ${failed}개 스크립트가 실패했습니다.`);
    process.exit(1);
}

console.log("🎉 모든 빌드 작업이 끝났습니다!");
