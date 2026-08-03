/**
 * Canvas painters for every prop in the lab.
 * Everything is vector-drawn — no placeholder rectangles, no emoji props.
 */

export const C = {
  bgTop: "#262b52",
  bgBottom: "#171a33",
  tableTop: "#3d4a72",
  tableFront: "#2b3352",
  steelLight: "#b9c2cf",
  steelMid: "#8b95a6",
  steelDark: "#5a6375",
  steelEdge: "#454d5e",
  fluor: "#c8ff3c",
  fluorSoft: "#a7e82f",
  uvViolet: "#7a56e0",
  coral: "#ff8d68",
  pink: "#ffa8cf",
  pinkDeep: "#f27bb2",
  cream: "#f7f2e7",
  curtain1: "#2c2153",
  curtain2: "#372a66",
  ringBlue: "#6fb7d9"
};

export function rr(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function drawBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, C.bgTop);
  g.addColorStop(1, C.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // soft bokeh lab lights
  ctx.save();
  ctx.globalAlpha = 0.05;
  ctx.fillStyle = "#9fb4ff";
  for (let i = 0; i < 5; i++) {
    const x = ((i * 0.23 + 0.08) % 1) * w;
    const y = ((i * 0.31 + 0.05) % 0.4) * h;
    ctx.beginPath();
    ctx.arc(x, y, Math.min(w, h) * (0.06 + (i % 3) * 0.03), 0, Math.PI * 2);
    ctx.fill();
  }
  // faint shelf silhouettes
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#101227";
  ctx.fillRect(0, h * 0.16, w * 0.16, h * 0.02);
  ctx.fillRect(w * 0.86, h * 0.22, w * 0.14, h * 0.02);
  ctx.restore();
}

export function drawTable(
  ctx: CanvasRenderingContext2D,
  w: number, tableY: number, h: number
): void {
  ctx.save();
  ctx.fillStyle = C.tableFront;
  ctx.fillRect(0, tableY, w, h - tableY);
  const g = ctx.createLinearGradient(0, tableY - 14, 0, tableY + 26);
  g.addColorStop(0, "#4a5a8c");
  g.addColorStop(1, C.tableTop);
  ctx.fillStyle = g;
  ctx.fillRect(0, tableY - 12, w, 40);
  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(0, tableY - 12, w, 4);
  ctx.restore();
}

/** Thick steel gear, face turned to the camera — the inspection surface. */
export function drawGear(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number,
  teeth: number, tintHue: number
): void {
  ctx.save();
  ctx.translate(x, y);
  const toothH = r * 0.13;
  const bodyR = r - toothH;
  // drop shadow
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = "#0b0d1d";
  ctx.beginPath();
  ctx.ellipse(0, r * 0.94, r * 0.94, r * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // teeth
  ctx.fillStyle = shade(tintHue, 0.62);
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const half = (Math.PI / teeth) * 0.52;
    ctx.beginPath();
    for (const [rad, da] of [
      [bodyR * 0.98, -half], [r, -half * 0.55],
      [r, half * 0.55], [bodyR * 0.98, half]
    ] as const) {
      const a = a0 + da;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
  // rim
  const rim = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, bodyR);
  rim.addColorStop(0, shade(tintHue, 0.85));
  rim.addColorStop(1, shade(tintHue, 0.55));
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
  ctx.fill();
  // inspection face
  const faceR = bodyR * 0.9;
  const face = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.08, 0, 0, faceR);
  face.addColorStop(0, shade(tintHue, 0.92));
  face.addColorStop(0.7, shade(tintHue, 0.74));
  face.addColorStop(1, shade(tintHue, 0.6));
  ctx.fillStyle = face;
  ctx.beginPath();
  ctx.arc(0, 0, faceR, 0, Math.PI * 2);
  ctx.fill();
  // brushed-metal arcs
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(0, 0, faceR * (0.4 + i * 0.15), Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // hub hole
  ctx.fillStyle = "#232838";
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.4)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.15 + 3, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();
  ctx.restore();
}

function shade(hue: number, l: number): string {
  // steel with a whisper of hue tint
  const s = 12;
  return `hsl(${hue} ${s}% ${Math.round(l * 100 * 0.62)}%)`;
}

export interface DirtBlob { x: number; y: number; r: number; a: number; }

