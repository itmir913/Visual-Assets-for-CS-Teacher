# ---
# check: none
# ---
math_class = {"학생 A", "학생 B", "학생 C", "학생 D"}
art_class = {"학생 C", "학생 D", "학생 E"}

print(sorted(math_class & art_class))    # ['학생 C', '학생 D']   둘 다 듣는다
print(sorted(math_class - art_class))    # ['학생 A', '학생 B']   수학만 듣는다
print(len(math_class | art_class))       # 5                     모두 몇 명인가
