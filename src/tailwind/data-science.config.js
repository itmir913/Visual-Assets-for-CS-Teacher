// 「데이터과학」 전용 Tailwind 설정.
// 과목마다 설정을 따로 두는 이유 — 과목이 갈라지면 CSS가 달라져도 되고,
// content를 그 과목으로 좁혀야 다른 과목의 클래스가 섞여 들어오지 않는다.
// (content가 같으면 산출물이 똑같아져 Rollup이 하나로 합쳐 버린다.)
export default {
    content: ['./데이터과학/**/*.html'],
};
