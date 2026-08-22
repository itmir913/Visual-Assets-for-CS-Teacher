#include <stdio.h>

int is_prime(int n) {                // 소수면 1, 아니면 0을 돌려준다
    if (n < 2) {
        return 0;
    }
    for (int i = 2; i < n; i = i + 1) {
        if (n % i == 0) {
            return 0;                // 나누어떨어지면 그 자리에서 끝낸다
        }
    }
    return 1;
}

void show(int n) {
    if (is_prime(n)) {               // 함수 안에서 다른 함수를 부를 수 있다
        printf("%d ", n);
    }
}

int main(void) {
    int last;

    printf("어디까지 볼까요? ");
    scanf("%d", &last);

    for (int n = 2; n <= last; n = n + 1) {
        show(n);
    }
    printf("\n");

    return 0;
}
