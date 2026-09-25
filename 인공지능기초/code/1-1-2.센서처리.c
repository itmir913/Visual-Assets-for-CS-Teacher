// ---
// check: none
// ---
// 에이전트가 소리를 듣고 인식하는 과정

void agentPerception() {
    // [1단계: 환경 정보] 자연의 소리(아날로그) 발생
    AnalogSignal soundWave = environment.getSound();

    // [2단계: 센서] 마이크가 소리를 전기 신호로 바꿈
    ElectricSignal rawSignal = micSensor.detect(soundWave);

    // [3단계: A/D 변환기] 컴퓨터의 통역사 등장!
    DigitalData dData = adConverter.transform(rawSignal);

    // [4단계: 인식] 에이전트의 두뇌가 디지털 데이터를 분석함
    if (aiBrain.recognizeVoice(dData) == "도와줘") {
        actuator.moveTowardUser();
    }
}
