// Intro scenes: take the damaged page from the book, inspect on the light
// table, place it on the mesh in the tank.
import { G } from './state.js';
import { sfx, setWater } from './audio.js';
import { roomBg, hint, hintGesture, glowRing, drawMesh } from './ui.js';
import { clamp, lerp, dist, ease, easeOut, TAU, rr, fitRect, inRect } from './util.js';
import { tankLay } from './scenes_tank.js';

function drawCover(ctx, b, lift = 0) {
  // closed book cover (drawn over the page bottom so the page peeks out)
  ctx.save();
  ctx.translate(0, lift);
  // page block under cover
  ctx.fillStyle = '#e9dfc2';
  rr(ctx, b.x + 6, b.y + 8, b.w - 6, b.h - 8, 6);
  ctx.fill();
  ctx.strokeStyle = '#c9b98f';
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(b.x + b.w - 2 + i * 0, b.y + 12 + i * 3);
    ctx.lineTo(b.x + b.w - 2, b.y + b.h - 6);
    ctx.stroke();
  }
  // cover
  const g = ctx.createLinearGradient(b.x, b.y, b.x + b.w, b.y);
  g.addColorStop(0, '#4c6b4f');
  g.addColorStop(1, '#3a5440');
  ctx.fillStyle = g;
  rr(ctx, b.x, b.y, b.w, b.h, 10);
  ctx.fill();
  // spine
  ctx.fillStyle = '#31462f';
  rr(ctx, b.x, b.y, b.w * 0.10, b.h, 10);
  ctx.fill();
  // gold frame
  ctx.strokeStyle = 'rgba(212,178,90,0.85)';
  ctx.lineWidth = 2.5;
  rr(ctx, b.x + b.w * 0.16, b.y + b.h * 0.07, b.w * 0.74, b.h * 0.86, 8);
  ctx.stroke();
  // small gold leaf ornament
  ctx.strokeStyle = 'rgba(212,178,90,0.9)';
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  const cx = b.x + b.w * 0.53, cy = b.y + b.h * 0.5;
  ctx.moveTo(cx - b.w * 0.12, cy + b.h * 0.06);
  ctx.quadraticCurveTo(cx, cy - b.h * 0.10, cx + b.w * 0.12, cy - b.h * 0.02);
  ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const t = 0.25 + i * 0.25;
    const px = lerp(cx - b.w * 0.12, cx + b.w * 0.12, t);
    const py = cy + b.h * 0.06 - Math.sin(t * Math.PI) * b.h * 0.09;
    ctx.beginPath();
    ctx.ellipse(px, py - 6, 8, 4, -0.6, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
}

export const sceneBook = {
  pull: 0, grab: null, out: false, anim: 0,
  enter() { this.pull = 0; this.grab = null; this.out = false; this.anim = 0; },
  lay(L) {
    const { W, H, portrait } = L;
    const bw = portrait ? Math.min(W * 0.72, H * 0.40 * 0.78) : Math.min(W * 0.34, H * 0.5);
    const bh = bw * 1.32;
    const bx = (W - bw) / 2, by = portrait ? H * 0.60 - bh / 2 : H * 0.60 - bh / 2;
    const pw = bw * 0.80, ph = pw * (580 / 440);
    const page = { x: bx + bw * 0.13, y: by + bh * 0.16 - ph, w: pw, h: ph }; // mostly hidden
    return { book: { x: bx, y: by, w: bw, h: bh }, page };
  },
  down(p) {
    const la = this.lay(G.L);
    const tab = { x: la.page.x, y: la.book.y - la.page.h * 0.42, w: la.page.w, h: la.page.h * 0.45 };
    if (inRect(p.x, p.y, tab, 50) || inRect(p.x, p.y, la.book, 24)) {
      this.grab = { y: p.y };
      sfx.tap();
    }
  },
  move(p) {
    if (!this.grab || this.out) return;
    this.pull = clamp(this.pull + (this.grab.y - p.y) / (G.L.H * 0.22), 0, 1);
    this.grab.y = p.y;
    if (this.pull >= 1) { this.out = true; sfx.flip(); }
  },
  up() { this.grab = null; },
  update(dt) {
    if (this.out) {
      this.anim += dt;
      if (this.anim > 0.8) G.go('light');
    } else if (!this.grab) {
      this.pull = Math.max(0, this.pull - dt * 0.6);
    }
  },
  render(ctx, L) {
    roomBg(ctx, L, '');
    const la = this.lay(L);
    const wig = (!this.grab && !this.out && hint.idle > 3) ? Math.sin(G.time * 5) * 3 : 0;
    // page peeking out of the book (bottom hidden by cover)
    const rise = this.pull * la.page.h * 0.42 + (this.out ? ease(Math.min(1, this.anim / 0.8)) * L.H * 0.35 : 0);
    const py = la.page.y + la.page.h * 0.55 - rise + wig;
    ctx.save();
    ctx.translate(la.page.x + la.page.w / 2, py + la.page.h / 2);
    ctx.rotate(-0.03 + this.pull * 0.03);
    ctx.shadowColor = 'rgba(40,25,10,0.35)';
    ctx.shadowBlur = 12;
    ctx.drawImage(G.paper.pageImg(0), -la.page.w / 2, -la.page.h / 2, la.page.w, la.page.h);
    ctx.restore();
    if (!this.out || this.anim < 0.25) drawCover(ctx, la.book);
    if (hint.idle > 4 && !this.out) {
      const cx = la.page.x + la.page.w / 2;
      hintGesture(ctx, 'drag', cx, la.book.y - 20, cx, la.book.y - 20 - L.H * 0.18, G.time);
    }
  },
  qa(L) {
    const la = this.lay(L);
    return {
      tab: { x: la.page.x + la.page.w / 2, y: la.book.y - 30 },
      pull: this.pull,
    };
  },
};

