#include <stdio.h>

void look(int data[], int len) {
    printf("함수 안에서 sizeof(data) = %d\n", (int) sizeof(data));

    data[0] = 0;                   // 받은 배열의 칸을 바꾼다
    printf("len으로 받은 칸 수 = %d\n", len);
}

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};

    printf("함수 밖에서 sizeof(score) = %d\n", (int) sizeof(score));

    look(score, 5);

    printf("score[0] = %d\n", score[0]);   // 0 — 함수 안에서 바꾼 것이 남았다

    return 0;
}
