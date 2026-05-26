// 복리 계산기 (Project 3-2-15) — C 언어 버전
const {makeDocument} = require('./make_template');

makeDocument({
    s1: {
        programName: "복리 계산기",
        purpose: [
            "월 저축금액과 월 이자율을 입력받아 for 반복문으로 1개월 단위로 24개월 후까지의 복리 잔액을 계산하여 매월 출력한다.",
        ],
        targetUser: "C 언어 for 반복문과 double 자료형을 활용한 실수 누적 연산을 학습하거나 복리 공식을 배열 없이 단일 변수로 구현하는 방법에 관심 있는 누구나",
        features: [
            "① scanf(\"%lf\", ...)로 월 저축금액과 월 이자율을 double로 입력받아 소수점 이자율도 처리한다.",
            "② balance = 0.0으로 누적 잔액을 초기화한다.",
            "③ for (month = 1; month <= 24; month++) 로 1~24개월을 반복한다.",
            "④ balance = (balance + savings) * (1.0 + rate / 100.0) 공식으로 매월 복리 잔액을 갱신하고 %.2f로 출력한다.",
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
            "자료형: double (scanf(\"%lf\", ...)) — float보다 정밀도 높음",
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
            "double 자료형 사용 — float은 정밀도 부족으로 오차 발생 가능",
            "scanf(\"%lf\") — double 입력 시 반드시 %lf 사용 (%f는 float 전용)",
            "balance 초기화는 루프 밖에서 한 번만 수행",
            "printf(\"%.2f\")로 소수점 2자리 고정 출력",
        ],
    },

    s3: {
        programName: "복리 계산기",
        flowchart: [
            "① 시작",
            "② scanf savings (double)",
            "③ scanf rate (double)",
            "④ balance ← 0.0",
            "⑤ for month = 1; month <= 24; month++:",
            "   balance ← (balance + savings) * (1.0 + rate / 100.0)",
            "   printf('%d개월 후 잔액: %.2f 원', month, balance)",
            "⑥ return 0 / 끝",
        ],
        pseudocode: [
            "double savings, rate, balance",
            "scanf savings",
            "scanf rate",
            "",
            "balance ← 0.0",
            "",
            "for month = 1 to 24:",
            "  balance ← (balance + savings) * (1.0 + rate / 100.0)",
            "  printf '%d개월 후 잔액: %.2f 원', month, balance",
        ],
    },

    s4: {
        programName: "복리 계산기",
        code: [
            "#include <stdio.h>",
            "",
            "int main() {",
            "    /* 1. 입력: double로 소수점 이자율도 처리 */",
            "    double savings, rate;",
            "    scanf(\"%lf\", &savings);   /* 월 저축금액 */",
            "    scanf(\"%lf\", &rate);      /* 월 이자율 (%) */",
            "",
            "    /* 2. 누적 잔액 초기화 (루프 밖에서 한 번만) */",
            "    double balance = 0.0;",
            "",
            "    /* 3. 1개월 ~ 24개월 복리 계산 */",
            "    for (int month = 1; month <= 24; month++) {",
            "        balance = (balance + savings) * (1.0 + rate / 100.0);",
            "        printf(\"%d개월 후 잔액: %.2f 원\\n\", month, balance);",
            "    }",
            "",
            "    return 0;",
            "}",
        ],
        explanation: [
            "5~7행: double savings, rate — float 대신 double을 써야 소수점 정밀도가 충분함",
            "  scanf(\"%lf\", ...) — double 입력 시 반드시 %lf 사용 (%f는 float 전용)",
            "",
            "10행: balance = 0.0 — 루프 밖에서 초기화. 루프 안에 두면 매월 0원으로 리셋됨",
            "",
            "13행: for (month = 1; month <= 24; month++) — 1~24까지 정확히 24번 반복",
            "14행: 복리 공식 — (잔액 + 이번달 저축) × (1 + 이율/100)",
            "  1.0 + rate / 100.0 — 상수를 double로 명시하여 정수 나눗셈 오류 방지",
            "15행: %.2f — 소수점 2자리 고정 출력 (예: 101000.00)",
        ],
    },

    s5: {
        programName: "복리 계산기",
        errors: [
            "scanf(\"%f\", &savings)로 double 변수를 읽으면 값이 올바르게 입력되지 않음. double에는 반드시 %lf 사용.",
            "float savings 선언 시 소수점 계산에서 정밀도 오차가 누적됨. double 사용 필수.",
            "balance 초기화를 for 루프 안에 두면 매월 잔액이 0으로 리셋되어 복리 누적 불가.",
        ],
        improvements: [
            "저축 개월 수를 별도 입력받으면 24개월이 아닌 임의 기간에도 대응할 수 있다.",
            "연이율로 입력받으려면 rate / 12.0으로 나눠 월이율로 환산하면 된다.",
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
            {input: "scanf %f 오류 시", expected: "올바른 savings 입력", actual: "쓰레기값 입력 오류", pass: "X"},
        ],
    },
}, "../c/3-2-15.docx");
