/* 화면 배선. HTML은 뼈대만 두고 여기서 채운다 → `ds-ui.js`와 같은 뼈대다.
 *
 * **다른 것이 하나 있다. 트리는 「담긴 값」이 아니라 「넣은 차례」를 물려준다.**
 * 트리는 넣는 차례가 모양을 정하므로, 탭을 옮길 때 담긴 값만 물려주면 모양이 달라진다.
 * 특히 중위 순회로 뽑은 값은 오름차순이라, 그것을 이진 탐색 트리에 다시 넣으면
 * **아무것도 안 했는데 한 줄로 늘어진 최악의 트리**가 된다.
 * 그래서 넣은 차례를 들고 있다가 옮겨 간 구조에 **같은 차례로 다시 넣는다.**
 */

import {
    TREE_STRUCTS, TREE_START, TREE_COMPARE, TREE_INSERT_OPS, HEAP_CAP,
    treeStructById, treeStructsOfGroup, treeGroupById, treeGroupsInUse, treeComparePair,
} from './tree-registry.js';
import {runTreeOperation, treeValues, treeHeight} from './tree-model.js';
import {buildTreeCompare, measureTreeHeight, treeWorkOf} from './tree-compare.js';
import {createTreeLinkedView, TREE_TONES} from './tree-view-linked.js';
import {createTreeHeapView} from './tree-view-heap.js';
import {createTreeCompareView} from './tree-view-compare.js';
import {createSortPlayer, SORT_SPEEDS} from '../sort/sort-player.js';
import {TREE_VALUE_MAX} from './tree-ops.js';

const TREE_LEGEND = [
    {key: 'idle', label: '그대로 있는 것'},
    {key: 'focus', label: '지금 견주는 마디'},
    {key: 'moving', label: '방금 움직인 것'},
    {key: 'newborn', label: '아직 매달리지 않은 새 마디'},
    {key: 'doomed', label: '곧 떼어 낼 것'},
];

const $ = (id) => document.getElementById(id);

/* `**굵게**`와 백틱 코드를 실제로 그렇게 낸다. `textContent`로 넣으면
   별표와 백틱이 **그대로 화면에 찍힌다.** */
