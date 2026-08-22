#include <stdio.h>

void change(int *p) {              // 값이 아니라 «자리»를 받는다
    *p = 100;                      // 받은 자리로 찾아가 값을 넣는다
}

int main(void) {
    int n = 7;

    change(&n);                    // n의 자리를 알려 준다

    printf("n = %d\n", n);         // 100 — 이번에는 바뀌었다

    return 0;
}
