'use strict';
(function (PPG) {
  const U = PPG.util;

  // flower head position in world space, following the flower's sway
  function headWorld(f, t) {
    const a = PPG.flower.swayAngle(f, t);
    const b = f.pts[0];
    const dx = f.head.x - b.x, dy = f.head.y - b.y;
    const ca = Math.cos(a), sa = Math.sin(a);
    return { x: b.x + dx * ca - dy * sa, y: b.y + dx * sa + dy * ca };
  }

  function cubic(a, c1, c2, b, t) {
    const it = 1 - t;
    return it * it * it * a + 3 * it * it * t * c1 + 3 * it * t * t * c2 + t * t * t * b;
  }

  // ============================ Butterfly ============================
  class Butterfly {
    constructor(x, y, hue) {
      this.x = x; this.y = y;
      this.hue = hue;
      this.size = 9 + Math.random() * 4;
      this.state = 'roam';
      this.roamA = Math.random() * U.TAU;
      this.anchor = { x, y };
      this.ang = -Math.PI / 2;
      this.flapPh = Math.random() * 7;
      this.target = null;
      this.path = null;
      this.sitUntil = 0;
      this.roamUntil = 0;
      this.onArrive = null;
      this.lastSpark = 0;
    }

    flyTo(f, t, onArrive) {
      const h = headWorld(f, t);
      this.target = f;
      this.onArrive = onArrive || null;
      const d = U.dist(this.x, this.y, h.x, h.y);
      const dur = U.clamp(d / 150, 0.9, 3.2);
      const midx = (this.x + h.x) / 2;
      const off = (Math.random() - 0.5) * 120;
      this.path = {
        x0: this.x, y0: this.y,
        c1x: midx + off, c1y: Math.min(this.y, h.y) - 70 - Math.random() * 60,
        c2x: h.x + off * 0.4, c2y: h.y - 60,
        t0: t, dur
      };
      this.state = 'fly';
    }

    update(dt, t, env) {
      this.flapPh += dt * (this.state === 'sit' ? 7 : 26);
      if (this.state === 'fly') {
        const P = this.path;
        const h = this.target ? headWorld(this.target, t) : { x: P.c2x, y: P.c2y };
        const u = U.clamp((t - P.t0) / P.dur, 0, 1);
        const ue = U.smoothstep(u);
        const bob = Math.sin(t * 9) * 3 * (1 - ue);
        const nx = cubic(P.x0, P.c1x, P.c2x, h.x, ue);
        const ny = cubic(P.y0, P.c1y, P.c2y, h.y - 5, ue) + bob;
        if (Math.hypot(nx - this.x, ny - this.y) > 0.1) {
          this.ang = Math.atan2(ny - this.y, nx - this.x);
        }
        this.x = nx; this.y = ny;
        if (t - this.lastSpark > 0.08 && PPG.quality.particleMul > 0.3) {
          this.lastSpark = t;
          env.spark(this.x, this.y, this.hue);
        }
        if (u >= 1) {
          this.state = 'sit';
          this.sitUntil = t + 2.5 + Math.random() * 4;
          if (this.onArrive) { const cb = this.onArrive; this.onArrive = null; cb(this.target); }
        }
      } else if (this.state === 'sit') {
        if (!this.target || env.flowers.indexOf(this.target) < 0) {
          this.state = 'roam';
          this.roamUntil = t + 3;
          this.anchor = { x: this.x, y: this.y - 60 };
          this.target = null;
        } else {
          const h = headWorld(this.target, t);
          const k = Math.min(1, dt * 10);
          this.x = U.lerp(this.x, h.x, k);
          this.y = U.lerp(this.y, h.y - 6 - Math.sin(t * 2 + this.flapPh) * 1.5, k);
          this.ang = U.lerpAngle(this.ang, -Math.PI / 2, Math.min(1, dt * 4));
          if (t > this.sitUntil) {
            const fl = env.flowers.filter(f => f !== this.target && f.sprite);
            if (fl.length && Math.random() < 0.8) {
              this.flyTo(fl[Math.floor(Math.random() * fl.length)], t, env.onLand);
            } else {
              this.state = 'roam';
              this.roamUntil = t + 3 + Math.random() * 3;
              this.anchor = { x: this.x, y: this.y - 60 };
            }
          }
        }
      } else { // roam
        this.roamA += dt * (0.7 + Math.sin(t * 0.6) * 0.3);
        const rx = this.anchor.x + Math.cos(this.roamA) * 70 + Math.sin(t * 1.7) * 20;
        const ry = this.anchor.y + Math.sin(this.roamA * 1.4) * 40 + Math.sin(t * 2.3) * 8;
        if (Math.hypot(rx - this.x, ry - this.y) > 0.5) {
          this.ang = U.lerpAngle(this.ang, Math.atan2(ry - this.y, rx - this.x), Math.min(1, dt * 5));
        }
        const k = Math.min(1, dt * 2.2);
        this.x = U.lerp(this.x, rx, k);
        this.y = U.lerp(this.y, ry, k);
        const fl = env.flowers.filter(f => f.sprite);
        if (t > this.roamUntil && fl.length) {
          this.flyTo(fl[Math.floor(Math.random() * fl.length)], t, env.onLand);
        }
      }
    }

    draw(ctx, t) {
      const flap = Math.abs(Math.sin(this.flapPh));
      const wsx = 0.30 + 0.70 * flap;
      const s = this.size;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.ang + Math.PI / 2);
      // wings
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side * wsx, 1);
        const g = ctx.createLinearGradient(0, 0, s * 1.7, 0);
        g.addColorStop(0, U.hsla(this.hue, 75, 74, 0.95));
        g.addColorStop(1, U.hsla(this.hue + 35, 80, 58, 0.95));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.15);
        ctx.bezierCurveTo(s * 0.9, -s * 1.15, s * 1.85, -s * 0.7, s * 1.5, -s * 0.05);
        ctx.bezierCurveTo(s * 1.2, s * 0.25, s * 0.5, s * 0.15, s * 0.1, -s * 0.05);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(s * 0.1, s * 0.1);
        ctx.bezierCurveTo(s * 1.05, s * 0.15, s * 1.1, s * 0.95, s * 0.55, s * 1.05);
        ctx.bezierCurveTo(s * 0.2, s * 1.1, s * 0.05, s * 0.5, s * 0.08, s * 0.15);
        ctx.closePath();
        ctx.fill();
        // white spots
        ctx.fillStyle = 'rgba(255,255,255,0.75)';
        ctx.beginPath(); ctx.arc(s * 0.95, -s * 0.45, s * 0.16, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(s * 0.6, s * 0.5, s * 0.11, 0, U.TAU); ctx.fill();
        // wing edge
        ctx.strokeStyle = U.hsla(this.hue + 40, 60, 40, 0.45);
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(s * 0.1, -s * 0.15);
        ctx.bezierCurveTo(s * 0.9, -s * 1.15, s * 1.85, -s * 0.7, s * 1.5, -s * 0.05);
        ctx.stroke();
        ctx.restore();
      }
      // body
      ctx.fillStyle = 'hsla(25,40%,28%,1)';
      ctx.beginPath(); ctx.ellipse(0, 0, s * 0.16, s * 0.55, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -s * 0.6, s * 0.18, 0, U.TAU); ctx.fill();
      // antennae
      ctx.strokeStyle = 'hsla(25,40%,28%,0.9)';
      ctx.lineWidth = 0.9;
      for (const sd of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(0, -s * 0.7);
        ctx.quadraticCurveTo(sd * s * 0.3, -s * 1.05, sd * s * 0.45, -s * 1.18);
        ctx.stroke();
        ctx.fillStyle = 'hsla(25,40%,28%,0.9)';
        ctx.beginPath(); ctx.arc(sd * s * 0.45, -s * 1.18, 1, 0, U.TAU); ctx.fill();
      }
      ctx.restore();
    }
  }

  // ============================ Ladybug ============================
  class Ladybug {
    constructor(f) {
      this.f = f;
      this.s = 0.02;
      this.state = 'crawl';
      this.until = 0;
      this.alpha = 1;
      this.x = f.pts[0].x; this.y = f.pts[0].y;
      this.ang = -Math.PI / 2;
      this.vx = 0; this.vy = 0;
    }
    update(dt, t, flowers) {
      if (flowers.indexOf(this.f) < 0 && this.state !== 'fly') {
        this.state = 'fly'; this.vx = 40; this.vy = -80;
      }
      if (this.state === 'crawl') {
        this.s += dt * 0.085;
        if (this.s >= 0.8) { this.state = 'pause'; this.until = t + 1.5; }
      } else if (this.state === 'pause') {
        if (t > this.until) {
          this.state = 'fly';
          this.vx = 30 + Math.random() * 40;
          this.vy = -70 - Math.random() * 30;
        }
      } else {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
        this.alpha -= dt * 1.1;
        if (this.alpha <= 0) return false;
      }
      if (this.state !== 'fly') {
        const f = this.f;
        const p = PPG.flower.pointAt(f, this.s);
        const p2 = PPG.flower.pointAt(f, Math.min(1, this.s + 0.04));
        const a = PPG.flower.swayAngle(f, t);
        const b = f.pts[0];
        const ca = Math.cos(a), sa = Math.sin(a);
        this.x = b.x + (p.x - b.x) * ca - (p.y - b.y) * sa;
        this.y = b.y + (p.x - b.x) * sa + (p.y - b.y) * ca;
        if (Math.hypot(p2.x - p.x, p2.y - p.y) > 0.1) {
          this.ang = Math.atan2(p2.y - p.y, p2.x - p.x);
        }
      }
      return true;
    }
    draw(ctx) {
      const r = 4.6;
      ctx.save();
      ctx.globalAlpha = Math.max(0, this.alpha);
      ctx.translate(this.x, this.y);
      ctx.rotate(this.ang);
      // shell
      const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.2, 0, 0, r * 1.2);
      g.addColorStop(0, 'hsla(8,85%,62%,1)');
      g.addColorStop(1, 'hsla(0,85%,42%,1)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, r, r * 0.82, 0, 0, U.TAU);
      ctx.fill();
      // wing split
      ctx.strokeStyle = 'rgba(40,10,10,0.7)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(-r * 0.85, 0); ctx.lineTo(r * 0.5, 0);
      ctx.stroke();
      // dots
      ctx.fillStyle = 'rgba(30,10,10,0.9)';
      for (const [dx, dy] of [[-0.35, -0.4], [-0.35, 0.4], [0.15, -0.38], [0.15, 0.38]]) {
        ctx.beginPath();
        ctx.arc(dx * r, dy * r, r * 0.19, 0, U.TAU);
        ctx.fill();
      }
      // head
      ctx.fillStyle = 'rgba(25,12,12,1)';
      ctx.beginPath();
      ctx.arc(r * 0.85, 0, r * 0.42, 0, U.TAU);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(r * 1.0, -r * 0.2, r * 0.1, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(r * 1.0, r * 0.2, r * 0.1, 0, U.TAU); ctx.fill();
      ctx.restore();
    }
  }

  PPG.creatures = { Butterfly, Ladybug, headWorld };
})(window.PPG);
