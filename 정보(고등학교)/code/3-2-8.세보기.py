books = [42, 17, 63, 8, 35]
count = 0

for turn in range(4):
    for i in range(4 - turn):
        count = count + 1
        if books[i] > books[i + 1]:
            books[i], books[i + 1] = books[i + 1], books[i]

print(books)
print('비교', count, '번')
