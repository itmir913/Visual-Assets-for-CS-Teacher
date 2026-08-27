// 「index.html」 전용 Tailwind 설정.
// 단위마다 설정을 따로 두는 이유 — content를 그 단위로 좁혀야 다른 곳의 클래스가
// 섞여 들어오지 않는다. content가 같으면 산출물이 똑같아져 Rollup이 하나로 합친다.
// `simulator/index.html`은 index.html에서 구워 낸 것이라 쓰는 클래스가 그 부분집합이다.
// 굳이 함께 적는 것은 **같은 CSS를 링크하는 페이지를 여기에 다 적어 두기 위해서다** —
// 나중에 구운 쪽에만 있는 클래스가 생겨도 저절로 굽힌다. → tools/gen_simulator_index.py
export default {
    content: ['./index.html', './simulator/index.html', './privacy/index.html'],
};
