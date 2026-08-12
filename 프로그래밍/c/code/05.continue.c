// ---
// check: none
// ---
for (int i = 1; i <= 10; i = i + 1) {
    if (i % 3 != 0) {
        continue;                  // 이번 바퀴만 건너뛰고 «다음 바퀴로» 간다
    }
    printf("%d ", i);              // 3 6 9
}
printf("\n");
