const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageBreak, TableLayoutType,
} = require('docx');
const fs = require('fs');
const out = require('../outpath');

// ─── 공통 상수 ──────────────────────────────────────────────────────────────
const A4_W = 11906;
const A4_H = 16838;
const MARGIN = 1000;
const CONTENT_W = A4_W - MARGIN * 2; // 9906

const GRAY_HEADER = "D9D9D9";
const BLUE_HEADER = "EBF3FB";
const BLUE_BORDER = "2E74B5";
const BLUE_TEXT = "1F4E79";
const SAMPLE_BG = "FFF9E6";   // 예시 뱃지 배경
const SAMPLE_BORD = "C8960C";   // 예시 뱃지 테두리
const FONT = "맑은 고딕";
const FONT_H1 = 28;   // 14pt — 문서 제목
const FONT_TITLE = 22;  // 11pt — 표 헤더
const FONT_BODY = 20;  // 10pt — 본문
const FONT_SMALL = 18;  //  9pt — 안내문구·주석

// ─── 보더 헬퍼 ──────────────────────────────────────────────────────────────
const solid = (color = "000000", size = 6) => ({style: BorderStyle.SINGLE, size, color});
const noBorder = () => ({style: BorderStyle.NONE, size: 0, color: "FFFFFF"});

const outerBorders = {
    top: solid(), bottom: solid(), left: solid(), right: solid(),
    insideHorizontal: solid("AAAAAA", 4), insideVertical: solid("AAAAAA", 4),
};

// ─── 단락 빌더 ──────────────────────────────────────────────────────────────
const p = (text, opts = {}) => {
    const parts = (text || "").split('\n');
    const children = parts.map((part, i) =>
        new TextRun({
            text: part,
            font: FONT,
            size: opts.size || FONT_BODY,
            bold: opts.bold || false,
            color: opts.color || "000000",
            italics: opts.italics || false,
            ...(i > 0 ? {break: 1} : {}),
        })
    );
    return new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: {before: 40, after: 40},
        children,
    });
};

const pCenter = (text, opts = {}) => p(text, {...opts, center: true});

const emptyP = (lines = 1) =>
    Array.from({length: lines}, () =>
        new Paragraph({spacing: {before: 0, after: 0}, children: [new TextRun("")]}));

const pageBreak = () =>
    new Paragraph({children: [new PageBreak()], spacing: {before: 0, after: 0}});

// ─── 텍스트런 빌더 (\n 자동 분리 → break:1) ──────────────────────────────────
// 항상 TextRun[] 반환. children에 직접 할당하거나 .flat()으로 평탄화해 사용.
const run = (text, opts = {}) => {
    const parts = (text || "").split('\n');
    return parts.map((part, i) =>
        new TextRun({
            text: part,
            font: FONT,
            size: opts.size || FONT_BODY,
            bold: opts.bold || false,
            color: opts.color || "000000",
            italics: opts.italics || false,
            ...(i > 0 ? {break: 1} : {}),
        })
    );
};

// ─── 문자열 배열 → 단락 배열 ─────────────────────────────────────────────────
const toParagraphs = (lines) => {
    if (!lines || lines.length === 0) return [p("")];
    return lines.map(line => p(line));
};

// ─── 셀 빌더 ────────────────────────────────────────────────────────────────
const contentCell = (paragraphs, width, rowSpan = 1, colSpan = 1) =>
    new TableCell({
        width: {size: width, type: WidthType.DXA},
        verticalAlign: VerticalAlign.TOP,
        margins: {top: 100, bottom: 100, left: 160, right: 120},
        rowSpan,
        columnSpan: colSpan,
        children: paragraphs,
    });

const questionHeaderCell = (runs, width) =>
    new TableCell({
        width: {size: width, type: WidthType.DXA},
        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
        verticalAlign: VerticalAlign.CENTER,
        margins: {top: 100, bottom: 100, left: 160, right: 120},
        children: [new Paragraph({spacing: {before: 40, after: 40}, children: runs.flat()})],
    });

// ─── 문항 표 (1열) ───────────────────────────────────────────────────────────
// contentParagraphs: 답변 단락 배열 — 빈 양식이면 [p("")]
const questionTable = (headerRuns, contentParagraphs = [p("")], answerH = 6000) =>
    new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [CONTENT_W],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [questionHeaderCell(headerRuns, CONTENT_W)],
            }),
            new TableRow({
                height: {value: answerH, rule: "atLeast"},
                children: [contentCell(contentParagraphs, CONTENT_W)],
            }),
        ],
    });

