/* 화면 배선. **HTML은 뼈대만 두고 여기서 채운다** —
 * 탭도 연산 단추도 범례도 등록부에서 만들어 내므로, 구조를 하나 더하면 화면이 따라온다.
 * 손으로 적은 목록이 화면과 등록부 두 군데 있으면 반드시 어긋난다.
 *
 * **담은 값은 구조를 바꿔도 그대로 간다.** 「같은 자료를 이 구조에 넣으면 어떻게 되는가」가
 * 이 페이지의 쓰임이라, 탭을 옮길 때마다 자료가 처음으로 돌아가면 견줄 수가 없다.
 * 그래서 지금 담긴 값을 들고 있다가 옮겨 간 구조를 그 값으로 다시 세운다.
 */

import {
    DS_GROUPS, DS_STRUCTS, DS_START, DS_CAP, DS_COMPARE,
    dsStructById, dsStructsOfGroup, dsGroupById, dsGroupsInUse, dsPlanOf,
} from './ds-registry.js';
import {runDsOperation, dsValues} from './ds-model.js';
import {buildDsCompare, measureDsWork, dsWorkOf} from './ds-compare.js';
import {createDsCellsView, DS_COLORS} from './ds-view-cells.js';
import {createDsListView} from './ds-view-list.js';
import {createDsCompareView} from './ds-view-compare.js';
import {createStepPlayer, PLAY_SPEEDS} from '../step-player.js';
import {DS_VALUE_MAX} from './ds-ops.js';

const DS_LEGEND = [
    {key: 'idle', label: '그대로 있는 것'},
    {key: 'focus', label: '지금 들여다보는 것'},
    {key: 'moving', label: '방금 움직인 것'},
    {key: 'newborn', label: '아직 매달리지 않은 새 마디'},
    {key: 'doomed', label: '곧 떼어 낼 것'},
];

const $ = (id) => document.getElementById(id);

/* 설명문의 `**굵게**`와 백틱 코드를 실제로 그렇게 낸다. `textContent`로 넣으면
   별표와 백틱이 **그대로 화면에 찍힌다.** 넣는 글은 전부 우리가 쓴 것이지만
   꺾쇠는 먼저 막아 둔다 — 나중에 누가 이 자리에 남의 글을 흘려 넣을 수 있다. */
function setRich(el, text, strongClass = 'font-black text-slate-900') {
    const safe = String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = safe
        .replace(/\*\*([^*]+)\*\*/g, (_, inner) => `<strong class="${strongClass}">${inner}</strong>`)
        .replace(/`([^`]+)`/g,
            (_, inner) => `<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-800">${inner}</code>`);
}

function dsButton(cls, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
}

