// 375px 에서 «본문 글자가 실제로 몇 px 폭에 놓이는가»를 계산한다.
//
//     npm run audit -- narrow                      # 저장소 전체
//     npm run audit -- narrow 데이터과학/1-1-1.….html
//     npm run audit -- narrow --limit 260          # 기준을 바꿔 본다
//
// 브라우저를 띄우지 않는다. 조상들의 좌우 여백과, flex · grid 형제가 먼저 가져가는
// 폭을 차례로 빼서 «남는 폭»을 낸다. md: · lg: 접두사가 붙은 클래스는 375px 에서
// 적용되지 않으므로 보지 않는다.
//
// **이것은 감사이지 검사가 아니다.** 추정이라 몇 px 씩 어긋나고, `ci` 에 넣으면
// 글을 조금 늘렸다는 이유로 빨간불이 된다. 되돌아오면 안 되는 두 자리
// (.section-card 여백 · <main> 여백)만 `html` 검사가 지킨다.
//
// 셈이 틀리기 쉬운 자리를 셋 밟았고, 셋 다 여기 반영되어 있다.
//   - 폭이 안 적힌 flex 형제를 «자란다»고 보면 뱃지 한 칸짜리 열이 절반을 가져간다
//     → flex-1 · grow 가 붙은 것만 자란다고 본다
//   - `!p-6` 은 .section-card 의 여백을 «지운다». 둘 다 빼면 시뮬레이터가 헛걸린다
//   - 아이콘 칸은 폭 클래스가 제 몸이 아니라 안쪽 <span> 에 붙어 있기도 하다
import fs from 'node:fs';
import path from 'node:path';
import {ROOT, byPath, lineOf, read, rel, walk} from '../lib/repo.mjs';

const VIEWPORT = 375;
const SPACING = 4;       // Tailwind 한 칸 = 0.25rem
const NARROW = 200;      // 이 아래면 본문이 토막 난다
const MIN_CHARS = 80;    // 이만큼은 되어야 «본문»이다

const TAG = /<(\/?)(div|section|main|article|aside|li|td|th|p|h[1-6])\b([^>]*)>/gi;
const CLS = /class="([^"]*)"/;
const VOIDEND = /\/>\s*$/;
const PAD = /(?<![-\w:])!?p([xlr]?)-(\d+(?:\.\d+)?)\b/g;
const GAP = /(?<![-\w:])(?:gap|gap-x|space-x)-(\d+(?:\.\d+)?)\b/;
const WID = /(?<![-\w:])w-(\d+(?:\.\d+)?)\b/;
const COLS = /(?<![-\w:])grid-cols-(\d+)\b/;
const MAXW = /(?<![-\w:])max-w-(\w+)\b/;
const GROW = /(?<![-\w:])(?:flex-1|grow|basis-0|w-full|flex-auto)\b/;
const BANG_PAD = /!p[xlr]?-\d/;
const MAXW_PX = {xs: 320, sm: 384, md: 448, lg: 512, xl: 576, '2xl': 672, '3xl': 768, '4xl': 896,
    '5xl': 1024, '6xl': 1152, '7xl': 1280, prose: 656, full: 1e9, none: 1e9};

/** 좌우로 먹는 여백의 합. */
function hPadding(cls) {
    let total = 0;
    for (const [, side, n] of cls.matchAll(PAD)) {
        const v = parseFloat(n) * SPACING;
        total += side === '' || side === 'x' ? v * 2 : v;
    }
    return total;
}
const fixedW = (cls) => { const m = cls.match(WID); return m ? parseFloat(m[1]) * SPACING : null; };
// 파이썬 `round` 와 같이 반은 짝수 쪽으로.
const roundHalfEven = (x) => { const f = Math.floor(x), d = x - f; return d > 0.5 || (d === 0.5 && f % 2 === 1) ? f + 1 : f; };
const stripTags = (s) => s.replace(/<[^>]+>/g, '');

