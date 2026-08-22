#include <stdio.h>

int main(void) {
    // region: 세번
    double r1 = 2.0;
    double r2 = 3.5;
    double r3 = 5.0;

    printf("넓이: %.2f\n", 3.14159 * r1 * r1);   // 같은 식이
    printf("넓이: %.2f\n", 3.14159 * r2 * r2);   // 세 군데에
    printf("넓이: %.2f\n", 3.14159 * r3 * r3);   // 흩어져 있다
    // endregion

    return 0;
}
