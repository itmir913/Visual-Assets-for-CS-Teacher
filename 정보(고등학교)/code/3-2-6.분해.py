def average(values):
    return sum(values) / len(values)


def grade(value):
    if value >= 80:
        return 'A'
    elif value >= 60:
        return 'B'
    else:
        return 'C'


scores = [88, 74, 95, 61, 79]
result = average(scores)

print(round(result, 1), grade(result))
