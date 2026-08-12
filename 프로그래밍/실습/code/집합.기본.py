# 두 줄을 받아 각각 집합으로 담는다. 겹친 값은 저절로 하나로 합쳐진다
a = set(map(int, input().split()))
b = set(map(int, input().split()))

# 오름차순으로 늘어놓아 한 줄에 내놓는다
print(*sorted(a & b))
print(*sorted(a | b))
