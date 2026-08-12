# 매달 넣을 돈과 월 이자율을 한 줄씩 받는다
savings = float(input())
rate = float(input())

balance = 0
for month in range(1, 25):
    # 이번 달 저축을 더한 뒤, 그 전체에 이자가 붙는다
    balance = (balance + savings) * (1 + rate / 100)
    print(month, round(balance, 2))
