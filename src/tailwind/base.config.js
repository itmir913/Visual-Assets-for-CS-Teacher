// 기본 설정. 단위별 CSS는 저마다 `@config "../tailwind/<slug>.config.js"`로
// 자기 것을 가리키므로 이 파일이 쓰이지 않는다.
//
// 그런데도 두는 이유 — 의존 패키지가 딸려 보내는 CSS도 같은 PostCSS 사슬을
// 지나가는데, 그때 content가 비어 있으면 Tailwind가 경고를 낸다.
// 여기서 강의노트 전체를 가리켜 두면 경고가 사라지고, 실제 산출물은 @config 쪽이 정한다.
import { readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../../subjects.json', import.meta.url), 'utf-8'));

export default {
    content: [
        ...cfg.subjects.map((s) => `./${s.dir}/**/*.html`),
        ...cfg.standalone.map((s) => `./${s.dir}/**/*.html`),
        ...cfg.files.map((f) => `./${f.path}`),
    ],
};
