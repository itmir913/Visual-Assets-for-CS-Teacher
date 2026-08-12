// 교집합과 합집합 계산기 (Project 3-2-14) — Python 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "교집합과 합집합 계산기",
        purpose: [
            "두 집합의 원소를 입력받아 교집합(공통 원소)과 합집합(전체 원소)을 오름차순으로 정렬하여 출력한다. 교집합이 공집합이면 0을 출력한다.",
        ],
        targetUser: "집합(set) 자료구조와 집합 연산자(&, |)를 학습하거나 sorted()·print() 언패킹에 관심 있는 누구나",
        features: [
            "① 두 줄로 각각 공백 구분 정수를 입력받아 set으로 변환한다.",
            "② & 연산자로 교집합을 구하고, sorted()로 오름차순 정렬하여 출력한다.",
            "③ 교집합이 빈 리스트(공집합)이면 0을 출력한다.",
            "④ | 연산자로 합집합을 구하고, sorted()로 오름차순 정렬하여 print(*result)로 출력한다.",
        ],
        screenExample: [
            "(입력)  1 2 3 4",
            "        3 4 5 6",
            "(출력)  3 4       (교집합)",
            "        1 2 3 4 5 6  (합집합)",
        ],
    },

    s2: {
        programName: "교집합과 합집합 계산기",
        inputDesign: [
            "1행: 집합 A의 원소들 (공백 구분 정수, 한 줄 입력)",
            "2행: 집합 B의 원소들 (공백 구분 정수, 한 줄 입력)",
            "자료형: int (set(map(int, input().split())))",
        ],
        inputExample: ["1 2 3 4", "3 4 5 6"],
        outputDesign: [
            "1행: 교집합 원소를 오름차순으로 공백 구분 출력 (공집합이면 0)",
            "2행: 합집합 원소를 오름차순으로 공백 구분 출력",
        ],
        outputExample: ["3 4", "1 2 3 4 5 6"],
        constraints: [
            "set은 순서가 없으므로 반드시 sorted()로 정렬 후 출력",
            "print(*result)로 대괄호 없이 공백 구분 출력",
            "교집합 공집합 처리: if not inter → print(0)",
        ],
    },

    s3: {
        programName: "교집합과 합집합 계산기",
        flowchart: [
            "① 시작",
            "② set_a ← set(map(int, input().split()))",
            "③ set_b ← set(map(int, input().split()))",
            "④ inter ← sorted(set_a & set_b)",
            "⑤ if not inter: 출력(0)",
            "   else: 출력(*inter)",
            "⑥ uni ← sorted(set_a | set_b)",
            "⑦ 출력(*uni)",
            "⑧ 끝",
        ],
        pseudocode: [
            "set_a ← set(map(int, input().split()))",
            "set_b ← set(map(int, input().split()))",
            "",
            "inter ← sorted(set_a & set_b)",
            "if not inter:",
            "  출력(0)           # 공집합",
            "else:",
            "  출력(*inter)      # 공백 구분 출력",
            "",
            "uni ← sorted(set_a | set_b)",
            "출력(*uni)",
        ],
    },

    s4: {
        programName: "교집합과 합집합 계산기",
        code: [
            "# 1. 두 집합 입력 (공백 구분 정수, 한 줄씩)",
            "set_a = set(map(int, input().split()))",
            "set_b = set(map(int, input().split()))",
            "",
            "# 2. 교집합 연산 및 오름차순 정렬",
            "#    sorted()는 set 직접 수용 → list() 변환 불필요",
            "inter = sorted(set_a & set_b)",
            "if not inter:  # 공집합: not [] == True",
            "    print(0)   # 문제 조건: 공집합이면 0 출력",
            "else:",
            "    print(*inter)  # *언패킹: [3,4] → '3 4' (공백 구분)",
            "",
            "# 3. 합집합 연산 및 오름차순 정렬",
            "uni = sorted(set_a | set_b)",
            "print(*uni)  # 합집합은 항상 원소 있음",
        ],
        explanation: [
            "2~3행: set(map(int, input().split()))으로 입력을 정수 집합으로 변환",
            "  중복 원소가 있어도 set이 자동 제거",
            "",
            "7행: set_a & set_b — 두 집합의 교집합 (공통 원소만)",
            "  sorted()가 set을 직접 받아 오름차순 리스트 반환",
            "",
            "8~10행: if not inter → 빈 리스트이면 True → 0 출력",
            "  else: print(*inter) — 리스트를 언패킹하여 공백 구분 출력",
            "",
            "14행: set_a | set_b — 두 집합의 합집합 (중복 자동 제거)",
            "15행: print(*uni) — 대괄호 없이 공백 구분 출력",
        ],
    },

    s5: {
        programName: "교집합과 합집합 계산기",
        errors: [
            "sorted() 없이 set 결과를 직접 출력하면 순서가 보장되지 않아 채점 오류 발생. 반드시 sorted() 사용.",
            "print(result)로 출력하면 '[3, 4]'처럼 대괄호가 포함된다. print(*result)로 언패킹 출력 필요.",
        ],
        improvements: [
            "sorted(list(set_a & set_b))의 list() 변환은 불필요하다. sorted()는 모든 iterable을 직접 받는다.",
            "intersection(), union() 메서드를 사용하면 연산자 기호 없이 가독성 높게 표현할 수 있다.",
        ],
        testCases: [
            {input: "1 2 3 4 / 3 4 5 6", expected: "3 4 / 1 2 3 4 5 6", actual: "3 4 / 1 2 3 4 5 6", pass: "O"},
            {input: "1 2 3 / 4 5 6 (공집합)", expected: "0 / 1 2 3 4 5 6", actual: "0 / 1 2 3 4 5 6", pass: "O"},
            {input: "1 2 3 4 5 / 2 4 (부분집합)", expected: "2 4 / 1 2 3 4 5", actual: "2 4 / 1 2 3 4 5", pass: "O"},
            {input: "1 1 2 3 / 2 2 4 (중복 입력)", expected: "2 / 1 2 3 4", actual: "2 / 1 2 3 4", pass: "O"},
        ],
    },
}, out('실습', '교집합과-합집합.py.docx'));