// ─── 문항 표 (2열) ───────────────────────────────────────────────────────────
const questionTable2Col = (headerRunsL, headerRunsR, contentL = [p("")], contentR = [p("")], answerH = 6000) => {
    const HALF = Math.floor(CONTENT_W / 2);
    const HALF2 = CONTENT_W - HALF;
    return new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [HALF, HALF2],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: {size: HALF, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        verticalAlign: VerticalAlign.CENTER,
                        margins: {top: 100, bottom: 100, left: 160, right: 120},
                        children: [new Paragraph({spacing: {before: 40, after: 40}, children: headerRunsL.flat()})],
                    }),
                    new TableCell({
                        width: {size: HALF2, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        verticalAlign: VerticalAlign.CENTER,
                        margins: {top: 100, bottom: 100, left: 160, right: 120},
                        children: [new Paragraph({spacing: {before: 40, after: 40}, children: headerRunsR.flat()})],
                    }),
                ],
            }),
            new TableRow({
                height: {value: answerH, rule: "atLeast"},
                children: [
                    contentCell(contentL, HALF),
                    contentCell(contentR, HALF2),
                ],
            }),
        ],
    });
};

// ─── 체크리스트 박스 ─────────────────────────────────────────────────────────
const checklistBox = (items) =>
    new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [CONTENT_W],
        layout: TableLayoutType.FIXED,
        borders: {
            top: {style: BorderStyle.SINGLE, size: 12, color: BLUE_BORDER},
            bottom: {style: BorderStyle.SINGLE, size: 12, color: BLUE_BORDER},
            left: {style: BorderStyle.SINGLE, size: 12, color: BLUE_BORDER},
            right: {style: BorderStyle.SINGLE, size: 12, color: BLUE_BORDER},
            insideHorizontal: noBorder(),
            insideVertical: noBorder(),
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: {size: CONTENT_W, type: WidthType.DXA},
                        shading: {fill: BLUE_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 120, bottom: 120, left: 200, right: 200},
                        children: [
                            new Paragraph({
                                spacing: {before: 40, after: 80},
                                children: run("자기점검 체크리스트", {size: FONT_TITLE, bold: true, color: BLUE_TEXT}),
                            }),
                            ...items.map((text) =>
                                new Paragraph({
                                    spacing: {before: 40, after: 40},
                                    indent: {left: 140},
                                    children: run("□  " + text),
                                })
                            ),
                        ],
                    }),
                ],
            }),
        ],
    });

// ─── 학생 정보 표 ────────────────────────────────────────────────────────────
// toolName: null → 빈 양식(힌트 텍스트), string → 예시값 표시
const studentInfoTable = (toolName = null) => {
    const LB = 1400;
    const VC = Math.floor((CONTENT_W - LB * 2) / 2);
    const VC2 = CONTENT_W - LB * 2 - VC;

    const labelCell = (text, w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 120, right: 80},
            children: [pCenter(text, {size: FONT_TITLE})],
        });

    const inputCell = (w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 160, right: 120},
            children: [p("")],
        });

    const valueCell = (text, w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 160, right: 120},
            children: [p(text, {color: "888888", italics: true})],
        });

    const toolHintCell = (w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 160, right: 120},
            columnSpan: 3,
            children: [
                new Paragraph({
                    spacing: {before: 40, after: 40},
                    children: [
                        ...run(""),
                        ...run("      (티처블머신  /  코랩  /  오렌지  중 선택하여 기재)",
                            {size: FONT_SMALL, color: "888888", italics: true}),
                    ],
                }),
            ],
        });

    const toolFilledCell = (name, w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 160, right: 120},
            columnSpan: 3,
            children: [p(name)],
        });

    return new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LB, VC, LB, VC2],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: toolName
                    ? [
                        labelCell("학번", LB),
                        valueCell("20251234  (예시)", VC),
                        labelCell("이름", LB),
                        valueCell("학생 A  (예시)", VC2),
                    ]
                    : [
                        labelCell("학번", LB),
                        inputCell(VC),
                        labelCell("이름", LB),
                        inputCell(VC2),
                    ],
            }),
            new TableRow({
                children: [
                    labelCell("사용 도구", LB),
                    toolName
                        ? toolFilledCell(toolName, CONTENT_W - LB)
                        : toolHintCell(CONTENT_W - LB),
                ],
            }),
        ],
    });
};

