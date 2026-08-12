# ---
# check: none
# ---
for dan in range(2, 5):
    print("---", dan, "단 ---")
    for i in range(1, 4):        # 바깥 한 바퀴마다 안쪽이 통째로 돈다
        print(dan, "x", i, "=", dan * i)
