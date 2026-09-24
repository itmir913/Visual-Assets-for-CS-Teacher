#!/usr/bin/env python3
"""강의노트와 시뮬레이터의 문장 정제에서 물러난 말이 다시 들어오지 않았는가.

    python tools/check_prose.py            # 모든 과목 + 시뮬레이터 (CI가 쓰는 방식)
    python tools/check_prose.py <파일>…    # 짚은 파일만 — 정제 중에 쓴다
    python tools/check_prose.py --report   # 정제 전 파일까지 과목별로 센다 (종료 코드 0)

## 왜 있는가 — 한 번 배운 것을 다음 과목이 공짜로 받게

문장 정제(2026-09-24, 데이터과학부터)는 사람이 읽고 고치는 일이다. 그런데 고친 말의
**대부분은 다른 과목에도 똑같이 있다.** 데이터과학에서 「짚다」를 「파악하다」로 갈았다면
다른 과목의 「짚다」는 읽지 않고도 찾을 수 있어야 한다. 그래서 **정제에서 한 번 물러난
말은 이 파일의 목록에 올린다** — 다음 과목의 검수는 이 목록을 먼저 돌리고 시작한다.

## 시뮬레이터도 같은 기준으로 막는다

강의노트와 시뮬레이터가 다른 기준으로 막히면 둘의 말이 서로 갈라진다(2026-09-24 사용자
지시). 범위는 `check_sim_terms.scope()`를 그대로 쓴다 — 시뮬레이터 페이지 HTML과, 그
진입점에서 `import`로 닿는 JS다. **JS와 인라인 `<script>`는 문자열 리터럴 속만 본다.**
주석 · 식별자 · 코드는 학생 화면에 나오지 않는다. HTML 주석과 `<style>`도 같은 까닭으로
뺀다. 강의노트에만 맞는 규칙은 `LECTURE_ONLY`에 적는다.

`check_verbs.py`와 나뉘는 자리 — 그쪽은 **누르는 것의 이름**을 보고, 이쪽은 **강의노트와
시뮬레이터의 문장**을 본다. 「고르다」는 버튼 이름으로는 물러났지만 문장에서는 그대로 쓴다.

## 톱니 — 정제를 마친 파일만 막는다

목록은 모든 과목을 돌지만 **`is_done()`이 참인 파일에서만 위반으로 친다** — `DONE`에
적힌 강의노트와, 통째로 막는 시뮬레이터다. 2026-09-24에 다섯 과목과 시뮬레이터가 모두
정제를 마쳐 지금은 전체가 막힌다. `DONE`은 새 과목 폴더가 생길 때 그 과목을 정제하는
동안 빼 두는 자리로 남긴다 — 걸린 자리는 `--report`가 작업 목록으로 내놓는다.
**한 번 올린 파일은 되돌아가지 않는다.**

## 목록에 올리는 법

1. **활용형 정규식**을 쓴다. 한국어 동사는 어미가 어간과 한 글자로 합쳐져
   (`짚`+`어` → 짚어, `따지`+`어` → **따져**) 어간 접두로는 새어 나간다.
2. **`예`에 실제로 걸려야 할 꼴을 적는다.** 이 파일은 돌 때마다 먼저 자기 목록을 시험해
   `예`가 하나라도 안 걸리면 멈춘다. 「재다」가 금지어였는데도 `재던`·`재라`가 빠져
   일곱 곳이 살아 있던 일을 되풀이하지 않으려는 장치다.
3. **`아님`에 걸리면 안 되는 꼴을 적는다.** 「갈리다」를 막으며 「헷갈리다」를
   잡으면 다음 사람이 목록 자체를 안 믿는다.
4. **넣기 전에 `--report`로 전체를 돌려 오탐이 없는지 본다.**

**설명하려고 막은 말을 적어야 하는 줄에는 `prose: 예시`를 단다.**

## 문체 기준서 — 두 갈래로 막는다

문체 기준서(2026-09-24 사용자 확정)는 CLAUDE.md 「문체 기준서」 절에 있다. 그 가운데
**기계로 고칠 수 있어 저장소 전체를 한 번에 고친 것**은 `STYLE_NOW` · `EMOJI` ·
`quiz_head()`가 곧바로 막는다. **사람이 읽고 고쳐야 하는 것**은 `style_later()`가 보고,
`STYLE_DONE`에 올린 과목에서만 막는다 — 나머지는 `--report`가 과목별 · 규칙별로 센다.
"""
from __future__ import annotations

import re
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from logs import get_logger  # noqa: E402
from subjects import SUBJECTS  # noqa: E402
from extract_prose import prose_text  # noqa: E402
from check_sim_terms import scope  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
SKIP_LINE = "prose: 예시"

# ── 정제를 마친 파일 ─────────────────────────────────────────────────────────
# 글롭. 사용자 확인까지 끝난 것만 올린다.
DONE: list[str] = [
    "데이터과학/*.html",   # 2026-09-24 전 중단원 정제 마감. 사용자 실측은 모든 과목 뒤에 한다
    "인공지능기초/*.html",       # 2026-09-24 Ⅰ~Ⅳ단원 정제 마감
    "인공지능기초/실습/*.html",  # 2026-09-24 실습 보고서 일곱 편 정제 마감
    "정보(고등학교)/*.html",     # 2026-09-24 Ⅰ~Ⅴ단원 정제 마감
    "소프트웨어와생활/*.html",   # 2026-09-24 Ⅰ~Ⅴ단원 정제 마감
    # 프로그래밍은 하위 폴더가 넷이다. Path.match 의 * 는 폴더를 건너지 못하므로 따로 적는다.
    "프로그래밍/기초/*.html",    # 2026-09-24 정제 마감
    "프로그래밍/실습/*.html",    # 2026-09-24 정제 마감
    "프로그래밍/c/*.html",       # 2026-09-24 C 01~17 정제 마감
    "프로그래밍/py/*.html",      # 2026-09-24 파이썬 01~15 정제 마감
]


