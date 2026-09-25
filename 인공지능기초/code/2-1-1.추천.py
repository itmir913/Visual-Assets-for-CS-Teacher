# 1. 사용자들의 시청 기록 데이터 수집 (어떤 채널을 구독/시청했는지)
user_me = ["게임", "음악", "요리"]
user_friend_A = ["뷰티", "패션", "브이로그"]
user_friend_B = ["게임", "음악", "IT기기 리뷰"]  # 나와 취향이 비슷함!

# 2. 취향 유사도(Similarity) 계산 함수
def check_similarity(user1, user2):
    # 겹치는 관심사의 개수를 셉니다.
    common_interests = set(user1) & set(user2)
    return len(common_interests)

# 3. 나와 가장 비슷한 사람 찾기
score_A = check_similarity(user_me, user_friend_A) # 겹치는 것 0개
score_B = check_similarity(user_me, user_friend_B) # '게임', '음악' 겹침 (2개)

if score_B > score_A:
    print("친구 B와 취향이 비슷하군요!")
    # 4. B는 봤지만 나는 안 본 영상 추천하기
    print("친구 B가 즐겨보는 'IT기기 리뷰' 영상을 추천합니다!")
