# ---
# check: none
# ---
scores = [90, 55, 72, 48, 85]

for score in scores:
    if score < 60:
        print("낙제 점수를 찾았습니다:", score)   # 55에서 멈춘다
        break                                    # 되풀이를 «통째로» 끝낸다
    print("확인:", score)