/** .section-card 가 좁은 화면에서 실제로 쓰는 좌우 여백(한쪽). */
function cardPadding(src) {
    const m = src.match(/\.section-card\s*\{[^}]*padding:\s*([^;]+);/);
    if (!m) return 0;
    const v = m[1].trim();
    const c = v.match(/^clamp\(\s*([\d.]+)rem/);
    if (c) return parseFloat(c[1]) * 16;
    const f = v.match(/^([\d.]+)rem/);
    return f ? parseFloat(f[1]) * 16 : 0;
}
function mainPadding(src) {
    const m = src.match(/<main\s[^>]*class="([^"]*)"/);
    return m ? hPadding(m[1]) / 2 : 0;
}

/** [폭, 행, 까닭, 글머리] — 문서 순서로 낸다. */
export function scan(file, limit = NARROW, minChars = MIN_CHARS) {
    const src = read(file);
    const i0 = src.indexOf('<main');
    if (i0 < 0) return [];
    const body = src.slice(i0), headLines = (src.slice(0, i0).match(/\n/g) || []).length;
    const cardPad = cardPadding(src), mainPx = mainPadding(src);

    const nodes = [], st = [];
    for (const m of body.matchAll(TAG)) {
        const tag = m[2].toLowerCase();
        if (m[1]) {
            while (st.length) {
                const i = st.pop();
                if (nodes[i].tag === tag) { nodes[i].close = m.index; break; }
            }
            continue;
        }
        if (VOIDEND.test(m[3])) continue;
        const c = m[3].match(CLS);
        nodes.push({parent: st.length ? st.at(-1) : -1, cls: c ? c[1] : '', tag, s: m.index, e: m.index + m[0].length, close: body.length});
        st.push(nodes.length - 1);
    }
    const kids = new Map();
    nodes.forEach((n, i) => { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(i); });
    const kidsOf = (i) => kids.get(i) || [];

    const cssW = {};
    for (const m of src.slice(0, i0).matchAll(/\.([\w-]+)\s*\{([^}]*)\}/g)) {
        const wm = m[2].match(/(?<!-)width:\s*([\d.]+)(px|rem)/);
        if (wm) cssW[m[1]] = parseFloat(wm[1]) * (wm[2] === 'rem' ? 16 : 1);
    }
    const words = (cls) => cls.split(/\s+/).filter(Boolean);

    /** 자라지 않는 칸이 차지하는 폭. 못 알아내면 뱃지 한 칸(44px)으로 본다. */
    function intrinsic(i) {
        const own = fixedW(nodes[i].cls);
        if (own !== null) return own;
        for (const c of words(nodes[i].cls)) if (c in cssW) return cssW[c];
        let best = 0;
        const stack = [...kidsOf(i)];
        while (stack.length) {
            const j = stack.pop();
            const w = fixedW(nodes[j].cls);
            if (w) best = Math.max(best, w);
            for (const c of words(nodes[j].cls)) if (c in cssW) best = Math.max(best, cssW[c]);
            stack.push(...kidsOf(j));
        }
        return best > 4 ? best : 44;
    }

    const width = new Map();
    function inner(i) {
        if (width.has(i)) return width.get(i);
        const p = nodes[i].parent, cls = nodes[i].cls;
        let avail = p >= 0 ? inner(p) : VIEWPORT;
        if (p >= 0) {
            const pcls = nodes[p].cls, sibs = kidsOf(p);
            const gm = pcls.match(GAP);
            const gap = gm ? parseFloat(gm[1]) * SPACING : 0;
            const cm = pcls.match(COLS);
            const isRow = words(pcls).includes('flex') && !words(pcls).includes('flex-col');
            if (cm) {
                const n = parseInt(cm[1], 10);
                avail = (avail - gap * (n - 1)) / n;
            } else if (isRow && sibs.length > 1) {
                const mine = fixedW(cls);
                if (mine !== null) {
                    avail = mine;
                } else {
                    const grow = sibs.filter((s) => GROW.test(nodes[s].cls));
                    if (grow.length && grow.includes(i)) {
                        const taken = sibs.filter((s) => !grow.includes(s)).reduce((a, s) => a + intrinsic(s), 0);
                        avail = (avail - taken - gap * (sibs.length - 1)) / grow.length;
                    } else if (grow.length) {
                        avail = intrinsic(i);
                    } else {
                        const taken = sibs.filter((s) => s !== i).reduce((a, s) => a + (fixedW(nodes[s].cls) || 0), 0);
                        const flex = sibs.filter((s) => fixedW(nodes[s].cls) === null);
                        avail -= taken + gap * (sibs.length - 1);
                        if (flex.length > 1) avail /= flex.length;
                    }
                }
            }
        }
        const own = fixedW(cls);
        if (own !== null && !(p >= 0 && words(nodes[p].cls).includes('flex'))) avail = Math.min(avail, own);
        const mm = cls.match(MAXW);
        if (mm && mm[1] in MAXW_PX) avail = Math.min(avail, MAXW_PX[mm[1]]);
        avail -= hPadding(cls);
        if (words(cls).includes('section-card') && !BANG_PAD.test(cls)) avail -= cardPad * 2;
        if (nodes[i].tag === 'main') avail = VIEWPORT - mainPx * 2;
        width.set(i, Math.max(avail, 0));
        return width.get(i);
    }

    const out = [];
    nodes.forEach((n, i) => {
        let own = stripTags(body.slice(n.e, n.close).replace(/<(div|section|ul|ol|table|svg|pre)\b[\s\S]*/, ''));
        own = own.replace(/\s+/g, ' ').trim();
        if ([...own].length < minChars) return;
        const w = inner(i);
        if (w >= limit) return;
        // 아이콘을 옆에 세운 가로 배치가 좁혔는가, 여백이 겹쳐 좁아졌는가
        let why = '여백', j = i;
        while (j >= 0) {
            const pj = nodes[j].parent;
            if (pj < 0) break;
            if (words(nodes[pj].cls).includes('flex') && !words(nodes[pj].cls).includes('flex-col')) {
                if (kidsOf(pj).some((s) => s !== j && fixedW(nodes[s].cls) && fixedW(nodes[s].cls) >= 24)) { why = '아이콘'; break; }
            }
            j = pj;
        }
        out.push([roundHalfEven(w), lineOf(body, n.s) + headLines, why, [...own].slice(0, 40).join('')]);
    });
    return out;
}

function resolve(patterns) {
    if (!patterns.length) {
        return walk(ROOT, {ext: ['.html'], skip: (x) => x === 'dist' || x === 'node_modules'});
    }
    return patterns.map((a) => path.resolve(ROOT, a)).filter((p) => fs.existsSync(p)).sort(byPath);
}

export function run(argv) {
    let limit = NARROW;
    const args = [];
    for (let k = 0; k < argv.length; k++) {
        if (argv[k] === '--limit') { limit = parseFloat(argv[++k]); continue; }
        if (!argv[k].startsWith('--')) args.push(argv[k]);
    }
    const files = resolve(args);
    let total = 0;
    for (const p of files) {
        const rows = scan(p, limit);
        total += rows.length;
        rows.sort((a, b) => a[0] - b[0] || a[1] - b[1] || (a[2] < b[2] ? -1 : a[2] > b[2] ? 1 : 0) || (a[3] < b[3] ? -1 : 1));
        for (const [w, line, why, t] of rows) console.log(`WARN  audit_narrow: ${rel(p)}:${line} [${why}] 본문 폭 ${w}px :: 「${t}」`);
    }
    console.log(`INFO  audit_narrow: 완료 — 파일 ${files.length}, ${limit}px 미만 ${total}곳`);
}
