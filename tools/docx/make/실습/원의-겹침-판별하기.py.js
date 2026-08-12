// 원의 겹침 여부 판별하기 (Project 3-2-10) — Python 버전
const {makeDocument} = require('../make_sw_template');
const out = require('../../outpath');

makeDocument({
    s1: {
        programName: "원의 겹침 여부 판별하기",
        purpose: [
            "두 원의 중심 좌표(x₁,y₁), (x₂,y₂)와 반지름 r₁, r₂를 입력받아 두 원의 위치 관계(외부 분리·외접·교차·내접·내부 포함)를 판별하고 출력한다.",
        ],
        targetUser: "조건문과 수학 공식을 학습하거나 부동소수점 비교 문제에 관심 있는 누구나",
        features: [
            "① 두 줄로 두 원의 정보(x, y, r)를 각각 입력받는다.",
            "② 두 중심 사이의 거리 제곱(d_sq)을 계산한다.",
            "③ 반지름 합의 제곱(sum_sq)과 반지름 차의 절댓값 제곱(diff_sq)과 비교한다.",
            "④ 5가지 경우(외부·외접·교차·내접·내부포함)를 정확히 판별하여 출력한다.",
        ],
        screenExample: [
            "(입력)  0 0 3",
            "        6 0 3",
            "(출력)  한 점에서 만난다",
            "",
            "(입력)  0 0 3",
            "        4 0 3",
            "(출력)  두 점에서 만난다",
        ],
    },

    s2: {
        programName: "원의 겹침 여부 판별하기",
        inputDesign: [
            "1행: 정수 x1, y1, r1 (공백 구분) — 첫 번째 원의 중심 좌표와 반지름",
            "2행: 정수 x2, y2, r2 (공백 구분) — 두 번째 원의 중심 좌표와 반지름",
            "자료형: int (map(int, input().split())으로 분리)",
        ],
        inputExample: ["0 0 3", "4 0 3"],
        outputDesign: [
            "조건에 따라 3가지 중 하나를 출력:",
            "  외부 분리(d_sq>sum_sq) 또는 내부 포함(d_sq<diff_sq) → \"만나지 않는다\"",
            "  외접(d_sq==sum_sq) 또는 내접(d_sq==diff_sq) → \"한 점에서 만난다\"",
            "  두 점 교차(diff_sq<d_sq<sum_sq) → \"두 점에서 만난다\"",
        ],
        outputExample: ["두 점에서 만난다"],
        constraints: [
            "math.sqrt를 쓰지 않고 제곱 비교를 사용하여 부동소수점 오차를 방지",
            "d_sq==(r1+r2)² (외접)와 d_sq==(r1-r2)² (내접) 경계 처리 필수",
        ],
    },

    s3: {
        programName: "원의 겹침 여부 판별하기",
        flowchart: [
            "① 시작",
            "② x1, y1, r1 ← 입력()",
            "③ x2, y2, r2 ← 입력()",
            "④ d_sq ← (x2-x1)² + (y2-y1)²",
            "⑤ sum_sq ← (r1+r2)²",
            "⑥ diff_sq ← (abs(r1-r2))²",
            "⑦ if d_sq > sum_sq: 출력(\"만나지 않는다\")",
            "   elif d_sq == sum_sq: 출력(\"한 점에서 만난다\")",
            "   elif d_sq > diff_sq: 출력(\"두 점에서 만난다\")",
            "   elif d_sq == diff_sq: 출력(\"한 점에서 만난다\")",
            "   else: 출력(\"만나지 않는다\")",
            "⑧ 끝",
        ],
        pseudocode: [
            "x1, y1, r1 ← 정수 3개 입력() (공백 구분)",
            "x2, y2, r2 ← 정수 3개 입력() (공백 구분)",
            "",
            "d_sq    ← (x2-x1)² + (y2-y1)²",
            "sum_sq  ← (r1+r2)²",
            "diff_sq ← (abs(r1-r2))²",
            "",
            "if d_sq > sum_sq: 출력(\"만나지 않는다\")",
            "elif d_sq == sum_sq: 출력(\"한 점에서 만난다\")",
            "elif d_sq > diff_sq: 출력(\"두 점에서 만난다\")",
            "elif d_sq == diff_sq: 출력(\"한 점에서 만난다\")",
            "else: 출력(\"만나지 않는다\")",
        ],
    },

    s4: {
        programName: "원의 겹침 여부 판별하기",
        code: [
            "# 1. 두 원의 정보 입력",
            "x1, y1, r1 = map(int, input().split())",
            "x2, y2, r2 = map(int, input().split())",
            "",
            "# 2. 제곱 거리 계산 (sqrt 미사용 → 부동소수점 오차 방지)",
            "d_sq = (x2 - x1)**2 + (y2 - y1)**2",
            "",
            "# 3. 반지름 합/차의 제곱 (정수 비교를 위해)",
            "sum_sq  = (r1 + r2)**2         # 외접/분리 경계",
            "diff_sq = (abs(r1 - r2))**2    # 내접/포함 경계",
            "",
            "# 4. 5케이스 완전 판별",
            "if d_sq > sum_sq:",
            "    print(\"만나지 않는다\")    # 케이스 1: 외부 분리",
            "elif d_sq == sum_sq:",
            "    print(\"한 점에서 만난다\") # 케이스 2: 외접",
            "elif d_sq > diff_sq:",
            "    print(\"두 점에서 만난다\") # 케이스 3: 두 점 교차",
            "elif d_sq == diff_sq:",
            "    print(\"한 점에서 만난다\") # 케이스 4: 내접",
            "else:",
            "    print(\"만나지 않는다\")    # 케이스 5: 내부 포함",
        ],
        explanation: [
            "2~3행: 두 원의 중심 좌표와 반지름을 각각 한 줄씩 입력받음",
            "",
            "6행: 두 중심 사이의 거리 제곱 계산 (sqrt를 쓰지 않아 float 없음)",
            "",
            "9행: sum_sq — (r1+r2)² : 외접/외부 분리의 경계값",
            "10행: diff_sq — (|r1-r2|)² : 내접/내부 포함의 경계값",
            "",
            "13~22행: d_sq와 경계값을 비교하여 5케이스 판별",
            "  d_sq > sum_sq   → 외부 분리 (만나지 않는다)",
            "  d_sq == sum_sq  → 외접 (한 점에서 만난다)",
            "  d_sq > diff_sq  → 두 점 교차 (두 점에서 만난다)",
            "  d_sq == diff_sq → 내접 (한 점에서 만난다)",
            "  else            → 내부 포함 (만나지 않는다)",
        ],
    },

    s5: {
        programName: "원의 겹침 여부 판별하기",
        errors: [
            "math.sqrt(...)를 사용하고 d == r1+r2로 비교하면 부동소수점 오차로 외접·내접 판별이 실패할 수 있다.",
            "5케이스 대신 3케이스만 처리하면 내접(d=|r1-r2|)과 내부 포함(d<|r1-r2|)을 \"두 점에서 만난다\"로 잘못 출력한다.",
        ],
        improvements: [
            "d_sq, sum_sq, diff_sq 변수명은 제곱값임을 명시적으로 드러내어 가독성을 높인다.",
            "abs()를 사용하면 r1>r2, r1<r2, r1==r2 세 경우를 모두 올바르게 처리할 수 있다.",
        ],
        testCases: [
            {input: "0 0 3 / 10 0 3", expected: "만나지 않는다", actual: "만나지 않는다", pass: "O"},
            {input: "0 0 3 / 6 0 3", expected: "한 점에서 만난다", actual: "한 점에서 만난다", pass: "O"},
            {input: "0 0 3 / 4 0 3", expected: "두 점에서 만난다", actual: "두 점에서 만난다", pass: "O"},
            {input: "0 0 5 / 2 0 3", expected: "한 점에서 만난다", actual: "한 점에서 만난다", pass: "O"},
            {input: "0 0 5 / 1 0 2", expected: "만나지 않는다", actual: "만나지 않는다", pass: "O"},
        ],
    },
}, out('실습', '원의-겹침-판별하기.py.docx'));
