const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType,
    VerticalAlign, PageBreak,
} = require('docx');
const fs = require('fs');

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
const p = (text, opts = {}) =>
    new Paragraph({
        alignment: opts.center ? AlignmentType.CENTER : AlignmentType.LEFT,
        spacing: {before: 40, after: 40},
        children: [
            new TextRun({
                text,
                font: FONT,
                size: opts.size || FONT_BODY,
                bold: opts.bold || false,
                color: opts.color || "000000",
            }),
        ],
    });

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
    const noB = noBorder();
    const allNone = {top: noB, bottom: noB, left: noB, right: noB};

    // 열 너비 정의 (6 content 열 + 1 spacer)
    // C: [년입력/학번:, 년, 월입력, 월/이름:, 일입력, 일]
    // 레이블 셀(C[1],C[3],C[5])은 텍스트 너비에 맞게 좁게, 입력 셀은 넓게
    const C = [800, 500, 1500, 800, 1500, 500]; // 합계 5600
    const SPACER = CONTENT_W - C.reduce((a, b) => a + b, 0); // 4306

    const noCell = (w) =>
        new TableCell({width: {size: w, type: WidthType.DXA}, borders: allNone, children: [p("")]});

    const labelCell = (text, w, span = 1) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            columnSpan: span,
            borders: allNone,
            margins: {top: 60, bottom: 60, left: 60, right: 40},
            verticalAlign: VerticalAlign.CENTER,
            children: [p(text)],
        });

    const inputCell = (w, span = 1, align = AlignmentType.LEFT) =>
        new TableCell({
            width: {size: w, type: WidthType.DXA},
            columnSpan: span,
            borders: allNone,
            margins: {top: 60, bottom: 60, left: 80, right: 80},
            children: [new Paragraph({
                alignment: align,
                spacing: {before: 40, after: 40},
                children: [new TextRun({text: "", font: FONT, size: FONT_BODY})],
            })],
        });

    return [
        new Table({
            width: {size: CONTENT_W, type: WidthType.DXA},
            columnWidths: [SPACER, ...C],
            borders: {
                top: noB, bottom: noB, left: noB, right: noB,
                insideHorizontal: noB, insideVertical: noB,
            },
            rows: [
                // 1행: [빈] | 년입력 | 년 | 월입력 | 월 | 일입력 | 일
                new TableRow({
                    children: [
                        noCell(SPACER),
                        inputCell(C[0], 1, AlignmentType.RIGHT),
                        labelCell("년", C[1]),
                        inputCell(C[2], 1, AlignmentType.RIGHT),
                        labelCell("월", C[3]),
                        inputCell(C[4], 1, AlignmentType.RIGHT),
                        labelCell("일", C[5]),
                    ],
                }),
                // 2행: [빈] | 학번: | (span 2) | 이름: | (span 2)
                new TableRow({
                    children: [
                        noCell(SPACER),
                        labelCell("학번:", C[0]),
                        inputCell(C[1] + C[2], 2),
                        labelCell("이름:", C[3]),
                        inputCell(C[4] + C[5], 2),
                    ],
                }),
            ],
        }),
        ...emptyP(1),
    ];
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

