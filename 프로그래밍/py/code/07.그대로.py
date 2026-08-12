# ---
# check: none
# ---
answer = "  Seoul  "

answer.strip()          # 결과를 아무 데도 담지 않았다
print(answer)           # «  Seoul  »   원본은 그대로다

answer = answer.strip() # 다시 담아야 바뀐 것이 남는다
print(answer)           # Seoul
