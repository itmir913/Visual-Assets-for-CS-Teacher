# 여덟 자리 숫자를 글자 그대로 입력받는다
barcode = input()

# 앞 일곱 자리와 마지막 체크 숫자를 나눈다
data = barcode[:7]
check_digit = int(barcode[7])

s1 = 0  # 홀수 번째 자리의 합
s2 = 0  # 짝수 번째 자리의 합

for i in range(7):
    num = int(data[i])
    if (i + 1) % 2 == 1:  # 자리 번호가 홀수면
        s1 += num
    else:
        s2 += num

# 짝수 자리만 세 배로 세는 것이 이 방식의 핵심이다
total_sum = s1 + s2 * 3
remainder = total_sum % 10

# 나머지가 0일 때 10이 아니라 0이 되도록 한 번 더 나눈다
result = (10 - remainder) % 10

if result == check_digit:
    print("Valid")
else:
    print("Invalid")
