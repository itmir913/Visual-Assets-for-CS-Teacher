/* 화면 배선. **HTML은 뼈대만 두고 여기서 채운다** —
 * 탭도 프리셋도 범례도 등록부에서 만들어 내므로, 알고리즘을 하나 더하면 화면이 따라온다.
 * 손으로 적은 목록이 화면과 등록부 두 군데 있으면 반드시 어긋난다.
 */

import {
    SORT_ALGOS, sortAlgoById, sortAlgosOfGroup, sortGroupById, sortGroupsInUse,
} from './sort-registry.js';
import {buildSortRace, measureSortWork, RACE_MAX_N} from './sort-race.js';
import {createSortRaceView} from './sort-view-race.js';
import {runSortAlgorithm} from './sort-model.js';
import {createStepPlayer, PLAY_SPEEDS} from '../step-player.js';
import {createSortArrayView, SORT_COLORS} from './sort-view-array.js';
import {createSortHeapView} from './sort-view-heap.js';
import {
    SORT_PRESETS, SORT_SIZES, SORT_N_DEFAULT, SORT_N_MAX, SORT_N_MIN,
    makeSortData, parseSortInput, checkSortInput, nearestSortSize,
} from './sort-data.js';

const SORT_LEGEND = [
    {key: 'idle', label: '아직 손대지 않음'},
    {key: 'compare', label: '지금 비교하는 둘'},
    {key: 'moving', label: '방금 움직인 것'},
    {key: 'held', label: '임시 저장한 원소'},
    {key: 'pivot', label: '피벗'},
    {key: 'done', label: '자리가 확정됨'},
];

const $ = (id) => document.getElementById(id);

/* 설명문의 `**굵게**`를 실제로 굵게 낸다. 예전에는 `textContent`로 넣어
   **별표가 그대로 화면에 찍혔다.** 넣는 글은 전부 우리가 쓴 것이지만,
   그래도 꺾쇠는 먼저 막아 둔다 — 나중에 누가 이 자리에 남의 글을 흘려 넣을 수 있다. */
function setRich(el, text, strongClass = 'font-black text-slate-900') {
    const safe = String(text)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    el.innerHTML = safe.replace(/\*\*([^*]+)\*\*/g,
        (_, inner) => `<strong class="${strongClass}">${inner}</strong>`);
}

function sortButton(cls, text, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = text;
    b.addEventListener('click', onClick);
    return b;
}

