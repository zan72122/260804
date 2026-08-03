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
import { getButtons, buttonCenter } from './ui/layout';
import type { UIAction } from './ui';

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

// ── デバッグ/検証用フック(残置可) ────────────────────────────────────
// ワールド(machine-space or lane-space)座標→画面CSSピクセル座標への変換は
// CameraController.screenToWorld の逆算(applyTransformの逆変換)。
(window as unknown as { __game: unknown }).__game = {
  flow, sim, cam, lm, input, ui,
  screenOf(wx: number, wy: number): { sx: number; sy: number } {
    const layout = lm.layout;
    const zoom = cam.camera.zoom;
    return {
      sx: (wx - cam.camera.x) * zoom + layout.w / 2,
      sy: (wy - cam.camera.y) * zoom + layout.h / 2,
    };
  },
  /** UIボタン(画面座標)の中心を返す。位置はuiState非依存(色/アイコンのみ依存)。 */
  uiButtonScreen(action: UIAction): { sx: number; sy: number } | null {
    const dummy = { muted: false, speedLevel: 1 as 0 | 1 | 2, decorIdx: 0, xray: false };
    const b = getButtons(ui.mode, lm.layout, dummy).find((x) => x.id === action);
    if (!b) return null;
    const c = buttonCenter(b);
    return { sx: c.x, sy: c.y };
  },
};
