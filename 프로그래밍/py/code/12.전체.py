# ---
# check: none
# ---
# 두 줄을 받아 각각 집합으로 담는다
a = set(map(int, input().split()))
b = set(map(int, input().split()))

print(*sorted(a & b))       # 겹친 것
print(*sorted(a | b))       # 합친 것

# 입력
# 1 2 3 4 3
# 3 4 5
# 출력
# 3 4
# 1 2 3 4 5
