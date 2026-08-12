// 고대의 지혜: 시저 암호 해독하기 (Project 3-2-6) — Python 버전
const {makeDocument} = require('../make_sw_template');
const out = require('../../outpath');

makeDocument({
    s1: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        purpose: [
            "대문자 알파벳으로 구성된 암호문을 입력받아 각 문자를 왼쪽으로 3칸 이동(ASCII −3)하여 원래 평문으로 되돌린 뒤 출력한다.",
        ],
        targetUser: "아스키코드(ord/chr)와 반복문을 학습하거나 문자열 처리에 관심 있는 누구나",
        features: [
            "① 대문자 알파벳으로만 이루어진 암호문을 한 줄 입력받는다.",
            "② 각 문자를 ord()로 ASCII 정수로 변환한 뒤 3을 뺀다.",
            "③ chr()로 정수를 다시 문자로 변환하여 결과 문자열에 이어 붙인다.",
            "④ 해독된 평문을 한 줄 출력한다.",
        ],
        screenExample: [
            "(입력)  DEFG",
            "(출력)  ABCD",
        ],
    },

    s2: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        inputDesign: [
            "대문자 알파벳으로만 구성된 문자열을 한 줄 입력",
            "자료형: str",
        ],
        inputExample: ["DEFG"],
        outputDesign: [
            "각 글자를 왼쪽으로 3칸 이동하여 해독한 평문을 한 줄 출력",
        ],
        outputExample: ["ABCD"],
        constraints: [
            "A, B, C가 포함된 경우 ord(char) - 3의 결과가 65 미만(알파벳 범위 이탈)이 되어 특수문자 출력",
            "처리 방법(순환): (ord(char) - 65 - 3) % 26 + 65 공식으로 알파벳 내에서 순환 처리 가능",
        ],
    },

    s3: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        flowchart: [
            "① 시작",
            "② cipher_text ← 입력()",
            "③ plain_text ← \"\"",
            "④ for char in cipher_text:",
            "     code ← ord(char) − 3",
            "     plain_text ← plain_text + chr(code)",
            "⑤ plain_text 출력",
            "⑥ 끝",
        ],
        pseudocode: [
            "cipher_text ← 입력()",
            "plain_text ← \"\"",
            "",
            "for char in cipher_text:",
            "  code ← ord(char) - 3",
            "  plain_text ← plain_text + chr(code)",
            "",
            "출력(plain_text)",
        ],
    },

    s4: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        code: [
            "# 1. 암호문 입력 받기",
            "cipher_text = input()",
            "plain_text = \"\"  # 결과를 저장할 빈 문자열",
            "",
            "# 2. 문자열의 각 문자를 하나씩 순회",
            "for char in cipher_text:",
            "    # ord()로 ASCII 숫자로 변환 → 3을 빼서 해독 → chr()로 다시 문자로",
            "    code = ord(char) - 3",
            "    plain_text += chr(code)",
            "",
            "# 3. 최종 해독 결과 출력",
            "print(plain_text)",
        ],
        explanation: [
            "1행: 암호문을 문자열로 입력받음",
            "",
            "5~9행: for 반복문으로 암호문 각 글자를 순회",
            "  ord(char): 문자를 ASCII 정수로 변환 (예: 'D' → 68)",
            "  - 3: 3칸 왼쪽으로 이동 (예: 68 → 65)",
            "  chr(code): 정수를 다시 문자로 변환 (예: 65 → 'A')",
            "  plain_text += chr(code): 결과 문자를 뒤에 이어 붙임",
            "",
            "12행: 해독된 평문 출력",
        ],
    },

    s5: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        errors: [
            "A, B, C처럼 ASCII 코드가 65~67인 문자에서 3을 빼면 62~64가 되어 특수문자('>', '?', '@')가 출력된다.",
            "plain_text += chr(code) 대신 plain_text + chr(code)만 쓰면 결과가 변수에 저장되지 않아 출력이 비어 있게 된다.",
        ],
        improvements: [
            "(ord(char) - 65 - 3) % 26 + 65 공식을 적용하면 A, B, C도 알파벳 범위 내에서 순환 처리(Z→X 방식)할 수 있다.",
        ],
        testCases: [
            {input: "DEFG", expected: "ABCD", actual: "ABCD", pass: "O"},
            {input: "PYTHON", expected: "MVQELK", actual: "MVQELK", pass: "O"},
            {input: "Z", expected: "W", actual: "W", pass: "O"},
            {input: "ABCD", expected: ">?@A", actual: ">?@A", pass: "O"},
        ],
    },
}, out('programming', '암호-해독하기.py.docx'));
