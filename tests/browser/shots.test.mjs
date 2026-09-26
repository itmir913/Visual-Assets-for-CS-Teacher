// 사람이 눈으로 볼 화면을 찍는다 — **판정하지 않는다.** `VITE_SHOTS=폴더` 가 있을 때만 돈다.
//
//     VITE_SHOTS=<폴더> npx vitest run --project browser tests/browser/shots.test.mjs
//
// 폴더는 `dist-shots/`처럼 저장소 안이어야 한다 — Vite 가 바깥 쓰기를 막는다.
//
// 레이아웃 검사(`sim-layout.test.mjs`)는 겹침 · 넘침처럼 기계가 판정할 수 있는 것만 본다.
// 「그림이 화면을 넉넉히 쓰는가 · 보기 좋은가」는 찍어서 사람이 본다.
import {test} from 'vitest';
import {page} from 'vitest/browser';
import {SIM_PAGES, openFrame, resizeFrame, visible} from './_frame.mjs';

// 브라우저 쪽으로는 `VITE_` 로 시작하는 환경 변수만 건너온다.
const OUT = import.meta.env.VITE_SHOTS || '';

test.skipIf(!OUT)('시뮬레이터 화면 찍기', async () => {
    for (const p of SIM_PAGES) {
        const name = p.replace('/simulator/', '').replace(/[/.]/g, '_');
        const {frame, win, doc} = await openFrame(p, 375, 812);
        await page.screenshot({element: frame, path: `${OUT}/${name}__375.png`});
        const stages = [...doc.querySelectorAll('.fs-stage')].filter((s) => visible(s, win));
        for (const stage of stages) {
            await resizeFrame(frame, 1366, 768);
            stage.classList.add('fs-on');
            stage.style.cssText += ';position:fixed;inset:0;z-index:2147483647;margin:0';
            win.dispatchEvent(new win.Event('resize'));
            await new Promise((r) => setTimeout(r, 500));
            await page.screenshot({element: frame, path: `${OUT}/${name}__full_${stage.id}.png`});
            stage.classList.remove('fs-on');
            stage.style.position = stage.style.inset = stage.style.zIndex = stage.style.margin = '';
        }
        frame.remove();
    }
});
