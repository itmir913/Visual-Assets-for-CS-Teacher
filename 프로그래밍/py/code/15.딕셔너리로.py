# ---
# check: none
# ---
a = {"name": "학생 A", "kor": 90, "eng": 65}
b = {"name": "학생 B", "kor": 85, "eng": 80}


def average(student):               # 하는 일은 «밖에» 따로 있다
    return round((student["kor"] + student["eng"]) / 2, 1)


print(average(a))       # 77.5
print(average(b))       # 82.5

c = {"name": "학생 C", "kor": 72}   # eng를 빠뜨렸다. 오류는 «지금» 나지 않는다
# print(average(c))                 # 부를 때가 되어서야 KeyError로 멈춘다
