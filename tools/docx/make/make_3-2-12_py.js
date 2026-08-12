// 순위 데이터 정렬: 3등 찾기 (Project 3-2-12) — Python 버전
const {makeDocument} = require('./make_sw_template');
const out = require('../outpath');

makeDocument({
    s1: {
        programName: "순위 데이터 정렬: 3등 찾기",
        purpose: [
            "n명의 이름과 점수를 입력받아 점수 기준 내림차순으로 정렬한 뒤, 3번째로 높은 점수를 가진 학생의 이름을 출력한다.",
        ],
        targetUser: "2차원 리스트 정렬과 lambda 식을 학습하거나 sort() 활용에 관심 있는 누구나",
        features: [
            "① 인원 수 n을 입력받은 뒤 n줄에 걸쳐 이름과 점수를 입력받아 2차원 리스트로 저장한다.",
            "② 점수(인덱스 1)를 기준으로 lambda와 sort()를 사용해 내림차순 정렬한다.",
            "③ 정렬 후 인덱스 2(3등)의 이름(인덱스 0)을 출력한다.",
            "④ 점수를 반드시 int()로 변환해야 사전순이 아닌 수치 비교가 이루어진다.",
        ],
        screenExample: [
            "(입력)  4",
            "        김철수 98",
            "        이민수 95",
            "        박영희 92",
            "        최지훈 88",
            "(출력)  박영희",
        ],
    },

    s2: {
        programName: "순위 데이터 정렬: 3등 찾기",
        inputDesign: [
            "1행: 정수 n (학생 수)",
            "2행~n+1행: '이름 점수' 형식으로 n줄 입력 (공백 구분)",
            "자료형: 이름 str, 점수 int (반드시 int() 변환 필요)",
        ],
        inputExample: ["4", "김철수 98", "이민수 95", "박영희 92", "최지훈 88"],
        outputDesign: [
            "점수 기준 내림차순 정렬 후 인덱스 2 위치(3등)의 이름 출력",
        ],
        outputExample: ["박영희"],
        constraints: [
            "n ≥ 3 보장 (n < 3이면 students[2] 접근 시 IndexError 발생)",
            "점수를 int()로 변환하지 않으면 '9' > '10' 처럼 사전순 비교 오류 발생",
        ],
    },

    s3: {
        programName: "순위 데이터 정렬: 3등 찾기",
        flowchart: [
            "① 시작",
            "② n ← int(input())",
            "③ students ← []",
            "④ for _ in range(n):",
            "     name, score ← input().split()",
            "     students.append([name, int(score)])",
            "⑤ students.sort(key=lambda x: x[1], reverse=True)",
            "⑥ 출력(students[2][0])",
            "⑦ 끝",
        ],
        pseudocode: [
            "n ← int(input())",
            "students ← []",
            "",
            "for _ in range(n):",
            "  name, score ← input().split()",
            "  students.append([name, int(score)])",
            "",
            "students.sort(key=lambda x: x[1], reverse=True)",
            "",
            "출력(students[2][0])",
        ],
    },

    s4: {
        programName: "순위 데이터 정렬: 3등 찾기",
        code: [
            "# 1. n명의 정보 입력 받기",
            "n = int(input())",
            "students = []",
            "",
            "for _ in range(n):",
            "    name, score = input().split()",
            "    students.append([name, int(score)])",
            "    # int(score) 필수 — 문자열로 받으면 '9' > '10' 처럼 잘못 비교됨",
            "",
            "# 2. 점수(index 1) 기준 내림차순 정렬",
            "students.sort(key=lambda x: x[1], reverse=True)",
            "# key=lambda x: x[1] → 각 원소의 두 번째 값(점수)을 기준으로",
            "# reverse=True → 내림차순 (높은 점수가 앞으로)",
            "",
            "# 3. 3등(index 2) 학생의 이름 출력",
            "# 정렬 후: [0]=1등, [1]=2등, [2]=3등",
            "print(students[2][0])",
        ],
        explanation: [
            "2행: 인원 수 n을 정수로 입력받음",
            "",
            "5~7행: n줄 반복하며 이름과 점수를 공백으로 분리",
            "  int(score): 점수를 정수로 변환 (필수 — 문자열이면 수치 비교 불가)",
            "  students.append([name, int(score)]): 2차원 리스트에 추가",
            "",
            "11행: sort(key=lambda x: x[1], reverse=True)로 점수 기준 내림차순 정렬",
            "  lambda x: x[1]: 각 원소 x에서 점수([1])를 정렬 기준으로 추출",
            "  reverse=True: 높은 점수가 앞(인덱스 0)에 오도록 내림차순",
            "",
            "17행: students[2][0] — 인덱스 2 = 3등, [0] = 이름",
        ],
    },

    s5: {
        programName: "순위 데이터 정렬: 3등 찾기",
        errors: [
            "int(score) 없이 문자열로 저장하면 '9' > '88' > '100' 처럼 사전순 비교가 발생해 잘못된 순위가 출력된다.",
            "n < 3 입력 시 students[2] 접근에서 IndexError: list index out of range 발생. 문제 조건에서 n ≥ 3 보장 여부를 확인.",
        ],
        improvements: [
            "sorted(students, key=lambda x: x[1], reverse=True)를 사용하면 원본 리스트를 보존하면서 새 정렬 리스트를 얻을 수 있다.",
            "3등 대신 k등을 찾는 경우 students[k-1][0]으로 일반화할 수 있다.",
        ],
        testCases: [
            {input: "4명: 98,95,92,88", expected: "박영희 (92점, 3등)", actual: "박영희", pass: "O"},
            {input: "3명: 100,75,50", expected: "B (50점, 3등)", actual: "B", pass: "O"},
            {input: "점수 문자열 저장 시", expected: "정렬 오류 발생", actual: "잘못된 이름 출력", pass: "X"},
            {input: "정렬 후 students[2][0]", expected: "3등 이름", actual: "정상 출력", pass: "O"},
        ],
    },
}, out('실습', '3등-찾기.py.docx'));
