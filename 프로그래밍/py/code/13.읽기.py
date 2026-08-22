# ---
# check: none
# ---
rows = [["학생 A", 90, 65], ["학생 B", 85, 80], ["학생 C", 40, 55]]

# 읽기 어려운 쪽 — 한 줄에 너무 많은 일을 넣었다
bad = [[r[0], round(sum(r[1:]) / 2, 1)] for r in rows if sum(r[1:]) / 2 >= 60]

# 읽기 쉬운 쪽 — 계산에 이름을 붙이고 반복으로 풀었다
good = []
for row in rows:
    name = row[0]
    avg = round(sum(row[1:]) / 2, 1)
    if avg >= 60:
        good.append([name, avg])

print(bad)      # [['학생 A', 77.5], ['학생 B', 82.5]]
print(good)     # [['학생 A', 77.5], ['학생 B', 82.5]]
