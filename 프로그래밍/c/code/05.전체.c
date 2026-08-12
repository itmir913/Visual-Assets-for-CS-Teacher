#include <stdio.h>

int main(void) {
    int n;
    int sum = 0;

    printf("몇 번째 수까지 더할까요? ");
    scanf("%d", &n);

    for (int i = 1; i <= n; i = i + 1) {
        sum = sum + i;
    }

    printf("1부터 %d까지의 합은 %d, 평균은 %.2f입니다.\n", n, sum, (double) sum / n);
    return 0;
}
