books = {"파이썬": "대출가능", "씨언어": "대출중", "자바": "대출가능"}

while True:
    parts = input().split()
    if parts[0] == "0":
        break

    command = parts[0]
    title = parts[1]

    if title not in books:
        print("없는 책입니다")
    elif command == "1":                 # 대출
        if books[title] == "대출가능":
            books[title] = "대출중"
            print("대출되었습니다")
        else:
            print("이미 대출 중입니다")
    elif command == "2":                 # 반납
        if books[title] == "대출중":
            books[title] = "대출가능"
            print("반납되었습니다")
        else:
            print("대출 중이 아닙니다")
    else:
        print("없는 명령입니다")
