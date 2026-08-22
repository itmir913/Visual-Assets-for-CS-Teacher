#include <stdio.h>

void swap(int *a, int *b) {
    int temp = *a;                 // a가 «가리키는 곳»의 값을 빼 둔다
    *a = *b;
    *b = temp;
}

int main(void) {
    int x = 1;
    int y = 2;

    swap(&x, &y);

    printf("x = %d, y = %d\n", x, y);   // 2 1 — 밖까지 바뀌었다

    return 0;
}
