// Paper sheet model: damage mask, artwork (drawn media), fiber deposit layer.
// Domain rule: artwork is punched out where paper is missing and is NEVER
// re-generated. New fiber deposits are blank pulp — they repair the support,
// not the lost drawing.
import { mk, mulberry32, clamp, lerp, TAU } from './util.js';

export const PW = 440, PH = 580;
export const CAP_TOTAL = 120; // total fiber grains needed to fill all deficits
const CELL = 16;
const GW = Math.ceil(PW / CELL), GH = Math.ceil(PH / CELL);

export class Paper {
  constructor(kind, seed) {
    this.kind = kind;
    this.seed = seed;
    this.rng = mulberry32(seed);
    this.mask = mk(PW, PH);      // alpha = paper presence
    this.art = mk(PW, PH);       // aged paper + ink artwork, punched
    this.deposit = mk(PW, PH);   // new fiber accumulation
    this.page = mk(PW, PH);      // composed
    this.damages = [];
    this.sinks = [];
    this.cellA = new Float32Array(GW * GH);
    this.cellDep = new Float32Array(GW * GH);
    this.wetness = 0;
    this.compWet = -1;
    this.dirty = true;
    this.buildDamage();
    this.drawBase();
    this.buildSinks();
  }

  buildDamage() {
    const R = this.rng, D = this.damages;
    const mkHole = (cx, cy, rpx) => {
      const p = new Path2D(), n = 14, pts = [];
      const jr = [];
      for (let i = 0; i < n; i++) jr.push(rpx * (0.68 + R() * 0.55));
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * TAU, rad = jr[i % n];
        const x = cx * PW + Math.cos(a) * rad, y = cy * PH + Math.sin(a) * rad;
        if (i) p.lineTo(x, y); else p.moveTo(x, y);
        if (i < n) pts.push([x, y]);
      }
      p.closePath();
      return { type: 'hole', cx, cy, r: rpx / PW, path: p, pts, found: false, fill: 0, cap: 0, got: 0, done: false };
    };
    const mkTear = (x0, y0, x1, y1, w) => {
      const p = new Path2D(), n = 9, mid = [], up = [], dn = [], pts = [];
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const jx = (i > 0 && i < n) ? (R() - 0.5) * 16 : 0;
        const jy = (i > 0 && i < n) ? (R() - 0.5) * 20 : 0;
        mid.push([lerp(x0, x1, t) * PW + jx, lerp(y0, y1, t) * PH + jy]);
      }
      for (let i = 0; i <= n; i++) {
        const [x, y] = mid[i];
        const ww = w * PW * (0.5 + R() * 0.9);
        up.push([x, y - ww]); dn.push([x, y + ww]);
        pts.push([x, y]);
      }
      p.moveTo(up[0][0], up[0][1]);
      for (const [x, y] of up) p.lineTo(x, y);
      for (let i = n; i >= 0; i--) p.lineTo(dn[i][0], dn[i][1]);
      p.closePath();
      return {
        type: 'tear', cx: (x0 + x1) / 2, cy: (y0 + y1) / 2,
        r: Math.hypot((x1 - x0) * PW, (y1 - y0) * PH) / 2 / PW,
        path: p, pts, found: false, fill: 0, cap: 0, got: 0, done: false
      };
    };
    const mkThin = (cx, cy, rx, ry) => {
      const p = new Path2D();
      p.ellipse(cx * PW, cy * PH, rx * PW, ry * PH, R() * 1, 0, TAU);
      const pts = [];
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU;
        pts.push([cx * PW + Math.cos(a) * rx * PW, cy * PH + Math.sin(a) * ry * PH]);
      }
      return { type: 'thin', cx, cy, r: rx, path: p, pts, found: false, fill: 0, cap: 0, got: 0, done: false };
    };
    if (this.kind === 'A') {
      D.push(mkHole(0.40, 0.33, PW * 0.088));
      D.push(mkTear(1.0, 0.60, 0.60, 0.53, 0.026));
      D.push(mkThin(0.30, 0.66, 0.115, 0.075));
    } else if (this.kind === 'B') {
      D.push(mkHole(0.62, 0.56, PW * 0.080));
      D.push(mkTear(0.0, 0.28, 0.38, 0.34, 0.026));
      D.push(mkThin(0.58, 0.16, 0.11, 0.07));
    } else {
      const cx = 0.28 + R() * 0.42, cy = 0.24 + R() * 0.40;
      D.push(mkHole(cx, cy, PW * (0.07 + R() * 0.035)));
      if (R() < 0.5) D.push(mkTear(1.0, 0.38 + R() * 0.35, 0.58 + R() * 0.08, 0.38 + R() * 0.35, 0.026));
      else D.push(mkTear(0.0, 0.38 + R() * 0.35, 0.36 + R() * 0.08, 0.38 + R() * 0.35, 0.026));
      D.push(mkThin(0.28 + R() * 0.44, cy > 0.5 ? 0.18 + R() * 0.14 : 0.62 + R() * 0.18,
        0.10 + R() * 0.04, 0.062 + R() * 0.02));
    }
  }

  drawBase() {
    const R = mulberry32(777 + this.seed);
    // ---- mask: page silhouette with slightly irregular edge
    const m = this.mask.getContext('2d');
    m.clearRect(0, 0, PW, PH);
    m.fillStyle = '#fff';
    const ins = 5;
    m.beginPath();
    m.moveTo(ins, ins);
    const edge = (x0, y0, x1, y1) => {
      const n = 16;
      for (let i = 1; i <= n; i++) {
        const t = i / n;
        m.lineTo(lerp(x0, x1, t) + (R() - 0.5) * 3, lerp(y0, y1, t) + (R() - 0.5) * 3);
      }
    };
    edge(ins, ins, PW - ins, ins);
    edge(PW - ins, ins, PW - ins, PH - ins);
    edge(PW - ins, PH - ins, ins, PH - ins);
    edge(ins, PH - ins, ins, ins);
    m.closePath();
    m.fill();
    // punch damages with ragged fringes
    for (const d of this.damages) {
      m.globalCompositeOperation = 'destination-out';
      m.globalAlpha = d.type === 'thin' ? 0.5 : 1;
      m.fill(d.path);
      if (d.type !== 'thin') {
        for (const [x, y] of d.pts) {
          for (let k = 0; k < 3; k++) {
            m.globalAlpha = 0.3 + R() * 0.45;
            m.beginPath();
            m.arc(x + (R() - 0.5) * 8, y + (R() - 0.5) * 8, 1.5 + R() * 3.5, 0, TAU);
            m.fill();
          }
        }
      }
      m.globalAlpha = 1;
      m.globalCompositeOperation = 'source-over';
    }

    // ---- art: aged paper + ink drawing, then clipped by mask (damage punched)
    const a = this.art.getContext('2d');
    a.fillStyle = '#e7d9b8';
    a.fillRect(0, 0, PW, PH);
    for (let i = 0; i < 130; i++) {
      a.fillStyle = `rgba(${150 + (R() * 40 | 0)},${118 + (R() * 35 | 0)},${68 + (R() * 30 | 0)},${0.035 + R() * 0.05})`;
      a.beginPath();
      a.ellipse(R() * PW, R() * PH, 8 + R() * 42, 6 + R() * 30, R() * TAU, 0, TAU);
      a.fill();
    }
    a.strokeStyle = 'rgba(120,95,60,0.10)';
    a.lineWidth = 1;
    for (let i = 0; i < 240; i++) {
      const x = R() * PW, y = R() * PH, an = R() * TAU, l = 2 + R() * 6;
      a.beginPath(); a.moveTo(x, y); a.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l); a.stroke();
    }
    const eg = a.createRadialGradient(PW / 2, PH / 2, PH * 0.34, PW / 2, PH / 2, PH * 0.66);
    eg.addColorStop(0, 'rgba(0,0,0,0)');
    eg.addColorStop(1, 'rgba(96,70,35,0.20)');
    a.fillStyle = eg;
    a.fillRect(0, 0, PW, PH);
    this.drawArtwork(a);
    a.globalCompositeOperation = 'destination-in';
    a.drawImage(this.mask, 0, 0);
    a.globalCompositeOperation = 'source-over';
  }

  drawArtwork(a) {
    a.save();
    a.strokeStyle = 'rgba(66,50,32,0.85)';
    a.fillStyle = 'rgba(66,50,32,0.85)';
    a.lineWidth = 3;
    a.lineCap = 'round';
    a.lineJoin = 'round';
    // branch
    a.beginPath();
    a.moveTo(PW * 0.16, PH * 0.66);
    a.bezierCurveTo(PW * 0.30, PH * 0.52, PW * 0.35, PH * 0.40, PW * 0.56, PH * 0.24);
    a.stroke();
    a.lineWidth = 2.2;
    const leaf = (x, y, an, s) => {
      a.save(); a.translate(x, y); a.rotate(an);
      a.beginPath(); a.moveTo(0, 0);
      a.quadraticCurveTo(s * 0.5, -s * 0.42, s, 0);
      a.quadraticCurveTo(s * 0.5, s * 0.42, 0, 0);
      a.closePath(); a.stroke();
      a.beginPath(); a.moveTo(0, 0); a.lineTo(s * 0.8, 0); a.stroke();
      a.restore();
    };
    leaf(PW * 0.24, PH * 0.585, -0.9, PW * 0.10);
    leaf(PW * 0.31, PH * 0.50, 0.5, PW * 0.11);
    leaf(PW * 0.38, PH * 0.42, -1.1, PW * 0.10);
    leaf(PW * 0.47, PH * 0.32, 0.4, PW * 0.11);
    // bird
    const bx = PW * 0.60, by = PH * 0.20;
    a.lineWidth = 2.5;
    a.beginPath(); a.ellipse(bx, by, PW * 0.055, PW * 0.040, -0.2, 0, TAU); a.stroke();
    a.beginPath(); a.arc(bx + PW * 0.055, by - PW * 0.032, PW * 0.023, 0, TAU); a.stroke();
    a.beginPath();
    a.moveTo(bx + PW * 0.075, by - PW * 0.035);
    a.lineTo(bx + PW * 0.102, by - PW * 0.028);
    a.lineTo(bx + PW * 0.075, by - PW * 0.021);
    a.closePath(); a.fill();
    a.beginPath(); a.arc(bx + PW * 0.058, by - PW * 0.038, 1.8, 0, TAU); a.fill();
    a.beginPath(); a.moveTo(bx - PW * 0.01, by);
    a.quadraticCurveTo(bx - PW * 0.05, by + PW * 0.012, bx - PW * 0.075, by - PW * 0.01);
    a.stroke();
    for (const [fx, fy] of [[0.20, 0.62], [0.225, 0.645], [0.245, 0.615]]) {
      a.beginPath(); a.arc(PW * fx, PH * fy, 4.5, 0, TAU); a.fill();
    }
    // text-like squiggle rows (deliberately unreadable — audience can't read)
    a.lineWidth = 2.2;
    a.strokeStyle = 'rgba(66,50,32,0.72)';
    const R = mulberry32(4242);
    for (let r = 0; r < 4; r++) {
      const y = PH * (0.76 + r * 0.052);
      let x = PW * 0.13;
      while (x < PW * 0.86) {
        const w = PW * (0.05 + R() * 0.06);
        a.beginPath(); a.moveTo(x, y);
        const seg = 3 + ((R() * 3) | 0);
        for (let s = 1; s <= seg; s++) {
          a.quadraticCurveTo(x + w * (s - 0.5) / seg, y + (R() - 0.5) * 7, x + w * s / seg, y + (R() - 0.5) * 3);
        }
        a.stroke();
        x += w + PW * 0.025;
      }
    }
    a.restore();
  }

  buildSinks() {
    const id = this.mask.getContext('2d').getImageData(0, 0, PW, PH).data;
    for (let gy = 0; gy < GH; gy++) {
      for (let gx = 0; gx < GW; gx++) {
        let sum = 0, cnt = 0;
        for (let y = gy * CELL; y < Math.min(PH, (gy + 1) * CELL); y += 4) {
          for (let x = gx * CELL; x < Math.min(PW, (gx + 1) * CELL); x += 4) {
            sum += id[(y * PW + x) * 4 + 3]; cnt++;
          }
        }
        const al = sum / cnt / 255;
        this.cellA[gy * GW + gx] = al;
        const u = (gx + 0.5) * CELL / PW, v = (gy + 0.5) * CELL / PH;
        if (al < 0.82 && u > 0.035 && u < 0.965 && v > 0.03 && v < 0.97) {
          let best = null, bd = 1e9;
          for (const d of this.damages) {
            const dd = Math.hypot(u - d.cx, (v - d.cy) * (PH / PW));
            if (dd < bd) { bd = dd; best = d; }
          }
          if (best && bd < 0.34) this.sinks.push({ u, v, cap: 1 - al, got: 0, d: best });
        }
      }
    }
    const tot = this.sinks.reduce((s, k) => s + k.cap, 0) || 1;
    for (const k of this.sinks) { k.cap = k.cap / tot * CAP_TOTAL; k.d.cap += k.cap; }
  }

  // permeability 0..1 — high where paper is missing, drops as deposit builds
  permAt(u, v) {
    const gx = clamp((u * PW / CELL) | 0, 0, GW - 1);
    const gy = clamp((v * PH / CELL) | 0, 0, GH - 1);
    const i = gy * GW + gx;
    return clamp(1 - this.cellA[i] - this.cellDep[i] * 0.06, 0, 1);
  }

  addDeposit(u, v, col, veil = false) {
    const c = this.deposit.getContext('2d');
    const x = u * PW, y = v * PH;
    c.strokeStyle = col;
    c.lineCap = 'round';
    const n = veil ? 2 : 3;
    for (let i = 0; i < n; i++) {
      const an = Math.random() * TAU, l = veil ? 5 : 5 + Math.random() * 6;
      c.globalAlpha = veil ? 0.05 : 0.16 + Math.random() * 0.12;
      c.lineWidth = veil ? 1 : 1.1 + Math.random() * 1.1;
      const jx = x + (Math.random() - 0.5) * 10, jy = y + (Math.random() - 0.5) * 10;
      c.beginPath();
      c.moveTo(jx - Math.cos(an) * l, jy - Math.sin(an) * l);
      c.quadraticCurveTo(jx + (Math.random() - 0.5) * 4, jy + (Math.random() - 0.5) * 4,
        jx + Math.cos(an) * l, jy + Math.sin(an) * l);
      c.stroke();
    }
    c.globalAlpha = 1;
    const gx = clamp((u * PW / CELL) | 0, 0, GW - 1);
    const gy = clamp((v * PH / CELL) | 0, 0, GH - 1);
    this.cellDep[gy * GW + gx] += veil ? 0.3 : 1;
    this.dirty = true;
  }

  // when one deficit reaches full, its thin membrane closes: a soft pulp
  // fill clipped to the damage shape (still per-damage & gradual, not a swap)
  sealDamage(d, col = '#ece2c8') {
    const c = this.deposit.getContext('2d');
    c.save();
    c.clip(d.path);
    c.globalAlpha = 0.5;
    c.fillStyle = col;
    c.fill(d.path);
    // fiber texture inside the membrane
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [x, y] of d.pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    c.lineCap = 'round';
    for (let i = 0; i < 50; i++) {
      const x = x0 + Math.random() * (x1 - x0), y = y0 + Math.random() * (y1 - y0);
      const an = Math.random() * TAU, l = 4 + Math.random() * 7;
      c.globalAlpha = 0.10 + Math.random() * 0.12;
      c.lineWidth = 1 + Math.random() * 1.2;
      c.strokeStyle = col;
      c.beginPath();
      c.moveTo(x - Math.cos(an) * l, y - Math.sin(an) * l);
      c.lineTo(x + Math.cos(an) * l, y + Math.sin(an) * l);
      c.stroke();
    }
    c.restore();
    this.dirty = true;
  }

  fillRatio() {
    let got = 0;
    for (const k of this.sinks) got += Math.min(k.got, k.cap);
    return got / CAP_TOTAL;
  }

  pageImg(wet) {
    wet = clamp(wet, 0, 1);
    if (this.dirty || Math.abs(wet - this.compWet) > 0.03) {
      this.compWet = wet;
      this.dirty = false;
      const p = this.page.getContext('2d');
      p.clearRect(0, 0, PW, PH);
      p.drawImage(this.art, 0, 0);
      p.drawImage(this.deposit, 0, 0);
      if (wet > 0.01) {
        p.globalCompositeOperation = 'source-atop';
        p.fillStyle = `rgba(58,46,26,${0.30 * wet})`;
        p.fillRect(0, 0, PW, PH);
        p.fillStyle = `rgba(130,160,175,${0.10 * wet})`;
        p.fillRect(0, 0, PW, PH);
        p.globalCompositeOperation = 'source-over';
      }
    }
    return this.page;
  }

  // stroke damage outlines (page-space paths) into a scene context
  strokeDamages(ctx, rect, style, width, onlyUndone = false) {
    ctx.save();
    ctx.translate(rect.x, rect.y);
    ctx.scale(rect.w / PW, rect.h / PH);
    ctx.strokeStyle = style;
    ctx.lineWidth = width * PW / rect.w;
    for (const d of this.damages) {
      if (onlyUndone && d.done) continue;
      ctx.stroke(d.path);
    }
    ctx.restore();
  }
}