// ─── 예시 뱃지 (황금색 박스) ─────────────────────────────────────────────────
const sampleBadge = (c) =>
    new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [CONTENT_W],
        layout: TableLayoutType.FIXED,
        borders: {
            top: {style: BorderStyle.SINGLE, size: 12, color: SAMPLE_BORD},
            bottom: {style: BorderStyle.SINGLE, size: 12, color: SAMPLE_BORD},
            left: {style: BorderStyle.SINGLE, size: 12, color: SAMPLE_BORD},
            right: {style: BorderStyle.SINGLE, size: 12, color: SAMPLE_BORD},
            insideHorizontal: noBorder(),
            insideVertical: noBorder(),
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: {size: CONTENT_W, type: WidthType.DXA},
                        shading: {fill: SAMPLE_BG, type: ShadingType.CLEAR},
                        margins: {top: 120, bottom: 120, left: 200, right: 200},
                        children: [
                            new Paragraph({
                                spacing: {before: 40, after: 60},
                                children: [
                                    ...run("▶  예시 보고서  |  ", {size: FONT_TITLE, bold: true, color: "A07000"}),
                                    ...run(c.topic, {size: FONT_TITLE, bold: true, color: "222222"}),
                                ],
                            }),
                            new Paragraph({
                                spacing: {before: 0, after: 40},
                                children: run(
                                    `기계학습 유형: ${c.mlType}    /    도구: ${c.tool}    /    진로 연관: ${c.career}`,
                                    {size: FONT_SMALL, color: "666666"}
                                ),
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });

// ─── 제목 블록 ───────────────────────────────────────────────────────────────
const titleBlock = () => [
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {before: 160, after: 100},
        children: run("기계학습 모델 구현 보고서", {size: FONT_H1, bold: true}),
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {before: 0, after: 60},
        children: run(
            "실습형 수행평가 (20점 만점)  ·  시험 시간 45분  ·  오픈북 (미리 준비한 코드·데이터·유인물 참고 가능)",
            {size: FONT_SMALL, color: "888888"}
        ),
    }),
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {before: 0, after: 160},
        children: run(
            "작성 완료 후 오른쪽 상단 제출 버튼을 클릭하고 컴퓨터를 종료하시오.",
            {size: FONT_SMALL, color: "888888"}
        ),
    }),
];

// ─── 섹션 제목 ───────────────────────────────────────────────────────────────
const sectionTitle = (text) =>
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {before: 160, after: 140},
        children: run(text, {size: FONT_H1, bold: true}),
    });

// ════════════════════════════════════════════════════════════════════════════
// 페이지별 생성 함수
// c: content 객체(예시 보고서) 또는 null(빈 양식)
// ════════════════════════════════════════════════════════════════════════════

const makeQ1 = (c) => [
    ...titleBlock(),
    ...(c ? [sampleBadge(c), ...emptyP(1)] : []),
    studentInfoTable(c ? c.tool : null),
    ...emptyP(1),
    questionTable(
        [
            run("문항 1.  ", {bold: true}),
            run("실생활이나 학문 분야에서 인공지능으로 해결하고자 하는 문제를 구체적으로 정의하시오. 어떤 상황에서 어떤 불편함 또는 필요가 발생하는지를 포함하여 서술하시오."),
            run("\n\n(예: 갤러리에 무작위로 저장된 반려동물 사진을 일일이 손으로 분류해야 하는 불편함을 해소하기 위해, 사진을 자동으로 분류하는 시스템을 만들고자 한다.)",
                {size: FONT_SMALL, color: "555555", italics: true}),
        ],
        c ? toParagraphs(c.q1) : [p("")],
        c ? 2000 : 7000
    ),
    ...emptyP(1),
    checklistBox([
        "해결하고자 하는 문제가 실생활 또는 학문 분야와 연관되어 구체적으로 제시되어 있다.",
        "문제가 발생하는 상황(불편함·필요성)이 명확하게 서술되어 있다.",
    ]),
];

