/* 캔버스를 **제 상자에 딱 맞는 해상도**로 맞춘다.
   `<canvas>` 는 그리는 격자(`width`/`height` 속성)와 화면에 차지하는 크기(CSS)가 따로 논다.
   둘을 맞춰 주지 않으면 브라우저가 그림을 늘려서 얹으므로 선과 글자가 흐려진다.
   2배 화면(요즘 노트북 대부분)과 4K 교실 화면에서 특히 눈에 띈다.

       const {w, h} = window.fitCanvas(canvas, ctx);   // w·h 는 CSS 픽셀
       ctx.clearRect(0, 0, w, h);                      // 그리기는 CSS 픽셀로 한다

   **여기 있던 것과 같은 코드가 시뮬레이터 여섯 곳에 제각각 복사돼 있었다.**
   여섯이 조금씩 달랐고, 그중 셋은 아래 함정에 걸려 있었다.

   함정 셋 — 고치기 전에 읽을 것.

   1. **인라인 `style.width` 를 얹지 않는다.** 여기서 px 을 박으면 그 값과 `w-full h-full`
      이 계산한 값이 소수점에서 어긋나, 부모의 `overflow-hidden` 이 없는 자리(전체 화면
      모드가 그렇다)에서 **스크롤바로 드러난다.** CSS 크기는 CSS 가 정하게 둔다.
   2. **`getBoundingClientRect()` 가 아니라 `clientWidth`/`clientHeight` 로 잰다.**
      rect 는 테두리까지 포함하고 소수로 나오므로, 테두리가 있는 상자에서는 캔버스의
      실제 CSS 크기보다 크게 잡힌다. 그러면 그림이 미세하게 줄어든 채 그려진다.
   3. **`scale()` 이 아니라 `setTransform()` 으로 덮어쓴다.** `scale` 은 지금 변환에
      곱하는 것이라, 크기가 그대로여서 `canvas.width` 대입이 변환을 되돌려 주지 않는
      경로에서는 배율이 쌓인다.

   돌려주는 `w`·`h` 는 **CSS 픽셀**이다. 그리는 쪽은 이 값만 쓰고 `canvas.width` 를
   보지 않는다 — `canvas.width` 는 화면 배율이 곱해진 값이라 자리 계산이 어긋난다. */

/* **상자는 창 크기와 상관없이 바뀔 수 있다.** 옆 칸이 접혔다 펴지거나, 글꼴이 늦게 와서
   배치가 다시 잡히거나, 탭을 열어 숨어 있던 칸이 크기를 갖는 순간이 그렇다.
   창이 그대로면 `resize` 가 오지 않으므로, 그때 캔버스는 **옛 크기로 굳는다.**

   그래서 창이 아니라 **상자를 지켜본다.** 크기가 달라지면 `resize` 를 한 번 보내는데,
   시뮬레이터는 모두 그것을 듣고 자기를 다시 재므로 페이지마다 손볼 것이 없다.

   **되돌이가 생기지 않는다** — 이 라이브러리는 캔버스에 인라인 크기를 얹지 않으므로
   다시 재도 상자 크기는 그대로다. 그래도 실제로 달라졌을 때만 알리도록 한 번 더 막아 둔다. */
const watched = new WeakSet();

function keepFitted(box) {
    if (typeof ResizeObserver === 'undefined' || watched.has(box)) return;
    watched.add(box);
    let last = box.clientWidth + 'x' + box.clientHeight;
    new ResizeObserver(() => {
        const now = box.clientWidth + 'x' + box.clientHeight;
        if (now === last) return;
        last = now;
        window.dispatchEvent(new Event('resize'));
    }).observe(box);
}

window.fitCanvas = function fitCanvas(canvas, ctx, box = canvas.parentElement) {
    const w = box.clientWidth;
    const h = box.clientHeight;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    keepFitted(box);
    return {w, h};
};

/* 그리는 좌표계를 **고정된 크기로 붙들어 두고** 해상도만 화면에 맞추는 판.

       window.fitCanvasFixed(canvas, ctx, 400, 400);   // 그리기는 언제나 0~400

   위의 `fitCanvas` 는 화면이 커지면 그리는 좌표계도 함께 커진다. 그러면 **화면 크기로
   저장해 둔 값이 흔들린다** — 학생이 찍은 점을 캔버스 좌표로 들고 있는 페이지에서는
   창을 줄이는 순간 점이 상자 밖으로 나간다. 그런 페이지는 좌표계를 고정하고
   배율만 바꾼다. 그리는 쪽은 넘겨준 고정 크기만 쓰면 되고 아무것도 고칠 것이 없다. */
window.fitCanvasFixed = function fitCanvasFixed(canvas, ctx, logicalW, logicalH) {
    const dpr = window.devicePixelRatio || 1;
    // 화면에 그려지는 크기. CSS 가 아직 안 잡혔으면 고정 크기 그대로 둔다.
    const scale = ((canvas.clientWidth || logicalW) / logicalW) * dpr;

    canvas.width = Math.round(logicalW * scale);
    canvas.height = Math.round(logicalH * scale);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);

    keepFitted(canvas);
    return {w: logicalW, h: logicalH};
};
