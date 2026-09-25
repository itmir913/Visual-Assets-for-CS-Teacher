// 강의안 HTML 검증: 태그 중첩 + 최소 글자 크기(CSS·SVG) + 테이블 래퍼 + 제목·금지 요소 + 중복 id.
//
//     npm run check -- html                           # 저장소 전체 (CI가 쓰는 방식)
//     npm run check -- html 인공지능기초/1-1-2.….html  # 인자만 검사
//
// 위반이 하나라도 있으면 실패한다(경고는 통과).
//
// **인자가 없으면 저장소 전체를 검사한다.** 예전에는 손대는 파일만 목록에 적는
// 방식이었는데, 그러면 손대지 않은 파일의 위반이 조용히 쌓인다. 실제로 그렇게
// 377건이 쌓인 채 발견됐다 — 검사가 CI 밖에 있으면 통과했다는 말에 뜻이 없다.
import fs from 'node:fs';
import path from 'node:path';
import {decodeHTML} from 'entities';
import {FONT_EXEMPT, ROOT, Report, htmlFiles, lineOf, read, rel} from '../lib/repo.mjs';
import {tokens} from '../lib/html-tokens.mjs';

// ── 검사에서 빼는 것 ─────────────────────────────────────────────────────────
// **경로를 여기 직접 적지 않는다.** subjects.json 이 유일한 출처이므로 폴더가 옮겨져도 따라온다.
//
// 글자 크기 검사를 건너뛰는 폴더(`font_exempt`). **standalone 전체를 빼지 않는다** — 시뮬레이터라도
// 학생이 읽는 글이므로 교실 뒷자리 기준은 그대로 걸린다(2026-08-26 사용자 확정).
//
// **그림 «안»의 글자는 이 검사가 보지 않는다.** SVG·캔버스 라벨은 자리가 좁아 값을
// 따로 잡고, 그것은 시뮬레이터마다 다른 판단이라 기계가 한 줄로 자를 수 없다.
// 여기서 보는 것은 HTML로 찍는 것 — 버튼 · 표 · 설명문 · <style> 블록이다.

// 전면 재작성을 기다리느라 검사에서 빼 둘 폴더. 지금 고쳐도 파일명·번호 체계가
// 바뀌면서 버려질 때만 쓴다. 2026-08-12 에 목록이 비었다.
const REWRITE_PENDING = [];

// ── 기준값 ───────────────────────────────────────────────────────────────────
// 375px 화면에서 section-card 안쪽이 실제로 갖는 폭(브라우저 실측 340px).
// SVG 텍스트는 viewBox 폭에 맞춰 축소되므로 이 값으로 실효 크기를 환산한다.
const RENDER_W = 340.0;
const MIN_PX = 12.0;   // 이 아래는 위반
const WARN_PX = 16.0;  // 12~16px는 확인 필요

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr']);

// Tailwind 가 만드는 `text-base`(16px)보다 작은 크기. 반응형 변형(`sm:text-sm`)도 걸린다.
const TW_SMALL = /(?<![-\w])(?:[a-z]+:)?text-(?:sm|xs)(?![-\w])|(?<![-\w])(?:[a-z]+:)?text-\[(?:0?\.\d+rem|\d{1,2}px)\]/g;

/** 글자가 아니라 장식인 요소(불릿용 Font Awesome 아이콘)인가. */
const isDecorativeIcon = (tag, cls) => tag === 'i' && cls.includes('fa-');

/** 인라인 style 에서 길이 값을 px 로 읽는다. 없으면 null. */
function styleLen(style, prop) {
    const m = style.match(new RegExp(prop + '\\s*:\\s*([\\d.]+)(px|rem)'));
    return m ? parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16) : null;
}

/** Tailwind 임의값 클래스 `min-w-[480px]` · `min-w-[30rem]` 을 px 로 읽는다. */
function twMinW(cls) {
    const m = cls.match(/min-w-\[([\d.]+)(px|rem)\]/);
    return m ? parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16) : null;
}

const fix = (x, d) => x.toFixed(d);

/** 태그 중첩 · 테이블 래퍼 · SVG 글자 크기를 한 번의 훑기로 검사한다. */
export class Checker {
    constructor() {
        this.stack = [];          // [tag, line, attrs]
        this.nesting = [];        // 위반: 중첩
        this.unwrapped = [];      // 위반: overflow-x-auto 래퍼 없는 표
        this.wideUnwrapped = [];  // 위반: min-width 가 화면보다 넓은데 래퍼 없는 요소
        this.tables = 0;
        this.svgSmall = [];       // 위반: SVG 실효 글자 크기 < MIN_PX
        this.svgWarn = [];        // 경고: MIN_PX ~ WARN_PX
        this.cssSmall = [];       // 위반: 인라인 style 글자 크기 < MIN_PX
        this.cssWarn = [];        // 경고
        this.twSmall = [];        // 위반: Tailwind 소형 크기 클래스
    }

