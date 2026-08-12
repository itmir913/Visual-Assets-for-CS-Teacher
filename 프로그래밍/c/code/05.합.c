// ---
// check: none
// ---
int sum = 0;                       // 더해 담을 자리를 «반복 밖»에 만든다

for (int i = 1; i <= 100; i = i + 1) {
    sum = sum + i;                 // 앞 바퀴의 결과를 이어받는다
}

printf("1부터 100까지의 합은 %d입니다.\n", sum);   // 5050
