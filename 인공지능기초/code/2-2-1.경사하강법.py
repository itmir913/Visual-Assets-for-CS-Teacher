input_data = 2       # 예시 입력값
target_answer = 4    # 예시 정답: 가중치가 2가 되면 맞힌다

def train_ai():
    weight = 0.5          # 인공지능이 무작위로 찍은 초기 가중치
    learning_rate = 0.1   # 발걸음 크기 (너무 크면 산을 넘어버림!)

    for step in range(100): # 100번 반복해서 산을 내려갑니다
        prediction = input_data * weight
        error = target_answer - prediction  # 오차(Loss) 계산: 정답과 얼마나 다른가?

        # 핵심: 오차와 입력값에 비례해서 손실이 줄어드는 쪽으로 가중치를 수정합니다 (경사하강법)
        weight = weight + (error * input_data * learning_rate)

        if abs(error) < 1e-6:  # 오차가 충분히 작아지면 멈춥니다
            print("학습 완료! 오차가 충분히 작아졌습니다.")
            break
