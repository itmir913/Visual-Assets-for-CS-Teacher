# ---
# check: none
# ---
nums = [1, 2, 3, 4, 5, 6]

evens = [n for n in nums if n % 2 == 0]     # 조건에 맞는 것만 담는다
print(evens)                                # [2, 4, 6]

# 같은 일을 반복으로 쓰면
evens2 = []
for n in nums:
    if n % 2 == 0:
        evens2.append(n)
print(evens2)                               # [2, 4, 6]
