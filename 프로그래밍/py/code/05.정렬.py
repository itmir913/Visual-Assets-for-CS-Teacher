# ---
# check: none
# ---
scores = [90, 85, 72, 68]

print(sorted(scores))              # [68, 72, 85, 90]   «새 목록»을 만들어 준다
print(scores)                      # [90, 85, 72, 68]   원래 것은 그대로다

scores.sort()                      # 원래 것을 «직접» 줄 세운다
print(scores)                      # [68, 72, 85, 90]

scores.sort(reverse=True)
print(scores)                      # [90, 85, 72, 68]