# ── 물러난 말 ────────────────────────────────────────────────────────────────
# (정규식, 쓴 말, 쓸 말, 예 — 걸려야 하는 꼴, 아님 — 걸리면 안 되는 꼴)
# **순우리말 동사는 꼭 필요한 자리가 아니면 한자어 동사로 쓴다**(2026-09-24 사용자 확정).
# 한국 학생에게 교과서 문장으로 읽히는 쪽이 그쪽이다.
H = r"(?<![가-힣])"   # 낱말 첫머리 — 「헷갈리다」 속의 「갈리다」 같은 것을 거른다
VERBS = [
    # 「짚은 · 짚음 · 짚자」는 프로그래밍에서 새어 나간 꼴이다.
    (H + r"짚(?:[다고어었는을으은음자지게기]|습|읍)", "짚다", "파악하다 · 지적하다 · 확인하다",
     ["짚다", "짚어 보면", "짚을 수", "짚고", "짚습니다", "앞서 짚은", "짚음", "짚자"], ["짚신"]),
    (r"뜯어\s?(?:보|봅|봐|봤|볼|본)", "뜯어보다", "분석하다 · 하나씩 살펴보다",
     ["뜯어봅시다", "뜯어 보면", "뜯어본"], []),
    (r"펼(?:치|쳐|쳤|칠|친|침)|" + H + r"(?:펴[다고서며면]|폈)", "펼치다 · 펴다", "확장하다 · 전개하다 · 나열하다",  # verbs: 예시
     ["펼쳤지만", "넓게 펼쳤다가", "한 줄로 펴면", "폈다"], ["살펴보다", "살펴서"]),  # verbs: 예시
    (r"들여다\s?(?:보|봅|봐|봤|볼|본)", "들여다보다", "살펴보다",
     ["들여다봅시다", "들여다보면", "들여다 봐야"], []),
    (H + r"손(?:보[다고는며면아았야지기]|봅|봐|봤|볼 |본 )", "손보다", "정리하다 · 점검하다 · 수정하다",
     ["손보는 일", "미리 손봅니다", "손봐야"], ["손 보호"]),
    # 「따지지 않」은 시뮬레이터에서 새어 나간 꼴이다.
    (H + r"따(?:지[다고는며면자지]|져|졌|질 |진 |집)", "따지다", "비교하다 · 검토하다",
     ["따져 볼", "따지면", "따집니다", "순서를 따지지 않고"], ["따지막"]),
    # 「솎다 · 돌리다(실행) · 뒤지지 않고」는 시뮬레이터 정제(2026-09-24)에서 물러났다.
    (H + r"솎(?:[다고는아았을으지기]|습)", "솎다", "건너뛰다 · 제외하다",
     ["가지를 솎아 내면", "솎는다", "솎습니다"], []),
    # 실행의 뜻만 막는다 — 「되돌리다 · 돌려주다 · 돌려보내다 · 눈을 돌리다 · ~문제로
    # 돌리다(귀속) · 모터를 돌리다(회전) · 설문지를 돌리다(배부) · 원형 큐의 인덱스를
    # 돌리다(회전)」는 다른 말이다. 앞말로 가르는 것은 그 뜻이 실제로 쓰인 자리다.
    (H + r"(?<!눈을 )(?<!고개를 )(?<!문제로 )(?<!탓으로 )(?<!모터를 )(?<!장치를 )(?<!설문지를 )"
     r"(?<!발전을 )(?<!함께 )(?<!미리 )(?<!칸 )(?<!자리를 )(?<!인덱스를 )(?<!인덱스만 )"
     r"(?<!방향을 )돌(?:리(?![라])|린|릴|립|려(?!\s?(?:주|줄|준|줍|줘|줬|받|보[내낸냈낼냅]|놓|놨|지|진)))",
     "돌리다(실행)", "실행하다",
     ["한 번 돌려서", "돌려 보면", "직접 돌려봅시다", "돌리면", "다시 돌려도",  # verbs: 예시
      "돌린 결과", "돌릴 때마다", "다시 돌려 비교", "여러 번 돌린다", "돌립니다", "돌리기 전에"],  # verbs: 예시
     ["되돌려서", "돌려주는", "돌려줄", "돌려받은", "눈을 돌려 보면", "돌려보내다", "돌려보낸",  # verbs: 예시
      "돌려보냅니다", "모터를 돌린다", "의지 문제로 돌리면", "설문지를 돌리고",  # verbs: 예시
      "인덱스를 돌려 쓰면", "자동으로 돌려지지는"]),  # verbs: 예시
    (r"뒤져서|뒤져\s?(?:보|찾)|뒤지지\s?않(?!는)", "뒤지다", "찾아보다 · 탐색하다",
     ["뒤져서 찾아봄", "뒤져 보면", "전부 뒤지지 않고"], ["뒤지지 않는"]),
    (r"뽑아\s?(?:내|낸|냈|낼|냅)", "뽑아내다", "추출하다 · 추리다",
     ["뽑아내며", "뽑아 낸"], []),
    (r"흉내\s?(?:내|낸|냈|낼|냅)", "흉내 내다", "따라 하다 · 활용하다",
     ["흉내 내면", "흉내낸"], []),
    (r"밀어\s?올(?:리|린|렸|릴|립|려)", "밀어 올리다", "높이다 · 증가시키다",
     ["밀어 올린", "밀어올렸다"], []),
    # 「갈린다 · 갈릴까」는 인공지능기초에서 새어 나간 꼴이다. 「갈릴레이」는 사람 이름이다.
    (H + r"갈(?:리[는고며면지다]|린|렸|릴(?!레)|립)", "갈리다", "구분되다 · 나뉘다",
     ["갈리는 지점", "갈립니다", "갈린 ", "답이 갈린다", "왜 갈릴까"],
     ["헷갈리는", "헷갈립니다", "갈릴레이"]),
    # 「가릅니다 · 갈랐 · 갈라 보기」는 소프트웨어와생활에서 새어 나간 꼴이다.
    # 「갈라 내다 · 갈라 놓다 · 갈라 두다」는 프로그래밍·정보에서 새어 나간 꼴이다.
    # 「갈라 처리 · 갈라야 · 갈라서」처럼 뒤에 무엇이 붙든 「갈라」 꼴은 전부 막는다.
    # 자동사 「갈라지다」도 함께 물러났다(→ 나뉘다). 「갈라파고스 · 갈라쇼」는 다른 낱말이다.
    (H + r"(?:갈라(?!파고스|쇼)|가른|가를|가르[는고며면기]|가릅|갈랐)",
     "가르다 · 갈라지다", "구분하다 · 나누다 · 나뉘다",
     ["갈라 줍니다", "가르는 기준", "가른다", "가릅니다", "무엇이 갈랐을까", "갈라 보기",
      "승부를 가른 것", "둘을 가를 때",
      "갈라 낼 수", "갈라놓을 수", "갈라 놓는 일", "갈라 두었기",
      "갈라 처리한다", "갈라야 한다", "갈라 적은", "갈라서", "갈라지는", "갈라졌다", "갈라집니다", "재질별로 가르기"],
     ["가르치는", "가르쳐", "갈라파고스", "갈라쇼", "여러 갈래"]),
    (H + r"(?:가릴\s?수|가리기(?!\s?때문)|가려\s?(?:내|낸|낼|냅|보(?!이)|봅|봐|봤|볼|본))", "가리다(구별)", "구별하다 · 판단하다",
     ["가릴 수 있을까", "가려낸다", "가려 보는 것", "가려봅시다", "넘겼는지 가리기"], ["가려진", "가리키는", "가려 보이지", "가리키기", "글자를 가리기 때문"]),
    # 크롤링을 「긁어 오다」로 풀어 썼다 — 교과서와 이어지는 말은 수집이다(소프트웨어와생활 3-1-3).
    (r"긁어\s?(?:오|온|올|와|옵|모으|모아|모은)", "긁어 오다", "수집하다",
     ["긁어 오기", "긁어 온다", "긁어 와서", "긁어 모으기"], ["긁어내다"]),
    (r"이리저리", "이리저리", "여러 방향으로 · 다양하게",
     ["이리저리 살펴보는"], []),
    # 전처리를 파일마다 「다듬는 일」「정리하는 일」로 달리 불렀다 — 한 개념에 한 낱말.
    (H + r"다듬(?:[다고는어었을으지기]|습)", "다듬다", "정리하다 · 손질하다",
     ["다듬는 일", "다듬어야", "다듬습니다"], []),
]

