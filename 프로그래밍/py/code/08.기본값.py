# ---
# check: none
# ---
def greet(name, greeting="안녕하세요"):    # 뒤쪽에만 기본값을 둘 수 있다
    print(name + "님, " + greeting)

greet("학생 A")                 # 학생 A님, 안녕하세요       안 주면 기본값을 쓴다
greet("학생 A", "반갑습니다")     # 학생 A님, 반갑습니다      주면 준 값을 쓴다
