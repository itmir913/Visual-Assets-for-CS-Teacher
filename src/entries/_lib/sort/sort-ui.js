/* 화면 배선. **HTML은 뼈대만 두고 여기서 채운다** —
 * 탭도 프리셋도 범례도 등록부에서 만들어 내므로, 알고리즘을 하나 더하면 화면이 따라온다.
 * 손으로 적은 목록이 화면과 등록부 두 군데 있으면 반드시 어긋난다.
 */

import {SORT_ALGOS, sortAlgoById, sortAlgosOfGroup, sortGroupsInUse} from './sort-registry.js';
import {runSortAlgorithm} from './sort-model.js';
import {createSortPlayer, SORT_SPEEDS} from './sort-player.js';
import {createSortArrayView, SORT_COLORS} from './sort-view-array.js';
import {
    SORT_PRESETS, SORT_N_DEFAULT, SORT_N_MAX, SORT_N_MIN,
    makeSortData, parseSortInput, checkSortInput,
} from './sort-data.js';

const SORT_LEGEND = [
    {key: 'idle', label: '아직 손대지 않음'},
    {key: 'compare', label: '지금 비교하는 둘'},
    {key: 'moving', label: '방금 움직인 것'},
    {key: 'held', label: '들어올린 것'},
    {key: 'pivot', label: '피벗'},
    {key: 'done', label: '자리가 확정됨'},
];

const $ = (id) => document.getElementById(id);

function sortButton(cls, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
}

