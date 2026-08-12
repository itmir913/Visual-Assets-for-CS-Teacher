# ---
# check: none
# ---
rows = [["학생 A", 90, 65],
        ["학생 B", 85, 80]]

with open("성적출력.csv", "w", encoding="utf-8") as f:
    for row in rows:
        f.write(",".join(str(v) for v in row) + "\n")   # 쉼표로 이어 한 줄씩
