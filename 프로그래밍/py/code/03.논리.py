# ---
# check: none
# ---
score = 85
print(score >= 80 and score < 90)   # True    둘 다 참이어야 참
print(score < 60 or score > 90)     # False   둘 다 거짓이라 거짓 (하나라도 참이면 참)
print(not score >= 80)              # False   뒤집는다
