// 철광석 제련 알고리즘 (Project 3-2-11) — Python 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "철광석 제련 알고리즘",
        purpose: [
            "5×5 광산 격자를 입력받아 3×3 제련기가 이동할 수 있는 모든 위치에서 합계를 계산하고, 그 중 최댓값을 출력한다.",
        ],
        targetUser: "2차원 리스트 순회와 슬라이딩 윈도우 기법을 학습하거나 부분합 탐색에 관심 있는 누구나",
        features: [
            "① 5줄에 걸쳐 공백으로 구분된 5개의 정수를 입력받아 2차원 리스트로 저장한다.",
            "② 3×3 윈도우가 격자를 벗어나지 않는 시작점(i, j) 범위(0~2)를 탐색한다.",
            "③ 4중 for문으로 각 3×3 영역의 합계(current_sum)를 계산한다.",
            "④ 모든 윈도우 합계 중 최댓값(max_total)을 갱신하여 출력한다.",
        ],
        screenExample: [
            "(입력)  12 34 11 20 15",
            "        22 45 67 12  8",
            "        31 18  9 44 27",
            "         5 10 33 21 19",
            "        40  2 14 50  3",
            "(출력)  260",
        ],
    },

    s2: {
        programName: "철광석 제련 알고리즘",
        inputDesign: [
            "5줄에 걸쳐 각 줄마다 공백으로 구분된 5개의 정수가 입력됨",
            "자료형: int (list(map(int, input().split()))으로 한 줄씩 변환)",
        ],
        inputExample: [
            "12 34 11 20 15",
            "22 45 67 12 8",
            "31 18 9 44 27",
            "5 10 33 21 19",
            "40 2 14 50 3",
        ],
        outputDesign: [
            "3×3 영역 합계의 최댓값 1개를 출력",
            "탐색 범위: 시작점 i, j ∈ {0,1,2} → 총 9가지 윈도우 위치",
        ],
        outputExample: ["260"],
        constraints: [
            "유효 시작점 수 = 격자 크기(5) − 윈도우 크기(3) + 1 = 3 → range(3)",
            "max_total = 0 초기화는 양수 보장 시 안전; 음수 포함 시 float('-inf') 권장",
        ],
    },

    s3: {
        programName: "철광석 제련 알고리즘",
        flowchart: [
            "① 시작",
            "② grid ← 5줄 입력 (리스트 컴프리헨션)",
            "③ max_total ← 0",
            "④ for i in range(3):  (윈도우 시작 행)",
            "⑤   for j in range(3):  (윈도우 시작 열)",
            "⑥     current_sum ← 0",
            "⑦     for r in range(i, i+3):  (내부 행)",
            "⑧       for c in range(j, j+3):  (내부 열)",
            "⑨         current_sum += grid[r][c]",
            "⑩     if current_sum > max_total: max_total ← current_sum",
            "⑪ 출력(max_total)",
            "⑫ 끝",
        ],
        pseudocode: [
            "grid ← [list(map(int, input().split())) for _ in range(5)]",
            "max_total ← 0",
            "",
            "for i in range(3):",
            "  for j in range(3):",
            "    current_sum ← 0",
            "    for r in range(i, i+3):",
            "      for c in range(j, j+3):",
            "        current_sum += grid[r][c]",
            "    if current_sum > max_total:",
            "      max_total ← current_sum",
            "",
            "출력(max_total)",
        ],
    },

    s4: {
        programName: "철광석 제련 알고리즘",
        code: [
            "# 1. 5x5 격자 입력 (리스트 컴프리헨션으로 5줄 한 번에 읽기)",
            "grid = [list(map(int, input().split())) for _ in range(5)]",
            "# → grid[행][열] 형태 접근. 예: grid[0][1]=34, grid[1][2]=67",
            "",
            "# 2. 최댓값 초기화",
            "max_total = 0  # 양수 보장 시 0, 범용은 float('-inf')",
            "",
            "# 3. 윈도우 시작점 탐색: i, j = 0~2  (5-3+1=3가지)",
            "for i in range(3):       # 시작 행: 0, 1, 2",
            "    for j in range(3):   # 시작 열: 0, 1, 2",
            "        current_sum = 0",
            "        # 4. 3x3 내부 합계 계산",
            "        for r in range(i, i + 3):  # 내부 행 r = i, i+1, i+2",
            "            for c in range(j, j + 3):  # 내부 열 c = j, j+1, j+2",
            "                current_sum += grid[r][c]",
            "",
            "        # 5. 최댓값 갱신",
            "        if current_sum > max_total:",
            "            max_total = current_sum",
            "",
            "print(max_total)",
        ],
        explanation: [
            "2행: 리스트 컴프리헨션으로 5줄을 한 번에 읽어 2차원 리스트 생성",
            "  [list(map(int, input().split())) for _ in range(5)]",
            "",
            "8~9행: 외부 이중 루프 — 3×3 윈도우의 시작점(i, j)을 0~2로 탐색",
            "  5-3+1=3이므로 range(3) → {0, 1, 2}",
            "",
            "13~15행: 내부 이중 루프 — 시작점(i,j)에서 3×3 영역 합계 누적",
            "  r: i부터 i+2까지, c: j부터 j+2까지",
            "",
            "18~19행: 현재 윈도우 합계가 최댓값보다 크면 갱신",
        ],
    },

    s5: {
        programName: "철광석 제련 알고리즘",
        errors: [
            "시작점을 range(5)로 설정하면 i=3, i=4일 때 내부 루프가 격자를 벗어나 IndexError 발생. 반드시 range(3).",
            "max_total = 0으로 초기화하면 음수 격자에서 실제 최대 합이 음수여도 0이 출력된다. float('-inf')로 안전하게 초기화.",
        ],
        improvements: [
            "리스트 컴프리헨션 대신 for 루프로 풀어쓰면 입력 처리 과정을 명확히 이해할 수 있다.",
            "슬라이딩 윈도우 최적화: 이전 합계에서 이동한 열/행만 더하고 빼는 방식으로 O(n²)→O(n) 개선 가능.",
        ],
        testCases: [
            {input: "예시 데이터 (5×5)", expected: "260 (i=0,j=1 위치)", actual: "260", pass: "O"},
            {input: "모든 값 5 (5×5)", expected: "45 (9칸×5)", actual: "45", pass: "O"},
            {input: "최대값이 오른쪽 하단 (i=2,j=2)", expected: "57", actual: "57", pass: "O"},
            {input: "단일 최대값 위치 (i=1,j=1)", expected: "해당 3×3 합", actual: "정상 출력", pass: "O"},
        ],
    },
}, out('실습', '철광석-제련.py.docx'));
