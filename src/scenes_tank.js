// Tank scenes: fiber dispersal (ふわっ) and the signature suction drain (すうっ).
import { G } from './state.js';
import { sfx, setWater, setSuck } from './audio.js';
import { roomBg, hint, hintGesture, glowRing, drawMesh } from './ui.js';
import { clamp, lerp, dist, ease, TAU, rr, fitRect, mk } from './util.js';
import { FiberSim, tankToUv, PRX0, PRX1, PRY0, PRY1 } from './fibers.js';

const PULP_BOWLS = [
  { col: '#efe6cf', fib: '#e6d9b8' },
  { col: '#eddadf', fib: '#e0c3c0' },
  { col: '#dfe7e4', fib: '#c6d4cf' },
];
const FREE_BOWLS = [
  { col: '#f6c6d3', fib: '#ef9db4' },
  { col: '#f8e3ae', fib: '#eecb74' },
  { col: '#c8ecd6', fib: '#93d3ac' },
  { col: '#c2ddf2', fib: '#8db9dd' },
  { col: '#ded2f4', fib: '#b49ede' },
];

export function tankLay(L, free = false) {
  const { W, H, portrait } = L;
  const ASP = 0.778;
  let cs, tank, bowls = [], lever, zone;
  const nb = free ? 5 : 3;
  if (portrait) {
    const zh = clamp(H * 0.17, 110, 180);
    const zy = H - zh - H * 0.012;
    zone = { x: 0, y: zy, w: W, h: zh };
    const csH = clamp(H * 0.075, 44, 70);
    const topPad = H * 0.035 + 24;
    const availH = zy - csH - topPad - 10;
    tank = fitRect(W / 2, topPad + availH / 2, W * 0.92, availH, ASP);
    cs = { x: tank.x, y: tank.y + tank.h + 6, w: tank.w, h: csH };
    const br = clamp(zh * 0.28, 24, 42) * (nb > 3 ? 0.8 : 1);
    const leverX = W * 0.87 - 13;
    const bx0 = W * 0.05 + br;
    const bx1 = leverX - br - 30; // never under the lever
    const spacing = nb > 1 ? Math.min(br * 2.35, (bx1 - bx0) / (nb - 1)) : 0;
    for (let i = 0; i < nb; i++) {
      bowls.push({ x: bx0 + i * spacing, y: zy + zh * 0.45, r: br, ...( free ? FREE_BOWLS[i] : PULP_BOWLS[i]) });
    }
    lever = { track: { x: leverX, y: zy + 14, w: 26, h: zh - 36 }, r: clamp(zh * 0.21, 28, 38) };
  } else {
    const zw = clamp(W * 0.16, 120, 190);
    const zx = W - zw - 8;
    zone = { x: zx, y: 0, w: zw, h: H };
    const csH = clamp(H * 0.10, 46, 80);
    const topPad = H * 0.045 + 10;
    const availH = H - topPad - csH - H * 0.045;
    tank = fitRect((W - zw) / 2, topPad + availH / 2, (W - zw) * 0.92, availH, ASP);
    cs = { x: tank.x, y: tank.y + tank.h + 6, w: tank.w, h: csH };
    // bowls live in the free margin left of the tank; the right zone is
    // reserved for the lever alone (they must never share a touch region)
    const br = clamp(zw * 0.24, 22, 38);
    const cols = nb > 3 ? 2 : 1;
    const rows = Math.ceil(nb / cols);
    const rowH = br * 2.2;
    for (let i = 0; i < nb; i++) {
      const colI = i % cols, rowI = (i / cols) | 0;
      bowls.push({
        x: tank.x / 2 + (colI - (cols - 1) / 2) * br * 2.3,
        y: H * 0.5 - (rows - 1) * rowH / 2 + rowI * rowH, r: br,
        ...(free ? FREE_BOWLS[i] : PULP_BOWLS[i]),
      });
    }
    lever = { track: { x: zx + zw * 0.5 - 13, y: H * 0.30, w: 26, h: H * 0.52 }, r: clamp(zw * 0.19, 26, 38) };
  }
  const inner = { x: tank.x + tank.w * 0.045, y: tank.y + tank.h * 0.055, w: tank.w * 0.91, h: tank.h * 0.89 };
  const paperR = {
    x: inner.x + PRX0 * inner.w, y: inner.y + PRY0 * inner.h,
    w: inner.w * (PRX1 - PRX0), h: inner.h * (PRY1 - PRY0),
  };
  return { tank, inner, paperR, cs, bowls, lever, zone };
}

