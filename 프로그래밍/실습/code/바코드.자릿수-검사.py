# ---
# check: none
# ---
# 여덟 자리가 아니면 계산할 수가 없다. 맨 앞에서 막는다
barcode = input()
if len(barcode) != 8:
    print("여덟 자리를 입력하세요")
else:
    ...  # 아래는 기본 코드와 같다
