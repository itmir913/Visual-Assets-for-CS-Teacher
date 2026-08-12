# "3x + 5 = 20" 처럼 토큰 사이를 한 칸씩 띄운 식을 받는다
equation = input()

# 공백에서 잘라 다섯 조각으로 나눈다
parts = equation.split()
# parts[0]="3x"  parts[1]="+"  parts[2]="5"  parts[3]="="  parts[4]="20"

a = float(parts[0][:-1])  # "3x"에서 끝의 x를 떼면 "3"
op = parts[1]             # "+" 또는 "-"
b = float(parts[2])
c = float(parts[4])       # parts[3]의 "="은 쓰지 않는다

# b를 우변으로 넘기고 a로 나눈다
if op == '+':
    x = (c - b) / a
else:
    x = (c + b) / a

print(x)
