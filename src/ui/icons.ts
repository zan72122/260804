// ============================================================================
// src/ui/icons.ts — UIオーバーレイ用ベクターアイコン集。絵文字は一切使わない。
// すべて (ctx, cx, cy, size, ...) 形式。size はアイコンの概ねの直径/高さの目安。
// 丸み・パステル差し色+白・柔らかい影を基調にした「かわいい工場玩具」トーン。
// ============================================================================

export const PALETTE = {
  ink: '#332a4d',
  inkSoft: 'rgba(51,42,77,0.55)',
  white: '#ffffff',
  cream: '#fff8ee',
  pink: '#ff8fab',
  pinkDeep: '#ef5c86',
  pinkPale: '#ffd9e4',
  mint: '#7fe0c0',
  mintDeep: '#2fb98e',
  sun: '#ffcd5c',
  sunDeep: '#f2a531',
  sky: '#7fc4ff',
  skyDeep: '#3f96e8',
  lavender: '#c3a4ff',
  lavenderDeep: '#9468e8',
  metal: '#b9c2cf',
  metalDeep: '#7c8794',
} as const;

// ── 汎用パス ────────────────────────────────────────────────────────
export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function mid(a: readonly [number, number], b: readonly [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** 点列を通る滑らかな二次曲線パス（軽量スプライン近似）。 */
export function smoothPath(
  ctx: CanvasRenderingContext2D,
  pts: ReadonlyArray<readonly [number, number]>,
  closed: boolean,
): void {
  const n = pts.length;
  if (n < 2) return;
  ctx.beginPath();
  const start = closed ? mid(pts[n - 1], pts[0]) : pts[0];
  ctx.moveTo(start[0], start[1]);
  const loopEnd = closed ? n : n - 1;
  for (let i = 0; i < loopEnd; i++) {
    const cur = pts[i % n];
    const next = pts[(i + 1) % n];
    const m = mid(cur, next);
    ctx.quadraticCurveTo(cur[0], cur[1], m[0], m[1]);
  }
  if (!closed) ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
  if (closed) ctx.closePath();
}

/** 柔らかい落ち影を付けて fn を実行する。 */
export function withSoftShadow(
  ctx: CanvasRenderingContext2D, blur: number, dy: number, alpha: number, fn: () => void,
): void {
  ctx.save();
  ctx.shadowColor = `rgba(40,30,60,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  fn();
  ctx.restore();
}

// ── ボウリングピン ──────────────────────────────────────────────────
const PIN_RIGHT: ReadonlyArray<readonly [number, number]> = [
  [0.00, 0.07], [0.055, 0.15], [0.10, 0.175], [0.14, 0.135],
  [0.20, 0.145], [0.305, 0.30], [0.42, 0.235], [0.55, 0.215],
  [0.70, 0.27], [0.855, 0.345], [0.955, 0.40], [1.00, 0.425],
];

function pinContour(): Array<[number, number]> {
  const left: Array<[number, number]> = PIN_RIGHT
    .slice()
    .reverse()
    .map(([y, x]) => [y, -x]);
  return [...PIN_RIGHT.map(([y, x]) => [y, x] as [number, number]), ...left];
}
const PIN_LOOP = pinContour();

/**
 * かわいいボウリングピン。cx,cy は概ね中心（高さ size, 底が cy+size/2 付近）。
 * rot: ラジアン傾き。ring: 帯の色（省略でパステルピンク）。
 */
export function drawPinIcon(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number,
  opts?: { rot?: number; ring?: string; tilted?: boolean },
): void {
  const rot = (opts?.rot ?? 0) + (opts?.tilted ? 0.62 : 0);
  const ring = opts?.ring ?? PALETTE.pink;
  const h = size;
  const w = size * 0.85;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  ctx.translate(0, -h * 0.5);

  withSoftShadow(ctx, size * 0.14, size * 0.08, 0.28, () => {
    const pts = PIN_LOOP.map(([y, x]) => [x * w, y * h] as [number, number]);
    smoothPath(ctx, pts, true);
    const grad = ctx.createLinearGradient(-w * 0.42, 0, w * 0.42, 0);
    grad.addColorStop(0, '#e9e6ef');
    grad.addColorStop(0.42, PALETTE.white);
    grad.addColorStop(1, '#dcd8e6');
    ctx.fillStyle = grad;
    ctx.fill();
  });

  // 帯（ネック下）
  ctx.save();
  const pts = PIN_LOOP.map(([y, x]) => [x * w, y * h] as [number, number]);
  smoothPath(ctx, pts, true);
  ctx.clip();
  ctx.fillStyle = ring;
  ctx.fillRect(-w * 0.5, h * 0.19, w, h * 0.075);
  ctx.fillStyle = PALETTE.white;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(-w * 0.5, h * 0.19, w, h * 0.022);
  ctx.globalAlpha = 1;
  ctx.restore();

  // 輪郭
  smoothPath(ctx, pts, true);
  ctx.lineWidth = Math.max(1, size * 0.028);
  ctx.strokeStyle = 'rgba(110,100,130,0.35)';
  ctx.stroke();

  // ハイライト
  ctx.beginPath();
  ctx.ellipse(-w * 0.16, h * 0.4, w * 0.09, h * 0.16, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fill();

  ctx.restore();
}

/** 複数の小さなピンをクラスタで（「じゆうにあそぶ」用）。 */
export function drawPinCluster(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  const s = size * 0.56;
  drawPinIcon(ctx, cx - size * 0.34, cy + size * 0.14, s, { ring: PALETTE.mint, rot: -0.12 });
  drawPinIcon(ctx, cx + size * 0.34, cy + size * 0.14, s, { ring: PALETTE.sun, rot: 0.12 });
  drawPinIcon(ctx, cx, cy - size * 0.12, s * 1.08, { ring: PALETTE.pink });
}

// ── ボウリングボール ────────────────────────────────────────────────
export function drawBallIcon(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string = PALETTE.lavenderDeep,
): void {
  withSoftShadow(ctx, r * 0.35, r * 0.18, 0.3, () => {
    const grad = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r * 1.05);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, color);
    grad.addColorStop(1, 'rgba(0,0,0,0.18)');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    const shade = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.05, cx, cy, r * 1.1);
    shade.addColorStop(0, 'rgba(255,255,255,0.55)');
    shade.addColorStop(0.3, 'rgba(255,255,255,0)');
    shade.addColorStop(0.85, 'rgba(0,0,0,0)');
    shade.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = shade;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
  });
  // 指穴
  ctx.fillStyle = 'rgba(30,20,45,0.55)';
  const holeR = r * 0.1;
  const hx = cx + r * 0.18, hy = cy - r * 0.32;
  ctx.beginPath(); ctx.arc(hx - r * 0.22, hy + r * 0.05, holeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx + r * 0.08, hy, holeR, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(hx - r * 0.05, hy + r * 0.26, holeR, 0, Math.PI * 2); ctx.fill();
}

// ── リプレイ矢印（円環矢印） ─────────────────────────────────────────
export function drawReplayArrow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string = PALETTE.skyDeep,
): void {
  const r = size * 0.42;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.16;
  ctx.strokeStyle = color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, -Math.PI * 0.78, Math.PI * 0.62);
  ctx.stroke();
  // 矢じり
  const ang = Math.PI * 0.62;
  const ax = cx + Math.cos(ang) * r;
  const ay = cy + Math.sin(ang) * r;
  const tang = ang + Math.PI / 2;
  const headLen = size * 0.26;
  ctx.beginPath();
  ctx.moveTo(ax + Math.cos(tang) * headLen * 0.62, ay + Math.sin(tang) * headLen * 0.62);
  ctx.lineTo(ax + Math.cos(ang) * headLen * 0.62, ay + Math.sin(ang) * headLen * 0.62);
  ctx.lineTo(ax - Math.cos(tang) * headLen * 0.62, ay - Math.sin(tang) * headLen * 0.62);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ── レンチ ─────────────────────────────────────────────────────────
export function drawWrench(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot = -0.7,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  const len = size * 0.92, barW = size * 0.2;
  withSoftShadow(ctx, size * 0.12, size * 0.06, 0.26, () => {
    // 柄
    roundRectPath(ctx, -barW * 0.5, -len * 0.5, barW, len, barW * 0.5);
    const grad = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    grad.addColorStop(0, PALETTE.metalDeep);
    grad.addColorStop(0.5, PALETTE.metal);
    grad.addColorStop(1, PALETTE.metalDeep);
    ctx.fillStyle = grad;
    ctx.fill();

    for (const s of [-1, 1]) {
      const jy = s * len * 0.5;
      ctx.beginPath();
      ctx.arc(0, jy, size * 0.26, 0, Math.PI * 2);
      ctx.fillStyle = PALETTE.metal;
      ctx.fill();
      // 開口ノッチ
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(-size * 0.14, jy - s * size * 0.26 * 1.05);
      ctx.lineTo(size * 0.14, jy - s * size * 0.26 * 1.05);
      ctx.lineTo(size * 0.14, jy - s * size * 0.05);
      ctx.lineTo(-size * 0.14, jy - s * size * 0.05);
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = 'rgba(255,255,255,0.98)';
      ctx.fillRect(-size, jy - size, size * 2, size * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, jy, size * 0.26, 0, Math.PI * 2);
      ctx.lineWidth = size * 0.035;
      ctx.strokeStyle = 'rgba(90,100,112,0.5)';
      ctx.stroke();
    }
  });
  ctx.beginPath();
  ctx.ellipse(-barW * 0.15, 0, barW * 0.16, len * 0.28, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.fill();
  ctx.restore();
}

// ── ハテナ（手描きベクターの「？」） ──────────────────────────────────
export function drawQuestionGlow(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, time: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time / 260);
  ctx.save();
  const glowR = size * (0.62 + pulse * 0.08);
  const glow = ctx.createRadialGradient(cx, cy, size * 0.1, cx, cy, glowR);
  glow.addColorStop(0, `rgba(255,205,92,${0.55 + pulse * 0.2})`);
  glow.addColorStop(1, 'rgba(255,205,92,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();

  ctx.translate(cx, cy - size * 0.06);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.155;
  ctx.strokeStyle = PALETTE.sunDeep;
  ctx.beginPath();
  ctx.arc(0, -size * 0.16, size * 0.24, -Math.PI * 0.15, Math.PI * 1.02);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, size * 0.06);
  ctx.lineTo(0, size * 0.22);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, size * 0.42, size * 0.075, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.sunDeep;
  ctx.fill();
  ctx.restore();
}

// ── 手（フリー遊びの「手でつまむ」） ───────────────────────────────────
export function drawHand(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot = -0.15,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  withSoftShadow(ctx, size * 0.1, size * 0.05, 0.25, () => {
    ctx.fillStyle = PALETTE.cream;
    // 手のひら
    roundRectPath(ctx, -size * 0.32, -size * 0.05, size * 0.64, size * 0.46, size * 0.2);
    ctx.fill();
    // 指
    for (let i = 0; i < 4; i++) {
      const fx = -size * 0.27 + i * size * 0.185;
      const flen = size * (0.36 - Math.abs(i - 1.5) * 0.05);
      roundRectPath(ctx, fx, -size * 0.05 - flen, size * 0.15, flen + size * 0.1, size * 0.075);
      ctx.fill();
    }
    // 親指
    ctx.save();
    ctx.translate(-size * 0.34, size * 0.18);
    ctx.rotate(-0.9);
    roundRectPath(ctx, -size * 0.075, -size * 0.22, size * 0.15, size * 0.32, size * 0.075);
    ctx.fill();
    ctx.restore();
  });
  ctx.strokeStyle = 'rgba(150,110,90,0.3)';
  ctx.lineWidth = size * 0.02;
  roundRectPath(ctx, -size * 0.32, -size * 0.05, size * 0.64, size * 0.46, size * 0.2);
  ctx.stroke();
  ctx.restore();
}

// ── 音符（ミュート） ─────────────────────────────────────────────────
export function drawNote(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, muted: boolean,
): void {
  ctx.save();
  ctx.translate(cx, cy);
  const color = muted ? 'rgba(255,255,255,0.55)' : PALETTE.sun;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = size * 0.09;
  ctx.lineCap = 'round';

  ctx.save();
  ctx.translate(-size * 0.12, size * 0.24);
  ctx.rotate(-0.35);
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.2, size * 0.15, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(size * 0.06, size * 0.2);
  ctx.lineTo(size * 0.06, -size * 0.42);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(size * 0.06, -size * 0.42);
  ctx.quadraticCurveTo(size * 0.42, -size * 0.34, size * 0.3, -size * 0.06);
  ctx.quadraticCurveTo(size * 0.4, -size * 0.2, size * 0.06, -size * 0.22);
  ctx.closePath();
  ctx.fill();

  if (muted) {
    ctx.lineWidth = size * 0.11;
    ctx.strokeStyle = PALETTE.pinkDeep;
    ctx.beginPath();
    ctx.moveTo(-size * 0.34, -size * 0.34);
    ctx.lineTo(size * 0.34, size * 0.34);
    ctx.stroke();
    ctx.lineWidth = size * 0.045;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.stroke();
  }
  ctx.restore();
}

// ── 家（もどる） ────────────────────────────────────────────────────
export function drawHome(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  withSoftShadow(ctx, size * 0.1, size * 0.05, 0.25, () => {
    roundRectPath(ctx, -size * 0.28, -size * 0.02, size * 0.56, size * 0.4, size * 0.06);
    ctx.fillStyle = PALETTE.pinkPale;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-size * 0.38, -size * 0.02);
    ctx.lineTo(0, -size * 0.4);
    ctx.lineTo(size * 0.38, -size * 0.02);
    ctx.lineTo(size * 0.28, -size * 0.02);
    ctx.lineTo(0, -size * 0.26);
    ctx.lineTo(-size * 0.28, -size * 0.02);
    ctx.closePath();
    ctx.fillStyle = PALETTE.pinkDeep;
    ctx.fill();
  });
  roundRectPath(ctx, -size * 0.075, size * 0.1, size * 0.15, size * 0.28, size * 0.045);
  ctx.fillStyle = PALETTE.white;
  ctx.fill();
  ctx.restore();
}

// ── リボン（装飾切替） ───────────────────────────────────────────────
export function drawRibbon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string = PALETTE.pink): void {
  ctx.save();
  ctx.translate(cx, cy);
  withSoftShadow(ctx, size * 0.08, size * 0.04, 0.22, () => {
    for (const s of [-1, 1]) {
      ctx.save();
      ctx.scale(s, 1);
      smoothPath(ctx, [
        [0.03 * size, 0], [0.5 * size, -0.32 * size], [0.56 * size, 0], [0.5 * size, 0.32 * size],
      ], true);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
    }
  });
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.14, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.white;
  ctx.fill();
  ctx.lineWidth = size * 0.03;
  ctx.strokeStyle = color;
  ctx.stroke();
  ctx.restore();
}

// ── 速度メーター（カメ〜うさぎ、3段階） ─────────────────────────────
export function drawTurtle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, size * 0.42, size * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-size * 0.5, size * 0.02, size * 0.16, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(size * 0.1, s * size * 0.28, size * 0.12, size * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRabbit(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, size * 0.1, size * 0.32, size * 0.26, 0, 0, Math.PI * 2);
  ctx.fill();
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * size * 0.14, -size * 0.32);
    ctx.rotate(s * 0.18);
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.08, size * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** level: 0=ゆっくり 1=ふつう 2=はやい */
export function drawSpeedGauge(
  ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, level: 0 | 1 | 2,
): void {
  const r = size * 0.4;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = size * 0.09;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx, cy, r, Math.PI, Math.PI * 2);
  ctx.stroke();

  const dots: Array<[number, 0 | 1 | 2]> = [
    [Math.PI * 1.0, 0], [Math.PI * 1.5, 1], [Math.PI * 2.0, 2],
  ];
  for (const [ang, lv] of dots) {
    const dx = cx + Math.cos(ang) * r;
    const dy = cy + Math.sin(ang) * r;
    ctx.beginPath();
    ctx.arc(dx, dy, lv === level ? size * 0.065 : size * 0.04, 0, Math.PI * 2);
    ctx.fillStyle = lv === level ? PALETTE.sun : 'rgba(255,255,255,0.5)';
    ctx.fill();
  }

  const needleAng = Math.PI + (level / 2) * Math.PI;
  ctx.lineWidth = size * 0.06;
  ctx.strokeStyle = PALETTE.pinkDeep;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(needleAng) * r * 0.78, cy + Math.sin(needleAng) * r * 0.78);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.06, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.pinkDeep;
  ctx.fill();

  drawTurtle(ctx, cx - r * 1.05, cy + size * 0.1, size * 0.34, level === 0 ? PALETTE.mintDeep : 'rgba(255,255,255,0.55)');
  drawRabbit(ctx, cx + r * 1.05, cy + size * 0.02, size * 0.34, level === 2 ? PALETTE.mintDeep : 'rgba(255,255,255,0.55)');
  ctx.restore();
}

// ── X線（すけすけ機械） ──────────────────────────────────────────────
export function drawXrayIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, active: boolean): void {
  ctx.save();
  ctx.translate(cx, cy);
  const w = size * 0.68, h = size * 0.56;
  roundRectPath(ctx, -w / 2, -h / 2, w, h, size * 0.1);
  ctx.fillStyle = active ? 'rgba(127,196,255,0.28)' : 'rgba(255,255,255,0.14)';
  ctx.fill();
  ctx.setLineDash([size * 0.07, size * 0.06]);
  ctx.lineWidth = size * 0.055;
  ctx.strokeStyle = active ? PALETTE.sky : 'rgba(255,255,255,0.7)';
  roundRectPath(ctx, -w / 2, -h / 2, w, h, size * 0.1);
  ctx.stroke();
  ctx.setLineDash([]);

  // 内部の歯車（透けて見えるイメージ）
  ctx.save();
  ctx.globalAlpha = active ? 0.95 : 0.6;
  drawGear(ctx, 0, 0, size * 0.19, active ? PALETTE.skyDeep : PALETTE.metal);
  ctx.restore();
  ctx.restore();
}

export function drawGear(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string): void {
  ctx.save();
  ctx.translate(cx, cy);
  const teeth = 8;
  ctx.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const ang = (i / (teeth * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? r : r * 0.72;
    const px = Math.cos(ang) * rr, py = Math.sin(ang) * rr;
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.restore();
}

// ── 再生三角 ───────────────────────────────────────────────────────
export function drawPlayTriangle(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, color: string = PALETTE.white): void {
  ctx.save();
  ctx.translate(cx, cy);
  const r = size * 0.5;
  smoothPath(ctx, [
    [-r * 0.55, -r * 0.75], [r * 0.85, 0], [-r * 0.55, r * 0.75],
  ], true);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

// ── 詰まったピン + リプレイ矢印の合成アイコン ─────────────────────────
export function drawJammedReplay(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, time: number): void {
  const wobble = Math.sin(time / 220) * 0.05;
  drawPinIcon(ctx, cx - size * 0.08, cy + size * 0.05, size * 0.78, { rot: Math.PI * 0.5 + wobble, ring: PALETTE.pink });
  drawReplayArrow(ctx, cx + size * 0.34, cy - size * 0.3, size * 0.56, PALETTE.skyDeep);
}