export function mountSortSimulator() {
    /* 그림은 알고리즘이 고른다. 힙 정렬만 트리를 함께 그려야 해서 다른 뷰를 쓴다.
       **바뀔 때만 새로 만든다** — 알고리즘을 고를 때마다 다시 만들면 상자가 깜빡인다. */
    let view = null;
    let viewKind = null;

    function ensureView(kind) {
        if (viewKind === kind) return;
        viewKind = kind;
        if (kind === 'race') view = createSortRaceView($('bars-host'));
        else if (kind === 'heap') view = createSortHeapView($('bars-host'));
        else view = createSortArrayView($('bars-host'));
    }

    let algo = SORT_ALGOS[0];
    /** 비교 탭에서 비교할 알고리즘. **수업에서 배운 것만 골라 볼 수 있어야 한다** —
     *  열한 줄을 늘 다 보여 주면 정작 비교하려던 둘이 묻힌다. */
    const racePick = new Set(SORT_ALGOS.map((a) => a.id));
    const raceBoxes = new Map();
    let presetId = SORT_PRESETS[0].id;
    let n = SORT_N_DEFAULT;
    let seed = 20260825;
    let values = makeSortData(presetId, n, seed, algo.valueMax ?? null);
    let player = null;

    /* ---- 위쪽: 분류 탭과 알고리즘 칩 ---- */

    const groupTabs = $('group-tabs');
    const algoTabs = $('algo-tabs');

    function paintTabs() {
        groupTabs.textContent = '';
        for (const g of sortGroupsInUse()) {
            const b = sortButton(
                'group-tab' + (g.id === algo.group ? ' on' : ''),
                g.name,
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
        setRich($('algo-idea'), algo.idea);
        setRich($('algo-watch'), algo.watch, 'font-black text-amber-950');

        /* **분류가 무엇을 뜻하는지 적어 준다.** 탭 이름만으로는 「분할 정복」이
           무슨 기법인지 알 수 없고, 셸·힙이 왜 거기 없는지도 알 수 없다. */
        const group = sortGroupById(algo.group);
        /* **배지를 달지 않는다.** 「분할 정복 · O(n log n)」처럼 적어 두었더니
           그 안의 퀵 정렬(최악 O(n²))·버킷 정렬(최악 O(n²))과 어긋났다.
           복잡도는 알고리즘마다 다르므로 분류가 아니라 **카드**가 말할 일이다. */
        $('group-name').textContent = group ? group.name : ' ';
        setRich($('group-blurb'), group ? group.blurb : ' ', 'font-black text-slate-800');

        const badges = $('algo-badges');
        badges.textContent = '';
        const spec = algo.stable === null ? [] : [
            algo.stable
                ? {on: true, text: '안정 정렬', hint: '값이 같은 것끼리 앞뒤 순서가 지켜집니다'}
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
        /* **값이 없는 표는 내지 않는다.** 알고리즘 비교는 알고리즘이 아니라
           복잡도가 없는데, 표만 「—」 넉 줄로 남아 있으면 빈칸을 못 채운 것처럼 보인다. */
        const table = $('algo-complexity');
        table.textContent = '';
        table.parentElement.style.display = rows.every(([, v]) => v === '—') ? 'none' : '';
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

    /* ---- 화면 읽는 법 ----
       **시뮬레이터의 조작과 표시만 적는다.** 안정 정렬이 무엇인지 같은 것은 강의노트가
       할 말이다. 그리고 **지금 화면에 없는 것은 적지 않는다** — 어느 알고리즘을 골랐든
       같은 글이 다섯 문단 붙어 있으면 정작 눈앞의 것을 찾을 수 없다. */

    const MOTION_NOTE = {
        swap: '막대 둘이 서로의 자리로 미끄러지면 **교환**입니다.',
        shift: '막대가 옆으로 한 칸씩 비켜서면 **이동**입니다. 교환과 다릅니다.',
        write: '막대가 다른 칸에 다시 그려지면 **복사**입니다. 제자리에서 옮기는 것이 아닙니다.',
    };

    /** 프레임을 살펴 **이 회차에 실제로 나오는 표시**만 추린다. 손으로 적으면 낡는다. */
    function paintReadNotes(frames, kind) {
        const host = $('read-notes');
        host.textContent = '';
        const lines = [];

        if (kind === 'race') {
            lines.push('줄 하나가 알고리즘 하나입니다. 오른쪽 숫자는 **작업량**(비교 + 옮김 + 배열 접근)입니다.');
            lines.push('모두 같은 작업량을 나눠 받으므로, **먼저 끝난 줄이 일을 덜 한 것**입니다.');
            lines.push('아래 곡선은 개수를 키워 가며 측정한 것입니다. 세로는 로그 눈금이라 **기울기가 곧 차수**입니다.');
        } else {
            if (MOTION_NOTE[algo.motion]) lines.push(MOTION_NOTE[algo.motion]);

            let band = false;
            let aux = false;
            let strip = false;
            let held = false;
            for (const f of frames) {
                if (f.ranges && f.ranges.length) band = true;
                if (f.aux && f.aux.length) aux = true;
                if (f.strip) strip = true;
                if (f.marks.held) held = true;
            }
            if (held) lines.push('위로 띄운 막대는 **잠시 빼 둔 원소**이고, 그 자리는 점선 빈칸입니다.');
            if (band) lines.push('막대 위의 띠는 **지금 보고 있는 구간**입니다.');
            if (aux) lines.push('막대 아래 칸은 **배열 밖에 더 쓰는 자리**입니다. 다 쓴 칸은 점선으로 물러납니다.');
            if (strip) lines.push('막대 아래 칸 줄은 **값(또는 자릿수·값 구간)마다 하나**입니다.');
            if (algo.view === 'heap') {
                lines.push('위 트리와 아래 배열은 **같은 것**입니다. 노드 위 작은 숫자가 배열 인덱스입니다.');
            }
            const last = frames[frames.length - 1];
            const dup = last && new Set(last.a.filter(Boolean).map((it) => it.v)).size < last.a.length;
            if (dup) lines.push('`5·3`은 「값이 5, 처음 자리가 3」입니다. 값이 겹칠 때만 붙습니다.');
        }

        for (const line of lines) {
            const li = document.createElement('li');
            li.className = 'leading-relaxed';
            setRich(li, line, 'font-black text-slate-800');
            host.appendChild(li);
        }
    }

    /* ---- 실행 ---- */

    /** 곡선은 자료의 생김새와 씨앗만 타므로 한 번 측정해 두고 다시 쓴다. */
    let workCache = null;
    let workKey = '';

    function raceWork(chosen) {
        const key = `${presetId}:${seed}:${chosen.map((a) => a.id).join(',')}`;
        if (workKey !== key) {
            workKey = key;
            workCache = measureSortWork((size) => makeSortData(presetId, size, seed, null),
                undefined, chosen);
        }
        return workCache;
    }

    function paintRacePicker() {
        const host = $('race-checks');
        host.textContent = '';
        raceBoxes.clear();
        for (const a of SORT_ALGOS) {
            const label = document.createElement('label');
            label.className = 'inline-flex items-center gap-2 font-semibold text-slate-700 cursor-pointer';
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.checked = racePick.has(a.id);
            box.addEventListener('change', () => {
                if (box.checked) racePick.add(a.id); else racePick.delete(a.id);
                rebuildRace();
            });
            const text = document.createElement('span');
            text.textContent = a.name;
            label.appendChild(box);
            label.appendChild(text);
            host.appendChild(label);
            raceBoxes.set(a.id, box);
        }
    }

    function setAllRace(on) {
        racePick.clear();
        if (on) for (const a of SORT_ALGOS) racePick.add(a.id);
        for (const [id, box] of raceBoxes) box.checked = racePick.has(id);
        rebuildRace();
    }

    /** 알고리즘 비교 한 회차. 걸음을 하나도 솎지 않아야 공정하므로 크기에 천장이 있다. */
    function rebuildRace() {
        player?.destroy();
        const chosen = SORT_ALGOS.filter((a) => racePick.has(a.id));
        $('race-picker').classList.remove('hidden');
        $('tally-row').style.display = 'none';
        $('input-error').textContent = ' ';

        if (!chosen.length) {
            /* **아무것도 안 고른 것도 있을 수 있는 상태다.** 「모두 해제」를 눌렀을 때
               화면이 비는 대신 무엇을 하라고 일러 준다. */
            ensureView('race');
            view.setup([{race: []}], null);
            $('read-notes').textContent = '';
            setRich($('say'), '비교할 알고리즘을 **하나 이상 골라 주세요.**');
            $('record-note').textContent = ' ';
            $('step-label').textContent = '0 / 0 단계';
            const sc = $('scrub');
            sc.max = '0';
            sc.value = '0';
            for (const id of ['btn-prev', 'btn-first', 'btn-next', 'btn-last', 'btn-play']) {
                $(id).disabled = true;
            }
            return;
        }
        $('btn-play').disabled = false;

        const raceN = Math.min(n, RACE_MAX_N);
        const raceValues = makeSortData(presetId, raceN, seed, null);
        const {frames} = buildSortRace(raceValues, chosen);

        ensureView('race');
        view.setup(frames, raceWork(chosen));
        paintReadNotes(frames, 'race');
        $('record-note').textContent = n > RACE_MAX_N
            ? `알고리즘 비교는 ${RACE_MAX_N}개까지만 합니다. 걸음을 하나라도 솎으면 비교가 공정하지 않기 때문입니다`
              + ` (지금 고른 ${n}개 대신 ${raceN}개로 돌렸습니다).`
            : ' ';

        const scrub = $('scrub');
        scrub.max = String(Math.max(0, frames.length - 1));
        scrub.min = '0';
        scrub.value = '0';

        player = createStepPlayer({
            frames,
            render: (frame, prev, o) => {
                view.render(frame, prev, o);
                setRich($('say'), frame.say || ' ');
            },
            onState: paintPlayerState,
        });
        player.setSpeed(currentSpeedMs());
        player.start();
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

    function rebuild() {
        player?.destroy();
        if (algo.view === 'race') { rebuildRace(); return; }
        $('race-picker').classList.add('hidden');
        $('tally-row').style.display = '';

        const why = checkSortInput(algo, values);
        if (why) {
            // 막기만 하지 않는다 — **제약 자체가 그 알고리즘의 성질**이라 까닭을 함께 준다.
            /* **값을 억지로 접어 넣지 않는다.** 예전에는 `% 100`으로 구겨 넣었는데,
               그러면 학생이 넣은 자료와도 프리셋과도 달라 화면에 뜬 것이 무엇인지
               아무도 모르는 상태가 되었다. 그 범위에 맞는 자료를 새로 만들어 준다. */
            values = makeSortData(presetId, n, seed, algo.valueMax ?? null);
            $('input-error').textContent = `${why} 그 범위로 자료를 새로 만들었습니다.`;
        } else {
            $('input-error').textContent = ' ';
        }

        ensureView(algo.view);
        const out = runSortAlgorithm(algo, values);
        // **프레임 열을 통째로 넘긴다.** 뷰가 이 회차에서 쓸 높이를 미리 알려면
        // 마지막 장까지 봐야 한다 — 임시 배열 칸은 한참 뒤에야 나타난다.
        view.setup(out.frames);
        paintReadNotes(out.frames, algo.view);

        /* **솎아 기록했으면 반드시 밝힌다.** 모르면 학생이 「한 단계 = 비교 한 번」으로
           읽고 화면의 숫자를 잘못 센다. 큰 배열에서는 모든 걸음을 들고 있을 수가 없다. */
        $('record-note').textContent = out.stride > 1
            ? `원소가 많아 ${out.stride}걸음마다 한 장씩만 기록했습니다`
              + ` (실제 걸음 ${out.steps.toLocaleString('ko-KR')}번).`
              + ' 한 걸음씩 모두 보려면 개수를 줄이세요.'
            : ' ';

        const scrub = $('scrub');
        scrub.max = String(Math.max(0, out.frames.length - 1));
        scrub.min = '0';
        scrub.value = '0';

        player = createStepPlayer({
            frames: out.frames,
            render: (frame, prev, o) => {
                view.render(frame, prev, o);
                // **설명글도 굵게 새겨 넣는다.** `textContent`로 넣으면 별표가 그대로 찍힌다.
                setRich($('say'), frame.say || ' ');
                $('count-compare').textContent = String(frame.counts.compare);
                $('count-move').textContent = String(frame.counts.move);
                $('count-access').textContent = String(frame.counts.access);
            },
            onState: paintPlayerState,
        });
        player.setSpeed(currentSpeedMs());
        player.start();
    }

    function reshuffle() {
        seed = (seed * 1103515245 + 12345) >>> 0;
        values = makeSortData(presetId, n, seed, algo.valueMax ?? null);
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

        /* **슬라이더는 개수가 아니라 목록의 자리를 고른다.** 2~1000을 고르게 펴면
           수업에서 실제로 쓰는 2~20 구간이 슬라이더의 2%가 되어 집을 수가 없다. */
        const slider = $('n-slider');
        slider.min = '0';
        slider.max = String(SORT_SIZES.length - 1);
        slider.step = '1';
        slider.value = String(SORT_SIZES.indexOf(SORT_N_DEFAULT));
        slider.addEventListener('input', () => {
            n = SORT_SIZES[Number(slider.value)] ?? SORT_N_DEFAULT;
            $('n-label').textContent = String(n);
        });
        slider.addEventListener('change', () => {
            values = makeSortData(presetId, n, seed, algo.valueMax ?? null);
            rebuild();
        });

        $('btn-shuffle').addEventListener('click', reshuffle);
        $('btn-race-all').addEventListener('click', () => setAllRace(true));
        $('btn-race-none').addEventListener('click', () => setAllRace(false));

        $('btn-apply-input').addEventListener('click', () => {
            const {values: got, error} = parseSortInput($('input-text').value);
            if (error) { $('input-error').textContent = error; return; }
            values = got;
            n = got.length;
            $('n-slider').value = String(SORT_SIZES.indexOf(nearestSortSize(n)));
            $('n-label').textContent = String(n);
            rebuild();
        });
    }

    /* ---- 시작 ---- */

    /* **전체 화면에서 그림과 조작을 어느 쪽으로 나눌지 알려 준다.**
       정렬 그림은 어느 탭에서나 가로로 길다(막대도 경주 줄도) — 좌우로 쪼개면
       그림이 절반으로 눌린다. 그래서 늘 가로형이다 → simulator.css 의 `fs-wide` */
    $('stage').classList.add('fs-wide');

    wireControls();
    paintRacePicker();
    paintTabs();
    paintAlgoCard();
    paintPresets();
    paintLegend();
    $('n-label').textContent = String(n);
    rebuild();
}
