#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int rows = 3;
    int cols = 4;

    int **grid = (int **) malloc(rows * sizeof(int *));   // 줄을 가리킬 자리 셋

    if (grid == NULL) {
        return 1;
    }

    for (int r = 0; r < rows; r = r + 1) {
        grid[r] = (int *) malloc(cols * sizeof(int));     // 줄마다 «따로» 빌린다

        if (grid[r] == NULL) {
            for (int k = 0; k < r; k = k + 1) {           // 앞서 빌린 것부터 돌려준다
                free(grid[k]);
            }
            free(grid);
            return 1;
        }
    }

    for (int r = 0; r < rows; r = r + 1) {
        for (int c = 0; c < cols; c = c + 1) {
            grid[r][c] = (r + 1) * 10 + c;
        }
    }

    for (int r = 0; r < rows; r = r + 1) {
        for (int c = 0; c < cols; c = c + 1) {
            printf("%4d", grid[r][c]);
        }
        printf("\n");
    }

    printf("0번 줄 %p\n", (void *) grid[0]);
    printf("1번 줄 %p\n", (void *) grid[1]);   // 이어 붙어 있지 않다

    for (int r = 0; r < rows; r = r + 1) {     // 줄들을 «먼저» 돌려준다
        free(grid[r]);
    }
    free(grid);                                // grid를 먼저 돌려주면 줄들의 번호를 잃는다

    return 0;
}
