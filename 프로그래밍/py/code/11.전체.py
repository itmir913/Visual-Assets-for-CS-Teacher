# ---
# check: none
# ---
# 성적.csv 한 줄은 「이름,국어,영어」다
table = {}

with open("성적.csv", "r", encoding="utf-8") as f:
    for line in f:
        values = line.strip().split(",")
        name = values[0]
        table[name] = (int(values[1]), int(values[2]))   # 점수 둘을 묶어 담는다

for name, (kor, eng) in table.items():
    print(f"{name}: 국어 {kor}, 영어 {eng}, 평균 {(kor + eng) / 2}")
# 학생 A: 국어 90, 영어 65, 평균 77.5
# 학생 B: 국어 85, 영어 80, 평균 82.5

print(table.get("학생 Z", "없는 학생"))    # 없는 학생