const makeQ2 = (c) => [
    sectionTitle("문항 2"),
    questionTable(
        [
            run("문항 2.  ", {bold: true}),
            run("구현하려는 인공지능 모델을 설명하시오. 이 모델은 어떤 데이터를 "),
            run("입력", {bold: true}),
            run("받아, 어떤 결과를 "),
            run("출력", {bold: true}),
            run("하는가? 입력과 출력을 중심으로 모델의 역할을 구체적으로 서술하시오."),
            run("\n\n(예: 입력 — 강아지·고양이 사진  /  출력 — '강아지' 또는 '고양이'로 분류된 레이블)",
                {size: FONT_SMALL, color: "555555", italics: true}),
        ],
        c ? toParagraphs(c.q2) : [p("")],
        c ? 2000 : 5500
    ),
    ...emptyP(1),
    checklistBox([
        "만들고자 하는 모델의 입력 데이터(종류·형태)가 명확히 제시되어 있다.",
        "모델이 출력하는 결과(레이블·수치·군집 등)가 구체적으로 서술되어 있다.",
        "입력과 출력을 통해 모델의 역할이 명확하게 드러난다.",
    ]),
];

const makeQ3 = (c) => [
    sectionTitle("문항 3"),
    questionTable(
        [
            run("문항 3.  ", {bold: true}),
            run("위에서 구상한 모델을 구현하기 위해 아래 ①, ② 순서대로 선택하고 그 이유를 서술하시오."),
            run("\n\n①  기계학습 유형:  ", {bold: true}),
            run("지도학습과 비지도학습 중 이 모델에 적합한 유형을 선택하고, 분류·군집·예측 등의 개념을 활용하여 그 이유를 설명하시오."),
            run("\n\n②  구현 도구:  ", {bold: true}),
            run("①에서 선택한 유형을 구현하기 위해 티처블머신·코랩·오렌지 중 어떤 도구를 선택했는지 밝히고, 그 이유를 서술하시오."),
        ],
        c ? toParagraphs(c.q3) : [p("")],
        c ? 2000 : 7500
    ),
    ...emptyP(1),
    checklistBox([
        "지도학습 또는 비지도학습 중 하나를 명확히 선택하였다.",
        "분류·군집·예측 등의 개념을 활용하여 유형 선택 이유가 논리적으로 서술되어 있다.",
        "구현 도구를 선택하고 그 이유가 기계학습 유형과 연결되어 설명되어 있다.",
    ]),
];

const makeQ4 = (c) => [
    sectionTitle("문항 4"),
    questionTable(
        [
            run("문항 4.  ", {bold: true}),
            run("모델 학습에 사용한 데이터를 설명하시오. 데이터의 출처·유형·수량·특성 등을 작성하고, 필요한 경우 스크린샷을 첨부하시오."),
            run("\n\n〈화면 캡처 단축키: 윈도우 + Shift + S〉",
                {size: FONT_SMALL, color: "555555", italics: true}),
        ],
        c ? toParagraphs(c.q4) : [p("")],
        c ? 2000 : 8500
    ),
    ...emptyP(1),
    checklistBox([
        "데이터의 출처(직접 촬영·공개 데이터셋·직접 수집 등)가 명시되어 있다.",
        "데이터의 유형(이미지·텍스트·수치 등)과 수량이 구체적으로 서술되어 있다.",
        "학습에 사용된 데이터 화면 또는 데이터 목록 스크린샷이 첨부되어 있다.",
    ]),
];

const makeQ5 = (c) => [
    sectionTitle("문항 5"),
    questionTable(
        [
            run("문항 5.  ", {bold: true}),
            run("수집한 데이터로 모델을 학습시킨 결과를 서술하시오. 학습이 완료된 화면 또는 학습 결과를 스크린샷으로 첨부하고, 수치나 지표를 포함하여 결과의 의미를 간략히 설명하시오."),
            run("\n\n〈화면 캡처 단축키: 윈도우 + Shift + S〉",
                {size: FONT_SMALL, color: "555555", italics: true}),
        ],
        c ? toParagraphs(c.q5) : [p("")],
        c ? 2000 : 8500
    ),
    ...emptyP(1),
    checklistBox([
        "학습이 완료된 모델 화면 또는 학습 결과 스크린샷이 첨부되어 있다.",
        "모델의 학습 결과를 확인할 수 있는 수치나 지표가 언급되어 있다.",
        "학습 결과의 의미(모델이 잘 학습되었는지 여부 등)가 서술되어 있다.",
    ]),
];

