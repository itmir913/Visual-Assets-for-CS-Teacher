#include <stdio.h>

void swap(int a, int b) {
    int temp = a;
    a = b;
    b = temp;
    printf("함수 안: a=%d b=%d\n", a, b);     // 2 1 — 안에서는 바뀌었다
}

int main(void) {
    int x = 1;
    int y = 2;

    swap(x, y);
    printf("함수 밖: x=%d y=%d\n", x, y);     // 1 2 — 밖은 그대로다

    return 0;
}
