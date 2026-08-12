# ---
# check: none
# ---
# 자를 길이가 0이면 나눌 수 없다. 나누기보다 앞에서 막는다
if cut <= 0:
    print("자를 길이는 1 이상이어야 합니다")
else:
    count = total // cut
    for i in range(1, count + 1):
        print(f"F-{i:04d}")
