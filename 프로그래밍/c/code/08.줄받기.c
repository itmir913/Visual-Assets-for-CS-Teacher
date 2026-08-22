#include <stdio.h>

int main(void) {
    char line[50];

    printf("좋아하는 문장을 적어 주세요: ");
    fgets(line, 50, stdin);       // 빈칸이 있어도 줄 끝까지 받는다

    printf("적어 준 문장: %s", line);   // 줄바꿈까지 담겨 있어 \n을 더 찍지 않는다

    return 0;
}
