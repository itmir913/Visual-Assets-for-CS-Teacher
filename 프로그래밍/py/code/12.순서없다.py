# ---
# check: none
# ---
fruits = {"사과", "포도", "바나나"}

# print(fruits[0])      # TypeError. 자리 번호가 없다
fruits.add("귤")         # 넣고
fruits.discard("포도")   # 뺀다. 없는 값을 빼도 오류가 나지 않는다
print(len(fruits))      # 3

for f in sorted(fruits):    # 차례가 필요하면 정렬해서 훑는다
    print(f)                # 귤 / 바나나 / 사과
