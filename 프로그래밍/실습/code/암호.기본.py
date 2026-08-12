# 암호문을 한 줄로 입력받는다
cipher = input()

plain = ""
for ch in cipher:
    # 글자를 번호로 바꿔 3을 빼고 다시 글자로 되돌린다
    plain += chr(ord(ch) - 3)

print(plain)
