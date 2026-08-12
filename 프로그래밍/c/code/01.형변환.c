// ---
// check: none
// ---
int a = 3;
double b = a;                // 정수 3이 실수 3.0으로 자동으로 넓어진다
printf("%f\n", b);           // 3.000000

double pi = 3.7;
int n = (int) pi;            // 실수를 정수로 좁힐 때는 직접 적는다
printf("%d\n", n);           // 3    소수점 아래는 잘린다
