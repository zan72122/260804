// src/main.ts
// 所有: A1 scaffold（凍結。A7統合のみ修正可）

import { createInitialState } from './core/state';
import { layout } from './core/layout';
import { input } from './input/gestures';
import { hud } from './ui/hud';
import { audio } from './audio/engine';
import { scene } from './render/scene';
import { flow } from './game/flow';
import { effects } from './render/effects';

const DT_MAX = 0.05;

function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('canvas#game not found');
  }
  const maybeCtx = canvas.getContext('2d');
  if (!maybeCtx) {
    throw new Error('2D context not available');
  }
  const ctx: CanvasRenderingContext2D = maybeCtx;

  const state = createInitialState();

  layout.init(canvas);
  input.attach(canvas);
  hud.init(state);

  let audioInitialized = false;
  const initAudioOnce = () => {
    if (audioInitialized) return;
    audioInitialized = true;
    audio.init();
    window.removeEventListener('pointerdown', initAudioOnce);
  };
  window.addEventListener('pointerdown', initAudioOnce, { once: true });

  const onResize = () => {
    flow.layoutChanged(state);
    layout.snapCamera();
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  flow.start(state);

  let lastTime = performance.now();

  function frame(now: number) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > DT_MAX) dt = DT_MAX;
    if (dt < 0) dt = 0;

    state.time += dt;

    // update順 (CONTRACT.md)
    input.update(dt);
    flow.update(dt, state);
    state.escalator.update(dt);
    if (state.fault) {
      state.fault.modelEffect(state.escalator);
    }
    effects.update(dt);
    audio.update(dt, state);
    layout.update(dt);

    // render順
    scene.render(ctx, state);
    hud.sync(state);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

boot();
