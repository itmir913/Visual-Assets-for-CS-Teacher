#include <stdio.h>

int main(void) {
    int sec;

    printf("초를 입력하세요: ");
    scanf("%d", &sec);

    printf("%d분 %d초\n", sec / 60, sec % 60);
    return 0;
}
