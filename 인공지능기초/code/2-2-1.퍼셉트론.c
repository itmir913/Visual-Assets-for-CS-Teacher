#include <stdio.h>

int main(void) {
    // region: 퍼셉트론
    // 고양이 귀 모양(입력1)과 수염 모양(입력2) 데이터
    int input_ear = 80;
    int input_whisker = 60;

    // 각 특징에 대한 중요도(가중치) 설정
    float weight_ear = 0.6;   // 귀 모양이 더 중요함
    float weight_whisker = 0.4;

    // 1. 입력값에 가중치를 곱하여 모두 합산합니다.
    float total_score = (input_ear * weight_ear) + (input_whisker * weight_whisker);
    // 계산: (80 * 0.6) + (60 * 0.4) = 48 + 24 = 72

    float threshold = 70.0;   // 고양이라고 판단하는 기준 점수

    // 2. 기준 점수를 넘는지 판단합니다. (활성화 함수 역할)
    if (total_score > threshold) {
        printf("고양이라고 판단합니다.\n");
    } else {
        printf("고양이가 아니라고 판단합니다.\n");
    }
    // endregion
    return 0;
}
