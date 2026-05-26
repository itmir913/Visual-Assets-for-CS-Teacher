// build.js
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
files.forEach(file => {
    const filePath = path.join(makeDir, file);
    console.log(`▶️ 실행 중: make/${file}`);
    try {
        // [경로 문제 해결] cwd 옵션을 주어 각 스크립트가 'make/' 폴더 안에서 실행되도록 작업 디렉터리를 고정합니다.
        execSync(`node "${filePath}"`, {
            stdio: 'inherit',
            cwd: makeDir
        });
        console.log(`✅ 완료: make/${file}\n`);
    } catch (error) {
        console.error(`❌ 에러 발생 (make/${file}):`, error.message);
        // 특정 스크립트에서 에러가 났을 때 전체 빌드를 중단하고 싶다면 아래 주석을 해제하세요.
        // process.exit(1);
    }
});

console.log("🎉 모든 빌드 작업이 끝났습니다!");