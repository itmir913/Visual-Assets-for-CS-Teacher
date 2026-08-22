#include <stdio.h>

int main(void) {
    int num = 60;
    int *p = &num;
    int **q = &p;                  // p가 «있는 자리»를 담는다

    printf("num = %d\n", num);     // 60
    printf("*p  = %d\n", *p);      // 60   한 번 따라간다
    printf("**q = %d\n", **q);     // 60   두 번 따라간다

    printf("p  = %p\n", (void *) p);
    printf("*q = %p\n", (void *) *q);   // p에 담긴 것과 같은 번호

    **q = 99;                      // 두 번 따라가 num을 바꾼다
    printf("num = %d\n", num);     // 99

    return 0;
}