function setRich(el, text, strongClass = 'font-black text-slate-900') {
    const safe = String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = safe
        .replace(/\*\*([^*]+)\*\*/g, (_, inner) => `<strong class="${strongClass}">${inner}</strong>`)
        .replace(/`([^`]+)`/g,
            (_, inner) => `<code class="px-1 py-0.5 rounded bg-slate-100 text-slate-800">${inner}</code>`);
}

function treeButton(cls, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
}

export function mountTreeSimulator() {
    let struct = TREE_STRUCTS[0];
    let order = [...TREE_START];   // **넣은 차례.** 담긴 값이 아니다
    let state = null;
    let pair = null;
    let player = null;
    let view = null;
    let viewKind = null;
    let lastOp = null;
    const log = [];
    let measured = null;

    function ensureView(kind) {
        if (viewKind === kind) return;
        viewKind = kind;
        const host = $('view-host');
        if (kind === 'heap') view = createTreeHeapView(host);
        else if (kind === 'compare') view = createTreeCompareView(host);
        else view = createTreeLinkedView(host, {showBalance: kind === 'linked-balance'});
    }

    /* ---- 탭 ---- */

    function paintTabs() {
        const groupTabs = $('group-tabs');
        groupTabs.textContent = '';
        for (const g of treeGroupsInUse()) {
            groupTabs.appendChild(treeButton(
                'group-tab' + (g.id === struct.group ? ' on' : ''),
                g.name,
                () => {
                    const first = treeStructsOfGroup(g.id)[0];
                    if (first) selectStruct(first.id);
                },
            ));
        }
        const structTabs = $('struct-tabs');
        structTabs.textContent = '';
        for (const s of treeStructsOfGroup(struct.group)) {
            structTabs.appendChild(treeButton(
                'algo-chip' + (s.id === struct.id ? ' on' : ''),
                s.name,
                () => selectStruct(s.id),
            ));
        }
    }

    /* ---- 구조 카드 ---- */

    function paintStructCard() {
        $('struct-name').textContent = struct.name;
        $('struct-en').textContent = struct.en;
        setRich($('struct-idea'), struct.idea);
        setRich($('struct-watch'), struct.watch, 'font-black text-amber-950');

        const group = treeGroupById(struct.group);
        $('group-name').textContent = group ? group.name : ' ';
        setRich($('group-blurb'), group ? group.blurb : ' ', 'font-black text-slate-800');

        const badges = $('struct-badges');
        badges.textContent = '';
        for (const f of struct.facts || []) {
            const el = document.createElement('span');
            el.className = 'px-3 py-1 rounded-full font-bold border '
                + (f.on ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-300 text-slate-600');
            el.textContent = f.text;
            el.title = f.hint;
            badges.appendChild(el);
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
                [big, 'py-1.5 pr-4 font-black text-slate-900 font-mono'],
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
        for (const item of TREE_LEGEND) {
            const tone = TREE_TONES[item.key];
            const wrap = document.createElement('span');
            wrap.className = 'inline-flex items-center gap-2';
            const chip = document.createElement('span');
            Object.assign(chip.style, {
                width: '14px', height: '14px', borderRadius: '9999px',
                background: tone.bg, border: `1px solid ${tone.line}`, display: 'inline-block',
            });
            const text = document.createElement('span');
            text.textContent = item.label;
            wrap.appendChild(chip);
            wrap.appendChild(text);
            host.appendChild(wrap);
        }
    }

    function paintReadNotes(kind) {
        const host = $('read-notes');
        host.textContent = '';
        const lines = [];
        if (kind === 'compare') {
            lines.push('위는 **이진 탐색 트리**, 아래는 **AVL 트리**입니다. 같은 값을 같은 차례로 받습니다.');
            lines.push('작업량(비교 + 이동 + 링크)을 똑같이 나눠 주므로 **먼저 「끝」이 붙은 쪽이 일을 덜 한 것**입니다.');
            lines.push('아래 표는 개수를 키워 가며 잰 **높이**입니다. 굵고 진한 쪽이 그 개수에서 낮은 쪽입니다.');
        } else if (kind === 'heap') {
            lines.push('**위 트리와 아래 배열은 같은 것입니다.** 마디 위의 작은 수가 배열의 자리 번호입니다.');
            lines.push('부모는 `(자리 − 1) ÷ 2`, 자식은 `2 × 자리 + 1`과 `2 × 자리 + 2`입니다. **링크가 없습니다.**');
            lines.push('점선 칸은 아직 쓰지 않은 자리입니다. 힙은 **앞에서부터 빈틈없이** 채웁니다.');
        } else {
            lines.push('마디를 놓은 가로 자리는 **중위 순회 차례**입니다. 그래서 왼쪽 자식은 늘 왼쪽에, 오른쪽 자식은 늘 오른쪽에 그려집니다.');
            lines.push('**방금 고쳐 쓴 링크는 붉게** 그립니다. 그 수가 곧 「링크」 횟수입니다.');
            lines.push('점선 동그라미는 **새 마디가 달릴 자리**입니다.');
            if (kind === 'linked-balance') {
                lines.push('마디 옆의 수가 **균형 인수**(왼쪽 높이 − 오른쪽 높이)입니다. **붉게 바뀌면 돌려야 한다는 뜻**입니다.');
            }
        }
        for (const line of lines) {
            const li = document.createElement('li');
            li.className = 'leading-relaxed';
            setRich(li, line, 'font-black text-slate-800');
            host.appendChild(li);
        }
    }

    /* ---- 연산 ---- */

    function paintOps() {
        const host = $('ops-host');
        host.textContent = '';
        for (const op of struct.ops) {
            const b = treeButton('op-btn', op.name, () => doOperation(op));
            b.dataset.op = op.id;
            host.appendChild(b);
        }
        paintArgRow();
    }

    function paintArgRow() {
        const need = lastOp ? lastOp.arg : 'value';
        $('arg-row').classList.toggle('hidden', need !== 'value');
    }

    function readArg() {
        const raw = Number($('value-input').value);
        const v = Number.isFinite(raw) && raw >= 0 && raw <= TREE_VALUE_MAX
            ? Math.round(raw) : Math.floor(Math.random() * TREE_VALUE_MAX) + 1;
        return {v};
    }

    function refillValue() {
        $('value-input').value = String(Math.floor(Math.random() * TREE_VALUE_MAX) + 1);
    }

    function pushLog(op, counts) {
        log.unshift({name: op.name, counts});
        if (log.length > 12) log.pop();
        const host = $('op-log');
        host.textContent = '';
        for (const row of log) {
            const li = document.createElement('li');
            li.className = 'flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border-b border-slate-100 py-1';
            const name = document.createElement('span');
            name.className = 'font-black text-slate-800';
            name.textContent = row.name;
            const nums = document.createElement('span');
            nums.className = 'tally font-semibold text-slate-500';
            nums.textContent = `비교 ${row.counts.compare} · 이동 ${row.counts.move} · 링크 ${row.counts.link}`;
            const work = document.createElement('span');
            work.className = 'tally font-black text-slate-900';
            work.textContent = `작업량 ${treeWorkOf(row.counts)}`;
            li.appendChild(name);
            li.appendChild(nums);
            li.appendChild(work);
            host.appendChild(li);
        }
    }

    /* ---- 돌리기 ---- */

    function playFrames(frames, {onFrame} = {}) {
        player?.destroy();
        const scrub = $('scrub');
        scrub.max = String(Math.max(0, frames.length - 1));
        scrub.min = '0';
        scrub.value = '0';

        player = createSortPlayer({
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

    function idleFrame(st) {
        return {
            state: st,
            act: {kind: 'idle'},
            marks: {focus: [], moving: [], linkFix: [], newborn: null, doomed: null, banner: null, spot: null},
            counts: {compare: 0, move: 0, link: 0},
            say: st.size === 0
                ? '비어 있습니다. **연산 단추**를 눌러 값을 넣어 보세요.'
                : '연산 단추를 누르면 그 연산이 **어떻게 이루어지는지** 한 단계씩 보입니다.',
        };
    }

    function runIdle() {
        const kind = struct.id === 'compare' ? 'compare' : struct.view;
        ensureView(kind);
        paintReadNotes(kind);

        if (struct.id === 'compare') {
            const frames = [{
                lanes: [
                    {
                        kind: 'bst', name: '이진 탐색 트리', frame: idleFrame(pair.bst),
                        done: true, finishedWork: 0, height: treeHeight(pair.bst),
                    },
                    {
                        kind: 'avl', name: 'AVL 트리', frame: idleFrame(pair.avl),
                        done: true, finishedWork: 0, height: treeHeight(pair.avl),
                    },
                ],
                counts: {compare: 0, move: 0, link: 0},
                say: '연산 단추를 누르면 **두 트리가 같은 값을 한꺼번에** 받습니다.',
            }];
            view.setup(frames, measured);
            $('tally-row').style.display = 'none';
            playFrames(frames);
            paintState();
            return;
        }

        $('tally-row').style.display = '';
        const frames = [idleFrame(state)];
        view.setup(frames);
        playFrames(frames, {onFrame: paintCounts});
        paintState();
    }

    function doOperation(op) {
        lastOp = op;
        paintArgRow();
        const arg = readArg();
        $('input-error').textContent = ' ';

        if (struct.id === 'compare') {
            const built = buildTreeCompare(op, pair, arg);
            pair = {bst: built.runs[0].out.state, avl: built.runs[1].out.state};
            syncOrder(treeValues(pair.bst));
            ensureView('compare');
            paintReadNotes('compare');
            view.setup(built.frames, measured);
            $('tally-row').style.display = 'none';
            playFrames(built.frames);
            pushLog(op, {
                compare: built.runs[0].out.counts.compare + built.runs[1].out.counts.compare,
                move: built.runs[0].out.counts.move + built.runs[1].out.counts.move,
                link: built.runs[0].out.counts.link + built.runs[1].out.counts.link,
            });
            refillValue();
            paintState();
            return;
        }

        const out = runTreeOperation(op, state, arg);
        state = out.state;
        syncOrder(treeValues(state));
        refillValue();

        ensureView(struct.view);
        paintReadNotes(struct.view);
        view.setup(out.frames);
        $('tally-row').style.display = '';
        playFrames(out.frames, {onFrame: paintCounts});
        pushLog(op, out.counts);
        paintState();
    }

    /** 넣은 차례를 지금 담긴 값에 맞춘다. **차례를 지키면서** 사라진 것을 빼고 새것을 뒤에 붙인다. */
    function syncOrder(present) {
        const has = new Set(present);
        order = order.filter((v) => has.has(v));
        for (const v of present) if (!order.includes(v)) order.push(v);
    }

    function paintState() {
        const st = struct.id === 'compare' ? pair.bst : state;
        $('size-label').textContent = `${st.size}개`;
        $('height-label').textContent = `${treeHeight(st)}`;
    }

    /* ---- 자료 ---- */

    function rebuildState() {
        if (struct.id === 'compare') { pair = treeComparePair(order); return; }
        state = struct.makeState(order);
    }

    function selectStruct(id) {
        const next = treeStructById(id);
        if (!next) return;
        struct = next;
        lastOp = struct.ops[0];
        if (struct.id === 'heap' && order.length > HEAP_CAP) {
            order = order.slice(0, HEAP_CAP);
            $('input-error').textContent = `힙은 칸이 ${HEAP_CAP}개라 앞의 ${HEAP_CAP}개만 옮겼습니다.`;
        }
        rebuildState();
        paintTabs();
        paintStructCard();
        paintOps();
        runIdle();
    }

    function applyOrder(vals) {
        order = vals;
        rebuildState();
        runIdle();
    }

    /* ---- 조작 줄 ---- */

    function currentSpeedMs() {
        const picked = SORT_SPEEDS.find((s) => s.id === $('speed').value);
        return (picked || SORT_SPEEDS[1]).ms;
    }

    function wireControls() {
        const speed = $('speed');
        speed.textContent = '';
        for (const s of SORT_SPEEDS) {
            const o = document.createElement('option');
            o.value = s.id;
            o.textContent = s.name;
            if (s.id === SORT_SPEEDS[1].id) o.selected = true;
            speed.appendChild(o);
        }
        speed.value = SORT_SPEEDS[1].id;
        speed.addEventListener('change', () => player?.setSpeed(currentSpeedMs()));

        $('btn-play').addEventListener('click', () => player?.toggle());
        $('btn-prev').addEventListener('click', () => player?.step(-1));
        $('btn-next').addEventListener('click', () => player?.step(1));
        $('btn-first').addEventListener('click', () => player?.toStart());
        $('btn-last').addEventListener('click', () => player?.toEnd());
        $('scrub').addEventListener('input', (e) => player?.seek(Number(e.target.value) || 0));

        const clearLog = () => { log.length = 0; $('op-log').textContent = ''; $('input-error').textContent = ' '; };
        $('btn-reset').addEventListener('click', () => { clearLog(); applyOrder([...TREE_START]); });
        $('btn-clear').addEventListener('click', () => { clearLog(); applyOrder([]); });
        $('btn-random').addEventListener('click', () => {
            clearLog();
            const want = 7;
            const seen = new Set();
            while (seen.size < want) seen.add(Math.floor(Math.random() * TREE_VALUE_MAX) + 1);
            applyOrder([...seen]);
        });
        /* **오름차순으로 세우는 단추를 따로 둔다.** 이 페이지에서 가장 중요한 장면이
           「정렬된 자료를 넣으면 한 줄이 된다」인데, 손으로 여덟 번 넣게 하면
           거기까지 가 보는 학생이 거의 없다. */
        $('btn-ascend').addEventListener('click', () => {
            clearLog();
            applyOrder(Array.from({length: 7}, (_, i) => (i + 1) * 10));
        });

        $('btn-apply-input').addEventListener('click', () => {
            const raw = $('input-text').value.trim();
            const parts = raw ? raw.split(/[\s,]+/).filter(Boolean) : [];
            const nums = parts.map(Number);
            if (nums.some((x) => !Number.isFinite(x) || !Number.isInteger(x))) {
                $('input-error').textContent = '정수만 넣을 수 있습니다.';
                return;
            }
            if (nums.some((x) => x < 0 || x > TREE_VALUE_MAX)) {
                $('input-error').textContent = `값은 0부터 ${TREE_VALUE_MAX}까지만 넣을 수 있습니다.`;
                return;
            }
            if (new Set(nums).size !== nums.length) {
                $('input-error').textContent = '같은 값을 두 번 넣을 수 없습니다.';
                return;
            }
            if (nums.length > HEAP_CAP) {
                $('input-error').textContent = `${HEAP_CAP}개까지만 넣을 수 있습니다.`;
                return;
            }
            clearLog();
            applyOrder(nums);
        });

        window.addEventListener('resize', () => view?.resize?.());
    }

    /* ---- 시작 ---- */

    measured = measureTreeHeight(TREE_INSERT_OPS);
    wireControls();
    refillValue();
    lastOp = struct.ops[0];
    rebuildState();
    paintTabs();
    paintStructCard();
    paintLegend();
    paintOps();
    runIdle();
}
