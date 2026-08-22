#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};
    int *p = score;                       // &를 붙이지 않았는데 그대로 들어간다

    printf("score     %p\n", (void *) score);
    printf("&score[0] %p\n", (void *) &score[0]);
    printf("p         %p\n", (void *) p);
    // 셋이 같은 번호를 찍는다

    printf("*p = %d\n", *p);              // 88 — 첫 칸의 값

    return 0;
}
