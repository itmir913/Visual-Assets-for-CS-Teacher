# ---
# check: none
# ---
scores = {"학생 A": 90, "학생 B": 85, "학생 C": 72}

for name in scores:                 # 그냥 훑으면 «키»가 나온다
    print(name, scores[name])       # 학생 A 90 / 학생 B 85 / 학생 C 72

for name, score in scores.items():  # 키와 값을 «짝»으로 받는다
    print(name, score)              # 위와 같다

print(list(scores.keys()))          # ['학생 A', '학생 B', '학생 C']
print(list(scores.values()))        # [90, 85, 72]
print(sum(scores.values()) / len(scores))   # 82.33333333333333
