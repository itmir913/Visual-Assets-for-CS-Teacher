scores = list(map(int, input("점수를 빈칸으로 나누어 입력하세요: ").split()))

print("입력한 점수:", scores)
print("개수:", len(scores))
print("합계:", sum(scores))
print("평균:", sum(scores) / len(scores))
print("가장 높은 점수:", max(scores))
print("낮은 순으로:", sorted(scores))
