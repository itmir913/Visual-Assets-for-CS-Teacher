# ---
# check: none
# ---
def sign(n):
    if n > 0:
        return "양수"       # 여기서 함수가 «끝난다»
    if n < 0:
        return "음수"
    return "영"

print(sign(5))      # 양수
print(sign(-3))     # 음수
print(sign(0))      # 영
