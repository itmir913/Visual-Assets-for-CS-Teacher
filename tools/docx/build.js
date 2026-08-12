// build.js
// 실행: 저장소 어디서든  node tools/docx/build.js   (-v를 주면 생성기별 출력까지 보인다)
//
// make/ 아래의 .js 를 전부 실행해 .docx 를 생성한다.
// 산출물이 어느 폴더로 나가는지는 outpath.js 의 DEST 표 한 곳에서만 정한다.
const fs = require('fs');
const path = require('path');
const {execSync} = require('child_process');

const makeDir = path.join(__dirname, 'make');
const VERBOSE = process.argv.includes('-v') || process.argv.includes('--verbose');

// 로그 모양은 tools/logs.py와 맞춘다. **이모지를 쓰지 않는다** —
// 로그는 사람이 읽는 만큼 grep으로도 읽힌다.
const log = {
    debug: (m) => { if (VERBOSE) console.log(`DEBUG docx: ${m}`); },
    info: (m) => console.log(`INFO  docx: ${m}`),
    error: (m) => console.log(`ERROR docx: ${m}`),
};

// 1. make 폴더가 존재하는지 확인
if (!fs.existsSync(makeDir)) {
    log.error(`'${makeDir}' 폴더를 찾을 수 없다`);
    process.exit(1);
}

// 2. make 폴더 아래의 모든 .js 파일 읽기 — 하위 폴더까지 내려간다.
//    폴더로 묶은 생성기를 **말없이 건너뛰지 않기 위해** 재귀로 훑는다.
//    예전에는 readdirSync 한 번이라 make/programming/ 을 만들면 30개가 조용히 빠졌다.
const walk = (dir, prefix = '') => fs.readdirSync(dir, {withFileTypes: true})
    .flatMap(e => e.isDirectory()
        ? walk(path.join(dir, e.name), prefix + e.name + '/')
        : (e.name.endsWith('.js') ? [prefix + e.name] : []));
const files = walk(makeDir).sort();

if (files.length === 0) {
    log.info('make/ 폴더에 실행할 생성기가 없다');
    process.exit(0);
}

// 3. 파일 순차 실행
let failed = 0;
files.forEach(file => {
    const filePath = path.join(makeDir, file);
    log.debug(`실행 중 make/${file}`);
    try {
        // 출력 경로는 outpath.js가 저장소 루트 기준 절대 경로로 만들어 주므로
        // cwd는 결과에 영향을 주지 않는다. 상대 require를 위해 그 파일이 있는 폴더로 잡는다.
        //
        // 생성기가 찍는 「완료: …」 줄은 기본으로 삼킨다. 40개면 40줄이 되는데
        // 그 줄들이 실제로 알려 주는 것은 실패했을 때뿐이고, 그때는 아래에서 전부 내보낸다.
        const out = execSync(`node "${filePath}"`, {
            stdio: ['ignore', 'pipe', 'pipe'],
            cwd: path.dirname(filePath),
            encoding: 'utf8',
        });
        out.split('\n').filter(Boolean).forEach(l => log.debug(`  ${l}`));
    } catch (error) {
        log.error(`make/${file} 실패 — ${String(error.message).split('\n')[0]}`);
        const dump = `${error.stdout || ''}${error.stderr || ''}`.trim();
        if (dump) dump.split('\n').forEach(l => log.error(`  ${l}`));
        failed += 1;
    }
});

// 한 개라도 실패하면 0이 아닌 코드로 끝낸다. CI에서 조용히 넘어가지 않게 하기 위함이다.
log.info(`완료 — 생성기 ${files.length}, 실패 ${failed}`);
if (failed > 0) process.exit(1);
