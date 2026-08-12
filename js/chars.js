/* にじいろタウン - 住民・蝶・小鳥 */
window.NT = window.NT || {};
(function () {
  const U = NT.U;

  /* ============ 住民 ============ */
  const SCHEMES = [
    { dress1: '#ffb1d8', dress2: '#ff7fb8', hair: '#8a5a3b', ribbon: '#ffe27a' }, // ピンクの子
    { dress1: '#a9e8d8', dress2: '#5fc9ac', hair: '#4a4a5e', ribbon: '#ff9ecb' }, // ミントの子（店員）
    { dress1: '#cdb3ff', dress2: '#a07ce8', hair: '#e8b04a', ribbon: '#9fd8ff' }, // ラベンダーの子
    { dress1: '#ffd9a8', dress2: '#ffb060', hair: '#7a4a2e', ribbon: '#a9e8b8' }  // クリームの子
  ];

  class Resident {
    constructor(id, x, y, schemeIdx, opts = {}) {
      this.id = id;
      this.x = x; this.y = y;
      this.s = opts.s || 1;
      this.scheme = SCHEMES[schemeIdx % SCHEMES.length];
      this.mood = 'normal';   // normal | trouble | joy | eat | point
      this.moodT = 0;
      this.dir = 1;
      this.walkPhase = 0;
      this.moving = false;
      this.target = null;
      this.speed = opts.speed || 95;
      this.visible = true;
      this.blinkT = Math.random() * 3;
      this.bob = Math.random() * U.TAU;
      this.hat = opts.hat || null; // 'clerk'
      this.wander = opts.wander || null; // {points:[{x,y}], wait:[min,max]}
      this.wanderWait = 0;
      this.scripted = false;
    }

    goTo(x, y) {
      this.target = { x, y };
      this.moving = true;
      this.dir = x < this.x ? -1 : 1;
    }

    update(dt, t) {
      this.moodT += dt;
      this.blinkT -= dt;
      if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;

      if (this.moving && this.target) {
        const dx = this.target.x - this.x, dy = this.target.y - this.y;
        const d = Math.hypot(dx, dy);
        const step = this.speed * dt;
        if (d <= step) {
          this.x = this.target.x; this.y = this.target.y;
          this.moving = false; this.target = null;
        } else {
          this.x += dx / d * step;
          this.y += dy / d * step;
          this.dir = dx < 0 ? -1 : 1;
          this.walkPhase += dt * 9;
        }
      } else if (!this.scripted && this.wander) {
        this.wanderWait -= dt;
        if (this.wanderWait <= 0) {
          const p = this.wander.points[Math.floor(Math.random() * this.wander.points.length)];
          this.goTo(p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 30);
          this.wanderWait = 2 + Math.random() * 5;
        }
      }
    }

    draw(ctx, t) {
      if (!this.visible) return;
      const s = this.s;
      const sc = this.scheme;
      const jump = this.mood === 'joy' ? Math.abs(Math.sin(this.moodT * 7)) * 14 * s : 0;
      const bobY = this.moving ? Math.abs(Math.sin(this.walkPhase)) * 3.4 * s : Math.sin(t * 2.2 + this.bob) * 1.6 * s;
      const x = this.x, y = this.y - bobY - jump;

      ctx.save();
      // 接地影
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = '#5a4a7a';
      ctx.beginPath();
      ctx.ellipse(this.x, this.y + 3 * s, 17 * s * (1 - jump / (60 * s)), 5.5 * s, 0, 0, U.TAU);
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.translate(x, y);
      ctx.scale(this.dir * s, s);
      if (this.moving) ctx.rotate(Math.sin(this.walkPhase) * 0.06);
      if (this.mood === 'trouble') ctx.rotate(Math.sin(this.moodT * 3) * 0.05);

      // 足
      const step = this.moving ? Math.sin(this.walkPhase) * 5 : 0;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(120,80,120,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(-5 + step, 1, 4.4, 3, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.ellipse(5 - step, 1, 4.4, 3, 0, 0, U.TAU); ctx.fill(); ctx.stroke();

      // ワンピース（ベル型）
      const dg = ctx.createLinearGradient(0, -30, 0, 0);
      dg.addColorStop(0, sc.dress1);
      dg.addColorStop(1, sc.dress2);
      ctx.fillStyle = dg;
      ctx.beginPath();
      ctx.moveTo(0, -30);
      ctx.bezierCurveTo(-13, -28, -16, -12, -14.5, -1);
      // すそのスカラップ
      for (let i = 0; i < 4; i++) {
        const x0 = -14.5 + i * 7.4, x1 = -14.5 + (i + 1) * 7.4;
        ctx.quadraticCurveTo((x0 + x1) / 2, 4.5, x1, -1);
      }
      ctx.bezierCurveTo(16, -12, 13, -28, 0, -30);
      ctx.closePath();
      ctx.fill();
      // ドレスハイライト
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.ellipse(-5, -19, 4.5, 8, 0.35, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;

      // 腕
      ctx.strokeStyle = '#ffe8d8';
      ctx.lineWidth = 4.6;
      ctx.lineCap = 'round';
      if (this.mood === 'point') {
        ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(17, -34); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-10, -14); ctx.stroke();
      } else if (this.mood === 'joy') {
        const w = Math.sin(this.moodT * 10) * 4;
        ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(15, -33 - w); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-15, -33 + w); ctx.stroke();
      } else if (this.mood === 'eat') {
        ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(9, -32); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-10, -15); ctx.stroke();
      } else {
        const sw = this.moving ? Math.sin(this.walkPhase) * 4 : 0;
        ctx.beginPath(); ctx.moveTo(6, -24); ctx.lineTo(10 + sw * 0.4, -15 + sw); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-6, -24); ctx.lineTo(-10 - sw * 0.4, -15 - sw); ctx.stroke();
      }

      // 頭
      ctx.fillStyle = '#ffeede';
      ctx.beginPath(); ctx.arc(0, -40, 13.5, 0, U.TAU); ctx.fill();
      // 髪
      ctx.fillStyle = sc.hair;
      ctx.beginPath();
      ctx.arc(0, -42, 13.8, Math.PI * 0.95, Math.PI * 2.05);
      ctx.quadraticCurveTo(10, -34, 6, -32.5);
      ctx.quadraticCurveTo(0, -36, -6, -32.5);
      ctx.quadraticCurveTo(-10, -34, -13.5, -40);
      ctx.closePath();
      ctx.fill();
      // おだんご
      ctx.beginPath(); ctx.arc(8, -52, 5.5, 0, U.TAU); ctx.fill();
      ctx.fillStyle = sc.ribbon;
      ctx.beginPath(); ctx.arc(11, -50, 3, 0, U.TAU); ctx.fill();

      // 店員帽子
      if (this.hat === 'clerk') {
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.moveTo(-9, -52);
        ctx.quadraticCurveTo(0, -64, 9, -52);
        ctx.quadraticCurveTo(0, -56, -9, -52);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#ff9ecb';
        ctx.beginPath(); ctx.arc(0, -58, 2.6, 0, U.TAU); ctx.fill();
      }

      // 顔
      const blink = this.blinkT < 0 || this.mood === 'joy';
      ctx.fillStyle = '#4a3a4a';
      if (blink) {
        ctx.strokeStyle = '#4a3a4a';
        ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.arc(4.5, -41, 2.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        ctx.beginPath(); ctx.arc(-4.5, -41, 2.4, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(4.5, -41, 2.1, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(-4.5, -41, 2.1, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(5.2, -41.8, 0.8, 0, U.TAU); ctx.fill();
        ctx.beginPath(); ctx.arc(-3.8, -41.8, 0.8, 0, U.TAU); ctx.fill();
      }
      // ほっぺ
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#ff9db8';
      ctx.beginPath(); ctx.ellipse(8, -37, 2.6, 1.7, 0, 0, U.TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(-8, -37, 2.6, 1.7, 0, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
      // 口
      ctx.strokeStyle = '#c96a7a';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      if (this.mood === 'joy' || this.mood === 'eat') {
        ctx.arc(0, -36.5, 3.2, 0.15, Math.PI - 0.15);
      } else if (this.mood === 'trouble') {
        ctx.arc(0, -33, 2.6, Math.PI + 0.4, U.TAU - 0.4);
      } else {
        ctx.arc(0, -36.5, 2.2, 0.3, Math.PI - 0.3);
      }
      ctx.stroke();
      ctx.restore();

      // ふきだし（ワールド向き固定）
      if (this.mood === 'trouble' || this.mood === 'point') {
        const bx = this.x + 20 * s * this.dir, by = y - 62 * s;
        const pop = Math.min(1, this.moodT * 4);
        const k = U.easeOutBack(pop);
        ctx.save();
        ctx.translate(bx, by);
        ctx.scale(k, k);
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.strokeStyle = '#e8a8c8';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, 13, 0, U.TAU); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(-6 * this.dir, 10);
        ctx.lineTo(-14 * this.dir, 20);
        ctx.lineTo(-1 * this.dir, 12);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = this.mood === 'trouble' ? '#b088c8' : '#ff6fae';
        ctx.font = 'bold 17px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(this.mood === 'trouble' ? '?' : '!', 0, 1);
        ctx.restore();
      }
    }
  }

  /* ============ 蝶 ============ */
  class Butterfly {
    constructor(x, y, hue) {
      this.x = x; this.y = y;
      this.hue = hue != null ? hue : [325, 265, 195, 45][Math.floor(Math.random() * 4)];
      this.phase = Math.random() * U.TAU;
      this.anchor = { x, y };
      this.orbit = 40 + Math.random() * 50;
      this.t0 = Math.random() * 100;
      this.scale = 0.8 + Math.random() * 0.5;
    }
    setAnchor(x, y) { this.anchor = { x, y }; }
    update(dt, t) {
      const tt = t * 0.5 + this.t0;
      const tx = this.anchor.x + Math.cos(tt * 1.3) * this.orbit + Math.sin(tt * 2.7) * 14;
      const ty = this.anchor.y + Math.sin(tt * 1.7) * this.orbit * 0.55 - 30 + Math.cos(tt * 3.1) * 10;
      this.px = this.x; this.py = this.y;
      this.x = U.lerp(this.x, tx, 1 - Math.pow(0.06, dt));
      this.y = U.lerp(this.y, ty, 1 - Math.pow(0.06, dt));
    }
    draw(ctx, t) {
      const flap = Math.sin(t * 16 + this.phase) * 0.75;
      const dir = (this.x - (this.px || this.x)) < 0 ? -1 : 1;
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.scale, this.scale);
      ctx.rotate(dir * 0.12);
      const h = this.hue;
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.scale(side, 1);
        ctx.scale(Math.max(0.22, Math.abs(Math.cos(flap))), 1);
        // 上翅
        let g = ctx.createRadialGradient(7, -4, 1, 7, -4, 12);
        g.addColorStop(0, `hsla(${h},100%,88%,0.95)`);
        g.addColorStop(0.7, `hsla(${h},90%,72%,0.9)`);
        g.addColorStop(1, `hsla(${h},80%,60%,0.85)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(1, 0);
        ctx.bezierCurveTo(4, -12, 16, -14, 15, -5);
        ctx.bezierCurveTo(14.5, 0, 8, 3, 1, 1);
        ctx.closePath(); ctx.fill();
        // 下翅
        g = ctx.createRadialGradient(6, 5, 1, 6, 5, 9);
        g.addColorStop(0, `hsla(${(h + 40) % 360},100%,88%,0.95)`);
        g.addColorStop(1, `hsla(${(h + 40) % 360},85%,64%,0.85)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(1, 2);
        ctx.bezierCurveTo(6, 2, 12, 8, 8, 12);
        ctx.bezierCurveTo(5, 14, 1, 8, 1, 4);
        ctx.closePath(); ctx.fill();
        // 模様
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(10, -6, 2, 0, U.TAU); ctx.fill();
        ctx.restore();
      }
      // 体
      ctx.fillStyle = '#6a5a7a';
      ctx.beginPath(); ctx.ellipse(0, 1, 1.7, 6, 0, 0, U.TAU); ctx.fill();
      ctx.strokeStyle = '#6a5a7a';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(-3, -9, -4.5, -10); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.quadraticCurveTo(3, -9, 4.5, -10); ctx.stroke();
      ctx.restore();
    }
  }

  /* ============ 小鳥（空を横切る） ============ */
  class Bird {
    constructor(worldW, y) {
      this.reset(worldW, y);
      this.active = false;
      this.timer = 4 + Math.random() * 8;
    }
    reset(worldW, y) {
      this.dir = Math.random() < 0.5 ? 1 : -1;
      this.x = this.dir > 0 ? -80 : worldW + 80;
      this.y = y + Math.random() * 160;
      this.speed = 130 + Math.random() * 80;
      this.phase = Math.random() * U.TAU;
      this.worldW = worldW;
    }
    update(dt, t) {
      if (!this.active) {
        this.timer -= dt;
        if (this.timer <= 0) { this.active = true; this.reset(this.worldW, this.y0 || 220); }
        return;
      }
      this.x += this.speed * this.dir * dt;
      this.y += Math.sin(t * 3 + this.phase) * 12 * dt;
      if (this.x < -100 || this.x > this.worldW + 100) {
        this.active = false;
        this.timer = 6 + Math.random() * 12;
      }
    }
    draw(ctx, t) {
      if (!this.active) return;
      const flap = Math.sin(t * 14 + this.phase);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.scale(this.dir, 1);
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = 'rgba(140,150,200,0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 5, 0, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, -2, 3.6, 0, U.TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffb060';
      ctx.beginPath(); ctx.moveTo(9, -2); ctx.lineTo(12.5, -1.2); ctx.lineTo(9, -0.2); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4a3a4a';
      ctx.beginPath(); ctx.arc(7, -3, 0.9, 0, U.TAU); ctx.fill();
      // 翼
      ctx.fillStyle = '#e8f0ff';
      ctx.beginPath();
      ctx.moveTo(-1, -1);
      ctx.quadraticCurveTo(-6, -1 - flap * 8, -10, -2 - flap * 10);
      ctx.quadraticCurveTo(-5, 2, -1, 2);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  NT.chars = { Resident, Butterfly, Bird, SCHEMES };
})();