    wrapped() { return this.stack.some(([, , p]) => (p.class || '').includes('overflow-x-auto')); }
    inSvg() { return this.stack.some(([t]) => t === 'svg'); }

    inspect(tag, a, line) {
        if (tag === 'table') {
            this.tables++;
            // 조상 중 overflow-x-auto 클래스를 가진 요소가 실제로 있는지 본다.
            if (!this.wrapped()) this.unwrapped.push(line);
        } else {
            // min-width 가 375px 화면 폭보다 넓은 요소는 어딘가에서 넘친다.
            let mn = styleLen(a.style || '', 'min-width');
            if (mn === null) mn = twMinW(a.class || '');
            if (mn !== null && mn > RENDER_W && !this.wrapped()) {
                this.wideUnwrapped.push(`${line}행: <${tag}> min-width ${fix(mn, 0)}px > ${fix(RENDER_W, 0)}px`);
            }
        }
        // Tailwind 소형 크기 클래스. **줄이 아니라 태그로 본다** — 줄로 보면
        // 아이콘(`<i class="fa-solid fa-plus text-xs">`)을 걸러 낼 수가 없다.
        const cls = a.class || '';
        if (!isDecorativeIcon(tag, cls)) {
            for (const m of cls.matchAll(TW_SMALL)) this.twSmall.push(`${line}행: ${m[0]}`);
        }
        const inSvg = this.inSvg();
        if ('font-size' in a && inSvg) this.checkSvgFont(line, a['font-size']);

        // 인라인 style 의 font-size. 태그의 class 를 함께 보므로 아이콘 불릿(fa-…)을 걸러 낸다.
        const m = (a.style || '').match(/font-size:\s*([\d.]+)(px|rem|em)/);
        if (m && !isDecorativeIcon(tag, cls)) {
            const val = parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16);
            if (inSvg) this.checkSvgFont(line, `${pyFloat(val)}px`);
            else this.recordCss(line, `${m[1]}${m[2]}`, val);
        }
    }

    recordCss(line, raw, px) {
        if (px >= WARN_PX) return;
        (px < MIN_PX ? this.cssSmall : this.cssWarn).push(`${line}행: font-size ${raw} (≈${fix(px, 0)}px)`);
    }

    /**
     * 가장 안쪽 svg 의 viewBox 폭 기준 축소 비율. viewBox 가 없으면 1.
     *
     * 실제 그려지는 폭은 min-width · max-width 에 좌우된다. min-width 가 화면 폭보다 크면
     * SVG 는 줄지 않고 래퍼가 가로로 스크롤된다. min-width 는 SVG 자신뿐 아니라 **조상 요소**에도
     * 붙는다 — `<div class="min-w-[480px]"><svg class="w-full">` 처럼. 그래서 조상의 인라인 style 과
     * Tailwind `min-w-[…]` 클래스까지 함께 본다(이 저장소의 SVG 는 모두 `w-full` 이다).
     */
    viewboxScale() {
        let idx = -1;
        for (let i = this.stack.length - 1; i >= 0; i--) if (this.stack[i][0] === 'svg') { idx = i; break; }
        if (idx === -1) return 1;
        const a = this.stack[idx][2];
        const vb = a.viewbox;
        if (!vb) return 1;
        const parts = vb.trim().split(/[\s,]+/);
        if (parts.length !== 4) return 1;
        const vbW = Number(parts[2]);
        if (!Number.isFinite(vbW) || parts[2] === '' || vbW <= 0) return 1;
        let drawn = RENDER_W;
        const mx = styleLen(a.style || '', 'max-width');
        if (mx !== null) drawn = Math.min(drawn, mx);
        for (const [, , anc] of this.stack.slice(0, idx + 1)) {
            let mn = styleLen(anc.style || '', 'min-width');
            if (mn === null) mn = twMinW(anc.class || '');
            if (mn !== null) drawn = Math.max(drawn, mn);
        }
        return drawn / vbW;
    }

    checkSvgFont(line, raw) {
        const m = String(raw).match(/^\s*([\d.]+)\s*(px|rem|em)?\s*$/);
        if (!m) return;
        let val = parseFloat(m[1]);
        if (m[2] === 'rem' || m[2] === 'em') val *= 16;
        const eff = val * this.viewboxScale();
        const msg = `${line}행: SVG font-size ${raw} → 375px에서 약 ${fix(eff, 1)}px`;
        if (eff < MIN_PX) this.svgSmall.push(msg);
        else if (eff < WARN_PX) this.svgWarn.push(msg);
    }

    feed(src) {
        for (const t of tokens(src)) {
            if (t.type === 'start') {
                this.inspect(t.tag, t.attrs, t.line);
                if (!t.selfClosing && !VOID.has(t.tag)) this.stack.push([t.tag, t.line, t.attrs]);
                continue;
            }
            const tag = t.tag;
            if (VOID.has(tag)) continue;
            if (!this.stack.length) { this.nesting.push(`${t.line}행: </${tag}> 짝 없음`); continue; }
            if (this.stack.at(-1)[0] === tag) { this.stack.pop(); continue; }
            let i = this.stack.length - 1;
            while (i >= 0 && this.stack[i][0] !== tag) i--;
            if (i >= 0) {
                const unclosed = this.stack.slice(i + 1).map(([tt, ln]) => `<${tt}>(${ln}행)`);
                this.nesting.push(`${t.line}행: </${tag}> 앞에 닫히지 않은 태그 ${unclosed.join(', ')}`);
                this.stack.length = i;
            } else {
                this.nesting.push(`${t.line}행: </${tag}> 짝 없음`);
            }
        }
        for (const [tt, ln] of this.stack) this.nesting.push(`${ln}행: <${tt}> 닫히지 않음`);
    }
}

