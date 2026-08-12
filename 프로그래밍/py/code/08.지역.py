# ---
# check: none
# ---
def average(scores):
    total = sum(scores)         # total은 함수 «안에서만» 산다
    return total / len(scores)

print(average([90, 85, 72]))    # 82.33333333333333
print(total)                    # NameError: name 'total' is not defined
