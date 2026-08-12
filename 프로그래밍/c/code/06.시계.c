// ---
// check: none
// ---
for (int min = 1; min <= 3; min = min + 1) {        // 바깥: 분침
    for (int sec = 1; sec <= 4; sec = sec + 1) {    // 안쪽: 초침
        printf("%d분 %d초  ", min, sec);
    }
    printf("\n");                                    // 안쪽이 «다 끝난 뒤» 줄을 바꾼다
}
