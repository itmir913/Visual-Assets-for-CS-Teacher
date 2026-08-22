#include <stdio.h>

int main(void) {
    int a;
    int b;

    printf("두 수를 적어 주세요: ");
    scanf("%d %d", &a, &b);

    int *big = &a;             // 일단 a를 가리켜 둔다

    if (b > a) {
        big = &b;              // «가리키는 곳»을 바꾼다
    }

    printf("큰 쪽의 값: %d\n", *big);

    *big = 0;                  // 가리키는 «곳의 값»을 0으로 만든다

    printf("a = %d, b = %d\n", a, b);   // 큰 쪽만 0이 되었다

    return 0;
}
