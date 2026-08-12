# ---
# check: none
# ---
with open("성적.csv", "r", encoding="utf-8") as f:
    for line in f:
        values = line.strip().split(",")    # 줄바꿈을 떼고 쉼표에서 자른다
        print(values)                       # ['학생 A', '90', '65']
                                            # ['학생 B', '85', '80']
