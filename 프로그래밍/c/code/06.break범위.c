// ---
// check: none
// ---
for (int a = 1; a <= 3; a = a + 1) {
    for (int b = 1; b <= 3; b = b + 1) {
        if (b == 2) {
            break;                 // «안쪽» 반복만 빠져나온다. 바깥은 계속 돈다
        }
        printf("a=%d b=%d\n", a, b);
    }
}
