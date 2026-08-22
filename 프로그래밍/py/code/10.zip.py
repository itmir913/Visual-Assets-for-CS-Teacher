# ---
# check: none
# ---
names = ["학생 A", "학생 B", "학생 C"]
scores = [90, 85, 72]

for name, score in zip(names, scores):
    print(name, score)      # 학생 A 90 / 학생 B 85 / 학생 C 72

short = [1, 2]
print(list(zip(short, scores)))     # [(1, 90), (2, 85)]   짧은 쪽에서 멈춘다
