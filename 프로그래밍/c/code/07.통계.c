#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};

    // region: 합
    int sum = 0;

    for (int i = 0; i < 5; i = i + 1) {
        sum = sum + score[i];               // 칸을 하나씩 짚어 더한다
    }

    printf("합계는 %d입니다.\n", sum);      // 408
    // endregion

    // region: 최댓값
    int best = score[0];                    // 첫 칸을 임시 우승자로 세운다

    for (int i = 1; i < 5; i = i + 1) {     // 두 번째 칸부터 대어 본다
        if (score[i] > best) {
            best = score[i];
        }
    }

    printf("가장 큰 값은 %d입니다.\n", best);   // 95
    // endregion

    // region: 개수
    int count = sizeof(score) / sizeof(score[0]);

    printf("칸은 모두 %d개입니다.\n", count);   // 5
    // endregion

    return 0;
}
