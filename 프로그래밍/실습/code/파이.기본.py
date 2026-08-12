# 점의 개수를 먼저 받고, 그다음 줄부터 좌표를 하나씩 받는다
n = int(input())

inside = 0
for _ in range(n):
    x, y = map(float, input().split())
    # 제곱근을 구하지 않고 제곱한 채로 견준다
    if x ** 2 + y ** 2 <= 1:
        inside += 1

print(4 * inside / n)
