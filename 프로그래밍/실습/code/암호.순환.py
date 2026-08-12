cipher = input()

plain = ""
for ch in cipher:
    # A를 0번으로 옮겨 놓고 밀면, 26으로 나눈 나머지가 알파벳 안을 돌게 한다
    n = (ord(ch) - 65 - 3) % 26
    plain += chr(n + 65)

print(plain)
