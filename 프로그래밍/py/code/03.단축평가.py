# ---
# check: none
# ---
total = 100
count = 0                        # 아직 아무도 응답하지 않았다

if count != 0 and total / count >= 60:
    print("평균이 60점 이상입니다")
else:
    print("아직 평균을 낼 수 없습니다")   # 이쪽이 실행된다

# count가 0이라 왼쪽이 거짓 -> 오른쪽 total / count는 «계산되지 않는다»
# 만약 계산했다면 0으로 나누어 그 자리에서 오류가 난다
