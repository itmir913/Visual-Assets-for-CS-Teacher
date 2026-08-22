#include <stdio.h>

int main(void) {
    int score[3][4] = {
        {80, 92, 75, 88},
        {60, 71, 95, 84},
        {90, 85, 70, 77}
    };

    // region: 주소
    printf("score[0][0] %p\n", (void *) &score[0][0]);
    printf("score[0][3] %p\n", (void *) &score[0][3]);
    printf("score[1][0] %p\n", (void *) &score[1][0]);   // 바로 앞 칸에 이어 붙어 있다
    // endregion

    // region: 통째로
    int *p = &score[0][0];

    for (int i = 0; i < 12; i = i + 1) {
        printf("%d ", *(p + i));       // 줄을 나누지 않고 열두 칸을 내리 읽는다
    }
    printf("\n");
    // endregion

    printf("배열 전체 %d칸, 한 줄 %d칸\n",
           (int) (sizeof(score) / sizeof(int)),
           (int) (sizeof(score[0]) / sizeof(int)));

    return 0;
}
