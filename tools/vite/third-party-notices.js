// 번들에 들어간 제3자 패키지의 라이선스 고지를 `THIRD-PARTY-NOTICES.txt`로 굽는다.
//
// MIT·ISC·BSD·Apache·OFL·CC-BY는 하나같이 **재배포본에 저작권 표시와 라이선스 전문을
// 함께 넣으라**고 요구한다. 오프라인 zip은 명백한 재배포이므로, 이 파일이 없으면
// 남의 라이선스를 어긴 채로 배포하는 것이 된다.
//
// **목록을 손으로 적지 않는다.** 롤업의 모듈 그래프에서 실제로 번들에 들어간 것만 추린다.
// 손으로 적으면 의존성이 바뀔 때 조용히 낡고, 무엇보다 전이 의존성을 빠뜨린다 —
// d3가 끌어오는 d3-* 서브패키지 서른 남짓이 그렇게 통째로 빠진다.
// 빌드 도구(vite·tailwind·postcss)는 앱 코드가 import 하지 않아 그래프에 없으므로,
// 빼려고 따로 애쓸 필요가 없다.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, sep } from 'node:path';

import { ROOT } from './units.js';
import { VENDOR } from './vendor-public.js';

const NOTICE_FILE = 'THIRD-PARTY-NOTICES.txt';

// 라이선스 전문이 담긴 파일의 흔한 이름들. 대소문자를 가리지 않는다.
const LICENSE_RE = /^(licen[cs]e|copying|notice)([-.].*)?$/i;

// 모듈 그래프에 안 잡히지만 산출물에는 들어가는 것 — `public/`으로 원본 그대로 실려 나가는
// 파일들이다(tools/vite/vendor-public.js). import 문이 없으니 그래프에도 없다.
//
// **여기를 손으로 적지 않고 VENDOR를 직접 읽는다.** p5처럼 라이선스 때문에 번들에서
// 일부러 뺀 것은, 빼는 순간 그래프에서도 사라져 **배포는 되는데 고지만 없어진다.**
// 실어 나르는 목록과 고지하는 목록이 같은 곳을 보게 묶어 둔다.
const EXTRA = VENDOR.map((v) => pkgNameFromId(v.from)).filter(Boolean);

// CSS의 `@import`로 들어오는 것은 **롤업 모듈 그래프에 안 잡힌다.** CSS 변환 단계에서
// 통째로 인라인되기 때문이다. 그런데 이쪽으로 들어오는 것이 하필 글꼴과 아이콘 —
// Font Awesome(CC-BY-4.0)과 Pretendard(OFL-1.1)처럼 **저작자 표시 요구가 가장 강한
// 것들**이다. 그래서 소스 CSS의 @import를 따로 훑는다.
const CSS_IMPORT_RE = /@import\s+["']([^"']+)["']/g;

/** 소스 CSS가 @import 하는 npm 패키지 이름을 모은다. 상대 경로와 URL은 건너뛴다. */
function cssImportedPackages() {
    const names = new Set();
    let files;
    try {
        files = readdirSync(resolve(ROOT, 'src'), { recursive: true });
    } catch {
        return names;
    }
    for (const f of files) {
        const rel = String(f).split(sep).join('/');
        if (!rel.endsWith('.css')) continue;
        const css = readFileSync(resolve(ROOT, 'src', rel), 'utf8');
        for (const [, spec] of css.matchAll(CSS_IMPORT_RE)) {
            if (spec.startsWith('.') || spec.startsWith('/') || spec.includes('://')) continue;
            const parts = spec.split('/');
            names.add(parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0]);
        }
    }
    return names;
}

/** 모듈 id에서 패키지 이름을 뽑는다. 중첩 node_modules는 가장 안쪽이 그 모듈의 주인이다. */
function pkgNameFromId(id) {
    const norm = id.split(sep).join('/');
    const i = norm.lastIndexOf('node_modules/');
    if (i === -1) return null;
    const rest = norm.slice(i + 'node_modules/'.length).split('/').filter(Boolean);
    if (!rest.length) return null;
    return rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0];
}

/** 패키지 폴더에서 라이선스 전문을 찾아 읽는다. 없으면 null.
 *
 * **루트만 보면 안 된다.** Pretendard는 전문을 `dist/LICENSE.txt`에 넣어 배포한다.
 * 루트에서 못 찾으면 한 겹 아래까지 내려간다 — 그보다 깊이 숨기는 패키지는 없고,
 * 더 파고들면 엉뚱한 파일을 물어 온다.
 */
