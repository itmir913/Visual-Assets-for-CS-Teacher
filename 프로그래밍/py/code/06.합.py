# ---
# check: none
# ---
scores = [90, 85, 72, 68]
total = 0                     # 쌓을 자리를 «반복 밖»에 만든다

for score in scores:
    total = total + score     # 앞 바퀴의 결과를 이어받는다

print(total)                  # 315
