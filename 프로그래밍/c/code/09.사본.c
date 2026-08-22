#include <stdio.h>

void change(int n) {                 // 여기 n은 «사본»이다
    n = 100;
    printf("함수 안: %d\n", n);      // 100
}

int main(void) {
    int n = 7;                       // 여기 n과 위의 n은 서로 다른 자리다

    change(n);
    printf("함수 밖: %d\n", n);      // 7 — 그대로다

    return 0;
}
