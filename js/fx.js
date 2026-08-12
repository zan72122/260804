/* にじいろタウン - パーティクル（ワールド座標） */
window.NT = window.NT || {};
(function () {
  const U = NT.U;
  const MAX = NT.U.reducedMotion ? 90 : 220;
  const pool = [];

  function spawn(p) {
    if (pool.length >= MAX) pool.shift();
    pool.push(p);
  }

  const FX = {};

  // キラキラ星
  FX.sparkle = function (x, y, opts = {}) {
    const n = opts.n || 6;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * U.TAU;
      const sp = (opts.speed || 60) * (0.4 + Math.random() * 0.9);
      spawn({
        kind: 'star', x, y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 30,
        life: 0, max: 0.6 + Math.random() * 0.6,
        r: (opts.r || 5) * (0.6 + Math.random() * 0.8),
        hue: opts.hue != null ? opts.hue : [330, 45, 190, 265][Math.floor(Math.random() * 4)],
        g: 60, spin: Math.random() * U.TAU
      });
    }
  };

  // ふわっと光る丸
  FX.glow = function (x, y, opts = {}) {
    spawn({
      kind: 'glow', x, y, vx: 0, vy: opts.vy || -14,
      life: 0, max: opts.max || 0.9,
      r: opts.r || 16, color: opts.color || 'rgba(255,255,255,0.8)', g: 0
    });
  };

  // ハート
  FX.heart = function (x, y, opts = {}) {
    spawn({
      kind: 'heart', x, y,
      vx: (Math.random() - 0.5) * 30, vy: -55 - Math.random() * 35,
      life: 0, max: 1.1 + Math.random() * 0.4,
      r: opts.r || 9, color: opts.color || '#ff6fae', g: 18,
      wob: Math.random() * U.TAU
    });
  };

  // 花粉・粉砂糖
  FX.dust = function (x, y, opts = {}) {
    spawn({
      kind: 'dot', x, y,
      vx: (Math.random() - 0.5) * (opts.spread || 50),
      vy: -20 - Math.random() * 40,
      life: 0, max: 0.8 + Math.random() * 0.7,
      r: 1.5 + Math.random() * 2.2,
      color: opts.color || '#ffe9a8', g: 30
    });
  };

  // ぽん！のリング
  FX.ring = function (x, y, opts = {}) {
    spawn({
      kind: 'ring', x, y, vx: 0, vy: 0,
      life: 0, max: opts.max || 0.5,
      r: opts.r || 10, r2: opts.r2 || 70,
      color: opts.color || 'rgba(255,255,255,0.9)', g: 0
    });
  };

  FX.crumb = function (x, y, color) {
    spawn({
      kind: 'dot', x, y,
      vx: (Math.random() - 0.5) * 80, vy: -60 - Math.random() * 50,
      life: 0, max: 0.7, r: 2 + Math.random() * 2, color: color || '#f3c98e', g: 260
    });
  };

  FX.update = function (dt) {
    for (let i = pool.length - 1; i >= 0; i--) {
      const p = pool[i];
      p.life += dt;
      if (p.life >= p.max) { pool.splice(i, 1); continue; }
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.wob != null) p.x += Math.sin(p.life * 6 + p.wob) * 22 * dt;
    }
  };

  FX.draw = function (ctx) {
    for (const p of pool) {
      const t = p.life / p.max;
      const a = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      ctx.globalAlpha = Math.max(0, a);
      if (p.kind === 'star') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.spin + p.life * 3);
        ctx.fillStyle = `hsl(${p.hue},95%,78%)`;
        U.starPath(ctx, 0, 0, p.r, 4, 0.42);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        U.starPath(ctx, 0, 0, p.r * 0.45, 4, 0.42);
        ctx.fill();
        ctx.restore();
      } else if (p.kind === 'glow') {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, p.color);
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
      } else if (p.kind === 'heart') {
        ctx.fillStyle = p.color;
        U.heartPath(ctx, p.x, p.y, p.r);
        ctx.fill();
        ctx.globalAlpha *= 0.6;
        ctx.fillStyle = '#fff';
        U.heartPath(ctx, p.x - p.r * 0.22, p.y - p.r * 0.18, p.r * 0.35);
        ctx.fill();
      } else if (p.kind === 'dot') {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
      } else if (p.kind === 'ring') {
        const rr = U.lerp(p.r, p.r2, U.easeOutCubic(t));
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 4 * (1 - t) + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, U.TAU); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  };

  NT.fx = FX;
})();
