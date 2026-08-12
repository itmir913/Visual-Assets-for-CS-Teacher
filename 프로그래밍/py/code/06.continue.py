# ---
# check: none
# ---
scores = [90, 55, 72, 48, 85]

for score in scores:
    if score < 60:
        continue                 # 이번 바퀴만 건너뛰고 «다음 바퀴로» 간다
    print("합격:", score)        # 90 / 72 / 85
