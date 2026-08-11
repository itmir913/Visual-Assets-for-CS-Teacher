// 확률로 푸는 수학: 파이(π)값 근사하기 (Project 3-2-7) — Python 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        purpose: [
            "n개의 (x, y) 좌표를 입력받아 사분원(x²+y²≤1) 내부에 있는 점의 비율로 π의 근삿값(4 × in_count / n)을 계산하여 출력한다.",
        ],
        targetUser: "몬테카를로 시뮬레이션 및 기하학적 확률을 학습하거나 2차원 리스트에 관심 있는 누구나",
        features: [
            "① 전체 점의 개수 n을 입력받는다.",
            "② n개의 (x, y) 좌표를 공백으로 구분하여 한 줄씩 입력받는다.",
            "③ 각 점에 대해 x²+y²≤1 조건으로 사분원 내부 여부를 판별한다.",
            "④ π ≈ 4 × (원 안의 점 개수 / 전체 점 개수)로 근삿값을 계산하여 출력한다.",
        ],
        screenExample: [
            "(입력)  4",
            "        0.1 0.2",
            "        0.9 0.8",
            "        0.3 0.4",
            "        0.5 0.5",
            "(출력)  파이 근삿값: 3.0",
        ],
    },

    s2: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        inputDesign: [
            "첫 줄: 점의 개수 n (정수)",
            "이후 n줄: x y 좌표 (실수, 공백 구분)",
            "좌표 범위: 0.0 ≤ x, y ≤ 1.0",
        ],
        inputExample: ["4", "0.1 0.2", "0.9 0.8", "0.3 0.4", "0.5 0.5"],
        outputDesign: [
            "계산된 π의 근삿값을 '파이 근삿값: ' 접두어와 함께 출력",
        ],
        outputExample: ["파이 근삿값: 3.0"],
        constraints: [
            "n = 0 입력 시 in_count / n에서 ZeroDivisionError 발생",
            "좌표 범위(0~1)를 벗어나는 값 입력 시 π 근삿값이 크게 틀릴 수 있음",
            "처리 방법: if n == 0 조건으로 입력 유효성 검사 추가 권장",
        ],
    },

    s3: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        flowchart: [
            "① 시작",
            "② n ← 입력()",
            "③ in_count ← 0",
            "④ for _ in range(n):",
            "     x, y ← 입력(실수 2개)",
            "     [x²+y² ≤ 1?]",
            "       예  → in_count ← in_count + 1",
            "       아니오 → 다음 반복",
            "⑤ pi_approx ← 4 × (in_count / n)",
            "⑥ '파이 근삿값: ' + pi_approx 출력",
            "⑦ 끝",
        ],
        pseudocode: [
            "n ← 정수 입력()",
            "in_count ← 0",
            "",
            "for _ in range(n):",
            "  x, y ← 실수 입력() (공백 구분)",
            "  if x*x + y*y <= 1:",
            "    in_count ← in_count + 1",
            "",
            "pi_approx ← 4 * (in_count / n)",
            "출력('파이 근삿값:', pi_approx)",
        ],
    },

    s4: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        code: [
            "# 1. 점의 개수 입력",
            "n = int(input())",
            "in_count = 0  # 원 안에 들어간 점의 개수",
            "",
            "# 2. n개의 좌표를 순회하며 사분원 내부 여부 판별",
            "for _ in range(n):",
            "    x, y = map(float, input().split())  # 한 줄에 x, y 좌표 입력",
            "    if x**2 + y**2 <= 1:  # 제곱 합이 1 이하 → 원 내부",
            "        in_count += 1",
            "",
            "# 3. π 근삿값 계산 및 출력",
            "pi_approx = 4 * (in_count / n)",
            "print(\"파이 근삿값:\", pi_approx)",
        ],
        explanation: [
            "2행: n을 정수로 입력받음 (점의 개수)",
            "",
            "6~9행: for 반복문으로 n개의 좌표를 순회",
            "  map(float, input().split()): 한 줄에서 공백 구분 두 실수 입력",
            "  x**2 + y**2 <= 1: 사분원 내부 판별 조건",
            "  (거리 √(x²+y²) ≤ 1 이므로 제곱 상태에서 1과 비교)",
            "",
            "12~13행: 4 × (in_count / n)으로 π 근삿값 계산 후 출력",
            "  정사각형(넓이=1) 대비 사분원(넓이=π/4) 비율 → 4 곱하면 π",
        ],
    },

    s5: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        errors: [
            "n = 0 입력 시 in_count / n에서 ZeroDivisionError: division by zero가 발생한다.",
            "x**2 + y**2의 결과와 거리 자체(√ 없이)를 비교하려 하면 논리 오류가 발생한다. 반드시 제곱 상태에서 1과 비교해야 한다.",
        ],
        improvements: [
            "if n == 0 조건 검사를 추가하면 ZeroDivisionError를 방어할 수 있다.",
            "random.random()을 사용하면 직접 좌표를 입력하지 않고 자동 시뮬레이션을 구현할 수 있다.",
        ],
        testCases: [
            {
                input: "4 / 0.1 0.2 / 0.9 0.8 / 0.3 0.4 / 0.5 0.5",
                expected: "파이 근삿값: 3.0",
                actual: "파이 근삿값: 3.0",
                pass: "O"
            },
            {input: "1 / 0.0 0.0", expected: "파이 근삿값: 4.0", actual: "파이 근삿값: 4.0", pass: "O"},
            {input: "2 / 0.9 0.9 / 0.8 0.8", expected: "파이 근삿값: 0.0", actual: "파이 근삿값: 0.0", pass: "O"},
            {
                input: "4 / 0.0 0.0 / 1.0 0.0 / 0.0 1.0 / 0.7 0.7",
                expected: "파이 근삿값: 4.0",
                actual: "파이 근삿값: 4.0",
                pass: "O"
            },
        ],
    },
}, out('py', '3-2-7.docx'));
