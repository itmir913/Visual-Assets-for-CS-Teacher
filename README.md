# 🚀 정보·컴퓨터 교사를 위한 시각화 수업 자료
[![License: CC BY-NC-SA 4.0](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

프로그래밍과 컴퓨터 과학 개념을 수업에서 직관적으로 설명할 수 있도록 만든 시각화 강의 자료입니다. 모든 자료는 웹페이지 형태로 제공되며, 별도의 설치 없이 브라우저에서 바로 수업에 사용할 수 있습니다.

## 🌟 주요 특징
* **AI 모델 시뮬레이터:** 인공지능에서 다루는 수십 가지 모델의 작동 원리를 텍스트가 아닌 시뮬레이터를 통해 **눈으로 직접 확인**하며 실습할 수 있습니다.
* **프로그래밍 개념 시각화:** 제어 구조, 알고리즘 등 추상적인 프로그래밍 언어의 핵심 개념들을 시각적으로 구현하여 강의의 질을 높여줍니다.

## 🔗 바로가기
* **단축 링크:** [https://bit.ly/정보교과](https://bit.ly/정보교과)
* **웹 페이지:** [https://luminousky.com/Visual-Assets-for-CS-Teacher/](https://luminousky.com/Visual-Assets-for-CS-Teacher/)

## 🛠 이 저장소를 고치려는 분께

강의노트는 **HTML 한 파일이 곧 한 차시**입니다. 빌드 도구 없이 브라우저에서 바로 열리고,
배포할 때만 CDN 자산을 정적 파일로 바꾼 번들을 만듭니다.

```bash
npm run setup     # 최초 1회
npm run preview   # 저장하면 그 파일만 다시 굽는다 → dist/
npm run ci        # 검사 → 빌드 → 산출물 검사. CI가 하는 일과 같다
```

**명령은 [`package.json`](./package.json)에만 정의합니다.** 스크립트 경로를 직접 치지 않습니다.

| 무엇을 하려는가 | 어디를 보나 |
|---|---|
| **새 차시·새 과목·새 배부 양식 추가** | [`docs/강의노트-추가하기.md`](./docs/강의노트-추가하기.md) |
| 지켜야 할 규칙 | [`CLAUDE.md`](./CLAUDE.md) |
| 그 규칙이 어떤 실패에서 나왔는지 | [`docs/강의노트-작성-사례집.md`](./docs/강의노트-작성-사례집.md) |
| 도구·미리보기·코드 주입 | [`tools/README.md`](./tools/README.md) |
| 배부 양식 생성기 | [`tools/docx/README.md`](./tools/docx/README.md) |
| 시뮬레이터 검증 절차 | [`docs/시뮬레이터-검증-워크플로.md`](./docs/시뮬레이터-검증-워크플로.md) |
| 한 번 풀어 본 문제의 해법 | [`docs/수정-레시피.md`](./docs/수정-레시피.md) |

새 과목을 만들 때 **[`tools/subjects.py`](./tools/subjects.py)의 `DIRS`에 등록**하지 않으면
빌드도 배포도 되지 않습니다. 유일한 게이트입니다.

## 📄 라이선스 안내 (License)
이 프로젝트의 모든 자료는 **CC BY-NC-SA 4.0** 라이선스를 따릅니다.
- **전체 라이선스 확인**: [공식 LICENSE 파일 바로가기](./LICENSE)
- **사용 가능**: 학교 수업, 교사 연수, 비영리 목적의 모든 교육 활동
- **상업적 이용 금지**: 상업적 목적의 이용은 엄격히 금지됩니다.
- **수정 및 재배포**: 자유롭게 수정할 수 있으나, 배포 시 원저작자를 명시해야 하며 동일한 라이선스(CC BY-NC-SA 4.0)를 적용해야 합니다.
