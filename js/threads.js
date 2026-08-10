// OWNER: A5 threads — HERO: sugar thread system.
// Warm caramel dragged across the span leaves ultra-fine amber sugar threads hanging between the
// two anchor posts. Threads accumulate into a shimmering nest; at lift/celebrate the whole system
// condenses into a single baked "nest sprite" that rides to the dessert.
//
// Perf design: live strand geometry lives in flat Float32Array SoA buffers (capacity CAP),
// computed once at spawn time — per-frame work is only classification + stroking. When live count
// hits CAP the oldest BAKE_CHUNK strands rasterize into an offscreen "layer" canvas (up to
// MAX_LAYERS; once full, new bakes accumulate onto the OLDEST layer) and drop from the live
// buffers; layers blit with drawImage() every frame. Live strands sort into <=4 style buckets (by
// width/alpha), each stroked with exactly one beginPath()+stroke(). Newborns (<150ms old) draw
// individually with an exact partial-bezier reveal so the thread visibly "shoots" from the swipe.

let bus = null, config = null, S = null;

// ---- module-private tuning ----
const CAP = 140, BAKE_CHUNK = 50, MAX_LAYERS = 3;   // live cap / bake chunk / offscreen layers
const NEWBORN_T = 0.15;       // seconds a strand spends in progressive-reveal mode
const EMIT_INTERVAL = 0.22;   // throttle for threads:added
const STRANDS_PER_PASS = 3.5; // avg strands per full span traversal (2-5 range in practice)
const BASE_SAG_MIN = 14, BASE_SAG_RANGE = 18;
const WIDTH_MID = 1.0, ALPHA_MID = 0.375; // bucket split points (mid of 0.6-1.4 / 0.25-0.5)
const WISP_FADEIN = 0.3, SWEEP_DURATION = 1.3;

const BUCKET_WIDTH   = [0.75, 1.25, 0.85, 1.35];
const BUCKET_ALPHA   = [0.30, 0.32, 0.42, 0.48];
const BUCKET_SHIMMER = [0.55, 0.5, 0.8, 0.7];
const BUCKET_PHASE   = [0, 1.7, 3.1, 4.6];

// live strand SoA buffers
let liveCount = 0;
const sxA = new Float32Array(CAP), syA = new Float32Array(CAP);
const c1xA = new Float32Array(CAP), c1yA = new Float32Array(CAP);
const c2xA = new Float32Array(CAP), c2yA = new Float32Array(CAP);
const exA = new Float32Array(CAP), eyA = new Float32Array(CAP);
const widthA = new Float32Array(CAP), alphaA = new Float32Array(CAP);
const colorTA = new Float32Array(CAP), birthA = new Float32Array(CAP);

// per-frame scratch, reused (no allocation)
const bIdx = [[], [], [], []];
const bColorSum = [0, 0, 0, 0];
const newbornList = [];

let layers = [];                              // baked offscreen layers: [{canvas, ctx, w, h}]
let nestCanvas = null, nestMeta = null;        // lift/celebrate nest sprite
let sweepStart = -Infinity;                    // celebrate light-sweep start time
let wisps = [];                                // tool-tip trail effects

let prevSpawnX = null, spawnBudget = 0, totalPassFrac = 0, totalSpawned = 0;
let deltaSinceEmit = 0, lastEmitTime = 0;

let midRGB = [232, 169, 78], coreRGB = [255, 217, 138], coreColorStr = 'rgb(255,217,138)';

