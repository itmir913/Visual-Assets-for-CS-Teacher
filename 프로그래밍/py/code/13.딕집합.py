# ---
# check: none
# ---
names = ["학생 A", "학생 B", "학생 C"]
scores = [90, 85, 72]

table = {name: score for name, score in zip(names, scores)}
print(table)        # {'학생 A': 90, '학생 B': 85, '학생 C': 72}

votes = ["사과", "포도", "사과", "바나나"]
kinds = {v for v in votes}      # 중괄호를 쓰면 «집합»이 된다
print(len(kinds))               # 3
