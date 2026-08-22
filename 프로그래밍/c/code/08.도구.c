#include <stdio.h>
#include <string.h>

int main(void) {
    char a[20] = "banana";
    char b[20] = "apple";
    char copy[20];

    printf("글자 수: %d\n", (int) strlen(a));      // 6

    strcpy(copy, a);                                // a에 담긴 것을 copy로 옮겨 적는다
    printf("옮겨 적은 것: %s\n", copy);             // banana

    if (strcmp(a, b) == 0) {                        // 같으면 0을 돌려준다
        printf("같습니다\n");
    } else {
        printf("다릅니다\n");                       // 다릅니다
    }

    return 0;
}
