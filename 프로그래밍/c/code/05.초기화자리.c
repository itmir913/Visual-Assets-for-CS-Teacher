// ---
// check: none
// ---
for (int i = 1; i <= 3; i = i + 1) {
    int sum = 0;                   // 자리를 «안»에 만들면 바퀴마다 0으로 되돌아간다
    sum = sum + i;
    printf("%d ", sum);            // 1 2 3   합이 쌓이지 않는다
}
printf("\n");
