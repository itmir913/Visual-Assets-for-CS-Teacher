// 확률로 푸는 수학: 파이(π)값 근사하기 (Project 3-2-7) — C 언어 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        purpose: [
            "n개의 (x, y) 좌표를 입력받아 사분원(x²+y²≤1) 내부에 있는 점의 비율로 π의 근삿값(4 × in_count / n)을 계산하여 출력한다.",
        ],
        targetUser: "몬테카를로 시뮬레이션 및 기하학적 확률을 학습하거나 2중 배열/반복문에 관심 있는 누구나",
        features: [
            "① 전체 점의 개수 n을 입력받는다.",
            "② n개의 (x, y) 좌표를 공백으로 구분하여 한 줄씩 입력받는다.",
            "③ 각 점에 대해 x*x + y*y <= 1.0 조건으로 사분원 내부 여부를 판별한다.",
            "④ π ≈ 4.0 × (원 안의 점 개수 / 전체 점 개수)로 근삿값을 계산하여 출력한다.",
        ],
        screenExample: [
            "(입력)  4",
            "        0.1 0.2",
            "        0.9 0.8",
            "        0.3 0.4",
            "        0.5 0.5",
            "(출력)  파이 근삿값: 3.000000",
        ],
    },

    s2: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        inputDesign: [
            "첫 줄: 점의 개수 n (정수, scanf(\"%d\", &n))",
            "이후 n줄: x y 좌표 (실수, scanf(\"%lf %lf\", &x, &y))",
            "좌표 범위: 0.0 ≤ x, y ≤ 1.0",
        ],
        inputExample: ["4", "0.1 0.2", "0.9 0.8", "0.3 0.4", "0.5 0.5"],
        outputDesign: [
            "계산된 π의 근삿값을 '파이 근삿값: ' 접두어와 함께 소수점 6자리로 출력",
        ],
        outputExample: ["파이 근삿값: 3.000000"],
        constraints: [
            "n = 0 입력 시 in_count / n에서 정수 나눗셈 오류 또는 미정의 동작(UB) 발생",
            "double 대신 int로 나눗셈하면 4 * 0 = 0이 되어 오류 발생 — 4.0 또는 (double) 캐스팅 필요",
            "좌표 범위(0~1)를 벗어나는 값 입력 시 π 근삿값이 크게 틀릴 수 있음",
        ],
    },

    s3: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        flowchart: [
            "① 시작",
            "② scanf(\"%d\", &n)",
            "③ in_count ← 0",
            "④ for (i = 0; i < n; i++)",
            "     scanf(\"%lf %lf\", &x, &y)",
            "     [x*x + y*y <= 1.0?]",
            "       예  → in_count ← in_count + 1",
            "       아니오 → 다음 반복",
            "⑤ pi_approx ← 4.0 × in_count / n",
            "⑥ printf(\"파이 근삿값: %f\\n\", pi_approx)",
            "⑦ 끝",
        ],
        pseudocode: [
            "scanf(\"%d\", &n)",
            "in_count ← 0",
            "",
            "for (i = 0; i < n; i++)",
            "  scanf(\"%lf %lf\", &x, &y)",
            "  if (x*x + y*y <= 1.0)",
            "    in_count ← in_count + 1",
            "",
            "pi_approx ← 4.0 * in_count / n",
            "printf(\"파이 근삿값: %f\\n\", pi_approx)",
        ],
    },

    s4: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        code: [
            "#include <stdio.h>",
            "",
            "int main() {",
            "    /* 1. 점의 개수 입력 */",
            "    int n;",
            "    scanf(\"%d\", &n);",
            "",
            "    /* 2. n개의 좌표를 순회하며 사분원 내부 여부 판별 */",
            "    int in_count = 0;",
            "    for (int i = 0; i < n; i++) {",
            "        double x, y;",
            "        scanf(\"%lf %lf\", &x, &y);",
            "        /* x²+y² ≤ 1: 제곱 합이 1 이하 → 원 내부 */",
            "        if (x * x + y * y <= 1.0)",
            "            in_count++;",
            "    }",
            "",
            "    /* 3. π 근삿값 계산 및 출력 */",
            "    double pi_approx = 4.0 * in_count / n;",
            "    printf(\"파이 근삿값: %f\\n\", pi_approx);",
            "",
            "    return 0;",
            "}",
        ],
        explanation: [
            "1행: stdio.h (입출력) 헤더 포함",
            "",
            "4~6행: 점의 개수 n을 정수로 입력받음",
            "",
            "9~16행: 반복문으로 n개의 좌표를 순회",
            "  scanf(\"%lf %lf\", &x, &y): double 형 두 값을 입력받음",
            "  x * x + y * y <= 1.0: 사분원 내부 판별 조건",
            "",
            "19~20행: 4.0 * in_count / n으로 π 근삿값 계산 후 출력",
            "  4.0을 곱해야 정수 나눗셈을 방지할 수 있음 (C에서는 int/int → 정수 결과)",
            "  %f: 소수점 6자리 출력 (기본)",
        ],
    },

    s5: {
        programName: "확률로 푸는 수학: 파이(π)값 근사하기",
        errors: [
            "4 * in_count / n처럼 4가 정수이면 연산이 왼쪽부터 수행되어 (4 * in_count) / n이 정수 나눗셈이 될 수 있다. 4.0 * in_count / n 또는 4 * (double)in_count / n으로 써야 한다.",
            "scanf에서 double 변수 입력 시 %f가 아닌 %lf를 사용해야 한다 (%f는 float 전용).",
        ],
        improvements: [
            "if (n == 0) 조건 검사를 추가하면 0으로 나누기 오류를 방어할 수 있다.",
        ],
        testCases: [
            {
                input: "4 / 0.1 0.2 / 0.9 0.8 / 0.3 0.4 / 0.5 0.5",
                expected: "파이 근삿값: 3.000000",
                actual: "파이 근삿값: 3.000000",
                pass: "O"
            },
            {input: "1 / 0.0 0.0", expected: "파이 근삿값: 4.000000", actual: "파이 근삿값: 4.000000", pass: "O"},
            {input: "2 / 0.9 0.9 / 0.8 0.8", expected: "파이 근삿값: 0.000000", actual: "파이 근삿값: 0.000000", pass: "O"},
            {
                input: "4 / 0.0 0.0 / 1.0 0.0 / 0.0 1.0 / 0.7 0.7",
                expected: "파이 근삿값: 4.000000",
                actual: "파이 근삿값: 4.000000",
                pass: "O"
            },
        ],
    },
}, out('실습', '파이값-근사하기.c.docx'));
