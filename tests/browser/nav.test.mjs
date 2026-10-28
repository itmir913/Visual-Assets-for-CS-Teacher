// 강의노트 차례 내비게이션이 **데스크톱에서 한 줄에 드는가**를 진짜 브라우저에서 잰다.
//
// 메뉴 이름이 길거나 많아지면 링크 줄이 두 줄로 접힌다. 마지막 메뉴 하나만 다음 줄에 남아
// 머리글이 두툼해지고 제목 칸과 높이가 어긋난다. 글자 폭은 글꼴이 붙어야 알 수 있어 정적
// 검사로는 보이지 않는다 — iframe 에 띄워 링크마다 상자의 윗변을 견준다.
//
// **폭은 노트북 가로 `W`**다. 이보다 넓은 화면은 저절로 들고, 좁은 쪽은 `md` 아래에서 메뉴가 숨는다.
import {expect, test} from 'vitest';
import {openFrame} from './_frame.mjs';

const W = 1280, H = 900;
const PARALLEL = 4;

const PAGES = Object.keys(import.meta.glob(['/*/**/*.html', '!**/node_modules/**', '!/dist*/**', '!/tests/**', '!/simulator/**']))
    .sort();

/** 한 페이지의 메뉴 줄을 재어 두 줄째로 넘어간 메뉴 이름을 돌려준다. 메뉴 줄이 없으면 null. */
async function wrapped(url) {
    const {frame, win, doc} = await openFrame(url, W, H);
    try {
        const row = [...doc.querySelectorAll('nav div')]
            .find((d) => d.className.includes('md:flex') && d.querySelector('a[href^="#"]'));
        if (!row || win.getComputedStyle(row).display === 'none') return null;
        const links = [...row.querySelectorAll('a')];
        if (links.length < 2) return null;
        const top = Math.min(...links.map((a) => a.getBoundingClientRect().top));
        return links.filter((a) => a.getBoundingClientRect().top > top + 2).map((a) => a.textContent.trim());
    } finally {
        frame.remove();
    }
}

test('차례 메뉴가 데스크톱에서 한 줄에 든다', async () => {
    const bad = [];
    for (let i = 0; i < PAGES.length; i += PARALLEL) {
        const batch = PAGES.slice(i, i + PARALLEL);
        const got = await Promise.all(batch.map((p) => wrapped(p)));
        batch.forEach((p, j) => { if (got[j]?.length) bad.push(`${p} — 다음 줄로 넘어간 메뉴: ${got[j].join(' · ')}`); });
    }
    expect(bad.join('\n')).toBe('');
}, 900000);
