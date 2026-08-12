// ---
// check: none
// ---
int count = 0;

for (int n = 1; n <= 20; n = n + 1) {
    if (n % 3 == 0) {              // 되풀이 «안»에서 갈라진다
        printf("%d ", n);          // 3 6 9 12 15 18
        count = count + 1;
    }
}

printf("\n3의 배수는 모두 %d개입니다.\n", count);
