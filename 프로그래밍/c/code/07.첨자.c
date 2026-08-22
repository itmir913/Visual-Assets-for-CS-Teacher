#include <stdio.h>

int main(void) {
    int score[5] = {88, 95, 74, 61, 90};

    printf("칸 번호 : 0   1   2   3   4\n");
    printf("담긴 값 : ");

    for (int i = 0; i < 5; i = i + 1) {     // 0에서 시작해 5 «미만»까지
        printf("%d  ", score[i]);
    }
    printf("\n");

    return 0;
}
