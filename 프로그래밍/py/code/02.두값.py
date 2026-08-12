# ---
# check: none
# ---
data = input("국어와 영어 점수: ").split()   # "80 91" -> ['80', '91']
print(data)                                 # ['80', '91']   아직 글자다

kor = int(data[0])
eng = int(data[1])
print(kor + eng)                            # 171
