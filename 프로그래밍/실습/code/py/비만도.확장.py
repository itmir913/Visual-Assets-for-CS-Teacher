height, weight = map(float, input().split())

if height < 150:
    sw = height - 100
elif height < 160:
    sw = (height - 150) / 2 + 50
else:
    sw = (height - 100) * 0.9

obesity = (weight - sw) * 100 / sw

# 음수를 먼저 걸러 낸다. 이 줄이 아래로 내려가면 저체중이 정상에 먹힌다
if obesity < 0:
    print("저체중")
elif obesity <= 10:
    print("정상")
elif obesity <= 20:
    print("과체중")
else:
    print("비만")
