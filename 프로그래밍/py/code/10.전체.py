# ---
# check: none
# ---
def summary(scores):
    """가장 낮은 점수, 가장 높은 점수, 평균을 한 번에 돌려준다."""
    return min(scores), max(scores), round(sum(scores) / len(scores), 1)


names = ["학생 A", "학생 B", "학생 C"]
table = [[90, 85, 72], [60, 71, 95], [88, 88, 84]]

for name, scores in zip(names, table):
    low, high, avg = summary(scores)
    print(f"{name}: 최저 {low}, 최고 {high}, 평균 {avg}")
# 학생 A: 최저 72, 최고 90, 평균 82.3
# 학생 B: 최저 60, 최고 95, 평균 75.3
# 학생 C: 최저 84, 최고 88, 평균 86.7
