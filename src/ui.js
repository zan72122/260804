/* =========================================================================
   ui.js — the only 2D layer: wordless gesture hints drawn over the 3D view.
   Everything is positioned by projecting world points to the screen, so the
   cues stay locked to the objects they refer to.
   ========================================================================= */
'use strict';

const UI = {
  cv: null, ctx: null, W: 0, H: 0, dpr: 1, k: 1,

  init(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
  },
  resize(w, h, dpr) {
    this.W = w; this.H = h; this.dpr = dpr;
    this.cv.width = Math.round(w * dpr); this.cv.height = Math.round(h * dpr);
    this.cv.style.width = w + 'px'; this.cv.style.height = h + 'px';
    this.k = clamp(Math.min(w, h) / 420, 0.85, 2.4);   // hint scale
  },

  p3(p) { const o = [0, 0, 0]; R3.project(p, o); return o; },

  draw(g) {
    const c = this.ctx;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.clearRect(0, 0, this.W, this.H);

    const s = g.s;
    if (g.ring) this.ring(g.ring);
    if (g.hint && s.idle > 0.7) this.hint(g.hint, sat((s.idle - 0.7) / 0.6), g.t);
    if (s.flash > 0.002) {
      c.fillStyle = `rgba(255,248,235,${s.flash * 0.22})`;
      c.fillRect(0, 0, this.W, this.H);
    }
  },

  /* ---------------------------------------------------------------- parts */
  hand(x, y, rot, a, scale) {
    const c = this.ctx, k = (scale || 1) * this.k;
    c.save();
    c.translate(x, y); c.rotate(rot || 0); c.scale(k, k);
    c.globalAlpha = a;
    c.fillStyle = 'rgba(20,12,8,0.30)';
    this.handPath(c, 2.5, 4); c.fill();
    const grd = c.createLinearGradient(0, -34, 0, 40);
    grd.addColorStop(0, '#ffeada'); grd.addColorStop(1, '#e3b48f');
    c.fillStyle = grd;
    this.handPath(c, 0, 0); c.fill();
    c.strokeStyle = 'rgba(120,72,44,0.55)'; c.lineWidth = 1.6; c.stroke();
    c.restore();
  },
  handPath(c, ox, oy) {
    c.beginPath();
    c.moveTo(ox + 0, oy - 30);
    c.quadraticCurveTo(ox + 8, oy - 30, ox + 8, oy - 16);
    c.lineTo(ox + 8, oy - 4);
    c.quadraticCurveTo(ox + 20, oy - 8, ox + 22, oy + 2);
    c.quadraticCurveTo(ox + 24, oy + 22, ox + 14, oy + 32);
    c.quadraticCurveTo(ox + 6, oy + 40, ox - 6, oy + 38);
    c.quadraticCurveTo(ox - 20, oy + 34, ox - 22, oy + 16);
    c.lineTo(ox - 22, oy + 2);
    c.quadraticCurveTo(ox - 20, oy - 6, ox - 8, oy - 2);
    c.lineTo(ox - 8, oy - 16);
    c.quadraticCurveTo(ox - 8, oy - 30, ox + 0, oy - 30);
    c.closePath();
  },
  arrow(x0, y0, x1, y1, a, bow) {
    const c = this.ctx, k = this.k;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0;
    const L = Math.hypot(dx, dy) || 1;
    const nx = -dy / L, ny = dx / L;
    const cx = mx + nx * (bow || 0) * L * 0.22, cy = my + ny * (bow || 0) * L * 0.22;
    c.save();
    c.globalAlpha = a;
    c.strokeStyle = 'rgba(255,236,170,0.95)';
    c.lineWidth = 7 * k; c.lineCap = 'round';
    c.setLineDash([2 * k, 17 * k]);
    c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke();
    c.setLineDash([]);
    const ang = Math.atan2(y1 - cy, x1 - cx);
    c.translate(x1, y1); c.rotate(ang);
    c.fillStyle = 'rgba(255,236,170,0.95)';
    c.beginPath();
    c.moveTo(15 * k, 0); c.lineTo(-9 * k, -12 * k); c.lineTo(-9 * k, 12 * k);
    c.closePath(); c.fill();
    c.restore();
  },

  hint(h, a, t) {
    const c = this.ctx, k = this.k;
    if (h.type === 'tap') {
      const p = this.p3(h.p);
      const ph = (t % 1.3) / 1.3;
      c.save(); c.globalAlpha = a * (1 - ph) * 0.8;
      c.strokeStyle = '#ffeaa0'; c.lineWidth = 5 * k;
      c.beginPath(); c.arc(p[0], p[1], (18 + ph * 42) * k, 0, TAU); c.stroke();
      c.restore();
      this.hand(p[0] + 14 * k, p[1] + 34 * k + Math.sin(t * 4) * 5 * k, 0.25, a * 0.9, 1);
    } else if (h.type === 'drag') {
      const f = this.p3(h.from), g = this.p3(h.to);
      this.arrow(f[0], f[1], g[0], g[1], a, 0.5);
      const ph = easeOutCubic((t % 1.6) / 1.6);
      this.hand(lerp(f[0], g[0], ph) + 12 * k, lerp(f[1], g[1], ph) + 26 * k, 0, a * 0.9, 1);
    } else if (h.type === 'press') {
      const f = this.p3(h.from), g = this.p3(h.to);
      this.arrow(f[0], f[1], g[0], g[1], a, 0);
      const ph = easeInCubic((t % 1.3) / 1.3);
      this.hand(lerp(f[0], g[0], ph) + 12 * k, lerp(f[1], g[1], ph) + 26 * k, 0, a * 0.9, 1);
    } else if (h.type === 'sweep') {
      const p = this.p3(h.p);
      const l = this.p3([h.p[0] - h.w, h.p[1], h.p[2]]);
      const r = this.p3([h.p[0] + h.w, h.p[1], h.p[2]]);
      this.arrow(l[0], l[1] - 40 * k, r[0], r[1] - 40 * k, a, 0.35);
      const ph = (t % 1.6) / 1.6;
      const x = lerp(l[0], r[0], 0.5 + Math.sin(ph * TAU) * 0.5);
      const y = lerp(l[1], r[1], 0.5 + Math.sin(ph * TAU) * 0.5);
      this.hand(x + 10 * k, y + 30 * k, 0, a * 0.9, 1);
    } else if (h.type === 'twist') {
      // an arc in the horizontal plane around the group axis
      const R = 190;
      const seg = 16;
      const av = Math.max(a, 0.55) * (h.fade === undefined ? 1 : h.fade);
      if (av < 0.03) return;
      c.save(); c.globalAlpha = av; c.lineCap = 'round';
      let prev = null;
      for (let i = 0; i <= seg; i++) {
        const u = i / seg;
        const ang = lerp(h.from, h.to, u);
        const w = this.p3([h.p[0] + Math.sin(ang) * R, h.p[1], h.p[2] + Math.cos(ang) * R]);
        if (prev) {
          c.strokeStyle = `rgba(255,236,170,${0.25 + u * 0.72})`;
          c.lineWidth = (3 + u * 10) * k;
          c.beginPath(); c.moveTo(prev[0], prev[1]); c.lineTo(w[0], w[1]); c.stroke();
        }
        prev = w;
      }
      const e0 = this.p3([h.p[0] + Math.sin(h.to) * R, h.p[1], h.p[2] + Math.cos(h.to) * R]);
      const e1 = this.p3([h.p[0] + Math.sin(h.to - 0.12) * R, h.p[1], h.p[2] + Math.cos(h.to - 0.12) * R]);
      const ang = Math.atan2(e0[1] - e1[1], e0[0] - e1[0]);
      c.translate(e0[0], e0[1]); c.rotate(ang);
      c.fillStyle = 'rgba(255,236,170,0.95)';
      c.beginPath(); c.moveTo(17 * k, 0); c.lineTo(-10 * k, -14 * k); c.lineTo(-10 * k, 14 * k);
      c.closePath(); c.fill();
      c.restore();
      const ph = easeOutCubic((t % 1.7) / 1.7);
      const ha = lerp(h.from, h.to, ph);
      const hw = this.p3([h.p[0] + Math.sin(ha) * (R + 30), h.p[1], h.p[2] + Math.cos(ha) * (R + 30)]);
      this.hand(hw[0], hw[1] + 24 * k, 0, av * 0.9, 1);
    } else if (h.type === 'circle') {
      const p = this.p3(h.p);
      const e = this.p3([h.p[0] + h.r, h.p[1], h.p[2]]);
      const rad = Math.abs(e[0] - p[0]);
      c.save(); c.globalAlpha = a * 0.55;
      c.strokeStyle = '#fff3c8'; c.lineWidth = 4 * k;
      c.setLineDash([7 * k, 9 * k]);
      c.beginPath(); c.ellipse(p[0], p[1], rad, rad * 0.42, 0, 0, TAU); c.stroke();
      c.restore();
      const ph = (t % 1.8) / 1.8;
      this.hand(p[0] + Math.sin(ph * TAU) * rad * 0.5 + 10 * k,
                p[1] + Math.cos(ph * TAU) * rad * 0.18 + 28 * k, 0, a * 0.9, 1);
    } else if (h.type === 'pull') {
      const near = this.p3([h.p[0], h.p[1], h.p[2] + h.r * 1.9]);
      const far = this.p3([h.p[0], h.p[1], h.p[2] - h.r * 1.7]);
      const pulse = 0.5 + Math.sin(t * 4) * 0.28;
      this.arrow(near[0], near[1], far[0], far[1], Math.max(a, pulse), 0);
      const ph = easeOutCubic((t % 1.5) / 1.5);
      this.hand(lerp(near[0], far[0], ph) + 12 * this.k,
                lerp(near[1], far[1], ph) + 24 * this.k, 0, 0.8, 1);
    }
  },

  ring(r) {
    const c = this.ctx, k = this.k;
    const p = this.p3(r.p);
    const rad = 46 * k;
    c.save();
    c.lineCap = 'round';
    c.strokeStyle = 'rgba(40,24,16,0.35)'; c.lineWidth = 9 * k;
    c.beginPath(); c.arc(p[0], p[1], rad, 0, TAU); c.stroke();
    c.strokeStyle = '#fff3c4'; c.lineWidth = 9 * k;
    c.beginPath(); c.arc(p[0], p[1], rad, -Math.PI / 2, -Math.PI / 2 + r.v * TAU); c.stroke();
    c.strokeStyle = '#ffc94d'; c.lineWidth = 4 * k;
    c.beginPath(); c.arc(p[0], p[1], rad, -Math.PI / 2, -Math.PI / 2 + r.v * TAU); c.stroke();
    const a = -Math.PI / 2 + r.v * TAU;
    c.fillStyle = '#fffdf2';
    c.beginPath(); c.arc(p[0] + Math.cos(a) * rad, p[1] + Math.sin(a) * rad, 7 * k, 0, TAU); c.fill();
    c.restore();
  }
};
