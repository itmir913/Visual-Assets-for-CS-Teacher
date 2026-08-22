# ---
# check: none
# ---
votes = ["사과", "포도", "사과", "바나나", "사과", "포도"]

count = {}
for fruit in votes:
    count[fruit] = count.get(fruit, 0) + 1      # 없으면 0에서 시작한다

print(count)                        # {'사과': 3, '포도': 2, '바나나': 1}
