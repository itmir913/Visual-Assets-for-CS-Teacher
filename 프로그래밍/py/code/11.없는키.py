# ---
# check: none
# ---
scores = {"학생 A": 90, "학생 B": 85}

# print(scores["학생 Z"])        # KeyError. 없는 키를 꺼내면 멈춘다

print("학생 Z" in scores)        # False    먼저 있는지 물어보거나
print(scores.get("학생 Z"))      # None     get으로 꺼내거나
print(scores.get("학생 Z", 0))   # 0        없을 때 쓸 값을 정해 두거나
