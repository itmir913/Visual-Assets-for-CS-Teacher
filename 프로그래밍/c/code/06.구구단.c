// ---
// check: none
// ---
for (int dan = 2; dan <= 4; dan = dan + 1) {
    printf("--- %d단 ---\n", dan);
    for (int i = 1; i <= 3; i = i + 1) {
        printf("%d x %d = %d\n", dan, i, dan * i);
    }
}
