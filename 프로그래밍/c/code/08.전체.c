#include <stdio.h>
#include <string.h>

int main(void) {
    char word[50];
    char target;

    printf("영어 낱말 하나: ");
    scanf("%49s", word);

    printf("찾을 글자: ");
    scanf(" %c", &target);        // %c 앞의 빈칸이 남은 엔터를 건너뛴다

    int len = (int) strlen(word);
    int count = 0;

    for (int i = 0; i < len; i = i + 1) {
        if (word[i] == target) {
            count = count + 1;
        }
    }

    printf("\n글자 수는 %d입니다.\n", len);

    printf("거꾸로: ");
    for (int i = len - 1; i >= 0; i = i - 1) {
        printf("%c", word[i]);
    }
    printf("\n");

    printf("'%c'는 %d번 나옵니다.\n", target, count);

    return 0;
}
