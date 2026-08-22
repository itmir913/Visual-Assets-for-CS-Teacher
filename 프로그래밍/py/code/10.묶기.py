# ---
# check: none
# ---
point = (3, 7)          # 소괄호로 묶는다
print(point)            # (3, 7)
print(point[0])         # 3      자리 번호로 꺼내는 것은 리스트와 같다
print(len(point))       # 2

one = (5,)              # 값이 하나면 «쉼표»를 빠뜨리지 않는다
print(type(one))        # <class 'tuple'>
print(type((5)))        # <class 'int'>    쉼표가 없으면 그냥 괄호다
