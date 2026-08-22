#include <stdio.h>

int main(void) {
    int score[5];
    int sum = 0;

    for (int i = 0; i < 5; i = i + 1) {
        printf("%d번째 점수: ", i + 1);     // 사람에게는 1번부터라고 말한다
        scanf("%d", &score[i]);             // 칸 하나에 곧바로 받는다
    }

    for (int i = 0; i < 5; i = i + 1) {
        sum = sum + score[i];
    }

    double average = (double) sum / 5;

    int over = 0;
    for (int i = 0; i < 5; i = i + 1) {
        if (score[i] > average) {
            over = over + 1;
        }
    }

    printf("\n합계 %d, 평균 %.1f\n", sum, average);
    printf("평균을 넘은 것은 %d개입니다.\n", over);

    return 0;
}
