// ============================================================================
// メインループ — requestAnimationFrame。dtは秒(最大0.05でクランプ)。
// document.hidden 中は更新を止め、復帰時に巨大dtを出さないようにする。
// ============================================================================

const DT_CLAMP = 0.05;

export function startLoop(
  update: (dt: number) => void,
  render: (time: number) => void,
): void {
  let last = performance.now();
  let running = !document.hidden;

  const onVisibility = (): void => {
    running = !document.hidden;
    if (running) {
      // 復帰時: 経過時間をリセットして巨大dtを避ける
      last = performance.now();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);

  const tick = (now: number): void => {
    if (running) {
      let dt = (now - last) / 1000;
      if (dt > DT_CLAMP) dt = DT_CLAMP;
      if (dt < 0) dt = 0;
      last = now;
      update(dt);
      render(now);
    } else {
      // 停止中も last を進め続け、復帰時の飛びを防ぐ
      last = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
