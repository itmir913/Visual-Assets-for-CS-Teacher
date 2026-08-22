#include <stdio.h>

int main(void) {
    int n = 10;
    char c = 'A';
    double d = 3.5;

    printf("n의 값 %d, n의 자리 %p\n", n, (void *) &n);
    printf("c의 값 %c, c의 자리 %p\n", c, (void *) &c);
    printf("d의 값 %.1f, d의 자리 %p\n", d, (void *) &d);
    // 찍히는 자리 번호는 «돌릴 때마다 달라진다»

    return 0;
}
