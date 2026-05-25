// 자재 자동 라벨링: 철근 자르기 (Project 3-2-4) — C 언어 버전
const {makeDocument} = require('./make_template');

makeDocument({
    s1: {
        programName: "자재 자동 라벨링: 철근 자르기",
        purpose: [
            "전체 길이와 자를 길이를 입력받아 정수 나눗셈으로 자재 수를 계산하고,",
            "F-0001 형식의 식별 번호를 한 줄씩 순서대로 출력한다.",
        ],
        targetUser: "자재 번호를 자동으로 생성하고 싶은 현장 관리자 또는 실습생",
        features: [
            "① 전체 길이(total)와 자를 길이(cut)를 공백으로 구분하여 입력받는다.",
            "② count = total / cut으로 자투리를 제외한 자재 수를 계산한다.",
            "③ for 반복문으로 1부터 count까지 번호를 순서대로 생성한다.",
            "④ printf의 %04d 서식으로 빈 자리를 0으로 채운 4자리 번호를 출력한다.",
        ],
        screenExample: [
            "(입력)  10 3",
            "(출력)  F-0001 / F-0002 / F-0003  (각 번호를 한 줄씩 출력)",
        ],
    },

    s2: {
        programName: "자재 자동 라벨링: 철근 자르기",
        inputDesign: [
            "전체 길이(total)와 자를 길이(cut)를 공백으로 구분하여 한 줄 입력",
            "자료형: int (정수형)",
        ],
        inputExample: ["10 3"],
        outputDesign: [
            "F-0001부터 시작하여 1씩 증가하며 한 줄에 하나씩 출력",
            "4자리 정수 서식(%04d), 빈 자리는 0으로 채움",
        ],
        outputExample: ["F-0001", "F-0002", "F-0003"],
        constraints: [
            "cut=0 입력 시 정수 나눗셈에서 미정의 동작(Division by Zero) 발생",
            "cut > total이면 count=0 → 반복 0회로 아무것도 출력하지 않음 (정상 동작)",
            "count가 9999를 초과하면(예: total=10000, cut=1) F-10000처럼 5자리가 됨",
            "처리 방법: cut==0 → 조건 검사 후 오류 메시지 출력 권장",
        ],
    },

    s3: {
        programName: "자재 자동 라벨링: 철근 자르기",
        flowchart: [
            "① 시작",
            "② total, cut 입력",
            "③ count ← total / cut",
            "④ [count == 0?]",
            "     예  → 출력 없이 끝",
            "     아니오 → 계속",
            "⑤ i ← 1",
            "⑥ [i <= count?]",
            "     아니오 → 끝",
            "     예  → printf(\"F-%04d\\n\", i)",
            "⑦ i ← i + 1,  ⑥으로 이동",
        ],
        pseudocode: [
            "scanf(\"%d %d\", &total, &cut)",
            "count ← total / cut",
            "",
            "for (i = 1; i <= count; i++)",
            "  printf(\"F-%04d\\n\", i)",
        ],
    },

    s4: {
        programName: "자재 자동 라벨링: 철근 자르기",
        code: [
            "#include <stdio.h>",
            "",
            "int main() {",
            "    /* 1. 데이터 입력 (전체 길이, 자를 길이) */",
            "    int total, cut;",
            "    scanf(\"%d %d\", &total, &cut);",
            "",
            "    /* 2. 생성 가능한 자재 개수 계산 (정수 나눗셈 — 나머지 버림) */",
            "    int count = total / cut;",
            "",
            "    /* 3. 반복문을 이용한 번호 생성 및 출력 */",
            "    /*    1부터 count까지 (i <= count) */",
            "    for (int i = 1; i <= count; i++) {",
            "        /* %04d → 4자리 정수, 빈 자리는 0으로 채움 */",
            "        printf(\"F-%04d\\n\", i);",
            "    }",
            "",
            "    return 0;",
            "}",
        ],
        explanation: [
            "1행: #include <stdio.h> — scanf/printf 사용을 위한 헤더 포함",
            "",
            "5~6행: int 타입으로 total, cut 선언 후 scanf로 입력",
            "",
            "9행: 정수 나눗셈(/)으로 자투리를 제외한 자재 수 계산",
            "  count = 10 / 3 = 3  (나머지 1은 버림)",
            "",
            "13~16행: for 반복문으로 1~count 순회",
            "  count=0이면 반복 없음 → 출력 없음",
            "",
            "15행: printf \"%04d\" 서식",
            "  i=1    → 'F-0001'",
            "  i=10   → 'F-0010'",
            "  i=1000 → 'F-1000'",
        ],
    },

    s5: {
        programName: "자재 자동 라벨링: 철근 자르기",
        errors: [
            "for (int i = 1; i < count; i++)로 쓰면 마지막 번호(count번)가 출력되지 않는다.",
            "반드시 i <= count이어야 F-0001부터 F-XXXX까지 모두 출력된다.",
        ],
        improvements: [
            "cut=0 입력에 대한 방어 처리를 추가하면 Division by Zero 없이 오류 메시지를 출력할 수 있다.",
            "자재 수가 9999를 초과할 경우 %05d로 서식을 변경하거나 자릿수를 동적으로 계산하면 더 완성도 높은 프로그램이 된다.",
        ],
        testCases: [
            {input: "10 3", expected: "F-0001~F-0003", actual: "F-0001~F-0003", pass: "O"},
            {input: "9 3", expected: "F-0001~F-0003", actual: "F-0001~F-0003", pass: "O"},
            {input: "5 6", expected: "(출력 없음)", actual: "(출력 없음)", pass: "O"},
            {input: "1 1", expected: "F-0001", actual: "F-0001", pass: "O"},
        ],
    },
}, "sw_project_3-2-4_c.docx");