/** 파이썬 `str(float)` 꼴 — 정수여도 `.0` 을 붙인다(메시지 모양을 옛 검사와 맞춘다). */
const pyFloat = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

/**
 * <style> 블록 안의 font-size 를 px 로 환산해 [위반, 경고] 로 나눈다.
 *
 * **그림 «안»에 앉는 글자는 이 규칙 밖이다** — SVG 라벨과 마찬가지로 자리가 좁아
 * 값을 따로 잡는다. 기계는 그것을 가릴 수 없으므로 **바로 앞에 `fs-figure` 표시와 까닭을 적어**
 * 밝힌다. 폴더째 빼는 것(`font_exempt`)과 달리 **자리마다 적으므로 늘어나면 눈에 띈다.**
 *
 *     .cell-g {
 *         /* fs-figure: 격자 칸 모서리에 앉는 값이라 칸 크기가 천장이다 *\/
 *         font-size: 0.65rem;
 *     }
 */
function styleBlockFontSizes(src) {
    const bad = [], warn = [];
    for (const block of src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) {
        const bodyStart = block.index + block[0].indexOf('>') + 1;
        const baseLine = lineOf(src, bodyStart);
        const body = block[1];
        for (const m of body.matchAll(/font-size:\s*([\d.]+)(px|rem|em)/g)) {
            const px = parseFloat(m[1]) * (m[2] === 'px' ? 1 : 16);
            if (px >= WARN_PX) continue;
            if (body.slice(Math.max(0, m.index - 200), m.index).includes('fs-figure')) continue;
            const line = baseLine + (body.slice(0, m.index).match(/\n/g) || []).length;
            (px < MIN_PX ? bad : warn).push(`${line}행: ${m[0]} (≈${fix(px, 0)}px)`);
        }
    }
    return [bad, warn];
}

const FA_VERSION = '6.7.2';   // Font Awesome 은 이 버전으로 통일한다

