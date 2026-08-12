# ---
# check: none
# ---
raw = "  seoul , busan ,  daegu  "

cities = []
for piece in raw.split(","):
    cities.append(piece.strip().upper())

print(cities)                       # ['SEOUL', 'BUSAN', 'DAEGU']
print(", ".join(cities))            # SEOUL, BUSAN, DAEGU
print(f"도시 {len(cities)}곳을 정리했습니다.")   # 도시 3곳을 정리했습니다.
