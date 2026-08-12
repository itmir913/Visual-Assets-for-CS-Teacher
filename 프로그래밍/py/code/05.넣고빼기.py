# ---
# check: none
# ---
scores = [90, 85]

scores.append(72)          # 맨 뒤에 붙인다
print(scores)              # [90, 85, 72]

scores.insert(1, 100)      # 1번 자리에 끼워 넣는다
print(scores)              # [90, 100, 85, 72]

scores.remove(85)          # «값» 85를 찾아 지운다
print(scores)              # [90, 100, 72]

last = scores.pop()        # 맨 뒤를 빼내면서 «돌려받는다»
print(last, scores)        # 72 [90, 100]
