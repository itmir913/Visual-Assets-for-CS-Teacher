#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};   // 칸 다섯 개짜리 자리를 한 번에 만든다

    printf("첫 번째 칸: %d\n", score[0]);
    printf("네 번째 칸: %d\n", score[3]);

    score[2] = 80;                          // 칸 하나만 골라 바꾼다
    printf("바꾼 뒤 세 번째 칸: %d\n", score[2]);

    return 0;
}
