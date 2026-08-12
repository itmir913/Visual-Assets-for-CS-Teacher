# ---
# check: none
# ---
with open("점수.txt", "r", encoding="utf-8") as f:
    for line in f:
        print("[" + line + "]")     # [90
                                    # ]   줄 끝의 줄바꿈이 딸려 온다

print("---")

with open("점수.txt", "r", encoding="utf-8") as f:
    for line in f:
        print("[" + line.strip() + "]")     # [90]  [85]  [72]
