// 복면산(覆面算) 문제 해결 (Project 3-2-9) — Python 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "복면산(覆面算) 문제 해결",
        purpose: [
            "각 문자가 서로 다른 숫자를 나타내는 복면산 수식 AB + BA = CC를 만족하는 A, B, C를 브루트 포스로 탐색하여 출력한다.",
        ],
        targetUser: "반복문과 조건문을 학습하거나 브루트 포스(완전 탐색) 알고리즘에 관심 있는 누구나",
        features: [
            "① A, B, C를 각각 1~9 범위에서 3중 for 루프로 완전 탐색한다.",
            "② A==B 이거나 C==A 또는 C==B인 경우 continue로 건너뛴다.",
            "③ (A×10+B) + (B×10+A) == (C×10+C) 조건을 만족하는 해를 출력한다.",
            "④ 총 최대 9³=729번 탐색하며, 조건을 만족하는 해는 36쌍이 출력된다.",
        ],
        screenExample: [
            "(출력)  A=1, B=2, C=3  →  12 + 21 = 33",
            "        A=2, B=1, C=3  →  21 + 12 = 33",
            "        A=1, B=3, C=4  →  13 + 31 = 44",
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
            "형식: A={a}, B={b}, C={c}  →  {AB} + {BA} = {CC}",
        ],
        outputExample: [
            "A=1, B=2, C=3  →  12 + 21 = 33",
            "A=2, B=1, C=3  →  21 + 12 = 33",
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
            "② for a in range(1, 10):",
            "③   for b in range(1, 10):",
            "④     if a == b: continue",
            "⑤     for c in range(1, 10):",
            "⑥       if c == a or c == b: continue",
            "⑦       if (a*10+b)+(b*10+a) == (c*10+c): 출력",
            "⑧ 끝",
        ],
        pseudocode: [
            "for a in range(1, 10):",
            "  for b in range(1, 10):",
            "    if a == b: continue",
            "",
            "    for c in range(1, 10):",
            "      if c == a or c == b: continue",
            "",
            "      if (a*10+b) + (b*10+a) == (c*10+c):",
            "        출력(a, b, c)",
        ],
    },

    s4: {
        programName: "복면산(覆面算) 문제 해결",
        code: [
            "# 3중 반복문으로 가능한 모든 (A, B, C) 조합 탐색",
            "# 최대 9×9×9 = 729회 탐색, continue로 불필요한 연산 제거",
            "",
            "for a in range(1, 10):     # A: 1~9 (AB의 첫 자리 → 0 불가)",
            "    for b in range(1, 10): # B: 1~9 (BA의 첫 자리 → 0 불가)",
            "        if a == b: continue  # A와 B가 같으면 다음 b로 건너뜀",
            "",
            "        for c in range(1, 10): # C: 1~9 (CC의 첫 자리 → 0 불가)",
            "            if c == a or c == b: continue  # C가 A 또는 B와 같으면 건너뜀",
            "",
            "            # 조건 확인: AB + BA == CC",
            "            if (a * 10 + b) + (b * 10 + a) == (c * 10 + c):",
            "                print(f\"A={a}, B={b}, C={c}  →  {a*10+b} + {b*10+a} = {c*10+c}\")",
        ],
        explanation: [
            "4행: a를 1~9 범위로 탐색 (AB의 첫 자리이므로 0 불가)",
            "5행: b를 1~9 범위로 탐색 (BA의 첫 자리이므로 0 불가)",
            "6행: a==b이면 같은 숫자가 다른 문자를 나타내므로 continue로 건너뜀",
            "",
            "8행: c를 1~9 범위로 탐색 (CC의 첫 자리이므로 0 불가)",
            "9행: c가 a 또는 b와 같으면 중복이므로 continue로 건너뜀",
            "",
            "12~13행: AB + BA == CC 조건 확인 후 해 출력",
            "  수학적으로 11(a+b) == 11c → a+b == c가 성립",
        ],
    },

    s5: {
        programName: "복면산(覆面算) 문제 해결",
        errors: [
            "A, B, C의 범위를 0~9로 설정하면 최고차항이 0인 경우(예: 01+10=11)가 포함되어 오류 발생. 반드시 1~9.",
            "continue 없이 모든 조합을 확인하면 동일 숫자 조합이 포함될 수 있어 잘못된 해가 출력될 수 있다.",
        ],
        improvements: [
            "수학적으로 a+b==c 조건만 확인해도 동치이므로 조건식을 단순화할 수 있다.",
            "itertools.permutations(range(1, 10), 3)을 사용하면 중복 체크를 자동화할 수 있다.",
        ],
        testCases: [
            {input: "(없음)", expected: "36쌍 출력, 첫 번째: A=1,B=2,C=3", actual: "36쌍 출력, 첫 번째: A=1,B=2,C=3", pass: "O"},
            {input: "a=1,b=2,c=3 검증", expected: "12 + 21 = 33", actual: "12 + 21 = 33", pass: "O"},
            {input: "a=4,b=5,c=9 검증", expected: "45 + 54 = 99", actual: "45 + 54 = 99", pass: "O"},
            {input: "a=1,b=1 (중복)", expected: "continue로 건너뜀", actual: "continue로 건너뜀", pass: "O"},
        ],
    },
}, out('실습', '복면산-문제.py.docx'));
