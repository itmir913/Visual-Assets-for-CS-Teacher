#include <stdio.h>

void star(int n) {                   // 받기는 하지만 돌려주지 않는다
    for (int i = 0; i < n; i = i + 1) {
        printf("*");
    }
    printf("\n");
}

void line(void) {                    // 받지도 돌려주지도 않는다
    printf("--------\n");
}

int main(void) {
    line();
    star(3);
    star(5);
    line();

    return 0;
}
