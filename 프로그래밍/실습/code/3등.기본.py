# 사람 수를 먼저 받고, 그다음 줄부터 이름과 점수를 받는다
n = int(input())

students = []
for _ in range(n):
    name, score = input().split()
    students.append([name, int(score)])

# 점수를 기준으로 큰 것부터 늘어놓는다
students.sort(key=lambda s: s[1], reverse=True)

# 0번이 1등이므로 3등은 2번이다
print(students[2][0])
