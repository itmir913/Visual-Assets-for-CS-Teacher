# ---
# check: none
# ---
votes = ["사과", "포도", "사과", "바나나", "사과", "포도"]

# 리스트로 「어떤 것이 나왔나」를 추리려면 한 번 더 훑어야 한다
kinds = []
for fruit in votes:
    if fruit not in kinds:
        kinds.append(fruit)

print(kinds)        # ['사과', '포도', '바나나']
print(len(kinds))   # 3
