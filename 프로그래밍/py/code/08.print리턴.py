# ---
# check: none
# ---
def add_print(a, b):
    print(a + b)            # 찍기만 한다. 돌려주지 않는다

def add_return(a, b):
    return a + b            # 돌려준다

x = add_print(3, 5)         # 8    찍히기는 한다
print(x)                    # None   돌려준 것이 없다

y = add_return(3, 5)        # 아무것도 찍히지 않는다
print(y)                    # 8      돌려받았다