# ── 물러난 틀 ────────────────────────────────────────────────────────────────
# 낱말이 아니라 **문장의 모양**이다. 사람이 쓴 글에 드물고 생성된 글에 흔한 것만 올린다.
PATTERNS = [
    (r"[이가] 곧 [가-힣 ]{1,15}입니다", "「A가 곧 B입니다」 격언투",
     "사실을 평서문으로 적는다", ["이름이 곧 설명입니다", "이유가 곧 실력입니다"], []),
    # 「~의 정체입니다 · 남는 장사 · 헤쳐모여 · 타보기」는 시뮬레이터 정제(2026-09-24)에서 물러났다.
    (r"의 정체(?:입니다|이다|다\.)", "「~의 정체입니다」 격언투", "사실을 평서문으로 적는다",
     ["이것이 과적합의 정체입니다"], ["정체된 도로"]),
    (r"남는\s?장사", "「남는 장사」", "「이득」", ["충분히 남는 장사입니다"], []),
    (r"헤쳐\s?모여", "「헤쳐모여」", "「다시 모으기 · 재배치」", ["헤쳐모여!"], []),
    (H + r"타\s?보기", "「타보기」", "「체험」", ["타보기", "직접 타 보기"], ["데이터 보기"]),
    (r"판단의 열쇠", "「판단의 열쇠」", "판단 기준", ["판단의 열쇠"], []),
    (r"한 걸음 더 들어가", "「한 걸음 더 들어가서」", "빼고 바로 말한다",
     ["한 걸음 더 들어가서"], []),
    (r"흔한 오해\s*&mdash;|흔한 오해\s*—", "「흔한 오해 —」 머리말", "문장으로 풀어 쓴다",
     ["흔한 오해 &mdash;", "흔한 오해 —"], []),
    (r"쉽게 말하면(?:</strong>)?\s*(?:&mdash;|—)", "「쉽게 말하면 —」 머리말", "「예를 들어」로 문장을 잇는다",
     ["<strong>쉽게 말하면</strong> &mdash;", "쉽게 말하면 —"], ["쉽게 말하면 이렇습니다"]),
    (r"잘하는 것</strong>\s*&mdash;|잘하는 것\s*—", "「잘하는 것 —」 머리말", "문장으로 풀어 쓴다",
     ["<strong>잘하는 것</strong> &mdash;", "잘하는 것 —"], []),
    # 「오늘」은 수업 시간을 전제한다. 강의노트는 혼자 읽히기도 하고 차시가 바뀌기도 한다.
    (r"오늘 배운", "「오늘 배운」", "「배운」", ["오늘 배운 내용을 확인해 봅시다"], []),
    # 앞 차시를 가리키는 말(2026-09-24 사용자 확정). 뒤 차시 예고를 막은 까닭과 같다 —
    # 강의노트는 낱개로 읽히고 순서가 바뀌므로, 「앞 시간」은 없는 시간이나 다른 차시를
    # 가리키게 된다. 필요한 개념은 그 자리에서 짧게 다시 말한다.
    # 「소절」은 강의노트 한 편을 가리킨다 — 「앞 소절」은 앞 파일이다(데이터과학 2-2).
    (r"(?:앞|지난|이전)\s?(?:시간|차시|수업|단원|소절)|앞 절에서", "앞 차시 참조",
     "그 자리에서 개념을 다시 말한다",
     ["앞 시간에 배운", "지난 시간", "이전 차시", "앞 절에서 배웠습니다", "앞 단원에서 배운",
      "앞 소절에서 내려받은"],
     ["앞에서 본", "앞 절반"]),
    # 단원 번호로 다른 단원을 가리키는 말, 실습끼리의 차례(소프트웨어와생활에서 새어 나갔다).
    (r"[ⅠⅡⅢⅣⅤ]\s?단원(?:에서|의|과)|앞\s?실습", "앞 단원 참조",
     "그 자리에서 개념을 다시 말한다",
     ["Ⅰ단원에서 배운", "Ⅱ단원의 네 기준", "앞 실습에서는"], ["이 단원에서", "다섯 단원이", "Ⅱ단원 "]),
    # 번호로 다른 강의노트를 가리키는 말(프로그래밍에서 새어 나갔다). 차시 번호 ·
    # 아라비아 숫자 단원 · 「2-1에서」 같은 강의노트 번호는 순서가 바뀌면 다른 파일을 가리킨다.
    (r"(?<![\d\-])\d{1,2}\s?차시(?:의|에서|에|와|과|를|을|로|부터|까지|가|는)", "차시 번호 참조",
     "그 자리에서 개념을 다시 말한다",
     ["01차시의 변수", "04차시에서 본", "3 차시와"], ["차시마다", "이 차시에서", "1-2차시"]),
    (r"(?<![\d가-힣ⅠⅡⅢⅣⅤ])\d\s?단원(?:에서|의|과|을|를|로)", "단원 번호 참조",
     "그 자리에서 개념을 다시 말한다",
     ["3단원에서 배운", "2 단원의"], ["이 단원에서", "다섯 단원의", "Ⅲ단원에서 다시"]),
    (r"(?<![\w.\-/#:])\d-\d(?:-\d)?\s?(?:에서|의\s|장|절|차시)", "강의노트 번호 참조",
     "그 자리에서 개념을 다시 말한다",
     ["2-1에서 본", "1-2의 표", "3-2-6에서"],
     ["6-4의", "x-1의", "2023-2-1에서", "code/1-2.조건.c", "#2-1에서", "10-2에서"]),
    # 「배웠습니다 · 앞에서 배운 대로」는 앞 차시를 전제한다(프로그래밍에서 새어 나갔다).
    # 인공지능이 「배운 대로 답한다」처럼 학습을 말하는 문장은 걸지 않는다.
    (r"배웠(?:습니다|듯이|던|지요|죠)|(?:앞에서|이미|전에|때|에서)\s?배운\s?(?:대로|것처럼|바와)",
     "배운 것 참조", "그 자리에서 개념을 다시 말한다",
     ["이미 배웠습니다", "배웠듯이", "앞에서 배운 대로", "수업에서 배운 것처럼"],
     ["배운 대로 답할 뿐", "배운 내용", "배운 규칙으로"]),
    (r"고치는 값", "「고치는 값」", "「고치는 비용」", ["고치는 값이 커진다"], []),
    # 뒤 차시 예고는 check_html 이 막지만 「다음 소절」은 그 그물을 빠져나갔다(데이터과학 2-1-2).
    (r"다음 소절", "뒤 차시 예고(다음 소절)", "「지금은 ~까지만 씁니다」",
     ["다음 소절에서 처리 방법을 배웁니다"], []),
    # 데이터과학 3-1 에서 새어 나간 예고의 꼴들.
    (r"이 단원 뒤쪽|(?:이어서|다시) 만나게|단원에서 다시 만나", "뒤 차시 예고", "「지금은 ~까지만 씁니다」",
     ["이 단원 뒤쪽에서", "이어서 만나게 됩니다", "Ⅲ단원에서 다시 만나게 됩니다"], ["다시 만나지 않을"]),
    # 「지금까지 배운」은 앞 차시를 전제한다 — 앞 차시 참조 그물을 빠져나갔다(데이터과학 3-2).
    (r"지금까지 배운", "「지금까지 배운」", "배운 내용을 이름으로 말한다",
     ["지금까지 배운 것을 한 번에"], ["지금까지 회귀 모델이"]),
    (r"오늘의 목표", "「오늘의 목표」", "「이 실습의 목표」", ["오늘의 목표"], []),
    # 다른 강의노트로 거는 링크(2026-09-24 사용자 확정). 용어에 건 링크도 앞 차시로 가는
    # 바로가기다 — 순서가 바뀌면 뒤 차시를 가리키고, 글은 링크 없이 읽혀야 한다.
    # 목록(../index.html) · 시뮬레이터(../simulator/) · 바깥 주소는 강의노트가 아니다.
    (r'href="(?!\.\./|https?:|#|/)[^"]+\.html', "다른 강의노트로 가는 링크",
     "링크를 빼고 그 자리에서 뜻을 말한다",
     ['href="3-4-1.연관-분석의-이해.html"'],
     ['href="../index.html"', 'href="../simulator/ai/unsupervised-k-means.html"',
      'href="https://example.com/a.html"', 'href="#quiz"']),
    # 어원 풀이가 같은 틀로 되풀이되었다 — 「한자의 前과 영어의 pre-가 같은 자리에
    # 있습니다」 「preview의 그 pre-입니다」가 파일마다 새로 나왔다.
    (r"같은 자리에 있습니다", "「같은 자리에 있습니다」 어원 틀", "「모두 ~를 뜻합니다」",
     ["pre-가 같은 자리에 있습니다"], []),
    (r"의 그 (?:<strong>)?[A-Za-z]+(?:</strong>)?-?입니다", "「~의 그 X-입니다」 어원 틀",
     "예시는 한 번만, 「~가 그 예입니다」",
     ["preview(미리 보기)의 그 pre-입니다", "의 그 <strong>dependent</strong>입니다"], []),
]

