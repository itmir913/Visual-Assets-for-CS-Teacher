# A, B, C가 될 수 있는 모든 조합을 하나씩 넣어 본다
for a in range(1, 10):
    for b in range(1, 10):
        if a == b:
            continue  # 서로 다른 숫자여야 한다
        for c in range(1, 10):
            if c == a or c == b:
                continue
            # AB + BA 가 CC 와 같은지 그대로 확인한다
            if (a * 10 + b) + (b * 10 + a) == (c * 10 + c):
                print(a, b, c)
