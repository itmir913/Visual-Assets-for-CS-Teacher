#include <stdio.h>

int main(void) {
    int kor, eng;

    printf("국어와 영어 점수를 입력하세요: ");
    scanf("%d %d", &kor, &eng);

    printf("합계 %d점, 평균 %.1f점\n", kor + eng, (kor + eng) / 2.0);
    return 0;
}
