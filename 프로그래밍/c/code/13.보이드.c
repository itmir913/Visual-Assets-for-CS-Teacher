#include <stdio.h>

int main(void) {
    int n = 10;
    double d = 3.5;

    void *p;                        // 무엇을 가리킬지 «아직 정하지 않는다»

    p = &n;                         // 정수의 자리를 담아도 되고
    printf("정수: %d\n", *(int *) p);

    p = &d;                         // 실수의 자리를 담아도 된다
    printf("실수: %.1f\n", *(double *) p);

    return 0;
}
