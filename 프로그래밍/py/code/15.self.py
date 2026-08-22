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


a = Student("학생 A", 90, 65)
b = Student("학생 B", 85, 80)

print(a.average())              # 77.5   self에 a가 들어간다
print(b.average())              # 82.5   self에 b가 들어간다
print(Student.average(a))       # 77.5   실제로 일어나는 일은 이것이다
