// ---
// check: none
// ---
int i = 10;

do {
    printf("한 번은 반드시 실행됩니다 (i=%d)\n", i);   // 조건이 처음부터 거짓인데도 찍힌다
} while (i <= 5);
