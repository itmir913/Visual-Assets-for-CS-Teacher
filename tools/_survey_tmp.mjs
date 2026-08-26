import fs from 'node:fs';
import path from 'node:path';
import {SIM_ROOT, loadSim} from './_sim-harness.mjs';

const pages = fs.readdirSync(path.join(SIM_ROOT, 'ai')).filter(f => f.endsWith('.html')).map(f => 'ai/' + f.slice(0, -5)).sort();
for (const name of pages) {
    const page = loadSim(name);
    page.lifecycle();
    const {doc} = page;
    const stage = doc.querySelector('.fs-stage');
    const outside = [...doc.querySelectorAll('button, input, select, textarea')].filter(e => !stage || !stage.contains(e));
    if (!outside.length) { console.log(`\n### ${name} — 밖에 있는 조작 없음`); continue; }
    // 가장 가까운 section/h2/h3 로 묶는다
    const groups = new Map();
    for (const e of outside) {
        const sec = e.closest('section, article, div[id]');
        const head = sec ? (sec.querySelector('h1,h2,h3,h4')?.textContent || sec.id || '(이름 없음)') : '(section 밖)';
        const key = head.replace(/\s+/g, ' ').trim().slice(0, 34);
        groups.set(key, (groups.get(key) || 0) + 1);
    }
    console.log(`\n### ${name} — 밖 ${outside.length}개`);
    for (const [k, v] of groups) console.log(`   ${v}\t${k}`);
}