// ═══════════════════════════════════════════════════════════════════════════
// 1. 프로그램 기획서
// ═══════════════════════════════════════════════════════════════════════════
const makeSection1 = () => {
    const table = new Table({
                width: {size: CONTENT_W, type: WidthType.DXA},
                columnWidths: [LW, RW],
                borders: outerBorders,
                rows: [
                    new TableRow({
                        children: [
                            grayCell("프로그램명", LW, 1),
                            contentCell([p("")], RW, 1),
                        ],
                    }),
                    new TableRow({
                        height: {value: 800, rule: "atLeast"},
                        children: [
                            grayCell("개발 목적", LW, 1),
                            contentCell([p("")], RW, 1),
                        ],
                    }),
                    new TableRow({
                        children: [
                            grayCell("대상\n사용자", LW, 1),
                            contentCell([p("")], RW, 1),
                        ],
                    }),
                    new TableRow({
                        height: {value: 1800, rule: "atLeast"},
                        children: [
                            grayCell("기능 요구\n사항", LW, 1),
                            contentCell([p("")], RW, 1),
                        ],
                    }),
                    new TableRow({
                        height: {value: 1800, rule: "atLeast"},
                        children: [
                            grayCell("실행 화면\n예시", LW, 1),
                            contentCell([
                                p("- 입력:"),
                                p(""),
                                p("- 출력:"),
                                p(""),
                            ], RW, 1),
                        ],
                    }),
                ],
            }
        )
    ;

    return [
        titleP("프로그램 기획서"),
        ...dateAuthorBlock(),
        table,
        ...emptyP(1),
        checklistBox([
            "프로그램 이름(주제)이 적혀 있다",
            "프로그램을 만들려는 이유가 진로 또는 실생활과 연관하여 1문장 이상 서술되어 있다",
            "프로그램의 주요 기능이 2가지 이상 서술되어 있다",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. 프로그램 개발 설계서-1 (요구 사항 분석)
// ═══════════════════════════════════════════════════════════════════════════
const makeSection2 = () => {
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

    const blankRow = () =>
        new TableRow({
            height: {value: 1800, rule: "atLeast"},
            children: [
                new TableCell({
                    width: {size: halfW, type: WidthType.DXA},
                    margins: {top: 100, bottom: 100, left: 120, right: 120},
                    children: [p("")],
                }),
                new TableCell({
                    width: {size: halfW2, type: WidthType.DXA},
                    margins: {top: 100, bottom: 100, left: 120, right: 120},
                    children: [p("")],
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
                        children: [p("")],
                    }),
                ],
            }),
            // 요구 사항 분석 라벨 + 입력 설계 헤더
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
            blankRow(),
            subHeader("출력 설계", "출력 데이터 예시"),
            blankRow(),
            subHeader("해결 방법", "해결 방법 예시"),
            blankRow(),
        ],
    });

    return [
        titleP("프로그램 개발 설계서-1"),
        ...dateAuthorBlock(),
        table,
        ...emptyP(1),
        checklistBox([
            "사용자가 입력하는 값이 2가지 이상 명시되어 있다",
            "프로그램이 출력하는 결과가 명시되어 있다",
            "입력값을 처리하는 방법(규칙 또는 공식)이 1문장 이상 서술되어 있다",
            "잘못된 입력(예: 음수, 문자 입력 등)에 대한 처리 방법이 언급되어 있다",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 3. 프로그램 개발 설계서-2 (알고리즘 설계)
// ═══════════════════════════════════════════════════════════════════════════
const makeSection3 = () => {
    const halfW = Math.floor((CONTENT_W - LW) / 2);
    const halfW2 = CONTENT_W - LW - halfW;

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
                        children: [p("")],
                    }),
                ],
            }),
            // 알고리즘 설계 라벨 + 헤더
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
            // 내용 (큰 영역)
            new TableRow({
                height: {value: 7000, rule: "atLeast"},
                children: [
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: [p("")],
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: [p("")],
                    }),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 개발 설계서-2"),
        ...dateAuthorBlock(),
        table,
        ...emptyP(1),
        checklistBox([
            "프로그램의 시작과 끝이 명시되어 있다",
            "처리 단계가 순서대로 3단계 이상 서술되어 있다",
            "조건에 따라 다른 동작을 하는 분기(if / 아니면)가 1개 이상 포함되어 있다",
            "반복이 필요한 경우 반복 조건이 명시되어 있다",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 4. 프로그램 개발 설계서-3 (소스 코드)
// ═══════════════════════════════════════════════════════════════════════════
const makeSection4 = () => {
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
                        children: [p("")],
                    }),
                ],
            }),
            new TableRow({
                children: [
                    grayCell("소스 코드", LW, 2),
                    new TableCell({
                        width: {size: halfW, type: WidthType.DXA},
                        shading: {fill: GRAY_HEADER, type: ShadingType.CLEAR},
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [pCenter("프로토타입 코드", {size: FONT_TITLE})],
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
                        children: [p("")],
                    }),
                    new TableCell({
                        width: {size: halfW2, type: WidthType.DXA},
                        margins: {top: 120, bottom: 120, left: 120, right: 120},
                        children: [p("")],
                    }),
                ],
            }),
        ],
    });

    return [
        titleP("프로그램 개발 설계서-3"),
        ...dateAuthorBlock(),
        table,
        ...emptyP(1),
        checklistBox([
            "코드를 실행하면 오류 없이 결과가 출력된다",
            "코드의 주요 단계마다 무엇을 하는지 설명이 1줄 이상 작성되어 있다",
            "잘못된 입력값에 대한 처리(예외 처리)가 코드에 포함되어 있다",
        ]),
    ];
};