export function mountSortSimulator() {
    const view = createSortArrayView($('bars-host'));

    let algo = SORT_ALGOS[0];
    let presetId = SORT_PRESETS[0].id;
    let n = SORT_N_DEFAULT;
    let seed = 20260825;
    let values = makeSortData(presetId, n, seed);
    let player = null;

    /* ---- 위쪽: 무리 탭과 알고리즘 칩 ---- */

    const groupTabs = $('group-tabs');
    const algoTabs = $('algo-tabs');

    function paintTabs() {
        groupTabs.textContent = '';
        for (const g of sortGroupsInUse()) {
            const b = sortButton(
                'group-tab' + (g.id === algo.group ? ' on' : ''),
                `${g.name} · ${g.badge}`,
                () => {
                    const first = sortAlgosOfGroup(g.id)[0];
                    if (first) selectAlgo(first.id);
                },
            );
            groupTabs.appendChild(b);
        }

        algoTabs.textContent = '';
        for (const a of sortAlgosOfGroup(algo.group)) {
            algoTabs.appendChild(sortButton(
                'algo-chip' + (a.id === algo.id ? ' on' : ''),
                a.name,
                () => selectAlgo(a.id),
            ));
        }
    }

    /* ---- 고른 알고리즘 카드 ---- */

    function paintAlgoCard() {
        $('algo-name').textContent = algo.name;
        $('algo-en').textContent = algo.en;
        $('algo-idea').textContent = algo.idea;
        $('algo-watch').textContent = algo.watch;

        const badges = $('algo-badges');
        badges.textContent = '';
        const spec = [
            algo.stable
                ? {on: true, text: '안정 정렬', hint: '값이 같은 것끼리 앞뒤 차례가 지켜집니다'}
                : {on: false, text: '안정 정렬 아님', hint: '값이 같은 것끼리 앞뒤가 뒤바뀔 수 있습니다'},
            algo.inPlace
                ? {on: true, text: '제자리 정렬', hint: '배열 밖에 따로 큰 자리를 쓰지 않습니다'}
                : {on: false, text: '추가 메모리 필요', hint: '배열만큼의 자리를 더 씁니다'},
        ];
        for (const s of spec) {
            const el = document.createElement('span');
            el.className = 'px-3 py-1 rounded-full font-bold border '
                + (s.on ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-300 text-slate-600');
            el.textContent = s.text;
            el.title = s.hint;
            badges.appendChild(el);
        }

        const rows = [
            ['최선', algo.complexity.best],
            ['평균', algo.complexity.avg],
            ['최악', algo.complexity.worst],
            ['추가 메모리', algo.complexity.space],
        ];
        const table = $('algo-complexity');
        table.textContent = '';
        for (const [label, value] of rows) {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-100';
            const th = document.createElement('th');
            th.className = 'py-1.5 pr-4 text-left font-bold text-slate-500 w-32';
            th.textContent = label;
            const td = document.createElement('td');
            td.className = 'py-1.5 font-black text-slate-900 font-mono';
            td.textContent = value;
            tr.appendChild(th);
            tr.appendChild(td);
            table.appendChild(tr);
        }
    }

    /* ---- 자료 만들기 ---- */

    function paintPresets() {
        const host = $('preset-buttons');
        host.textContent = '';
        for (const p of SORT_PRESETS) {
            host.appendChild(sortButton(
                'preset-btn' + (p.id === presetId ? ' on' : ''),
                p.name,
                () => { presetId = p.id; reshuffle(); },
            ));
        }
        $('preset-hint').textContent = SORT_PRESETS.find((p) => p.id === presetId).hint;
    }

    function paintLegend() {
        const host = $('legend');
        host.textContent = '';
        for (const item of SORT_LEGEND) {
            const tone = SORT_COLORS[item.key];
            const wrap = document.createElement('span');
            wrap.className = 'inline-flex items-center gap-2';
            const chip = document.createElement('span');
            Object.assign(chip.style, {
                width: '14px', height: '14px', borderRadius: '3px',
                background: tone.bg, border: `1px solid ${tone.bar}`, display: 'inline-block',
            });
            const text = document.createElement('span');
            text.textContent = item.label;
            wrap.appendChild(chip);
            wrap.appendChild(text);
            host.appendChild(wrap);
        }
    }

    /* ---- 돌리기 ---- */

    function rebuild() {
        player?.destroy();

        const why = checkSortInput(algo, values);
        if (why) {
            // 막기만 하지 않는다 — **제약 자체가 그 알고리즘의 성질**이라 까닭을 함께 준다.
            $('say').textContent = why;
            $('input-error').textContent = why;
            values = values.map((v) => Math.abs(v) % 100);
        } else {
            $('input-error').textContent = ' ';
        }

        const out = runSortAlgorithm(algo, values);
        view.setup(out.frames[0] ? out.frames[0].a : []);

        const scrub = $('scrub');
        scrub.max = String(Math.max(0, out.frames.length - 1));
        scrub.min = '0';
        scrub.value = '0';

        player = createSortPlayer({
            frames: out.frames,
            render: (frame, prev, o) => {
                view.render(frame, prev, o);
                $('say').textContent = frame.say || ' ';
                $('count-compare').textContent = String(frame.counts.compare);
                $('count-move').textContent = String(frame.counts.move);
                $('count-access').textContent = String(frame.counts.access);
            },
            onState: ({index, total, playing, atEnd}) => {
                $('scrub').value = String(index);
                $('step-label').textContent = `${index} / ${Math.max(0, total - 1)} 단계`;
                $('btn-play').innerHTML = playing
                    ? '<i class="fa-solid fa-pause"></i> 멈춤'
                    : (atEnd ? '<i class="fa-solid fa-rotate-right"></i> 다시' : '<i class="fa-solid fa-play"></i> 재생');
                $('btn-prev').disabled = index === 0;
                $('btn-first').disabled = index === 0;
                $('btn-next').disabled = atEnd;
                $('btn-last').disabled = atEnd;
            },
        });
        player.setSpeed(currentSpeedMs());
        player.start();
    }

    function reshuffle() {
        seed = (seed * 1103515245 + 12345) >>> 0;
        values = makeSortData(presetId, n, seed);
        paintPresets();
        rebuild();
    }

    function selectAlgo(id) {
        algo = sortAlgoById(id) || algo;
        paintTabs();
        paintAlgoCard();
        rebuild();
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

        const slider = $('n-slider');
        slider.min = String(SORT_N_MIN);
        slider.max = String(SORT_N_MAX);
        slider.addEventListener('input', () => {
            n = Number(slider.value) || SORT_N_DEFAULT;
            $('n-label').textContent = String(n);
        });
        slider.addEventListener('change', () => {
            values = makeSortData(presetId, n, seed);
            rebuild();
        });

        $('btn-shuffle').addEventListener('click', reshuffle);

        $('btn-apply-input').addEventListener('click', () => {
            const {values: got, error} = parseSortInput($('input-text').value);
            if (error) { $('input-error').textContent = error; return; }
            values = got;
            n = got.length;
            $('n-slider').value = String(Math.min(SORT_N_MAX, Math.max(SORT_N_MIN, n)));
            $('n-label').textContent = String(n);
            rebuild();
        });
    }

    /* ---- 시작 ---- */

    wireControls();
    paintTabs();
    paintAlgoCard();
    paintPresets();
    paintLegend();
    $('n-label').textContent = String(n);
    rebuild();
}
