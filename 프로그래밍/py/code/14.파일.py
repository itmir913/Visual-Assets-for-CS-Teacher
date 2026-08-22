# ---
# check: none
# ---
try:
    with open("성적.csv", "r", encoding="utf-8") as f:
        print(f.read())
except FileNotFoundError:
    print("성적.csv를 찾을 수 없습니다")
