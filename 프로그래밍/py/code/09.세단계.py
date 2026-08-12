# ---
# check: none
# ---
f = open("메모.txt", "w", encoding="utf-8")   # ① 연다
f.write("첫 줄입니다\n")                       # ② 쓴다
f.close()                                     # ③ 닫는다
