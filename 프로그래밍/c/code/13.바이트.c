#include <stdio.h>

int main(void) {
    int num = 0x12345678;           // 네 칸에 12 34 56 78이 들어간 정수
    char *p = (char *) &num;        // 같은 자리를 «한 칸씩» 읽겠다고 정한다

    for (int i = 0; i < 4; i = i + 1) {
        printf("%02X ", (unsigned char) *(p + i));
    }
    printf("\n");

    return 0;
}