export function mountDsSimulator() {
    let struct = DS_STRUCTS[0];
    let implId = 'array';
    let values = [...DS_START];
    let state = null;          // 지금 구조의 상태
    let pair = null;           // 비용 비교일 때의 두 상태
    let player = null;
    let view = null;
    let viewKind = null;
    let lastOp = null;
    const log = [];            // 지금까지 한 연산

    /* 그림은 구조가 고른다. **바뀔 때만 새로 만든다** — 연산마다 다시 만들면 상자가 깜빡인다.
       다만 담는 방식을 바꾸면 그림도 갈리므로 그때는 새로 만들어야 한다. */
    function ensureView(kind) {
        /* **구조까지 넣어 견준다.** 끝 이름표(스택의 「top」, 큐의 「front」)가 구조마다
           다르므로, 같은 「칸 그림」이라도 구조가 바뀌면 새로 만들어야 한다. */
        const want = `${kind}:${struct.id}`;
        if (viewKind === want) return;
        viewKind = want;
        const host = $('view-host');
        const endMarks = struct.endMarks;
        if (kind === 'list') view = createDsListView(host);
        else if (kind === 'ring') view = createDsCellsView(host, {layout: 'ring'});
        else if (kind === 'compare') view = createDsCompareView(host);
        else view = createDsCellsView(host, {layout: 'row', endMarks});
    }

    const plan = () => dsPlanOf(struct, implId);

    /* ---- 위쪽: 무리 탭과 구조 칩 ---- */

    function paintTabs() {
        const groupTabs = $('group-tabs');
        groupTabs.textContent = '';
        for (const g of dsGroupsInUse()) {
            groupTabs.appendChild(dsButton(
                'group-tab' + (g.id === struct.group ? ' on' : ''),
                g.name,
                () => {
                    const first = dsStructsOfGroup(g.id)[0];
                    if (first) selectStruct(first.id);
                },
            ));
        }

        const structTabs = $('struct-tabs');
        structTabs.textContent = '';
        for (const s of dsStructsOfGroup(struct.group)) {
            structTabs.appendChild(dsButton(
                'algo-chip' + (s.id === struct.id ? ' on' : ''),
                s.name,
                () => selectStruct(s.id),
            ));
        }
    }

    /** 담는 방식 단추. **고를 수 없는 구조에서는 줄째 감춘다** —
     *  단추를 눌러도 아무 일이 없으면 고장으로 읽힌다. */
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
            host.appendChild(dsButton(
                'preset-btn' + (im.id === implId ? ' on' : ''),
                im.name,
                () => {
                    if (implId === im.id) return;
                    implId = im.id;
                    rebuildState();
                    paintImpl();
                    paintOps();
                    /* **개수 표시도 함께 고친다.** 담는 방식이 바뀌면 칸 수라는 개념이
                       생기거나 없어진다 — 배열은 「5 / 10개」, 마디는 「5개」다.
                       이것을 빠뜨리면 다음 연산을 누를 때까지 앞 방식의 표기가 남아,
                       칸 수가 없는 리스트에 상한이 붙거나 꽉 차 가는 배열의 상한이 사라진다. */
                    paintOpsState();
                    runIdle();
                },
            ));
        }
    }

    /* ---- 구조 카드 ---- */

    function paintStructCard() {
        $('struct-name').textContent = struct.name;
        $('struct-en').textContent = struct.en;
        setRich($('struct-idea'), struct.idea);
        setRich($('struct-watch'), struct.watch, 'font-black text-amber-950');

        const group = dsGroupById(struct.group);
        $('group-name').textContent = group ? group.name : ' ';
        setRich($('group-blurb'), group ? group.blurb : ' ', 'font-black text-slate-800');

        /* **배지의 뜻을 화면에 낸다.** 예전에는 `title`(마우스 툴팁)에만 있어
           교실 화면과 터치 기기에서는 보이지 않았다 — 색만 보고 뜻을 짐작하게 된다. */
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
        for (const [label, w] of [['연산', ''], ['드는 값', 'w-28'], ['왜', '']]) {
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
                [big, 'py-1.5 pr-4 font-black text-slate-900 font-mono whitespace-nowrap'],
                [why, 'py-1.5 text-slate-600 font-medium'],
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
        for (const item of DS_LEGEND) {
            const tone = DS_COLORS[item.key];
            const wrap = document.createElement('span');
            wrap.className = 'inline-flex items-center gap-2';
            const chip = document.createElement('span');
            Object.assign(chip.style, {
                width: '14px', height: '14px', borderRadius: '3px',
                background: tone.bg, border: `1px solid ${tone.line}`, display: 'inline-block',
            });
            const text = document.createElement('span');
            text.textContent = item.label;
            wrap.appendChild(chip);
            wrap.appendChild(text);
            host.appendChild(wrap);
        }
    }

    /* ---- 화면 읽는 법. **지금 화면에 실제로 나오는 것만 적는다.** ---- */

    function paintReadNotes(kind) {
        const host = $('read-notes');
        host.textContent = '';
        const lines = [];
        if (kind === 'compare') {
            lines.push('위는 **배열**, 아래는 **단일 연결 리스트**입니다. 같은 값을 담고 같은 연산을 받습니다.');
            lines.push('작업량(접근 + 이동 + 링크)을 똑같이 나눠 주므로 **먼저 「끝」이 붙은 쪽이 일을 덜 한 것**입니다.');
            lines.push('아래 표는 개수를 키워 가며 측정한 것입니다. **굵고 진한 쪽이 그 개수에서 값이 싼 쪽**입니다.');
        } else if (kind === 'list') {
            lines.push('마디는 **값 칸과 링크 칸**으로 되어 있습니다. 링크도 마디에 담긴 값 하나입니다.');
            lines.push('링크 칸의 **빗금**은 가리킬 것이 없다(`null`)는 뜻입니다.');
            lines.push('**방금 고쳐 쓴 링크는 붉게** 그립니다. 이 붉은 줄의 수가 곧 「링크」 횟수입니다.');
            lines.push('점선 상자는 **아직 줄에 매달리지 않은 새 마디**입니다.');
            lines.push('마디를 늘어놓은 자리는 **읽기 좋으라고** 정한 것입니다. '
                + '실제 메모리에서 마디는 흩어져 있고, 넣고 뺄 때 **움직이지 않습니다.**');
        } else if (kind === 'ring') {
            lines.push('칸을 **동그랗게 이어 붙였다고 치고** 그렸습니다. 실제로는 그냥 배열이고 자리 번호만 돌립니다.');
            lines.push('**front**는 다음에 뺄 자리, **rear**는 다음에 넣을 자리입니다.');
            lines.push('둘이 같은 칸을 가리키면 **비었거나 꽉 찬 것**입니다. 그래서 개수를 따로 세어 둡니다.');
        } else {
            lines.push('칸은 **미리 정해 둔 수(10개)**만큼 있습니다. 점선 칸은 아직 비어 있는 자리입니다.');
            lines.push('상자가 옆으로 미끄러지면 **밀거나 당긴 것**입니다.');
            lines.push('「이동」은 **칸에 값을 써넣은 횟수**입니다 — 밀어낸 상자 수에 '
                + '**새 값을 써넣는 한 번이 더해집니다.** 그래서 아무것도 밀지 않는 「뒤에 넣기」도 1입니다.');
            lines.push('칸 위의 이름표는 **자리 번호를 담은 변수**입니다.');
        }
        for (const line of lines) {
            const li = document.createElement('li');
            li.className = 'leading-relaxed';
            setRich(li, line, 'font-black text-slate-800');
            host.appendChild(li);
        }
    }

    /* ---- 연산 단추 ---- */

    function paintOps() {
        const host = $('ops-host');
        host.textContent = '';
        for (const op of plan().ops) {
            const b = dsButton('op-btn', op.name, () => doOperation(op));
            b.dataset.op = op.id;
            host.appendChild(b);
        }
        paintArgRow();
    }

    /** **이 구조가 쓰는 연산 전부**를 보고 입력 칸을 낸다.
     *
     *  예전에는 «방금 누른» 연산만 보았다. 그러면 자리 번호를 받는 연산을 처음 누를 때
     *  칸이 아직 감춰져 있어 **번호를 정할 수가 없었다** — 한 번 헛돌리고 나서야 칸이
     *  나타났다. 무엇을 누를지는 학생이 정하는 것이므로 미리 다 내 둔다. */
    function paintArgRow() {
        const args = plan().ops.map((op) => op.arg);
        const wantsValue = args.some((a) => a === 'value' || a === 'valueIndex');
        const wantsIndex = args.some((a) => a === 'index' || a === 'valueIndex');
        $('value-wrap').classList.toggle('hidden', !wantsValue);
        $('index-wrap').classList.toggle('hidden', !wantsIndex);
        $('arg-row').classList.toggle('hidden', !wantsValue && !wantsIndex);
    }

    /** 적어 넣은 값을 읽는다. **말없이 다른 값으로 바꿔치지 않는다.**
     *
     *  예전에는 범위 밖이면 무작위 값을 대신 넣었다. 그러면 학생이 `200`을 적고 단추를
     *  누른 뒤 화면에 `37`이 들어가는 것을 보게 된다 — 무엇이 잘못됐는지 알 길이 없다.
     *  바로 옆 「직접 넣기」는 같은 값을 제대로 막고 있었으니, 한 페이지의 두 입력이
     *  다른 규칙으로 논 셈이다.
     *
     *  @returns {object|null} 쓸 수 없는 값이면 `null`. 그때는 까닭을 화면에 적어 둔다. */
    function readArg(op) {
        const rawV = $('value-input').value.trim();
        const v = Number(rawV);
        if (op.arg === 'value' || op.arg === 'valueIndex') {
            if (rawV === '' || !Number.isInteger(v) || v < 0 || v > DS_VALUE_MAX) {
                $('input-error').textContent = `넣을 값은 0부터 ${DS_VALUE_MAX}까지의 정수여야 합니다.`;
                return null;
            }
        }
        const rawI = $('index-input').value.trim();
        const i = Number(rawI);
        if (op.arg === 'index' || op.arg === 'valueIndex') {
            if (rawI === '' || !Number.isInteger(i) || i < 0) {
                $('input-error').textContent = '자리 번호는 0 이상의 정수여야 합니다.';
                return null;
            }
        }
        return {v: Number.isInteger(v) ? v : 0, i: Number.isInteger(i) ? i : 0, opId: op.id};
    }

    /** 넣을 값을 채워 둔다. **빈 칸을 두지 않는다** — 단추를 눌렀는데 아무 일도
     *  안 나면 고장으로 읽힌다.
     *
     *  **연산이 끝날 때마다 부르지는 않는다.** 카드가 「넣는 값은 하나로 같은데 옮김
     *  횟수가 전혀 다릅니다」라며 같은 값으로 두 연산을 대 보라고 시키는데, 누를 때마다
     *  값이 무작위로 바뀌면 그 대조를 할 수가 없다. 자료를 갈아 끼울 때만 새로 채운다. */
    function refillValue() {
        $('value-input').value = String(Math.floor(Math.random() * DS_VALUE_MAX) + 1);
    }

    function pushLog(op, counts, ok = true) {
        log.unshift({name: op.name, counts, ok});
        if (log.length > 12) log.pop();
        const host = $('op-log');
        host.textContent = '';
        if (!log.length) return;
        for (const row of log) {
            const li = document.createElement('li');
            li.className = 'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-slate-100 py-1';
            const name = document.createElement('span');
            name.className = 'font-black text-slate-800';
            name.textContent = row.name;
            const nums = document.createElement('span');
            nums.className = 'tally font-semibold text-slate-500';
            nums.textContent = `접근 ${row.counts.access} · 이동 ${row.counts.move} · 링크 ${row.counts.link}`;
            const work = document.createElement('span');
            work.className = 'tally font-black text-slate-900';
            work.textContent = `작업량 ${dsWorkOf(row.counts)}`;
            li.appendChild(name);
            li.appendChild(nums);
            li.appendChild(work);
            host.appendChild(li);
        }
    }

    /* ---- 돌리기 ---- */

    /** 표는 연산 목록만 타므로 한 번 재어 두고 다시 쓴다. */
    let measured = null;

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
        $('count-access').textContent = String(frame.counts.access);
        $('count-move').textContent = String(frame.counts.move);
        $('count-link').textContent = String(frame.counts.link);
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

    /** 연산을 하나도 하지 않은, **지금 담긴 모습**을 한 장으로 보여 준다. */
    function runIdle() {
        const kind = struct.id === 'compare' ? 'compare' : plan().view;
        ensureView(kind);
        paintReadNotes(kind);

        if (struct.id === 'compare') {
            const frames = [{
                lanes: [
                    {kind: 'array', name: '배열', frame: idleFrame(pair.array), done: true, finishedWork: 0},
                    {kind: 'list', name: '단일 연결 리스트', frame: idleFrame(pair.list), done: true, finishedWork: 0},
                ],
                counts: {access: 0, move: 0, link: 0},
                say: '연산 단추를 누르면 **두 구조가 같은 일을 한꺼번에** 합니다.',
            }];
            view.setup(frames, measured, lastOp ? lastOp.id : null);
            $('tally-row').style.display = 'none';
            playFrames(frames);
            return;
        }

        $('tally-row').style.display = '';
        const frames = [idleFrame(state)];
        view.setup(frames);
        playFrames(frames, {onFrame: paintCounts});
    }

    function idleFrame(st) {
        return {
            state: st,
            act: {kind: 'idle'},
            marks: {focus: [], moving: [], linkFix: [], newborn: null, doomed: null, banner: null},
            counts: {access: 0, move: 0, link: 0},
            say: st.size === 0
                ? '비어 있습니다. **연산 단추**를 눌러 값을 넣어 보세요.'
                : '연산 단추를 누르면 그 연산이 **어떻게 이루어지는지** 한 단계씩 보입니다.',
        };
    }

    function doOperation(op) {
        lastOp = op;
        $('input-error').textContent = ' ';
        const arg = readArg(op);
        if (!arg) return;

        if (struct.id === 'compare') {
            const built = buildDsCompare(op, pair, arg);
            /* **막힌 판은 상태를 물려받지 않는다.** 한쪽만 나아가면 두 줄의 담긴 것이
               갈라져, 그 뒤의 견주기가 통째로 뜻을 잃는다 → `ds-compare.js` */
            if (!built.blocked) {
                pair = {array: built.runs[0].out.state, list: built.runs[1].out.state};
                values = dsValues(pair.array);
            }
            ensureView('compare');
            paintReadNotes('compare');
            view.setup(built.frames, measured, op.id);
            $('tally-row').style.display = 'none';
            playFrames(built.frames);
            pushLog(op, {
                access: built.runs[0].out.counts.access + built.runs[1].out.counts.access,
                move: built.runs[0].out.counts.move + built.runs[1].out.counts.move,
                link: built.runs[0].out.counts.link + built.runs[1].out.counts.link,
            });
            paintOpsState();
            return;
        }

        const out = runDsOperation(op, state, arg);
        state = out.state;
        values = dsValues(state);

        ensureView(plan().view);
        paintReadNotes(plan().view);
        view.setup(out.frames);
        $('tally-row').style.display = '';
        playFrames(out.frames, {onFrame: paintCounts});
        pushLog(op, out.counts);
        paintOpsState();
    }

    /** 지금 눌러도 되는 연산인지 단추에 비춘다. **막지는 않는다** —
     *  꽉 찬 배열에 넣어 보는 것도 배울 거리라, 눌러서 「꽉 찼습니다」를 보는 편이 낫다. */
    function paintOpsState() {
        const size = struct.id === 'compare' ? (pair ? pair.array.size : 0) : state.size;
        $('size-label').textContent = struct.id === 'compare'
            ? `${size}개`
            : (state.store === 'array' ? `${size} / ${state.cap}개` : `${size}개`);
        const idx = $('index-input');
        idx.max = String(Math.max(0, size));
    }

    /* ---- 자료 ---- */

    /** 비용 비교의 두 상태. **등록부의 배열·단일 연결 리스트를 그대로 쓴다** —
     *  여기서 따로 만들면 탭을 옮겼을 때 같은 구조가 다르게 굴 수 있다. */
    function makeCompareStates(vals) {
        return {
            array: dsStructById('array').makeState(vals),
            list: dsStructById('slist').makeState(vals),
        };
    }

    function rebuildState() {
        if (struct.id === 'compare') {
            pair = makeCompareStates(values);
            return;
        }
        state = struct.makeState(values, implId);
    }

    function selectStruct(id) {
        const next = dsStructById(id);
        if (!next) return;
        struct = next;
        if (struct.impls && !struct.impls.some((i) => i.id === implId)) implId = struct.impls[0].id;
        /* 담을 수 있는 것보다 값이 많으면 앞에서부터 담을 수 있는 만큼만 옮긴다.
           **말없이 잘라 내지 않는다** — 값이 사라진 것을 고장으로 읽는다. */
        if (values.length > DS_CAP) {
            values = values.slice(0, DS_CAP);
            $('input-error').textContent = `칸이 ${DS_CAP}개라 앞의 ${DS_CAP}개만 옮겼습니다.`;
        }
        /* **연산 목록이 구조마다 다르므로 고른 연산도 따라 바꾼다.** 앞 구조의 연산을
           들고 있으면 입력 칸이 엉뚱한 것을 보인다(값을 받는 자리에 자리 번호 칸). */
        lastOp = dsPlanOf(struct, implId).ops[0];
        rebuildState();
        paintTabs();
        paintImpl();
        paintStructCard();
        paintOps();
        paintOpsState();
        runIdle();
    }

    function applyValues(vals) {
        values = vals;
        refillValue();
        rebuildState();
        paintOpsState();
        runIdle();
    }

    /* ---- 조작 줄 ---- */

    function currentSpeedMs() {
        const picked = PLAY_SPEEDS.find((s) => s.id === $('speed').value);
        return (picked || PLAY_SPEEDS[1]).ms;
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
            log.length = 0;
            $('op-log').textContent = '';
            $('input-error').textContent = ' ';
            applyValues([...DS_START]);
        });
        $('btn-clear').addEventListener('click', () => {
            log.length = 0;
            $('op-log').textContent = '';
            $('input-error').textContent = ' ';
            applyValues([]);
        });
        $('btn-random').addEventListener('click', () => {
            const n = 3 + Math.floor(Math.random() * 4);
            applyValues(Array.from({length: n}, () => Math.floor(Math.random() * DS_VALUE_MAX) + 1));
        });

        $('btn-apply-input').addEventListener('click', () => {
            const raw = $('input-text').value.trim();
            const parts = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
            const nums = parts.map(Number);
            if (nums.some((x) => !Number.isFinite(x) || !Number.isInteger(x))) {
                $('input-error').textContent = '정수만 넣을 수 있습니다.';
                return;
            }
            if (nums.some((x) => x < 0 || x > DS_VALUE_MAX)) {
                $('input-error').textContent = `값은 0부터 ${DS_VALUE_MAX}까지만 넣을 수 있습니다.`;
                return;
            }
            if (nums.length > DS_CAP) {
                $('input-error').textContent = `칸이 ${DS_CAP}개라 ${DS_CAP}개까지만 넣을 수 있습니다.`;
                return;
            }
            $('input-error').textContent = ' ';
            applyValues(nums);
        });

        /* 창 크기가 바뀌면 동그라미 지름을 다시 잡아야 한다. 줄과 마디 그림은
           백분율·viewBox라 스스로 따라가지만, 부르는 것이 해로울 것은 없다. */
        window.addEventListener('resize', () => view?.resize?.());
    }

    /* ---- 시작 ---- */

    measured = measureDsWork(DS_COMPARE.ops);
    wireControls();
    refillValue();
    lastOp = plan().ops[0];
    rebuildState();
    paintTabs();
    paintImpl();
    paintStructCard();
    paintLegend();
    paintOps();
    paintOpsState();
    runIdle();
}