# ── 문체 기준서: 곧바로 막는 것 ──────────────────────────────────────────────
# 문체 기준서(2026-09-24 사용자 확정, CLAUDE.md 「문체 기준서」 절) 가운데 **기계로 고칠 수
# 있어 한 번에 다 고친 것**이다. 과목을 가리지 않고 시뮬레이터 화면 글에도 건다.
STYLE_NOW = [
    # 기준서 2 — 정답 해설은 감탄사 없이 이유부터. 오답 해설은 「맞습니다」로 열지 않는다
    # (「틀린 것은?」 문항에서 오답을 누른 학생이 「맞았다」로 읽는다).
    (r"(?:맞습니다|정확합니다|정답입니다|정답|훌륭합니다|잘했습니다)!", "해설 첫머리 감탄사",
     "감탄사를 빼고 첫 문장에서 이유를 말한다", ["맞습니다!", "정답입니다! 잘 이해했습니다."],
     ["맞습니다.", "정답은 셋입니다!"]),
    (r"checkAnswer\(this,\s*true,\s*'(?:맞습니다|정확합니다|정답입니다|정답)[.!]|"
     r"checkAnswer\(this,\s*true,\s*'[^'.!?]{0,40}!|"
     r"checkAnswer\(this,\s*false,\s*'(?:맞습니다|아쉽습니다|옳습니다|사실입니다|"
     r"(?:맞는|옳은|올바른|바른|정확한) (?:설명|말|내용|진술)입니다)",
     "해설 첫머리 판정", "첫 문장에서 그 선택지의 내용이나 까닭을 말한다",
     ["checkAnswer(this, true, '맞습니다. 표본이", "checkAnswer(this, true, '이것이 알맞지 않습니다! 기기",
      "checkAnswer(this, false, '맞습니다. 그래서", "checkAnswer(this, false, '맞는 설명입니다. 풀링은",
      "checkAnswer(this, false, '옳은 설명입니다."],
     ["checkAnswer(this, true, '표본이 작으면", "checkAnswer(this, true, '정답 없이 묶는다",
      "checkAnswer(this, false, '넣은 이유를 검토하는 것은 올바른 태도입니다."]),
    # 기준서 3 — 인용·강조 부호는 「 」 하나.
    (r"[‘’“”«»]|&[lr][sd]quo;|&[lr]aquo;", "굽은 따옴표 · 겹화살괄호", "「 」",
     ["&lsquo;안다&rsquo;", "“네”", "«자리»"], ["「자리」", "'a'"]),
    # 기준서 12 — 라벨 · 영문 머리표 · 해시태그. 「지어낸 예)」처럼 괄호를 닫는 「예」는 라벨이 아니다.
    # 「예:」「예시:」도 라벨이다. 괄호 속 「(예: …)」는 문장에 덧붙인 것이라 둔다.
    (r"\bVS\b(?!\s?Code)|CHECK-?UP|※|&#8251;|핵심 해석\s*:|(?<![가-힣] )(?<![가-힣])예\)\s*[^\s<]|"
     r"(?<![가-힣A-Za-z(])예(?:시)?\s?:",
     "라벨 · 머리표", "문장으로 풀어 쓰고, 상자 이름은 공통 어휘로",
     ["A VS B", "CHECK-UP", "※ 참고", "<strong>핵심 해석:</strong>", "예) 긴 가래떡", "(예) 분실물",
      "예: 나이, 키", "<strong>예시:</strong> 매점", "로봇 청소기 예시:", 'placeholder="예: 사과"'],
     ["VS Code", "(수업에서 원리를 확인하려고 지어낸 예)", "(수업용 예)</p>", "(예: 로봇 팔, 스피커)",
      "사례: 가", "해 보기: 주제"]),
    (r"(?<![&\w/#\"'])#[가-힣]", "해시태그", "낱말을 가운뎃점으로 잇는다",
     ["#얼굴인식 #음성인식"], ['href="#퀴즈"', "'#결과'", "&#8251;"]),
]

RULES = [(re.compile(p), 쓴, 쓸, 예, 아님) for p, 쓴, 쓸, 예, 아님 in VERBS + PATTERNS + STYLE_NOW]

# 기준서 12의 이모지 — **강의노트에만** 쓴다. 시뮬레이터 화면의 이모지는 지우지 않는다
# (2026-09-24 사용자 확정). 문체 교정이 시뮬레이터의 알림 · 제목에서 이모지를 걷어 냈다가
# 되살렸다 — 시뮬레이터에서 이모지는 라벨이 아니라 화면의 그래픽이다.
EMOJI = re.compile(
    "[\U0001F300-\U0001FAFF✅❌⚠✨✋✂✏⭐❗❓"
    "⏰⌛☕✈❤☀]️?(?:‍[\U0001F300-\U0001FAFF☀-➿]️?)*")
EMOJI_EXAMPLES = (["💡 예", "✏️ 스스로 활동", "🎉 목표 도달"], ["☑ 확인", "✓ 정답", "★", "➔"])


