# ---
# check: none
# ---
nums = [10, 0, 30]

try:
    i = int(input("인덱스: "))
    print(100 / nums[i])
except ValueError:
    print("숫자로 적어 주세요")
except IndexError:
    print("없는 인덱스입니다. 0부터 2까지 적어 주세요")
except ZeroDivisionError:
    print("그 인덱스의 값이 0이라 나눌 수 없습니다")
