# ---
# check: none
# ---
count = 0

def visit(count):       # 받아서
    return count + 1    # 늘린 값을 돌려준다

count = visit(count)
count = visit(count)
print(count)            # 2   global 없이도 된다