# 기준서 12 — 상자 이름으로 쓴 배지는 그 절의 제목과 같아야 한다(2026-09-24 사용자 확정).
# 퀴즈 절에 「스스로 점검하기」 배지를 달고 제목을 「확인 퀴즈」로 두면 한 머리에 이름이 둘이다.
BADGE_NAMES = ("스스로 점검하기",)
BADGE_HEAD = re.compile(r'<span\b[^>]*\brounded-full\b[^>]*>\s*([^<]*?)\s*</span>\s*<h2\b[^>]*>(.*?)</h2>', re.S)
BADGE_EXAMPLES = (['<span class="rounded-full">스스로 점검하기</span>\n<h2 class="x">확인 퀴즈</h2>'],
                  ['<span class="rounded-full">스스로 점검하기</span>\n<h2 class="x">스스로 점검하기</h2>',
                   '<span class="rounded-full">CHAPTER 1</span>\n<h2>확인 퀴즈</h2>'])


def badge_head(body: str) -> list[tuple[int, str]]:
    return [(m.start(), f"배지 「{m.group(1)}」와 절 제목 「{_plain(m.group(2))}」가 다르다 — 배지를 지우거나 제목을 맞춘다")
            for m in BADGE_HEAD.finditer(body)
            if m.group(1) in BADGE_NAMES and _plain(m.group(2)) != m.group(1)]


def emoji_hits(path: Path, body: str) -> list[tuple[int, str]]:
    if is_sim(path):
        return []
    return [(m.start(), m.group(0)) for m in EMOJI.finditer(body)]


# 기준서 15 — 퀴즈 머리말. 저장소에서 가장 많이 쓴 제목과 부제로 맞춘다(2026-09-24).
# 부제가 없는 퀴즈도 막는다 — 없던 파일에는 그 파일의 제목 줄 모양대로 부제를 넣었다.
QUIZ_TITLE = "확인 퀴즈"
QUIZ_LEAD = "배운 내용을 확인해 봅시다."
QUIZ_HEAD = re.compile(r'(?s)<section\b[^>]*\bid="quiz".*?<h2\b[^>]*>(.*?)</h2>'
                       r'\s*(?:<div\b[^>]*>\s*</div>\s*)?(?:<p\b[^>]*>(.*?)</p>)?')


def _plain(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", s)).strip()


def quiz_head(src: str) -> list[tuple[int, str]]:
    m = QUIZ_HEAD.search(src)
    if not m:
        return []
    bad = []
    if _plain(m.group(1)) != QUIZ_TITLE:
        bad.append((m.start(1), f"퀴즈 제목 「{_plain(m.group(1))}」 — 「{QUIZ_TITLE}」로 쓴다"))
    if m.group(2) is None:
        bad.append((m.start(1), f"퀴즈 부제가 없다 — 제목 아래에 「{QUIZ_LEAD}」를 넣는다"))
    elif _plain(m.group(2)) != QUIZ_LEAD:
        bad.append((m.start(2), f"퀴즈 부제 「{_plain(m.group(2))}」 — 「{QUIZ_LEAD}」로 쓴다"))
    return bad


QUIZ_EXAMPLES = (
    ['<section id="quiz"><h2>퀴즈</h2>', '<section id="quiz"><h2>확인 퀴즈</h2><p>배운 내용을 확인해 봅시다!</p>',
     '<section id="quiz"><h2>확인 퀴즈</h2><div class="grid">'],
    ['<section id="quiz"><h2>확인 퀴즈</h2><div class="w-20"></div><p>배운 내용을 확인해 봅시다.</p>',
     '<section id="quiz"><h2>확인 퀴즈</h2>\n<p class="a">배운 내용을 확인해 봅시다.</p>'])


# 기준서 3 — 학생 글 속의 곧은따옴표(2026-09-24). 코드(<code> · <pre> · 코드의 문자열)와
# 태그의 속성 따옴표는 글이 아니다. 학생이 보는 속성(aria-label · title · alt · placeholder)과
# 퀴즈 해설 문자열은 글로 본다. 글 토막(블록 태그 · 스크립트 줄) 안에서 따옴표를 차례로
# 짝짓고, 한글이 든 짝만 잡는다 — 「S'」 같은 프라임이나 영어 코드 조각은 비켜 간다.
Q_CODE = re.compile(r"(?s)<(code|pre|kbd|samp|script|style|svg|math)\b.*?</\1>|<!--.*?-->")
Q_TAG = re.compile(r"<[^>]*>")
Q_ATTR = re.compile(r'\b(?:aria-label|title|alt|placeholder)="([^"]*)"')
Q_EXPL = re.compile(r"checkAnswer\(this,\s*(?:true|false),\s*'((?:[^'\\]|\\.)*)'")
Q_BLOCK = re.compile(r"</?(?:p|li|h[1-6]|td|th|div|button|label|option|section|ul|ol|table|tr)\b[^>]*>")


def _blank(s: str) -> str:
    return re.sub(r"[^\n]", " ", s)


def _quote_body(path: Path, src: str) -> str:
    """학생 글만 남긴 원문 — 길이와 자리가 원문과 같다."""
    if path.suffix == ".js":
        return Q_TAG.sub(lambda m: _blank(m.group(0)), js_strings(src))

    def tag(m):
        t = m.group(0)
        keep = [" "] * len(t)
        for rx in (Q_ATTR, Q_EXPL):
            for a in rx.finditer(t):
                keep[a.start(1):a.end(1)] = t[a.start(1):a.end(1)]
        return "".join(keep).replace("&quot;", "      ")

    s = Q_TAG.sub(tag, Q_CODE.sub(lambda m: _blank(m.group(0)), src))
    if is_sim(path):
        for m in SCRIPT.finditer(src):
            js = Q_TAG.sub(lambda t: _blank(t.group(0)), js_strings(m.group(2)))
            s = s[:m.start(2)] + js + s[m.end(2):]
    return s


def straight_quotes(path: Path, src: str) -> list[tuple[int, str]]:
    body = _quote_body(path, src)
    cuts = {m.start() for m in Q_BLOCK.finditer(src)} | {0, len(src)}
    scripts = [(0, len(src))] if path.suffix == ".js" else [m.span(2) for m in SCRIPT.finditer(src)]
    for a, b in scripts:
        cuts |= {a + i for i, c in enumerate(src[a:b]) if c == "\n"}
    cuts = sorted(cuts)
    out = []
    for a0, b0 in zip(cuts, cuts[1:]):
        seg = body[a0:b0]
        for qc in "'\"":
            pos = [a0 + i for i, c in enumerate(seg) if c == qc
                   and not (i and seg[i - 1] in "=\\")
                   and not (0 < i < len(seg) - 1 and seg[i - 1].isascii() and seg[i - 1].isalpha()
                            and seg[i + 1].isascii() and seg[i + 1].isalpha())]
            if len(pos) % 2:
                continue
            for a, b in zip(pos[::2], pos[1::2]):
                if re.search("[가-힣]", body[a:b]) and b - a < 200:
                    out.append((a, re.sub(r"\s+", " ", src[a:b + 1])))
    return out


# ── 문체 기준서: 정제를 마친 과목부터 막는 것 ─────────────────────────────────
# 사람이 읽고 고쳐야 하는 규칙이다. `STYLE_DONE`에 올린 과목에서만 위반으로 치고, 나머지는
# `--report`가 과목별 작업 목록으로 센다. **강의노트에만 건다.** 톱니는 `DONE`과 같다 —
# 사용자 확인이 끝난 것만 올리고, 한 번 올린 것은 되돌리지 않는다.
STYLE_DONE: list[str] = [
    # 2026-09-25 인공지능기초 문체 정제 마감
    "인공지능기초/*.html",
    "인공지능기초/실습/*.html",
    # 2026-09-25 데이터과학 문체 정제 마감
    "데이터과학/*.html",
]

P_BLOCK = re.compile(r"(?s)<p\b[^>]*>(.*?)</p>")
SECTION = re.compile(r"(?s)<section\b.*?</section>")
DASH = re.compile(r"—|&mdash;")
BOLD = re.compile(r"<(?:strong|b)\b")
VERDICT = re.compile(r"(?:[이가] (?:요점|핵심|열쇠|요령)입니다|그것이 [^.]{1,30} 점입니다)\.?\s*$")
SEAT = re.compile(r"이 자리의|바로 이 자리|자리가 바로")
LIST_AND = re.compile(r"(?:[^,.<>]{1,15},\s+){2,}[^,.<>]{1,15}\s등의\s[^.]{0,40}?하여\s[^.]{0,80}?다\.")
REREAD = re.compile(r"다시 읽어|가리고 [가-힣 ]{0,10}(?:적어|써)|위 (?:설명|내용)을 다시")
AI_BOX = re.compile(r"AI와 함께 정리")


def _text(s: str) -> str:
    from extract_prose import unescape
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", "", s))).strip()


# 기준서 5의 볼드는 **본문 문단만** 센다(2026-09-24 사용자 확정). 퀴즈 · 표 · 카드(핵심 정리 ·
# 상자) · 「스스로 확인」 밴드 안의 볼드는 뺀다. 상자는 배경이나 테두리를 가진 요소로 가른다 —
# 절을 싸는 `section-card`만은 본문 바탕이라 상자가 아니다.
VOID = {"br", "hr", "img", "input", "meta", "link", "source", "wbr", "area", "col", "path",
        "circle", "rect", "line", "polyline", "polygon", "ellipse", "stop", "use"}
BOX_CLASS = re.compile(r"(?:^|\s)(?:bg-|border(?:\s|-|$)|rounded|shadow)")
TAG_TOKEN = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9]*)\b([^>]*?)(/?)>")


