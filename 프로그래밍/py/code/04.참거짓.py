# ---
# check: none
# ---
name = input("이름을 입력하세요: ")

if name:                        # 빈 글자는 «거짓»으로 본다
    print(name, "님 반갑습니다")
else:
    print("이름을 입력하지 않았습니다")
