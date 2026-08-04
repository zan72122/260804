import { Game, UNIT_OFFSETS, CAR_LENGTH, TRAIN_LENGTH } from './game';
import { Rail, TRACK_LENGTH, SAMPLES } from './rail';
import { Projection, RAIL_HALF_GAP } from './project';
import { Layout, Rect, rectCenter } from './layout';
import { mulberry32 } from './rng';

/**
 * Night-scene renderer: storybook-model-railway 2.5D.
 * Landscape = side elevation, portrait = perspective down the track.
 * No full-screen flashing anywhere: glows pulse slowly, sparks live in a
 * bounded region behind the grinder.
 */

const AMBER = '#ffb14e';
const LASER = '#9fd8ff';

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number;
}

let stars: Star[] | null = null;

export function render(ctx: CanvasRenderingContext2D, game: Game): void {
  const w = game.viewW;
  const h = game.viewH;
  const L = game.layout();
  const proj = game.projection();
  const soft = game.settings;
  const glow = soft.softLight ? 0.5 : 1;
  const t = game.clock;

  ctx.clearRect(0, 0, w, h);
  drawSky(ctx, w, h, t);

  ctx.save();
  if (game.shake > 0.05 && !game.settingsOpen) {
    const m = soft.softMotion ? 0.35 : 1;
    ctx.translate(
      Math.sin(t * 47) * game.shake * m,
      Math.cos(t * 53) * game.shake * m * 0.7
    );
  }

  if (proj.portrait) drawScenePortrait(ctx, game, proj, glow, t);
  else drawSceneSide(ctx, game, proj, glow, t);
  ctx.restore();

  drawUI(ctx, game, L, glow, t);

  if (game.phase === 'title') drawTitle(ctx, game, L, t);
  if (game.phase === 'replay') drawReplay(ctx, game, L, t);
  if (game.settingsOpen) drawSettings(ctx, game, L, t);
  else drawHint(ctx, game, t);
}

// ------------------------------------------------------------------ sky

