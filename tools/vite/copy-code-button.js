// 코드 블록 오른쪽 위에 복사 버튼을 붙인다. **강의노트는 아무것도 적지 않는다.**
//
//   <pre><code …>…</code></pre>
//        ↓ 빌드가 이렇게 감싼다
//   <div class="code-block">
//       <button class="code-copy" type="button" data-copy …>…</button>
//       <pre><code …>…</code></pre>
//   </div>
//
// **왜 빌드가 하는가.** `<pre>`를 가진 강의노트 가운데 3분의 1 남짓은 모듈 진입점이
// 아예 없다. 진입점에서 import 하는 방식으로 만들면 그 파일들에는 버튼이 안 붙고,
// 붙이려고 진입점을 새로 다는 것은 「그 페이지가 쓰는 것만 담는다」는 규칙과 어긋난다.
// 빌드가 하면 **강의노트를 한 줄도 고치지 않고** 전부에 붙는다.
//
// **왜 래퍼를 끼우는가.** 버튼을 `<pre>` 안에 두면 가로 스크롤을 따라 흘러가 버린다.
// `CLAUDE.md`의 「래퍼 div를 끼우지 않는다」는 **넘침을 다루려고 손으로 끼우는 래퍼**를
// 막는 규칙이다. 여기 래퍼는 배경도 테두리도 없는 자리잡기용이라 둥근 모서리를 건드리지
// 않는다. flex 자식일 때를 위해 `min-width:0`을 CSS에서 함께 준다.
//
// 클릭 처리는 **위임 리스너 하나**다. 블록마다 id를 붙이던 방식은 쓰지 않는다 →
// tools/README.md의 「복사 버튼」.
const PRE = /<pre\b[^>]*>[\s\S]*?<\/pre>/g;

const BUTTON =
    '<button class="code-copy" type="button" data-copy aria-label="코드 복사">'
    + '<i class="fa-solid fa-copy" aria-hidden="true"></i><span>복사</span></button>';

// `textContent`를 쓰므로 **주입된 코드가 화면에 보이는 그대로** 복사된다.
// 이스케이프를 되돌릴 필요가 없다.
const SCRIPT = `<script>
    document.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-copy]');
        if (!btn) return;
        const code = btn.closest('.code-block')?.querySelector('pre');
        if (!code) return;
        const text = code.textContent;
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // file://은 보안 컨텍스트가 아니라 navigator.clipboard가 없다.
            // 오프라인 zip을 그대로 여는 학생이 있으므로 폴백을 지우지 않는다.
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            try { document.execCommand('copy'); } finally { ta.remove(); }
        }
        btn.classList.add('is-done');
        const label = btn.querySelector('span');
        const before = label.textContent;
        label.textContent = '복사됨';
        setTimeout(() => { label.textContent = before; btn.classList.remove('is-done'); }, 1500);
    });
</script>`;

export default function copyCodeButton() {
    return {
        name: 'copy-code-button',
        transformIndexHtml: {
            // 코드 주입(order: 'pre')이 끝난 뒤에 돈다. 주입된 코드까지 감싸기 위해서다.
            handler(html) {
                if (!html.includes('<pre')) return html;
                // 자기 복사 버튼을 이미 가진 페이지는 건드리지 않는다. 재작성 대기 중인
                // 구 문법 노트가 블록마다 `onclick="copyCode('code-hello')"`를 달고 있어,
                // 그냥 감싸면 **한 블록에 버튼이 둘** 붙는다. 그 파일들을 다시 쓰면서
                // 손으로 단 버튼이 사라지면 이 예외도 저절로 풀린다.
                if (html.includes('copyCode(')) return html;

                let wrapped = 0;
                const out = html.replace(PRE, (pre) => {
                    wrapped += 1;
                    return `<div class="code-block">${BUTTON}${pre}</div>`;
                });
                if (!wrapped) return html;

                // 리스너는 페이지에 하나면 된다. </body> 바로 앞에 둔다.
                return out.includes('</body>')
                    ? out.replace('</body>', `${SCRIPT}\n</body>`)
                    : out + SCRIPT;
            },
        },
    };
}
