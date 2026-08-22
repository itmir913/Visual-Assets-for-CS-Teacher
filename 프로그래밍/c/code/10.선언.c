#include <stdio.h>

int main(void) {
    int n = 10;
    int *p = &n;                      // n이 «있는 자리»를 담는다

    printf("n  = %d\n", n);           // 10   n에 담긴 값
    printf("&n = %p\n", (void *) &n); // n이 있는 자리
    printf("p  = %p\n", (void *) p);  // 같은 자리가 찍힌다
    printf("*p = %d\n", *p);          // 10   p가 가리키는 곳의 값

    return 0;
}
