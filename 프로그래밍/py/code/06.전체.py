scores = list(map(int, input("점수를 빈칸으로 나누어 입력하세요: ").split()))

total = 0
passed = []

for score in scores:
    total = total + score
    if score >= 60:
        passed.append(score)

print("합계", total, "평균", total / len(scores))
print("합격", len(passed), "명:", passed)
