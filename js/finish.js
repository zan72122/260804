// OWNER: agent A6 finish — nest lift finale, celebration. See CONTRACT.md.
// A 4-year-old must never fail: releasing anywhere, or nearing the dessert, always completes the lift.

// --- module-private tuning ---
const HALO_RADIUS_FACTOR = 0.18;  // * min(w,h) around layout.nestHome
const HALO_PULSE_SPEED = 1.6;
const ARC_DOT_COUNT = 12;
const CARRY_EASE = 8;             // per-second follow ease while carrying (loose, delicate)
const LIFT_RISE_RATE = 1.1;       // nest.lift 0->1 rate while carrying (per second)
const GLIDE_DURATION = 0.6;       // seconds, auto-glide onto the dessert
const NEAR_DESSERT_FACTOR = 1.6;  // * dessert.r triggers auto-glide
const CELEBRATE_DURATION = 3.5;   // seconds of sparkle before game:reset
const PARTICLE_MAX = 40;

let busRef = null, stateRef = null;

let ready = false;
let haloPulse = 0;

let sub = 'idle';         // 'idle' | 'carry' | 'glide'
let glideT = 0;
let glideFromX = 0, glideFromY = 0, glideFromLift = 0;
let placedEmitted = false;

let celebrateT = 0;
let celebrateActive = false;
let resetEmitted = false;

// pooled sparkle particles (no per-frame allocation)
const particles = new Array(PARTICLE_MAX).fill(null).map(() => ({
  active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 1, twinkle: false,
}));

function easeOutCubic(p) { return 1 - Math.pow(1 - p, 3); }

function spawnParticle(cx, cy, r) {
  for (const p of particles) {
    if (p.active) continue;
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * r * 1.1;
    p.x = cx + Math.cos(ang) * rad;
    p.y = cy + Math.sin(ang) * rad * 0.6 + r * 0.25;
    p.vx = (Math.random() - 0.5) * 8;
    p.vy = -(12 + Math.random() * 16);
    p.life = 0;
    p.maxLife = 1.5 + Math.random() * 1.3;
    p.size = 1 + Math.random() * 2.2;
    p.twinkle = Math.random() < 0.16;
    p.active = true;
    return;
  }
}

function resetAll(state) {
  ready = false;
  haloPulse = 0;
  sub = 'idle';
  glideT = 0;
  placedEmitted = false;
  celebrateT = 0;
  celebrateActive = false;
  resetEmitted = false;
  for (const p of particles) p.active = false;
  state.nest.lift = 0;
  state.nest.x = 0;
  state.nest.y = 0;
}

function beginGlide(state) {
  sub = 'glide';
  glideT = 0;
  glideFromX = state.nest.x;
  glideFromY = state.nest.y;
  glideFromLift = state.nest.lift;
}

function onPointerDown({ x, y }) {
  const state = stateRef;
  if (!ready || state.phase !== 'play' || sub !== 'idle') return;
  const layout = state.layout;
  if (!layout || !layout.nestHome) return;
  const r = HALO_RADIUS_FACTOR * Math.min(state.w, state.h);
  const dx = x - layout.nestHome.x, dy = y - layout.nestHome.y;
  if (dx * dx + dy * dy <= r * r) {
    sub = 'carry';
    state.nest.x = layout.nestHome.x;
    state.nest.y = layout.nestHome.y;
    state.nest.lift = Math.max(state.nest.lift, 0.001);
    busRef.emit('lift:start', {});
  }
}

function onPointerUp() {
  if (sub === 'carry') beginGlide(stateRef);
}

