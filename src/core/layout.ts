// src/core/layout.ts (A1 scaffold — 凍結)
//
// 座標系メモ (A2 scene.render 実装者向け):
// - canvas の CSS サイズは layout.w x layout.h、実ピクセルは (w*dpr) x (h*dpr)
// - scene.render は毎フレーム冒頭で以下のように ctx にカメラ変換を適用する想定:
//     ctx.setTransform(layout.dpr, 0, 0, layout.dpr, 0, 0);
//     ctx.translate(layout.w / 2, layout.h / 2);
//     ctx.scale(layout.camera.scale, layout.camera.scale);
//     ctx.translate(-layout.camera.cx, -layout.camera.cy);
// - layout.worldToScreen / screenToWorld はこの変換と整合する CSS ピクセル座標を返す
//   (dpr は含まない。pointer/touch イベントの clientX/clientY 系と同じスケール)

export interface Camera { cx: number; cy: number; scale: number; } // ワールド中心+倍率

const CAMERA_LERP_PER_SEC = 6; // 追従の速さ(大きいほど速く目標へ収束)

let canvasEl: HTMLCanvasElement | null = null;

const target: Camera = { cx: 0, cy: 0, scale: 1 };

function computeSizing() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  return { w, h, dpr, portrait: h >= w };
}

function applyCanvasSize() {
  if (!canvasEl) return;
  const { w, h, dpr } = layout;
  const pixelW = Math.max(1, Math.round(w * dpr));
  const pixelH = Math.max(1, Math.round(h * dpr));
  if (canvasEl.width !== pixelW) canvasEl.width = pixelW;
  if (canvasEl.height !== pixelH) canvasEl.height = pixelH;
  canvasEl.style.width = `${w}px`;
  canvasEl.style.height = `${h}px`;
}

function handleResize() {
  const s = computeSizing();
  layout.w = s.w;
  layout.h = s.h;
  layout.dpr = s.dpr;
  layout.portrait = s.portrait;
  applyCanvasSize();
}

export const layout: {
  w: number; h: number; dpr: number;          // CSSピクセル
  portrait: boolean;
  camera: Camera;                              // A5が目標を設定、A1がスムーズ追従
  setCameraTarget(cx: number, cy: number, scale: number): void;
  snapCamera(): void;                          // 即時反映(回転時)
  worldToScreen(x: number, y: number): { x: number; y: number };
  screenToWorld(x: number, y: number): { x: number; y: number };
  // --- A1内部利用の追加メンバ(契約外だが main.ts から利用) ---
  init(canvas: HTMLCanvasElement): void;
  update(dt: number): void;
} = {
  w: window.innerWidth || 1,
  h: window.innerHeight || 1,
  dpr: Math.min(window.devicePixelRatio || 1, 3),
  portrait: (window.innerHeight || 1) >= (window.innerWidth || 1),
  camera: { cx: 0, cy: 0, scale: 1 },

  setCameraTarget(cx: number, cy: number, scale: number) {
    target.cx = cx;
    target.cy = cy;
    target.scale = scale;
  },

  snapCamera() {
    this.camera.cx = target.cx;
    this.camera.cy = target.cy;
    this.camera.scale = target.scale;
  },

  worldToScreen(x: number, y: number) {
    const { w, h, camera } = this;
    return {
      x: w / 2 + (x - camera.cx) * camera.scale,
      y: h / 2 + (y - camera.cy) * camera.scale
    };
  },

  screenToWorld(x: number, y: number) {
    const { w, h, camera } = this;
    return {
      x: camera.cx + (x - w / 2) / camera.scale,
      y: camera.cy + (y - h / 2) / camera.scale
    };
  },

  init(canvas: HTMLCanvasElement) {
    canvasEl = canvas;
    handleResize();
    target.cx = this.camera.cx;
    target.cy = this.camera.cy;
    target.scale = this.camera.scale;
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
  },

  update(dt: number) {
    const k = 1 - Math.exp(-CAMERA_LERP_PER_SEC * dt);
    this.camera.cx += (target.cx - this.camera.cx) * k;
    this.camera.cy += (target.cy - this.camera.cy) * k;
    this.camera.scale += (target.scale - this.camera.scale) * k;
  }
};
