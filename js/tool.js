// OWNER: agent A4 tool — dipper tool, caramel load, dip/drip visuals. See CONTRACT.md.
import config from './config.js';

// --- module-private tuning ---
const SPRING_STIFF = 260;      // rad/s^2 scale, critically damped -> settle < 150ms
const SPRING_DAMP = 2 * Math.sqrt(SPRING_STIFF); // critical damping
const ANGLE_MAX = 0.5;
const ANGLE_EASE = 10;
const IDLE_BOB_AMP = 4;
const IDLE_BOB_SPEED = 1.4;
const DIP_DURATION = 0.4;
const DIP_COOLDOWN = 0.6;
const DRIP_FALL = 60;
const DRIP_LIFE = 0.7;
const DRIP_MIN_INTERVAL = 1.1;
const HANDLE_LEN = 58;
const HANDLE_W = 5;

let sx = 0, sy = 0;           // spring position
let vx = 0, vy = 0;           // spring velocity
let restX = 0, restY = 0;     // rest/parked target
let bobT = 0;
let dipT = 0;                 // dip animation timer, 0 = not dipping
let dipCooldown = 0;
let drip = null;              // {x,y,t} single live drip
let dripCooldown = 0;
let inited = false;
let busRef = null;

function reset(state) {
  sx = state.w / 2 || restX;
  sy = state.h / 2 || restY;
  vx = 0; vy = 0;
  dipT = 0; dipCooldown = 0;
  drip = null; dripCooldown = 0;
  state.tool.caramel = 1;
  state.tool.dipping = false;
  state.tool.angle = 0;
  state.tool.x = sx;
  state.tool.y = sy;
}

