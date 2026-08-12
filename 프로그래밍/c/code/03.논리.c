// ---
// check: none
// ---
int score = 85;
printf("%d\n", score >= 80 && score < 90);   // 1   둘 다 참이어야 참
printf("%d\n", score < 60 || score > 90);    // 0   하나만 참이어도 참
printf("%d\n", !(score >= 80));              // 0   뒤집는다
