books = [42, 17, 63, 8, 35]

for turn in range(4):
    for i in range(4 - turn):
        if books[i] > books[i + 1]:
            books[i], books[i + 1] = books[i + 1], books[i]

print(books)