export default {
  init({ canvas, ctx, bus, state, config: cfg }) {
    busRef = bus;
    sx = state.w ? state.w / 2 : 160;
    sy = state.h ? state.h / 2 : 260;
    state.tool.x = sx;
    state.tool.y = sy;
    state.tool.angle = 0;
    state.tool.caramel = 1; // pre-dipped so first swipe works immediately
    state.tool.dipping = false;

    bus.on('threads:added', ({ delta }) => {
      // full load (caramel 1) should last ~CARAMEL_PASSES passes; a pass ~= totals ~4 delta.
      const drainPerFullLoad = config.CARAMEL_PASSES * 4;
      const drain = (delta || 0) / drainPerFullLoad;
      state.tool.caramel = Math.max(0, state.tool.caramel - drain);
    });

    bus.on('game:reset', () => reset(state));

    inited = true;
  },

  resize(state) {
    if (!inited) return;
    // keep tool within bounds softly; no hard snap needed, spring will catch up.
  },

  update(dt, state) {
    const t = state.tool;
    const parked = state.phase === 'lift' || state.phase === 'celebrate';

    // --- target position ---
    let tx, ty;
    if (parked) {
      const pot = state.layout && state.layout.pot;
      restX = pot ? pot.x + pot.rx * 0.7 : state.w * 0.2;
      restY = pot ? pot.y - pot.ry * 1.4 : state.h * 0.8;
      tx = restX; ty = restY;
    } else if (state.pointer.down) {
      tx = state.pointer.x; ty = state.pointer.y;
    } else {
      // idle: float at last spring position with a slight bob
      bobT += dt * IDLE_BOB_SPEED;
      tx = sx; ty = sy - Math.sin(bobT) * IDLE_BOB_AMP * dt * 60 * 0 + Math.sin(bobT) * IDLE_BOB_AMP;
    }

    // --- critically damped spring toward target ---
    const ax = SPRING_STIFF * (tx - sx) - SPRING_DAMP * vx;
    const ay = SPRING_STIFF * (ty - sy) - SPRING_DAMP * vy;
    vx += ax * dt;
    vy += ay * dt;
    sx += vx * dt;
    sy += vy * dt;

    t.x = sx;
    t.y = sy;

    // --- angle: lean into horizontal velocity like a held wand ---
    const targetAngle = Math.max(-ANGLE_MAX, Math.min(ANGLE_MAX, vx * 0.0025));
    t.angle += (targetAngle - t.angle) * Math.min(1, ANGLE_EASE * dt);

    if (parked) {
      // no dip/drain logic while parked; still let drip fade out
      if (drip) {
        drip.t += dt;
        if (drip.t >= DRIP_LIFE) drip = null;
      }
      return;
    }

    // --- dip logic ---
    dipCooldown = Math.max(0, dipCooldown - dt);
    const pot = state.layout && state.layout.pot;
    if (dipT > 0) {
      dipT -= dt;
      t.dipping = true;
      if (dipT <= 0) {
        dipT = 0;
        t.dipping = false;
        t.caramel = 1;
        dipCooldown = DIP_COOLDOWN;
        spawnDrip(t); // 1-2 drips on exit (single-slot drip system)
        if (busRef) busRef.emit('tool:dipped', {});
      }
    } else if (pot && dipCooldown <= 0 && t.caramel < 0.9) {
      const dx = t.x - pot.x, dy = t.y - pot.y;
      const inPot = (dx * dx) / (pot.rx * pot.rx) + (dy * dy) / (pot.ry * pot.ry) <= 1;
      if (inPot) {
        dipT = DIP_DURATION;
        t.dipping = true;
      }
    }

    // --- occasional slow drip while loaded & tool nearly still ---
    dripCooldown = Math.max(0, dripCooldown - dt);
    if (drip) {
      drip.t += dt;
      if (drip.t >= DRIP_LIFE) drip = null;
    } else if (t.caramel > 0.3 && dripCooldown <= 0 && state.pointer.speed < 30 && dipT === 0) {
      spawnDrip(t);
      dripCooldown = DRIP_MIN_INTERVAL;
    }
  },

  render(ctx, state) {
    const t = state.tool;
    const speed = state.pointer.speed || 0;
    const sink = t.dipping ? Math.min(1, (DIP_DURATION - Math.max(0, dipT)) / DIP_DURATION) * 6 : 0;
    const tipX = t.x;
    const tipY = t.y + sink;

    ctx.save();
    ctx.translate(tipX, tipY);
    ctx.rotate(t.angle);

    // --- handle: thin warm-wood/brass gradient, drawn from tip upward ---
    const grad = ctx.createLinearGradient(0, 0, 0, -HANDLE_LEN);
    grad.addColorStop(0, '#8a5a30');
    grad.addColorStop(0.5, '#c98f4a');
    grad.addColorStop(1, '#e8c078');
    ctx.strokeStyle = grad;
    ctx.lineWidth = HANDLE_W;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -HANDLE_LEN);
    ctx.stroke();

    // whisk-tip loop
    ctx.strokeStyle = '#d9a35e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(0, 3, 5, 7, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();

    // --- caramel blob on the tip ---
    const load = t.caramel;
    if (load > 0.02) {
      const baseR = 4 + load * 9 + (t.dipping ? 3 : 0);
      // stretch along motion when moving fast
      const stretch = Math.min(1, speed / 500);
      const mvAngle = Math.atan2(state.pointer.vy || 0, state.pointer.vx || 1);
      ctx.save();
      ctx.translate(tipX, tipY + 4);
      if (stretch > 0.05) ctx.rotate(mvAngle);
      const rx = baseR * (1 + stretch * 0.6);
      const ry = baseR * (1 - stretch * 0.25);

      const bg = ctx.createRadialGradient(-rx * 0.3, -ry * 0.3, 0.5, 0, 0, Math.max(rx, ry));
      bg.addColorStop(0, config.AMBER_CORE);
      bg.addColorStop(0.55, config.AMBER_MID);
      bg.addColorStop(1, config.AMBER_DEEP);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // specular dot
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.ellipse(-rx * 0.35, -ry * 0.35, Math.max(1, rx * 0.18), Math.max(1, ry * 0.18), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- drip ---
    if (drip) {
      const p = Math.min(1, drip.t / DRIP_LIFE);
      const dy = p * DRIP_FALL;
      const alpha = 1 - p;
      const r = 3 * (1 - p * 0.4);
      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.fillStyle = config.AMBER_MID;
      ctx.beginPath();
      ctx.ellipse(drip.x, drip.y + dy, r * 0.75, r * 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.ellipse(drip.x - r * 0.25, drip.y + dy - r * 0.3, r * 0.25, r * 0.25, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  },
};

function spawnDrip(t) {
  if (drip) return; // max 1 alive at a time
  drip = { x: t.x, y: t.y + 4, t: 0 };
}
