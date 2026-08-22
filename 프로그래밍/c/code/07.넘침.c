#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};

    printf("%d\n", score[4]);   // 마지막 칸. 여기까지가 내 자리다
    printf("%d\n", score[5]);   // 칸 밖이다. C는 막아 주지 않는다

    return 0;
}
