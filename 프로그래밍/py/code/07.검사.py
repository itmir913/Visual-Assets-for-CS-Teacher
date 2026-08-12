# ---
# check: none
# ---
code = "A-2026"
num = "2026"

print(code.startswith("A"))     # True    이렇게 시작하는지
print(code.endswith("6"))       # True    이렇게 끝나는지
print(num.isdigit())            # True    숫자로만 되어 있는지
print(code.isdigit())           # False
