# ---
# check: none
# ---
def read_scores(path):
    """파일에서 이름과 점수를 읽어 딕셔너리로 돌려준다."""
    table = {}
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            values = line.strip().split(",")
            table[values[0]] = int(values[1])
    return table


try:
    scores = read_scores("성적.csv")
except FileNotFoundError:
    print("성적.csv가 없습니다. 파일을 먼저 만들어 주세요")
except ValueError:
    print("점수 칸에 숫자가 아닌 값이 있습니다")
else:
    for name, score in scores.items():
        print(f"{name}: {score}")
# 학생 A: 90
# 학생 B: 85
