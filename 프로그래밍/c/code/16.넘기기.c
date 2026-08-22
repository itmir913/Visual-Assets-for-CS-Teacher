#include <stdio.h>

int twice(int n) {
    return n * 2;
}

int square(int n) {
    return n * n;
}

void apply(int data[], int len, int (*f)(int)) {   // 「무엇을 할지」를 받는다
    for (int i = 0; i < len; i = i + 1) {
        printf("%d ", f(data[i]));
    }
    printf("\n");
}

int main(void) {
    int data[5] = {1, 2, 3, 4, 5};

    apply(data, 5, twice);     // 2 4 6 8 10
    apply(data, 5, square);    // 1 4 9 16 25

    return 0;
}
