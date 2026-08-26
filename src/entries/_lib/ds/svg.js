/* SVG 요소를 만드는 자리. **한 곳에만 둔다.**
 *
 * 자료구조 그림 셋(노드 · 트리 · 힙)이 모두 SVG를 쓴다. 파일마다 이름공간 상수와
 * 만들기 함수를 따로 두었더니, **한 페이지가 그 파일 둘을 함께 부르는 순간
 * 같은 이름이 두 번 선언되어 페이지가 통째로 죽었다**(검사 받침대는 모듈을 한 자리에
 * 모아 실행하므로 이것을 그대로 잡아 준다). 세 벌을 한 벌로 줄인다.
 */

export const SVG_NS = 'http://www.w3.org/2000/svg';

/** @param {string} tag @param {object} attrs 속성. 값은 문자열로 바뀌어 들어간다 */
export function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
    return el;
}
