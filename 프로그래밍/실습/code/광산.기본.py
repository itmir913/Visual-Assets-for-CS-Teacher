# 다섯 줄을 받아 5x5 격자로 담는다
grid = []
for _ in range(5):
    grid.append(list(map(int, input().split())))

best = 0

# 3x3 상자를 놓을 수 있는 왼쪽 위 자리는 3x3가지다
for i in range(3):
    for j in range(3):
        total = 0
        # 그 자리에서 세 줄, 세 칸을 더한다
        for r in range(i, i + 3):
            for c in range(j, j + 3):
                total += grid[r][c]
        if total > best:
            best = total

print(best)
