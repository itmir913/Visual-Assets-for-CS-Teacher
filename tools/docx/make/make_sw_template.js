const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageBreak, TableLayoutType,
} = require('docx');
const fs = require('fs');
const out = require('../outpath');

// ─── 공통 상수 ──────────────────────────────────────────────────────────────
const A4_W = 11906;  // DXA
const A4_H = 16838;
const MARGIN = 1000;
const CONTENT_W = A4_W - MARGIN * 2; // 9906

const GRAY_HEADER = "D9D9D9";
const FONT = "맑은 고딕";
const FONT_TITLE = 22;   // 11pt
const FONT_BODY = 20;   // 10pt
const FONT_H1 = 28;   // 14pt

// ─── 보더 헬퍼 ──────────────────────────────────────────────────────────────
const solid = (color = "000000", size = 6) => ({style: BorderStyle.SINGLE, size, color});
const noBorder = () => ({style: BorderStyle.NONE, size: 0, color: "FFFFFF"});

const outerBorders = {
    top: solid(), bottom: solid(), left: solid(), right: solid(),
    insideHorizontal: solid("AAAAAA", 4), insideVertical: solid("AAAAAA", 4),
};

// ─── 공통 단락 빌더 ─────────────────────────────────────────────────────────
const p = (text, opts = {}) => {
    const parts = text.split('\n');
    const children = parts.map((part, i) =>
        new TextRun({
            text: part,
            font: FONT,
            size: opts.size || FONT_BODY,
            bold: opts.bold || false,
            color: opts.color || "000000",
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

// ─── 빈 단락 ────────────────────────────────────────────────────────────────
const emptyP = (lines = 1) =>
    Array.from({length: lines}, () =>
        new Paragraph({spacing: {before: 0, after: 0}, children: [new TextRun("")]})
    );

// ─── 회색 헤더 셀 ───────────────────────────────────────────────────────────
const grayCell = (text, width, rowspan, colSpan) =>
    new TableCell({
        width: {size: width, type: WidthType.DXA},
        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
        verticalAlign: VerticalAlign.CENTER,
        margins: {top: 80, bottom: 80, left: 120, right: 120},
        rowSpan: rowspan,
        columnSpan: colSpan,
        children: [pCenter(text, {size: FONT_TITLE})],
    });

// ─── 일반 내용 셀 ───────────────────────────────────────────────────────────
const contentCell = (paragraphs, width, rowspan) =>
    new TableCell({
        width: {size: width, type: WidthType.DXA},
        verticalAlign: VerticalAlign.TOP,
        margins: {top: 100, bottom: 100, left: 160, right: 120},
        rowSpan: rowspan,
        children: paragraphs,
    });

// ─── 날짜/작성자 영역 ────────────────────────────────────────────────────────
const dateAuthorBlock = () => {
    // 학번/이름 행 — AI 템플릿과 동일한 보더 테이블 패턴
    const LB = 1400;
    const VC = Math.floor((CONTENT_W - LB * 2) / 2);
    const VC2 = CONTENT_W - LB * 2 - VC;

    const siLabelCell = (text, w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 120, right: 80},
            children: [pCenter(text, {size: FONT_TITLE})],
        });

    const siInputCell = (w) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            verticalAlign: VerticalAlign.CENTER,
            margins: {top: 80, bottom: 80, left: 160, right: 120},
            children: [p("")],
        });

    const studentTable = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LB, VC, LB, VC2],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [
                    siLabelCell("학번", LB),
                    siInputCell(VC),
                    siLabelCell("이름", LB),
                    siInputCell(VC2),
                ],
            }),
        ],
    });

    return [studentTable, ...emptyP(1)];
};

// ─── 큰 제목 ────────────────────────────────────────────────────────────────
const titleP = (text) =>
    new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: {before: 200, after: 200},
        children: [new TextRun({text, font: FONT, size: FONT_H1, bold: true})],
    });

// ─── 좌측/우측 너비 ─────────────────────────────────────────────────────────
const LW = 1400;
const RW = CONTENT_W - LW;

