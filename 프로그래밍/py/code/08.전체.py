# ---
# check: none
# ---
def average(scores):
    return round(sum(scores) / len(scores), 1)

def grade(score):
    if score >= 90:
        return "A"
    if score >= 80:
        return "B"
    return "C"

scores = [90, 85, 72, 68]
avg = average(scores)

print(f"평균 {avg}점, 등급 {grade(avg)}")     # 평균 78.8점, 등급 C
