#include <stdio.h>

int main(void) {
    // region: 두가지
    char a[6] = {'h', 'e', 'l', 'l', 'o', '\0'};   // 칸을 하나씩 채운다
    char b[6] = "hello";                            // 큰따옴표로 한 번에 채운다
    char c[] = "hello";                             // 칸 수를 적지 않으면 알아서 잡힌다

    printf("%s\n", a);
    printf("%s\n", b);
    printf("%s\n", c);
    // endregion

    return 0;
}
