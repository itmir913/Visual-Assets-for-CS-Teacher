# ---
# check: none
# ---
scores = {"학생 A": 90, "학생 B": 85, "학생 C": 72}

print(scores["학생 B"])      # 85     번호가 아니라 «이름»으로 꺼낸다
print(len(scores))          # 3

scores["학생 D"] = 68        # 없던 키면 «새로 생긴다»
scores["학생 A"] = 95        # 있던 키면 «값이 바뀐다»
print(scores)               # {'학생 A': 95, '학생 B': 85, '학생 C': 72, '학생 D': 68}

del scores["학생 D"]
print(len(scores))          # 3
