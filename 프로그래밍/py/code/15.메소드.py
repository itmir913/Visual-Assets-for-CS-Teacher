# ---
# check: none
# ---
class Student:
    def __init__(self, name, kor, eng):
        self.name = name
        self.kor = kor
        self.eng = eng

    def average(self):                          # 값과 «하는 일»을 함께 둔다
        return round((self.kor + self.eng) / 2, 1)

    def passed(self):
        return self.average() >= 60             # 메소드가 메소드를 부를 수도 있다


a = Student("학생 A", 90, 65)
print(a.average())      # 77.5      괄호 안이 비어 있다 — self는 자동으로 들어간다
print(a.passed())       # True
