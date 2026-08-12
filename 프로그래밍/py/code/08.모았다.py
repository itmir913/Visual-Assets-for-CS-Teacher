# ---
# check: none
# ---
def average(scores):            # 「평균 내는 방법」에 이름을 붙인다
    return round(sum(scores) / len(scores), 1)

print(average([90, 85, 72]))    # 82.3
print(average([65, 80, 95]))    # 80.0
print(average([88, 91, 70]))    # 83.0
