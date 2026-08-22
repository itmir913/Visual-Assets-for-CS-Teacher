# ---
# check: none
# ---
class Student:
    def __init__(self, name, kor, eng):
        self.name = name
        self.kor = kor
        self.eng = eng

    def average(self):
        return round((self.kor + self.eng) / 2, 1)

    def report(self):
        mark = "통과" if self.average() >= 60 else "재응시"
        return f"{self.name}: 평균 {self.average()} ({mark})"


students = []
with open("성적.csv", "r", encoding="utf-8") as f:
    for line in f:
        values = line.strip().split(",")
        students.append(Student(values[0], int(values[1]), int(values[2])))

for s in students:
    print(s.report())
# 학생 A: 평균 77.5 (통과)
# 학생 B: 평균 82.5 (통과)
# 학생 C: 평균 47.5 (재응시)
