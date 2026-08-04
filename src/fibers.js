// Fiber slurry particle simulation in tank space [0,1]^2.
// Not full fluid dynamics — but honest causality:
//   downward flow is strong where paper is missing (permeability),
//   fibers travel from far away toward deficits while draining,
//   finger strokes leave a decaying current the fibers lag behind.
import { clamp, TAU } from './util.js';
import { CAP_TOTAL } from './paper.js';

// paper sub-rect within tank space
export const PRX0 = 0.10, PRX1 = 0.90, PRY0 = 0.09, PRY1 = 0.91;
export const uvToTank = (u, v) => [PRX0 + u * (PRX1 - PRX0), PRY0 + v * (PRY1 - PRY0)];
export const tankToUv = (x, y) => [(x - PRX0) / (PRX1 - PRX0), (y - PRY0) / (PRY1 - PRY0)];

const GX = 12, GY = 15;
const POUR_N = 55;

export class FiberSim {
  constructor(paper) {
    this.paper = paper;
    this.free = !paper;
    this.fibers = [];
    this.level = 1;
    this.draining = false;
    this.drainT = 0;
    this.strength = 0;
    this.gv = new Float32Array(GX * GY * 2);
    this.poured = 0;
    this.settledN = 0;
    this.t = 0;
    this.freeSettle = null; // callback for free-play mode
    this.sinks = paper
      ? paper.sinks.map(s => { const [x, y] = uvToTank(s.u, s.v); return { x, y, s }; })
      : [];
    this.need = paper ? Math.ceil(CAP_TOTAL * 1.35 / POUR_N) * POUR_N : POUR_N;
  }

  pour(tx, ty, col) {
    for (let i = 0; i < POUR_N; i++) {
      const a = Math.random() * TAU, r = Math.random() * 0.10;
      this.fibers.push({
        x: clamp(tx + Math.cos(a) * r, 0.03, 0.97),
        y: clamp(ty + Math.sin(a) * r * 0.8, 0.03, 0.97),
        vx: (Math.random() - 0.5) * 0.06,
        vy: (Math.random() - 0.5) * 0.06,
        an: Math.random() * TAU,
        va: (Math.random() - 0.5) * 2,
        len: 0.013 + Math.random() * 0.012,
        col, st: 0, tg: -1, ph: Math.random() * TAU,
      });
    }
    this.poured += POUR_N;
  }

