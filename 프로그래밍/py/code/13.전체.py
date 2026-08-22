# ---
# check: none
# ---
rows = []
with open("성적.csv", "r", encoding="utf-8") as f:
    rows = [line.strip().split(",") for line in f]

for row in rows:
    name = row[0]
    scores = [int(v) for v in row[1:]]
    print(f"{name}: 평균 {round(sum(scores) / len(scores), 1)}")
# 학생 A: 평균 77.5
# 학생 B: 평균 82.5
