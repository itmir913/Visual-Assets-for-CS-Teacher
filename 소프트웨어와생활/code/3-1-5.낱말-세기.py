# 독서 감상문 여러 편에서 자주 나온 낱말을 세어 본다.
# 같은 폴더의 3-1-5.감상문.txt 를 읽는다.
#
# 이 파일의 감상문은 수업용으로 지어낸 글이다.

from pathlib import Path
from collections import Counter
import re

HERE = Path(__file__).parent
FILE = HERE / "3-1-5.감상문.txt"

# 뜻을 크게 담지 않으면서 자주 나오는 말. 세기 전에 걸러 낸다.
STOPWORDS = {
    "이", "그", "저", "것", "수", "등", "때", "더", "잘", "안", "못",
    "나", "너", "우리", "나도", "내", "이런", "그런", "저런",
    "있다", "없다", "하다", "되다", "같다", "이다",
    "그리고", "그런데", "그래서", "하지만", "그래도", "다시", "정말",
    "학생",
}

# 뒤에 붙어 낱말을 다르게 보이게 만드는 조사. 짧은 것을 나중에 떼야 한다.
JOSA = ("에서는", "으로는", "에게서", "이라고", "라고", "에서", "으로",
        "에게", "부터", "까지", "처럼", "보다", "만큼", "이나",
        "은", "는", "이", "가", "을", "를", "의", "에", "도", "와", "과", "로")


# region: 읽기
글 = FILE.read_text(encoding="utf-8")
print("글자 수:", len(글))
print("줄 수:", len(글.strip().split("\n")))
# endregion


# region: 자르기
글 = re.sub(r"[^가-힣\s]", " ", 글)     # 한글과 띄어쓰기만 남긴다
낱말들 = 글.split()
print("자른 낱말 수:", len(낱말들))
print("서로 다른 낱말 수:", len(set(낱말들)))
# endregion


# region: 조사떼기
def 조사_떼기(낱말):
    """낱말 뒤에 붙은 조사를 하나만 떼어 낸다.

    긴 조사부터 살펴야 한다. 「에서」를 먼저 보지 않으면
    「바다에서」가 「바다에」로만 줄어든다.
    """
    for 꼬리 in JOSA:
        if len(낱말) > len(꼬리) + 1 and 낱말.endswith(꼬리):
            return 낱말[: -len(꼬리)]
    return 낱말


낱말들 = [조사_떼기(w) for w in 낱말들]
낱말들 = [w for w in 낱말들 if len(w) >= 2 and w not in STOPWORDS]
print("걸러 낸 뒤 낱말 수:", len(낱말들))
# endregion


# region: 세기
센것 = Counter(낱말들)
for 낱말, 횟수 in 센것.most_common(10):
    print(f"{낱말:>6}  {횟수}회  {'█' * 횟수}")
# endregion
