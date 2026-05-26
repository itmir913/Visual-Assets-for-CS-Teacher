// 순위 데이터 정렬: 3등 찾기 (Project 3-2-12) — C 언어 버전
const {makeDocument} = require('./make_template');

makeDocument({
    s1: {
        programName: "순위 데이터 정렬: 3등 찾기",
        purpose: [
            "n명의 이름과 점수를 입력받아 점수 기준 내림차순으로 정렬한 뒤, 3번째로 높은 점수를 가진 학생의 이름을 출력한다.",
        ],
        targetUser: "구조체와 qsort를 학습하거나 다차원 데이터 정렬에 관심 있는 누구나",
        features: [
            "① 구조체(struct)로 이름과 점수를 하나의 묶음으로 관리한다.",
            "② n줄에 걸쳐 이름과 점수를 scanf로 입력받아 구조체 배열에 저장한다.",
            "③ qsort와 비교 함수(compare)로 점수 기준 내림차순 정렬한다.",
            "④ 정렬 후 인덱스 2(3등)의 이름을 출력한다.",
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
            "자료형: 이름 char[], 점수 int (scanf(\"%s %d\", name, &score))",
        ],
        inputExample: ["4", "김철수 98", "이민수 95", "박영희 92", "최지훈 88"],
        outputDesign: [
            "점수 기준 내림차순 정렬 후 인덱스 2 위치(3등)의 이름 출력",
        ],
        outputExample: ["박영희"],
        constraints: [
            "n ≥ 3 보장 (n < 3이면 students[2] 접근이 정의되지 않은 동작)",
            "qsort의 비교 함수는 내림차순을 위해 b의 점수 - a의 점수 반환",
        ],
    },

    s3: {
        programName: "순위 데이터 정렬: 3등 찾기",
        flowchart: [
            "① 시작",
            "② scanf n",
            "③ for (i=0; i<n; i++) scanf students[i].name, students[i].score",
            "④ qsort(students, n, sizeof(Student), compare)",
            "   compare: b.score - a.score (내림차순)",
            "⑤ printf students[2].name",
            "⑥ 끝",
        ],
        pseudocode: [
            "struct Student { char name[50]; int score; }",
            "",
            "int compare(a, b): return b.score - a.score",
            "",
            "scanf n",
            "for (i=0; i<n; i++):",
            "  scanf students[i].name, students[i].score",
            "",
            "qsort(students, n, sizeof(Student), compare)",
            "",
            "printf students[2].name",
        ],
    },

    s4: {
        programName: "순위 데이터 정렬: 3등 찾기",
        code: [
            "#include <stdio.h>",
            "#include <stdlib.h>  /* qsort */",
            "",
            "typedef struct {",
            "    char name[50];",
            "    int score;",
            "} Student;",
            "",
            "/* 점수 기준 내림차순 비교 함수 */",
            "int compare(const void *a, const void *b) {",
            "    return ((Student*)b)->score - ((Student*)a)->score;",
            "}",
            "",
            "int main() {",
            "    int n;",
            "    scanf(\"%d\", &n);",
            "",
            "    Student students[n];",
            "    for (int i = 0; i < n; i++)",
            "        scanf(\"%s %d\", students[i].name, &students[i].score);",
            "",
            "    /* 점수 기준 내림차순 정렬 */",
            "    qsort(students, n, sizeof(Student), compare);",
            "",
            "    /* 3등(index 2)의 이름 출력 */",
            "    printf(\"%s\\n\", students[2].name);",
            "",
            "    return 0;",
            "}",
        ],
        explanation: [
            "4~7행: Student 구조체 정의 — name(문자열 50자)과 score(정수)를 묶음으로 관리",
            "",
            "10~12행: compare 함수 — qsort에 전달할 비교 함수",
            "  b.score - a.score: 양수이면 a가 b보다 뒤로 → 내림차순 정렬",
            "  (Student*) 캐스트: void 포인터를 Student 포인터로 변환",
            "",
            "16행: n을 scanf로 입력받음",
            "18~19행: n명의 이름과 점수를 구조체 배열에 입력받음",
            "  \"%s %d\": 이름(공백 전까지)과 정수를 각각 읽음",
            "",
            "22행: qsort로 n개의 Student를 compare 기준으로 정렬",
            "25행: students[2].name — 인덱스 2 = 3등의 이름 출력",
        ],
    },

    s5: {
        programName: "순위 데이터 정렬: 3등 찾기",
        errors: [
            "compare 함수에서 a.score - b.score로 작성하면 오름차순이 되어 가장 낮은 점수가 앞에 온다. 내림차순은 반드시 b - a.",
            "n < 3 입력 시 students[2] 접근이 배열 범위를 벗어나 정의되지 않은 동작(Undefined Behavior) 발생.",
        ],
        improvements: [
            "가변 길이 배열(VLA) Student students[n] 대신 Student students[100] 처럼 충분한 크기로 선언하면 이식성이 높아진다.",
            "버블 정렬로 직접 구현하면 swap 시 name과 score를 함께 교환해야 하므로 strcpy를 활용해야 한다.",
        ],
        testCases: [
            {input: "4명: 98,95,92,88", expected: "박영희 (92점, 3등)", actual: "박영희", pass: "O"},
            {input: "3명: 100,75,50", expected: "B (50점, 3등)", actual: "B", pass: "O"},
            {input: "compare 방향 역전 (a-b)", expected: "오름차순 → 잘못된 결과", actual: "잘못된 이름", pass: "X"},
            {input: "정렬 후 students[2].name", expected: "3등 이름", actual: "정상 출력", pass: "O"},
        ],
    },
}, "../c/3-2-12.docx");
