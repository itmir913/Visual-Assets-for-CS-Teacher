#include <stdio.h>

void show(void *data, char kind) {   // 무엇이 올지 모르는 채로 받는다
    if (kind == 'i') {
        printf("정수 %d\n", *(int *) data);
    } else if (kind == 'd') {
        printf("실수 %.2f\n", *(double *) data);
    } else if (kind == 'c') {
        printf("글자 %c\n", *(char *) data);
    } else {
        printf("모르는 종류입니다\n");
    }
}

int main(void) {
    int n = 10;
    double d = 3.5;
    char c = 'A';

    void *slot[3] = {&n, &d, &c};    // 종류가 다른 것들의 자리를 한 배열에 담는다
    char kind[3] = {'i', 'd', 'c'};  // 무엇인지는 따로 적어 둔다

    for (int i = 0; i < 3; i = i + 1) {
        show(slot[i], kind[i]);
    }

    return 0;
}