function drawSky(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#040816');
  g.addColorStop(0.55, '#0a1226');
  g.addColorStop(1, '#101a30');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  if (!stars || stars.length === 0) {
    const rnd = mulberry32(777);
    stars = Array.from({ length: 70 }, () => ({
      x: rnd(),
      y: rnd() * 0.55,
      r: 0.6 + rnd() * 1.2,
      tw: rnd() * Math.PI * 2,
    }));
  }
  ctx.fillStyle = '#cfe0ff';
  for (const s of stars) {
    ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 0.7 + s.tw);
    ctx.beginPath();
    ctx.arc(s.x * w, s.y * h, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  // moon
  const mx = w * 0.82;
  const my = h * 0.13;
  const mr = Math.min(w, h) * 0.045;
  ctx.fillStyle = '#f5efd8';
  ctx.beginPath();
  ctx.arc(mx, my, mr, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#e4dcc2';
  ctx.beginPath();
  ctx.arc(mx - mr * 0.3, my - mr * 0.2, mr * 0.18, 0, Math.PI * 2);
  ctx.arc(mx + mr * 0.25, my + mr * 0.3, mr * 0.12, 0, Math.PI * 2);
  ctx.fill();
}

// ------------------------------------------------------------------ side view

function drawSceneSide(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number,
  t: number
): void {
  const w = proj.w;
  const railY = proj.toScreen(proj.camS, 0, 1).y;
  const farRailY = proj.toScreen(proj.camS, 0, -1).y;
  const px = proj.pxPerM;
  const sLeft = proj.camS - w / 2 / px - 2;
  const sRight = proj.camS + w / 2 / px + 2;

  // ballast bed
  ctx.fillStyle = '#1a1f2c';
  ctx.fillRect(0, farRailY - 8, w, proj.h - farRailY + 8);
  ctx.fillStyle = '#232a3a';
  ctx.fillRect(0, railY + 4, w, proj.h - railY - 4);

  // catenary poles (background rhythm)
  ctx.strokeStyle = '#2a3348';
  ctx.lineWidth = 4;
  for (let s = Math.ceil(sLeft / 12) * 12; s < sRight; s += 12) {
    const x = proj.toScreen(s, 0, -1).x;
    ctx.beginPath();
    ctx.moveTo(x, farRailY - 4);
    ctx.lineTo(x, farRailY - 150);
    ctx.lineTo(x + 30, farRailY - 150);
    ctx.stroke();
  }

  // sleepers
  ctx.fillStyle = '#2c3040';
  for (let s = Math.ceil(sLeft / 0.66) * 0.66; s < sRight; s += 0.66) {
    const x = proj.toScreen(s, 0, 0).x;
    ctx.fillRect(x - 3, farRailY + 2, 6, railY - farRailY + 6);
  }

  drawRailSide(ctx, game, proj, -1, farRailY, sLeft, sRight);
  drawRailSide(ctx, game, proj, 1, railY, sLeft, sRight);

  drawWaveOverlaySide(ctx, game, proj, glow);

  if (game.phase === 'testRun' || game.phase === 'replay') drawTrainSide(ctx, game, proj, t);
  drawCarSide(ctx, game, proj, glow, t);
  if (game.scanActive) drawLaserSide(ctx, game, proj, glow, t);
  drawParticlesSide(ctx, game, proj, glow);
  drawVignette(ctx, proj.w, proj.h);
}

function drawRailSide(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  lateral: number,
  y: number,
  sLeft: number,
  sRight: number
): void {
  const near = lateral > 0;
  ctx.lineWidth = near ? 7 : 5;
  ctx.strokeStyle = near ? '#8f99ad' : '#5c6478';
  ctx.beginPath();
  ctx.moveTo(0, y);
  ctx.lineTo(proj.w, y);
  ctx.stroke();
  ctx.lineWidth = near ? 2.4 : 1.6;
  ctx.strokeStyle = near ? '#e8eefb' : '#9aa4bb';
  ctx.beginPath();
  ctx.moveTo(0, y - (near ? 2.2 : 1.6));
  ctx.lineTo(proj.w, y - (near ? 2.2 : 1.6));
  ctx.stroke();

  // freshly-ground shine
  const rail = game.rail;
  ctx.lineWidth = near ? 3.4 : 2.2;
  ctx.strokeStyle = 'rgba(210,240,255,0.85)';
  ctx.beginPath();
  let drawing = false;
  const i0 = Math.max(0, Math.floor(Rail.posToSample(sLeft)));
  const i1 = Math.min(SAMPLES - 1, Math.ceil(Rail.posToSample(sRight)));
  for (let i = i0; i <= i1; i++) {
    if (rail.groundMask[i] > 0.25) {
      const x = proj.toScreen(Rail.sampleToPos(i), 0, lateral).x;
      if (!drawing) {
        ctx.moveTo(x, y - 2);
        drawing = true;
      } else ctx.lineTo(x, y - 2);
    } else drawing = false;
  }
  ctx.stroke();
}

function waveColor(mag: number): string {
  // rough → amber, smooth → calm cyan
  const k = Math.min(1, mag / 0.9);
  const r = Math.round(0x7f + (0xff - 0x7f) * k);
  const g = Math.round(0xe9 + (0xb1 - 0xe9) * k);
  const b = Math.round(0xff + (0x4e - 0xff) * k);
  return `rgb(${r},${g},${b})`;
}

/**
 * Local corrugation envelope: max |h| in a ±window around sample i.
 * Colouring by envelope (not instantaneous |h|) keeps a still-broken section
 * amber even at the sine's zero crossings.
 */
function envelopeAt(heights: Float32Array, i: number): number {
  let m = 0;
  const i0 = Math.max(0, i - 5);
  const i1 = Math.min(SAMPLES - 1, i + 5);
  for (let k = i0; k <= i1; k++) {
    const a = Math.abs(heights[k]);
    if (a > m) m = a;
  }
  return m;
}

function drawWaveOverlaySide(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number
): void {
  if (game.revealFront < 0) return;
  const baseY = proj.toScreen(proj.camS, 0, 1).y - 26;
  const amp = 15;
  const showGhost = (game.phase === 'scanAfter' || game.phase === 'testRun') && game.beforeHeights;
  if (showGhost && game.beforeHeights) {
    ctx.globalAlpha = 0.3 * glow;
    ctx.lineWidth = 3;
    ctx.strokeStyle = AMBER;
    strokeHeights(ctx, game.beforeHeights, proj, baseY, amp, TRACK_LENGTH);
    ctx.globalAlpha = 1;
  }
  // live wave up to the reveal front
  ctx.lineWidth = 4;
  ctx.shadowBlur = 12 * glow;
  const upTo = Math.min(game.revealFront, TRACK_LENGTH);
  const rail = game.rail;
  const i1 = Math.min(SAMPLES - 1, Math.floor(Rail.posToSample(upTo)));
  let prev: { x: number; y: number } | null = null;
  for (let i = 0; i <= i1; i += 2) {
    const s = Rail.sampleToPos(i);
    const p = proj.toScreen(s, 0, 1);
    if (p.x < -20 || p.x > proj.w + 20) {
      prev = null;
      continue;
    }
    const y = baseY - rail.heights[i] * amp;
    if (prev) {
      const mag = envelopeAt(rail.heights, i);
      ctx.strokeStyle = waveColor(mag);
      ctx.shadowColor = waveColor(mag);
      ctx.globalAlpha = 0.85 * glow;
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, y);
      ctx.stroke();
    }
    prev = { x: p.x, y };
  }
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function strokeHeights(
  ctx: CanvasRenderingContext2D,
  heights: Float32Array,
  proj: Projection,
  baseY: number,
  amp: number,
  upTo: number
): void {
  ctx.beginPath();
  let started = false;
  const i1 = Math.min(SAMPLES - 1, Math.floor(Rail.posToSample(upTo)));
  for (let i = 0; i <= i1; i += 2) {
    const p = proj.toScreen(Rail.sampleToPos(i), 0, 1);
    if (p.x < -20 || p.x > proj.w + 20) continue;
    const y = baseY - heights[i] * amp;
    if (!started) {
      ctx.moveTo(p.x, y);
      started = true;
    } else ctx.lineTo(p.x, y);
  }
  ctx.stroke();
}

function drawLaserSide(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number,
  t: number
): void {
  const p = proj.toScreen(game.scanPos, 0, 1);
  const topY = proj.toScreen(game.scanPos, 0, -1).y - 120;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // scanner pod
  ctx.fillStyle = '#3a4a66';
  ctx.fillRect(p.x - 16, topY - 14, 32, 18);
  ctx.fillStyle = LASER;
  ctx.globalAlpha = 0.9 * glow;
  ctx.fillRect(p.x - 5, topY - 6, 10, 6);
  // beam
  const grad = ctx.createLinearGradient(p.x, topY, p.x, p.y);
  grad.addColorStop(0, 'rgba(159,216,255,0.05)');
  grad.addColorStop(1, `rgba(159,216,255,${0.5 * glow})`);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(p.x - 2, topY);
  ctx.lineTo(p.x + 2, topY);
  ctx.lineTo(p.x + 9, p.y);
  ctx.lineTo(p.x - 9, p.y);
  ctx.closePath();
  ctx.fill();
  // hot dot on the rail
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#e8f7ff';
  ctx.beginPath();
  ctx.arc(p.x, p.y - 2, 4 + Math.sin(t * 9) * 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCarSide(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number,
  t: number
): void {
  const px = proj.pxPerM;
  const front = proj.toScreen(game.carPos, 0, 1);
  const x1 = front.x;
  const x0 = x1 - CAR_LENGTH * px;
  const railY = front.y;
  const bodyH = 2.1 * px;
  const bodyY = railY - 0.95 * px - bodyH;

  // work lamps glow on the track
  if (game.phase !== 'title' && game.phase !== 'testRun' && game.phase !== 'replay') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(
      (x0 + x1) / 2,
      railY,
      6,
      (x0 + x1) / 2,
      railY,
      CAR_LENGTH * px * 0.75
    );
    lg.addColorStop(0, `rgba(255,214,110,${0.16 * glow})`);
    lg.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(x0 - 80, railY - 60, CAR_LENGTH * px + 160, 90);
    ctx.restore();
  }

  // frame + body
  ctx.fillStyle = '#38404f';
  ctx.fillRect(x0 + 4, railY - 0.95 * px, CAR_LENGTH * px - 8, 0.35 * px);
  roundRect(ctx, x0, bodyY, CAR_LENGTH * px, bodyH, 10);
  const bodyGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  bodyGrad.addColorStop(0, '#ffd23e');
  bodyGrad.addColorStop(0.6, '#f5b81e');
  bodyGrad.addColorStop(1, '#c78d12');
  ctx.fillStyle = bodyGrad;
  ctx.fill();
  ctx.strokeStyle = '#7a5b10';
  ctx.lineWidth = 2;
  ctx.stroke();
  // cab window (front/right side)
  ctx.fillStyle = '#20304a';
  roundRect(ctx, x1 - 1.6 * px, bodyY + 0.2 * px, 1.15 * px, 0.8 * px, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,244,200,0.5)';
  roundRect(ctx, x1 - 1.55 * px, bodyY + 0.25 * px, 0.5 * px, 0.4 * px, 4);
  ctx.fill();
  // hazard stripes on the skirt
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + 4, bodyY + bodyH - 0.34 * px, CAR_LENGTH * px - 8, 0.3 * px);
  ctx.clip();
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i % 2 ? '#2b2f3a' : '#ffcf57';
    const sx = x0 + 4 + i * 0.45 * px;
    ctx.beginPath();
    ctx.moveTo(sx, bodyY + bodyH);
    ctx.lineTo(sx + 0.3 * px, bodyY + bodyH - 0.4 * px);
    ctx.lineTo(sx + 0.6 * px, bodyY + bodyH - 0.4 * px);
    ctx.lineTo(sx + 0.3 * px, bodyY + bodyH);
    ctx.fill();
  }
  ctx.restore();
  // roof beacon: slow amber pulse (never a strobe)
  const pulse = 0.55 + 0.35 * Math.sin(t * 2.4);
  ctx.fillStyle = '#3a4152';
  ctx.fillRect(x0 + CAR_LENGTH * px * 0.45, bodyY - 0.28 * px, 0.5 * px, 0.28 * px);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pulse * glow;
  ctx.fillStyle = '#ffab3d';
  ctx.beginPath();
  ctx.arc(x0 + CAR_LENGTH * px * 0.45 + 0.25 * px, bodyY - 0.3 * px, 0.16 * px + pulse * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // wheels
  const wheelR = 0.42 * px;
  for (const off of [-1.1, -2.0, -6.0, -6.9]) {
    drawWheel(ctx, x1 + off * px, railY - wheelR * 0.95, wheelR, game.carPos * 2.2);
  }

  // grinding units under the frame
  for (let i = 0; i < 2; i++) {
    const docked = game.unitsDocked[i];
    if (!docked && (game.phase === 'prepUnits' || game.phase === 'title')) continue;
    const ux = x1 + UNIT_OFFSETS[i] * px;
    const raisedY = railY - 0.95 * px;
    const dropY = raisedY + game.unitDrop * (0.72 * px);
    drawGrindUnit(ctx, ux, dropY, px * 0.9, game.spin, t, glow, game.locked && game.carSpeed > 0.05);
  }
  // spark deflector plate + mist arm behind the rear unit
  if (game.unitsDocked[1] && game.unitDrop > 0.5) {
    const bx = x1 + (UNIT_OFFSETS[1] - 0.9) * px;
    ctx.fillStyle = '#4a5265';
    ctx.beginPath();
    ctx.moveTo(bx, railY - 0.9 * px);
    ctx.lineTo(bx - 0.5 * px, railY - 0.15 * px);
    ctx.lineTo(bx - 0.34 * px, railY - 0.1 * px);
    ctx.lineTo(bx + 0.16 * px, railY - 0.85 * px);
    ctx.closePath();
    ctx.fill();
  }
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, rot: number): void {
  ctx.fillStyle = '#242a38';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8b93a8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(x, y, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 2;
  for (let k = 0; k < 3; k++) {
    const a = rot + (k * Math.PI) / 1.5;
    ctx.beginPath();
    ctx.moveTo(x - Math.cos(a) * r * 0.7, y - Math.sin(a) * r * 0.7);
    ctx.lineTo(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.7);
    ctx.stroke();
  }
}

function drawGrindUnit(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  spin: number,
  t: number,
  glow: number,
  hot: boolean
): void {
  // housing
  ctx.fillStyle = '#525c72';
  roundRect(ctx, x - size * 0.55, y - size * 0.5, size * 1.1, size * 0.55, 6);
  ctx.fill();
  ctx.strokeStyle = '#2c3242';
  ctx.lineWidth = 2;
  ctx.stroke();
  // stone disc
  const r = size * 0.34;
  const cy = y + r * 0.35;
  ctx.fillStyle = hot ? '#c9a06a' : '#9aa2b5';
  ctx.beginPath();
  ctx.arc(x, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3a4152';
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    const a = t * spin * 22 + (k * Math.PI) / 2;
    ctx.beginPath();
    ctx.moveTo(x, cy);
    ctx.lineTo(x + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
    ctx.stroke();
  }
  if (hot) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * glow;
    ctx.fillStyle = '#ffc46b';
    ctx.beginPath();
    ctx.arc(x, cy + r * 0.8, r * 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function drawTrainSide(ctx: CanvasRenderingContext2D, game: Game, proj: Projection, t: number): void {
  const px = proj.pxPerM;
  const front = proj.toScreen(game.train.pos, 0, 1);
  const x1 = front.x;
  const x0 = x1 - TRAIN_LENGTH * px;
  if (x1 < -60 || x0 > proj.w + 60) return;
  const railY = front.y;
  const bodyH = 1.8 * px;
  const bob = game.train.bob * 3;
  const bodyY = railY - 0.75 * px - bodyH + bob;
  roundRect(ctx, x0, bodyY, TRAIN_LENGTH * px, bodyH, 12);
  const g = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  g.addColorStop(0, '#7fb2ff');
  g.addColorStop(1, '#3f6cc4');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#23407a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // nose
  ctx.fillStyle = '#2c4c8e';
  roundRect(ctx, x1 - 8, bodyY + 4, 12, bodyH - 8, 6);
  ctx.fill();
  // windows with the plush passenger
  for (let k = 0; k < 3; k++) {
    const wx = x0 + (0.8 + k * 1.7) * px;
    ctx.fillStyle = '#fdf3cf';
    roundRect(ctx, wx, bodyY + 0.28 * px, 0.9 * px, 0.7 * px, 5);
    ctx.fill();
    if (k === 1) {
      const plushBob = game.train.bob * 5;
      const cx = wx + 0.45 * px;
      const cy = bodyY + 0.75 * px + plushBob;
      ctx.fillStyle = '#a5713f';
      ctx.beginPath();
      ctx.arc(cx, cy, 0.24 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(cx - 0.17 * px, cy - 0.2 * px, 0.09 * px, 0, Math.PI * 2);
      ctx.arc(cx + 0.17 * px, cy - 0.2 * px, 0.09 * px, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#402c16';
      ctx.beginPath();
      ctx.arc(cx - 0.07 * px, cy - 0.03 * px, 0.025 * px, 0, Math.PI * 2);
      ctx.arc(cx + 0.07 * px, cy - 0.03 * px, 0.025 * px, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // headlight when moving
  if (game.train.speed > 0.3) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#fff3c9';
    ctx.beginPath();
    ctx.moveTo(x1, bodyY + bodyH * 0.6);
    ctx.lineTo(x1 + 3 * px, railY - 6);
    ctx.lineTo(x1 + 3 * px, bodyY + bodyH * 0.2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const wheelR = 0.34 * px;
  for (const off of [-0.8, -2.2, -3.9, -5.2]) {
    drawWheel(ctx, x1 + off * px, railY - wheelR * 0.9, wheelR, game.train.pos * 2.8 + t * 0);
  }
}

function drawParticlesSide(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number
): void {
  const px = proj.pxPerM;
  const anchor = proj.toScreen(game.carPos + UNIT_OFFSETS[1], 0, 1);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  game.sparkSystem.sparks.forEach((p) => {
    const x = anchor.x - p.dx * px;
    const y = anchor.y - p.dy * px;
    const lifeK = p.life / p.maxLife;
    const heat = p.heat;
    const r = Math.round(255);
    const g = Math.round(140 + heat * 110);
    const b = Math.round(40 + heat * 180);
    ctx.strokeStyle = `rgba(${r},${g},${b},${lifeK * 0.9 * glow})`;
    ctx.lineWidth = p.size * 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + p.vx * px * 0.06, y + p.vy * px * 0.06);
    ctx.stroke();
  });
  ctx.restore();
  // mist (normal blending — soft, not glowing)
  game.sparkSystem.mist.forEach((p) => {
    const x = anchor.x - p.dx * px;
    const y = anchor.y - p.dy * px;
    const lifeK = p.life / p.maxLife;
    ctx.fillStyle = `rgba(190,220,240,${lifeK * 0.16})`;
    ctx.beginPath();
    ctx.arc(x, y, p.size * 7, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ------------------------------------------------------------------ portrait view

function drawScenePortrait(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number,
  t: number
): void {
  const camS = proj.camS;
  const far = camS + 46;
  // ground plane
  ctx.fillStyle = '#141a2a';
  ctx.fillRect(0, proj.horizonY, proj.w, proj.h - proj.horizonY);
  // ballast strip
  ctx.fillStyle = '#1d2436';
  ctx.beginPath();
  const bl = proj.toScreen(camS + 1.8, 0, -2.1);
  const br = proj.toScreen(camS + 1.8, 0, 2.1);
  const fl = proj.toScreen(far, 0, -2.1);
  const fr = proj.toScreen(far, 0, 2.1);
  ctx.moveTo(bl.x, bl.y);
  ctx.lineTo(br.x, br.y);
  ctx.lineTo(fr.x, fr.y);
  ctx.lineTo(fl.x, fl.y);
  ctx.closePath();
  ctx.fill();

  // sleepers
  ctx.strokeStyle = '#2c3040';
  for (let s = Math.ceil(camS + 2); s < far; s += 1) {
    const a = proj.toScreen(s, 0, -1.15);
    const b = proj.toScreen(s, 0, 1.15);
    ctx.lineWidth = Math.max(1.5, a.scale * 0.16);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  // rails
  for (const lat of [-RAIL_HALF_GAP, RAIL_HALF_GAP]) {
    drawRailPersp(ctx, game, proj, lat, far);
  }

  drawWaveOverlayPersp(ctx, game, proj, glow);
  if (game.scanActive) drawLaserPersp(ctx, game, proj, glow, t);
  // painter's order: the farther vehicle first, nearest last
  const trainFarther = game.train.pos - TRAIN_LENGTH > game.carPos - CAR_LENGTH;
  const showTrain = game.phase === 'testRun' || game.phase === 'replay';
  if (showTrain && trainFarther) drawTrainPersp(ctx, game, proj, t);
  drawCarPersp(ctx, game, proj, glow, t);
  if (showTrain && !trainFarther) drawTrainPersp(ctx, game, proj, t);
  drawParticlesPersp(ctx, game, proj, glow);
  drawVignette(ctx, proj.w, proj.h);
}

function drawRailPersp(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  lat: number,
  far: number
): void {
  const camS = proj.camS;
  let prev = proj.toScreen(camS + 1.8, 0, lat);
  for (let s = camS + 2.4; s < far; s += 0.8) {
    const p = proj.toScreen(s, 0, lat);
    ctx.strokeStyle = '#8f99ad';
    ctx.lineWidth = Math.max(1.2, p.scale * 0.09);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    // ground shine
    const i = Math.round(Rail.posToSample(s));
    if (i >= 0 && i < SAMPLES && game.rail.groundMask[i] > 0.25) {
      ctx.strokeStyle = 'rgba(220,244,255,0.9)';
      ctx.lineWidth = Math.max(1, p.scale * 0.05);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y - 1);
      ctx.lineTo(p.x, p.y - 1);
      ctx.stroke();
    }
    prev = p;
  }
}

function drawWaveOverlayPersp(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number
): void {
  if (game.revealFront < 0) return;
  const showGhost = (game.phase === 'scanAfter' || game.phase === 'testRun') && game.beforeHeights;
  for (const lat of [-RAIL_HALF_GAP, RAIL_HALF_GAP]) {
    if (showGhost && game.beforeHeights) {
      ctx.globalAlpha = 0.28 * glow;
      drawHeightsPersp(ctx, game.beforeHeights, proj, lat, TRACK_LENGTH, AMBER, false);
      ctx.globalAlpha = 1;
    }
    drawHeightsPersp(ctx, game.rail.heights, proj, lat, Math.min(game.revealFront, TRACK_LENGTH), '', true);
  }
}

function drawHeightsPersp(
  ctx: CanvasRenderingContext2D,
  heights: Float32Array,
  proj: Projection,
  lat: number,
  upTo: number,
  fixedColor: string,
  colorByMag: boolean
): void {
  const camS = proj.camS;
  const start = Math.max(2, camS + 2.2);
  let prev: { x: number; y: number } | null = null;
  ctx.shadowBlur = 8;
  for (let s = start; s < Math.min(upTo, camS + 44); s += 0.35) {
    const i = Math.min(SAMPLES - 1, Math.max(0, Math.round(Rail.posToSample(s))));
    const h = heights[i];
    const p = proj.toScreen(s, 0.4 + h * 0.55, lat);
    if (prev) {
      const c = colorByMag ? waveColor(envelopeAt(heights, i)) : fixedColor;
      ctx.strokeStyle = c;
      ctx.shadowColor = c;
      ctx.lineWidth = Math.max(1.4, p.scale * 0.035);
      ctx.beginPath();
      ctx.moveTo(prev.x, prev.y);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    prev = p;
  }
  ctx.shadowBlur = 0;
}

function drawLaserPersp(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number,
  t: number
): void {
  const s = game.scanPos;
  if (s < proj.camS + 2) return;
  const a = proj.toScreen(s, 1.9, -1.5);
  const b = proj.toScreen(s, 1.9, 1.5);
  const ra = proj.toScreen(s, 0, -RAIL_HALF_GAP);
  const rb = proj.toScreen(s, 0, RAIL_HALF_GAP);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = LASER;
  ctx.globalAlpha = 0.8 * glow;
  ctx.lineWidth = Math.max(2, a.scale * 0.05);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.globalAlpha = 0.5 * glow;
  for (const r of [ra, rb]) {
    ctx.beginPath();
    ctx.moveTo((a.x + b.x) / 2, a.y);
    ctx.lineTo(r.x, r.y);
    ctx.stroke();
  }
  ctx.globalAlpha = glow;
  ctx.fillStyle = '#eaf7ff';
  for (const r of [ra, rb]) {
    ctx.beginPath();
    ctx.arc(r.x, r.y, 3 + Math.sin(t * 9), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawCarPersp(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number,
  t: number
): void {
  const rearS = game.carPos - CAR_LENGTH;
  if (rearS < proj.camS + 2.2) return; // behind or inside the camera
  const p = proj.toScreen(rearS, 0, 0);
  const k = p.scale;
  // slightly narrower than the real 3 m so the spark shower spills out past
  // the body sides instead of hiding behind it
  const bw = 2.6 * k;
  const bh = 2.6 * k;
  const x = p.x - bw / 2;
  const y = p.y - bh - 0.3 * k;

  // lamp glow ahead (on the track beyond the car)
  if (game.phase !== 'title' && game.phase !== 'testRun' && game.phase !== 'replay') {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gy = proj.toScreen(rearS + CAR_LENGTH + 3, 0, 0);
    const lg = ctx.createRadialGradient(gy.x, gy.y, 2, gy.x, gy.y, bw * 0.9);
    lg.addColorStop(0, `rgba(255,214,110,${0.14 * glow})`);
    lg.addColorStop(1, 'rgba(255,214,110,0)');
    ctx.fillStyle = lg;
    ctx.fillRect(gy.x - bw, gy.y - bw * 0.5, bw * 2, bw);
    ctx.restore();
  }

  roundRect(ctx, x, y, bw, bh, 8);
  const grad = ctx.createLinearGradient(x, y, x, y + bh);
  grad.addColorStop(0, '#ffd23e');
  grad.addColorStop(1, '#c78d12');
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = '#7a5b10';
  ctx.lineWidth = 2;
  ctx.stroke();
  // rear window + handrails
  ctx.fillStyle = '#20304a';
  roundRect(ctx, x + bw * 0.2, y + bh * 0.12, bw * 0.6, bh * 0.28, 6);
  ctx.fill();
  ctx.strokeStyle = '#8a6c1c';
  ctx.lineWidth = Math.max(1.5, k * 0.03);
  ctx.beginPath();
  ctx.moveTo(x + bw * 0.08, y + bh * 0.15);
  ctx.lineTo(x + bw * 0.08, y + bh * 0.85);
  ctx.moveTo(x + bw * 0.92, y + bh * 0.15);
  ctx.lineTo(x + bw * 0.92, y + bh * 0.85);
  ctx.stroke();
  // hazard skirt
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y + bh * 0.82, bw, bh * 0.14);
  ctx.clip();
  for (let i = 0; i < 10; i++) {
    ctx.fillStyle = i % 2 ? '#2b2f3a' : '#ffcf57';
    ctx.fillRect(x + i * bw * 0.12, y + bh * 0.82, bw * 0.12, bh * 0.14);
  }
  ctx.restore();
  // beacon pulse
  const pulse = 0.55 + 0.35 * Math.sin(t * 2.4);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = pulse * glow;
  ctx.fillStyle = '#ffab3d';
  ctx.beginPath();
  ctx.arc(p.x, y - 0.1 * k, 0.12 * k + pulse * 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // tail lights (steady, small)
  ctx.fillStyle = '#d8564a';
  ctx.beginPath();
  ctx.arc(x + bw * 0.12, y + bh * 0.74, Math.max(2.5, k * 0.05), 0, Math.PI * 2);
  ctx.arc(x + bw * 0.88, y + bh * 0.74, Math.max(2.5, k * 0.05), 0, Math.PI * 2);
  ctx.fill();
  // under-car grind glow while working
  if (game.locked && game.carSpeed > 0.05 && game.spin > 0.8) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5 * glow;
    const ug = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, bw * 0.5);
    ug.addColorStop(0, 'rgba(255,196,107,0.8)');
    ug.addColorStop(1, 'rgba(255,196,107,0)');
    ctx.fillStyle = ug;
    ctx.fillRect(p.x - bw / 2, p.y - 0.4 * k, bw, 0.6 * k);
    ctx.restore();
  }
}

function drawTrainPersp(ctx: CanvasRenderingContext2D, game: Game, proj: Projection, _t: number): void {
  const rearS = game.train.pos - TRAIN_LENGTH;
  if (rearS < proj.camS + 1.9) return;
  const p = proj.toScreen(rearS, 0, 0);
  const k = p.scale;
  const bw = 2.8 * k;
  const bh = 2.4 * k;
  const bob = game.train.bob * k * 0.04;
  const x = p.x - bw / 2;
  const y = p.y - bh - 0.25 * k + bob;
  roundRect(ctx, x, y, bw, bh, 10);
  const g = ctx.createLinearGradient(x, y, x, y + bh);
  g.addColorStop(0, '#7fb2ff');
  g.addColorStop(1, '#3f6cc4');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.strokeStyle = '#23407a';
  ctx.lineWidth = 2;
  ctx.stroke();
  // rear window with plush
  ctx.fillStyle = '#fdf3cf';
  roundRect(ctx, x + bw * 0.22, y + bh * 0.14, bw * 0.56, bh * 0.3, 6);
  ctx.fill();
  const cx = p.x;
  const cy = y + bh * 0.36 + game.train.bob * k * 0.06;
  ctx.fillStyle = '#a5713f';
  ctx.beginPath();
  ctx.arc(cx, cy, bw * 0.09, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - bw * 0.065, cy - bw * 0.08, bw * 0.035, 0, Math.PI * 2);
  ctx.arc(cx + bw * 0.065, cy - bw * 0.08, bw * 0.035, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d8564a';
  ctx.beginPath();
  ctx.arc(x + bw * 0.12, y + bh * 0.78, Math.max(2, k * 0.045), 0, Math.PI * 2);
  ctx.arc(x + bw * 0.88, y + bh * 0.78, Math.max(2, k * 0.045), 0, Math.PI * 2);
  ctx.fill();
}

function drawParticlesPersp(
  ctx: CanvasRenderingContext2D,
  game: Game,
  proj: Projection,
  glow: number
): void {
  // anchored at the car's visible rear underside so the shower sprays out
  // from under the body toward the viewer, spreading past the body sides
  const anchorS = game.carPos - CAR_LENGTH + 0.4;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  game.sparkSystem.sparks.forEach((p) => {
    const s = anchorS - p.dx;
    if (s < proj.camS + 1.8) return;
    const sp = proj.toScreen(s, p.dy, p.lat * 2.2);
    const lifeK = p.life / p.maxLife;
    const heat = p.heat;
    const r = 255;
    const g = Math.round(140 + heat * 110);
    const b = Math.round(40 + heat * 180);
    const sz = Math.max(1.4, p.size * sp.scale * 0.032);
    ctx.fillStyle = `rgba(${r},${g},${b},${lifeK * 0.9 * glow})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, sz, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();
  game.sparkSystem.mist.forEach((p) => {
    const s = anchorS - p.dx;
    if (s < proj.camS + 1.8) return;
    const sp = proj.toScreen(s, p.dy, p.lat * 2.2);
    const lifeK = p.life / p.maxLife;
    ctx.fillStyle = `rgba(190,220,240,${lifeK * 0.14})`;
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, Math.max(2, p.size * sp.scale * 0.05), 0, Math.PI * 2);
    ctx.fill();
  });
}

// ------------------------------------------------------------------ UI

function drawUI(ctx: CanvasRenderingContext2D, game: Game, L: Layout, glow: number, t: number): void {
  const phase = game.phase;
  // gear (always available, calm gray)
  drawRoundButton(ctx, L.gear, 'rgba(40,48,66,0.75)', '#66708a');
  drawGearIcon(ctx, rectCenter(L.gear), L.gear.w * 0.3);

  if ((phase === 'scanBefore' || phase === 'scanAfter') && !game.scanActive) {
    const done = phase === 'scanBefore' ? game.revealedBefore : game.afterScanDone;
    if (!done) {
      // the first required action each round — keep it the brightest button
      const c = rectCenter(L.scan);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const halo = ctx.createRadialGradient(c.x, c.y, 4, c.x, c.y, L.scan.w * 0.95);
      halo.addColorStop(0, `rgba(159,216,255,${0.28 + 0.1 * Math.sin(t * 2.2)})`);
      halo.addColorStop(1, 'rgba(159,216,255,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(c.x - L.scan.w, c.y - L.scan.w, L.scan.w * 2, L.scan.w * 2);
      ctx.restore();
      pulseRing(ctx, L.scan, t, LASER);
      drawRoundButton(ctx, L.scan, 'rgba(38,78,124,0.96)', '#c8ecff');
      drawLaserIcon(ctx, c, L.scan.w * 0.3);
    }
  }
  if (phase === 'prepUnits') {
    const proj = game.projection();
    for (let i = 0; i < 2; i++) {
      if (game.unitsDocked[i]) continue;
      // socket ghost under the car
      const sock = game.socketRect(i, proj);
      ctx.save();
      ctx.setLineDash([8, 7]);
      ctx.lineDashOffset = -t * 26;
      ctx.strokeStyle = AMBER;
      ctx.globalAlpha = 0.65 + 0.25 * Math.sin(t * 3);
      ctx.lineWidth = 3;
      roundRect(ctx, sock.x + 10, sock.y + 10, sock.w - 20, sock.h - 20, 12);
      ctx.stroke();
      ctx.restore();
      // draggable unit (in tray or at finger)
      const dragging = game.dragUnitIndex === i && game.dragPos;
      const tray = i === 0 ? L.tray0 : L.tray1;
      const cx = dragging ? game.dragPos!.x : tray.x + tray.w / 2;
      const cy = dragging ? game.dragPos!.y : tray.y + tray.h / 2;
      if (!dragging) drawRoundButton(ctx, tray, 'rgba(36,42,58,0.85)', '#5a6478');
      drawGrindUnit(ctx, cx, cy + 6, tray.w * 0.62, 0, t, glow, false);
    }
  }
  // the lever lives only in the lowering step — during grind it would occlude
  // the spark show and invite the wrong (downward) gesture
  if (phase === 'lower') {
    drawLever(ctx, game, L.lever, t);
  }
  if (phase === 'grind' && !game.grindDone) {
    pulseRing(ctx, L.mist, t, '#9fd0ff');
    drawRoundButton(ctx, L.mist, 'rgba(24,42,60,0.85)', '#7fb6e8');
    drawDropIcon(ctx, rectCenter(L.mist), L.mist.w * 0.28);
  }
}

function drawLever(ctx: CanvasRenderingContext2D, game: Game, r: Rect, t: number): void {
  // slot
  ctx.fillStyle = 'rgba(26,32,46,0.88)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.strokeStyle = '#4a5470';
  ctx.lineWidth = 3;
  ctx.stroke();
  const slotX = r.x + r.w / 2;
  const top = r.y + 34;
  const bottom = r.y + r.h - 34;
  ctx.strokeStyle = '#2e3650';
  ctx.lineWidth = 12;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(slotX, top);
  ctx.lineTo(slotX, bottom);
  ctx.stroke();
  // down arrow marks
  ctx.fillStyle = 'rgba(255,209,94,0.5)';
  for (let k = 0; k < 3; k++) {
    const ay = top + ((bottom - top) * (k + 1)) / 4;
    ctx.beginPath();
    ctx.moveTo(slotX - 10, ay - 5);
    ctx.lineTo(slotX + 10, ay - 5);
    ctx.lineTo(slotX, ay + 7);
    ctx.closePath();
    ctx.fill();
  }
  // knob
  const ky = top + (bottom - top) * game.leverProgress;
  const kr = Math.min(r.w * 0.42, 40);
  const locked = game.locked;
  ctx.fillStyle = locked ? '#ffd76a' : '#ffcf57';
  ctx.beginPath();
  ctx.arc(slotX, ky, kr, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5b10';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(122,91,16,0.6)';
  ctx.lineWidth = 2.5;
  for (let k = -1; k <= 1; k++) {
    ctx.beginPath();
    ctx.moveTo(slotX - kr * 0.5, ky + k * 7);
    ctx.lineTo(slotX + kr * 0.5, ky + k * 7);
    ctx.stroke();
  }
  if (locked) {
    ctx.save();
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3);
    ctx.strokeStyle = AMBER;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(slotX, ky, kr + 8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ full-screen scenes

function drawTitle(ctx: CanvasRenderingContext2D, game: Game, L: Layout, t: number): void {
  const w = game.viewW;
  const h = game.viewH;
  ctx.fillStyle = 'rgba(5,9,20,0.45)';
  ctx.fillRect(0, 0, w, h);
  // logo
  const size = Math.min(w, h);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffd76a';
  ctx.font = `bold ${Math.round(size * 0.085)}px "Hiragino Maru Gothic ProN", "BIZ UDGothic", sans-serif`;
  ctx.fillText('レールけずりでんしゃ', w / 2, h * 0.2);
  ctx.fillStyle = '#8fa3c8';
  ctx.font = `${Math.round(size * 0.035)}px sans-serif`;
  ctx.fillText('よるの せんろを ピカピカに', w / 2, h * 0.2 + size * 0.07);
  // play button
  const c = rectCenter(L.play);
  const r = L.play.w / 2;
  pulseRing(ctx, L.play, t, '#ffd76a');
  ctx.fillStyle = '#ffcf57';
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 0.78, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#7a5b10';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#3c2f08';
  ctx.beginPath();
  ctx.moveTo(c.x - r * 0.22, c.y - r * 0.32);
  ctx.lineTo(c.x - r * 0.22, c.y + r * 0.32);
  ctx.lineTo(c.x + r * 0.38, c.y);
  ctx.closePath();
  ctx.fill();
}

function drawReplay(ctx: CanvasRenderingContext2D, game: Game, L: Layout, t: number): void {
  const w = game.viewW;
  const h = game.viewH;
  ctx.fillStyle = 'rgba(5,9,20,0.55)';
  ctx.fillRect(0, 0, w, h);
  drawReplayCard(ctx, L.replaySame, t, true);
  drawReplayCard(ctx, L.replayNew, t, false);
}

function drawReplayCard(ctx: CanvasRenderingContext2D, r: Rect, t: number, same: boolean): void {
  ctx.fillStyle = 'rgba(28,36,54,0.95)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 20);
  ctx.fill();
  ctx.strokeStyle = same ? '#7fe9ff' : '#ffd76a';
  ctx.lineWidth = 4;
  ctx.stroke();
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const s = Math.min(r.w, r.h);
  // wave glyph
  ctx.strokeStyle = same ? '#7fe9ff' : '#ffb14e';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  const waveW = s * 0.66;
  for (let i = 0; i <= 30; i++) {
    const x = cx - waveW / 2 + (waveW * i) / 30;
    const ph = same ? i / 4.5 : i / 3 + 1.2;
    const ampl = same ? s * 0.05 : s * 0.09 * (0.5 + 0.5 * Math.sin(i / 2.5));
    const y = cy + s * 0.12 + Math.sin(ph) * ampl;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  // replay arrow (same) / sparkle (new)
  if (same) {
    ctx.strokeStyle = '#e6f7ff';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy - s * 0.16, s * 0.13, -Math.PI * 0.4, Math.PI * 1.1);
    ctx.stroke();
    const a = Math.PI * 1.1;
    const ax = cx + Math.cos(a) * s * 0.13;
    const ay = cy - s * 0.16 + Math.sin(a) * s * 0.13;
    ctx.fillStyle = '#e6f7ff';
    ctx.beginPath();
    ctx.moveTo(ax - 8, ay - 10);
    ctx.lineTo(ax + 10, ay);
    ctx.lineTo(ax - 10, ay + 8);
    ctx.closePath();
    ctx.fill();
  } else {
    drawSparkleIcon(ctx, cx, cy - s * 0.16, s * 0.13, t);
  }
}

function drawSettings(ctx: CanvasRenderingContext2D, game: Game, L: Layout, t: number): void {
  ctx.fillStyle = 'rgba(4,7,16,0.9)';
  ctx.fillRect(0, 0, game.viewW, game.viewH);
  const s = game.settings;
  drawToggle(ctx, L.toggleLight, !s.softLight, t, (c, cx, cy, r) => {
    // bulb / glow icon
    c.fillStyle = '#ffe9a3';
    c.beginPath();
    c.arc(cx, cy - r * 0.1, r * 0.55, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#c9b269';
    c.fillRect(cx - r * 0.22, cy + r * 0.42, r * 0.44, r * 0.3);
    c.strokeStyle = '#ffe9a3';
    c.lineWidth = 3;
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * r * 0.72, cy - r * 0.1 + Math.sin(a) * r * 0.72);
      c.lineTo(cx + Math.cos(a) * r * 0.95, cy - r * 0.1 + Math.sin(a) * r * 0.95);
      c.stroke();
    }
  });
  drawToggle(ctx, L.toggleMotion, !s.softMotion, t, (c, cx, cy, r) => {
    c.strokeStyle = '#9fd8ff';
    c.lineWidth = 5;
    c.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      c.beginPath();
      c.moveTo(cx - r * 0.7, cy + k * r * 0.42);
      c.quadraticCurveTo(cx - r * 0.2, cy + k * r * 0.42 - r * 0.3, cx + r * 0.2, cy + k * r * 0.42);
      c.quadraticCurveTo(cx + r * 0.55, cy + k * r * 0.42 + r * 0.22, cx + r * 0.75, cy + k * r * 0.42);
      c.stroke();
    }
  });
  drawToggle(ctx, L.toggleSound, !s.softSound, t, (c, cx, cy, r) => {
    c.fillStyle = '#cfe0ff';
    c.beginPath();
    c.moveTo(cx - r * 0.6, cy - r * 0.25);
    c.lineTo(cx - r * 0.2, cy - r * 0.25);
    c.lineTo(cx + r * 0.25, cy - r * 0.6);
    c.lineTo(cx + r * 0.25, cy + r * 0.6);
    c.lineTo(cx - r * 0.2, cy + r * 0.25);
    c.lineTo(cx - r * 0.6, cy + r * 0.25);
    c.closePath();
    c.fill();
    c.strokeStyle = '#cfe0ff';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(cx + r * 0.42, cy, r * 0.35, -0.9, 0.9);
    c.stroke();
  });
  // close: big friendly down-chevron circle
  const r = L.closeSettings;
  drawRoundButton(ctx, r, 'rgba(46,54,76,0.95)', '#8fa0c0');
  const c = rectCenter(r);
  ctx.strokeStyle = '#d6e2f8';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c.x - 16, c.y - 6);
  ctx.lineTo(c.x, c.y + 10);
  ctx.lineTo(c.x + 16, c.y - 6);
  ctx.stroke();
}

function drawToggle(
  ctx: CanvasRenderingContext2D,
  r: Rect,
  on: boolean,
  _t: number,
  icon: (c: CanvasRenderingContext2D, cx: number, cy: number, radius: number) => void
): void {
  ctx.fillStyle = on ? 'rgba(48,62,92,0.95)' : 'rgba(26,30,42,0.95)';
  roundRect(ctx, r.x, r.y, r.w, r.h, 18);
  ctx.fill();
  ctx.strokeStyle = on ? '#7fa8e8' : '#454e64';
  ctx.lineWidth = 4;
  ctx.stroke();
  const c = rectCenter(r);
  ctx.save();
  ctx.globalAlpha = on ? 1 : 0.45;
  icon(ctx, c.x, c.y, r.w * 0.3);
  ctx.restore();
  if (!on) {
    ctx.strokeStyle = '#8b93a8';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(r.x + r.w * 0.2, r.y + r.h * 0.8);
    ctx.lineTo(r.x + r.w * 0.8, r.y + r.h * 0.2);
    ctx.stroke();
  }
}

// ------------------------------------------------------------------ hint ghost

function drawHint(ctx: CanvasRenderingContext2D, game: Game, t: number): void {
  const hint = game.currentHint();
  if (!hint) return;
  const cycle = (t % 1.7) / 1.7;
  const ease = cycle < 0.5 ? smooth(cycle * 2) : 1;
  const x = hint.from.x + (hint.to.x - hint.from.x) * (hint.kind === 'swipe' ? ease : 0);
  const y = hint.from.y + (hint.to.y - hint.from.y) * (hint.kind === 'swipe' ? ease : 0);
  ctx.save();
  if (hint.kind === 'swipe') {
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.setLineDash([2, 16]);
    ctx.beginPath();
    ctx.moveTo(hint.from.x, hint.from.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  const scale = hint.kind === 'tap' ? 1 + 0.15 * Math.sin(t * 5) : 1;
  ctx.font = `${Math.round(52 * scale)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.globalAlpha = 0.9;
  ctx.fillText('👆', x + 10, y + 30);
  ctx.restore();
}

// ------------------------------------------------------------------ helpers

function drawRoundButton(ctx: CanvasRenderingContext2D, r: Rect, fill: string, stroke: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(r.x + r.w / 2, r.y + r.h / 2, Math.min(r.w, r.h) / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function pulseRing(ctx: CanvasRenderingContext2D, r: Rect, t: number, color: string): void {
  const c = rectCenter(r);
  const base = Math.min(r.w, r.h) / 2;
  const k = (t % 1.4) / 1.4;
  ctx.save();
  ctx.globalAlpha = (1 - k) * 0.5;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(c.x, c.y, base + k * 26, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawLaserIcon(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, r: number): void {
  ctx.strokeStyle = LASER;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - r);
  ctx.lineTo(c.x, c.y + r * 0.5);
  ctx.stroke();
  ctx.fillStyle = LASER;
  ctx.beginPath();
  ctx.arc(c.x, c.y + r * 0.75, 5, 0, Math.PI * 2);
  ctx.fill();
  // wave under the dot
  ctx.beginPath();
  ctx.lineWidth = 3;
  for (let i = 0; i <= 16; i++) {
    const x = c.x - r + (2 * r * i) / 16;
    const y = c.y + r * 1.15 + Math.sin(i / 1.6) * 4;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

function drawDropIcon(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, r: number): void {
  ctx.fillStyle = '#9fd8ff';
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - r);
  ctx.quadraticCurveTo(c.x + r * 0.95, c.y + r * 0.15, c.x, c.y + r);
  ctx.quadraticCurveTo(c.x - r * 0.95, c.y + r * 0.15, c.x, c.y - r);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.arc(c.x - r * 0.25, c.y + r * 0.15, r * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

function drawGearIcon(ctx: CanvasRenderingContext2D, c: { x: number; y: number }, r: number): void {
  ctx.strokeStyle = '#aab4cc';
  ctx.fillStyle = '#aab4cc';
  ctx.lineWidth = 3;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * r * 0.7, c.y + Math.sin(a) * r * 0.7);
    ctx.lineTo(c.x + Math.cos(a) * r * 1.1, c.y + Math.sin(a) * r * 1.1);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 0.7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(c.x, c.y, r * 0.3, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSparkleIcon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number): void {
  ctx.fillStyle = '#ffe9a3';
  const s = 1 + 0.1 * Math.sin(t * 4);
  for (const [dx, dy, rr] of [
    [0, 0, r * s],
    [r * 1.1, -r * 0.6, r * 0.45],
    [-r * 0.9, r * 0.55, r * 0.35],
  ] as const) {
    ctx.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const rad = k % 2 === 0 ? rr : rr * 0.4;
      const x = cx + dx + Math.cos(a) * rad;
      const y = cy + dy + Math.sin(a) * rad;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.75);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function smooth(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return x * x * (3 - 2 * x);
}
