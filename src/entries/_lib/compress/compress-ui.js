/* 압축 시뮬레이터의 화면.
 *
 * **HTML은 뼈대만 두고 여기서 채운다.** 찾기 시뮬레이터와 같은 방식이라, 탭을 늘리거나
 * 프리셋을 바꿀 때 HTML을 건드릴 일이 없다 → `compress-registry.js`
 *
 * **그리는 쪽은 어떤 방법인지 거의 묻지 않는다.** 스냅샷이 진리이고 화면은 그 장의
 * 상태를 그대로 옮긴다. 방법을 직접 묻는 자리는 둘뿐이다 —
 * 나무를 그릴지(`view`)와, 함께 보낼 것의 이름이 무엇인지(`sideNameOf`).
 * 나머지는 스냅샷에 실린 것만 보고 그린다.
 */

import {createStepPlayer, PLAY_SPEEDS} from '../step-player.js';
import {createTreeView} from '../tree-view.js';
import {withJosa} from '../josa.js';
import {COMPRESS_ALPHABET, COMPRESS_MAX_LEN, compressRate} from './compress-model.js';
import {
    COMPRESS_COMMON_NOTES, COMPRESS_METHODS, COMPRESS_PRESETS, methodOf, sideNameOf,
} from './compress-registry.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;'}[c]));

