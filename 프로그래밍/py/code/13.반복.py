# ---
# check: none
# ---
nums = [1, 2, 3, 4, 5]

squares = []                    # 빈 리스트를 먼저 만들고
for n in nums:                  # 하나씩 훑으면서
    squares.append(n * n)       # 담는다

print(squares)                  # [1, 4, 9, 16, 25]
