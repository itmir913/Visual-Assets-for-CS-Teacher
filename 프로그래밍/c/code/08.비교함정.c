#include <stdio.h>

int main(void) {
    char a[20] = "apple";
    char b[20] = "apple";

    // region: 함정
    if (a == b) {                 // 담긴 «내용»을 비교하는 것이 아니다
        printf("같습니다\n");
    } else {
        printf("다릅니다\n");     // 내용이 같은데도 이쪽이 찍힌다
    }
    // endregion

    return 0;
}