function readLicenseText(dir, depth = 1) {
    let entries;
    try {
        entries = readdirSync(dir, { withFileTypes: true });
    } catch {
        return null;
    }

    const hits = entries.filter((e) => e.isFile() && LICENSE_RE.test(e.name))
        .map((e) => e.name)
        .sort();

    if (hits.length) {
        return hits.map((n) => {
            const body = readFileSync(resolve(dir, n), 'utf8').trim();
            return hits.length > 1 ? `[${n}]\n${body}` : body;
        }).join('\n\n');
    }

    if (depth <= 0) return null;
    for (const e of entries) {
        if (!e.isDirectory() || e.name === 'node_modules') continue;
        const found = readLicenseText(resolve(dir, e.name), depth - 1);
        if (found) return `[${e.name}/]\n${found}`;
    }
    return null;
}

function describe(name) {
    const dir = resolve(ROOT, 'node_modules', name);
    const metaPath = resolve(dir, 'package.json');
    if (!existsSync(metaPath)) return null;
    const meta = JSON.parse(readFileSync(metaPath, 'utf8'));

    const license = meta.license
        ?? (Array.isArray(meta.licenses) ? meta.licenses.map((l) => l.type).join(' OR ') : null);
    const repo = typeof meta.repository === 'string' ? meta.repository : meta.repository?.url;

    return {
        name,
        version: meta.version ?? '(버전 미상)',
        license: license ?? '(package.json에 라이선스 필드가 없다)',
        homepage: meta.homepage ?? null,
        repository: repo ? repo.replace(/^git\+/, '').replace(/\.git$/, '') : null,
        author: typeof meta.author === 'string' ? meta.author : meta.author?.name ?? null,
        text: readLicenseText(dir),
    };
}

function render(entries) {
    const head = [
        '이 배포본에는 아래의 제3자 오픈소스 소프트웨어가 포함되어 있습니다.',
        '각 소프트웨어의 저작권은 해당 원저작자에게 있으며, 아래 라이선스 조건에 따라 배포됩니다.',
        '',
        '강의노트 자체의 라이선스는 이 파일이 아니라 저장소의 LICENSE 파일을 보십시오.',
        '',
        '이 파일은 빌드할 때 번들에 실제로 들어간 패키지만 골라 자동으로 만듭니다.',
        '(tools/vite/third-party-notices.js — 손으로 고치지 마십시오)',
        '',
        `포함된 패키지: ${entries.length}개`,
        '',
        '목차',
        ...entries.map((e) => `  - ${e.name}@${e.version} — ${e.license}`),
        '',
    ].join('\n');

    const bodies = entries.map((e) => {
        const meta = [
            `패키지: ${e.name}@${e.version}`,
            `라이선스: ${e.license}`,
            e.author ? `저작자: ${e.author}` : null,
            e.homepage ? `홈페이지: ${e.homepage}` : null,
            e.repository ? `소스: ${e.repository}` : null,
        ].filter(Boolean).join('\n');

        // 전문을 못 찾은 패키지는 **숨기지 않고 그렇다고 적는다.**
        // 조용히 빠지면 고지를 빠뜨린 채로 배포하게 된다.
        const text = e.text ?? [
            '(이 패키지는 라이선스 전문 파일을 동봉하지 않았습니다.',
            ` 위 라이선스 식별자(${e.license})의 표준 전문과 위 소스 주소를 확인해 주십시오.)`,
        ].join('\n');

        return `${'='.repeat(72)}\n${meta}\n${'-'.repeat(72)}\n\n${text}\n`;
    });

    return `${head}\n${bodies.join('\n')}`;
}

export default function thirdPartyNotices() {
    return {
        name: 'third-party-notices',
        apply: 'build',
        generateBundle() {
            const names = new Set([...EXTRA, ...cssImportedPackages()]);
            for (const id of this.getModuleIds()) {
                const n = pkgNameFromId(id);
                if (n) names.add(n);
            }

            const entries = [];
            const missing = [];
            for (const name of [...names].sort()) {
                const e = describe(name);
                if (!e) continue; // node_modules에 없는 가상 모듈 등
                entries.push(e);
                if (!e.text) missing.push(name);
            }

            this.emitFile({ type: 'asset', fileName: NOTICE_FILE, source: render(entries) });
            this.info(`제3자 라이선스 고지 ${entries.length}개 → ${NOTICE_FILE}`);
            if (missing.length) {
                this.warn(`라이선스 전문을 못 찾은 패키지 ${missing.length}개: ${missing.join(', ')}`);
            }
        },
    };
}
