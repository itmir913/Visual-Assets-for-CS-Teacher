# ---
# check: none
# ---
scores = []

with open("점수.txt", "r", encoding="utf-8") as f:
    for line in f:
        scores.append(int(line.strip()))    # 글자로 읽히므로 «수로 바꾼다»

print(scores)                   # [90, 85, 72]
print(sum(scores) / len(scores))    # 82.33333333333333
