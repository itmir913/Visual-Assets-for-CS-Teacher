/* 화면 배선. **HTML은 뼈대만 두고 여기서 채운다** —
 * 탭도 연산 버튼도 범례도 「화면 읽는 법」도 등록부에서 만들어 내므로, 방법을 하나 더하면
 * 화면이 따라온다. 손으로 적은 목록이 화면과 등록부 두 군데 있으면 반드시 어긋난다.
 *
 * **담은 값은 방법을 바꿔도 그대로 간다.** 「같은 자료를 이 방법으로 찾으면 어떻게 되는가」가
 * 이 페이지의 쓰임이라, 탭을 옮길 때마다 자료가 처음으로 돌아가면 비교할 수가 없다.
 */

import {
    FIND_START, FIND_HASH_CAP,
    findStructById, findStructsOfGroup, findGroupById, findGroupsInUse, findPlanOf,
} from './find-registry.js';
import {
    runFindOperation, findArrayState, findHashState, findValues,
} from './find-model.js';
import {buildFindRace, makeFindRaceStates, measureFindWork, findWorkOf} from './find-compare.js';
import {createFindCellsView, FIND_COLORS} from './find-view-cells.js';
import {createFindHashView} from './find-view-hash.js';
import {createFindRaceView} from './find-view-race.js';
import {createStepPlayer, PLAY_SPEEDS} from '../step-player.js';
import {FIND_VALUE_MAX} from './find-ops.js';

/** 자료를 몇 개까지 담게 할지. **칸이 너무 많으면 375px에서 한 칸이 글자보다 좁아진다.** */
export const FIND_MAX_N = 12;

/** 색이 뜻하는 것. **무엇을 낼지는 방법마다 다르다** — 등록부의 `legend`가 고른다.
 *  화면에 안 나오는 색을 범례에 남기면 학생이 「아직 못 본 무언가가 있다」고 여기며 찾는다. */
const FIND_LEGEND = {
    idle: {tone: 'idle', label: '아직 안 본 것'},
    focus: {tone: 'focus', label: '지금 보는 칸'},
    hit: {tone: 'hit', label: '찾던 값'},
    ruled: {tone: 'ruled', label: '볼 것 없다고 버린 곳'},
    tomb: {tone: 'ruled', label: '묘비 — 뺐던 자리', dashed: true},
};

const $ = (id) => document.getElementById(id);

/* 설명문의 `**굵게**`와 백틱 코드를 실제로 그렇게 낸다. `textContent`로 넣으면
   별표와 백틱이 **그대로 화면에 찍힌다.** */
function setRich(el, text, strongClass = 'font-black text-slate-900') {
    const safe = String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = safe
        .replace(/\*\*([^*]+)\*\*/g, (_, inner) => `<strong class="${strongClass}">${inner}</strong>`)
        .replace(/`([^`]+)`/g,
            (_, inner) => `<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-800">${inner}</code>`);
}

function findButton(cls, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
}

