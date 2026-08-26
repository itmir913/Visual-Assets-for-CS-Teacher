// SVG 글자 폭을 측정하는 도구. **트리 뷰와 그래프 뷰가 함께 쓴다.**
//
// 상자 폭은 글자를 측정해 정해야 한다. 어림값만 쓰면 긴 라벨이 상자를 뚫거나
// 이웃과 겹친다. 브라우저에서는 `getComputedTextLength()`로 정확히 측정하고,
// 그것이 없는 환경(테스트용 node 실행 등)에서는 글자 종류로 어림한다.
// **어림값은 실제보다 넉넉한 쪽으로** 잡는다 — 모자라면 글자가 상자를 뚫지만
// 남으면 조금 헐거울 뿐이다.
export class TextMeasurer {
    constructor(svgNode) {
        this.svg = svgNode;
        this.cache = new Map();
        this.probe = null;
    }

    /** @returns {number} px 단위 폭 */
    width(text, fontSize, bold) {
        const key = `${fontSize}|${bold ? 'b' : 'n'}|${text}`;
        const hit = this.cache.get(key);
        if (hit !== undefined) return hit;

        let w = this._measure(text, fontSize, bold);
        if (!(w > 0)) w = this._estimate(text, fontSize, bold);
        this.cache.set(key, w);
        return w;
    }

    _measure(text, fontSize, bold) {
        if (!this.svg || typeof this.svg.appendChild !== 'function') return 0;
        try {
            if (!this.probe) {
                const ns = 'http://www.w3.org/2000/svg';
                this.probe = document.createElementNS(ns, 'text');
                this.probe.setAttribute('visibility', 'hidden');
                this.probe.setAttribute('aria-hidden', 'true');
                this.svg.appendChild(this.probe);
            }
            this.probe.setAttribute('font-size', String(fontSize));
            this.probe.setAttribute('font-weight', bold ? '700' : '400');
            this.probe.textContent = text;
            const len = this.probe.getComputedTextLength();
            return Number.isFinite(len) ? len : 0;
        } catch {
            return 0;
        }
    }

    /** 글자 종류로 어림한다. 한글·한자는 한 칸을 다 쓰고 로마자·숫자는 절반쯤 쓴다. */
    _estimate(text, fontSize, bold) {
        let em = 0;
        for (const ch of String(text)) {
            const code = ch.codePointAt(0);
            if (code >= 0x1100 && code <= 0xd7ff) em += 1.0;        // 한글
            else if (code >= 0x3000 && code <= 0x303f) em += 1.0;   // 한중일 문장 부호
            else if (code >= 0x4e00 && code <= 0x9fff) em += 1.0;   // 한자
            else if (ch === ' ') em += 0.3;
            else if (/[iljt.,:;'!|]/.test(ch)) em += 0.32;
            else if (/[A-Z]/.test(ch)) em += 0.68;
            else em += 0.56;
        }
        return em * fontSize * (bold ? 1.06 : 1);
    }
}

export default TextMeasurer;
