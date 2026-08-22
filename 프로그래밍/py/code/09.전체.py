# ---
# check: none
# ---
def average(scores):
    return round(sum(scores) / len(scores), 1)

rows = []
with open("성적.csv", "r", encoding="utf-8") as f:
    for line in f:
        rows.append(line.strip().split(","))

with open("평균.csv", "w", encoding="utf-8") as f:
    for row in rows:
        scores = []
        for v in row[1:]:               # 이름 뒤부터가 점수다
            scores.append(int(v))
        f.write(f"{row[0]},{average(scores)}\n")

with open("평균.csv", "r", encoding="utf-8") as f:
    print(f.read())     # 학생 A,77.5 / 학생 B,82.5
