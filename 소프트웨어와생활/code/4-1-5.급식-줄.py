# 급식 줄이 얼마나 길어지는지 돌려 보는 모형.
#
# 물음 — 학년별로 수업을 조금씩 다른 시각에 마치면 가장 긴 줄이 얼마나 짧아질까?
#
# 여기 적힌 값은 수업에서 원리를 확인하려고 지어낸 것이다.
# 우리 학교의 값을 넣어 보려면 맨 위의 대문자 이름들을 고치면 된다.

import random

# region: 조건
GRADES = (1, 2, 3)
STUDENTS_PER_GRADE = 120     # 학년마다 몇 명이 급식을 먹는지
WALK_SECONDS = {1: 60, 2: 90, 3: 120}   # 교실에서 급식실까지 걸리는 시간
WALK_SPREAD = 150            # 사람마다 흩어지는 정도 - 뛰는 사람, 걷는 사람, 들렀다 오는 사람
COUNTERS = 4                 # 배식대 개수
SERVE_MIN = 6                # 한 사람이 배식받는 데 걸리는 시간 - 가장 짧을 때
SERVE_MAX = 10               # 가장 길 때
TOTAL_SECONDS = 2400         # 40분 동안 지켜본다
# endregion


# region: 도착
def arrivals(gap):
    """학생마다 급식실에 닿는 시각을 초 단위로 만들어 돌려준다.

    gap은 학년별로 수업을 마치는 시각의 간격이다.
    0이면 세 학년이 동시에 마친다.
    """
    times = []
    for order, grade in enumerate(GRADES):
        end = order * gap
        for _ in range(STUDENTS_PER_GRADE):
            walk = WALK_SECONDS[grade] + random.randint(0, WALK_SPREAD)
            times.append(end + walk)
    return sorted(times)
# endregion


# region: 한걸음
def run_once(gap):
    """한 번 돌려 가장 긴 줄과 마지막 사람이 받은 시각을 돌려준다."""
    coming = arrivals(gap)
    next_to_arrive = 0
    queue = 0                    # 지금 줄에 선 사람 수
    free_at = [0] * COUNTERS     # 배식대마다 언제 비는지
    longest = 0
    last_served = 0

    for now in range(TOTAL_SECONDS):
        # 이 순간에 닿은 사람들이 줄 뒤에 선다
        while next_to_arrive < len(coming) and coming[next_to_arrive] <= now:
            queue = queue + 1
            next_to_arrive = next_to_arrive + 1

        # 비어 있는 배식대가 앞사람을 받는다
        for c in range(COUNTERS):
            if free_at[c] <= now and queue > 0:
                queue = queue - 1
                free_at[c] = now + random.randint(SERVE_MIN, SERVE_MAX)
                last_served = now

        if queue > longest:
            longest = queue

    return longest, last_served
# endregion


# region: 여러번
def run_many(gap, times=5):
    """같은 조건으로 여러 번 돌려 결과를 모아 돌려준다."""
    longests = []
    lasts = []
    for _ in range(times):
        longest, last = run_once(gap)
        longests.append(longest)
        lasts.append(last)
    return longests, lasts
# endregion


# region: 본문
random.seed(20260824)

print("간격(분)  가장 긴 줄(다섯 번)                    마지막 사람(분)")
for gap_minutes in (0, 2, 5, 10):
    longests, lasts = run_many(gap_minutes * 60)
    average = sum(longests) / len(longests)
    last_minutes = max(lasts) // 60
    print(f"{gap_minutes:>6}  {longests}  평균 {average:5.1f}    {last_minutes}")
# endregion
