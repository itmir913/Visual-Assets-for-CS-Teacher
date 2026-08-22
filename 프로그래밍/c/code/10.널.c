#include <stdio.h>

int main(void) {
    int *p = NULL;             // 「아직 아무 곳도 가리키지 않는다」는 표시

    if (p == NULL) {
        printf("아직 가리키는 곳이 없습니다.\n");
    }

    int n = 7;
    p = &n;                    // 이제 가리킬 곳이 생겼다

    if (p != NULL) {
        printf("가리키는 곳의 값: %d\n", *p);   // 7
    }

    return 0;
}
