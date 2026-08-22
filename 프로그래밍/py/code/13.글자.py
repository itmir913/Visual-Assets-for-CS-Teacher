# ---
# check: none
# ---
line = "학생 A,90,65"

values = line.split(",")
scores = [int(v) for v in values[1:]]   # 이름 뒤부터가 점수다
print(scores)                           # [90, 65]

names = ["  사과 ", "포도  ", " 바나나"]
clean = [name.strip() for name in names]
print(clean)                            # ['사과', '포도', '바나나']
