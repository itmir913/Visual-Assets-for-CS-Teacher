# ---
# check: none
# ---
def bmi(weight, height):            # 순서대로 받는다
    return round(weight / (height * height), 1)

print(bmi(62, 1.70))        # 21.5
print(bmi(1.70, 62))        # 0.0   순서를 바꾸면 딴 값이 나온다
