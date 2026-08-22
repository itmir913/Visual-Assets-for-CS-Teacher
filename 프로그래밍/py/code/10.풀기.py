# ---
# check: none
# ---
scores = (90, 85, 72)

kor, eng, math = scores     # 묶음이 풀려 이름 셋에 차례로 들어간다
print(kor, eng, math)       # 90 85 72

# 02에서 쓴 이 줄도 같은 일이었다
kor, eng = map(int, "80 91".split())
print(kor + eng)            # 171
