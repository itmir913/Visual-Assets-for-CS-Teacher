# ---
# check: none
# ---
scores = [90, 85, 72, 68]

for score in scores:
    total = 0                 # 자리를 «안»에 만들면 바퀴마다 0으로 되돌아간다
    total = total + score
    print(total, end=" ")     # 90 85 72 68   합이 쌓이지 않는다
print()
