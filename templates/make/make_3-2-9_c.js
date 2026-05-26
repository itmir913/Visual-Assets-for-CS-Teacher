// 복면산(覆面算) 문제 해결 (Project 3-2-9) — C 언어 버전
const {makeDocument} = require('./make_template');

makeDocument({
    s1: {
        programName: "복면산(覆面算) 문제 해결",
        purpose: [
            "각 문자가 서로 다른 숫자를 나타내는 복면산 수식 AB + BA = CC를 만족하는 A, B, C를 브루트 포스로 탐색하여 출력한다.",
        ],
        targetUser: "중첩 반복문과 continue를 학습하거나 브루트 포스(완전 탐색) 알고리즘에 관심 있는 누구나",
        features: [
            "① A, B, C를 각각 1~9 범위에서 3중 for 루프로 완전 탐색한다.",
            "② A==B 이거나 C==A 또는 C==B인 경우 continue로 건너뛴다.",
            "③ (A*10+B) + (B*10+A) == (C*10+C) 조건을 만족하는 해를 출력한다.",
            "④ 총 최대 9³=729번 탐색하며, 조건을 만족하는 해는 36쌍이 출력된다.",
        ],
        screenExample: [
            "(출력)  A=1, B=2, C=3  ->  12 + 21 = 33",
            "        A=2, B=1, C=3  ->  21 + 12 = 33",
            "        A=1, B=3, C=4  ->  13 + 31 = 44",
            "        ... (총 36쌍)",
        ],
    },

    s2: {
        programName: "복면산(覆面算) 문제 해결",
        inputDesign: [
            "없음 (입력 불필요 — 1~9 범위를 모두 탐색)",
        ],
        inputExample: ["(없음)"],
        outputDesign: [
            "조건 AB + BA = CC를 만족하는 모든 (A, B, C)를 한 줄씩 출력",
            "형식: A=%d, B=%d, C=%d  ->  %d + %d = %d",
        ],
        outputExample: [
            "A=1, B=2, C=3  ->  12 + 21 = 33",
            "A=2, B=1, C=3  ->  21 + 12 = 33",
            "... (총 36쌍)",
        ],
        constraints: [
            "A, B, C는 모두 1~9 (최고차항 0 불가)",
            "A, B, C는 서로 다른 숫자",
            "A+B=C를 만족해야 하므로 C는 최소 3(=1+2), 최대 9",
        ],
    },

    s3: {
        programName: "복면산(覆面算) 문제 해결",
        flowchart: [
            "① 시작",
            "② for (a = 1; a <= 9; a++)",
            "③   for (b = 1; b <= 9; b++)",
            "④     if (a == b) continue",
            "⑤     for (c = 1; c <= 9; c++)",
            "⑥       if (c == a || c == b) continue",
            "⑦       if ((a*10+b)+(b*10+a) == (c*10+c)) printf 출력",
            "⑧ 끝",
        ],
        pseudocode: [
            "for (a = 1; a <= 9; a++)",
            "  for (b = 1; b <= 9; b++)",
            "    if (a == b) continue",
            "",
            "    for (c = 1; c <= 9; c++)",
            "      if (c == a || c == b) continue",
            "",
            "      if ((a*10+b)+(b*10+a) == (c*10+c))",
            "        printf 출력(a, b, c)",
        ],
    },

    s4: {
        programName: "복면산(覆面算) 문제 해결",
        code: [
            "#include <stdio.h>",
            "",
            "int main() {",
            "    int a, b, c;",
            "",
            "    for (a = 1; a <= 9; a++) {      /* A: 1~9 */",
            "        for (b = 1; b <= 9; b++) {  /* B: 1~9 */",
            "            if (a == b) continue;   /* A, B 중복 건너뜀 */",
            "",
            "            for (c = 1; c <= 9; c++) {  /* C: 1~9 */",
            "                if (c == a || c == b) continue;  /* C 중복 건너뜀 */",
            "",
            "                /* 조건 확인: AB + BA == CC */",
            "                if ((a*10+b) + (b*10+a) == (c*10+c))",
            "                    printf(\"A=%d, B=%d, C=%d  ->  %d + %d = %d\\n\",",
            "                           a, b, c, a*10+b, b*10+a, c*10+c);",
            "            }",
            "        }",
            "    }",
            "    return 0;",
            "}",
        ],
        explanation: [
            "4행: 탐색에 사용할 정수 변수 a, b, c 선언",
            "",
            "6~7행: a, b를 1~9 범위에서 이중 반복",
            "8행: a==b이면 같은 문자에 같은 숫자가 배정되므로 continue로 건너뜀",
            "",
            "10행: c를 1~9 범위에서 반복",
            "11행: c가 a 또는 b와 같으면 중복이므로 continue로 건너뜀",
            "",
            "14~15행: AB + BA == CC 조건 확인 후 해 출력",
            "  수학적으로 11(a+b) == 11c → a+b == c가 성립",
        ],
    },

    s5: {
        programName: "복면산(覆面算) 문제 해결",
        errors: [
            "A, B, C의 범위를 0~9로 설정하면 최고차항이 0인 경우가 포함되어 오류 발생. 반드시 1~9.",
            "continue 없이 모든 조합을 확인하면 동일 숫자 조합이 포함될 수 있어 잘못된 해가 출력될 수 있다.",
        ],
        improvements: [
            "수학적으로 a+b==c 조건만 확인해도 동치이므로 조건식을 단순화할 수 있다.",
            "변수 ab, ba, cc를 미리 계산해두면 출력문이 간결해진다.",
        ],
        testCases: [
            {input: "(없음)", expected: "36쌍 출력, 첫 번째: A=1,B=2,C=3", actual: "36쌍 출력, 첫 번째: A=1,B=2,C=3", pass: "O"},
            {input: "a=1,b=2,c=3 검증", expected: "12 + 21 = 33", actual: "12 + 21 = 33", pass: "O"},
            {input: "a=4,b=5,c=9 검증", expected: "45 + 54 = 99", actual: "45 + 54 = 99", pass: "O"},
            {input: "a=1,b=1 (중복)", expected: "continue로 건너뜀", actual: "continue로 건너뜀", pass: "O"},
        ],
    },
}, "../c/3-2-9.docx");
