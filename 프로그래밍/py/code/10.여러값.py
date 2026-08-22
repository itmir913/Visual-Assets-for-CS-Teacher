# ---
# check: none
# ---
def min_max(scores):
    return min(scores), max(scores)     # 쉼표를 찍으면 «묶음 하나»가 돌아온다


result = min_max([90, 85, 72])
print(result)               # (72, 90)   묶음 그대로 받았다
print(type(result))         # <class 'tuple'>

low, high = min_max([90, 85, 72])   # 받으면서 바로 풀 수도 있다
print(low, high)            # 72 90
