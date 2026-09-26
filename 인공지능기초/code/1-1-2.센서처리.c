// ---
// check: none
// ---
// 에이전트가 소리를 듣고 인식하는 과정 (C 문법을 빌린 의사코드)

void agentPerception() {
    // [1단계: 환경 정보] 자연의 소리(아날로그) 발생
    AnalogSignal soundWave = environment.getSound();

    // [2단계: 센서] 마이크가 소리를 전기 신호로 바꿈
    ElectricSignal rawSignal = micSensor.detect(soundWave);

    // [3단계: A/D 변환기] 전기 신호를 0과 1의 디지털 데이터로 바꿈
    DigitalData dData = adConverter.transform(rawSignal);

    // [4단계: 인식] 에이전트의 두뇌가 디지털 데이터를 분석해 무슨 말인지 알아봄
    if (aiBrain.isHelpRequest(dData)) {   // 「도와줘」라는 말이면
        actuator.moveTowardUser();        // 판단에 따라 구동기가 움직임(행동)
    }
}
