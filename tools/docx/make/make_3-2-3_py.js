// 이달은 며칠까지 있을까? (Project 3-2-3)
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "이달은 며칠까지 있을까?",
        purpose: [
            "연도와 월을 입력받아 해당 월의 마지막 날짜를 출력한다.",
            "리스트로 월별 말일을 관리하고, 윤년 판별 조건으로 2월 말일을 결정한다.",
        ],
        targetUser: "특정 연도의 특정 달이 며칠까지 있는지 확인하고 싶은 누구나",
        features: [
            "① 연도(year)와 월(month)을 공백으로 구분하여 한 줄로 입력받는다.",
            "② 12개월 말일을 리스트에 저장하고, month−1 인덱스로 해당 월에 접근한다.",
            "③ (year%400==0) or (year%4==0 and year%100!=0) 조건으로 윤년을 판별한다.",
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
            "month=0 입력 시 days[-1]=31(12월 값)이 반환되어 오답 처리",
            "month=13 이상 입력 시 IndexError: list index out of range 발생",
            "처리 방법: if 1 <= month <= 12 조건으로 유효성 검사 추가 권장",
        ],
    },

    s3: {
        programName: "이달은 며칠까지 있을까?",
        flowchart: [
            "① 시작",
            "② year, month 입력",
            "③ days ← [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]",
            "④ [(year%400==0) or (year%4==0 and year%100!=0)?]",
            "     예  → days[1] ← 29",
            "     아니오 → 건너뜀",
            "⑤ print(days[month − 1])",
            "⑥ 끝",
        ],
        pseudocode: [
            "year, month ← 입력()",
            "days ← [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]",
            "",
            "if (year % 400 == 0) or (year % 4 == 0 and year % 100 != 0):",
            "  days[1] ← 29",
            "",
            "출력(days[month − 1])",
        ],
    },

    s4: {
        programName: "이달은 며칠까지 있을까?",
        code: [
            "# 1. 입력 받기 (연도와 월)",
            "year, month = map(int, input().split())",
            "",
            "# 2. 각 달의 마지막 날 리스트 (1월=인덱스0 ~ 12월=인덱스11)",
            "days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]",
            "",
            "# 3. 윤년인 경우 2월(인덱스 1)의 날짜를 29로 수정",
            "if (year % 400 == 0) or (year % 4 == 0 and year % 100 != 0):",
            "    days[1] = 29",
            "",
            "# 4. 결과 출력 (month-1 = 리스트 인덱스)",
            "#    예: month=2 → days[1] (2월의 마지막 날)",
            "print(days[month - 1])",
        ],
        explanation: [
            "1행: map(int, ...)으로 연도와 월을 정수로 동시에 변환",
            "",
            "4행: 1월(인덱스 0) ~ 12월(인덱스 11) 말일 리스트",
            "  사용자 입력 month에서 1을 빼면 리스트 인덱스가 됨",
            "",
            "7행: 윤년 판별 조건 (괄호 필수 — and가 or보다 먼저 계산됨)",
            "  400의 배수이거나, 4의 배수이면서 100의 배수가 아닌 경우",
            "",
            "8행: 윤년이면 days[1](2월)을 29로 덮어씀",
            "  반드시 print 이전에 실행해야 함",
            "",
            "12행: days[month-1]로 해당 월 말일 출력",
        ],
    },

    s5: {
        programName: "이달은 며칠까지 있을까?",
        errors: [
            "days[1] = 29를 print() 이후에 작성하면 이미 28이 출력되어 윤년 판정이 반영되지 않는다.",
            "days[month]로 쓰면 1월이 인덱스 1(= 2월 값 28)이 되어 모든 달이 한 칸씩 밀린다.",
        ],
        improvements: [
            "if 1 <= month <= 12 조건을 추가하면 month=0이나 month=13 같은 비정상 입력을 방어할 수 있다.",
        ],
        testCases: [
            {input: "2024 2", expected: "29", actual: "29", pass: "O"},
            {input: "2023 2", expected: "28", actual: "28", pass: "O"},
            {input: "2000 2", expected: "29", actual: "29", pass: "O"},
            {input: "2100 2", expected: "28", actual: "28", pass: "O"},
        ],
    },
}, out('실습', '이달은-며칠까지-있을까.py.docx'));
