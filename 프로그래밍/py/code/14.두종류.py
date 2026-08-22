# ---
# check: none
# ---
# 1) 문법 오류 — 실행되기 «전에» 걸린다
# if x > 3
#     print("큼")          # SyntaxError. 콜론이 없다

# 2) 실행 중 오류 — 실행되다가 «그 줄에서» 멈춘다
nums = [1, 2, 3]
print(nums[5])              # IndexError: list index out of range
