# 가로 칸 수와 세로 칸 수를 입력받는다
w, h = map(int, input().split())

for _ in range(h):
    print("+---" * w + "+")  # 경계선
    print("|   " * w + "|")  # 칸 안쪽

# 마지막 경계선은 되풀이 밖에서 한 번 더 찍는다
print("+---" * w + "+")
