# ---
# check: none
# ---
with open("기록.txt", "w", encoding="utf-8") as f:
    f.write("첫째 줄\n")               # w — 있던 내용을 지우고 처음부터 쓴다

with open("기록.txt", "a", encoding="utf-8") as f:
    f.write("둘째 줄\n")               # a — 뒤에 «이어» 붙인다

with open("기록.txt", "r", encoding="utf-8") as f:
    print(f.read())                    # 첫째 줄 / 둘째 줄
