// 「simulator」 전용 Tailwind 설정.
// 단위마다 설정을 따로 두는 이유 — content를 그 단위로 좁혀야 다른 곳의 클래스가
// 섞여 들어오지 않는다. content가 같으면 산출물이 똑같아져 Rollup이 하나로 합친다.
// `simulator/index.html`은 시뮬레이터가 아니라 **입구**다. index.css를 링크하므로
// 여기서 빼지 않으면 그 페이지의 클래스가 시뮬레이터 스물셋의 CSS에 얹혀 나간다.
export default {
    content: ['./simulator/**/*.html', '!./simulator/index.html'],
};
