#include <stdio.h>
#include <string.h>

int main(void) {
    char eng[] = "hi";
    char kor[] = "안녕";

    printf("hi 는 %d칸\n", (int) strlen(eng));     // 2
    printf("안녕 은 %d칸\n", (int) strlen(kor));   // 6

    return 0;
}
