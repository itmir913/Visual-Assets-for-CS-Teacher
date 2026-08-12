# 키와 몸무게를 한 줄에 공백으로 띄어 입력받는다
height, weight = map(float, input().split())

# 키 구간에 따라 표준 몸무게를 구한다
if height < 150:
    sw = height - 100
elif height < 160:
    sw = (height - 150) / 2 + 50
else:
    sw = (height - 100) * 0.9

# 표준 몸무게에서 얼마나 벗어났는지를 백분율로 구한다
obesity = (weight - sw) * 100 / sw

# 구간을 위에서부터 차례로 검사한다
if obesity <= 10:
    print("정상")
elif obesity <= 20:
    print("과체중")
else:
    print("비만")