const makeQ6 = (c) => [
    sectionTitle("문항 6"),
    questionTable(
        [
            run("문항 6.  ", {bold: true}),
            run("학습된 모델에 새로운 데이터를 직접 입력하여 성능을 테스트하시오. 테스트 전 예상했던 결과와 실제 결과를 비교하고, 차이가 발생했다면 그 원인을 분석하시오."),
        ],
        c ? toParagraphs(c.q6) : [p("")],
        c ? 2000 : 6500
    ),
    ...emptyP(1),
    checklistBox([
        "학습에 사용하지 않은 새로운 데이터로 테스트를 수행하였다.",
        "테스트 전 예상 결과와 실제 결과가 모두 서술되어 있다.",
        "예상과 실제 사이에 차이가 있다면 그 원인이 분석되어 있다. (차이가 없으면 이유 서술)",
    ]),
];

const makeQ7 = (c) => [
    sectionTitle("문항 7"),
    questionTable2Col(
        [
            run("기대 효과  ", {bold: true}),
            run("이 모델을 자신의 관심 분야(예: 의료·환경·스포츠 등)에 적용한다면 어떤 효과를 기대할 수 있는지 서술하시오."),
        ],
        [
            run("개선 사항  ", {bold: true}),
            run("현재 모델의 한계를 바탕으로, 성능을 향상시키기 위해 필요한 개선사항을 구체적으로 서술하시오."),
        ],
        c ? toParagraphs(c.q7left) : [p("")],
        c ? toParagraphs(c.q7right) : [p("")],
        c ? 2000 : 6500
    ),
    ...emptyP(1),
    checklistBox([
        "자신의 관심 분야가 명시되고, 모델 적용 시 기대되는 효과가 구체적으로 서술되어 있다.",
        "현재 모델의 한계 또는 부족한 점이 언급되어 있다.",
        "성능 향상을 위한 개선사항(데이터 확충·모델 변경·파라미터 조정 등)이 제시되어 있다.",
    ]),
];

const makeQ8 = (c) => [
    sectionTitle("문항 8"),
    questionTable(
        [
            run("문항 8.  ", {bold: true}),
            run("기계학습 모델을 직접 구현하는 과정에서 달라진 생각, 어려웠던 점, 새롭게 알게 된 것, 또는 느낀 점을 자유롭게 서술하시오."),
        ],
        c ? toParagraphs(c.q8) : [p("")],
        c ? 2000 : 7500
    ),
    ...emptyP(1),
    checklistBox([
        "기계학습 구현 과정에서 새롭게 알게 된 것 또는 달라진 생각이 포함되어 있다.",
        "자신의 경험을 바탕으로 진솔하게 작성되어 있다.",
    ]),
];

// ════════════════════════════════════════════════════════════════════════════
// 문서 생성
// contentOrFile: content 객체 → 예시 보고서
//                문자열 또는 생략  → 빈 양식 (하위 호환)
// ════════════════════════════════════════════════════════════════════════════
// 출력 경로는 반드시 out(그룹, 파일명)으로 받는다. 기본값을 두면 빠뜨렸을 때
// 실행한 폴더에 파일이 조용히 떨어진다 — 그래서 없으면 세운다.
const makeDocument = (contentOrFile = null, outputFile) => {
    if (typeof contentOrFile === 'string') {
        outputFile = contentOrFile;
        contentOrFile = null;
    }
    if (!outputFile) throw new Error("출력 경로가 없다. out('그룹', '파일명.docx')를 넘긴다");
    const c = contentOrFile; // null → 빈 양식, 객체 → 예시 보고서

    const doc = new Document({
        styles: {
            default: {
                document: {run: {font: FONT, size: FONT_BODY}},
            },
        },
        sections: [
            {
                properties: {
                    page: {
                        size: {width: A4_W, height: A4_H},
                        margin: {top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN},
                    },
                },
                children: [
                    ...makeQ1(c), pageBreak(),
                    ...makeQ2(c), pageBreak(),
                    ...makeQ3(c), pageBreak(),
                    ...makeQ4(c), pageBreak(),
                    ...makeQ5(c), pageBreak(),
                    ...makeQ6(c), pageBreak(),
                    ...makeQ7(c), pageBreak(),
                    ...makeQ8(c),
                ],
            },
        ],
    });

    return Packer.toBuffer(doc).then((buffer) => {
        fs.writeFileSync(outputFile, buffer);
        console.log("완료:", outputFile);
    });
};

module.exports = {makeDocument};

// 직접 실행 시 빈 양식 생성
if (require.main === module) {
    makeDocument(out('ai', '수행평가-양식.docx'));
}
