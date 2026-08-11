// 굽는 단위 — 무엇을 굽는지는 subjects.json이 혼자 정한다.
// 파이썬 검사 도구(tools/subjects.py)도 같은 파일을 읽는다.
//
// 예전에는 이 목록이 빌드와 두 감사 도구 세 군데에 따로 박혀 있었고 셋이 서로 달랐다.
// 「정보(고등학교)」가 빌드 쪽에만 들어가 있어서 25개 파일이 두 검사에서 통째로
// 빠진 채 한동안 남아 있었다.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// 저장소 루트 — 이 파일은 `tools/vite/`에 있으므로 세 단 위다.
export const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');

const cfg = JSON.parse(readFileSync(resolve(ROOT, 'subjects.json'), 'utf-8'));

/**
 * 과목 다섯 + 시뮬레이터 + index.
 * **단위마다 Tailwind를 한 번씩 굽는다.** 파일마다 굽던 때는 146번이었고 3분 32초가 걸렸다.
 */
export const UNITS = [
    ...cfg.subjects.map((s) => ({ slug: s.slug, dir: s.dir })),
    ...cfg.standalone.map((s) => ({ slug: s.slug, dir: s.dir })),
    ...cfg.files.map((f) => ({ slug: f.slug, file: f.path })),
];

/** 페이지 상대경로가 어느 단위에 속하는지. 어디에도 안 속하면 undefined. */
export function unitOf(rel) {
    return UNITS.find((u) => (u.dir ? rel.startsWith(u.dir + '/') : rel === u.file));
}

/**
 * `transformIndexHtml`이 넘겨주는 경로를 저장소 기준 상대경로로 바꾼다.
 * **dev 서버에서는 URL 인코딩된 상태로 온다** — 폴더 이름이 한글이라 풀지 않으면
 * 어느 단위인지 못 알아본다.
 */
export function relPath(ctx) {
    return decodeURIComponent(ctx.path).replace(/^\//, '');
}

/** 페이지에서 dist 루트로 올라가는 접두어. */
export function upToRoot(rel) {
    return '../'.repeat(rel.split('/').length - 1);
}
