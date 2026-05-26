// 이달은 며칠까지 있을까? (Project 3-2-3) — C 언어 버전
const {makeDocument} = require('./make_template');

makeDocument({
    s1: {
        programName: "이달은 며칠까지 있을까?",
        purpose: [
            "연도와 월을 입력받아 해당 월의 마지막 날짜를 출력한다.",
            "int 배열로 월별 말일을 관리하고, 윤년 판별 조건으로 2월 말일을 결정한다.",
        ],
        targetUser: "특정 연도의 특정 달이 며칠까지 있는지 확인하고 싶은 누구나",
        features: [
            "① 연도(year)와 월(month)을 공백으로 구분하여 한 줄로 입력받는다.",
            "② 12개월 말일을 int 배열에 저장하고, month−1 인덱스로 해당 월에 접근한다.",
            "③ (year%400==0) || (year%4==0 && year%100!=0) 조건으로 윤년을 판별한다.",
            "④ 윤년이면 2월(인덱스 1)의 값을 29로 수정한 뒤 결과를 출력한다.",
        ],
        screenExample: [
            "(입력)  2024 2",
            "(출력)  29",
        ],
    },

    s2: {
        programName: "이달은 며칠까지 있을까?",
        inputDesign: [
            "연도(year)와 월(month)을 공백으로 구분하여 한 줄 입력",
            "자료형: int (정수형)",
        ],
        inputExample: ["2024 2"],
        outputDesign: [
            "해당 월의 마지막 날짜(정수)를 한 줄 출력",
        ],
        outputExample: ["29"],
        constraints: [
            "month=0 입력 시 days[-1]에 해당하는 배열 경계 밖 접근 → 미정의 동작(UB)",
            "month=13 이상 입력 시 배열 경계 밖 접근 → 미정의 동작(UB)",
            "처리 방법: if (month >= 1 && month <= 12) 조건으로 유효성 검사 추가 권장",
        ],
    },

    s3: {
        programName: "이달은 며칠까지 있을까?",
        flowchart: [
            "① 시작",
            "② year, month 입력",
            "③ days[] ← {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}",
            "④ [(year%400==0) || (year%4==0 && year%100!=0)?]",
            "     예  → days[1] ← 29",
            "     아니오 → 건너뜀",
            "⑤ printf(\"%d\\n\", days[month − 1])",
            "⑥ 끝",
        ],
        pseudocode: [
            "scanf(\"%d %d\", &year, &month)",
            "int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31}",
            "",
            "if ((year % 400 == 0) || (year % 4 == 0 && year % 100 != 0))",
            "  days[1] ← 29",
            "",
            "printf(\"%d\\n\", days[month − 1])",
        ],
    },

    s4: {
        programName: "이달은 며칠까지 있을까?",
        code: [
            "#include <stdio.h>",
            "",
            "int main() {",
            "    /* 1. 입력 받기 (연도와 월) */",
            "    int year, month;",
            "    scanf(\"%d %d\", &year, &month);",
            "",
            "    /* 2. 각 달의 마지막 날 배열 (인덱스 0=1월 ~ 11=12월) */",
            "    int days[] = {31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31};",
            "",
            "    /* 3. 윤년인 경우 2월(인덱스 1)의 날짜를 29로 수정 */",
            "    if ((year % 400 == 0) || (year % 4 == 0 && year % 100 != 0))",
            "        days[1] = 29;",
            "",
            "    /* 4. 결과 출력 (month-1 = 배열 인덱스) */",
            "    printf(\"%d\\n\", days[month - 1]);",
            "",
            "    return 0;",
            "}",
        ],
        explanation: [
            "1행: #include <stdio.h> — scanf/printf 사용을 위한 헤더 포함",
            "",
            "5~6행: int 타입으로 year, month 선언 후 scanf로 입력",
            "  %d 서식으로 정수 입력",
            "",
            "9행: int 배열로 12개월 말일 초기화 (인덱스 0=1월 ~ 11=12월)",
            "  사용자 입력 month에서 1을 빼면 배열 인덱스가 됨",
            "",
            "12행: 윤년 판별 조건 (C에서는 || 와 && 사용)",
            "  400의 배수이거나, 4의 배수이면서 100의 배수가 아닌 경우",
            "",
            "13행: 윤년이면 days[1](2월)을 29로 덮어씀",
            "  반드시 printf 이전에 실행해야 함",
            "",
            "16행: days[month-1]로 해당 월 말일 출력 (%d 서식)",
        ],
    },

    s5: {
        programName: "이달은 며칠까지 있을까?",
        errors: [
            "C에서 배열 범위를 벗어난 접근(days[-1] 등)은 Python의 IndexError와 달리 런타임에 감지되지 않고 미정의 동작이 된다.",
            "days[month]로 쓰면 1월이 인덱스 1(= 2월 값 28)이 되어 모든 달이 한 칸씩 밀린다.",
        ],
        improvements: [
            "if (month >= 1 && month <= 12) 조건을 추가하면 비정상 입력에 대한 명시적 오류 처리가 가능하다.",
        ],
        testCases: [
            {input: "2024 2", expected: "29", actual: "29", pass: "O"},
            {input: "2023 2", expected: "28", actual: "28", pass: "O"},
            {input: "2000 2", expected: "29", actual: "29", pass: "O"},
            {input: "2100 2", expected: "28", actual: "28", pass: "O"},
        ],
    },
}, "../c/3-2-3.docx");