function clamp(x, lo, hi) { return x < lo ? lo : x > hi ? hi : x; }
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function lerp(a, b, t) { return a + (b - a) * t; }
function rand() { return Math.random(); }
function randInt(lo, hi) { return lo + Math.floor(rand() * (hi - lo + 1)); }
function parseHex(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function lerpColor(a, b, t) {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}
// exact partial cubic bezier via De Casteljau split at t (0..1) — used for the newborn "shoot out" reveal.
function partialCubic(t, x0, y0, x1, y1, x2, y2, x3, y3) {
  const l01x = lerp(x0, x1, t), l01y = lerp(y0, y1, t);
  const l12x = lerp(x1, x2, t), l12y = lerp(y1, y2, t);
  const l23x = lerp(x2, x3, t), l23y = lerp(y2, y3, t);
  const l012x = lerp(l01x, l12x, t), l012y = lerp(l01y, l12y, t);
  const l123x = lerp(l12x, l23x, t), l123y = lerp(l12y, l23y, t);
  const bx = lerp(l012x, l123x, t), by = lerp(l012y, l123y, t);
  return [l01x, l01y, l012x, l012y, bx, by];
}

function shiftDown(n) {
  sxA.copyWithin(0, n, liveCount); syA.copyWithin(0, n, liveCount);
  c1xA.copyWithin(0, n, liveCount); c1yA.copyWithin(0, n, liveCount);
  c2xA.copyWithin(0, n, liveCount); c2yA.copyWithin(0, n, liveCount);
  exA.copyWithin(0, n, liveCount); eyA.copyWithin(0, n, liveCount);
  widthA.copyWithin(0, n, liveCount); alphaA.copyWithin(0, n, liveCount);
  colorTA.copyWithin(0, n, liveCount); birthA.copyWithin(0, n, liveCount);
  liveCount -= n;
}

function getBakeCtx(state) {
  if (layers.length < MAX_LAYERS) {
    const w = state.w, h = state.h, dpr = state.dpr || 1;
    const cnv = document.createElement('canvas');
    cnv.width = Math.max(1, Math.round(w * dpr));
    cnv.height = Math.max(1, Math.round(h * dpr));
    const c2 = cnv.getContext('2d');
    c2.setTransform(dpr, 0, 0, dpr, 0, 0);
    const layer = { canvas: cnv, ctx: c2, w, h };
    layers.push(layer);
    return c2;
  }
  return layers[0].ctx; // oldest layer accumulates once we're at MAX_LAYERS
}

function bakeOldest(n, state) {
  n = Math.min(n, liveCount);
  if (n <= 0) return;
  const bc = getBakeCtx(state);
  bc.save();
  for (let i = 0; i < n; i++) {
    bc.strokeStyle = lerpColor(midRGB, coreRGB, colorTA[i]);
    bc.globalAlpha = alphaA[i];
    bc.lineWidth = widthA[i];
    bc.beginPath();
    bc.moveTo(sxA[i], syA[i]);
    bc.bezierCurveTo(c1xA[i], c1yA[i], c2xA[i], c2yA[i], exA[i], eyA[i]);
    bc.stroke();
  }
  bc.restore();
  shiftDown(n);
}

function spawnStrand(state, dirSign, speedFactor) {
  const layout = state.layout;
  if (!layout || !layout.anchors) return;
  if (liveCount >= CAP) bakeOldest(BAKE_CHUNK, state);
  const a0 = layout.anchors[0], a1 = layout.anchors[1];
  const startA = dirSign >= 0 ? a0 : a1;
  const endA = dirSign >= 0 ? a1 : a0;
  const w = state.w;
  const j = w * 0.03;
  const fullnessRaw = totalPassFrac / config.PASSES_TO_FULL;
  const fb = Math.min(fullnessRaw, 2);
  const sx0 = startA.x + (rand() - 0.5) * 2 * j, sy0 = startA.y + (rand() - 0.5) * j;
  const ex0 = endA.x + (rand() - 0.5) * 2 * j * (1 + fb * 0.3), ey0 = endA.y + (rand() - 0.5) * j;
  const midx = (sx0 + ex0) / 2, midy = (sy0 + ey0) / 2;
  const nh = layout.nestHome || { x: midx, y: midy };
  const domeT = clamp(fb * 0.3, 0, 0.5);
  // nest shaping: sag/pull grow with fullness so the strand accumulation reads as a dome/veil
  let sag = (BASE_SAG_MIN + rand() * BASE_SAG_RANGE) * (1 - clamp(speedFactor, 0, 0.7)) * (1 + fb * 0.35);
  const c1x = lerp(midx, nh.x, domeT * 0.3) + (rand() - 0.5) * w * 0.02;
  const c1y = midy + sag + (nh.y - midy) * domeT * 0.25;
  const waveAmt = (rand() - 0.5) * w * 0.025 * (1 - speedFactor * 0.5); // 1 extra bend = waviness
  const c2x = lerp(midx, ex0, 0.7) + waveAmt;
  const c2y = midy + sag * 0.6 + (rand() - 0.5) * 6;
  const width = clamp(lerp(1.4, 0.6, clamp(speedFactor, 0, 1)) + (rand() - 0.5) * 0.2, 0.6, 1.4);
  const alpha = clamp(0.25 + rand() * 0.25, 0.25, 0.5);
  const colorT = clamp01(rand() * 0.6 + clamp01(fullnessRaw) * 0.3);

  const i = liveCount++;
  sxA[i] = sx0; syA[i] = sy0; c1xA[i] = c1x; c1yA[i] = c1y; c2xA[i] = c2x; c2yA[i] = c2y;
  exA[i] = ex0; eyA[i] = ey0; widthA[i] = width; alphaA[i] = alpha; colorTA[i] = colorT; birthA[i] = state.time;
}

function spawnWisps(state, n, speedFactor) {
  const layout = state.layout;
  if (!layout || !layout.nestHome) return;
  const tool = state.tool, nh = layout.nestHome;
  // fast swipe -> thinner/straighter trail; slow swipe -> thicker/droopier trail
  const w = lerp(1.1, 0.6, speedFactor);
  for (let k = 0; k < n; k++) {
    const tx = tool.x, ty = tool.y;
    const frac = 0.3 + rand() * 0.35;
    const jitter = (rand() - 0.5) * 24 * (1 - speedFactor * 0.5);
    wisps.push({
      x0: tx, y0: ty,
      x1: lerp(tx, nh.x, frac) + jitter, y1: lerp(ty, nh.y, frac) + jitter * 0.5,
      age: 0, life: 0.5 + rand() * 0.25, width: w + rand() * 0.4,
    });
  }
}

function ageWisps(dt) {
  for (let i = wisps.length - 1; i >= 0; i--) {
    wisps[i].age += dt;
    if (wisps[i].age > wisps[i].life) wisps.splice(i, 1);
  }
}

function onSwipe(payload) {
  if (!S || S.phase !== 'play') return;
  const speed = (payload && payload.speed) || 0;
  const speedFactor = clamp(speed / 1200, 0, 1);
  spawnWisps(S, randInt(2, 3), speedFactor);
}

function bakeNestSprite(state) {
  const layout = state.layout;
  if (!layout || !layout.nestHome) return;
  const nh = layout.nestHome;
  const r = Math.max(80, Math.min(state.w, state.h) * 0.42);
  const dpr = state.dpr || 1;
  const cnv = document.createElement('canvas');
  cnv.width = Math.max(1, Math.round(r * 2 * dpr));
  cnv.height = Math.max(1, Math.round(r * 2 * dpr));
  const bc = cnv.getContext('2d');
  bc.setTransform(dpr, 0, 0, dpr, 0, 0);
  bc.translate(r - nh.x, r - nh.y);
  for (const layer of layers) bc.drawImage(layer.canvas, 0, 0, layer.w, layer.h);
  for (let i = 0; i < liveCount; i++) {
    bc.strokeStyle = lerpColor(midRGB, coreRGB, colorTA[i]);
    bc.globalAlpha = alphaA[i];
    bc.lineWidth = widthA[i];
    bc.beginPath();
    bc.moveTo(sxA[i], syA[i]);
    bc.bezierCurveTo(c1xA[i], c1yA[i], c2xA[i], c2yA[i], exA[i], eyA[i]);
    bc.stroke();
  }
  bc.globalAlpha = 1;
  nestCanvas = cnv;
  nestMeta = { cx: nh.x, cy: nh.y, r };
}

function onLiftStart() { if (S) bakeNestSprite(S); }
function onNestPlaced() { if (S) sweepStart = S.time; }

function onReset() {
  liveCount = 0;
  layers = [];
  nestCanvas = null; nestMeta = null;
  totalPassFrac = 0; totalSpawned = 0; deltaSinceEmit = 0; spawnBudget = 0;
  prevSpawnX = null; wisps = []; sweepStart = -Infinity;
  if (S) { S.nest.fullness = 0; S.nest.ready = false; }
}

// ---- lifecycle ----
function init(args) {
  bus = args.bus; config = args.config; S = args.state;
  midRGB = parseHex(config.AMBER_MID);
  coreRGB = parseHex(config.AMBER_CORE);
  coreColorStr = `rgb(${coreRGB.join(',')})`;
  bus.on('swipe', onSwipe);
  bus.on('lift:start', onLiftStart);
  bus.on('nest:placed', onNestPlaced);
  bus.on('game:reset', onReset);
}

function resize() {
  // Baked layers are drawn top-left at their bake-time size; a resize (esp. orientation flip)
  // can make old anchor-relative geometry stale, so drop the cheap-to-rebuild baked density.
  // Live strand geometry is also absolute-coordinate and goes stale the same way (this can be a
  // large chunk of the nest right after several passes, not "only a handful") — drop it too.
  // fullness/totalPassFrac persist so progress isn't lost; strands simply respawn on the next swipe.
  layers = [];
  liveCount = 0;
}

function update(dt, state) {
  if (state.phase !== 'play') { prevSpawnX = null; return; }
  ageWisps(dt);
  const layout = state.layout;
  if (!layout || !layout.span) return;
  const p = state.pointer, tool = state.tool, span = layout.span;
  const spanW = Math.max(1, span.x1 - span.x0);
  const marginX = spanW * 0.15, marginY = state.h * 0.25;
  const inZone = p.x >= span.x0 - marginX && p.x <= span.x1 + marginX &&
                 p.y >= span.y - marginY && p.y <= span.y + marginY;

  if (p.down && p.speed > config.THREAD_MIN_SPEED && tool.caramel > 0 && inZone) {
    if (prevSpawnX === null) prevSpawnX = p.x;
    const dx = p.x - prevSpawnX;
    prevSpawnX = p.x;
    const travelFrac = Math.abs(dx) / spanW;
    if (travelFrac > 0) {
      totalPassFrac += travelFrac;
      const fullnessRaw = totalPassFrac / config.PASSES_TO_FULL;
      const diminish = fullnessRaw > 1 ? 1 / (1 + (fullnessRaw - 1) * 1.5) : 1;
      const speedFactor = clamp(p.speed / 1200, 0, 1);
      const ratePerPass = STRANDS_PER_PASS * (0.85 + 0.3 * speedFactor) * diminish;
      spawnBudget += travelFrac * ratePerPass;
      const dirSign = dx >= 0 ? 1 : -1;
      while (spawnBudget >= 1) {
        spawnStrand(state, dirSign, speedFactor);
        spawnBudget -= 1;
        totalSpawned++; deltaSinceEmit++;
      }
    }
  } else {
    prevSpawnX = null;
  }

  const fullnessRaw = totalPassFrac / config.PASSES_TO_FULL;
  state.nest.fullness = Math.min(1, fullnessRaw);
  if (state.nest.fullness >= 1 && !state.nest.ready) {
    state.nest.ready = true;
    bus.emit('nest:ready', {});
  }
  if (deltaSinceEmit > 0 && state.time - lastEmitTime >= EMIT_INTERVAL) {
    bus.emit('threads:added', { delta: deltaSinceEmit, total: totalSpawned });
    deltaSinceEmit = 0;
    lastEmitTime = state.time;
  }
}

function renderLiveStrands(ctx, state) {
  if (liveCount === 0) return;
  for (let b = 0; b < 4; b++) { bIdx[b].length = 0; bColorSum[b] = 0; }
  newbornList.length = 0;
  for (let i = 0; i < liveCount; i++) {
    const age = state.time - birthA[i];
    if (age < NEWBORN_T) { newbornList.push(i); continue; }
    const b = (widthA[i] < WIDTH_MID ? 0 : 1) + (alphaA[i] < ALPHA_MID ? 0 : 2);
    bIdx[b].push(i);
    bColorSum[b] += colorTA[i];
  }
  for (let b = 0; b < 4; b++) {
    const idxs = bIdx[b];
    if (idxs.length === 0) continue;
    const avgT = bColorSum[b] / idxs.length;
    const shimmer = 0.85 + 0.15 * Math.sin(state.time * BUCKET_SHIMMER[b] + BUCKET_PHASE[b]);
    ctx.strokeStyle = lerpColor(midRGB, coreRGB, avgT);
    ctx.globalAlpha = BUCKET_ALPHA[b] * shimmer;
    ctx.lineWidth = BUCKET_WIDTH[b];
    if (b === 3) ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    for (let k = 0; k < idxs.length; k++) {
      const i = idxs[k];
      ctx.moveTo(sxA[i], syA[i]);
      ctx.bezierCurveTo(c1xA[i], c1yA[i], c2xA[i], c2yA[i], exA[i], eyA[i]);
    }
    ctx.stroke();
    if (b === 3) ctx.globalCompositeOperation = 'source-over';
  }
  ctx.globalAlpha = 1;

  for (let k = 0; k < newbornList.length; k++) {
    const i = newbornList[k];
    const t = clamp((state.time - birthA[i]) / NEWBORN_T, 0.03, 1);
    const pc = partialCubic(t, sxA[i], syA[i], c1xA[i], c1yA[i], c2xA[i], c2yA[i], exA[i], eyA[i]);
    ctx.strokeStyle = lerpColor(midRGB, coreRGB, colorTA[i]);
    ctx.globalAlpha = alphaA[i] * t;
    ctx.lineWidth = widthA[i];
    ctx.beginPath();
    ctx.moveTo(sxA[i], syA[i]);
    ctx.bezierCurveTo(pc[0], pc[1], pc[2], pc[3], pc[4], pc[5]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function renderWisps(ctx) {
  if (wisps.length === 0) return;
  ctx.strokeStyle = coreColorStr;
  for (const wp of wisps) {
    let a = wp.age < WISP_FADEIN ? wp.age / WISP_FADEIN : 1 - (wp.age - WISP_FADEIN) / (wp.life - WISP_FADEIN);
    a = clamp(a, 0, 1) * 0.5;
    if (a <= 0.01) continue;
    ctx.globalAlpha = a;
    ctx.lineWidth = wp.width;
    ctx.beginPath();
    ctx.moveTo(wp.x0, wp.y0);
    ctx.quadraticCurveTo((wp.x0 + wp.x1) / 2, (wp.y0 + wp.y1) / 2 - 6, wp.x1, wp.y1);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawLightSweep(ctx, cx, cy, r) {
  if (sweepStart < 0) return;
  const p = (S.time - sweepStart) / SWEEP_DURATION;
  if (p < 0 || p >= 1) return;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
  const bandX = cx - r + p * 2 * r;
  const grad = ctx.createLinearGradient(bandX - r * 0.3, 0, bandX + r * 0.3, 0);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,240,200,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
}

function renderNestSprite(ctx, state) {
  const t = clamp(state.nest.lift, 0, 1);
  const ease = t * t * (3 - 2 * t);
  const homeX = nestMeta.cx, homeY = nestMeta.cy;
  const tx = state.nest.x || homeX, ty = state.nest.y || homeY;
  const px = lerp(homeX, tx, ease), py = lerp(homeY, ty, ease);
  const scale = lerp(1, 0.55, ease);
  const squash = lerp(1, 0.8, ease);
  const wobble = Math.sin(state.time * 2.5) * 0.05 * ease;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(wobble);
  ctx.scale(scale, scale * squash);
  ctx.drawImage(nestCanvas, -nestMeta.r, -nestMeta.r, nestMeta.r * 2, nestMeta.r * 2);
  ctx.restore();
  if (state.phase === 'celebrate') drawLightSweep(ctx, px, py, nestMeta.r * scale);
}

function render(ctx, state) {
  if ((state.phase === 'lift' || state.phase === 'celebrate') && nestCanvas) {
    renderNestSprite(ctx, state);
    return;
  }
  for (const layer of layers) ctx.drawImage(layer.canvas, 0, 0, layer.w, layer.h);
  renderLiveStrands(ctx, state);
  renderWisps(ctx, state);
}

export default { init, resize, update, render };
