# ---
# check: none
# ---
with open("점수.txt", "r", encoding="utf-8") as f:
    for line in f:              # 파일도 «하나씩 꺼내»는 것이 된다
        print(line.strip())     # 90 / 85 / 72   줄마다 한 줄씩
