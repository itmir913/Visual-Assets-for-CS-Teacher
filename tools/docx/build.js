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

// 2. make 폴더 내의 모든 .js 파일 읽기
const files = fs.readdirSync(makeDir).filter(file => file.endsWith('.js'));

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
        // cwd는 결과에 영향을 주지 않는다. make/ 안의 상대 require를 위해서만 고정한다.
        execSync(`node "${filePath}"`, {
            stdio: 'inherit',
            cwd: makeDir
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
