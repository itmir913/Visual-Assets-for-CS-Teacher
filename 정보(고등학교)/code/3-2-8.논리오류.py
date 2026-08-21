scores = [88, 74, 95, 61, 79]

total = 0
for i in range(len(scores) - 1):
    total = total + scores[i]

print(total / len(scores))
