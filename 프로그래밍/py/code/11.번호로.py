# ---
# check: none
# ---
names = ["학생 A", "학생 B", "학생 C"]
scores = [90, 85, 72]

# 「학생 B의 점수」를 알려면 이름이 몇 번째인지부터 찾아야 한다
i = names.index("학생 B")
print(scores[i])            # 85

# 두 리스트의 «순서가 어긋나면» 조용히 남의 점수가 나온다
