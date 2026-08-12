// 비만도 측정 프로그램 (Project 3-2-1) 완성 예시
const {makeDocument} = require('../make_sw_template');
const out = require('../../outpath');

makeDocument({
    s1: {
        programName: "비만도 측정 프로그램",
        purpose: [
            "키와 몸무게를 입력받아 표준 몸무게를 기준으로 비만도(%)를 계산하고,",
            "정상·과체중·비만 여부를 판정하여 출력한다.",
        ],
        targetUser: "자신의 비만도를 간단히 확인하고 싶은 누구나",
        features: [
            "① 키(cm)와 몸무게(kg)를 공백으로 구분하여 한 줄로 입력받는다.",
            "② 키 구간(150 미만 / 150~160 미만 / 160 이상)에 따라 표준 몸무게(sw)를 계산한다.",
            "③ 비만도(%) = (실제 몸무게 − 표준 몸무게) × 100 ÷ 표준 몸무게 수식을 적용한다.",
            "④ 비만도에 따라 '정상', '과체중', '비만' 중 하나를 출력한다.",
        ],
        screenExample: [
            "(입력)  170 80",
            "(출력)  비만",
        ],
    },

    s2: {
        programName: "비만도 측정 프로그램",
        inputDesign: [
            "키(cm)와 몸무게(kg)를 공백으로 구분하여 한 줄로 입력",
            "자료형: float (소수점 허용)",
        ],
        inputExample: ["170 80"],
        outputDesign: [
            "비만도 판정 결과를 문자열로 한 줄 출력",
            "('정상', '과체중', '비만' 중 하나)",
        ],
        outputExample: ["비만"],
        constraints: [
            "숫자가 아닌 문자(예: '일칠공')를 입력하면 ValueError 발생",
            "음수 키·몸무게 입력 시 표준 몸무게 계산 결과가 비정상이 될 수 있음",
            "처리 방법: try-except로 감싸 '잘못된 입력입니다.' 출력 후 재입력 요청",
        ],
    },

    s3: {
        programName: "비만도 측정 프로그램",
        flowchart: [
            "① 시작",
            "② height, weight 입력",
            "③ [키 구간 판정]",
            "   height < 150",
            "     → sw = height − 100",
            "   150 ≤ height < 160",
            "     → sw = (height−150)/2 + 50",
            "   height ≥ 160",
            "     → sw = (height−100) × 0.9",
            "④ obesity = (weight−sw)×100/sw",
            "⑤ [비만도 판정]",
            "   obesity ≤ 10   →  '정상' 출력",
            "   obesity ≤ 20   →  '과체중' 출력",
            "   그 외            →  '비만' 출력",
            "⑥ 끝",
        ],
        pseudocode: [
            "height, weight ← 입력()",
            "",
            "if height < 150:",
            "  sw ← height − 100",
            "else if height < 160:",
            "  sw ← (height−150)/2 + 50",
            "else:",
            "  sw ← (height−100) × 0.9",
            "",
            "obesity ← (weight−sw)×100/sw",
            "",
            "if obesity ≤ 10:",
            "  출력('정상')",
            "else if obesity ≤ 20:",
            "  출력('과체중')",
            "else:",
            "  출력('비만')",
        ],
    },

    s4: {
        programName: "비만도 측정 프로그램",
        code: [
            "# 1. 입력 받기 (실수형으로 변환)",
            "height, weight = map(float, input().split())",
            "",
            "# 2. 표준 몸무게(sw) 계산",
            "if height < 150:",
            "    sw = height - 100",
            "elif height < 160:",
            "    sw = (height - 150) / 2 + 50",
            "else:",
            "    sw = (height - 100) * 0.9",
            "",
            "# 3. 비만도 계산",
            "obesity = (weight - sw) * 100 / sw",
            "",
            "# 4. 결과 판정 및 출력",
            "if obesity <= 10:",
            "    print('정상')",
            "elif obesity <= 20:",
            "    print('과체중')",
            "else:",
            "    print('비만')",
        ],
        explanation: [
            "1행: map(float, input().split())으로",
            "  키·몸무게를 실수형으로 동시에 변환",
            "",
            "4~9행: 키 구간별 표준 몸무게 공식",
            "  H < 150    →  sw = H − 100",
            "  150~160    →  sw = (H−150)/2+50",
            "  H ≥ 160    →  sw = (H−100)×0.9",
            "",
            "12행: 비만도(%) 계산",
            "  (실제 − 표준) × 100 ÷ 표준",
            "",
            "15~19행: 비만도 범위로 판정·출력",
            "  ≤ 10  →  '정상'",
            "  ≤ 20  →  '과체중'",
            "  초과  →  '비만'",
        ],
    },

    s5: {
        programName: "비만도 측정 프로그램",
        errors: [
            "obesity <= 10 조건으로 인해 음수 비만도(저체중)도 '정상'으로 출력될 수 있다.",
        ],
        improvements: [
            "저체중 분기 추가: if obesity < 0: print('저체중')을 최상단에 삽입하면 4가지 판정이 가능하다.",
        ],
        testCases: [
            {input: "170 80", expected: "비만", actual: "비만", pass: "O"},
            {input: "170 69", expected: "정상", actual: "정상", pass: "O"},
            {input: "170 70", expected: "과체중", actual: "과체중", pass: "O"},
            {input: "140 40", expected: "정상", actual: "정상", pass: "O"},
        ],
    },
}, out('실습', '비만도-측정.py.docx'));
