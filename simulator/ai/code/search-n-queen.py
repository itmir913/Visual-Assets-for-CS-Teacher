# DFS(깊이 우선 탐색)를 이용한 N-Queen 백트래킹
def solve_n_queens(row, n, state):
    if row == n:
        return True # 트리 끝단 도달! 정답을 찾음

    for col in range(n):
        # 1. 시도 (Try) 및 가지치기(Pruning) 검사
        if is_safe(row, col, state):
            state[row] = col  # 안전하다면 퀸을 배치 (Place)

            # 2. 다음 줄(depth) 탐색을 위해 재귀 호출 (자식 노드로 이동)
            if solve_n_queens(row + 1, n, state):
                return True

            # 3. 백트래킹 (Backtracking)
            # 자식 노드에서 답을 못 찾고 돌아왔으므로 상태를 복구하고 다른 칸 시도
            state[row] = -1

    return False # 이 노드의 모든 자식 경로에 답이 없음
