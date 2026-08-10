// OWNER: agent A3 scene — background, pot, anchors, dessert, camera.
// Vanilla ES module. No libs, no assets.

let cfg = null;
let bgCanvas = null;      // cached background, redrawn only on resize
let nestReady = false;    // transient: dessert halo on/off (nest:ready / nest:placed)

// Static-geometry gradients: rebuilt only on resize (or init), reused every frame otherwise.
// Animated ones (moving specular, pot pulse, dessert halo pulse) stay allocated per-frame.
let ctxRef = null;
let potBodyGrad = null;
let dessertPlateGrad = null;
let dessertDomeGrad = null;
let anchorGlowGrads = null; // array parallel to state.layout.anchors, base-alpha 0.85 at stop 0

function buildStaticGradients(state) {
  if (!ctxRef || !state.layout) return;
  const p = state.layout.pot;
  const bodyGrad = ctxRef.createLinearGradient(0, -p.ry, 0, p.ry);
  bodyGrad.addColorStop(0, '#603a1c');
  bodyGrad.addColorStop(1, '#2a190c');
  potBodyGrad = bodyGrad;

  const d = state.layout.dessert;
  const plateGrad = ctxRef.createLinearGradient(0, d.r * 0.1, 0, d.r * 0.7);
  plateGrad.addColorStop(0, '#d9d0c2');
  plateGrad.addColorStop(1, '#a89a86');
  dessertPlateGrad = plateGrad;

  const domeGrad = ctxRef.createRadialGradient(-d.r * 0.22, -d.r * 0.6, 2, 0, -d.r * 0.3, d.r * 0.9);
  domeGrad.addColorStop(0, '#efe3cf');
  domeGrad.addColorStop(0.6, '#d3c2a5');
  domeGrad.addColorStop(1, '#b0a082');
  dessertDomeGrad = domeGrad;

  anchorGlowGrads = state.layout.anchors.map((a) => {
    const g = ctxRef.createRadialGradient(a.x, a.y, 0, a.x, a.y, 11);
    // base alpha 0.85; per-frame shimmer is applied via ctx.globalAlpha, not a rebuilt gradient.
    g.addColorStop(0, 'rgba(255,214,150,0.85)');
    g.addColorStop(1, 'rgba(255,214,150,0)');
    return g;
  });
}

// camera animation state (module-private; state.camera is the shared field we write)
let camMode = 'idle';     // 'idle' | 'in' | 'drift' | 'out'
let camT = 0;
let camFrom = { x: 0, y: 0, zoom: 1 };
let driftT = 0;

const ZOOM_IN_DUR = 2.5;
const ZOOM_OUT_DUR = 1.0;
const ZOOM_TARGET = 1.35;

