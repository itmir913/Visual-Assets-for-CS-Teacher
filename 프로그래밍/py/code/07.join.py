# ---
# check: none
# ---
fruits = ["사과", "바나나", "포도"]

print(", ".join(fruits))    # 사과, 바나나, 포도   사이에 끼울 글자를 앞에 적는다
print("-".join(fruits))     # 사과-바나나-포도
print("".join(fruits))      # 사과바나나포도

scores = [90, 85, 72]
# print(", ".join(scores))          # 오류. 재료가 전부 문자열이어야 한다
print(", ".join(str(s) for s in scores))   # 90, 85, 72
