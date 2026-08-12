# ---
# check: none
# ---
# 월이 1~12를 벗어나면 계산하지 않고 알린다
if 1 <= month <= 12:
    print(days[month - 1])
else:
    print("월은 1부터 12까지만 됩니다")