// ---------- helpers ----------
function easeInOutCubic(p) { return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
function hexToRgb(hex) { const v = parseInt(hex.slice(1), 16); return [(v >> 16) & 255, (v >> 8) & 255, v & 255]; }
function mixColor(hexA, hexB, t) {
  if (t <= 0) return hexA;
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

// ---------- layout ----------
function computeLayout(w, h) {
  const isPortrait = h >= w;
  const spanY = h * (isPortrait ? 0.34 : 0.32);
  const marginX = w * (isPortrait ? 0.11 : 0.09);
  const anchors = [{ x: marginX, y: spanY }, { x: w - marginX, y: spanY }];
  const span = { x0: marginX, x1: w - marginX, y: spanY };
  const nestHome = { x: w / 2, y: spanY + h * 0.11 };
  const potR = Math.min(w, h) * (isPortrait ? 0.11 : 0.095);
  const pot = { x: w * 0.17, y: h * (isPortrait ? 0.87 : 0.85), rx: potR * 1.15, ry: potR * 0.82 };
  const dessertR = Math.min(w, h) * (isPortrait ? 0.10 : 0.09);
  const dessert = { x: w * 0.83, y: h * (isPortrait ? 0.86 : 0.84), r: dessertR };
  return { isPortrait, pot, anchors, span, nestHome, dessert };
}

// ---------- background (cached offscreen) ----------
function buildBackground(state) {
  const { w, h, dpr } = state;
  const cnv = document.createElement('canvas');
  cnv.width = Math.max(1, Math.round(w * dpr));
  cnv.height = Math.max(1, Math.round(h * dpr));
  const bctx = cnv.getContext('2d');
  bctx.scale(dpr, dpr);

  const g = bctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, cfg.BG_TOP);
  g.addColorStop(1, cfg.BG_BOTTOM);
  bctx.fillStyle = g;
  bctx.fillRect(0, 0, w, h);

  const l = state.layout;
  if (l) {
    // Subtle stage-light wash behind the span — soft and wide, never a visible disc.
    // The amber threads themselves should carry the brightness, not this backdrop.
    const gx = (l.span.x0 + l.span.x1) / 2;
    const gy = l.span.y + (l.nestHome.y - l.span.y) * 0.5;
    const gr = Math.max(l.span.x1 - l.span.x0, w * 0.6) * 1.1;
    const rg = bctx.createRadialGradient(gx, gy, 0, gx, gy, gr);
    rg.addColorStop(0, 'rgba(255,200,140,0.065)');
    rg.addColorStop(0.35, 'rgba(240,170,110,0.032)');
    rg.addColorStop(0.7, 'rgba(220,140,80,0.012)');
    rg.addColorStop(1, 'rgba(220,140,80,0)');
    bctx.fillStyle = rg;
    bctx.fillRect(0, 0, w, h);
  }

  // dim tabletop / counter line for depth
  const ty = h * 0.90;
  const lg = bctx.createLinearGradient(0, ty - 4, 0, ty + 36);
  lg.addColorStop(0, 'rgba(0,0,0,0)');
  lg.addColorStop(0.2, 'rgba(0,0,0,0.28)');
  lg.addColorStop(1, 'rgba(0,0,0,0)');
  bctx.fillStyle = lg;
  bctx.fillRect(0, ty - 4, w, 40);
  bctx.strokeStyle = 'rgba(255,210,160,0.07)';
  bctx.lineWidth = 1;
  bctx.beginPath();
  bctx.moveTo(0, ty);
  bctx.lineTo(w, ty);
  bctx.stroke();

  return cnv;
}

// ---------- draw: anchors ----------
function drawAnchors(ctx, state) {
  const l = state.layout;
  const baseY = state.h * (l.isPortrait ? 0.72 : 0.66);
  for (let i = 0; i < l.anchors.length; i++) {
    const a = l.anchors[i];
    const shimmer = 0.65 + 0.35 * Math.sin(state.time * 1.4 + i * 2.1);
    const midX = a.x + (i === 0 ? 7 : -7);
    ctx.save();
    ctx.strokeStyle = 'rgba(210,200,192,0.55)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, baseY);
    ctx.quadraticCurveTo(midX, (baseY + a.y) / 2, a.x, a.y);
    ctx.stroke();

    // Cached gradient (geometry is static); shimmer animates via globalAlpha instead of a rebuild.
    if (anchorGlowGrads && anchorGlowGrads[i]) {
      ctx.globalAlpha = shimmer;
      ctx.fillStyle = anchorGlowGrads[i];
      ctx.beginPath();
      ctx.arc(a.x, a.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.fillStyle = `rgba(255,238,205,${shimmer})`;
    ctx.arc(a.x, a.y, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ---------- draw: pot ----------
function drawPot(ctx, state) {
  const p = state.layout.pot;
  const t = state.time;
  const low = state.tool.caramel < 0.15;
  const pulse = low ? 0.5 + 0.5 * Math.sin(t * Math.PI * 2 * 1.0) : 0;

  ctx.save();
  ctx.translate(p.x, p.y);

  // contact shadow
  ctx.beginPath();
  ctx.ellipse(0, p.ry * 0.2, p.rx * 1.1, p.ry * 1.0, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fill();

  // body: dark copper (cached — geometry only changes on resize)
  ctx.beginPath();
  ctx.ellipse(0, 0, p.rx, p.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = potBodyGrad || '#3a2210';
  ctx.fill();
  ctx.lineWidth = Math.max(2, p.rx * 0.06);
  ctx.strokeStyle = '#7d4a24';
  ctx.stroke();

  // molten caramel surface
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, -p.ry * 0.12, p.rx * 0.82, p.ry * 0.58, 0, 0, Math.PI * 2);
  ctx.clip();

  const surfGrad = ctx.createRadialGradient(-p.rx * 0.2, -p.ry * 0.35, 2, 0, -p.ry * 0.12, p.rx * 0.95);
  surfGrad.addColorStop(0, mixColor(cfg.AMBER_CORE, '#fff6dc', pulse));
  surfGrad.addColorStop(0.55, cfg.AMBER_MID);
  surfGrad.addColorStop(1, cfg.AMBER_DEEP);
  ctx.fillStyle = surfGrad;
  ctx.fillRect(-p.rx, -p.ry, p.rx * 2, p.ry * 2);

  // slow-rotating gloss streaks (sticky look)
  for (let i = 0; i < 2; i++) {
    const ang = t * 0.15 + i * Math.PI;
    const sx = Math.cos(ang) * p.rx * 0.55;
    const sy = -p.ry * 0.12 + Math.sin(ang) * p.ry * 0.3;
    ctx.strokeStyle = 'rgba(255,242,214,0.16)';
    ctx.lineWidth = p.rx * 0.11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx - Math.cos(ang) * p.rx * 0.5, sy - Math.sin(ang) * p.ry * 0.28);
    ctx.quadraticCurveTo(sx, sy - p.ry * 0.28, sx + Math.cos(ang) * p.rx * 0.5, sy + Math.sin(ang) * p.ry * 0.28);
    ctx.stroke();
  }

  // moving specular highlight
  const hlx = Math.sin(t * 0.8) * p.rx * 0.32;
  const hly = -p.ry * 0.28 + Math.cos(t * 0.6) * p.ry * 0.08;
  const hlGrad = ctx.createRadialGradient(hlx, hly, 0, hlx, hly, p.rx * 0.3);
  hlGrad.addColorStop(0, `rgba(255,250,230,${0.5 + pulse * 0.4})`);
  hlGrad.addColorStop(1, 'rgba(255,250,230,0)');
  ctx.fillStyle = hlGrad;
  ctx.fillRect(-p.rx, -p.ry, p.rx * 2, p.ry * 2);
  ctx.restore();

  ctx.restore();
}

// ---------- draw: dessert ----------
function drawDessert(ctx, state) {
  const d = state.layout.dessert;
  ctx.save();
  ctx.translate(d.x, d.y);

  ctx.beginPath();
  ctx.ellipse(0, d.r * 0.55, d.r * 1.25, d.r * 0.4, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();

  if (nestReady) {
    const pulse = 0.5 + 0.5 * Math.sin(state.time * Math.PI * 2 * 0.6);
    const haloR = d.r * (1.55 + pulse * 0.18);
    const hg = ctx.createRadialGradient(0, -d.r * 0.15, 2, 0, -d.r * 0.15, haloR);
    hg.addColorStop(0, `rgba(255,214,140,${0.26 + pulse * 0.14})`);
    hg.addColorStop(1, 'rgba(255,214,140,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(0, -d.r * 0.15, haloR, 0, Math.PI * 2);
    ctx.fill();
  }

  // plate (cached gradient — geometry only changes on resize)
  ctx.beginPath();
  ctx.ellipse(0, d.r * 0.42, d.r * 1.15, d.r * 0.38, 0, 0, Math.PI * 2);
  ctx.fillStyle = dessertPlateGrad || '#a89a86';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // dessert dome (desaturated so a golden nest can shine on top; cached gradient)
  ctx.beginPath();
  ctx.ellipse(0, -d.r * 0.28, d.r * 0.7, d.r * 0.7, Math.PI, 0, Math.PI, true);
  ctx.closePath();
  ctx.fillStyle = dessertDomeGrad || '#d3c2a5';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, -d.r * 0.26, d.r * 0.72, d.r * 0.2, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#e2d1b4';
  ctx.fill();

  ctx.restore();
}

// ---------- camera ----------
function targetCenter(state) {
  const l = state.layout;
  const nx = state.nest.x || l.dessert.x;
  const ny = state.nest.y || l.dessert.y;
  return { x: (nx + l.dessert.x) / 2, y: (ny + l.dessert.y) / 2 };
}

function startZoomIn(state) { camFrom = { ...state.camera }; camMode = 'in'; camT = 0; }
function startZoomOut(state) { camFrom = { ...state.camera }; camMode = 'out'; camT = 0; }

function updateCamera(dt, state) {
  const l = state.layout;
  if (!l) return;
  const idle = { x: state.w / 2, y: state.h / 2 };

  if (camMode === 'in') {
    camT += dt;
    const p = Math.min(1, camT / ZOOM_IN_DUR);
    const e = easeInOutCubic(p);
    const tc = targetCenter(state);
    state.camera.x = camFrom.x + (tc.x - camFrom.x) * e;
    state.camera.y = camFrom.y + (tc.y - camFrom.y) * e;
    state.camera.zoom = camFrom.zoom + (ZOOM_TARGET - camFrom.zoom) * e;
    if (p >= 1) { camMode = 'drift'; driftT = 0; }
  } else if (camMode === 'drift') {
    driftT += dt;
    const tc = targetCenter(state);
    state.camera.x = tc.x + Math.sin(driftT * 0.5) * 4;
    state.camera.y = tc.y + Math.sin(driftT * 0.33) * 2.5;
    state.camera.zoom = ZOOM_TARGET;
  } else if (camMode === 'out') {
    camT += dt;
    const p = Math.min(1, camT / ZOOM_OUT_DUR);
    const e = easeInOutCubic(p);
    state.camera.x = camFrom.x + (idle.x - camFrom.x) * e;
    state.camera.y = camFrom.y + (idle.y - camFrom.y) * e;
    state.camera.zoom = camFrom.zoom + (1 - camFrom.zoom) * e;
    if (p >= 1) { camMode = 'idle'; state.camera.x = idle.x; state.camera.y = idle.y; state.camera.zoom = 1; }
  } else {
    state.camera.x = idle.x; state.camera.y = idle.y; state.camera.zoom = 1;
  }
}

function onReset(state) {
  nestReady = false;
  startZoomOut(state);
}

// ---------- module ----------
export default {
  init({ ctx, bus, state, config }) {
    cfg = config;
    ctxRef = ctx;
    state.layout = computeLayout(state.w, state.h);
    state.camera.x = state.w / 2;
    state.camera.y = state.h / 2;
    state.camera.zoom = 1;
    bgCanvas = buildBackground(state);
    buildStaticGradients(state);

    bus.on('nest:ready', () => { nestReady = true; });
    bus.on('nest:placed', () => { nestReady = false; startZoomIn(state); });
    bus.on('game:reset', () => { onReset(state); });
  },

  resize(state) {
    state.layout = computeLayout(state.w, state.h);
    if (camMode === 'idle') { state.camera.x = state.w / 2; state.camera.y = state.h / 2; }
    bgCanvas = buildBackground(state);
    buildStaticGradients(state);
  },

  update(dt, state) {
    updateCamera(dt, state);
  },

  render(ctx, state) {
    if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, state.w, state.h);
    if (!state.layout) return;
    drawAnchors(ctx, state);
    drawPot(ctx, state);
    drawDessert(ctx, state);
  },
};

// Applies the camera translate/scale. A1 wraps this with ctx.save()/ctx.restore().
export function applyCamera(ctx, state) {
  const { x, y, zoom } = state.camera;
  const cx = state.w / 2, cy = state.h / 2;
  ctx.translate(cx, cy);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);
}