  // (dx,dy) = finger velocity in tank units per second
  stir(x, y, dx, dy) {
    const gx = clamp((x * GX) | 0, 0, GX - 1), gy = clamp((y * GY) | 0, 0, GY - 1);
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const cx = gx + ox, cy = gy + oy;
      if (cx < 0 || cy < 0 || cx >= GX || cy >= GY) continue;
      const w = (ox === 0 && oy === 0) ? 1 : 0.45;
      const i = (cy * GX + cx) * 2;
      this.gv[i] = clamp(this.gv[i] + dx * w * 0.12, -0.5, 0.5);
      this.gv[i + 1] = clamp(this.gv[i + 1] + dy * w * 0.12, -0.5, 0.5);
    }
  }

  gridAt(x, y) {
    const gx = clamp((x * GX) | 0, 0, GX - 1), gy = clamp((y * GY) | 0, 0, GY - 1);
    const i = (gy * GX + gx) * 2;
    return [this.gv[i], this.gv[i + 1]];
  }

  activeCount() { let n = 0; for (const f of this.fibers) if (f.st === 0) n++; return n; }

  dispersion() {
    const CX = 8, CY = 10, occ = new Uint8Array(CX * CY);
    let act = 0;
    for (const f of this.fibers) {
      if (f.st) continue;
      act++;
      const [u, v] = tankToUv(f.x, f.y);
      if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) continue;
      occ[clamp((v * CY) | 0, 0, CY - 1) * CX + clamp((u * CX) | 0, 0, CX - 1)] = 1;
    }
    if (!act) return 0;
    let s = 0;
    for (const o of occ) s += o;
    return s / (CX * CY);
  }

  allFull() {
    if (!this.paper) return true;
    return this.paper.fillRatio() >= 0.995;
  }

  pickSink(f) {
    let best = -1, bs = -1;
    const n = this.sinks.length;
    if (!n) return -1;
    for (let i = 0; i < 8; i++) {
      const j = (Math.random() * n) | 0;
      const k = this.sinks[j];
      const rem = k.s.cap - k.s.got;
      if (rem <= 0) continue;
      const d = Math.hypot(k.x - f.x, k.y - f.y);
      const sc = rem * (1.25 - Math.min(d, 1));
      if (sc > bs) { bs = sc; best = j; }
    }
    return best;
  }

  update(dt) {
    this.t += dt;
    if (!this.draining && this.poured > 0) this.slurryT = (this.slurryT || 0) + dt;
    const drain = this.draining ? this.strength : 0;
    const dec = Math.pow(0.35, dt); // stirring current keeps flowing briefly after release
    for (let i = 0; i < this.gv.length; i++) this.gv[i] *= dec;
    // a real vat has walls: kill wall-normal current in boundary cells so
    // stirring circulates along the walls instead of pinning fibers in corners
    for (let gy = 0; gy < GY; gy++) {
      let i = (gy * GX) * 2;
      if (this.gv[i] < 0) this.gv[i] = 0;
      i = (gy * GX + GX - 1) * 2;
      if (this.gv[i] > 0) this.gv[i] = 0;
    }
    for (let gx = 0; gx < GX; gx++) {
      let i = gx * 2 + 1;
      if (this.gv[i] < 0) this.gv[i] = 0;
      i = ((GY - 1) * GX + gx) * 2 + 1;
      if (this.gv[i] > 0) this.gv[i] = 0;
    }
    const full = this.allFull();
    const grainW = CAP_TOTAL / Math.max(1, this.need) * 1.45; // grains per settled fiber

    for (const f of this.fibers) {
      if (f.st) continue;
      const [gvx, gvy] = this.gridAt(f.x, f.y);
      f.vx += gvx * 3.0 * dt;
      f.vy += gvy * 3.0 * dt;
      // turbulent diffusion: strong currents shred clumps apart instead of
      // carrying them coherently (this is what actually disperses the slurry)
      const gmag = Math.hypot(gvx, gvy);
      if (gmag > 0.01) {
        f.vx += (Math.random() - 0.5) * gmag * 7 * dt;
        f.vy += (Math.random() - 0.5) * gmag * 7 * dt;
      }
      // slow brownian drift so clumps loosen on their own
      f.vx += Math.cos(f.ph + this.t * (0.7 + f.ph * 0.1)) * 0.05 * dt;
      f.vy += Math.sin(f.ph * 1.7 + this.t * (0.6 + f.ph * 0.07)) * 0.05 * dt;
      f.vx += (Math.random() - 0.5) * 0.10 * dt;
      f.vy += (Math.random() - 0.5) * 0.10 * dt;
      // repulsion from tank walls keeps fibers over the sheet; also damp
      // wall-ward velocity so fibers can't stay pinned against the glass
      const WM = 0.12;
      if (f.x < WM) { f.vx += (WM - f.x) * 5 * dt; if (f.vx < 0) f.vx *= Math.pow(0.03, dt); }
      if (f.x > 1 - WM) { f.vx -= (f.x - (1 - WM)) * 5 * dt; if (f.vx > 0) f.vx *= Math.pow(0.03, dt); }
      if (f.y < WM) { f.vy += (WM - f.y) * 5 * dt; if (f.vy < 0) f.vy *= Math.pow(0.03, dt); }
      if (f.y > 1 - WM) { f.vy -= (f.y - (1 - WM)) * 5 * dt; if (f.vy > 0) f.vy *= Math.pow(0.03, dt); }
      // gentle ambient circulation while the slurry rests — the water is
      // alive, and clumps slowly loosen even without stirring
      if (!drain && this.level > 0.05) {
        f.vx += -(f.y - 0.5) * 0.03 * dt;
        f.vy += (f.x - 0.5) * 0.03 * dt;
      }

      if (drain > 0 && this.paper) {
        if (f.tg < 0 || f.tg >= this.sinks.length ||
          this.sinks[f.tg].s.got >= this.sinks[f.tg].s.cap || Math.random() < dt * 0.4) {
          f.tg = this.pickSink(f);
        }
        if (f.tg >= 0) {
          const k = this.sinks[f.tg];
          let dx = k.x - f.x, dy = k.y - f.y;
          const d = Math.hypot(dx, dy) || 1e-4;
          dx /= d; dy /= d;
          const [uu, vv] = tankToUv(f.x, f.y);
          const perm = this.paper.permAt(clamp(uu, 0, 1), clamp(vv, 0, 1));
          const pull = drain * (0.10 + 0.16 * Math.min(d * 3, 1)) * (0.40 + perm * 0.9);
          const sw = 0.05 * Math.sin(this.t * 2 + f.ph) * drain * Math.min(1, d * 8);
          f.vx += (dx * pull - dy * sw) * dt * 2.4;
          f.vy += (dy * pull + dx * sw) * dt * 2.4;
          if (d < 0.034 && k.s.got < k.s.cap) {
            k.s.got += grainW;
            k.s.d.got += grainW;
            const [u, v] = tankToUv(f.x, f.y);
            this.paper.addDeposit(clamp(u, 0, 1), clamp(v, 0, 1), f.col);
            f.st = 1; this.settledN++;
            continue;
          }
        } else if (full && this.level <= 0.06 && Math.random() < dt * 2.5) {
          // extra pulp settles as a faint even veil once deficits are full
          const [u, v] = tankToUv(f.x, f.y);
          if (u > 0 && u < 1 && v > 0 && v < 1) this.paper.addDeposit(u, v, f.col, true);
          f.st = 2; this.settledN++;
          continue;
        }
      }
      if (this.free && this.draining && this.level < 0.5 && Math.random() < dt * 2.2) {
        f.st = 2; this.settledN++;
        if (this.freeSettle) this.freeSettle(f);
        continue;
      }

      const dp = Math.pow(this.level > 0.03 ? 0.28 : 0.02, dt);
      f.vx *= dp; f.vy *= dp;
      const sp = Math.hypot(f.vx, f.vy), mx = 0.55;
      if (sp > mx) { f.vx *= mx / sp; f.vy *= mx / sp; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      f.an += f.va * dt * (0.3 + sp * 3);
      if (f.x < 0.02) { f.x = 0.02; f.vx *= -0.4; }
      if (f.x > 0.98) { f.x = 0.98; f.vx *= -0.4; }
      if (f.y < 0.02) { f.y = 0.02; f.vy *= -0.4; }
      if (f.y > 0.98) { f.y = 0.98; f.vy *= -0.4; }
    }
  }

  render(ctx, R) {
    ctx.save();
    ctx.translate(R.x, R.y);
    ctx.lineCap = 'round';
    ctx.globalAlpha = 0.85;
    ctx.lineWidth = Math.max(1.2, R.w * 0.004);
    for (const f of this.fibers) {
      if (f.st) continue;
      const x = f.x * R.w, y = f.y * R.h, l = f.len * R.w;
      const ca = Math.cos(f.an) * l, sa = Math.sin(f.an) * l;
      ctx.strokeStyle = f.col;
      ctx.beginPath();
      ctx.moveTo(x - ca, y - sa);
      ctx.quadraticCurveTo(x + sa * 0.35, y - ca * 0.35, x + ca, y + sa);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  }
}
