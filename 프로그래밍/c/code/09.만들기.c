#include <stdio.h>

double area(double r) {              // 돌려줄 종류 / 이름 / 받을 것
    return 3.14159 * r * r;          // 값을 만들어 부른 자리로 돌려준다
}

int main(void) {
    printf("넓이: %.2f\n", area(2.0));
    printf("넓이: %.2f\n", area(3.5));
    printf("넓이: %.2f\n", area(5.0));

    return 0;
}
