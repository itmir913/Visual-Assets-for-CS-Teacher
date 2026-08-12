# 전체 길이와 자를 길이를 한 줄에 공백으로 띄어 입력받는다
total, cut = map(int, input().split())

# 나눈 몫이 만들 수 있는 개수다. 남는 자투리는 버린다
count = total // cut

# 1번부터 count번까지. 끝값은 포함되지 않으므로 1을 더한다
for i in range(1, count + 1):
    # 네 자리로 맞추고 빈 자리는 0으로 채운다
    print(f"F-{i:04d}")
