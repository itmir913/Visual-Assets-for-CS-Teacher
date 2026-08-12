// 복리 계산기 (Project 3-2-15) — Python 버전
const {makeDocument} = require('../make_sw_template');
const out = require('../../outpath');

makeDocument({
    s1: {
        programName: "복리 계산기",
        purpose: [
            "월 저축금액과 월 이자율을 입력받아 for 반복문으로 1개월 단위로 24개월 후까지의 복리 잔액을 계산하여 매월 출력한다.",
        ],
        targetUser: "for 반복문과 누적 변수(balance)를 활용한 반복 연산을 학습하거나, 복리 공식을 코드로 직접 구현하는 방법에 관심 있는 누구나",
        features: [
            "① float()로 월 저축금액과 월 이자율을 입력받아 소수점 이자율(예: 1.5%)도 처리한다.",
            "② balance = 0.0으로 누적 잔액을 초기화한다.",
            "③ range(1, 25)로 month가 1~24를 순서대로 가지도록 반복한다.",
            "④ balance = (balance + savings) * (1 + rate/100) 공식으로 매월 복리 잔액을 갱신하고 f-string :.2f로 출력한다.",
        ],
        screenExample: [
            "(입력)  100000",
            "        1.0",
            "(출력)  1개월 후 잔액: 101000.00 원",
            "        2개월 후 잔액: 203010.00 원",
            "        3개월 후 잔액: 306040.10 원",
            "        ...",
            "        24개월 후 잔액: 2724319.95 원",
        ],
    },

    s2: {
        programName: "복리 계산기",
        inputDesign: [
            "1행: 월 저축금액 (원, 소수점 가능)",
            "2행: 월 이자율 (%, 소수점 가능)",
            "자료형: float (float(input())) — 1.5% 같은 소수점 이율 지원",
        ],
        inputExample: ["100000", "1.0"],
        outputDesign: [
            "총 24줄 출력",
            "형식: 'N개월 후 잔액: X.XX 원' (소수점 2자리 고정)",
        ],
        outputExample: [
            "1개월 후 잔액: 101000.00 원",
            "2개월 후 잔액: 203010.00 원",
            "...",
            "24개월 후 잔액: 2724319.95 원",
        ],
        constraints: [
            "range(1, 25) 사용 — month 변수가 1~24를 직접 나타내어 출력 번호와 일치",
            "balance 초기화는 루프 밖에서 한 번만 수행 (루프 안에 두면 매월 리셋됨)",
            "f-string :.2f 포맷으로 소수점 2자리 고정 출력",
        ],
    },

    s3: {
        programName: "복리 계산기",
        flowchart: [
            "① 시작",
            "② savings ← float(input())  # 월 저축금액",
            "③ rate ← float(input())     # 월 이자율(%)",
            "④ balance ← 0.0",
            "⑤ for month in range(1, 25):",
            "   balance ← (balance + savings) * (1 + rate / 100)",
            "   출력(f'{month}개월 후 잔액: {balance:.2f} 원')",
            "⑥ 끝",
        ],
        pseudocode: [
            "savings ← float(input())",
            "rate    ← float(input())",
            "",
            "balance ← 0.0",
            "",
            "for month in range(1, 25):",
            "  balance ← (balance + savings) * (1 + rate / 100)",
            "  출력(f'{month}개월 후 잔액: {balance:.2f} 원')",
        ],
    },

    s4: {
        programName: "복리 계산기",
        code: [
            "# 1. 입력: 소수점도 받을 수 있도록 float() 사용",
            "savings = float(input())   # 월 저축금액 (원)",
            "rate    = float(input())   # 월 이자율 (%)",
            "",
            "# 2. 누적 잔액 초기화 (루프 밖에서 한 번만)",
            "balance = 0.0",
            "",
            "# 3. 1개월 ~ 24개월 복리 계산",
            "for month in range(1, 25):          # month: 1, 2, ..., 24",
            "    balance = (balance + savings) * (1 + rate / 100)",
            "    print(f\"{month}개월 후 잔액: {balance:.2f} 원\")",
        ],
        explanation: [
            "2~3행: float(input()) — int() 대신 float()를 써야 1.5% 같은 소수점 이자율도 입력 가능",
            "",
            "6행: balance = 0.0 — 루프 밖에서 초기화. 루프 안에 두면 매월 0원으로 리셋됨",
            "",
            "9행: range(1, 25) — month가 1~24를 순서대로 가져 출력 번호와 별도 조정 없이 일치",
            "10행: 복리 공식 — (잔액 + 이번달 저축) × (1 + 이율/100)",
            "  이자가 누적 잔액 전체에 붙으므로 시간이 지날수록 이자 금액이 증가",
            "11행: :.2f — 소수점 2자리 고정 출력 (예: 101000.00)",
        ],
    },

    s5: {
        programName: "복리 계산기",
        errors: [
            "int(input())으로 이자율을 읽으면 1.5 입력 시 ValueError 발생. 소수점 이자율 처리를 위해 반드시 float() 사용.",
            "balance = 0.0 초기화를 for 루프 안에 두면 매월 잔액이 0으로 리셋되어 복리 누적이 일어나지 않음.",
        ],
        improvements: [
            "저축 기간을 별도 입력으로 받으면 24개월이 아닌 임의 개월 수에도 대응할 수 있다.",
            "연이율로 입력받으려면 rate / 12로 나눠 월이율로 환산하면 된다.",
        ],
        testCases: [
            {
                input: "100000 / 1.0",
                expected: "1개월: 101000.00 / 24개월: 2724319.95",
                actual: "1개월: 101000.00 / 24개월: 2724319.95",
                pass: "O"
            },
            {
                input: "200000 / 0.5",
                expected: "1개월: 201000.00 / 2개월: 403005.00",
                actual: "1개월: 201000.00 / 2개월: 403005.00",
                pass: "O"
            },
            {input: "50000 / 0.0 (이자 없음)", expected: "24개월: 1200000.00", actual: "24개월: 1200000.00", pass: "O"},
            {input: "balance 초기화 루프 안 실수", expected: "복리 누적 잔액", actual: "매월 0원 리셋 오류", pass: "X"},
        ],
    },
}, out('실습', '복리-계산기.py.docx'));
