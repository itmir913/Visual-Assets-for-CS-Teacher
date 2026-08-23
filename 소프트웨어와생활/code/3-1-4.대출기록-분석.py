# 도서관 대출 기록을 읽어 다듬고, 학년별과 달별로 묶어 세어 본다.
# 같은 폴더의 3-1-4.도서관-대출기록.csv 를 읽는다.
#
# 이 파일의 값은 수업에서 원리를 확인하려고 지어낸 것이다.

from pathlib import Path
import pandas as pd

HERE = Path(__file__).parent
FILE = HERE / "3-1-4.도서관-대출기록.csv"


# region: 읽기
표 = pd.read_csv(FILE)

print("줄 수:", len(표))
print("칸 이름:", list(표.columns))
print(표.head())
# endregion


# region: 다듬기
print("처음:", len(표))

표 = 표.dropna(subset=["학년"])            # 학년이 빈 줄을 뺀다
print("빈칸 뺀 뒤:", len(표))

표 = 표[표["권수"] <= 20]                   # 하루에 20권을 넘을 수는 없다고 보았다
print("튄 값 뺀 뒤:", len(표))

표 = 표.drop_duplicates()                   # 똑같은 줄이 두 번 들어간 것을 하나로
print("겹친 줄 뺀 뒤:", len(표))

표["학년"] = 표["학년"].astype(int)         # 빈칸을 뺐으니 이제 정수로 다룰 수 있다
# endregion


# region: 학년별
학년별 = 표.groupby("학년")["권수"].agg(["count", "mean", "max"]).round(2)
print(학년별)
# endregion


# region: 달별
표["달"] = 표["날짜"].str[5:7]
달별 = 표.groupby("달")["권수"].sum()
print(달별)
# endregion