def box_spans(body: str) -> list[tuple[int, int]]:
    """본문이 아닌 요소의 (시작, 끝)."""
    spans, stack = [], []
    for m in TAG_TOKEN.finditer(body):
        close, name, attrs, selfclose = m.group(1), m.group(2).lower(), m.group(3), m.group(4)
        if name in VOID or selfclose:
            continue
        if not close:
            cls = re.search(r'\bclass="([^"]*)"', attrs)
            cls = cls.group(1) if cls else ""
            box = (name in ("table", "button") or 'id="quiz"' in attrs
                   or (name != "section" and "section-card" not in cls and bool(BOX_CLASS.search(cls))))
            stack.append((name, m.start(), box))
            continue
        # 닫는 태그 — 짝이 맞는 가장 가까운 여는 태그까지 걷어 낸다(어긋난 HTML에도 버틴다)
        for k in range(len(stack) - 1, -1, -1):
            if stack[k][0] == name:
                _, start, box = stack[k]
                del stack[k:]
                if box or (name == "section" and "checkAnswer" in body[start:m.end()]):
                    spans.append((start, m.end()))
                break
    return spans


def style_later(body: str) -> list[tuple[int, str, str]]:
    """(자리, 규칙, 알림). 문단 · 절의 경계는 HTML 구조(<p>, <section>)로 가른다."""
    out = []
    boxes = box_spans(body)

    def in_box(pos: int) -> bool:
        return any(a <= pos < b for a, b in boxes)

    prose_p = []
    for m in P_BLOCK.finditer(body):
        inner, text = m.group(1), _text(m.group(1))
        if len(DASH.findall(inner)) >= 2:
            out.append((m.start(), "4 줄표", "한 문단에 줄표가 둘 이상 — 한 번까지 쓴다"))
        if not in_box(m.start()):
            prose_p.append((m.start(), len(BOLD.findall(inner))))
            if prose_p[-1][1] >= 2:
                out.append((m.start(), "5 볼드", "한 문단에 볼드가 둘 이상 — 한 구절만"))
        if VERDICT.search(text):
            out.append((m.start(), "7 판정문", "문단을 판정문으로 닫았다 — 요점은 첫 문장에"))
    for m in SECTION.finditer(body):
        if sum(n for pos, n in prose_p if m.start() <= pos < m.end()) > 3:
            out.append((m.start(), "5 볼드", "한 절의 본문 문단에 볼드가 셋을 넘는다"))
    for m in SEAT.finditer(body):
        out.append((m.start(), "6 자리", f"「{m.group(0)}」 — 단계 · 역할 · 대목이면 그 낱말로"))
    for m in LIST_AND.finditer(_strip_keep(body)):
        out.append((m.start(), "8 나열", "명사 셋 나열 + 「등의 …하여」 — 구체적 예 하나로"))
    for m in re.finditer(r"스스로 확인", body):
        end = body.find("</section>", m.end())
        seg = body[m.end():end if end > 0 else m.end() + 2000]
        for r in REREAD.finditer(_strip_keep(seg)):
            out.append((m.end() + r.start(), "9 되읽기", f"「스스로 확인」에 되읽기 지시 「{r.group(0)}」 — 새 상황 하나로"))
    for m in AI_BOX.finditer(body):
        out.append((m.start(), "11 AI 정리", "「AI와 함께 정리하기」 — 「핵심 정리」에 흡수하고 지운다"))
    return out


def _strip_keep(s: str) -> str:
    """태그를 같은 길이의 공백으로 지운다 — 자리가 원문과 맞도록."""
    return re.sub(r"<[^>]+>", lambda m: " " * len(m.group(0)), s)


STYLE_LATER_EXAMPLES = [
    ("<p>가 — 나 — 다</p>", "4 줄표"), ("<p><strong>가</strong>와 <b>나</b></p>", "5 볼드"),
    ("<p>그래서 이것이 핵심입니다.</p>", "7 판정문"), ("<p>바로 이 자리에서</p>", "6 자리"),
    ("<p>나이, 성별, 지역 등의 자료를 분석하여 예측합니다.</p>", "8 나열"),
    ('스스로 확인</p><p>위 설명을 다시 읽어 보세요.</p></section>', "9 되읽기"),
    ("<h2>AI와 함께 정리하기</h2>", "11 AI 정리"),
]
STYLE_LATER_NOT = ["<p>가 — 나</p>", "<p><strong>가</strong>입니다</p>", "<p>핵심은 이렇습니다. 그래서 씁니다.</p>",
                   "<p>빈 자리에 놓습니다</p>",
                   '<div class="bg-sky-50 p-4"><p><strong>가</strong>와 <b>나</b></p></div>',
                   '<table><tr><td><p><strong>가</strong><b>나</b></p></td></tr></table>',
                   '<section id="quiz"><p><strong>가</strong><b>나</b></p></section>']

