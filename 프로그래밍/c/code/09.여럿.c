#include <stdio.h>

int bigger(int a, int b) {           // 받을 것이 둘이면 쉼표로 잇는다
    if (a > b) {
        return a;                    // return을 만나면 «그 자리에서» 함수가 끝난다
    }
    return b;
}

int main(void) {
    printf("%d\n", bigger(7, 3));    // 7
    printf("%d\n", bigger(2, 9));    // 9

    return 0;
}
