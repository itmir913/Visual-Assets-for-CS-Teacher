input_data = 2       # 예시 입력값
target_answer = 4    # 예시 정답: 가중치가 2가 되면 맞힌다

def train_ai():
    weight = 0.5          # 처음에 아무렇게나 정해 둔 가중치
    learning_rate = 0.1   # 학습률: 한 번에 얼마나 크게 고칠지 (너무 크면 골짜기를 건너뛴다)

    for step in range(100):  # 최대 100번까지 가중치를 고쳐 나간다
        prediction = input_data * weight
        error = target_answer - prediction  # 오차: 정답과 예측이 얼마나 다른가?

        if abs(error) < 1e-6:  # 오차가 충분히 작아지면 멈춘다
            print(f"{step}번 고친 뒤 학습 완료! 가중치 = {weight:.4f}")
            return weight

        # 핵심: 오차와 입력값에 비례해서, 손실이 줄어드는 쪽으로 가중치를 고친다 (경사하강법)
        weight = weight + (error * input_data * learning_rate)

    print(f"100번 고쳤지만 오차가 남았습니다. 가중치 = {weight:.4f}")
    return weight

train_ai()