export const sceneLight = {
  lens: { u: 0.5, v: 1.05 }, rings: [], doneT: 0,
  enter() { this.lens = { u: 0.5, v: 1.05 }; this.rings = []; this.doneT = 0; this.target = null; },
  lay(L) {
    const { W, H, portrait } = L;
    const page = fitRect(W / 2, portrait ? H * 0.46 : H * 0.5, W * 0.82, H * (portrait ? 0.58 : 0.68), 440 / 580);
    const pad = page.w * 0.10;
    const table = { x: page.x - pad, y: page.y - pad, w: page.w + pad * 2, h: page.h + pad * 2 };
    return { page, table, lensR: Math.max(42, page.w * 0.17) };
  },
  down(p) { this.target = p; },
  move(p) { this.target = p; },
  up() { this.target = null; },
  update(dt) {
    const la = this.lay(G.L);
    if (this.target) {
      const tu = (this.target.x - la.page.x) / la.page.w;
      const tv = (this.target.y - la.page.y) / la.page.h;
      // lens lags behind the finger
      this.lens.u += (clamp(tu, -0.1, 1.1) - this.lens.u) * Math.min(1, dt * 7);
      this.lens.v += (clamp(tv, -0.1, 1.1) - this.lens.v) * Math.min(1, dt * 7);
    }
    const lx = la.page.x + this.lens.u * la.page.w;
    const ly = la.page.y + this.lens.v * la.page.h;
    for (const d of G.paper.damages) {
      if (d.found) continue;
      const dx2 = la.page.x + d.cx * la.page.w, dy2 = la.page.y + d.cy * la.page.h;
      if (dist(lx, ly, dx2, dy2) < la.lensR * 0.95 + d.r * la.page.w * 0.6) {
        d.found = true;
        G.flags.found++;
        this.rings.push({ u: d.cx, v: d.cy, t: 0, r: Math.max(0.06, d.r * 1.6) });
        sfx.pop();
      }
    }
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter(r => r.t < 1.2);
    if (G.flags.found >= G.paper.damages.length) {
      this.doneT += dt;
      if (this.doneT > 1.1) { sfx.chime(); G.go('place'); }
    }
  },
  render(ctx, L) {
    roomBg(ctx, L, '');
    ctx.fillStyle = 'rgba(30,26,38,0.42)';
    ctx.fillRect(0, 0, L.W, L.H);
    const la = this.lay(L);
    // light table
    ctx.save();
    ctx.shadowColor = 'rgba(255,246,210,0.8)';
    ctx.shadowBlur = 30;
    rr(ctx, la.table.x, la.table.y, la.table.w, la.table.h, 16);
    ctx.fillStyle = '#f8f2dd';
    ctx.fill();
    ctx.restore();
    const tg = ctx.createRadialGradient(
      la.table.x + la.table.w / 2, la.table.y + la.table.h / 2, 10,
      la.table.x + la.table.w / 2, la.table.y + la.table.h / 2, la.table.h * 0.7);
    tg.addColorStop(0, 'rgba(255,255,255,0.9)');
    tg.addColorStop(1, 'rgba(255,250,225,0.2)');
    ctx.fillStyle = tg;
    rr(ctx, la.table.x, la.table.y, la.table.w, la.table.h, 16);
    ctx.fill();
    // page (backlit)
    ctx.globalAlpha = 0.96;
    ctx.drawImage(G.paper.pageImg(0), la.page.x, la.page.y, la.page.w, la.page.h);
    ctx.globalAlpha = 1;
    // lens light
    const lx = la.page.x + this.lens.u * la.page.w;
    const ly = la.page.y + this.lens.v * la.page.h;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const lg = ctx.createRadialGradient(lx, ly, 4, lx, ly, la.lensR * 1.5);
    lg.addColorStop(0, 'rgba(255,250,220,0.55)');
    lg.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = lg;
    ctx.beginPath(); ctx.arc(lx, ly, la.lensR * 1.5, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(lx, ly, la.lensR, 0, TAU); ctx.stroke();
    // found damage outlines glow
    ctx.save();
    for (const d of G.paper.damages) {
      if (!d.found) continue;
      ctx.shadowColor = 'rgba(255,205,120,0.9)';
      ctx.shadowBlur = 10;
      ctx.save();
      ctx.translate(la.page.x, la.page.y);
      ctx.scale(la.page.w / 440, la.page.h / 580);
      ctx.strokeStyle = `rgba(255,190,105,${0.65 + 0.2 * Math.sin(G.time * 4)})`;
      ctx.lineWidth = 3 * 440 / la.page.w;
      ctx.stroke(d.path);
      ctx.restore();
    }
    ctx.restore();
    // found rings
    for (const r of this.rings) {
      const x = la.page.x + r.u * la.page.w, y = la.page.y + r.v * la.page.h;
      ctx.strokeStyle = `rgba(255,215,130,${0.8 * (1 - r.t / 1.2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r.r * la.page.w * (0.8 + r.t), 0, TAU);
      ctx.stroke();
    }
    // progress pips (one per damage, no text)
    const n = G.paper.damages.length;
    for (let i = 0; i < n; i++) {
      const x = L.W / 2 + (i - (n - 1) / 2) * 34;
      const y = la.table.y - 26;
      ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU);
      if (i < G.flags.found) { ctx.fillStyle = '#f2c164'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,246,210,0.8)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // idle hint: guide finger to an unfound damage
    if (hint.idle > 4 && G.flags.found < n) {
      const d = G.paper.damages.find(dd => !dd.found);
      if (d) {
        const tx = la.page.x + d.cx * la.page.w, ty = la.page.y + d.cy * la.page.h;
        glowRing(ctx, tx, ty, Math.max(24, d.r * la.page.w * 1.4), G.time);
        hintGesture(ctx, 'drag', lx, ly, tx, ty, G.time);
      }
    }
  },
  qa(L) {
    const la = this.lay(L);
    return {
      lens: { x: la.page.x + this.lens.u * la.page.w, y: la.page.y + this.lens.v * la.page.h },
      damages: G.paper.damages.map(d => ({
        x: la.page.x + d.cx * la.page.w, y: la.page.y + d.cy * la.page.h, found: d.found,
      })),
    };
  },
};

export const scenePlace = {
  drag: false, pos: null,
  enter() {
    this.drag = false;
    this.pos = { fx: 0.24, fy: 0.16 };
  },
  down(p) {
    if (G.flags.placed) return;
    const la = tankLay(G.L, false);
    const pw = la.paperR.w * 0.55, ph = pw * (580 / 440);
    const px = this.pos.fx * G.L.W, py = this.pos.fy * G.L.H;
    if (dist(p.x, p.y, px, py) < Math.max(pw, ph) * 0.7 + 30) { this.drag = true; sfx.tap(); }
  },
  move(p) {
    if (!this.drag || G.flags.placed) return;
    this.pos.fx = p.x / G.L.W;
    this.pos.fy = p.y / G.L.H;
    const la = tankLay(G.L, false);
    const cx = la.paperR.x + la.paperR.w / 2, cy = la.paperR.y + la.paperR.h / 2;
    if (dist(p.x, p.y, cx, cy) < la.paperR.w * 0.38) {
      G.flags.placed = true;
      this.drag = false;
      sfx.splash();
      setWater(0.4);
    }
  },
  up() { this.drag = false; },
  update(dt) {
    if (G.flags.placed && G.flags.waterIn < 1) {
      G.flags.waterIn = Math.min(1, G.flags.waterIn + dt / 2.4);
      if (G.flags.waterIn >= 1) {
        G.sim.level = 1;
        sfx.chime();
        G.go('tank');
      }
    }
  },
  render(ctx, L) {
    roomBg(ctx, L, '');
    const la = tankLay(L, false);
    // tank
    rr(ctx, la.tank.x - 8, la.tank.y - 8, la.tank.w + 16, la.tank.h + 16, 18);
    ctx.fillStyle = '#8b6d49'; ctx.fill();
    ctx.strokeStyle = '#5d472c'; ctx.lineWidth = 3;
    rr(ctx, la.tank.x - 8, la.tank.y - 8, la.tank.w + 16, la.tank.h + 16, 18);
    ctx.stroke();
    rr(ctx, la.inner.x - 4, la.inner.y - 4, la.inner.w + 8, la.inner.h + 8, 12);
    ctx.fillStyle = '#c7d4d2'; ctx.fill();
    ctx.save();
    rr(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h, 10);
    ctx.clip();
    drawMesh(ctx, la.inner.x, la.inner.y, la.inner.w, la.inner.h);
    // target outline on the mesh
    if (!G.flags.placed) {
      ctx.setLineDash([10, 8]);
      ctx.strokeStyle = `rgba(120,140,150,${0.5 + 0.25 * Math.sin(G.time * 3)})`;
      ctx.lineWidth = 3;
      rr(ctx, la.paperR.x, la.paperR.y, la.paperR.w, la.paperR.h, 6);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.drawImage(G.paper.pageImg(G.flags.waterIn), la.paperR.x, la.paperR.y, la.paperR.w, la.paperR.h);
      const lvl = G.flags.waterIn;
      if (lvl > 0) {
        ctx.fillStyle = `rgba(96,148,158,${0.10 + 0.26 * lvl})`;
        ctx.fillRect(la.inner.x, la.inner.y, la.inner.w, la.inner.h);
        // pouring stream
        const sx = la.inner.x + la.inner.w * 0.5;
        ctx.fillStyle = 'rgba(150,200,215,0.75)';
        const wob = Math.sin(G.time * 9) * 2;
        ctx.fillRect(sx - 4 + wob, la.tank.y - 26, 8, la.inner.h * 0.35);
        ctx.strokeStyle = 'rgba(235,248,250,0.6)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const rp = (G.time * 1.4 + i / 3) % 1;
          ctx.beginPath();
          ctx.ellipse(sx, la.inner.y + la.inner.h * 0.34, 10 + rp * 50, (10 + rp * 50) * 0.4, 0, 0, TAU);
          ctx.globalAlpha = 1 - rp;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    ctx.restore();
    if (G.flags.placed) {
      // spout
      const sx = la.inner.x + la.inner.w * 0.5;
      ctx.fillStyle = '#9aa7ad';
      rr(ctx, sx - 16, la.tank.y - 34, 32, 14, 5);
      ctx.fill();
    }
    // draggable page
    if (!G.flags.placed) {
      const pw = la.paperR.w * 0.55, ph = pw * (580 / 440);
      const px = this.pos.fx * L.W, py = this.pos.fy * L.H;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(this.drag ? Math.sin(G.time * 6) * 0.02 : -0.04);
      ctx.shadowColor = 'rgba(40,25,10,0.35)';
      ctx.shadowBlur = 10;
      ctx.drawImage(G.paper.pageImg(0), -pw / 2, -ph / 2, pw, ph);
      ctx.restore();
      if (hint.idle > 4) {
        const cx = la.paperR.x + la.paperR.w / 2, cy = la.paperR.y + la.paperR.h / 2;
        hintGesture(ctx, 'drag', px, py, cx, cy, G.time);
      }
    }
  },
  qa(L) {
    const la = tankLay(L, false);
    return {
      page: { x: this.pos ? this.pos.fx * L.W : 0, y: this.pos ? this.pos.fy * L.H : 0 },
      target: { x: la.paperR.x + la.paperR.w / 2, y: la.paperR.y + la.paperR.h / 2 },
      placed: G.flags.placed,
      waterIn: G.flags.waterIn,
    };
  },
};
