# ---
# check: none
# ---
sentence = "나는 사과를 좋아한다. 사과는 맛있다."

print(sentence.count("사과"))           # 2    몇 번 나오는지
print(sentence.find("사과"))            # 3    처음 나오는 자리
print(sentence.find("포도"))            # -1   없으면 -1
print(sentence.replace("사과", "포도"))  # 나는 포도를 좋아한다. 포도는 맛있다.
