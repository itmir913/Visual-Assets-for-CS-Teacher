#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int n;

    printf("점수를 몇 개 넣을까요? ");
    scanf("%d", &n);

    if (n <= 0) {
        printf("한 개 이상이어야 합니다.\n");
        return 1;
    }

    int *score = (int *) malloc(n * sizeof(int));

    if (score == NULL) {
        printf("자리를 빌리지 못했습니다.\n");
        return 1;
    }

    int sum = 0;

    for (int i = 0; i < n; i = i + 1) {
        printf("%d번째 점수: ", i + 1);
        scanf("%d", &score[i]);
        sum = sum + score[i];
    }

    printf("\n%d개의 합계 %d, 평균 %.1f\n", n, sum, (double) sum / n);

    free(score);
    score = NULL;        // 돌려준 뒤에는 「아무 곳도 아니다」로 적어 둔다

    return 0;
}