/** 사람에게 보여 줄 형태. 태그·엔티티를 풀고 공백을 하나로 줄인다. */
const plain = (s) => decodeHTML(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();

/**
 * 제목 비교용 열쇠. 태그·엔티티를 풀고 글자와 숫자만 남긴다.
 * 파일명은 공백을 `-` 로 적고, 본문은 `&middot;` 처럼 엔티티를 쓰기도 한다.
 */
const textKey = (s) => decodeHTML(s.replace(/<[^>]+>/g, ' ')).replace(/[^0-9A-Za-z가-힣]/g, '');

/**
 * 제목이 파일명 · <title> · <h1> 세 곳에서 같은지, h1 에 <br> 이 없는지.
 *
 * **nav 제목은 대조하지 않는다.** nav 바는 폭이 좁아 줄여 적는 것이 관행이다.
 * 줄인 것인지 어긋난 것인지는 기계가 가릴 수 없으므로 아예 보지 않는다.
 *
 * 파일명은 두 꼴을 받는다 — `번호.제목.html`(중단원이 있는 과목)과
 * `01-제목.html`(중단원이 없는 문법 노트). 둘 다 아니면 대조를 건너뛴다.
 */
function titleRules(file, src) {
    const bad = [];
    const mTitle = src.match(/<title>([\s\S]*?)<\/title>/i);
    const mH1 = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    if (!mH1) return bad;
    const h1Line = lineOf(src, mH1.index);
    if (mH1[1].includes('<br')) bad.push(`${h1Line}행: <h1> 안에 <br> — 제목은 한 줄로 쓰고 줄바꿈은 브라우저에 맡긴다`);

    const names = {};
    if (mTitle) names.title = mTitle[1];
    names.h1 = mH1[1];
    const stem = path.basename(file, path.extname(file));
    if (stem.includes('.')) names['파일명'] = stem.slice(stem.indexOf('.') + 1);
    else if (/^\d+-/.test(stem)) names['파일명'] = stem.slice(stem.indexOf('-') + 1);

    const keys = Object.fromEntries(Object.entries(names).map(([k, v]) => [k, textKey(v)]));
    const diff = ['파일명', 'title'].filter((k) => k in keys && keys[k] !== keys.h1);
    if (diff.length) {
        const shown = ['h1', '파일명', 'title'].filter((k) => k in names).map((k) => `${k}=${plain(names[k])}`).join(' / ');
        bad.push(`${h1Line}행: 제목이 어긋난다 (${diff.join(', ')}) — ${shown}`);
    }
    return bad;
}

// 쓰지 않기로 한 낱말과 그 자리에 쓸 말.
//
// **한 번 고친 말이 다시 기어들어 오는 것을 막으려고 둔다.** 사람이 기억으로 지키면
// 새 파일을 쓸 때마다 다시 새어 나온다 — 실제로 「견주다」는 한 번 전부 바꾼 뒤
// 새 시뮬레이터를 쓰면서 열몇 곳이 다시 들어왔다.
//
// 낱말을 더할 때는 **어간이 활용형까지 걸리도록** 적는다. 「견주다」는 견주·견줄·
// 견준·견줍·견줘·견줌으로 갈라지므로 끝 음절을 묶어 준다.
//
// 여기 걸리는 것은 화면에 나오는 글만이 아니라 **주석과 코드의 문자열까지**다.
// 일부러 그렇게 둔다 — 주석에 남아 있으면 다음 사람이 그 말을 따라 쓴다.
// 기준은 「틀린 말인가」가 아니라 **「고등학생이 읽고 곧바로 뜻이 잡히는가」**다.
// `되풀이` 는 틀린 말이 아니지만, 제어 구조의 정식 이름이 `반복 구조` 인데 본문만
// 다른 말을 쓰면 학생이 둘을 같은 것으로 잇지 못한다.
export const BANNED_WORDS = [
    [/견[주줄준줍줘줌]/g, '견주다', '비교하다'],
    [/되풀이/g, '되풀이', '반복'],
    // 「훑다」— 교과 용어와 이름이 겹친다. 반복으로 자료를 도는 것은 교과서에서
    // **순회·순차 탐색**이고, 풀어 쓴 말은 뜻이 통해도 그 개념과 이어지지 않는다.
    // 사람이 눈으로 보는 자리는 **살피다**로 쓴다 — 그쪽은 겹치는 뜻이 없다.
    // **활용형을 적지 않아도 되는 드문 경우다.** 「훑」이 들어가는 다른 낱말이 없어
    // 한 글자로 다 걸린다. 2026-09-11에 저장소 전체를 갈아 끼우고 이 줄을 세웠다.
    [/훑/g, '훑다', '순회하다 · 순차 탐색하다 · 살펴보다'],
    // 「재다」— 재고(在庫)는 뜻이 다르므로 뒤따르는 말로 걸러 낸다.
    // **활용형은 빠뜨리면 조용히 새어 나간다** — 「재던·재라」가 없어 일곱 곳이
    // 살아 있었고, 형태소 분석기로 용언을 뽑아 보고서야 드러났다.
    // 「재야(在野)·재세(在世)」와 겹치는 꼴은 넣지 않는다.
    // 「재며 · 재나 · 재느라」도 없어 인공지능기초에 네 곳이 살아 있었다(2026-09-24).
    // 「재 보다」처럼 띄어 쓴 꼴도 새어 나갔다(데이터과학 3-1-1). 앞 글자로 「현재 모델」을 거른다.
    // 「재 + 었」은 한 글자 「쟀」이 된다. 목록에 없어 아홉 곳이 살아 있었다(데이터과학 3-3-1).
    [new RegExp('(?<![가-힣])(재[어는서지면도려기다던라자므]|재고(?!를|의|량|\\s*관리|\\s*맞추기|,\\s*고객)' +
        '|잽니다|잰|잴' +
        '|재며|재나(?![라-힣])|재느라|재거나|재게' +
        '|재 [보봐봅봤볼]' +
        '|쟀)', 'g'), '재다', '측정하다'],
];

// 밝은 그러데이션 배경. `bg-gradient-*` 는 background-image 를 만들 뿐이라
// **background-color 가 투명으로 남는다.** 다크모드 확장은 background-color 를 바꾸므로
// 투명한 배경은 손대지 못한 채 어두운 «글자»만 밝게 바꾸고, 그래서 밝은 바탕에 밝은 글자가 된다.
// 짙은 그러데이션은 흰 글자를 얹으므로 확장이 글자를 그대로 두어 문제가 없다.
const LIGHT_GRAD = /bg-gradient-to-\w+((?:\s+(?:from|via|to)-(?:[a-z]+-\d+|white))+)/g;
const GRAD_STOP = /(?:from|via|to)-([a-z]+-\d+|white)/g;

/** 소스만 보고 잡히는 금지 요소들. 전부 CLAUDE.md 의 규칙이다. */
function bannedRules(src) {
    const bad = [];
    for (const m of src.matchAll(LIGHT_GRAD)) {
        const stops = [...m[1].matchAll(GRAD_STOP)].map((x) => x[1]);
        const tones = stops.map((s) => (s === 'white' ? 0 : parseInt(s.split('-')[1], 10)));
        if (tones.length && tones.every((t) => t <= 100)) {
            const first = stops.find((s) => s !== 'white') ?? stops[0];
            bad.push(`${lineOf(src, m.index)}행: 밝은 그러데이션 배경 — background-color가 투명으로 남아 ` +
                `다크모드 확장에서 글자만 밝아진다. 단색 <code>bg-${first}</code>로 준다`);
        }
    }
    for (const [re, 쓴말, 쓸말] of BANNED_WORDS) {
        for (const m of src.matchAll(re)) bad.push(`${lineOf(src, m.index)}행: 「${쓴말}」 — 「${쓸말}」로 쓴다`);
    }
    // 「이(가)」꼴 양쪽 표기. **값이 들어갈 자리에서 조사를 손으로 적은 흔적**이라,
    // 어느 쪽이 맞는지는 값이 정해져야 알 수 있다. 고르는 일은 src/entries/_lib/josa.js 가 한다.
    //
    // **빈칸 뒤는 뺀다.** 「______은(는)」은 학생이 채울 자리라 값이 아직 없고,
    // 한쪽으로 적으면 그것이 곧 답의 힌트가 된다.
    for (const m of src.matchAll(/(_*)(이\(가\)|가\(이\)|은\(는\)|는\(은\)|을\(를\)|를\(을\)|과\(와\)|와\(과\)|\(으\)로)/g)) {
        if (m[1]) continue;
        bad.push(`${lineOf(src, m.index)}행: 「${m[2]}」 — 조사를 손으로 적지 않는다. <code>josa()</code>가 값을 보고 고른다`);
    }
    // <sup>/<sub> 은 브라우저가 0.83em 으로 줄여 text-base 문단에서 12~13.5px 이 된다.
    // 소스에 text-sm 이 없으므로 글자 크기 검사로는 통과한다.
    for (const m of src.matchAll(/<su[pb]\b/g)) {
        bad.push(`${lineOf(src, m.index)}행: ${m[0]}> — 제곱은 &sup2; 문자로, 아래첨자는 문장을 고쳐 없앤다`);
    }
    // list-inside 는 마커가 콘텐츠 박스 안에 그려져 들여쓰기가 무너진다.
    for (const m of src.matchAll(/\blist-inside\b/g)) {
        bad.push(`${lineOf(src, m.index)}행: list-inside — list-outside와 pl-5 이상을 쓴다`);
    }
    for (const m of src.matchAll(/font-awesome\/([\d.]+)\//g)) {
        if (m[1] !== FA_VERSION) bad.push(`${lineOf(src, m.index)}행: Font Awesome ${m[1]} — ${FA_VERSION}으로 통일한다`);
    }
    return bad;
}

// ── 앞을 가리키지 않기 ───────────────────────────────────────────────────────
// **강의노트는 낱개로 읽히고 순서도 바뀐다.** 그래서 뒤를 가리키는 글은
// 「없는 다음 시간」이나 「다른 차시」를 가리키게 되는데, **어긋나도 아무도
// 알려 주지 않는다.** 규칙은 CLAUDE.md 「뒤 차시를 글로 예고하지도 않는다」에
// 있고(2026-08-12 사용자 확정), 이 검사가 그 규칙을 지킨다.
//
// **규칙만 있고 검사가 없던 동안 34줄이 쌓였다** — 다섯 과목 모두에 있었다.
//
// 고치는 법은 **뒤를 가리키지 말고 지금 할 수 있는 것만 말하는 것**이다 —
// 「다음 차시에서 다룹니다」가 아니라 「지금은 ~까지만 씁니다」.
const FORWARD_LESSON = /다음\s*다음\s*차시|다음\s*차시|다음\s*시간|뒤\s*차시|이후\s*차시/g;

// 같은 파일 «안»에서 절을 가리킬 때도 **차례를 적지 않는다.** 절을 하나
// 끼워 넣으면 「세 번째 절」이 통째로 어긋나는데, 학생은 세어 보다가 틀린다.
// **자리가 아니라 이름을 가리킨다** — 「『규칙과 키』 절에서 봅니다」.
const ORDINAL_SECTION = new RegExp(
    '(?:첫|첫째|둘째|셋째|넷째|다섯째|여섯째|일곱째|여덟째|마지막' +
    '|[0-9]+\\s*번째|[한두세네]\\s*번째|[일이삼사오육]\\s*번째)\\s*절(?![차차])', 'g');

// 그 줄에 이 표시가 있으면 넘어간다. **규칙을 설명하려면 막은 말을 적어야 한다.**
const FORWARD_SKIP = 'fwd: 예시';

/** 뒤를 가리키는 글. 어긋나도 CI 가 아니라 학생이 먼저 만난다. */
function forwardRules(src) {
    const bad = [];
    const lines = src.split('\n');
    const put = (pos, msg) => {
        const ln = lineOf(src, pos);
        if (ln > 0 && ln <= lines.length && lines[ln - 1].includes(FORWARD_SKIP)) return;
        bad.push(`${ln}행: ${msg}`);
    };
    for (const m of src.matchAll(FORWARD_LESSON)) {
        put(m.index, `「${m[0]}」 — 뒤 차시를 예고하지 않는다. 뒤를 가리키지 말고 「지금은 ~까지만 씁니다」로 쓴다`);
    }
    for (const m of src.matchAll(ORDINAL_SECTION)) {
        put(m.index, `「${m[0]}」 — 절을 «차례»로 가리키지 않는다. 절을 하나 끼우면 어긋난다. 절의 «이름»을 적는다`);
    }
    return bad;
}

/** 머리말이 제구실을 하는지. 화면에 안 보이므로 눈으로는 못 잡는다. */
function headRules(src) {
    const bad = [];
    const metas = [...src.matchAll(/<meta\s[^>]*>/gi)];
    const vp = metas.filter((m) => /name\s*=\s*"viewport"/i.test(m[0]));
    if (!vp.length) {
        // 이름이 어긋난 것을 찾아 준다. 태그는 있는데 무시당하는 쪽이 더 헷갈린다.
        const near = metas.filter((m) => m[0].includes('width=device-width'));
        const why = near.length ? ` — 이름이 어긋났다: ${near[0][0]}` : '';
        const line = near.length ? lineOf(src, near[0].index) : 1;
        bad.push(`${line}행: viewport 메타가 없다${why}. <meta name="viewport" content="width=device-width, initial-scale=1.0">`);
    } else if (!vp[0][0].includes('width=device-width')) {
        bad.push(`${lineOf(src, vp[0].index)}행: viewport에 width=device-width가 없다 — 모바일이 980px로 잡고 통째로 축소한다`);
    }
    // 태그 «안»의 한글 낱자모는 IME 가 흘린 것이다. 본문의 자모는 정당할 수 있으므로 보지 않는다.
    for (const m of src.matchAll(/<[^>!][^>]*>/g)) {
        const j = m[0].match(/[ㄱ-ㆎ]/);
        if (j) bad.push(`${lineOf(src, m.index)}행: 태그 안에 한글 낱자모 「${j[0]}」 — 입력기가 흘린 것이다 :: ${[...m[0]].slice(0, 60).join('')}`);
    }
    return bad;
}

/**
 * 좁은 화면에서 «본문에 남는 폭»을 갉아먹는 두 자리.
 * 여백은 데스크톱에서 보기 좋으라고 준 값이라 모바일에서 눈에 띄지 않고, 그래서 조용히 남는다.
 * 카드 여백 40px + 본문 여백 24px 이면 시작부터 128px 이 사라진다.
 */
function gutterRules(src) {
    const bad = [];
    let m = src.match(/\.section-card\s*\{([^}]*)\}/);
    if (m) {
        const pm = m[1].match(/padding:\s*([^;]+);/);
        if (pm) {
            const v = pm[1].trim();
            const fixed = v.match(/^([\d.]+)rem$/);
            if (fixed && parseFloat(fixed[1]) >= 2) {
                bad.push(`${lineOf(src, m.index)}행: .section-card 여백이 ${v} 고정 — 375px에서 좌우로 ` +
                    `${fix(parseFloat(fixed[1]) * 32, 0)}px을 먹는다. clamp(1.25rem, 4vw, ${v})로 준다`);
            }
        }
    }
    m = src.match(/<main\s[^>]*class="([^"]*)"/);
    if (m && /(?<![-\w:])px-[5-9]\b/.test(m[1]) && !/(?<![-\w:])px-[1-4](?:\.\d)?\b/.test(m[1])) {
        bad.push(`${lineOf(src, m.index)}행: <main>의 좌우 여백이 좁은 화면에서도 그대로다 — px-4 sm:px-6 처럼 준다`);
    }
    return bad;
}

