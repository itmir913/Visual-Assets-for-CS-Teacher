#include <stdio.h>

int main(void) {
    int score[3][4] = {
        {80, 92, 75, 88},
        {60, 71, 95, 84},
        {90, 85, 70, 77}
    };

    // region: 중첩
    for (int row = 0; row < 3; row = row + 1) {        // 바깥이 줄을 고르고
        for (int col = 0; col < 4; col = col + 1) {    // 안쪽이 그 줄을 훑는다
            printf("%4d", score[row][col]);
        }
        printf("\n");                                  // 한 줄이 끝나면 줄을 바꾼다
    }
    // endregion

    return 0;
}
