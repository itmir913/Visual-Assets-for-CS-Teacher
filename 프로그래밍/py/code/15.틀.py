# ---
# check: none
# ---
class Student:
    def __init__(self, name, kor, eng):     # 새로 하나 만들 때 «한 번» 실행된다
        self.name = name                    # self는 «지금 만드는 그 하나»다
        self.kor = kor
        self.eng = eng


a = Student("학생 A", 90, 65)       # 틀로 하나 찍어 낸다
print(a.name)                       # 학생 A
print(a.kor + a.eng)                # 155

# b = Student("학생 B", 85)         # TypeError. 빠뜨리면 «만들 때» 걸린다
