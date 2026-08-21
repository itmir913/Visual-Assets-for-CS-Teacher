def hanoi(n, src, aux, dst, moves=[]):
    """
    n   : 이동할 원판 수
    src : 출발 기둥 ('A', 'B', 'C')
    aux : 보조 기둥
    dst : 목표 기둥
    """
    if n == 0:
        return  # 기저 사례: 원판 0개 → 아무것도 안 함

    # ① 위의 n-1개를 보조 기둥으로 옮긴다  (연산자 조건 자동 충족)
    hanoi(n - 1, src, dst, aux, moves)

    # ② 가장 큰 원판을 목표 기둥으로 옮긴다
    #    조건 전제: dst 맨 위가 비어 있거나 더 큰 원판임 → 항상 보장됨
    moves.append((src, dst))

    # ③ 보조 기둥의 n-1개를 목표 기둥으로 옮긴다
    hanoi(n - 1, aux, src, dst, moves)

    return moves

solution = hanoi(3, 'A', 'B', 'C')
print(f"총 이동 횟수: {len(solution)}")  # → 7
# solution = [('A','C'), ('A','B'), ('C','B'), ('A','C'), ('B','A'), ('B','C'), ('A','C')]
