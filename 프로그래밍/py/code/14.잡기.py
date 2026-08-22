# ---
# check: none
# ---
try:
    age = int(input("나이: "))
    print("입력받은 나이:", age)
except ValueError:
    print("숫자로 적어 주세요")

print("끝")                 # 잡아 냈으므로 여기까지 온다

# 입력이 「스물」일 때
# 숫자로 적어 주세요
# 끝
