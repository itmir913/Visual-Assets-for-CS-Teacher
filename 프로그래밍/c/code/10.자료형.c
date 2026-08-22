#include <stdio.h>

int main(void) {
    char c = 'A';
    int n = 10;
    double d = 3.5;

    char *pc = &c;
    int *pn = &n;
    double *pd = &d;

    printf("가리키는 것의 크기: %d %d %d\n",
           (int) sizeof(*pc), (int) sizeof(*pn), (int) sizeof(*pd));

    printf("포인터 자신의 크기: %d %d %d\n",
           (int) sizeof(pc), (int) sizeof(pn), (int) sizeof(pd));

    return 0;
}
