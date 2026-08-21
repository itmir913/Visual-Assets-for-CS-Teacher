// `gen_graph_presets.mjs`가 고른 지도를 **JS 모듈 글자로 바꾼다.**
//
// 뽑는 일과 적는 일을 나눠 둔 이유는 하나다 — 헤더 주석이 길어서, 지도를 고르는 코드
// 한가운데 두면 무엇이 조건이고 무엇이 설명인지 읽히지 않는다.

export function emit(presets) {
    const head = `// 그래프 탐색 시뮬레이터가 쓰는 **지도 열두 장**. 맹목적 탐색과 정보 이용 탐색이 함께 쓴다.
//
// ## 왜 무작위로 만들지 않는가
//
// 아무렇게나 만든 그래프에서는 **최상 우선 탐색이 대개 A*와 같은 답을 낸다.** 그러면
// 「h만 보면 손해를 볼 수 있다」는 이 화면의 요점이 화면에 안 나온다. 그래서 지도는
// 조건을 걸어 골라 두고 **글자 그대로 얼려** 둔다.
//
// **여기 적힌 좌표를 손으로 고치지 마라.** 좌표가 곧 거리이고 거리가 곧 비용과 h(n)이라,
// 한 점만 옮겨도 아래 보증이 통째로 흔들린다. 지도를 다시 뽑으려면 \`npm run gen:graph\`,
// 뽑고 나면 \`npm run check:graph\`다. **무엇을 보증하는지는 그 검사가 안다** —
// 조건 목록을 여기 옮겨 적지 않는 이유다.
//
// ## 데이터 모양
//
// - \`nodes\`: \`{id, x, y}\`
// - \`edges\`: \`{a, b, dir, extra}\`
//   - \`dir\`: 방향을 켰을 때 어느 쪽으로 가는가. 'both' | 'a2b' | 'b2a'
//   - \`extra\`: 참이면 **이 간선이 사이클을 만든다.** 사이클을 끄면 이것들이 빠지고
//     남는 뼈대가 트리가 된다
export const GRAPH_PRESETS = [
`;

    const body = presets.map((p, i) => {
        const nodes = p.nodes.map(n => `            {id: '${n.id}', x: ${n.x}, y: ${n.y}},`).join('\n');
        const edges = p.edges.map(e =>
            `            {a: '${e.a}', b: '${e.b}', dir: '${e.dir}'${e.extra ? ', extra: true' : ''}},`).join('\n');
        return `    {
        id: 'map-${i + 1}',
        name: '지도 ${i + 1}',
        start: '${p.start}',
        goal: '${p.goal}',
        nodes: [
${nodes}
        ],
        edges: [
${edges}
        ],
    },`;
    }).join('\n');

    return head + body + '\n];\n\nexport default GRAPH_PRESETS;\n';
}
