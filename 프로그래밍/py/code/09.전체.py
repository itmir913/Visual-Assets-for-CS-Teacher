# ---
# check: none
# ---
def average(scores):
    return round(sum(scores) / len(scores), 1)

with open("성적.csv", "r", encoding="utf-8") as f:
    rows = [line.strip().split(",") for line in f]

with open("평균.csv", "w", encoding="utf-8") as f:
    for row in rows:
        scores = [int(v) for v in row[1:]]      # 이름 뒤부터가 점수다
        f.write(f"{row[0]},{average(scores)}\n")

with open("평균.csv", "r", encoding="utf-8") as f:
    print(f.read())     # 학생 A,77.5 / 학생 B,82.5
