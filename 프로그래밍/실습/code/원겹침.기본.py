# 두 원의 중심과 반지름을 한 줄에 하나씩 입력받는다
x1, y1, r1 = map(int, input().split())
x2, y2, r2 = map(int, input().split())

# 제곱근을 구하지 않고 제곱한 채로 견준다
d2 = (x2 - x1) ** 2 + (y2 - y1) ** 2
sum2 = (r1 + r2) ** 2
diff2 = abs(r1 - r2) ** 2

if d2 > sum2:
    print("만나지 않는다")      # 서로 떨어져 있다
elif d2 == sum2:
    print("한 점에서 만난다")   # 바깥에서 스친다
elif d2 > diff2:
    print("두 점에서 만난다")   # 두 점에서 가로지른다
elif d2 == diff2:
    print("한 점에서 만난다")   # 안쪽에서 스친다
else:
    print("만나지 않는다")      # 하나가 다른 하나 안에 들어 있다
