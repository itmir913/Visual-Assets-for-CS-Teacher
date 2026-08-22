#include <stdio.h>

int main(void) {
    // region: 본문
    for (int i = 1; i <= 10; i = i + 1) {
        if (i == 4) {
            break;                     // 반복을 «통째로» 끝낸다
        }
        printf("%d ", i);              // 1 2 3
    }
    printf("\n");
    // endregion

    return 0;
}
