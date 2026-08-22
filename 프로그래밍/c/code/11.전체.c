#include <stdio.h>

void min_max(int data[], int len, int *small, int *big) {
    *small = data[0];
    *big = data[0];

    for (int i = 1; i < len; i = i + 1) {
        if (data[i] < *small) {
            *small = data[i];
        }
        if (data[i] > *big) {
            *big = data[i];
        }
    }
}

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};
    int lo;
    int hi;

    min_max(score, 5, &lo, &hi);   // 담아 올 자리 둘을 함께 넘긴다

    printf("가장 작은 값 %d, 가장 큰 값 %d\n", lo, hi);   // 61, 95

    return 0;
}
