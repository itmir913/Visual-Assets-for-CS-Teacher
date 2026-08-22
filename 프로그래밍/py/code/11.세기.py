# ---
# check: none
# ---
votes = ["사과", "포도", "사과", "바나나", "사과", "포도"]

count = {}
for fruit in votes:
    if fruit in count:
        count[fruit] = count[fruit] + 1
    else:
        count[fruit] = 1            # 처음 본 것이면 1로 시작한다

print(count)                        # {'사과': 3, '포도': 2, '바나나': 1}
