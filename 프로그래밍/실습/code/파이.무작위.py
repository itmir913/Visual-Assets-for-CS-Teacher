import random

# 점을 입력받는 대신 직접 만들어 쓴다
n = int(input())

inside = 0
for _ in range(n):
    x = random.random()
    y = random.random()
    if x ** 2 + y ** 2 <= 1:
        inside += 1

print(4 * inside / n)
