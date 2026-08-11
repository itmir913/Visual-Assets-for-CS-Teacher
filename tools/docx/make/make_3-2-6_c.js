// 고대의 지혜: 시저 암호 해독하기 (Project 3-2-6) — C 언어 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        purpose: [
            "대문자 알파벳으로 구성된 암호문을 입력받아 각 문자를 왼쪽으로 3칸 이동(ASCII −3)하여 원래 평문으로 되돌린 뒤 출력한다.",
        ],
        targetUser: "아스키코드와 반복문을 학습하거나 문자열 처리에 관심 있는 누구나",
        features: [
            "① 대문자 알파벳으로만 이루어진 암호문을 문자 배열로 입력받는다.",
            "② 각 문자의 ASCII 값에서 3을 빼서 해독한 문자를 구한다.",
            "③ 해독한 문자를 printf로 순서대로 출력한다.",
            "④ 마지막에 줄바꿈을 출력한다.",
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
            "자료형: char[] (scanf(\"%s\", ...)",
        ],
        inputExample: ["DEFG"],
        outputDesign: [
            "각 글자를 왼쪽으로 3칸 이동하여 해독한 평문을 한 줄 출력",
        ],
        outputExample: ["ABCD"],
        constraints: [
            "A, B, C가 포함된 경우 char - 3의 결과가 65 미만(알파벳 범위 이탈)이 되어 특수문자 출력",
            "입력 문자열 길이가 배열 크기를 초과하면 버퍼 오버플로우 발생",
            "처리 방법(순환): (cipher_text[i] - 65 - 3 + 26) % 26 + 65 공식으로 순환 처리 가능",
        ],
    },

    s3: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        flowchart: [
            "① 시작",
            "② scanf(\"%s\", cipher_text)",
            "③ n ← strlen(cipher_text)",
            "④ for (i = 0; i < n; i++)",
            "     printf(\"%c\", cipher_text[i] − 3)",
            "⑤ printf(\"\\n\")",
            "⑥ 끝",
        ],
        pseudocode: [
            "scanf(\"%s\", cipher_text)",
            "n ← strlen(cipher_text)",
            "",
            "for (i = 0; i < n; i++)",
            "  printf(\"%c\", cipher_text[i] - 3)",
            "",
            "printf(\"\\n\")",
        ],
    },

    s4: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        code: [
            "#include <stdio.h>",
            "#include <string.h>",
            "",
            "int main() {",
            "    /* 1. 암호문 입력 받기 */",
            "    char cipher_text[1000];",
            "    scanf(\"%s\", cipher_text);",
            "",
            "    /* 2. 각 문자를 ASCII -3으로 해독하여 출력 */",
            "    int n = strlen(cipher_text);",
            "    for (int i = 0; i < n; i++) {",
            "        /* 문자 ASCII 값에서 3을 빼면 3칸 왼쪽 이동 */",
            "        /* 예: 'D'(68) - 3 = 65 = 'A' */",
            "        printf(\"%c\", cipher_text[i] - 3);",
            "    }",
            "    printf(\"\\n\");",
            "",
            "    return 0;",
            "}",
        ],
        explanation: [
            "1~2행: stdio.h (입출력), string.h (strlen) 헤더 포함",
            "",
            "5~7행: char 배열로 암호문 선언 후 scanf로 입력",
            "",
            "10~15행: 반복문으로 각 문자의 ASCII 값에서 3을 빼서 출력",
            "  strlen(cipher_text): 문자열 길이 반환",
            "  cipher_text[i] - 3: ASCII 값 -3 → 3칸 왼쪽 이동",
            "  printf(\"%c\", ...): 정수를 문자(%c)로 출력",
            "",
            "16행: 줄바꿈 출력 (\\n)",
        ],
    },

    s5: {
        programName: "고대의 지혜: 시저 암호 해독하기",
        errors: [
            "A, B, C처럼 ASCII 코드가 65~67인 문자에서 3을 빼면 62~64가 되어 특수문자('>', '?', '@')가 출력된다.",
            "char 배열 크기(1000)보다 긴 문자열 입력 시 버퍼 오버플로우로 미정의 동작(UB) 발생.",
        ],
        improvements: [
            "(cipher_text[i] - 65 - 3 + 26) % 26 + 65 공식을 적용하면 A, B, C도 알파벳 범위 내에서 순환 처리할 수 있다.",
        ],
        testCases: [
            {input: "DEFG", expected: "ABCD", actual: "ABCD", pass: "O"},
            {input: "PYTHON", expected: "MVQELK", actual: "MVQELK", pass: "O"},
            {input: "Z", expected: "W", actual: "W", pass: "O"},
            {input: "ABCD", expected: ">?@A", actual: ">?@A", pass: "O"},
        ],
    },
}, out('c', '3-2-6.docx'));
