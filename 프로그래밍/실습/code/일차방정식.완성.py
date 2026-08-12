equation = input()
parts = equation.split()

# 계수가 생략된 "x + 5 = 10"이면 앞이 빈 문자열이 된다
a_str = parts[0][:-1]
a = float(a_str) if a_str else 1.0

op = parts[1]
b = float(parts[2])
c = float(parts[4])

if a == 0:
    # a가 0이면 x가 사라져 일차방정식이 아니다. 나누기도 할 수 없다
    print("계수가 0이면 일차방정식이 아닙니다")
else:
    if op == '+':
        x = (c - b) / a
    else:
        x = (c + b) / a

    # 딱 떨어지면 정수로, 아니면 소수점 둘째 자리까지
    if x == int(x):
        print(int(x))
    else:
        print(round(x, 2))
