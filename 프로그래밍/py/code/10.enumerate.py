# ---
# check: none
# ---
fruits = ["사과", "바나나", "포도"]

for i, name in enumerate(fruits):   # 번호와 값이 «짝»으로 나온다
    print(i, name)                  # 0 사과 / 1 바나나 / 2 포도

for pair in enumerate(fruits):
    print(pair)                     # (0, '사과') / (1, '바나나') / (2, '포도')
