/* 알고리즘 비교 그림 — 알고리즘마다 한 줄씩, 같은 «작업량»을 나란히.
 *
 * 막대에 값 글자를 적지 않는다. 여기서 볼 것은 «값»이 아니라 **정돈되어 가는 모양**과
 * **누가 먼저 끝나는가**이기 때문이다. 한 알고리즘을 자세히 볼 자리는 따로 있다.
 *
 * 줄 높이를 못박아 둔다 — 알고리즘이 하나씩 끝나며 「끝!」 표가 붙어도 줄이 밀리지 않아야
 * 아래에 있는 버튼이 제자리를 지킨다.
 */

const LANE_H = 40;          // 한 줄
const LANE_GAP = 6;
const BAR_H = 26;           // 줄 안에서 막대가 쓰는 높이
/* 이름·숫자 칸을 좁게 잡는다. 375px에서 이 둘이 180px을 먹으면
   정작 봐야 할 막대가 131px밖에 안 남는다. */
const NAME_W = 70;          // 알고리즘 이름 칸
const TALLY_W = 84;         // 세는 횟수 칸

/* **이름을 겹치지 않게 짓는다.** 검사 받침대는 모듈을 한 문맥에 풀어 놓으므로
   다른 파일과 같은 top-level 이름을 쓰면 「already been declared」로 죽는다.
   힙 뷰에도 `svgEl`과 `SVG_NS`가 있어 실제로 한 번 부딪혔다. */
const RACE_SVG_NS = 'http://www.w3.org/2000/svg';

function raceBox(tag, style, text) {
    const el = document.createElement(tag);
    Object.assign(el.style, style);
    if (text !== undefined) el.textContent = text;
    return el;
}

