#include <stdio.h>

int main(void) {
    int few[5] = {7, 8};        // 앞의 둘만 적었다
    int zero[5] = {0};          // 다섯 칸을 모두 0으로 채우는 흔한 방법

    for (int i = 0; i < 5; i = i + 1) {
        printf("%d ", few[i]);  // 7 8 0 0 0
    }
    printf("\n");

    for (int i = 0; i < 5; i = i + 1) {
        printf("%d ", zero[i]); // 0 0 0 0 0
    }
    printf("\n");

    return 0;
}
