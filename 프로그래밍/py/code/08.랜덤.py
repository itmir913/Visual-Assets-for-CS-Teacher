# ---
# check: none
# ---
import random

random.seed(1)                      # 씨앗을 고정하면 «같은 순서»가 나온다
print(random.randint(1, 100))       # 18    1 이상 100 «이하»의 정수
print(random.randint(1, 100))       # 73
print(random.choice(["가위", "바위", "보"]))   # 가위   하나를 골라 준다
