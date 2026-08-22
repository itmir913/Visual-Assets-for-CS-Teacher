#include <stdio.h>

void row_sum(int data[][4], int rows) {
    for (int row = 0; row < rows; row = row + 1) {
        int sum = 0;

        for (int col = 0; col < 4; col = col + 1) {
            sum = sum + data[row][col];
        }
        printf("%d번 모둠 합계 %d, 평균 %.1f\n", row, sum, (double) sum / 4);
    }
}

int main(void) {
    int score[3][4] = {
        {80, 92, 75, 88},
        {60, 71, 95, 84},
        {90, 85, 70, 77}
    };

    row_sum(score, 3);

    int best = score[0][0];
    int best_row = 0;
    int best_col = 0;

    for (int row = 0; row < 3; row = row + 1) {
        for (int col = 0; col < 4; col = col + 1) {
            if (score[row][col] > best) {
                best = score[row][col];
                best_row = row;
                best_col = col;
            }
        }
    }

    printf("가장 높은 점수 %d — %d번 모둠의 %d번째 차례\n", best, best_row, best_col);

    return 0;
}
