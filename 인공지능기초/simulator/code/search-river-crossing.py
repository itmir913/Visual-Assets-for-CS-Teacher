from collections import deque

# 상태: (농부, 늑대, 양, 양배추)  0=왼쪽, 1=오른쪽
INITIAL = (0, 0, 0, 0)
GOAL    = (1, 1, 1, 1)

def is_safe(state):
    farmer, wolf, sheep, cabbage = state
    # 농부 없는 쪽에 늑대·양이 같이 있으면 위험
    if wolf == sheep and farmer != wolf:
        return False
    # 농부 없는 쪽에 양·양배추가 같이 있으면 위험
    if sheep == cabbage and farmer != sheep:
        return False
    return True

def bfs():
    queue   = deque([(INITIAL, [])])   # (현재 상태, 경로)
    visited = {INITIAL}

    while queue:
        state, path = queue.popleft()

        if state == GOAL:
            return path  # 최단 경로 반환

        farmer = state[0]
        # 연산자: 농부가 혼자 / 늑대와 / 양과 / 양배추와 건넌다
        for cargo in [None, 1, 2, 3]:   # None=혼자, 1=늑대, 2=양, 3=양배추
            # 데려갈 대상이 농부와 같은 쪽에 있어야 한다
            if cargo is not None and state[cargo] != farmer:
                continue

            new = list(state)
            new[0] = 1 - farmer          # 농부 이동
            if cargo is not None:
                new[cargo] = new[0]      # 화물도 함께 이동

            new_state = tuple(new)
            if new_state not in visited and is_safe(new_state):
                visited.add(new_state)
                queue.append((new_state, path + [(state, new_state)]))

    return None   # 해 없음 (이 문제에선 발생하지 않음)

solution = bfs()
print(f"최단 해: {len(solution)}번 건너기")  # → 7번
