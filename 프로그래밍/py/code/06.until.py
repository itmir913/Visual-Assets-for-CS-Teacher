# ---
# check: none
# ---
total = 0

while True:                       # 「참」이므로 스스로는 끝나지 않는다
    line = input("점수 (끝내려면 빈 줄): ")
    if line == "":
        break                     # 끝내는 자리를 «안»에 둔다
    total = total + int(line)

print("합계", total)
