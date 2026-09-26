// ---
// check: none
// ---
// 스마트홈 보안 에이전트의 작동 흐름 (C 문법을 빌린 의사코드)

void runSecurityAgent() {
    while (true) {
        // 1. 인식 (Sensor)
        Image currentView = cameraSensor.captureImage();

        // 2. 추론 (Intelligence)
        Person detectedPerson = aiEngine.analyzeFace(currentView);

        if (detectedPerson == UNKNOWN_PERSON) {
            // 3. 행동 (Actuator)
            speakerActuator.soundAlarm();
            networkModule.callPolice();
        } else if (detectedPerson == FAMILY_MEMBER) {
            doorActuator.unlock();
        }
    }
}
