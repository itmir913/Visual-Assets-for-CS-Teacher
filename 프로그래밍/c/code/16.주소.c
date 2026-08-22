#include <stdio.h>

int twice(int n) {
    return n * 2;
}

int main(void) {
    int (*fp)(int) = twice;      // 함수의 자리를 담는 변수. &를 붙이지 않는다

    printf("%d\n", twice(10));   // 20
    printf("%d\n", fp(10));      // 20 — 같은 일을 한다

    if (fp == twice) {           // 담긴 것이 twice의 자리와 같은지 물어본다
        printf("같은 곳을 가리킵니다\n");
    }

    return 0;
}
