// ---
// check: none
// ---
for (int line = 1; line <= 4; line = line + 1) {
    for (int star = 1; star <= line; star = star + 1) {   // 안쪽 횟수가 «바깥 값»에 달렸다
        printf("*");
    }
    printf("\n");
}
