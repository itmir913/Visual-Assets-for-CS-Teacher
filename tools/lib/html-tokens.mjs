// HTML 을 **적힌 그대로** 태그 조각으로 가른다.
//
// 브라우저식 파서(parse5 · jsdom)는 쓰지 않는다. 그쪽은 틀린 중첩을 **고쳐서** 트리를 세우므로
// 「`</div>` 앞에 닫히지 않은 `<span>`」을 알려 주지 못한다 — 고쳐진 뒤에는 흔적이 없다.
// 여기서는 소스에 적힌 여는 태그 · 닫는 태그를 줄 번호와 함께 차례로 내놓기만 하고,
// 짝을 맞추는 일은 검사가 한다.
//
// `<script>` · `<style>` 속은 태그로 읽지 않는다(문자열 속 `<div>` 따위). 주석 · `<!DOCTYPE>` 는 건너뛴다.
import {decodeHTML} from 'entities';

const RAW_TEXT = new Set(['script', 'style']);
const NAME = /[a-zA-Z][^\t\n\r\f />\x00]*/y;
// 속성 하나. 값은 따옴표 둘 가운데 하나이거나 따옴표 없는 낱말이다.
const ATTR = /[\s/]*([^\s/>][^\s/=>]*)(?:\s*=+\s*('[^']*'|"[^"]*"|(?!['"])[^>\s]*))?/y;

/**
 * `{type: 'start'|'end', tag, attrs, selfClosing, line, index}` 을 차례로 돌려준다.
 * `attrs` 는 이름을 소문자로 바꾼 객체이고 값의 엔티티는 풀어 둔다. 같은 이름이 둘이면 뒤엣것이 이긴다.
 */
export function* tokens(src) {
    let i = 0, line = 1, counted = 0;
    // 위치는 앞으로만 가므로 줄바꿈을 이어서 센다.
    const lineAt = (pos) => {
        for (let k = src.indexOf('\n', counted); k !== -1 && k < pos; k = src.indexOf('\n', k + 1)) {
            line++;
            counted = k + 1;
        }
        return line;
    };
    while (true) {
        const lt = src.indexOf('<', i);
        if (lt === -1) return;
        const next = src[lt + 1];
        if (src.startsWith('<!--', lt)) {
            const end = src.indexOf('-->', lt + 4);
            i = end === -1 ? src.length : end + 3;
            continue;
        }
        if (next === '!' || next === '?') {
            const end = src.indexOf('>', lt + 2);
            i = end === -1 ? src.length : end + 1;
            continue;
        }
        if (next === '/') {
            NAME.lastIndex = lt + 2;
            const m = NAME.exec(src);
            if (!m) { i = lt + 2; continue; }
            const end = src.indexOf('>', lt + 2);
            if (end === -1) return;
            yield {type: 'end', tag: m[0].toLowerCase(), line: lineAt(lt), index: lt};
            i = end + 1;
            continue;
        }
        NAME.lastIndex = lt + 1;
        const m = NAME.exec(src);
        if (!m) { i = lt + 1; continue; }
        const tag = m[0].toLowerCase();
        const attrs = {};
        let j = NAME.lastIndex;
        while (true) {
            ATTR.lastIndex = j;
            const a = ATTR.exec(src);
            if (!a || a[0] === '') break;
            let v = a[2] === undefined ? null : a[2];
            if (v && (v[0] === '"' || v[0] === '\'')) v = v.slice(1, -1);
            attrs[a[1].toLowerCase()] = v === null ? null : decodeHTML(v);
            j = ATTR.lastIndex;
        }
        while (j < src.length && /\s/.test(src[j])) j++;
        let selfClosing = false;
        if (src[j] === '/') { selfClosing = true; j++; }
        while (j < src.length && src[j] !== '>') j++;
        if (j >= src.length) return;
        yield {type: 'start', tag, attrs, selfClosing, line: lineAt(lt), index: lt, end: j + 1};
        i = j + 1;
        if (RAW_TEXT.has(tag) && !selfClosing) {
            const close = new RegExp(`</${tag}(?=[\\s/>])`, 'ig');
            close.lastIndex = i;
            const c = close.exec(src);
            i = c ? c.index : src.length;
        }
    }
}
