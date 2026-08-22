# ---
# check: none
# ---
a = {1, 2, 3, 4}
b = {3, 4, 5}

print(sorted(a & b))    # [3, 4]           양쪽에 다 있는 것
print(sorted(a | b))    # [1, 2, 3, 4, 5]  어느 쪽에든 있는 것
print(sorted(a - b))    # [1, 2]           a에만 있는 것
print(sorted(b - a))    # [5]              b에만 있는 것
