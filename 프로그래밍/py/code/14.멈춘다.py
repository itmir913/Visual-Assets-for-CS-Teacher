# ---
# check: none
# ---
print("시작")

age = int(input("나이: "))      # 「스물」이라고 넣으면 여기서 멈춘다
print("입력받은 나이:", age)

print("끝")                     # 멈추면 이 줄은 아예 실행되지 않는다

# 입력이 「스물」일 때
# 시작
# ValueError: invalid literal for int() with base 10: '스물'
