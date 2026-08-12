// ---
// check: none
// ---
int sum = 100;
int count = 0;                    // 아직 아무도 응답하지 않았다

if (count != 0 && sum / count >= 60) {
    printf("평균이 60점 이상입니다\n");
} else {
    printf("아직 평균을 낼 수 없습니다\n");   // 이쪽이 실행된다
}

// count가 0이라 왼쪽이 거짓 → 오른쪽 sum / count는 «계산되지 않는다»
// 만약 계산했다면 0으로 나누어 프로그램이 그 자리에서 죽는다
