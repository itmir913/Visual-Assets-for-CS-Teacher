# ---
# check: none
# ---
scores = [90, 55, 72, 48, 85]
passed = []                   # 빈 리스트에서 시작한다

for score in scores:
    if score >= 60:           # 되풀이 «안»에서 갈라진다
        passed.append(score)

print(passed)                 # [90, 72, 85]
print(len(passed), "명이 합격했습니다")   # 3 명이 합격했습니다