export function mountFindSimulator() {
    let struct = findStructById('seq');
    let implId = 'chain';
    let values = [...FIND_START];
    let state = null;    // 지금 방법의 상태
    let trio = null;     // 나란히 비교일 때의 세 상태
    let player = null;
    let view = null;
    let viewKind = null;
    let measured = null;
    const log = [];

    /* ---- 그림 ---- */

    function ensureView(kind) {
        /* **방법까지 넣어 비교한다.** 순차와 이진은 같은 칸 그림을 쓰지만, 탭을 옮기면
           커서 이름표(i ↔ lo·mid·hi)가 통째로 갈리므로 새로 만드는 편이 깨끗하다. */
        const want = `${kind}:${struct.id}`;
        if (viewKind === want) return;
        viewKind = want;
        const host = $('view-host');
        if (kind === 'hash') view = createFindHashView(host);
        else if (kind === 'race') view = createFindRaceView(host);
        else view = createFindCellsView(host);
    }

    const plan = () => findPlanOf(struct, implId);

    /* ---- 위쪽: 분류 탭과 방법 칩 ---- */

    function paintTabs() {
        const groupTabs = $('group-tabs');
        groupTabs.textContent = '';
        for (const g of findGroupsInUse()) {
            groupTabs.appendChild(findButton(
                'group-tab' + (g.id === struct.group ? ' on' : ''),
                g.name,
                () => {
                    const first = findStructsOfGroup(g.id)[0];
                    if (first) selectStruct(first.id);
                },
            ));
        }

        const structTabs = $('struct-tabs');
        structTabs.textContent = '';
        for (const s of findStructsOfGroup(struct.group)) {
            structTabs.appendChild(findButton(
                'algo-chip' + (s.id === struct.id ? ' on' : ''),
                s.name,
                () => selectStruct(s.id),
            ));
        }
    }

    /** 충돌을 넘기는 방식 버튼. **고를 수 없는 방법에서는 줄째 감춘다.** */
    function paintImpl() {
        const row = $('impl-row');
        const host = $('impl-buttons');
        host.textContent = '';
        if (!struct.impls) {
            row.classList.add('hidden');
            return;
        }
        row.classList.remove('hidden');
        for (const im of struct.impls) {
            host.appendChild(findButton(
                'preset-btn' + (im.id === implId ? ' on' : ''),
                im.name,
                () => {
                    if (implId === im.id) return;
                    implId = im.id;
                    rebuildState();
                    paintImpl();
                    paintOps();
                    paintLegend();
                    paintOpsState();
                    runIdle();
                },
            ));
        }
    }

    /* ---- 방법 카드 ---- */

    function paintStructCard() {
        $('struct-name').textContent = struct.name;
        $('struct-en').textContent = struct.en;
        setRich($('struct-idea'), struct.idea);
        setRich($('struct-watch'), struct.watch, 'font-black text-amber-950');

        const group = findGroupById(struct.group);
        $('group-name').textContent = group ? group.name : ' ';
        setRich($('group-blurb'), group ? group.blurb : ' ', 'font-black text-slate-800');

        const badges = $('struct-badges');
        badges.textContent = '';
        for (const f of struct.facts || []) {
            const wrap = document.createElement('div');
            wrap.className = 'flex flex-col sm:flex-row items-stretch sm:items-baseline '
                + 'gap-x-2 gap-y-0.5 min-w-0';
            const el = document.createElement('span');
            el.className = 'px-3 py-1 rounded-full font-bold border shrink-0 text-center '
                + (f.on ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-300 text-slate-600');
            el.textContent = f.text;
            const why = document.createElement('span');
            why.className = 'text-slate-500 font-medium min-w-0';
            why.textContent = f.hint;
            wrap.appendChild(el);
            wrap.appendChild(why);
            badges.appendChild(wrap);
        }

        const table = $('struct-cost');
        table.textContent = '';
        const head = document.createElement('tr');
        for (const [label, w] of [['무엇', ''], ['비용', 'w-36'], ['왜', '']]) {
            const th = document.createElement('th');
            th.className = `py-1.5 pr-4 text-left font-bold text-slate-500 ${w}`;
            th.textContent = label;
            head.appendChild(th);
        }
        table.appendChild(head);
        for (const [what, big, why] of struct.costRows) {
            const tr = document.createElement('tr');
            tr.className = 'border-t border-slate-100';
            for (const [text, cls] of [
                [what, 'py-1.5 pr-4 font-bold text-slate-700'],
                [big, 'py-1.5 pr-4 font-black text-slate-900 whitespace-nowrap'],
                [why, 'py-1.5 text-slate-500 font-medium'],
            ]) {
                const td = document.createElement('td');
                td.className = cls;
                td.textContent = text;
                tr.appendChild(td);
            }
            table.appendChild(tr);
        }
    }

    function paintLegend() {
        const host = $('legend');
        host.textContent = '';
        const keys = plan().impl?.legend || struct.legend || Object.keys(FIND_LEGEND);
        for (const key of keys) {
            const {tone, label, dashed} = FIND_LEGEND[key];
            const wrap = document.createElement('span');
            wrap.className = 'inline-flex items-center gap-2';
            const chip = document.createElement('span');
            chip.className = 'inline-block w-5 h-5 rounded border-2';
            chip.style.background = FIND_COLORS[tone].bg;
            chip.style.borderColor = FIND_COLORS[tone].line;
            if (dashed) chip.style.borderStyle = 'dashed';
            const text = document.createElement('span');
            text.textContent = label;
            wrap.appendChild(chip);
            wrap.appendChild(text);
            host.appendChild(wrap);
        }
    }

    /** 화면 읽는 법. **등록부에 방법마다 따로 적어 두었다** — 순차와 이진은 같은 그림을
     *  쓰지만 읽는 법이 다르다. 그림 종류로 고르면 그 차이가 사라진다. */
    function paintReadNotes() {
        const host = $('read-notes');
        host.textContent = '';
        for (const line of struct.readNotes || []) {
            const li = document.createElement('li');
            li.className = 'leading-relaxed';
            setRich(li, line, 'font-black text-slate-800');
            host.appendChild(li);
        }
    }

    /* ---- 연산 버튼 ---- */

    function paintOps() {
        const host = $('ops-host');
        host.textContent = '';
        for (const op of plan().ops) {
            const b = findButton('op-btn', op.name, () => doOperation(op));
            b.dataset.op = op.id;
            host.appendChild(b);
        }
    }

    /** 적어 넣은 값을 읽는다. **말없이 다른 값으로 바꿔치지 않는다.**
     *  @returns {number|null} 쓸 수 없는 값이면 `null`. 그때는 까닭을 화면에 적어 둔다. */
    function readValue() {
        const raw = $('value-input').value.trim();
        const v = Number(raw);
        if (raw === '' || !Number.isInteger(v) || v < 0 || v > FIND_VALUE_MAX) {
            $('input-error').textContent = `찾을 값은 0부터 ${FIND_VALUE_MAX}까지의 정수여야 합니다.`;
            return null;
        }
        return v;
    }

    function paintOpsState() {
        const label = $('size-label');
        if (struct.id === 'hash') label.textContent = `${state.size}개 / 칸 ${state.cap}개`;
        else if (struct.id === 'race') label.textContent = `${values.length}개`;
        else label.textContent = `${state.size}개`;

        /* **정렬되어 있는지를 늘 적어 둔다.** 이진 탐색이 기대는 전제라, 화면에 없으면
           흐트러진 자료에서 답을 놓쳤을 때 학생이 까닭을 찾을 데가 없다. */
        const sortedNote = $('sorted-label');
        if (!sortedNote) return;
        const sorted = values.every((v, i) => i === 0 || values[i - 1] <= v);
        sortedNote.textContent = values.length < 2 ? ' '
            : (sorted ? '정렬되어 있음' : '흐트러져 있음');
        sortedNote.className = 'font-bold ' + (sorted ? 'text-emerald-700' : 'text-rose-600');
    }

    function pushLog(op, counts) {
        log.unshift({name: op.name, counts});
        const host = $('op-log');
        host.textContent = '';
        for (const row of log.slice(0, 8)) {
            const li = document.createElement('li');
            li.className = 'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 '
                + 'border-t border-slate-100 py-1.5 first:border-t-0';
            const name = document.createElement('span');
            name.className = 'font-bold text-slate-700';
            name.textContent = row.name;
            const nums = document.createElement('span');
            nums.className = 'tally text-slate-500';
            nums.textContent = `비교 ${row.counts.compare} · 접근 ${row.counts.access} · 계산 ${row.counts.hash}`;
            const work = document.createElement('span');
            work.className = 'font-black text-slate-900 tally';
            work.textContent = `작업량 ${findWorkOf(row.counts)}`;
            li.appendChild(name);
            li.appendChild(nums);
            li.appendChild(work);
            host.appendChild(li);
        }
    }

    /* ---- 실행 ---- */

    function playFrames(frames, {onFrame} = {}) {
        player?.destroy();
        const scrub = $('scrub');
        scrub.max = String(Math.max(0, frames.length - 1));
        scrub.min = '0';
        scrub.value = '0';

        player = createStepPlayer({
            frames,
            render: (frame, prev, o) => {
                view.render(frame, prev, o);
                setRich($('say'), frame.say || ' ');
                if (onFrame) onFrame(frame);
            },
            onState: paintPlayerState,
        });
        player.setSpeed(currentSpeedMs());
        player.start();
    }

    function paintCounts(frame) {
        $('count-compare').textContent = String(frame.counts.compare);
        $('count-access').textContent = String(frame.counts.access);
        $('count-hash').textContent = String(frame.counts.hash);
    }

    function paintPlayerState({index, total, playing, atEnd}) {
        $('scrub').value = String(index);
        $('step-label').textContent = `${index} / ${Math.max(0, total - 1)} 단계`;
        $('btn-play').innerHTML = playing
            ? '<i class="fa-solid fa-pause"></i> 멈춤'
            : (atEnd ? '<i class="fa-solid fa-rotate-right"></i> 다시' : '<i class="fa-solid fa-play"></i> 재생');
        $('btn-prev').disabled = index === 0;
        $('btn-first').disabled = index === 0;
        $('btn-next').disabled = atEnd;
        $('btn-last').disabled = atEnd;
    }

    function idleFrame(st) {
        return {
            state: st,
            act: {kind: 'idle'},
            marks: {focus: [], hit: [], hitPos: null, ruled: [], banner: null},
            counts: {compare: 0, access: 0, hash: 0},
            say: st.size === 0
                ? '비어 있습니다. **자료를 넣고** 찾아 보세요.'
                : '**찾을 값**을 정하고 버튼을 누르면 어떻게 찾아 가는지 한 단계씩 보입니다.',
        };
    }

    /** 연산을 하나도 하지 않은, **지금 담긴 모습**을 한 장으로 보여 준다. */
    function runIdle() {
        const kind = struct.id === 'race' ? 'race' : plan().view;
        ensureView(kind);
        paintReadNotes();

        if (struct.id === 'race') {
            const frames = [{
                lanes: [
                    {kind: 'seq', name: '순차 탐색', frame: idleFrame(trio.seq), done: true, finishedWork: 0},
                    {kind: 'bin', name: '이진 탐색', frame: idleFrame(trio.bin), done: true, finishedWork: 0},
                    {kind: 'hash', name: '해시 테이블', frame: idleFrame(trio.hash), done: true, finishedWork: 0},
                ],
                counts: {compare: 0, access: 0, hash: 0},
                say: '버튼을 누르면 **세 가지가 같은 값을 한꺼번에** 찾습니다.',
            }];
            view.setup(frames, measured);
            $('tally-row').style.display = 'none';
            playFrames(frames);
            return;
        }

        $('tally-row').style.display = '';
        const frames = [idleFrame(state)];
        view.setup(frames);
        playFrames(frames, {onFrame: paintCounts});
    }

    function doOperation(op) {
        $('input-error').textContent = ' ';
        const v = readValue();
        if (v === null) return;

        /* **넣기에도 같은 상한을 건다.** 상한은 해시 표가 아니라 «칸 그림»이 걸어 둔 것이라
           (칸이 너무 많으면 좁은 화면에서 한 칸이 글자보다 좁아진다), 해시 탭에서 넘겨 담으면
           그 자료를 그대로 물려받는 순차·이진 탭이 대신 무너진다. 「직접 넣기」에만 걸어
           두었더니 버튼으로는 얼마든지 넘길 수 있었다. */
        if (op.id === 'hash-put' && values.length >= FIND_MAX_N && !values.includes(v)) {
            $('input-error').textContent = `${FIND_MAX_N}개까지만 담을 수 있습니다.`;
            return;
        }

        if (struct.id === 'race') {
            const built = buildFindRace(trio, v);
            /* **찾기는 담긴 것을 바꾸지 않으므로** 세 줄이 갈라질 일이 없다.
               그래도 상태를 받아 두는 것은 커서 같은 «회차가 남긴 흔적»을 잇기 위해서다. */
            if (!built.blocked) {
                trio = {
                    seq: built.runs[0].out.state,
                    bin: built.runs[1].out.state,
                    hash: built.runs[2].out.state,
                };
            }
            ensureView('race');
            paintReadNotes();
            view.setup(built.frames, measured);
            $('tally-row').style.display = 'none';
            playFrames(built.frames);
            /* **무른 회차는 기록하지 않는다.** 빈 자료에서도 해시 줄은 계산 한 번과 칸 한 번을
               쓰는데, 그 값을 기록에 남기면 «아무 일도 일어나지 않았습니다»라고 말해 놓고
               바로 아래에 작업량 2가 찍힌다. */
            if (!built.blocked) {
                pushLog(op, built.runs.reduce((a, r) => ({
                    compare: a.compare + r.out.counts.compare,
                    access: a.access + r.out.counts.access,
                    hash: a.hash + r.out.counts.hash,
                }), {compare: 0, access: 0, hash: 0}));
            }
            paintOpsState();
            return;
        }

        const out = runFindOperation(op, state, v);
        state = out.state;
        syncValues(out.state);

        ensureView(plan().view);
        paintReadNotes();
        view.setup(out.frames);
        $('tally-row').style.display = '';
        playFrames(out.frames, {onFrame: paintCounts});
        pushLog(op, out.counts);
        paintOpsState();
    }

    /* ---- 자료 ---- */

    /**
     * 연산이 끝난 상태를 보고 **담긴 값을 맞춘다. 순서는 지킨다.**
     *
     * 그냥 `findValues(state)`로 받으면 안 된다. 해시 상태는 값을 **칸 순서로** 내놓으므로,
     * 아무것도 바꾸지 않는 「찾기」를 한 번 눌렀을 뿐인데 자료가 통째로 뒤섞인다.
     * 그러면 이진 탐색 탭으로 돌아갔을 때 **학생이 흐트러뜨린 적도 없는데 답을 놓치기
     * 시작한다** — 「흐트러뜨리기」로 «일부러» 만들어야 가르칠 거리가 된다는 설계가 무너진다.
     *
     * 그래서 살아남은 값은 **있던 차례 그대로** 두고, 새로 들어온 값만 뒤에 붙인다.
     */
    function syncValues(st) {
        const now = new Set(findValues(st));
        const kept = values.filter((v) => now.has(v));
        const added = [...now].filter((v) => !kept.includes(v));
        values = [...kept, ...added];
    }

    function rebuildState() {
        if (struct.id === 'race') {
            trio = makeFindRaceStates(values);
            return;
        }
        if (struct.id === 'hash') {
            state = findHashState(FIND_HASH_CAP, values, implId);
            return;
        }
        state = findArrayState(values);
    }

    function selectStruct(id) {
        const next = findStructById(id);
        if (!next) return;
        struct = next;
        if (struct.impls && !struct.impls.some((i) => i.id === implId)) implId = struct.impls[0].id;
        rebuildState();
        paintTabs();
        paintImpl();
        paintStructCard();
        paintLegend();
        paintOps();
        paintOpsState();
        runIdle();
    }

    function applyValues(vals) {
        values = vals;
        rebuildState();
        paintOpsState();
        runIdle();
    }

    /* ---- 조작 줄 ---- */

    function currentSpeedMs() {
        const picked = PLAY_SPEEDS.find((s) => s.id === $('speed').value);
        return (picked || PLAY_SPEEDS[1]).ms;
    }

    function clearLog() {
        log.length = 0;
        $('op-log').textContent = '';
        $('input-error').textContent = ' ';
    }

    function wireControls() {
        const speed = $('speed');
        speed.textContent = '';
        for (const s of PLAY_SPEEDS) {
            const o = document.createElement('option');
            o.value = s.id;
            o.textContent = s.name;
            if (s.id === PLAY_SPEEDS[1].id) o.selected = true;
            speed.appendChild(o);
        }
        speed.value = PLAY_SPEEDS[1].id;
        speed.addEventListener('change', () => player?.setSpeed(currentSpeedMs()));

        $('btn-play').addEventListener('click', () => player?.toggle());
        $('btn-prev').addEventListener('click', () => player?.step(-1));
        $('btn-next').addEventListener('click', () => player?.step(1));
        $('btn-first').addEventListener('click', () => player?.toStart());
        $('btn-last').addEventListener('click', () => player?.toEnd());
        $('scrub').addEventListener('input', (e) => player?.seek(Number(e.target.value) || 0));

        $('btn-reset').addEventListener('click', () => {
            clearLog();
            applyValues([...FIND_START]);
        });
        $('btn-clear').addEventListener('click', () => {
            clearLog();
            applyValues([]);
        });
        $('btn-random').addEventListener('click', () => {
            clearLog();
            const n = 6 + Math.floor(Math.random() * 4);
            const pool = new Set();
            while (pool.size < n) pool.add(Math.floor(Math.random() * FIND_VALUE_MAX) + 1);
            /* **정렬해 내놓는다.** 이진 탐색이 그것을 전제로 하고, 흐트러진 자료는
               「흐트러뜨리기」로 «일부러» 만들어야 가르칠 거리가 된다. */
            applyValues([...pool].sort((a, b) => a - b));
        });
        $('btn-scramble').addEventListener('click', () => {
            clearLog();
            const next = [...values];
            for (let i = next.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [next[i], next[j]] = [next[j], next[i]];
            }
            applyValues(next);
        });

        $('btn-apply-input').addEventListener('click', () => {
            const raw = $('input-text').value.trim();
            const parts = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
            const nums = parts.map(Number);
            if (nums.some((x) => !Number.isFinite(x) || !Number.isInteger(x))) {
                $('input-error').textContent = '정수만 넣을 수 있습니다.';
                return;
            }
            if (nums.some((x) => x < 0 || x > FIND_VALUE_MAX)) {
                $('input-error').textContent = `값은 0부터 ${FIND_VALUE_MAX}까지만 넣을 수 있습니다.`;
                return;
            }
            if (nums.length > FIND_MAX_N) {
                $('input-error').textContent = `${FIND_MAX_N}개까지만 넣을 수 있습니다.`;
                return;
            }
            if (new Set(nums).size !== nums.length) {
                $('input-error').textContent = '같은 값을 두 번 넣을 수 없습니다.';
                return;
            }
            clearLog();
            applyValues(nums);
        });

        window.addEventListener('resize', () => view?.resize?.());
    }

    /* ---- 시작 ---- */

    measured = measureFindWork();
    wireControls();
    rebuildState();
    paintTabs();
    paintImpl();
    paintStructCard();
    paintLegend();
    paintOps();
    paintOpsState();
    runIdle();
}