export function drawDirt(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, partR: number, blobs: DirtBlob[]
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  ctx.arc(0, 0, partR * 0.76, 0, Math.PI * 2);
  ctx.clip();
  for (const b of blobs) {
    if (b.a <= 0.01) continue;
    const g = ctx.createRadialGradient(
      b.x * partR, b.y * partR, 0,
      b.x * partR, b.y * partR, b.r * partR
    );
    g.addColorStop(0, `rgba(74,62,42,${0.5 * b.a})`);
    g.addColorStop(0.7, `rgba(90,80,55,${0.3 * b.a})`);
    g.addColorStop(1, "rgba(90,80,55,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.x * partR, b.y * partR, b.r * partR, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/**
 * U-shaped electromagnetic yoke straddling the part.
 * angle 0: poles left/right (horizontal flux). PI/2: poles top/bottom.
 */
export function drawYoke(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, span: number,
  angle: number, lift: number, energized: boolean
): void {
  ctx.save();
  ctx.translate(cx, cy - lift);
  ctx.rotate(angle);
  const half = span / 2;
  const legH = span * 0.34;
  const thick = span * 0.15;
  if (lift > 2) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = "#0b0d1d";
    ctx.beginPath();
    ctx.ellipse(0, legH + lift * 0.6, half * 1.1, thick * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // arch body
  ctx.lineCap = "round";
  ctx.strokeStyle = "#c9503c";
  ctx.lineWidth = thick + 5;
  archPath(ctx, half, legH);
  ctx.stroke();
  ctx.strokeStyle = energized ? "#ff9a66" : C.coral;
  ctx.lineWidth = thick;
  archPath(ctx, half, legH);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.28)";
  ctx.lineWidth = thick * 0.32;
  archPath(ctx, half, legH, -thick * 0.22);
  ctx.stroke();
  // pole feet
  for (const s of [-1, 1]) {
    ctx.fillStyle = "#3a4152";
    rr(ctx, s * half - thick * 0.7, legH - thick * 0.2, thick * 1.4, thick * 0.95, 4);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    rr(ctx, s * half - thick * 0.7, legH - thick * 0.2, thick * 1.4, thick * 0.3, 4);
    ctx.fill();
  }
  // pink grip on top of the arch
  ctx.fillStyle = C.pink;
  rr(ctx, -half * 0.34, -legH - thick * 1.32, half * 0.68, thick * 0.72, thick * 0.36);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  rr(ctx, -half * 0.26, -legH - thick * 1.26, half * 0.52, thick * 0.2, thick * 0.1);
  ctx.fill();
  // little status lamp
  ctx.fillStyle = energized ? C.fluor : "#7d4a3e";
  ctx.beginPath();
  ctx.arc(0, -legH - thick * 0.2, thick * 0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function archPath(ctx: CanvasRenderingContext2D, half: number, legH: number, inset = 0): void {
  ctx.beginPath();
  ctx.moveTo(-half - inset * 0.4, legH * 0.85);
  ctx.lineTo(-half - inset * 0.4, -legH * 0.55 + inset);
  ctx.quadraticCurveTo(-half, -legH * 1.55 + inset, 0, -legH * 1.55 + inset);
  ctx.quadraticCurveTo(half, -legH * 1.55 + inset, half + inset * 0.4, -legH * 0.55 + inset);
  ctx.lineTo(half + inset * 0.4, legH * 0.85);
}

/** transient soft flux-line hint between the poles, fading out */
export function drawFieldLines(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, span: number,
  angle: number, alpha: number, t: number
): void {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  const half = span / 2;
  ctx.lineCap = "round";
  for (let i = 0; i < 5; i++) {
    const bulge = (i - 2) * span * 0.11 + Math.sin(t * 2 + i) * 2;
    ctx.strokeStyle = `rgba(150,208,255,${alpha * (0.3 - Math.abs(i - 2) * 0.05)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-half, 0);
    ctx.quadraticCurveTo(0, bulge, half, 0);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawCloth(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number, t: number
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 6) * 0.08);
  ctx.fillStyle = "rgba(11,13,29,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, s * 0.55, s * 0.75, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.cream;
  rr(ctx, -s * 0.72, -s * 0.5, s * 1.44, s, s * 0.34);
  ctx.fill();
  ctx.strokeStyle = C.pinkDeep;
  ctx.lineWidth = s * 0.09;
  rr(ctx, -s * 0.72, -s * 0.5, s * 1.44, s, s * 0.34);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = s * 0.05;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * s * 0.3, -s * 0.34);
    ctx.quadraticCurveTo(i * s * 0.3 + s * 0.08, 0, i * s * 0.3, s * 0.34);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawNozzle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  pouring: boolean, screenW: number, screenH: number
): void {
  ctx.save();
  // hose from bottom-right corner
  ctx.strokeStyle = "#46527a";
  ctx.lineWidth = s * 0.34;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(screenW + s, screenH + s * 0.5);
  ctx.quadraticCurveTo(x + s * 2.4, y + s * 2.2, x + s * 0.35, y + s * 0.4);
  ctx.stroke();
  ctx.strokeStyle = "#5a6899";
  ctx.lineWidth = s * 0.22;
  ctx.beginPath();
  ctx.moveTo(screenW + s, screenH + s * 0.5);
  ctx.quadraticCurveTo(x + s * 2.4, y + s * 2.2, x + s * 0.35, y + s * 0.4);
  ctx.stroke();
  ctx.translate(x, y);
  ctx.rotate(0.5);
  // grip
  ctx.fillStyle = C.coral;
  rr(ctx, -s * 0.28, -s * 0.1, s * 0.56, s * 1.05, s * 0.24);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  rr(ctx, -s * 0.18, 0, s * 0.2, s * 0.8, s * 0.1);
  ctx.fill();
  // head
  const g = ctx.createLinearGradient(-s * 0.5, -s * 0.9, s * 0.5, -s * 0.2);
  g.addColorStop(0, "#d7dde8");
  g.addColorStop(1, "#8b95a6");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(-s * 0.3, -s * 0.08);
  ctx.lineTo(-s * 0.52, -s * 0.95);
  ctx.lineTo(s * 0.52, -s * 0.95);
  ctx.lineTo(s * 0.3, -s * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = pouring ? C.fluorSoft : "#5f6b80";
  rr(ctx, -s * 0.56, -s * 1.14, s * 1.12, s * 0.26, s * 0.13);
  ctx.fill();
  ctx.restore();
}

export function drawUvLamp(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number, on: boolean
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.35);
  // handle
  ctx.fillStyle = C.pink;
  rr(ctx, -s * 0.2, s * 0.3, s * 0.4, s * 1.0, s * 0.2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  rr(ctx, -s * 0.12, s * 0.4, s * 0.14, s * 0.75, s * 0.07);
  ctx.fill();
  // body
  const g = ctx.createLinearGradient(0, -s * 0.7, 0, s * 0.4);
  g.addColorStop(0, "#6a4fc9");
  g.addColorStop(1, "#4a3591");
  ctx.fillStyle = g;
  rr(ctx, -s * 0.62, -s * 0.62, s * 1.24, s * 1.0, s * 0.3);
  ctx.fill();
  // glass
  ctx.fillStyle = on ? "#b9a0ff" : "#3d2f70";
  ctx.beginPath();
  ctx.ellipse(0, -s * 0.62, s * 0.5, s * 0.2, 0, 0, Math.PI * 2);
  ctx.fill();
  if (on) {
    ctx.fillStyle = "rgba(185,160,255,0.35)";
    ctx.beginPath();
    ctx.ellipse(0, -s * 0.62, s * 0.72, s * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Fabric hood: covers the top `cover` fraction of the screen at `alpha`. */
export function drawCurtain(
  ctx: CanvasRenderingContext2D,
  w: number, h: number, cover: number, alpha: number, t: number
): void {
  if (cover <= 0 || alpha <= 0.01) return;
  const yBottom = cover * h;
  ctx.save();
  ctx.globalAlpha = alpha;
  const folds = Math.max(6, Math.round(w / 90));
  const fw = w / folds;
  for (let i = 0; i < folds; i++) {
    const sway = Math.sin(t * 1.4 + i * 1.7) * 5 * cover;
    const g = ctx.createLinearGradient(i * fw, 0, (i + 1) * fw, 0);
    g.addColorStop(0, C.curtain1);
    g.addColorStop(0.5, C.curtain2);
    g.addColorStop(1, C.curtain1);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(i * fw - 1, 0);
    ctx.lineTo((i + 1) * fw + 1, 0);
    ctx.lineTo((i + 1) * fw + 1, yBottom + sway);
    ctx.quadraticCurveTo((i + 0.5) * fw, yBottom + sway + 12, i * fw - 1, yBottom + sway);
    ctx.closePath();
    ctx.fill();
  }
  // pink scalloped trim
  ctx.fillStyle = C.pinkDeep;
  ctx.beginPath();
  ctx.moveTo(0, yBottom - 4);
  for (let i = 0; i <= folds * 2; i++) {
    const x = (i / (folds * 2)) * w;
    const sway = Math.sin(t * 1.4 + (i / 2) * 1.7) * 5 * cover;
    ctx.lineTo(x, yBottom + sway + (i % 2 === 0 ? 2 : 12));
  }
  ctx.lineTo(w, yBottom - 10);
  ctx.lineTo(0, yBottom - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Big grabbable tab that hangs from the curtain edge. */
export function drawCurtainTab(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number, pulse: number
): void {
  ctx.save();
  ctx.translate(x, y);
  const p = 1 + pulse * 0.08;
  ctx.scale(p, p);
  ctx.fillStyle = C.pinkDeep;
  rr(ctx, -s * 0.55, -s * 0.2, s * 1.1, s * 0.85, s * 0.3);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = s * 0.1;
  ctx.beginPath();
  ctx.arc(0, s * 0.85, s * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  // downward chevron
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-s * 0.24, 0);
  ctx.lineTo(0, s * 0.26);
  ctx.lineTo(s * 0.24, 0);
  ctx.stroke();
  ctx.restore();
}

/** Residual-magnetism gauge; value 1 = magnetized, 0 = happy center. */
export function drawMeter(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, value: number
): void {
  const h = w * 0.62;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = C.cream;
  rr(ctx, -w / 2, 0, w, h, w * 0.1);
  ctx.fill();
  ctx.strokeStyle = "#c9bfae";
  ctx.lineWidth = 2;
  rr(ctx, -w / 2, 0, w, h, w * 0.1);
  ctx.stroke();
  const cx2 = 0, cy2 = h * 0.82, rad = w * 0.36;
  // scale arc
  ctx.strokeStyle = "#8a8172";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx2, cy2, rad, Math.PI * 1.15, Math.PI * 1.85);
  ctx.stroke();
  // center happy zone
  ctx.strokeStyle = "#7ec97e";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(cx2, cy2, rad, Math.PI * 1.44, Math.PI * 1.56);
  ctx.stroke();
  // tick marks
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * (1.15 + (i / 6) * 0.7);
    ctx.strokeStyle = "#8a8172";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx2 + Math.cos(a) * rad * 0.92, cy2 + Math.sin(a) * rad * 0.92);
    ctx.lineTo(cx2 + Math.cos(a) * rad * 1.02, cy2 + Math.sin(a) * rad * 1.02);
    ctx.stroke();
  }
  // magnet glyph at the right end of the scale
  drawMiniMagnet(ctx, w * 0.32, h * 0.3, w * 0.09);
  // smile at center-zero
  ctx.strokeStyle = "#7ec97e";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, h * 0.3, w * 0.05, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
  ctx.fillStyle = "#7ec97e";
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(s * w * 0.025, h * 0.28, w * 0.011, 0, Math.PI * 2);
    ctx.fill();
  }
  // needle: value 1 -> right end, 0 -> center
  const na = Math.PI * (1.5 + value * 0.33);
  ctx.strokeStyle = "#e2574b";
  ctx.lineWidth = 3.5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx2, cy2);
  ctx.lineTo(cx2 + Math.cos(na) * rad * 0.88, cy2 + Math.sin(na) * rad * 0.88);
  ctx.stroke();
  ctx.fillStyle = "#5a5245";
  ctx.beginPath();
  ctx.arc(cx2, cy2, w * 0.045, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawMiniMagnet(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#e2574b";
  ctx.lineWidth = s * 0.7;
  ctx.lineCap = "butt";
  ctx.beginPath();
  ctx.arc(0, 0, s, Math.PI, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e2574b";
  ctx.fillRect(-s - s * 0.35, 0, s * 0.7, s * 0.8);
  ctx.fillRect(s - s * 0.35, 0, s * 0.7, s * 0.8);
  ctx.fillStyle = "#d7dde8";
  ctx.fillRect(-s - s * 0.35, s * 0.5, s * 0.7, s * 0.3);
  ctx.fillRect(s - s * 0.35, s * 0.5, s * 0.7, s * 0.3);
  ctx.restore();
}

/** Demagnetizing coil ring, standing upright, seen slightly from the side. */
export function drawDemagRing(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, active: number
): void {
  ctx.save();
  ctx.translate(x, y);
  const squish = 0.32;
  ctx.lineCap = "round";
  // back half drawn behind part elsewhere; here full torus
  ctx.strokeStyle = "#33506b";
  ctx.lineWidth = r * 0.3;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * squish, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = C.ringBlue;
  ctx.lineWidth = r * 0.2;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * squish, r, 0, 0, Math.PI * 2);
  ctx.stroke();
  // coil winding marks
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const px = Math.cos(a) * r * squish;
    const py = Math.sin(a) * r;
    ctx.beginPath();
    ctx.arc(px, py, r * 0.09, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (active > 0.02) {
    ctx.strokeStyle = `rgba(150,208,255,${0.35 * active})`;
    ctx.lineWidth = r * 0.32;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * squish * 1.25, r * 1.12, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export type RobotMood = "idle" | "happy" | "point";

/** Small friendly inspector robot. lookX/lookY in [-1,1] shift the eyes. */
export function drawRobot(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, s: number,
  lookX: number, lookY: number, mood: RobotMood, t: number
): void {
  ctx.save();
  ctx.translate(x, y);
  const bob = Math.sin(t * 2.2) * s * 0.03 + (mood === "happy" ? Math.abs(Math.sin(t * 6)) * -s * 0.08 : 0);
  ctx.translate(0, bob);
  // treads
  ctx.fillStyle = "#3a4152";
  rr(ctx, -s * 0.5, s * 0.62, s, s * 0.26, s * 0.13);
  ctx.fill();
  ctx.fillStyle = "#556080";
  for (const wx of [-0.3, 0, 0.3]) {
    ctx.beginPath();
    ctx.arc(wx * s, s * 0.75, s * 0.08, 0, Math.PI * 2);
    ctx.fill();
  }
  // body
  ctx.fillStyle = C.cream;
  rr(ctx, -s * 0.44, -s * 0.05, s * 0.88, s * 0.72, s * 0.2);
  ctx.fill();
  ctx.fillStyle = C.coral;
  rr(ctx, -s * 0.44, s * 0.38, s * 0.88, s * 0.16, s * 0.08);
  ctx.fill();
  // chest lamp
  ctx.fillStyle = mood === "happy" ? C.fluor : "#b9c2cf";
  ctx.beginPath();
  ctx.arc(0, s * 0.2, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // head
  ctx.fillStyle = C.cream;
  rr(ctx, -s * 0.4, -s * 0.72, s * 0.8, s * 0.58, s * 0.26);
  ctx.fill();
  // visor
  ctx.fillStyle = "#2b3352";
  rr(ctx, -s * 0.3, -s * 0.62, s * 0.6, s * 0.36, s * 0.16);
  ctx.fill();
  // eyes
  const ex = lookX * s * 0.06, ey = lookY * s * 0.04;
  if (mood === "happy") {
    ctx.strokeStyle = C.fluor;
    ctx.lineWidth = s * 0.045;
    ctx.lineCap = "round";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(sx * s * 0.14 + ex, -s * 0.42 + ey, s * 0.07, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    }
  } else {
    const blink = Math.sin(t * 0.9) > 0.985 ? 0.2 : 1;
    ctx.fillStyle = "#9fecff";
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(sx * s * 0.14 + ex, -s * 0.44 + ey, s * 0.065, s * 0.065 * blink, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // antenna with pink bead
  ctx.strokeStyle = "#8b95a6";
  ctx.lineWidth = s * 0.04;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.72);
  ctx.lineTo(0, -s * 0.88);
  ctx.stroke();
  ctx.fillStyle = C.pink;
  ctx.beginPath();
  ctx.arc(0, -s * 0.92, s * 0.06 + (mood === "point" ? Math.sin(t * 8) * s * 0.015 : 0), 0, Math.PI * 2);
  ctx.fill();
  // pointing arm
  if (mood === "point") {
    ctx.strokeStyle = C.cream;
    ctx.lineWidth = s * 0.09;
    ctx.lineCap = "round";
    const aa = Math.atan2(lookY, lookX);
    ctx.beginPath();
    ctx.moveTo(Math.cos(aa) * s * 0.4, s * 0.15 + Math.sin(aa) * s * 0.2);
    ctx.lineTo(Math.cos(aa) * s * 0.72, s * 0.05 + Math.sin(aa) * s * 0.4);
    ctx.stroke();
  }
  ctx.restore();
}

/** Big round magnetize button with a U-magnet glyph. */
export function drawMagnetButton(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, r: number, pulse: number, pressed: number
): void {
  ctx.save();
  ctx.translate(x, y);
  const k = 1 + pulse * 0.07 - pressed * 0.1;
  ctx.scale(k, k);
  // base plate
  ctx.fillStyle = "#3a4152";
  ctx.beginPath();
  ctx.arc(0, r * 0.12, r * 1.18, 0, Math.PI * 2);
  ctx.fill();
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, "#8fe08f");
  g.addColorStop(1, "#4faf5f");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.86, Math.PI * 0.9, Math.PI * 1.7);
  ctx.stroke();
  drawMiniMagnet(ctx, 0, -r * 0.14, r * 0.34);
  ctx.restore();
}
