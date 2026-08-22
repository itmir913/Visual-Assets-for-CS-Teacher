#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *a = (int *) malloc(5 * sizeof(int));
    int *b = (int *) calloc(5, sizeof(int));       // 개수와 크기를 따로 적는다

    if (a == NULL || b == NULL) {
        return 1;
    }

    printf("malloc: ");
    for (int i = 0; i < 5; i = i + 1) {
        printf("%d ", a[i]);        // 무엇이 들어 있을지 «정해져 있지 않다»
    }

    printf("\ncalloc: ");
    for (int i = 0; i < 5; i = i + 1) {
        printf("%d ", b[i]);        // 0 0 0 0 0
    }
    printf("\n");

    free(a);
    free(b);

    return 0;
}
