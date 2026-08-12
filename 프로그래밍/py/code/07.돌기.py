# ---
# check: none
# ---
word = "python"

for ch in word:         # 리스트에서 값을 꺼내던 것과 같은 방식이다
    print(ch, end=" ")  # p y t h o n
print()

print("th" in word)     # True    들어 있는지 묻는다
print("z" in word)      # False
