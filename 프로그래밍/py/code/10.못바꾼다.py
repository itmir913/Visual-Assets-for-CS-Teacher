# ---
# check: none
# ---
scores = [90, 85, 72]
scores[0] = 100         # 리스트는 갈아 끼울 수 있다
print(scores)           # [100, 85, 72]

point = (3, 7)
# point[0] = 100        # TypeError. 튜플은 갈아 끼울 수 없다
new_point = (100, 7)    # 바꾸고 싶으면 «새로 만든다»
print(new_point)        # (100, 7)
