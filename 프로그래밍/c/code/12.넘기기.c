#include <stdio.h>

void show(int data[][4], int rows) {   // 열 크기 4를 «반드시» 적어야 한다
    for (int row = 0; row < rows; row = row + 1) {
        for (int col = 0; col < 4; col = col + 1) {
            printf("%4d", data[row][col]);
        }
        printf("\n");
    }
}

int main(void) {
    int score[3][4] = {
        {80, 92, 75, 88},
        {60, 71, 95, 84},
        {90, 85, 70, 77}
    };

    show(score, 3);

    return 0;
}
