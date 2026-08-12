# 손으로 정리해 두면 A + B = C 만 보면 된다
for a in range(1, 10):
    for b in range(1, 10):
        if a == b:
            continue
        c = a + b
        if c > 9 or c == a or c == b:
            continue
        print(a, b, c)