// ═══════════════════════════════════════════════════════════════════════════
// 5. 프로그램 테스트
// ═══════════════════════════════════════════════════════════════════════════
const makeSection5 = () => {
    // 입력 데이터 | 기대 출력 | 실제 출력 | 판정(O/X)
    const C1 = 2500;  // 입력 데이터
    const C2 = 2200;  // 기대 출력
    const C3 = 2200;  // 실제 출력
    const C4 = CONTENT_W - LW - C1 - C2 - C3;  // 판정(O/X) — 나머지 2106

    const blankTestRow = () =>
        new TableRow({
            height: {value: 700, rule: "atLeast"},
            children: [
                new TableCell({
                    width: {size: C1, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")],
                }),
                new TableCell({
                    width: {size: C2, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")],
                }),
                new TableCell({
                    width: {size: C3, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")],
                }),
                new TableCell({
                    width: {size: C4, type: WidthType.DXA},
                    margins: {top: 80, bottom: 80, left: 120, right: 120},
                    children: [p("")],
                }),
            ],
        });

    const table = new Table({
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
                        children: [p("")],
                    }),
                ],
            }),
            new TableRow({
                height: {value: 800, rule: "atLeast"},
                children: [
                    grayCell("예상 오류", LW, 1),
                    new TableCell({
                        width: {size: C1 + C2 + C3 + C4, type: WidthType.DXA},
                        columnSpan: 4,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [p("")],
                    }),
                ],
            }),
            new TableRow({
                height: {value: 800, rule: "atLeast"},
                children: [
                    grayCell("개선점", LW, 1),
                    new TableCell({
                        width: {size: C1 + C2 + C3 + C4, type: WidthType.DXA},
                        columnSpan: 4,
                        margins: {top: 80, bottom: 80, left: 120, right: 120},
                        children: [p("")],
                    }),
                ],
            }),
            new TableRow({
                children: [
                    grayCell("테스트", LW, 5),
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
            blankTestRow(),
            blankTestRow(),
            blankTestRow(),
            blankTestRow(),
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

    return [
        titleP("프로그램 테스트"),
        ...dateAuthorBlock(),
        table,
        hintP,
        ...emptyP(1),
        checklistBox([
            "입력값과 출력값이 모두 기록된 테스트 케이스가 3개 있다",
            "정상적인 값으로 테스트한 케이스가 2개 이상 있다",
            "경계값(최솟값·최댓값) 또는 예외 입력을 사용한 테스트 케이스가 있다",
            "발견한 오류 또는 개선할 점이 1문장 이상 서술되어 있다  (없으면 '없음'과 이유)",
        ]),
    ];
};

// ─── 섹션 간 페이지 구분 ────────────────────────────────────────────────────
const pageBreak = () =>
    new Paragraph({
        children: [new PageBreak()],
        spacing: {before: 0, after: 0},
    });

// ═══════════════════════════════════════════════════════════════════════════
// 문서 생성
// ═══════════════════════════════════════════════════════════════════════════
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
                ...makeSection1(),
                pageBreak(),
                ...makeSection2(),
                pageBreak(),
                ...makeSection3(),
                pageBreak(),
                ...makeSection4(),
                pageBreak(),
                ...makeSection5(),
            ],
        },
    ],
});

Packer.toBuffer(doc).then((buffer) => {
    const outPath = "sw_project_template.docx";
    fs.writeFileSync(outPath, buffer);
    console.log("완료:", outPath);
});