export default {
  init({ bus, state }) {
    busRef = bus; stateRef = state;
    bus.on('nest:ready', () => { ready = true; });
    bus.on('pointer:down', onPointerDown);
    bus.on('pointer:up', onPointerUp);
    bus.on('game:reset', () => resetAll(state));
  },

  resize() {},

  update(dt, state) {
    haloPulse += dt;
    const layout = state.layout;

    if (state.phase === 'lift' && layout && layout.dessert) {
      const dessert = layout.dessert;
      if (sub === 'carry') {
        const p = state.pointer;
        const ease = 1 - Math.exp(-CARRY_EASE * dt);
        state.nest.x += (p.x - state.nest.x) * ease;
        state.nest.y += (p.y - state.nest.y) * ease;
        state.nest.lift = Math.min(0.96, state.nest.lift + LIFT_RISE_RATE * dt);

        const dx = state.nest.x - dessert.x, dy = state.nest.y - dessert.y;
        const nearR = dessert.r * NEAR_DESSERT_FACTOR;
        if (!p.down || dx * dx + dy * dy < nearR * nearR) beginGlide(state);
      } else if (sub === 'glide') {
        glideT = Math.min(1, glideT + dt / GLIDE_DURATION);
        const e = easeOutCubic(glideT);
        state.nest.x = glideFromX + (dessert.x - glideFromX) * e;
        state.nest.y = glideFromY + (dessert.y - glideFromY) * e;
        state.nest.lift = glideFromLift + (1 - glideFromLift) * e;
        if (glideT >= 1) {
          state.nest.x = dessert.x;
          state.nest.y = dessert.y;
          state.nest.lift = 1;
          if (!placedEmitted) { placedEmitted = true; busRef.emit('nest:placed', {}); }
        }
      }
    }

    if (state.phase === 'celebrate') {
      if (!celebrateActive) { celebrateActive = true; celebrateT = 0; resetEmitted = false; }
      celebrateT += dt;
      const dessert = layout && layout.dessert;
      const cx = dessert ? dessert.x : state.nest.x;
      const cy = dessert ? dessert.y : state.nest.y;
      const r = dessert ? dessert.r : 40;

      if (celebrateT < CELEBRATE_DURATION - 0.4 && Math.random() < dt * 20) {
        spawnParticle(cx, cy, r);
      }
      for (const p of particles) {
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) { p.active = false; continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= (1 - Math.min(1, dt * 0.6));
      }
      if (celebrateT >= CELEBRATE_DURATION && !resetEmitted) {
        resetEmitted = true;
        busRef.emit('game:reset', {});
      }
    } else {
      celebrateActive = false;
    }
  },

  render(ctx, state) {
    const layout = state.layout;
    if (ready && state.phase === 'play' && layout && layout.nestHome) {
      renderHalo(ctx, state, layout);
    }
    if (state.phase === 'celebrate') {
      renderCelebration(ctx, state, layout);
    }
  },
};

function renderHalo(ctx, state, layout) {
  const { x, y } = layout.nestHome;
  const r = HALO_RADIUS_FACTOR * Math.min(state.w, state.h);
  const pulse = 0.5 + 0.5 * Math.sin(haloPulse * HALO_PULSE_SPEED);
  const rr = r * (0.92 + pulse * 0.12);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const grad = ctx.createRadialGradient(x, y, rr * 0.15, x, y, rr);
  grad.addColorStop(0, `rgba(255,217,138,${0.20 + pulse * 0.10})`);
  grad.addColorStop(0.7, `rgba(232,169,78,${0.10 + pulse * 0.06})`);
  grad.addColorStop(1, 'rgba(232,169,78,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = `rgba(255,217,138,${0.35 + pulse * 0.25})`;
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 7]);
  ctx.beginPath();
  ctx.arc(x, y, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  if (layout.dessert) drawHintArc(ctx, x, y, layout.dessert.x, layout.dessert.y, pulse);
  ctx.restore();
}

function drawHintArc(ctx, x0, y0, x1, y1, pulse) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  if (dist < 1) return;
  const midx = (x0 + x1) / 2, midy = (y0 + y1) / 2 - dist * 0.12;
  ctx.fillStyle = `rgba(255,217,138,${0.28 + pulse * 0.2})`;
  for (let i = 1; i <= ARC_DOT_COUNT; i++) {
    const t = i / (ARC_DOT_COUNT + 1);
    const it = 1 - t;
    const px = it * it * x0 + 2 * it * t * midx + t * t * x1;
    const py = it * it * y0 + 2 * it * t * midy + t * t * y1;
    const s = 1.3 * (0.5 + 0.5 * Math.sin(t * Math.PI));
    ctx.beginPath();
    ctx.arc(px, py, s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderCelebration(ctx, state, layout) {
  const dessert = layout && layout.dessert;
  const cx = dessert ? dessert.x : state.nest.x;
  const cy = dessert ? dessert.y : state.nest.y;
  const r = dessert ? dessert.r : 40;

  const bloomIn = Math.min(1, celebrateT / 0.6);
  const bloomOut = Math.max(0, 1 - Math.max(0, celebrateT - (CELEBRATE_DURATION - 0.6)) / 0.6);
  const bloom = bloomIn * bloomOut;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';

  if (bloom > 0.01) {
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.2);
    grad.addColorStop(0, `rgba(255,230,180,${0.35 * bloom})`);
    grad.addColorStop(0.5, `rgba(255,200,120,${0.15 * bloom})`);
    grad.addColorStop(1, 'rgba(255,200,120,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r * 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of particles) {
    if (!p.active) continue;
    const lifeT = p.life / p.maxLife;
    const alpha = Math.sin(Math.min(1, lifeT) * Math.PI);
    if (alpha <= 0.02) continue;
    const s = p.size * (0.6 + alpha * 0.6);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,235,190,0.95)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
    ctx.fill();
    if (p.twinkle) {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 1;
      const ts = s + 2.5;
      ctx.beginPath();
      ctx.moveTo(p.x - ts, p.y); ctx.lineTo(p.x + ts, p.y);
      ctx.moveTo(p.x, p.y - ts); ctx.lineTo(p.x, p.y + ts);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}
