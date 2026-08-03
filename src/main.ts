// ============================================================================
// src/main.ts — 全モジュールの生成・配線・メインループ起動。
// ============================================================================
import { LayoutManager } from './core/layout';
import { CameraController } from './core/camera';
import { InputSystem } from './core/input';
import { startLoop } from './core/loop';

import { MachineSim } from './sim';
import { UIOverlay } from './ui';
import { initAudio } from './audio';

import { drawLaneScene } from './render/lane';
import { drawMachineScene } from './render/machine';

import { GameFlow } from './flow';
import type { SceneId } from './core/types';

const canvasEl = document.getElementById('game');
if (!(canvasEl instanceof HTMLCanvasElement)) {
  throw new Error('canvas#game が見つかりません');
}
const canvas: HTMLCanvasElement = canvasEl;

const ctx2d = canvas.getContext('2d');
if (!ctx2d) {
  throw new Error('2D contextを取得できません');
}
const ctx: CanvasRenderingContext2D = ctx2d;

// canvas取得 → LayoutManager → CameraController → InputSystem → MachineSim
// → UIOverlay → initAudio() → GameFlow生成 → registerInteractables/register → startLoop
const lm = new LayoutManager(canvas);
const cam = new CameraController();
const input = new InputSystem(canvas, cam, lm, (): SceneId => flow.scene);
const sim = new MachineSim();
const ui = new UIOverlay(lm);

initAudio();

const flow: GameFlow = new GameFlow({ sim, cam, input, ui, lm });

sim.registerInteractables(input);
ui.register(input);

let clock = 0;

const update = (dt: number): void => {
  clock += dt;
  cam.update(dt);
  sim.update(dt);
  flow.update(dt, clock);
};

const render = (time: number): void => {
  const layout = lm.layout;

  // 画面クリア(画面座標系)
  ctx.save();
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  ctx.clearRect(0, 0, layout.w, layout.h);
  ctx.restore();

  // シーン描画(ワールド座標系 = カメラ変換)
  ctx.save();
  cam.applyTransform(ctx, layout);
  if (flow.scene === 'lane') {
    drawLaneScene(ctx, cam, sim.state, layout, flow.hints, time);
  } else {
    drawMachineScene(ctx, cam, sim.state, layout, flow.hints, time);
  }
  ctx.restore();

  // UIオーバーレイ(画面座標系)
  ctx.save();
  ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
  ui.draw(ctx, layout, time);
  ctx.restore();
};

startLoop(update, render);
