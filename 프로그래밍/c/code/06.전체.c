#include <stdio.h>

int main(void) {
    int n;

    printf("몇 단까지 볼까요? ");
    scanf("%d", &n);

    for (int dan = 2; dan <= n; dan = dan + 1) {
        for (int i = 1; i <= 9; i = i + 1) {
            printf("%d x %d = %2d   ", dan, i, dan * i);
        }
        printf("\n");
    }
    return 0;
}
