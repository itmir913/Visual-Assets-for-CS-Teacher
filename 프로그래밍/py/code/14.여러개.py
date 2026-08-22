# ---
# check: none
# ---
nums = [10, 20, 30]

try:
    i = int(input("자리 번호: "))
    print(100 / nums[i])
except ValueError:
    print("숫자로 적어 주세요")
except IndexError:
    print("0부터 2까지만 있습니다")
except ZeroDivisionError:
    print("0으로는 나눌 수 없습니다")
