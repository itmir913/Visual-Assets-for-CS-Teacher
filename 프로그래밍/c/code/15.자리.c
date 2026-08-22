#include <stdio.h>

int main(void) {
    int num = 60;
    int *p = &num;

    printf("num의 값       %d\n", num);
    printf("p가 담은 값    %p\n", (void *) p);    // num이 있는 자리
    printf("p 자신의 자리  %p\n", (void *) &p);   // 다른 번호다

    return 0;
}