function raceSvg(tag, attrs) {
    const el = document.createElementNS(RACE_SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
}

/** 알고리즘마다 다른 색. 곡선과 줄이 같은 색을 쓴다.
 *  **알고리즘 수보다 많아야 한다** — 열 개만 두었더니 열한 번째(버킷 정렬)가
 *  `idx % 10`으로 돌아가 버블 정렬과 같은 빨강이 되었다. 줄도 곡선도 범례도
 *  같은 색이라 구별할 방법이 없었다. 알고리즘을 더할 때 이 목록도 함께 늘린다. */
const RACE_COLORS = [
    '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
    '#0ea5e9', '#6366f1', '#a855f7', '#ec4899', '#64748b', '#7c2d12',
];

export function createSortRaceView(host) {
    host.textContent = '';

    const lanesBox = raceBox('div', {position: 'relative', width: '100%'});
    const chartBox = raceBox('div', {width: '100%', marginTop: '14px', overflowX: 'auto'});
    const legendBox = raceBox('div', {
        display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: '6px',
        fontSize: '11px', fontWeight: '700', color: '#475569',
    });
    host.appendChild(lanesBox);
    host.appendChild(chartBox);
    host.appendChild(legendBox);

    let lanes = [];     // {row, bars:[], tally, badge, n}
    let n = 0;
    let chartSvg = null;
    let chartTexts = null;   // 글자를 한 그룹에 모아 두고 배율의 역수를 건다
    const CHART_W = 720;
    const CHART_FONT_PX = 12;

    function buildLanes(raceFrame) {
        lanesBox.textContent = '';
        lanes = [];
        n = raceFrame.length ? raceFrame[0].frame.a.length : 0;

        raceFrame.forEach((lane, idx) => {
            const row = raceBox('div', {
                position: 'relative',
                height: `${LANE_H}px`,
                marginBottom: `${LANE_GAP}px`,
            });
            row.appendChild(raceBox('div', {
                position: 'absolute', left: '0', top: '0', width: `${NAME_W}px`,
                fontSize: '11px', fontWeight: '800', color: '#334155',
                lineHeight: `${LANE_H}px`, whiteSpace: 'nowrap', overflow: 'hidden',
            }, lane.algo.name));

            const track = raceBox('div', {
                position: 'absolute',
                left: `${NAME_W}px`, right: `${TALLY_W}px`,
                bottom: '4px', height: `${BAR_H}px`,
            });
            const bars = [];
            for (let i = 0; i < n; i++) {
                const b = raceBox('div', {
                    position: 'absolute',
                    bottom: '0',
                    left: `${(i * 100) / n}%`,
                    width: `${100 / n}%`,
                    padding: '0 0.5px',
                    boxSizing: 'border-box',
                    height: '0%',
                });
                const fill = raceBox('div', {height: '100%', background: '#bfdbfe', borderRadius: '1px'});
                b.appendChild(fill);
                b.__fill = fill;      // 그릴 때마다 자식을 다시 찾지 않는다
                track.appendChild(b);
                bars.push(b);
            }
            row.appendChild(track);

            const tally = raceBox('div', {
                position: 'absolute', right: '0', top: '0', width: `${TALLY_W}px`,
                fontSize: '11px', fontWeight: '700', color: '#64748b',
                lineHeight: `${LANE_H}px`, textAlign: 'right',
                fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
            }, '');
            row.appendChild(tally);

            lanesBox.appendChild(row);
            lanes.push({row, bars, tally, color: RACE_COLORS[(lane.colorIndex ?? idx) % RACE_COLORS.length]});
        });
    }

    /** n을 키워 가며 측정한 「작업량」 곡선. 한 걸음씩 넘겨서는 볼 수 없는 그림이다. */
    function buildChart(work) {
        chartBox.textContent = '';
        if (!work) return;
        const {sizes, series} = work;

        const W = CHART_W;
        const H = 300;
        const padL = 54;
        // 오른쪽을 넉넉히 둔다 — 마지막 눈금(1000)이 가운데 맞춤이라 상자 밖으로 잘렸다.
        const padR = 24;
        const padT = 16;
        const padB = 46;

        const maxWork = Math.max(1, ...series.flatMap((s) => s.work));
        // 세로는 로그 눈금. 2n과 n²을 한 그림에 담으려면 이것밖에 없다.
        const logMax = Math.log10(maxWork);
        const x = (i) => padL + ((W - padL - padR) * i) / Math.max(1, sizes.length - 1);
        const y = (v) => {
            const t = Math.log10(Math.max(1, v)) / logMax;
            return H - padB - (H - padT - padB) * t;
        };

        const svg = raceSvg('svg', {
            viewBox: `0 0 ${W} ${H}`,
            style: `width:100%;height:auto;display:block;margin:0 auto;max-width:${W}px;min-width:360px`,
        });
        /* **SVG 글자는 그리는 폭에 비례해 줄어든다.** 720짜리를 520에 그리면
           `font-size="11"`이 화면에서 7.9px로 앉는다. 글자를 한 그룹에 모아 두고
           그릴 때마다 배율의 역수를 걸어 화면 크기를 일정하게 만든다. */
        chartTexts = raceSvg('g', {'font-size': CHART_FONT_PX});

        // 가로 눈금 — 10의 거듭제곱
        for (let e = 0; e <= Math.ceil(logMax); e++) {
            const yy = y(Math.pow(10, e));
            svg.appendChild(raceSvg('line', {
                x1: padL, y1: yy, x2: W - padR, y2: yy,
                stroke: '#e2e8f0', 'stroke-width': 1,
            }));
            const t = raceSvg('text', {
                x: padL - 6, y: yy + 4, 'text-anchor': 'end', fill: '#94a3b8',
            });
            t.textContent = e === 0 ? '1' : `10^${e}`;
            chartTexts.appendChild(t);
        }

        sizes.forEach((s, i) => {
            const t = raceSvg('text', {
                x: x(i), y: H - padB + 16, 'text-anchor': 'middle', fill: '#64748b',
            });
            t.textContent = String(s);
            chartTexts.appendChild(t);
        });
        const xl = raceSvg('text', {
            x: (padL + W - padR) / 2, y: H - 6, 'text-anchor': 'middle',
            fill: '#475569', 'font-weight': 700,
        });
        xl.textContent = '원소 수 n';
        chartTexts.appendChild(xl);

        series.forEach((s, k) => {
            const color = RACE_COLORS[(s.colorIndex ?? k) % RACE_COLORS.length];
            const pts = s.work.map((v, i) => `${x(i)},${y(v)}`).join(' ');
            svg.appendChild(raceSvg('polyline', {
                points: pts, fill: 'none', stroke: color, 'stroke-width': 2,
                'stroke-linejoin': 'round',
            }));
        });

        /* **이름표를 SVG 안에 두지 않는다.**
           선들이 오른쪽 끝에서 몰려 여섯 쌍이 포개졌고, 겹침을 풀어 놓았더니 이번에는
           좁은 화면에서 가로 스크롤 밖으로 밀려 아예 보이지 않았다.
           그림 밖 HTML 범례로 빼면 **어느 폭에서도 접혀 들어간다** — 그림은 그림만 그린다. */
        svg.appendChild(chartTexts);
        chartBox.appendChild(svg);
        chartSvg = svg;

        legendBox.textContent = '';
        series.forEach((sr, k) => {
            const item = raceBox('span', {display: 'inline-flex', alignItems: 'center', gap: '5px'});
            item.appendChild(raceBox('span', {
                width: '14px', height: '3px', borderRadius: '2px',
                background: RACE_COLORS[(sr.colorIndex ?? k) % RACE_COLORS.length], display: 'inline-block',
            }));
            item.appendChild(raceBox('span', {}, sr.algo.name));
            legendBox.appendChild(item);
        });
    }

    return {
        /** @param {object[]} frames 알고리즘 비교 장. 첫 장에서 줄을 만든다. */
        setup(frames, work) {
            buildLanes((frames[0] && frames[0].race) || []);
            buildChart(work);
        },

        render(frame) {
            if (chartSvg && chartTexts) {
                // 그릴 때마다 다시 측정한다. 한 번 측정해 굳혀 두면 창을 줄였을 때 낡는다.
                const scale = (chartSvg.clientWidth || CHART_W) / CHART_W;
                chartTexts.setAttribute('font-size', Math.round(CHART_FONT_PX / scale));
            }
            const race = frame.race || [];
            race.forEach((lane, idx) => {
                const ui = lanes[idx];
                if (!ui) return;
                const arr = lane.frame.a;
                const maxV = Math.max(1, ...arr.map((it) => (it ? it.v : 0)));
                for (let i = 0; i < ui.bars.length; i++) {
                    const it = arr[i];
                    const bar = ui.bars[i];
                    const h = it ? Math.max(6, (it.v / maxV) * 100) : 0;
                    if (bar.__h !== h) { bar.style.height = `${h}%`; bar.__h = h; }
                    const tone = lane.done ? '#a7f3d0' : ui.color;
                    if (bar.__tone !== tone) { bar.__fill.style.background = tone; bar.__tone = tone; }
                }
                const c = lane.frame.counts;
                /* 숫자는 언제나 **작업량**(비교 + 옮김 + 배열 접근)이다. 도는 동안에는
                   모두 같은 값을 가리키고(그것이 요점이다), 끝난 줄만 제 값에서 멈춘다 —
                   멈춘 값들을 위아래로 비교하는 것이 곧 등수다. */
                const text = lane.done
                    ? `끝 · ${lane.finishedWork.toLocaleString('ko-KR')}`
                    : `${(c.compare + c.move + c.access).toLocaleString('ko-KR')}`;
                if (ui.tally.textContent !== text) {
                    ui.tally.textContent = text;
                    ui.tally.style.color = lane.done ? '#059669' : '#64748b';
                    ui.tally.style.fontWeight = lane.done ? '800' : '700';
                }
            });
        },

        setHeight() {},
    };
}
