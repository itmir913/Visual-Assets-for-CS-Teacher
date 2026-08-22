# ---
# check: none
# ---
nums = [10, 20, 30]

# 넓게 잡으면 «무엇이 잘못됐는지»가 사라진다
try:
    i = int(input("자리 번호: "))
    print(100 / nums[i])
except:
    print("오류가 났습니다")       # 어느 오류인지 알 수 없다

# 오타로 난 NameError까지 여기 걸린다. 고칠 곳을 못 찾게 된다
