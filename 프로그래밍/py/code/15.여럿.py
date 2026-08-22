# ---
# check: none
# ---
class Student:
    def __init__(self, name, kor, eng):
        self.name = name
        self.kor = kor
        self.eng = eng


a = Student("학생 A", 90, 65)
b = Student("학생 B", 85, 80)

a.kor = 95                  # a의 값만 바뀐다
print(a.kor, b.kor)         # 95 85    각자 자기 값을 갖는다
print(a is b)               # False    같은 틀로 만들었어도 서로 다른 하나다
