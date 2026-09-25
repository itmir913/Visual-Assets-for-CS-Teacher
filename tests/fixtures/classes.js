// check -- classes 가 JS 속 Tailwind 클래스를 잡는지 보는 틀린 조각. 걸려야 할 줄과 걸리면 안 되는 줄을 함께 둔다.
el.className = 'px-3 py-1 font-bold';                         // 걸린다 — 셋 다 Tailwind
host.innerHTML = '<p class="min-h-[3rem] sim-badge"></p>';   // 걸린다 — min-h-[3rem] 만
row.classList.toggle('hidden', off);                          // 안 걸린다 — 상태 표시로 둔 예외
chip.classList.add('sim-badge', 'on');                        // 안 걸린다 — 뜻을 가진 이름
box.style.display = 'flex';                                   // 안 걸린다 — 클래스 자리가 아니다