function drawBowl(ctx, b, pulse = 0) {
  ctx.save();
  const s = 1 + pulse * 0.06;
  ctx.translate(b.x, b.y);
  ctx.scale(s, s);
  ctx.fillStyle = 'rgba(50,35,20,0.18)';
  ctx.beginPath(); ctx.ellipse(0, b.r * 0.55, b.r * 1.05, b.r * 0.28, 0, 0, TAU); ctx.fill();
  // bowl body
  ctx.fillStyle = '#f4efe6';
  ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.62, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = '#b9a98e'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.62, 0, 0, Math.PI); ctx.stroke();
  // blue band
  ctx.strokeStyle = '#7f9db4'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(0, b.r * 0.18, b.r * 0.92, b.r * 0.5, 0, 0.3, Math.PI - 0.3); ctx.stroke();
  // rim + pulp fluff
  ctx.fillStyle = b.col;
  ctx.beginPath(); ctx.ellipse(0, 0, b.r * 0.92, b.r * 0.30, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = b.fib;
  for (let i = 0; i < 4; i++) {
    const a = i / 4 * TAU + 0.6;
    ctx.beginPath();
    ctx.ellipse(Math.cos(a) * b.r * 0.4, -b.r * 0.10 + Math.sin(a) * b.r * 0.1, b.r * 0.30, b.r * 0.20, a, 0, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = '#c8b89c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(0, 0, b.r, b.r * 0.34, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

function drawLever(ctx, lever, prog, unlocked, time) {
  const t = lever.track;
  ctx.save();
  // track groove
  rr(ctx, t.x, t.y, t.w, t.h, 13);
  ctx.fillStyle = '#5f4a30';
  ctx.fill();
  ctx.strokeStyle = '#3f3120'; ctx.lineWidth = 2;
  rr(ctx, t.x, t.y, t.w, t.h, 13);
  ctx.stroke();
  // down chevrons in groove
  if (unlocked && prog < 0.5) {
    const off = (time * 40) % 26;
    ctx.strokeStyle = 'rgba(255,235,170,0.85)';
    ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const yy = t.y + 16 + ((off + i * 26) % (t.h - 30));
      ctx.beginPath();
      ctx.moveTo(t.x + 5, yy);
      ctx.lineTo(t.x + t.w / 2, yy + 8);
      ctx.lineTo(t.x + t.w - 5, yy);
      ctx.stroke();
    }
  }
  // handle knob
  const hx = t.x + t.w / 2, hy = t.y + lever.r * 0.2 + prog * (t.h - lever.r * 0.4);
  if (unlocked) glowRing(ctx, hx, hy, lever.r * 1.15, time);
  const g = ctx.createRadialGradient(hx - lever.r * 0.3, hy - lever.r * 0.3, 2, hx, hy, lever.r);
  g.addColorStop(0, unlocked ? '#e8c27c' : '#b9a583');
  g.addColorStop(1, unlocked ? '#9d7434' : '#847357');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(hx, hy, lever.r, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(60,42,18,0.7)'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.arc(hx, hy, lever.r, 0, TAU); ctx.stroke();
  ctx.strokeStyle = 'rgba(60,42,18,0.45)'; ctx.lineWidth = 2;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - lever.r * 0.5, hy + i * 7);
    ctx.lineTo(hx + lever.r * 0.5, hy + i * 7);
    ctx.stroke();
  }
  ctx.restore();
  return { hx, hy };
}

function drawCrossSection(ctx, lay, sim, paper, time) {
  const { cs, paperR } = lay;
  ctx.save();
  // glass box
  rr(ctx, cs.x, cs.y, cs.w, cs.h, 8);
  ctx.fillStyle = 'rgba(205,222,228,0.45)';
  ctx.fill();
  ctx.clip();
  const meshY = cs.y + cs.h * 0.28;
  // water above mesh
  const lvl = clamp(sim.level, 0, 1);
  if (lvl > 0) {
    ctx.fillStyle = 'rgba(110,165,180,0.55)';
    ctx.fillRect(cs.x, meshY - lvl * (cs.h * 0.24), cs.w, lvl * (cs.h * 0.24));
  }
  // paper strip on mesh with deposit mounds at damage x positions
  if (paper) {
    ctx.fillStyle = '#c9b389';
    ctx.fillRect(paperR.x, meshY - 4, paperR.w, 4);
    for (const d of paper.damages) {
      const x = paperR.x + d.cx * paperR.w;
      const w = Math.max(10, d.r * paperR.w * 2);
      // gap in the old paper
      if (d.type !== 'thin') { ctx.clearRect(x - w / 2, meshY - 4, w, 4); ctx.fillStyle = 'rgba(110,165,180,0.35)'; ctx.fillRect(x - w / 2, meshY - 4, w, 4); }
      // new pulp mound grows
      const fr = d.cap > 0 ? clamp(d.got / d.cap, 0, 1) : 0;
      if (fr > 0) {
        ctx.fillStyle = '#eadfc2';
        ctx.beginPath();
        ctx.ellipse(x, meshY - 1, w / 2, 4 * fr, 0, Math.PI, TAU);
        ctx.fill();
      }
      ctx.fillStyle = '#c9b389';
    }
  }
  // mesh line
  ctx.strokeStyle = 'rgba(90,105,115,0.8)';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(cs.x, meshY); ctx.lineTo(cs.x + cs.w, meshY); ctx.stroke();
  ctx.setLineDash([]);
  // droplets falling through deficits while draining — each stream stops
  // as its deficit seals (the paper now blocks the water there)
  if (sim.draining && sim.level > 0.01) {
    ctx.fillStyle = 'rgba(120,175,190,0.9)';
    const spots = paper ? paper.damages.filter(d => !d.done).map(d => paperR.x + d.cx * paperR.w)
      : [cs.x + cs.w * 0.25, cs.x + cs.w * 0.5, cs.x + cs.w * 0.75];
    spots.forEach((x, i) => {
      for (let k = 0; k < 3; k++) {
        const p = (time * (0.9 + i * 0.13) + k / 3 + i * 0.31) % 1;
        const yy = meshY + 4 + p * (cs.h - (meshY - cs.y) - 10);
        ctx.beginPath();
        ctx.ellipse(x + Math.sin(i * 5 + k * 7) * 4, yy, 2, 3.2, 0, 0, TAU);
        ctx.fill();
      }
    });
    // collected water flowing out at the bottom right
    ctx.fillStyle = 'rgba(110,165,180,0.6)';
    ctx.fillRect(cs.x, cs.y + cs.h - 7, cs.w, 7);
    const off = (time * 60) % 18;
    ctx.strokeStyle = 'rgba(230,245,248,0.8)';
    ctx.lineWidth = 2;
    for (let x = cs.x + off; x < cs.x + cs.w - 14; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x, cs.y + cs.h - 3.5);
      ctx.lineTo(x + 7, cs.y + cs.h - 3.5);
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.strokeStyle = 'rgba(110,125,135,0.7)';
  ctx.lineWidth = 2;
  rr(ctx, cs.x, cs.y, cs.w, cs.h, 8);
  ctx.stroke();
}

function makeTankScene(free) {
  return {
    free,
    pours: [],
    ripples: [],
    leverGrab: null,
    leverProg: 0,
    stroking: false,
    pitaT: 0,
    filmT: 0,
    grainN: 0,
    lastGrain: 0,
    doneT: 0,
    sparkles: null,

    sim() { return free ? G.freeSim : G.sim; },

    enter() {
      this.pours = []; this.ripples = []; this.leverGrab = null;
      this.stroking = false; this.pitaT = 0; this.doneT = 0; this.sparkles = null;
      this.filmT = 0; this.grainN = 0; this.lastGrain = 0;
      if (free) {
        G.freeSim = new FiberSim(null);
        G.freeSheet = mk(440, 580);
        G.freeSim.freeSettle = (f) => {
          const [u, v] = tankToUv(f.x, f.y);
          const c = G.freeSheet.getContext('2d');
          const x = clamp(u, 0, 1) * 440, y = clamp(v, 0, 1) * 580;
          c.strokeStyle = f.col; c.lineCap = 'round';
          for (let i = 0; i < 3; i++) {
            const an = Math.random() * TAU, l = 5 + Math.random() * 7;
            c.globalAlpha = 0.25 + Math.random() * 0.2;
            c.lineWidth = 1.4 + Math.random() * 1.4;
            c.beginPath();
            c.moveTo(x - Math.cos(an) * l, y - Math.sin(an) * l);
            c.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l);
            c.stroke();
          }
          c.globalAlpha = 1;
        };
        this.leverProg = 0;
      } else {
        this.leverProg = G.flags.latched ? 1 : 0;
        G.sim.level = G.sim.level ?? 1;
      }
      setWater(0.35);
    },

    unlocked() {
      const s = this.sim();
      if (free) return s.poured > 0 && !s.draining;
      return G.flags.dispersed && !G.flags.latched;
    },

    down(p) {
      const L = G.L, la = tankLay(L, free);
      const s = this.sim();
      // lever first: its grab region must win over generous bowl hit areas
      if (this.unlocked() || (free ? s.draining : G.flags.latched)) {
        const lt = la.lever.track;
        const lhy = lt.y + this.leverProg * lt.h;
        if (dist(p.x, p.y, lt.x + lt.w / 2, lhy) < la.lever.r + 44) {
          this.leverGrab = { y: p.y, la };
          sfx.tap();
          return;
        }
      }
      // bowls
      const canPour = free ? !s.draining || s.level > 0.5 : !G.flags.latched;
      if (canPour) {
        for (const b of la.bowls) {
          if (dist(p.x, p.y, b.x, b.y) < b.r + 30) {
            const tx = 0.15 + Math.random() * 0.7, ty = 0.12 + Math.random() * 0.35;
            this.pours.push({ t: 0, x0: b.x, y0: b.y - b.r * 0.3, tx, ty, col: b.fib, la });
            sfx.pour();
            return;
          }
        }
      }
      // free-mode buttons
      if (free) {
        const bt = this.freeButtons(L);
        if (dist(p.x, p.y, bt.home.x, bt.home.y) < bt.home.r + 22) { sfx.tap(); G.go('menu'); return; }
        if (bt.refill.on && dist(p.x, p.y, bt.refill.x, bt.refill.y) < bt.refill.r + 22) {
          sfx.splash();
          s.draining = false; s.drainT = 0; s.strength = 0; s.level = 1;
          this.leverProg = 0;
          return;
        }
      }
      // lever
      const t = la.lever.track;
      const hy = t.y + this.leverProg * t.h;
      if (dist(p.x, p.y, t.x + t.w / 2, hy) < la.lever.r + 44) {
        this.leverGrab = { y: p.y, la };
        sfx.tap();
        return;
      }
      // stir
      if (p.x > la.inner.x && p.x < la.inner.x + la.inner.w && p.y > la.inner.y && p.y < la.inner.y + la.inner.h) {
        this.stroking = true;
      }
    },

    move(p) {
      const s = this.sim();
      if (this.leverGrab) {
        const t = this.leverGrab.la.lever.track;
        this.leverProg = clamp((p.y - t.y) / t.h, 0, 1);
        const latched = free ? s.draining : G.flags.latched;
        if (this.leverProg > 0.62 && !latched && this.unlocked()) {
          if (free) { s.draining = true; s.drainT = 0; }
          else { G.flags.latched = true; s.draining = true; s.drainT = 0; }
          s.drainJitter = 0.88 + Math.random() * 0.24; // every drain slightly different
          sfx.press();
        }
        return;
      }
      if (this.stroking && s.level > 0.05) {
        const la = tankLay(G.L, free);
        const tx = (p.x - la.inner.x) / la.inner.w;
        const ty = (p.y - la.inner.y) / la.inner.h;
        if (tx > 0 && tx < 1 && ty > 0 && ty < 1) {
          s.stir(tx, ty, p.vx / la.inner.w, p.vy / la.inner.h);
          if (Math.random() < 0.25) this.ripples.push({ x: tx, y: ty, t: 0 });
        }
      }
    },

    up() {
      const s = this.sim();
      const latched = free ? s.draining : G.flags.latched;
      if (this.leverGrab && !latched) this.leverProg = 0;
      this.leverGrab = null;
      this.stroking = false;
    },

    freeButtons(L) {
      const s = this.sim();
      const r = clamp(Math.min(L.W, L.H) * 0.05, 24, 34);
      return {
        home: { x: r + 14, y: r + 14 + 20, r },
        refill: { x: r + 14, y: (r + 14) * 2 + r + 26, r, on: s.draining && s.level <= 0.02 },
      };
    },

    update(dt) {
      const s = this.sim();
      const la = tankLay(G.L, free);
      // pour animations
      for (const po of this.pours) {
        po.t += dt / 0.55;
        if (po.t >= 1 && !po.done) {
          po.done = true;
          s.pour(po.tx, po.ty, po.col);
          this.ripples.push({ x: po.tx, y: po.ty, t: 0 });
          sfx.splash();
        }
      }
      this.pours = this.pours.filter(po => po.t < 1.2);
      for (const rp of this.ripples) rp.t += dt;
      this.ripples = this.ripples.filter(rp => rp.t < 1);

      if (!free) {
        const enough = s.poured >= s.need;
        if (!G.flags.dispersed && enough && (s.dispersion() >= 0.32 || (s.slurryT || 0) > 22)) {
          G.flags.dispersed = true;
          sfx.chime();
        }
        // partial lever pull (before latch) already tugs at the water —
        // cause and effect connect the instant the finger moves the lever
        if (!G.flags.latched) {
          if (this.leverGrab && this.unlocked() && this.leverProg > 0.02) {
            s.preview = this.leverProg;
          }
          if (s.preview > 0.02) setSuck(s.preview * 0.35, s.level);
        }
        if (G.flags.latched && !G.flags.cast) {
          s.drainT += dt;
          s.strength = Math.min(1, s.drainT / 0.7);
          const full = s.allFull();
          // fast at first, easing off as the water thins — staged, not linear
          if (s.drainT > 0.12 && s.level > 0.045) {
            s.level = Math.max(0.045,
              s.level - dt * 0.55 * s.strength * (0.25 + 0.75 * s.level) * (s.drainJitter || 1));
          }
          if (full && s.level <= 0.05) {
            // the last film of water: one quiet beat (すっ…) before ぴたり
            if (this.filmT === 0) sfx.sip();
            this.filmT += dt;
            s.level = Math.max(0, 0.045 * (1 - this.filmT / 0.7));
            if (this.filmT >= 0.7) {
              G.flags.cast = true;
              this.pitaT = 0;
              sfx.pita();
              setSuck(0, 0);
            }
          }
          this.leverProg = Math.max(this.leverProg, Math.min(1, 0.62 + s.drainT * 0.5));
          setSuck(s.strength * (s.level > 0 ? 1 : 0.35), s.level);
          setWater(0.2 + 0.15 * s.strength);
          // each deposition is audible; pitch climbs as the deficit fills
          if (s.settledN > this.grainN) {
            this.grainN = s.settledN;
            if (G.time - this.lastGrain > 0.07) {
              this.lastGrain = G.time;
              sfx.grain(G.paper.fillRatio());
            }
          }
          for (const d of G.paper.damages) {
            if (!d.done && d.cap > 0 && d.got >= d.cap * 0.97) {
              d.done = true;
              G.paper.sealDamage(d);
              sfx.pop();
            }
          }
          // safety: never strand the child — trickle in more pulp if we ran dry
          if (!s.allFull() && s.activeCount() === 0 && s.drainT > 2.5) {
            s.pour(0.2 + Math.random() * 0.6, 0.15, PULP_BOWLS[0].fib);
          }
        }
        if (G.flags.cast) {
          this.pitaT += dt;
          if (this.pitaT > 1.6) { setWater(0); G.go('couch'); }
        }
      } else {
        if (s.draining) {
          s.drainT += dt;
          s.strength = Math.min(1, s.drainT / 0.8);
          if (s.drainT > 0.15) s.level = Math.max(0, s.level - dt * 0.30 * s.strength * (0.3 + 0.7 * s.level));
          setSuck(s.strength * (s.level > 0 ? 1 : 0.2));
          if (s.level <= 0 && s.activeCount() === 0 && this.doneT === 0) {
            this.doneT = 0.001;
            sfx.big();
            setSuck(0);
          }
        }
        if (this.doneT > 0) this.doneT += dt;
      }
      s.update(dt);
    },

    render(ctx, L) {
      const la = tankLay(L, free);
      const s = this.sim();
      roomBg(ctx, L, '');
      // tank frame
      rr(ctx, la.tank.x - 8, la.tank.y - 8, la.tank.w + 16, la.tank.h + 16, 18);
      ctx.fillStyle = '#8b6d49';
      ctx.fill();
      ctx.strokeStyle = '#5d472c'; ctx.lineWidth = 3;
      rr(ctx, la.tank.x - 8, la.tank.y - 8, la.tank.w + 16, la.tank.h + 16, 18);
      ctx.stroke();
      // basin
      rr(ctx, la.inner.x - 4, la.inner.y - 4, la.inner.w + 8, la.inner.h + 8, 12);
      ctx.fillStyle = '#c7d4d2';
      ctx.fill();
      ctx.save();
      rr(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h, 10);
      ctx.clip();
      drawMesh(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h);
      // paper (or free-play sheet)
      if (!free && G.paper) {
        ctx.drawImage(G.paper.pageImg(1), la.paperR.x, la.paperR.y, la.paperR.w, la.paperR.h);
      } else if (free && G.freeSheet) {
        ctx.drawImage(G.freeSheet, la.paperR.x, la.paperR.y, la.paperR.w, la.paperR.h);
      }
      // water tint
      const lvl = clamp(s.level, 0, 1);
      if (lvl > 0) {
        ctx.fillStyle = `rgba(96,148,158,${0.10 + 0.26 * lvl})`;
        ctx.fillRect(la.inner.x, la.inner.y, la.inner.w, la.inner.h);
        // shimmer lines
        ctx.strokeStyle = `rgba(235,248,250,${0.14 * lvl})`;
        ctx.lineWidth = 2;
        const n = Math.round(3 + lvl * 4);
        for (let i = 0; i < n; i++) {
          const yy = la.inner.y + ((i + 0.5) / n) * la.inner.h + Math.sin(G.time * 1.3 + i * 2) * 4;
          ctx.beginPath();
          ctx.moveTo(la.inner.x + 10, yy);
          ctx.bezierCurveTo(la.inner.x + la.inner.w * 0.3, yy + 5, la.inner.x + la.inner.w * 0.7, yy - 5, la.inner.x + la.inner.w - 10, yy);
          ctx.stroke();
        }
      }
      // receding tide: as the level drops, wet marks pull away from the walls
      if (lvl < 0.98 && lvl > 0.02) {
        const inset = (1 - lvl) * Math.min(la.inner.w, la.inner.h) * 0.045;
        ctx.strokeStyle = `rgba(120,170,182,${0.35 + 0.25 * lvl})`;
        ctx.lineWidth = 2.5;
        rr(ctx, la.inner.x + inset, la.inner.y + inset, la.inner.w - inset * 2, la.inner.h - inset * 2, 10);
        ctx.stroke();
        // dark damp band left behind on the walls
        ctx.strokeStyle = 'rgba(90,110,118,0.18)';
        ctx.lineWidth = inset > 2 ? inset : 0;
        if (inset > 2) {
          rr(ctx, la.inner.x + inset / 2, la.inner.y + inset / 2, la.inner.w - inset, la.inner.h - inset, 10);
          ctx.stroke();
        }
      }
      // last thin film clinging near deficits
      if (s.draining && s.level > 0 && s.level < 0.14 && !free && G.paper) {
        for (const d of G.paper.damages) {
          const x = la.paperR.x + d.cx * la.paperR.w, y = la.paperR.y + d.cy * la.paperR.h;
          const rad = Math.max(30, d.r * la.paperR.w * 2.6);
          const gg = ctx.createRadialGradient(x, y, 2, x, y, rad);
          gg.addColorStop(0, `rgba(180,225,235,${0.4 * (s.level / 0.14)})`);
          gg.addColorStop(1, 'rgba(180,225,235,0)');
          ctx.fillStyle = gg;
          ctx.beginPath(); ctx.arc(x, y, rad, 0, TAU); ctx.fill();
        }
      }
      // fibers
      s.render(ctx, la.inner);
      // stir ripples
      for (const rp of this.ripples) {
        const x = la.inner.x + rp.x * la.inner.w, y = la.inner.y + rp.y * la.inner.h;
        ctx.strokeStyle = `rgba(235,248,250,${0.5 * (1 - rp.t)})`;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 6 + rp.t * 34, 0, TAU); ctx.stroke();
      }
      // vortices + converging water threads over unfilled deficits — the
      // flow is visibly strong at the holes and absent over intact paper.
      // Present (weakly) already during the partial lever pull.
      const flow = s.draining ? (s.strength ?? 0) : (s.preview ?? 0) * 0.6;
      if (flow > 0.04 && s.level > 0.02 && !free && G.paper) {
        for (const d of G.paper.damages) {
          if (d.done) continue;
          const x = la.paperR.x + d.cx * la.paperR.w, y = la.paperR.y + d.cy * la.paperR.h;
          const rad = Math.max(16, d.r * la.paperR.w * 1.6);
          ctx.strokeStyle = `rgba(240,250,252,${0.55 * flow})`;
          ctx.lineWidth = 2;
          for (let k = 0; k < 3; k++) {
            const p0 = ((G.time * 0.55 + k / 3) % 1);
            const a0 = G.time * (2 + flow * 2.5) + k * (TAU / 3);
            ctx.beginPath();
            ctx.arc(x, y, rad * (1 - p0 * 0.75), a0, a0 + 2.1);
            ctx.stroke();
          }
          // water threads sliding inward from the surroundings
          ctx.lineWidth = 2;
          for (let k = 0; k < 6; k++) {
            const a = k / 6 * TAU + d.cx * 7;
            const p = (G.time * (1.1 + flow * 0.6) + k * 0.37 + d.cy * 5) % 1;
            const rr2 = (2.6 - p * 2.0) * rad;
            const px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2;
            const len = 8 + 7 * (1 - p);
            ctx.strokeStyle = `rgba(225,242,246,${0.34 * flow * (1 - p)})`;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len);
            ctx.stroke();
          }
          // tiny bubbles
          ctx.fillStyle = `rgba(245,252,254,${0.6 * flow})`;
          for (let k = 0; k < 2; k++) {
            const p0 = ((G.time * 0.8 + k * 0.5) % 1);
            ctx.beginPath();
            ctx.arc(x + Math.cos(k * 4 + G.time) * rad * 0.6, y + Math.sin(k * 5) * rad * 0.4, 2 * (1 - p0), 0, TAU);
            ctx.fill();
          }
        }
      }
      // pita! outline glow + a small sparkle breath when the sheet completes
      if (!free && G.flags.cast) {
        const a = 0.75 * Math.max(0, 1 - Math.abs(this.pitaT - 0.5) / 0.9);
        if (a > 0) {
          ctx.save();
          ctx.shadowColor = 'rgba(255,240,190,0.9)';
          ctx.shadowBlur = 16;
          G.paper.strokeDamages(ctx, la.paperR, `rgba(255,240,190,${a})`, 3);
          ctx.restore();
        }
        if (this.pitaT < 1.0) {
          for (const d of G.paper.damages) {
            const x = la.paperR.x + d.cx * la.paperR.w, y = la.paperR.y + d.cy * la.paperR.h;
            const rad = Math.max(14, d.r * la.paperR.w * 1.3);
            for (let k = 0; k < 6; k++) {
              const a2 = k / 6 * TAU + d.cx * 9;
              const p = Math.min(1, this.pitaT / 0.8);
              const rr3 = rad * (0.4 + p * 1.1);
              ctx.fillStyle = `rgba(255,246,205,${0.7 * (1 - p)})`;
              ctx.beginPath();
              ctx.arc(x + Math.cos(a2) * rr3, y + Math.sin(a2) * rr3, 2.2 * (1 - p * 0.6), 0, TAU);
              ctx.fill();
            }
          }
        }
      }
      ctx.restore(); // basin clip
      // glass highlight on basin
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      rr(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h, 10);
      ctx.stroke();

      drawCrossSection(ctx, la, s, free ? null : G.paper, G.time);

      // pour arcs
      for (const po of this.pours) {
        if (po.done) continue;
        const t = ease(po.t);
        const x1 = la.inner.x + po.tx * la.inner.w, y1 = la.inner.y + po.ty * la.inner.h;
        for (let i = 0; i < 7; i++) {
          const tt = clamp(t - i * 0.05, 0, 1);
          const x = lerp(po.x0, x1, tt);
          const y = lerp(po.y0, y1, tt) - Math.sin(tt * Math.PI) * 70;
          ctx.fillStyle = po.col;
          ctx.globalAlpha = 0.9 - i * 0.1;
          ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // bowls
      const s2 = this.sim();
      const needMore = !free && s2.poured < s2.need && !G.flags.latched;
      for (const b of la.bowls) drawBowl(ctx, b, needMore ? Math.max(0, Math.sin(G.time * 3)) : 0);

      // lever
      drawLever(ctx, la.lever, this.leverProg, this.unlocked(), G.time);

      // free-mode buttons
      if (free) {
        const bt = this.freeButtons(L);
        this.drawRoundBtn(ctx, bt.home, 'back');
        if (bt.refill.on) this.drawRoundBtn(ctx, bt.refill, 'drop');
        if (this.doneT > 0.3) {
          // gentle sparkles over the finished fiber art
          ctx.fillStyle = 'rgba(255,250,220,0.7)';
          for (let i = 0; i < 8; i++) {
            const a = i * 0.8 + G.time * 1.2;
            const x = la.paperR.x + la.paperR.w * (0.5 + 0.4 * Math.sin(a * 1.7));
            const y = la.paperR.y + la.paperR.h * (0.5 + 0.4 * Math.cos(a * 1.3));
            const r2 = 1.5 + Math.sin(G.time * 5 + i) * 1.2;
            if (r2 > 0) { ctx.beginPath(); ctx.arc(x, y, r2, 0, TAU); ctx.fill(); }
          }
        }
      }

      // hints
      if (hint.idle > 4 && !G.flags?.cast) {
        if (!free && !G.flags.latched) {
          const sN = this.sim();
          if (sN.poured < sN.need) {
            const b = la.bowls[sN.poured / 55 % la.bowls.length | 0];
            hintGesture(ctx, 'tap', b.x, b.y - 10, 0, 0, G.time);
          } else if (!G.flags.dispersed) {
            hintGesture(ctx, 'stroke',
              la.inner.x + la.inner.w * 0.25, la.inner.y + la.inner.h * 0.3,
              la.inner.x + la.inner.w * 0.75, la.inner.y + la.inner.h * 0.7, G.time);
          } else {
            const t = la.lever.track;
            hintGesture(ctx, 'swipe', t.x + t.w / 2, t.y + 10, t.x + t.w / 2, t.y + t.h, G.time);
          }
        } else if (free && this.sim().poured === 0) {
          const b = la.bowls[0];
          hintGesture(ctx, 'tap', b.x, b.y - 10, 0, 0, G.time);
        }
      }
    },

    drawRoundBtn(ctx, b, icon) {
      ctx.save();
      ctx.fillStyle = 'rgba(250,244,230,0.92)';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#8b6d49'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#6b4f2f'; ctx.fillStyle = '#6b4f2f';
      ctx.lineWidth = 4; ctx.lineCap = 'round';
      if (icon === 'back') {
        ctx.beginPath();
        ctx.moveTo(b.x + b.r * 0.4, b.y);
        ctx.lineTo(b.x - b.r * 0.3, b.y);
        ctx.moveTo(b.x - b.r * 0.05, b.y - b.r * 0.32);
        ctx.lineTo(b.x - b.r * 0.4, b.y);
        ctx.lineTo(b.x - b.r * 0.05, b.y + b.r * 0.32);
        ctx.stroke();
      } else if (icon === 'drop') {
        ctx.fillStyle = '#5f93a8';
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - b.r * 0.5);
        ctx.bezierCurveTo(b.x + b.r * 0.5, b.y + b.r * 0.15, b.x + b.r * 0.32, b.y + b.r * 0.5, b.x, b.y + b.r * 0.5);
        ctx.bezierCurveTo(b.x - b.r * 0.32, b.y + b.r * 0.5, b.x - b.r * 0.5, b.y + b.r * 0.15, b.x, b.y - b.r * 0.5);
        ctx.fill();
      }
      ctx.restore();
    },

    qa(L) {
      const la = tankLay(L, free);
      const t = la.lever.track;
      const out = {
        bowls: la.bowls.map(b => ({ x: b.x, y: b.y })),
        lever: { x: t.x + t.w / 2, y: t.y + this.leverProg * t.h },
        leverEnd: { x: t.x + t.w / 2, y: t.y + t.h },
        tankCenter: { x: la.inner.x + la.inner.w / 2, y: la.inner.y + la.inner.h / 2 },
        tank: la.inner,
        unlocked: this.unlocked(),
      };
      if (free) out.buttons = this.freeButtons(L);
      return out;
    },
  };
}

export const sceneTank = makeTankScene(false);
export const sceneFree = makeTankScene(true);
