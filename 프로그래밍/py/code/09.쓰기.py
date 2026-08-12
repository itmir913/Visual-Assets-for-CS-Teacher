# ---
# check: none
# ---
scores = [90, 85, 72]

with open("결과.txt", "w", encoding="utf-8") as f:
    for score in scores:
        f.write(str(score) + "\n")     # 수는 str로, 줄바꿈은 «직접» 넣는다
