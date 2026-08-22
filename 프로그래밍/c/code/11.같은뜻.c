#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};

    // region: 두방법
    for (int i = 0; i < 5; i = i + 1) {
        printf("%d ", score[i]);          // 익숙한 대괄호
    }
    printf("\n");

    for (int i = 0; i < 5; i = i + 1) {
        printf("%d ", *(score + i));      // 주소를 옮겨 가며 읽기
    }
    printf("\n");
    // endregion

    return 0;
}
