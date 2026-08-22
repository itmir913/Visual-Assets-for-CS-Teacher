#include <stdio.h>

int main(void) {
    int num = 2022;
    int *p = &num;

    printf("변수로 읽기   %d\n", num);   // 이름이 곧 값이 있는 자리다
    printf("포인터로 읽기 %d\n", *p);    // 자리를 한 번 더 따라간다

    return 0;
}
