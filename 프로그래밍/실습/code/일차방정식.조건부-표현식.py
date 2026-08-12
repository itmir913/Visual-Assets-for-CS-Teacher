# ---
# check: none
# ---
# 여러 줄로 쓰면 이렇게 된다
if a_str:              # 빈 문자열이 아니면
    a = float(a_str)
else:
    a = 1.0

# 한 줄로 줄이면 이렇게 된다
a = float(a_str) if a_str else 1.0