# 강의노트에만 거는 규칙(쓴 말로 가리킨다). 시뮬레이터는 강의노트가 아니므로 다른
# 시뮬레이터 페이지로 거는 링크가 앞 차시 바로가기가 되지 않는다. 나머지 규칙은
# 둘 다에 건다 — 같은 기준으로 막아야 강의노트와 시뮬레이터의 말이 갈라지지 않는다.
LECTURE_ONLY = {"다른 강의노트로 가는 링크"}


def self_test() -> list[str]:
    """목록의 정규식이 제 예시를 잡는지, 잡으면 안 되는 것을 비껴가는지."""
    errs = []
    for pat, 쓴, _, 예, 아님 in RULES:
        errs += [f"「{쓴}」이 「{e}」를 못 잡는다" for e in 예 if not pat.search(e)]
        errs += [f"「{쓴}」이 「{e}」를 잘못 잡는다" for e in 아님 if pat.search(e)]
    예, 아님 = EMOJI_EXAMPLES
    errs += [f"이모지가 「{e}」를 못 잡는다" for e in 예 if not EMOJI.search(e)]
    errs += [f"이모지가 「{e}」를 잘못 잡는다" for e in 아님 if EMOJI.search(e)]
    errs += [f"배지 검사가 「{e}」를 못 잡는다" for e in BADGE_EXAMPLES[0] if not badge_head(e)]
    errs += [f"배지 검사가 「{e}」를 잘못 잡는다" for e in BADGE_EXAMPLES[1] if badge_head(e)]
    예, 아님 = QUIZ_EXAMPLES
    errs += [f"퀴즈 머리말이 「{e}」를 못 잡는다" for e in 예 if not quiz_head(e)]
    errs += [f"퀴즈 머리말이 「{e}」를 잘못 잡는다" for e in 아님 if quiz_head(e)]
    here = ROOT / "tools" / "check_prose.html"   # 가짜 경로 — 강의노트 HTML로 다룬다
    for e in ["<p>인공지능은 '학습'을 합니다.</p>", '<p>"이게 탐색이랑 무슨 상관이지?"</p>',
              "<button aria-label=\"'시작' 버튼\">"]:
        if not straight_quotes(here, e):
            errs.append(f"곧은따옴표가 「{e}」를 못 잡는다")
    for e in ["<p><code>print('안녕')</code></p>", '<p class="a">위치(S\') 정보</p>',
              '<button onclick="checkAnswer(this, true, \'&quot;점수: &quot;는 글자\')">']:
        if straight_quotes(here, e):
            errs.append(f"곧은따옴표가 「{e}」를 잘못 잡는다")
    for e, rule in STYLE_LATER_EXAMPLES:
        if rule not in {r for _, r, _ in style_later(e)}:
            errs.append(f"문체 「{rule}」이 「{e}」를 못 잡는다")
    errs += [f"문체 규칙이 「{e}」를 잘못 잡는다" for e in STYLE_LATER_NOT if style_later(e)]
    return errs


def _line_of(src: str, pos: int) -> int:
    return src.count("\n", 0, pos) + 1


# ── 스크립트에서 학생이 보는 글만 남기기 ────────────────────────────────────────
# 시뮬레이터의 글은 거의 전부 문자열 리터럴 안에 있다. **주석 · 식별자 · 코드는 보지
# 않는다** — 개발 주석은 학생에게 보이지 않고, 거기 적힌 옛말은 check_sim_terms 몫이다.
# 문자열 밖은 공백으로 지우되 줄바꿈은 남겨 위반을 원래 파일의 줄 번호로 짚는다.
# 정규식 한 줄로 자르면 템플릿 안의 `${ … `…` … }`나 정규식 리터럴 속 따옴표(/'/)에서
# 문자열 경계를 잃고, 그 뒤의 주석이 통째로 문자열로 읽힌다. 그래서 손으로 한 글자씩 돈다.
SCRIPT = re.compile(r"(?s)(<script\b[^>]*>)(.*?)(</script>)")
# 이 글자 뒤의 `/`는 나눗셈이 아니라 정규식 리터럴의 시작이다.
REGEX_BEFORE = set("(,=:[!&|?{};+-*%<>~^")
REGEX_KEYWORDS = ("return", "typeof", "case", "in", "of", "delete", "void", "throw")


def js_strings(src: str) -> str:
    """문자열 리터럴의 속만 남기고 나머지는 공백으로 — 줄바꿈은 그대로."""
    out = [c if c == "\n" else " " for c in src]
    n, i = len(src), 0
    # 템플릿 안의 `${`에 들어가면 그 깊이의 중괄호 수를 쌓아 둔다.
    stack: list[int] = []

    def prev_sig(k: int) -> str:
        k -= 1
        while k >= 0 and src[k] in " \t\r\n":
            k -= 1
        return src[k] if k >= 0 else ""

    def keyword_before(k: int) -> bool:
        m = re.search(r"([A-Za-z_$]+)\s*$", src[max(0, k - 12):k])
        return bool(m) and m.group(1) in REGEX_KEYWORDS

    def template(k: int) -> int:
        """`k`는 여는 ` 다음. 닫는 ` 다음 자리를 돌려준다(`${`를 만나면 코드로 돌아간다)."""
        while k < n:
            c = src[k]
            if c == "\\":
                out[k] = src[k]
                if k + 1 < n:
                    out[k + 1] = src[k + 1]
                k += 2
            elif c == "`":
                return k + 1
            elif c == "$" and src.startswith("${", k):
                stack.append(0)
                return -(k + 2)          # 음수 — 코드로 돌아가라는 뜻
            else:
                out[k] = c
                k += 1
        return n

    while i < n:
        c = src[i]
        if src.startswith("//", i):
            j = src.find("\n", i)
            i = n if j < 0 else j
        elif src.startswith("/*", i):
            j = src.find("*/", i + 2)
            i = n if j < 0 else j + 2
        elif c in "\"'":
            j = i + 1
            while j < n and src[j] != c and src[j] != "\n":
                j += 2 if src[j] == "\\" else 1
            for k in range(i + 1, min(j, n)):
                out[k] = src[k]
            i = j + 1
        elif c == "`":
            r = template(i + 1)
            i = -r if r < 0 else r
        elif c == "{" and stack:
            stack[-1] += 1
            i += 1
        elif c == "}" and stack:
            if stack[-1] == 0:
                stack.pop()
                r = template(i + 1)       # `${ … }`가 닫히면 템플릿 글로 돌아간다
                i = -r if r < 0 else r
            else:
                stack[-1] -= 1
                i += 1
        elif c == "/" and (prev_sig(i) in REGEX_BEFORE or prev_sig(i) == "" or keyword_before(i)):
            j, cls = i + 1, False        # 정규식 리터럴 — 글이 아니므로 건너뛴다
            while j < n and src[j] != "\n":
                if src[j] == "\\":
                    j += 2
                    continue
                if src[j] == "[":
                    cls = True
                elif src[j] == "]":
                    cls = False
                elif src[j] == "/" and not cls:
                    break
                j += 1
            i = j + 1
        else:
            i += 1
    return "".join(out)