// ─── 자기점검 체크리스트 박스 ────────────────────────────────────────────────
const checklistBox = (items) => {
    const BOX_BG = "EBF3FB";
    const BOX_BORDER = "2E74B5";

    const headerPara = new Paragraph({
        spacing: {before: 60, after: 100},
        children: [
            new TextRun({text: "자기점검 체크리스트", font: FONT, size: FONT_TITLE, bold: true, color: "1F4E79"}),
        ],
    });

    const checkItems = items.map((text) =>
        new Paragraph({
            spacing: {before: 50, after: 50},
            indent: {left: 160},
            children: [new TextRun({text: "□  " + text, font: FONT, size: FONT_BODY})],
        })
    );

    return new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [CONTENT_W], // ◀ [해결책 1] 테이블 열 너비를 명시적으로 지정
        layout: TableLayoutType.FIXED, // ◀ [해결책 2] 뷰어가 멋대로 너비를 줄이지 못하도록 고정
        borders: {
            top: {style: BorderStyle.SINGLE, size: 12, color: BOX_BORDER},
            bottom: {style: BorderStyle.SINGLE, size: 12, color: BOX_BORDER},
            left: {style: BorderStyle.SINGLE, size: 12, color: BOX_BORDER},
            right: {style: BorderStyle.SINGLE, size: 12, color: BOX_BORDER},
            insideHorizontal: noBorder(),
            insideVertical: noBorder(),
        },
        rows: [
            new TableRow({
                children: [
                    new TableCell({
                        width: {size: CONTENT_W, type: WidthType.DXA},
                        shading: {fill: BOX_BG, type: ShadingType.CLEAR},
                        margins: {top: 140, bottom: 140, left: 240, right: 240},
                        children: [headerPara, ...checkItems],
                    }),
                ],
            }),
        ],
    });
};

// ─── 섹션 간 페이지 구분 ────────────────────────────────────────────────────
const pageBreak = () =>
    new Paragraph({
        children: [new PageBreak()],
        spacing: {before: 0, after: 0},
    });

// ─── 문자열 배열 → 단락 배열 (빈 배열이면 빈 단락 1개) ────────────────────
const lines = (arr) => (arr && arr.length ? arr : [""]).map(t => p(t));

