// 모든 강의노트에서 <pre>/<code> 가로 넘침 위험을 정적 점검한다.
//
// <pre> 는 기본 white-space:pre 라서 긴 줄이 줄바꿈되지 않고 화면 밖으로 나간다.
// 방어 수단은 셋 중 하나 이상:
//   (a) CSS 에서 pre 에 white-space: pre-wrap (+ word-break/overflow-wrap)
//   (b) pre 를 overflow-x-auto 컨테이너로 감싸기 (넘치되 그 안에서 스크롤)
//   (c) pre 자체에 overflow-x-auto
import {htmlFiles, read, rel} from '../lib/repo.mjs';

export function run() {
    const rows = [];
    for (const p of htmlFiles()) {
        const src = read(p);
        const pres = [...src.matchAll(/<pre\b/g)].map((m) => m.index);
        if (!pres.length) continue;
        const style = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
        // (a) CSS 에서 pre 에 pre-wrap 지정?
        const cssWrap = /(^|[,{\s])pre\b[^{}]*\{[^}]*white-space:\s*pre-wrap/.test(style) || /white-space:\s*pre-wrap/.test(style);
        const cssOverflow = /(^|[,{\s])pre\b[^{}]*\{[^}]*overflow-x:\s*auto/.test(style);
        // (b)/(c) 각 <pre> 별로 래퍼/자체 클래스 확인
        let risky = 0;
        for (const at of pres) {
            const tag = src.slice(at, src.indexOf('>', at) + 1);
            const before = src.slice(Math.max(0, at - 400), at).split('</div>').at(-1);
            const wrapped = before.includes('overflow-x-auto') || before.includes('overflow-auto');
            const selfOk = ['overflow-x-auto', 'whitespace-pre-wrap', 'break-all'].some((c) => tag.includes(c));
            if (!(wrapped || selfOk)) risky++;
        }
        rows.push([rel(p), pres.length, risky, cssWrap, cssOverflow]);
    }
    console.log(`${'파일'.padEnd(52)} ${'pre'.padStart(4)} ${'위험'.padStart(4)}  CSS방어`);
    console.log('-'.repeat(88));
    let bad = 0;
    for (const [name, n, risky, cw, co] of rows) {
        const guard = [cw && 'pre-wrap', co && 'overflow-x'].filter(Boolean);
        const ok = cw || co || risky === 0;
        if (!ok) bad++;
        console.log(`${ok ? '  ' : '⚠ '}${name.padEnd(50)} ${String(n).padStart(4)} ${String(risky).padStart(4)}  ${guard.join(',') || '없음'}`);
    }
    console.log('-'.repeat(88));
    console.log(`<pre> 사용 파일 ${rows.length}개 중 방어 수단 없는 파일 ${bad}개`);
}
