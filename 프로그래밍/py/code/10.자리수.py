# ---
# check: none
# ---
scores = (90, 85, 72)

# a, b = scores       # ValueError: too many values to unpack
# a, b, c, d = scores # ValueError: not enough values to unpack

a, b, c = scores      # 이름 셋, 값 셋 — 짝이 맞는다
print(a, b, c)        # 90 85 72
