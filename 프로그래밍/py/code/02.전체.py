name = input("이름을 입력하세요: ")
kor, eng = map(int, input("국어와 영어 점수를 입력하세요: ").split())

total = kor + eng
print(name, "님의 합계는", total, "점,", "평균은", total / 2, "점입니다", sep=" ")
