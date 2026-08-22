#include <stdio.h>

int main(void) {
    // region: 선언
    int score[3][4] = {
        {80, 92, 75, 88},      // 0번 모둠의 네 차례
        {60, 71, 95, 84},      // 1번 모둠
        {90, 85, 70, 77}       // 2번 모둠
    };
    // endregion

    // region: 짚기
    printf("0번 모둠의 첫 차례: %d\n", score[0][0]);   // 80
    printf("1번 모둠의 세 번째: %d\n", score[1][2]);   // 95

    score[2][3] = 100;                                 // 칸 하나만 바꾼다
    printf("2번 모둠의 마지막: %d\n", score[2][3]);    // 100
    // endregion

    return 0;
}
