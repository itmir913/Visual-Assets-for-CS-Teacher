#include <stdio.h>

int main(void) {
    int n = 10;
    int *p = &n;

    *p = 99;                   // p가 «가리키는 곳»에 99를 넣는다

    printf("n  = %d\n", n);    // 99 — n이라고 적지 않았는데 바뀌었다
    printf("*p = %d\n", *p);   // 99

    return 0;
}
