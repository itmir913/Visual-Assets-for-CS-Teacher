#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};
    char word[5] = "abcd";

    int *pi = score;
    char *pc = word;

    printf("int  : %p %p %p\n", (void *) pi, (void *) (pi + 1), (void *) (pi + 2));
    printf("char : %p %p %p\n", (void *) pc, (void *) (pc + 1), (void *) (pc + 2));
    // 한 걸음에 int는 4바이트, char는 1바이트씩 번호가 는다

    return 0;
}
