# ---
# check: none
# ---
count = 0

def visit():
    global count        # 「바깥의 그 count를 쓰겠다」고 밝힌다
    count = count + 1

visit()
visit()
print(count)            # 2