// ═══════════════════════════════════════════════════════════════════════════
// 1. 프로그램 기획서
// ═══════════════════════════════════════════════════════════════════════════
const makeSection1 = (d = {}) => {
    const table = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LW, RW],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [
                    grayCell("프로그램명", LW, 1),
                    contentCell([p(d.programName || "")], RW, 1),
                ],
            }),
            new TableRow({
                height: {value: 800, rule: "atLeast"},
                children: [
                    grayCell("개발 목적", LW, 1),
                    contentCell(lines(d.purpose), RW, 1),
                ],
            }),
            new TableRow({
                children: [
                    grayCell("대상\n사용자", LW, 1),
                    contentCell([p(d.targetUser || "")], RW, 1),
                ],
            }),
            new TableRow({
                height: {value: 1800, rule: "atLeast"},
                children: [
                    grayCell("기능 요구\n사항", LW, 1),
                    contentCell(lines(d.features), RW, 1),
                ],
            }),
            new TableRow({
                height: {value: 1800, rule: "atLeast"},
                children: [
                    grayCell("실행 화면\n예시", LW, 1),
                    contentCell(lines(d.screenExample || ["- 입력:", "", "- 출력:", ""]), RW, 1),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 기획서"),
        ...dateAuthorBlock(),
        table,
        ...emptyP(1),
        checklistBox([
            "개발할 프로젝트 주제와 프로그램 이름이 구체적으로 확정되어 있다.",
            "프로그램을 만들려는 이유가 진로 또는 실생활과 연관하여 1문장 이상 서술되어 있다.",
            "프로그램의 주요 기능이 2가지 이상 서술되어 있다.",
            "실행 시 입력과 출력 화면 예시가 각각 1개 이상 제시되어 있다.",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. 프로그램 개발 설계서-1 (요구 사항 분석)
// ═══════════════════════════════════════════════════════════════════════════
const makeSection2 = (d = {}) => {
    const halfW = Math.floor((CONTENT_W - LW) / 2);
    const halfW2 = CONTENT_W - LW - halfW;

    const subHeader = (label1, label2) =>
        new TableRow({
            children: [
                new TableCell({
                    width: {size: halfW, type: WidthType.DXA},
                    shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [pCenter(label1, {size: FONT_TITLE})],
                }),
                new TableCell({
                    width: {size: halfW2, type: WidthType.DXA},
                    shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [pCenter(label2, {size: FONT_TITLE})],
                }),
            ],
        });

    const dataRow = (leftPs, rightPs) =>
        new TableRow({
            height: {value: 1800, rule: "atLeast"},
            children: [
                new TableCell({
                    width: {size: halfW, type: WidthType.DXA},
                    margins: {top: 100, bottom: 100, left: 120, right: 120},
                    children: leftPs,
                }),
                new TableCell({
                    width: {size: halfW2, type: WidthType.DXA},
                    margins: {top: 100, bottom: 100, left: 120, right: 120},
                    children: rightPs,
                }),
            ],
        });

    const table = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LW, halfW, halfW2],
        borders: outerBorders,
        rows: [
            // 프로그램명
            new TableRow({
                children: [
                    grayCell("프로그램명", LW, 1),
                    new TableCell({
                        width: {size: halfW + halfW2, type: WidthType.DXA},
                        columnSpan: 2,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [p(d.programName || "")],
                    }),
                ],
            }),
            // 요구 사항 분석 라벨 (rowspan 6)
            new TableRow({
                children: [
                    grayCell("요구 사항\n분석", LW, 6),
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("입력 설계", {size: FONT_TITLE})],
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("입력 데이터 예시", {size: FONT_TITLE})],
                    }),
                ],
            }),
            dataRow(lines(d.inputDesign), lines(d.inputExample)),
            subHeader("출력 설계", "출력 데이터 예시"),
            dataRow(lines(d.outputDesign), lines(d.outputExample)),
            // 제약 조건 통합 헤더 (가로 통칸)
            new TableRow({
                children: [
                    new TableCell({
                        width: {size: halfW + halfW2, type: WidthType.DXA},
                        columnSpan: 2,
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        verticalAlign: VerticalAlign.CENTER,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [
                            pCenter("제약 조건 및 예외 데이터 (문자의 입력, 음수 입력 등 예외 조건)", {size: FONT_TITLE}),
                        ],
                    }),
                ],
            }),
            // 제약 조건 내용 (가로 통칸)
            new TableRow({
                height: {value: 1800, rule: "atLeast"},
                children: [
                    new TableCell({
                        width: {size: halfW + halfW2, type: WidthType.DXA},
                        columnSpan: 2,
                        margins: {top: 100, bottom: 100, left: 120, right: 120},
                        children: lines(d.constraints),
                    }),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 개발 설계서-1"),
        table,
        ...emptyP(1),
        checklistBox([
            "입력 데이터의 종류, 자료형(형태), 그리고 올바른 입력 예시가 명확히 명시되어 있다.",
            "프로그램이 최종적으로 출력하는 결과물과 출력 형태(데이터 예시)가 명확히 명시되어 있다.",
            "정상 범위를 벗어난 잘못된 입력(예: 음수, 문자 입력 등)에 대한 제약 조건과 처리 방법이 구체적으로 기술되어 있다.",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. 프로그램 개발 설계서-2 (알고리즘 설계)
// ═══════════════════════════════════════════════════════════════════════════
const makeSection3 = (d = {}) => {
    const halfW = Math.floor((CONTENT_W - LW) / 2);
    const halfW2 = CONTENT_W - LW - halfW;

    const table = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LW, halfW, halfW2],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [
                    grayCell("프로그램명", LW, 1),
                    new TableCell({
                        width: {size: halfW + halfW2, type: WidthType.DXA},
                        columnSpan: 2,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [p(d.programName || "")],
                    }),
                ],
            }),
            new TableRow({
                children: [
                    grayCell("알고리즘\n설계", LW, 2),
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("순서도 (또는 로직 순서 설명)", {size: FONT_TITLE})],
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("의사 코드", {size: FONT_TITLE})],
                    }),
                ],
            }),
            new TableRow({
                height: {value: 7000, rule: "atLeast"},
                children: [
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: lines(d.flowchart),
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: lines(d.pseudocode),
                    }),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 개발 설계서-2"),
        table,
        ...emptyP(1),
        checklistBox([
            "프로그램의 시작과 끝이 명시되어 있다.",
            "처리 단계가 순서대로 3단계 이상 서술되어 있다.",
            "프로그램 특성에 맞는 제어 구조(선택·반복)가 알고리즘에 올바르게 반영되어 있다.",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. 프로그램 구현 (소스 코드)
// ═══════════════════════════════════════════════════════════════════════════
const makeSection4 = (d = {}) => {
    const halfW = Math.floor((CONTENT_W - LW) / 2);
    const halfW2 = CONTENT_W - LW - halfW;

    const table = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LW, halfW, halfW2],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [
                    grayCell("프로그램명", LW, 1),
                    new TableCell({
                        width: {size: halfW + halfW2, type: WidthType.DXA},
                        columnSpan: 2,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [p(d.programName || "")],
                    }),
                ],
            }),
            new TableRow({
                children: [
                    grayCell("프로그램 구현", LW, 2),
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("소스 코드", {size: FONT_TITLE})],
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("설명", {size: FONT_TITLE})],
                    }),
                ],
            }),
            new TableRow({
                height: {value: 8000, rule: "atLeast"},
                children: [
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: lines(d.code),
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: lines(d.explanation),
                    }),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 구현"),
        table,
        ...emptyP(1),
        checklistBox([
            "코드를 실행하면 오류 없이 결과가 출력된다.",
            "코드의 주요 단계마다 무엇을 하는지 설명이 1줄 이상 작성되어 있다.",
            "잘못된 입력값(예: 음수, 문자 등)이 들어왔을 때 처리하는 코드가 포함되어 있다.",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. 프로그램 테스트
// ═══════════════════════════════════════════════════════════════════════════
const makeSection5 = (d = {}) => {
    const C1 = 2500;
    const C2 = 2200;
    const C3 = 2200;
    const C4 = CONTENT_W - LW - C1 - C2 - C3;

    const blankTestRow = () =>
        new TableRow({
            height: {value: 700, rule: "atLeast"},
            children: [
                new TableCell({
                    width: {size: C1, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")]
                }),
                new TableCell({
                    width: {size: C2, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")]
                }),
                new TableCell({
                    width: {size: C3, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")]
                }),
                new TableCell({
                    width: {size: C4, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")]
                }),
            ],
        });

    const filledTestRow = (tc) =>
        new TableRow({
            height: {value: 700, rule: "atLeast"},
            children: [
                new TableCell({
                    width: {size: C1, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p(tc.input || "")]
                }),
                new TableCell({
                    width: {size: C2, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [pCenter(tc.expected || "")]
                }),
                new TableCell({
                    width: {size: C3, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [pCenter(tc.actual || "")]
                }),
                new TableCell({
                    width: {size: C4, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [pCenter(tc.pass || "")]
                }),
            ],
        });

    const testCases = d.testCases || [];
    const testRows = testCases.length > 0
        ? testCases.map(filledTestRow)
        : [blankTestRow(), blankTestRow(), blankTestRow(), blankTestRow()];
    const testRowspan = (testCases.length || 4) + 1;

    // ── 표 1: 테스트 케이스 ──────────────────────────────────────────────────
    const testTable = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LW, C1, C2, C3, C4],
        borders: outerBorders,
        rows: [
            new TableRow({
                children: [
                    grayCell("프로그램명", LW, 1),
                    new TableCell({
                        width: {size: C1 + C2 + C3 + C4, type: WidthType.DXA},
                        columnSpan: 4,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [p(d.programName || "")],
                    }),
                ],
            }),
            new TableRow({
                children: [
                    grayCell("테스트", LW, testRowspan),
                    new TableCell({
                        width: {size: C1, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("입력 데이터", {size: FONT_TITLE})],
                    }),
                    new TableCell({
                        width: {size: C2, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("기대 출력", {size: FONT_TITLE})],
                    }),
                    new TableCell({
                        width: {size: C3, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("실제 출력", {size: FONT_TITLE})],
                    }),
                    new TableCell({
                        width: {size: C4, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("판정(O/X)", {size: FONT_TITLE})],
                    }),
                ],
            }),
            ...testRows,
        ],
    });

    const hintP = new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: {before: 40, after: 0},
        children: [new TextRun({
            text: "※ 테스트 케이스가 더 필요한 경우 행을 추가하여 작성하세요.",
            font: FONT,
            size: 18,
            color: "888888",
            italics: true,
        })],
    });

    // ── 표 2: 발견한 오류 / 개선점 ──────────────────────────────────────────
    const resultTable = new Table({
        width: {size: CONTENT_W, type: WidthType.DXA},
        columnWidths: [LW, RW],
        borders: outerBorders,
        rows: [
            new TableRow({
                height: {value: 800, rule: "atLeast"},
                children: [
                    grayCell("발견한\n오류", LW, 1),
                    contentCell(lines(d.errors), RW, 1),
                ],
            }),
            new TableRow({
                height: {value: 800, rule: "atLeast"},
                children: [
                    grayCell("개선점", LW, 1),
                    contentCell(lines(d.improvements), RW, 1),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 테스트"),
        testTable,
        hintP,
        resultTable,
        ...emptyP(1),
        checklistBox([
            "입력값과 출력값이 모두 기록된 테스트 케이스가 3개 이상 있다.",
            "정상적인 값으로 테스트한 케이스가 2개 이상 있다.",
            "경계값(최솟값·최댓값) 또는 예외 입력을 사용한 테스트 케이스가 있다.",
            "발견한 오류 또는 개선할 점이 1문장 이상 서술되어 있다. (없으면 '없음'과 이유)",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 공통 문서 생성 함수 (외부에서 require해서 사용)
// ═══════════════════════════════════════════════════════════════════════════
const makeDocument = (data = {}, outputFile = "sw_project_template.docx") => {
    const doc = new Document({
        styles: {
            default: {
                document: {
                    run: {font: FONT, size: FONT_BODY},
                },
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
                    ...makeSection1(data.s1),
                    pageBreak(),
                    ...makeSection2(data.s2),
                    pageBreak(),
                    ...makeSection3(data.s3),
                    pageBreak(),
                    ...makeSection4(data.s4),
                    pageBreak(),
                    ...makeSection5(data.s5),
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
    Promise.all([
        makeDocument({}, out('실습', '프로젝트-개발-문서.c.docx')),
        makeDocument({}, out('실습', '프로젝트-개발-문서.py.docx')),
    ]);
}
