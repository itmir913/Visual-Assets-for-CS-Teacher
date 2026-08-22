# ---
# check: none
# ---
while True:
    try:
        age = int(input("나이: "))
        break               # 여기까지 왔으면 제대로 들어온 것이다
    except ValueError:
        print("숫자로 적어 주세요")

print("나이는", age)
