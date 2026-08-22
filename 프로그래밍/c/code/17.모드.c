#include <stdio.h>

int main(void) {
    // 메모리를 배열로 흉내 낸다. 칸 번호가 곧 주소다.
    int memory[8] = {0, 0, 0, 0, 3190, 7, 0, 2022};
    //  칸 번호      0  1  2  3   4    5  6    7

    // region: 직접
    int field = 4;                       // 명령에 적힌 번호

    printf("직접: %d\n", memory[field]); // 4번 칸을 열어 3190을 꺼낸다
    // endregion

    // region: 간접
    field = 5;                           // 이번에도 명령에 적힌 번호

    int real = memory[field];            // 5번 칸을 열었더니 «또 번호»(7)가 있다
    printf("간접: %d\n", memory[real]);  // 그 번호로 다시 가서 2022를 꺼낸다
    // endregion

    return 0;
}