export function mountCompressSimulator() {
    let methodId = COMPRESS_METHODS[0].id;
    let text = COMPRESS_PRESETS[0].text;
    let player = null;
    let treeView = null;
    let speedMs = PLAY_SPEEDS[1].ms;

    /* ---- 뼈대 ---- */

    $('max-label').textContent = String(COMPRESS_MAX_LEN);

    $('method-tabs').innerHTML = COMPRESS_METHODS
        .map((m) => `<button class="group-tab" data-method="${m.id}" type="button">
            <i class="fa-solid ${m.icon} mr-2"></i>${esc(m.name)}
            <span class="hidden sm:inline font-semibold text-slate-400 ml-2">${esc(m.short)}</span>
        </button>`)
        .join('');

    $('preset-host').innerHTML = COMPRESS_PRESETS
        .map((p) => `<button class="preset-btn" data-preset="${p.id}" type="button">${esc(p.name)}</button>`)
        .join('');

    $('speed').innerHTML = PLAY_SPEEDS
        .map((s) => `<option value="${s.ms}"${s.ms === speedMs ? ' selected' : ''}>${esc(s.name)}</option>`)
        .join('');

    /* 무대 안쪽. **글·조각·덤 셋을 늘 같은 차례로 둔다** — 방법을 바꿔도 눈이 같은 자리를 본다. */
    $('view-host').innerHTML = `
        <div class="space-y-4">
            <div>
                <p class="font-black text-slate-900 mb-1">줄이기 전</p>
                <div class="flex flex-wrap gap-1" id="glyph-row"></div>
            </div>
            <div id="now-wrap" class="hidden">
                <p class="font-black text-slate-900 mb-1">지금 글</p>
                <div class="flex flex-wrap gap-1" id="now-row"></div>
            </div>
            <div id="tree-wrap" class="hidden">
                <p class="font-black text-slate-900 mb-1">나무</p>
                <div class="relative border border-slate-200 rounded-xl bg-slate-50 h-64 sm:h-80" id="tree-host"></div>
            </div>
            <div>
                <p class="font-black text-slate-900 mb-1">줄여 적은 결과</p>
                <div class="flex flex-wrap gap-1 min-h-[3rem]" id="piece-row"></div>
            </div>
            <div id="aside-wrap">
                <p class="font-black text-slate-900 mb-1">
                    함께 보내야 하는 것 — <span id="aside-name">코드표</span>
                </p>
                <div class="flex flex-wrap gap-1 min-h-[2rem]" id="aside-row"></div>
            </div>
        </div>`;

    /* ---- 그리기 ---- */

    function paintGlyphs(frame) {
        const span = frame.marks.span;
        const focus = new Set(frame.marks.focus);

        /* **「끝남」 표시는 조각의 자리가 «원본»을 가리킬 때만 쓴다.**
           키워드가 내놓는 조각의 `from`·`to`는 바꾼 «뒤» 글의 자리라, 그대로 쓰면
           원본 열 칸 가운데 다섯 칸만 회색이 되어 「여기까지 했다」가 거짓말이 된다.
           키워드는 아래 「지금 글」 줄이 그 몫을 한다. */
        const 자리가원본 = !frame.extra || frame.extra.now === undefined;
        const 지난데 = 자리가원본 ? frame.out.reduce((a, p) => Math.max(a, p.to ?? 0), 0) : 0;

        $('glyph-row').innerHTML = [...frame.text].map((ch, i) => {
            const 덮임 = (span && i >= span.from && i < span.to) || focus.has(i);
            const 끝남 = !덮임 && i < 지난데;
            return `<span class="glyph${덮임 ? ' on' : ''}${끝남 ? ' done' : ''}">${esc(ch)}</span>`;
        }).join('');

        /* 「지금 글」 — 바꾸어 가는 중인 글. **원본을 그대로 두고 아래에 따로 둔다**:
           무엇이 무엇으로 바뀌었는지는 둘을 나란히 놓아야 보인다. */
        /* **`extra`가 `null`일 때 `&&`로 받으면 `null`이 흘러 나온다.** 그러면
           `now !== undefined`가 참이 되어 없는 사전을 훑다 죽는다. 없음을 하나로 모은다. */
        const now = frame.extra ? frame.extra.now : undefined;
        $('now-wrap').classList.toggle('hidden', now === undefined);
        if (now !== undefined) {
            const 기호 = new Set((frame.extra.dict || []).map((d) => d.symbol));
            $('now-row').innerHTML = [...now]
                .map((ch) => `<span class="glyph${기호.has(ch) ? ' sym' : ''}">${esc(ch)}</span>`)
                .join('');
        }
    }

    function paintPieces(frame) {
        $('piece-row').innerHTML = frame.out.length
            ? frame.out.map((p) => `<span class="piece${p.kind === 'symbol' ? ' symbol' : ''}">
                    <span>${esc(p.text)}</span><span class="bits">${p.bits}비트</span>
                </span>`).join('')
            : '<span class="text-slate-400 font-semibold">아직 없습니다.</span>';
    }

    function paintAside(frame) {
        const m = methodOf(methodId);
        const 이름 = sideNameOf(m.id);

        /* **런 렝스에는 코드표라는 것이 아예 없다.** 「코드표 0비트」로 적어 두면
           학생이 「있는데 마침 비었나 보다」로 읽는다. 없는 것은 자리째 감춘다. */
        $('aside-wrap').classList.toggle('hidden', !이름);
        $('table-wrap').classList.toggle('hidden', !이름);
        if (!이름) return;

        $('aside-name').textContent = 이름;
        $('table-name').textContent = 이름;
        $('aside-row').innerHTML = frame.side.length
            ? frame.side.map((p) => `<span class="aside-row">
                    <span>${esc(p.text)}</span><span class="text-slate-400">${p.bits}비트</span>
                </span>`).join('')
            : '<span class="text-slate-400 font-semibold">아직 없습니다.</span>';
    }

    /** 허프만의 숲과 나무. **d3 트리는 뿌리가 하나여야 하므로 숲은 보이지 않는 뿌리에 묶는다.** */
    function paintTree(frame, duration) {
        const wrap = $('tree-wrap');
        const m = methodOf(methodId);
        if (m.view !== 'tree') { wrap.classList.add('hidden'); return; }
        wrap.classList.remove('hidden');

        const ex = frame.extra || {};
        const roots = ex.root ? [ex.root] : (ex.forest || []);
        if (!roots.length) return;

        let uid = 0;
        const 옮김 = (nd) => ({
            id: `n${uid++}`,
            ch: nd.ch,
            n: nd.n,
            seq: nd.seq,
            children: nd.left || nd.right ? [nd.left, nd.right].filter(Boolean).map(옮김) : [],
        });
        const data = {id: 'root', ch: null, n: null, seq: -1, hidden: true, children: roots.map(옮김)};

        if (!treeView) {
            /* **콜백이 받는 것은 «데이터 객체»이지 d3 마디가 아니다.**
               `nodeStyle(d.data)` · `linkStyle(대상, 부모)` 꼴로 부른다.
               처음에 d3 마디인 줄 알고 `d.data.hidden`·`d.source`를 읽었더니
               `render`가 나무 그리는 자리에서 죽었다 — 그 앞의 조각과 코드표는 이미
               그려진 뒤라 **화면은 멀쩡해 보이는데 계수기만 첫 장에 멈춰 있었다.**
               node 검사는 `tree-view`를 가짜로 때우므로 이 자리를 밟지 못한다. */
            treeView = createTreeView('#tree-host', {
                shape: (d) => (d.hidden ? 'circle' : 'box'),
                radius: 1,
                fontSize: 13,
                levelGap: 26,
                siblingGap: 14,
                label: (d) => (d.hidden ? [] : (d.ch !== null
                    ? [{text: d.ch, bold: true}, {text: String(d.n), bold: false}]
                    : [{text: String(d.n), bold: false}])),
                nodeStyle: (d) => {
                    if (d.hidden) return {fill: 'transparent', stroke: 'transparent'};
                    return d.ch !== null
                        ? {fill: '#fff1f2', stroke: '#fb7185', strokeWidth: 2, textColor: '#9f1239'}
                        : {fill: '#f1f5f9', stroke: '#94a3b8', strokeWidth: 1.5, textColor: '#475569'};
                },
                linkStyle: (대상, 부모) => (부모 && 부모.hidden
                    ? {stroke: 'transparent'}
                    : {stroke: '#cbd5e1', strokeWidth: 2}),
                // 왼쪽 자식이 0, 오른쪽이 1. 숨은 뿌리에서 내려오는 줄에는 적지 않는다.
                edgeLabel: (대상, 부모) => (부모 && !부모.hidden
                    ? (부모.children[0] === 대상 ? '0' : '1')
                    : null),
                edgeLabelColor: '#be123c',
            });
        }
        treeView.setData(data);
        treeView.update(duration);
        treeView.fit(duration);
    }

    function paintCounts(frame) {
        const c = frame.counts;
        $('count-before').textContent = String(c.before);
        $('count-body').textContent = String(c.body);

        /* **아직 아무것도 안 내놓았으면 압축률을 적지 않는다.**
           식대로면 0비트라 100%가 되는데, 나무를 짓는 내내 초록 100%가 떠 있으면
           학생이 그것을 결과로 읽는다. **압축률은 다 줄이고 나서야 뜻이 있는 값이다.** */
        const 아직 = frame.out.length === 0;
        const rate = compressRate(c.before, c.body);
        const el = $('count-rate');
        el.textContent = 아직 ? '—' : `${rate}%`;
        el.className = `font-black tally ${아직 ? 'text-slate-400'
            : (rate > 0 ? 'text-emerald-600' : (rate < 0 ? 'text-rose-600' : 'text-slate-500'))}`;
        $('count-table').textContent = String(c.table);
    }

    function render(frame, prev, {ms} = {}) {
        paintGlyphs(frame);
        paintPieces(frame);
        paintAside(frame);
        paintTree(frame, Math.min(ms ?? 250, 400));
        paintCounts(frame);
        $('say').innerHTML = frame.say || '&nbsp;';
    }

    /* ---- 재생 ---- */

    function onPlayerState({index, total, playing}) {
        $('scrub').max = String(Math.max(0, total - 1));
        $('scrub').value = String(index);
        $('step-label').textContent = `${index + 1} / ${total} 단계`;
        $('btn-play').innerHTML = playing
            ? '<i class="fa-solid fa-pause"></i> 멈춤'
            : '<i class="fa-solid fa-play"></i> 재생';
        $('btn-prev').disabled = index <= 0;
        $('btn-next').disabled = index >= total - 1;
    }

    function run() {
        const m = methodOf(methodId);
        const out = m.run(text);

        if (player) player.destroy();
        player = createStepPlayer({frames: out.frames, render, onState: onPlayerState});
        player.setSpeed(speedMs);
        player.start();

        $('method-name').textContent = m.name;
        $('method-idea').innerHTML = m.idea;
        $('read-notes').innerHTML = [...m.notes, ...COMPRESS_COMMON_NOTES]
            .map((n) => `<li>${n}</li>`).join('');
        paintRace();
    }

    /** 세 방법을 같은 글에 걸어 나란히 놓는다. **표가 이 화면의 결론이다.** */
    function paintRace() {
        const rows = COMPRESS_METHODS.map((m) => {
            const out = m.run(text);
            return {m, out, rate: compressRate(out.beforeBits, out.bodyBits)};
        });
        const 최고 = Math.max(...rows.map((r) => r.rate));

        $('race-table').innerHTML = `
            <thead>
            <tr class="bg-slate-100 text-slate-700">
                <th class="w-44 text-left font-black px-3 py-2 border border-slate-200">방법</th>
                <th class="text-left font-black px-3 py-2 border border-slate-200">줄인 뒤</th>
                <th class="text-left font-black px-3 py-2 border border-slate-200">압축률</th>
                <th class="text-left font-black px-3 py-2 border border-slate-200">함께 보낼 것</th>
            </tr>
            </thead>
            <tbody>
            ${rows.map(({m, out, rate}) => `
                <tr class="${m.id === methodId ? 'bg-rose-50' : ''}">
                    <td class="px-3 py-2 border border-slate-200 font-bold text-slate-800">
                        <i class="fa-solid ${m.icon} mr-2 text-slate-400"></i>${esc(m.name)}
                    </td>
                    <td class="px-3 py-2 border border-slate-200 tally">${out.bodyBits}비트
                        <span class="text-slate-400">/ ${out.beforeBits}</span></td>
                    <td class="px-3 py-2 border border-slate-200 font-black tally
                        ${rate > 0 ? 'text-emerald-600' : (rate < 0 ? 'text-rose-600' : 'text-slate-500')}">
                        ${rate}%${rate === 최고 && rate > 0 ? ' <span class="text-slate-500 font-bold">가장 많이 줄임</span>' : ''}
                    </td>
                    <td class="px-3 py-2 border border-slate-200 tally text-slate-600">
                        ${sideNameOf(m.id) ? `${sideNameOf(m.id)} ${out.tableBits}비트` : '없음'}</td>
                </tr>`).join('')}
            </tbody>`;
    }

    /* ---- 조작 ---- */

    function setMethod(id) {
        methodId = id;
        for (const b of $('method-tabs').querySelectorAll('[data-method]')) {
            b.classList.toggle('on', b.dataset.method === id);
        }
        /* **나무 자리는 방법을 바꿀 때 비운다.** 남겨 두면 런 렝스를 고른 학생이
           앞 방법의 나무를 보고 그것이 지금 방법의 그림인 줄 안다. */
        if (methodOf(id).view !== 'tree' && treeView) {
            $('tree-host').innerHTML = '';
            treeView = null;
        }
        run();
    }

    function setText(next, {preset = null} = {}) {
        text = next;
        $('text-input').value = next;
        $('input-error').innerHTML = '&nbsp;';
        for (const b of $('preset-host').querySelectorAll('[data-preset]')) {
            b.classList.toggle('on', b.dataset.preset === preset);
        }
        const p = COMPRESS_PRESETS.find((x) => x.id === preset);
        $('preset-hint').innerHTML = p ? p.hint : '&nbsp;';
        run();
    }

    function applyInput() {
        const raw = $('text-input').value.trim().toUpperCase();
        if (!raw.length) return fail('줄일 글을 적어 주세요.');
        if (!COMPRESS_ALPHABET.test(raw)) return fail('영어 대문자만 넣을 수 있습니다.');
        if (raw.length > COMPRESS_MAX_LEN) {
            return fail(`${withJosa(COMPRESS_MAX_LEN, '을를')} 넘었습니다 — 지금 ${raw.length}자입니다.`);
        }
        setText(raw);
    }

    function fail(msg) {
        $('input-error').textContent = msg;
    }

    $('method-tabs').addEventListener('click', (e) => {
        const b = e.target.closest('[data-method]');
        if (b) setMethod(b.dataset.method);
    });
    $('preset-host').addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (!b) return;
        const p = COMPRESS_PRESETS.find((x) => x.id === b.dataset.preset);
        if (p) setText(p.text, {preset: p.id});
    });
    $('btn-apply').addEventListener('click', applyInput);
    $('text-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') applyInput();
    });

    $('btn-play').addEventListener('click', () => player.toggle());
    $('btn-prev').addEventListener('click', () => player.step(-1));
    $('btn-next').addEventListener('click', () => player.step(1));
    $('btn-first').addEventListener('click', () => player.toStart());
    $('btn-last').addEventListener('click', () => player.toEnd());
    $('scrub').addEventListener('input', (e) => player.seek(Number(e.target.value)));
    $('speed').addEventListener('change', (e) => {
        speedMs = Number(e.target.value);
        player.setSpeed(speedMs);
    });

    setMethod(methodId);
    setText(COMPRESS_PRESETS[0].text, {preset: COMPRESS_PRESETS[0].id});
}
