// 「인공지능기초/simulator」 전용 Tailwind 설정.
// 단위마다 설정을 따로 두는 이유 — content를 그 단위로 좁혀야 다른 곳의 클래스가
// 섞여 들어오지 않는다. content가 같으면 산출물이 똑같아져 Rollup이 하나로 합친다.
export default {
    content: ['./인공지능기초/simulator/**/*.html'],
};