const SHRINK_COL = /(?<![-\w:])flex-col\b/;
const SHRINK_ITEMS = /(?<![-\w:])items-(?:start|center|end|baseline)\b/;
const FORCED_W = /table-prose|min-w-\[|min-width\s*:/;
// 폭을 스스로 못박은 자식.
const SELF_WIDE = /(?<![-\w:])(?:w-full|self-stretch|w-\[)/;

/**
 * 세로로 쌓은 칸 «안»에 폭을 강제하는 것이 들었는가.
 *
 * `flex` 를 `flex-col` 로 바꾸면 `items-*` 의 뜻이 주축에서 교차축으로 옮겨간다.
 * 가로일 때 `items-start` 는 「위로 붙임」이지만 **세로일 때는 「내용 폭에 맞춤」**이다.
 * 그러면 칸이 화면 폭을 채우지 않고, 안에 든 `table-prose`(min-width 32rem)가
 * 칸을 밀어내 **페이지가 통째로 가로로 넘친다.** 실제로 그렇게 214px 이 샌 적이 있다.
 */
function stackRules(src) {
    const nodes = [], st = [];
    for (const m of src.matchAll(/<(\/?)(div|section|main|li|td)\b([^>]*)>/gi)) {
        const tag = m[2].toLowerCase();
        if (m[1]) {
            while (st.length) {
                const i = st.pop();
                if (nodes[i].tag === tag) { nodes[i].end = m.index; break; }
            }
            continue;
        }
        if (/\/>\s*$/.test(m[3])) continue;
        const c = m[3].match(/class="([^"]*)"/);
        nodes.push({parent: st.length ? st.at(-1) : -1, cls: c ? c[1] : '', tag, start: m.index + m[0].length, end: src.length});
        st.push(nodes.length - 1);
    }
    const kids = new Map();
    nodes.forEach((n, i) => { if (!kids.has(n.parent)) kids.set(n.parent, []); kids.get(n.parent).push(i); });

    const bad = [];
    nodes.forEach((n, i) => {
        if (!SHRINK_COL.test(n.cls) || !n.cls.split(/\s+/).includes('flex')) return;
        const it = n.cls.match(SHRINK_ITEMS);
        if (!it) return;
        for (const k of kids.get(i) || []) {
            if (SELF_WIDE.test(nodes[k].cls)) continue;
            if (FORCED_W.test(src.slice(nodes[k].start, nodes[k].end))) {
                bad.push(`${lineOf(src, n.start)}행: 세로로 쌓은 칸에 「${it[0]}」 — 세로일 때는 «내용 폭에 맞춤»이라 ` +
                    `안에 든 넓은 표·도해가 페이지를 가로로 밀어낸다. items-stretch sm:${it[0]} 로 준다`);
                break;
            }
        }
    });
    return bad;
}

/**
 * 한 파일 안에 같은 id 가 두 번 나오는가.
 *
 * nav 의 `href="#quiz"` 는 **먼저 나온 것**으로 간다. 핵심 정리 절과 퀴즈 절이
 * 둘 다 `id="quiz"` 였던 파일에서는 퀴즈 바로가기가 핵심 정리로 떨어졌는데,
 * 화면은 멀쩡해 보여 **눌러 보기 전에는 아무도 모른다.** `getElementById` 도 같다.
 * 주석과 `<script>` · `<template>` 안은 태그가 아니므로 보지 않는다.
 */
function idRules(src) {
    const body = src.replace(/<!--[\s\S]*?-->|<(script|template)\b[\s\S]*?<\/\1\s*>/gi, (s) => s.replace(/[^\n]/g, ' '));
    const seen = new Map(), bad = [];
    for (const m of body.matchAll(/<[a-zA-Z][^>]*?\sid\s*=\s*["']([^"']+)["']/g)) {
        const id = m[1], line = lineOf(src, m.index);
        if (seen.has(id)) bad.push(`${line}행: id="${id}"가 ${seen.get(id)}행에도 있다 — #${id} 로 가는 링크는 먼저 나온 쪽으로 간다`);
        else seen.set(id, line);
    }
    return bad;
}

const under = (file, dirs) => {
    const r = rel(file);
    return dirs.some((d) => r === d || r.startsWith(d.replace(/\/+$/, '') + '/'));
};

const lineNo = (s) => parseInt(s.match(/^(\d+)행/)[1], 10);
const at = (shown, item) => { const m = item.match(/^(\d+)행/); return m ? `${shown}:${m[1]}` : shown; };
const msg = (item) => item.replace(/^\d+행:\s*/, '');

function checkFile(file, r) {
    const src = read(file);
    const shown = rel(file);
    r.note(`${shown} (${src.split('\n').length}행)`);
    const c = new Checker();
    c.feed(src);

    const report = (label, bad, warn = []) => {
        const byLine = (xs) => [...xs].sort((a, b) => lineNo(a) - lineNo(b));
        bad = byLine(bad); warn = byLine(warn);
        for (const b of bad) r.error(`${at(shown, b)} [${label}] ${msg(b)}`);
        if (!bad.length && !warn.length) r.note(`  [${label}] OK`);
        for (const w of warn) r.warn(`${at(shown, w)} [${label}] ${msg(w)}`);
    };

    report('태그 중첩', c.nesting);
    if (under(file, FONT_EXEMPT)) {
        r.note('  [글자 크기] 건너뜀 — 아직 손질하지 않은 폴더다');
    } else {
        const [cssBad, cssWarn] = styleBlockFontSizes(src);
        report('글자 크기(CSS)', [...c.twSmall, ...cssBad, ...c.cssSmall], [...cssWarn, ...c.cssWarn]);
        report('글자 크기(SVG)', c.svgSmall, c.svgWarn);
    }
    if (c.unwrapped.length) {
        for (const ln of c.unwrapped) r.error(`${shown}:${ln} [테이블 래퍼] 표 ${c.tables}개 가운데 overflow-x-auto 로 감싸지 않은 표`);
    } else {
        r.note(`  [테이블 래퍼] ${c.tables}개 중 전부 OK`);
    }
    report('고정폭 래퍼', c.wideUnwrapped);
    report('제목 일치', titleRules(file, src));
    report('금지 요소', bannedRules(src));
    report('앞을 가리킴', forwardRules(src));
    report('머리말', headRules(src));
    report('좁은 화면 여백', gutterRules(src));
    report('세로로 쌓은 칸', stackRules(src));
    report('중복 id', idRules(src));
}

/** 상대 경로는 현재 디렉터리 → 저장소 루트 순으로 찾는다. */
function resolveArgs(args, r) {
    const out = [];
    for (const a of args) {
        const cand = path.isAbsolute(a) ? [a] : [path.resolve(a), path.join(ROOT, a)];
        const hit = cand.find((p) => fs.existsSync(p));
        if (hit) out.push(path.resolve(hit));
        else r.error(`파일 없음: ${a}`);
    }
    return out;
}

export function check(args = []) {
    const r = new Report('check_html');
    const picked = args.filter((a) => a !== '-v' && a !== '--verbose');
    let files, skipped = 0;
    if (picked.length) {
        // 인자로 짚었으면 그대로 검사한다 — 재작성 대기 파일도 봐 준다.
        files = resolveArgs(picked, r);
    } else {
        // 인자가 없으면 subjects.json 이 아는 전부. CI 가 이 길로 온다.
        const all = htmlFiles();
        files = all.filter((f) => !under(f, REWRITE_PENDING));
        skipped = all.length - files.length;
    }
    for (const f of files) checkFile(f, r);
    const tail = skipped ? `, 재작성 대기 건너뜀 ${skipped}` : '';
    return r.done(`완료 — 파일 ${files.length}, 위반 ${r.errors.length}, 확인 필요 ${r.warnings.length}${tail}`);
}