HIDDEN = re.compile(r"(?s)<!--.*?-->|<style\b.*?</style>")


def html_with_script_strings(src: str) -> str:
    """HTML은 태그째 두되 인라인 `<script>`는 문자열 리터럴로 줄이고, 주석과
    `<style>`은 지운다 — 학생 화면에 나오지 않는 글이다."""
    src = HIDDEN.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), src)
    return SCRIPT.sub(lambda m: m.group(1) + js_strings(m.group(2)) + m.group(3), src)


def visible_text(path: Path, src: str) -> str:
    """학생 화면에 나오는 글만 남긴 원문 — 길이와 줄이 원문과 같다(고치는 스크립트도 쓴다)."""
    return js_strings(src) if path.suffix == ".js" else html_with_script_strings(src)


def check(path: Path, sim: bool = False) -> list[tuple[int, str]]:
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    # 태그나 개체(&nbsp;)가 낱말을 끊으면(「갈라</strong> 준다」) 원문으로는 못 잡는다.
    # 본문도 함께 본다. 무엇이 본문인지는 extract_prose 가 정한다 — 두 도구가
    # 서로 다른 본문을 보면 추출해 읽은 것과 검사한 것이 어긋난다.
    # 원문 패스는 남긴다 — 링크 규칙처럼 태그 속을 봐야 하는 규칙이 있다.
    if path.suffix == ".js":
        bodies = (js_strings(src),)
    else:
        # prose_text 는 <script>를 통째로 버린다. 인라인 스크립트의 글은 원문 패스가 본다.
        bodies = (html_with_script_strings(src), prose_text(src))
    bad = set()

    def add(body: str, pos: int, msg: str) -> None:
        n = _line_of(body, pos)
        if SKIP_LINE not in lines[n - 1]:
            bad.add((n, msg))

    for pat, 쓴, 쓸, _, _ in RULES:
        if sim and 쓴 in LECTURE_ONLY:
            continue
        for body in bodies:
            for m in pat.finditer(body):
                add(body, m.start(), f"「{m.group(0)}」({쓴}) — 「{쓸}」로 쓴다")
    for pos, e in emoji_hits(path, bodies[0]):
        # 퀴즈 알림의 ✅/❌ 는 글이 아니라 정답·오답 표시다. 감탄사를 뺀 뒤로는 이것이
        # 알림에 남은 유일한 표지라 지우면 맞혔는지 알 수 없다(2026-09-24 되살림).
        if "showToast(" in lines[_line_of(bodies[0], pos) - 1]:
            continue
        add(bodies[0], pos, f"「{e}」(이모지) — 지우고 문장으로 쓴다")
    for pos, msg in badge_head(bodies[0]):
        add(bodies[0], pos, msg)
    for pos, e in straight_quotes(path, src):
        add(src, pos, f"{e}(곧은따옴표) — 「 」로 쓴다")
    if not sim:
        for pos, msg in quiz_head(bodies[0]):
            add(bodies[0], pos, msg)
    return sorted(bad)


def check_later(path: Path) -> list[tuple[int, str, str]]:
    """정제를 마친 과목부터 막는 문체 규칙 — (줄, 규칙, 알림)."""
    src = path.read_text(encoding="utf-8")
    lines = src.splitlines()
    body = html_with_script_strings(src)
    out = set()
    for pos, rule, msg in style_later(body):
        n = _line_of(body, pos)
        if SKIP_LINE not in lines[n - 1]:
            out.add((n, rule, msg))
    return sorted(out)


def is_style_done(path: Path) -> bool:
    rel = path.resolve().relative_to(ROOT).as_posix()
    return any(Path(rel).match(g) for g in STYLE_DONE)


def lecture_notes() -> list[Path]:
    return [p for s in SUBJECTS for p in sorted((ROOT / s["dir"]).rglob("*.html"))]


def simulators() -> list[Path]:
    """시뮬레이터 페이지 HTML과 그 진입점에서 import 로 닿는 JS.

    범위는 check_sim_terms 가 정한 것을 그대로 쓴다 — 두 검사가 다른 범위를 보면
    용어는 막히고 문장은 새는 자리가 생긴다. 새 시뮬레이터는 저절로 딸려 온다.
    """
    return scope()


def is_sim(path: Path) -> bool:
    rel = path.resolve().relative_to(ROOT).as_posix()
    return rel.startswith(("simulator/", "src/"))


def is_done(path: Path) -> bool:
    # 시뮬레이터는 전부 정제를 마쳤다(2026-09-24). 범위가 import 그래프라 글롭으로
    # 적을 수 없으므로 DONE 에 올리지 않고 통째로 막는다.
    if is_sim(path):
        return True
    rel = path.resolve().relative_to(ROOT).as_posix()
    return any(Path(rel).match(g) for g in DONE)


def main() -> int:
    argv = sys.argv[1:]
    report = "--report" in argv
    args = [a for a in argv if a not in ("-v", "--verbose", "--report")]
    log = get_logger("check_prose", len(args) != len(argv) - report or bool(args))

    errs = self_test()
    for e in errs:
        log.error("목록 자체가 틀렸다 — %s", e)
    if errs:
        return 2

    # 짚은 파일은 정제 중인 것이므로 DONE 이 아니어도 막는다.
    files = [Path(a).resolve() for a in args] if args else lecture_notes() + simulators()
    total, pending = 0, Counter()
    style_pending: dict[str, Counter] = {}
    for f in files:
        bad = check(f, is_sim(f))
        shown = f.relative_to(ROOT).as_posix()
        if args or is_done(f):
            for n, msg in bad:
                log.error("%s:%d %s", shown, n, msg)
            total += len(bad)
        else:
            pending[shown.split("/")[0]] += len(bad)
            if report:
                for n, msg in bad:
                    log.warning("%s:%d %s", shown, n, msg)
        if is_sim(f) or f.suffix != ".html":
            continue
        later = check_later(f)
        if args or is_style_done(f):
            for n, _, msg in later:
                log.error("%s:%d 문체 — %s", shown, n, msg)
            total += len(later)
        else:
            c = style_pending.setdefault(shown.split("/")[0], Counter())
            c.update(rule for _, rule, _ in later)

    남은 = ", ".join(f"{k} {v}" for k, v in pending.most_common()) or "없음"
    log.info("완료 — 파일 %d, 위반 %d, 정제 전 자리 %s", len(files), total, 남은)
    if report:
        # 문체 기준서의 사람 몫 — STYLE_DONE 에 올리기 전 과목의 남은 자리를 규칙별로 센다.
        for subj, c in sorted(style_pending.items(), key=lambda kv: -sum(kv[1].values())):
            by_rule = ", ".join(f"{r} {v}" for r, v in sorted(c.items()))
            log.info("문체 정제 전 — %s %d (%s)", subj, sum(c.values()), by_rule or "없음")
    return 1 if total and not report else 0


if __name__ == "__main__":
    sys.exit(main())
