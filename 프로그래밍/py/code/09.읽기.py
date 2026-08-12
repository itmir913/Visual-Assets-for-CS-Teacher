# ---
# check: none
# ---
f = open("메모.txt", "r", encoding="utf-8")
text = f.read()         # 파일 «전체»를 문자열 하나로 읽는다
f.close()

print(text)             # 첫 줄입니다
