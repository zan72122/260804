/* =========================================================
   ui.js — 文字を使わないUI（絵記号・ゴーストハンド・進み具合）
   4歳児が読めない前提で、すべて絵と動きで示す。
   ========================================================= */
(function (global) {
  'use strict';
  const UI = {};

  /* ---------- 丸ボタン ---------- */
  UI.button = function (ctx, b, time) {
    if (b.hidden) return;
    const pulse = b.pulse ? 1 + Math.sin(time * 3.4) * 0.055 : 1;
    const r = b.r * pulse * (b.press ? 0.93 : 1);
    ctx.save();
    ctx.translate(b.x, b.y);

    if (b.pulse) {
      const k = (time * 0.9) % 1;
      ctx.strokeStyle = `rgba(255,255,255,${(0.42 * (1 - k)).toFixed(3)})`;
      ctx.lineWidth = Math.max(3, r * 0.07);
      ctx.beginPath(); ctx.arc(0, 0, r * (1 + k * 0.30), 0, U.TAU); ctx.stroke();
    }
    /* 影 */
    ctx.fillStyle = 'rgba(90,56,26,0.28)';
    ctx.beginPath(); ctx.arc(0, r * 0.10, r, 0, U.TAU); ctx.fill();
    /* 本体 */
    const g = ctx.createLinearGradient(0, -r, 0, r);
    const c = b.color || ['#fff6e6', '#f6dcc0'];
    g.addColorStop(0, c[0]); g.addColorStop(1, c[1]);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU); ctx.fill();
    ctx.strokeStyle = b.ring || 'rgba(233,150,120,0.85)';
    ctx.lineWidth = Math.max(3, r * 0.09);
    ctx.beginPath(); ctx.arc(0, 0, r * 0.97, 0, U.TAU); ctx.stroke();

    ctx.save();
    ctx.scale(r / 50, r / 50);
    UI.icon(ctx, b.icon, time, b);
    ctx.restore();
    ctx.restore();
  };

  UI.hit = function (b, x, y, slop) {
    if (!b || b.hidden) return false;
    return U.dist(b.x, b.y, x, y) <= b.r * (b.hitScale || 1.45) + (slop || 0);
  };

  /* ---------- 絵記号（50pxを基準に描く） ---------- */
  UI.icon = function (ctx, name, time, b) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    switch (name) {
      case 'home':
        ctx.fillStyle = '#c4674f';
        ctx.beginPath();
        ctx.moveTo(0, -26); ctx.lineTo(28, 0); ctx.lineTo(20, 0);
        ctx.lineTo(20, 26); ctx.lineTo(-20, 26); ctx.lineTo(-20, 0);
        ctx.lineTo(-28, 0); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#fff4e4';
        U.roundRect(ctx, -8, 6, 16, 20, 3); ctx.fill();
        break;

      case 'replay':
        ctx.strokeStyle = '#c4674f'; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(0, 0, 20, 0.55, 5.4); ctx.stroke();
        ctx.fillStyle = '#c4674f';
        ctx.save(); ctx.translate(16, -13); ctx.rotate(0.5);
        ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(13, 4); ctx.lineTo(-11, 6); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;

      case 'sound':
      case 'mute':
        ctx.fillStyle = '#c4674f';
        ctx.beginPath();
        ctx.moveTo(-20, -8); ctx.lineTo(-8, -8); ctx.lineTo(4, -22);
        ctx.lineTo(4, 22); ctx.lineTo(-8, 8); ctx.lineTo(-20, 8);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#c4674f'; ctx.lineWidth = 5;
        if (name === 'sound') {
          ctx.beginPath(); ctx.arc(6, 0, 13, -0.9, 0.9); ctx.stroke();
          ctx.beginPath(); ctx.arc(6, 0, 22, -0.9, 0.9); ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.moveTo(12, -12); ctx.lineTo(28, 12);
          ctx.moveTo(28, -12); ctx.lineTo(12, 12);
          ctx.stroke();
        }
        break;

      case 'arrowR': {
        const k = Math.sin(time * 4) * 3;
        ctx.fillStyle = '#e07a3c';
        ctx.save(); ctx.translate(k, 0);
        ctx.beginPath();
        ctx.moveTo(-18, -10); ctx.lineTo(6, -10); ctx.lineTo(6, -22);
        ctx.lineTo(28, 0); ctx.lineTo(6, 22); ctx.lineTo(6, 10);
        ctx.lineTo(-18, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
        break;
      }

      case 'oven': {
        ctx.fillStyle = '#7a5340';
        U.roundRect(ctx, -28, -26, 56, 52, 8); ctx.fill();
        const g = ctx.createRadialGradient(0, 8, 2, 0, 8, 26);
        g.addColorStop(0, '#ffcf6a'); g.addColorStop(1, '#e5751f');
        ctx.fillStyle = g;
        U.roundRect(ctx, -20, -14, 40, 34, 6); ctx.fill();
        ctx.fillStyle = '#5b3b2c';
        U.roundRect(ctx, -22, -24, 44, 8, 4); ctx.fill();
        break;
      }

      case 'steam': {
        ctx.strokeStyle = '#7fb6d8'; ctx.lineWidth = 7;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          const ph = time * 2.6 + i;
          for (let j = 0; j <= 10; j++) {
            const y = 22 - j * 4.6;
            const x = i * 15 + Math.sin(ph + j * 0.7) * 5;
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        break;
      }

      case 'tap': {
        ctx.strokeStyle = '#e07a3c'; ctx.lineWidth = 5;
        const k = (time * 1.4) % 1;
        ctx.globalAlpha = 1 - k;
        ctx.beginPath(); ctx.arc(0, -4, 10 + k * 18, 0, U.TAU); ctx.stroke();
        ctx.globalAlpha = 1;
        UI.hand(ctx, 0, 6, 0.75, 0);
        break;
      }

      case 'baguette':
      case 'petite':
      case 'batard': {
        const L = name === 'petite' ? 22 : name === 'batard' ? 24 : 34;
        const R = name === 'batard' ? 12 : name === 'petite' ? 7 : 8;
        ctx.save();
        ctx.rotate(-0.32);
        const g = ctx.createLinearGradient(0, -R, 0, R);
        g.addColorStop(0, '#e8c489'); g.addColorStop(0.5, '#cf9a4e'); g.addColorStop(1, '#a96a2b');
        ctx.fillStyle = g;
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const u = -1 + i / 20;
          const p = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 4.6)), 0.3);
          ctx.lineTo(u * L, -R * p);
        }
        for (let i = 40; i >= 0; i--) {
          const u = -1 + i / 20;
          const p = Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 4.6)), 0.3);
          ctx.lineTo(u * L, R * p);
        }
        ctx.closePath(); ctx.fill();
        /* クープ */
        ctx.strokeStyle = '#f6e3bd'; ctx.lineWidth = 4;
        const nc = name === 'normal' ? 4 : 3;
        for (let i = 0; i < nc; i++) {
          const cx = -L * 0.55 + (L * 1.1 * i) / Math.max(1, nc - 1);
          ctx.beginPath();
          ctx.moveTo(cx - 6, R * 0.5); ctx.lineTo(cx + 6, -R * 0.5);
          ctx.stroke();
        }
        ctx.restore();
        break;
      }

      case 'lame': {
        ctx.save(); ctx.rotate(0.5); ctx.scale(0.52, 0.52);
        Scene.lame(ctx, 0, 0, 0, 1, false);
        ctx.restore();
        break;
      }

      case 'sparkleLame': {
        ctx.save(); ctx.translate(-4, 4); ctx.rotate(0.5); ctx.scale(0.46, 0.46);
        Scene.lame(ctx, 0, 0, 0, 1, false);
        ctx.restore();
        ctx.fillStyle = '#ffd34d';
        Scene.star(ctx, 20, -18, 12, 5, 4, time * 2); ctx.fill();
        Scene.star(ctx, -20, -24, 7, 3, 4, -time * 2); ctx.fill();
        break;
      }

      case 'three': {
        [['petite', -14, -0.30], ['baguette', 4, 0.10], ['batard', 22, 0.46]].forEach(([nm, y, rot], i) => {
          ctx.save();
          ctx.translate(-4 + i * 2, y);
          ctx.rotate(rot * 0.35);
          ctx.scale(0.62, 0.62);
          UI.icon(ctx, nm, time);
          ctx.restore();
        });
        break;
      }

      case 'play': {
        ctx.fillStyle = '#e07a3c';
        ctx.beginPath(); ctx.moveTo(-12, -20); ctx.lineTo(24, 0); ctx.lineTo(-12, 20);
        ctx.closePath(); ctx.fill();
        break;
      }
    }
    if (b && b.badge) UI.badge(ctx, b.badge);
  };

  UI.badge = function (ctx, n) {
    ctx.save();
    ctx.translate(30, -30);
    ctx.fillStyle = '#e2574f';
    ctx.beginPath(); ctx.arc(0, 0, 15, 0, U.TAU); ctx.fill();
    ctx.fillStyle = '#fff';
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.9;
      ctx.beginPath(); ctx.arc(Math.cos(a) * 7, Math.sin(a) * 7 + 3, 3, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  };

  /* ---------- 手（ゴーストハンド） ---------- */
  UI.hand = function (ctx, x, y, s, rot, alpha) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(rot || 0); ctx.scale(s, s);
    ctx.globalAlpha = alpha === undefined ? 1 : alpha;
    /* 手のひら */
    ctx.fillStyle = '#ffe6cf';
    ctx.strokeStyle = 'rgba(150,95,60,0.55)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-14, 40);
    ctx.quadraticCurveTo(-22, 16, -16, 2);
    ctx.quadraticCurveTo(-12, -6, -6, -2);
    ctx.lineTo(-6, -26);
    ctx.quadraticCurveTo(-6, -34, 0, -34);
    ctx.quadraticCurveTo(6, -34, 6, -26);
    ctx.lineTo(6, -4);
    ctx.quadraticCurveTo(14, -8, 18, 0);
    ctx.quadraticCurveTo(24, 14, 20, 40);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.restore();
  };

  /* ---------- タップの合図 ---------- */
  UI.hintTap = function (ctx, x, y, time, scale) {
    const s = scale || 1;
    const k = (time * 1.15) % 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = `rgba(255,255,255,${(0.75 * (1 - k)).toFixed(3)})`;
    ctx.lineWidth = 5 * s;
    ctx.beginPath(); ctx.arc(0, 0, (18 + k * 44) * s, 0, U.TAU); ctx.stroke();
    ctx.strokeStyle = `rgba(226,120,70,${(0.55 * (1 - k)).toFixed(3)})`;
    ctx.beginPath(); ctx.arc(0, 0, (12 + k * 30) * s, 0, U.TAU); ctx.stroke();
    const press = Math.sin(time * 3.6) * 0.5 + 0.5;
    UI.hand(ctx, 6 * s, (16 + press * 8) * s, 0.75 * s, 0.15, 0.92);
    ctx.restore();
  };

  /* ---------- なぞる合図（矢印＋手） ---------- */
  UI.hintSwipe = function (ctx, x0, y0, x1, y1, time, scale) {
    const s = scale || 1;
    const k = (time * 0.62) % 1;
    const ke = U.smooth(U.range(k, 0.06, 0.86));
    const x = U.lerp(x0, x1, ke), y = U.lerp(y0, y1, ke);
    const ang = Math.atan2(y1 - y0, x1 - x0);

    ctx.save();
    /* 軌道 */
    ctx.setLineDash([12 * s, 10 * s]);
    ctx.lineDashOffset = -time * 40 * s;
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 7 * s;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.setLineDash([]);
    /* 矢じり */
    ctx.save();
    ctx.translate(x1, y1); ctx.rotate(ang);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(2 * s, 0); ctx.lineTo(-16 * s, -12 * s); ctx.lineTo(-11 * s, 0); ctx.lineTo(-16 * s, 12 * s);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    /* 手 */
    const fade = U.smooth(U.range(k, 0, 0.10)) * (1 - U.smooth(U.range(k, 0.88, 1)));
    UI.hand(ctx, x, y + 10 * s, 0.8 * s, 0.12, 0.9 * fade);
    ctx.restore();
  };

  /* ---------- 工程の進み具合（小さな丸） ---------- */
  UI.steps = function (ctx, L, idx, total) {
    const r = Math.max(4, Math.min(L.w, L.h) * 0.0085);
    const gap = r * 3.0;
    const w = gap * (total - 1);
    const x0 = L.w / 2 - w / 2;
    const y = L.h - Math.max(16, L.h * 0.024);
    ctx.save();
    /* どんな背景でも見えるように、うすい下敷きを敷く */
    ctx.fillStyle = 'rgba(255,250,240,0.42)';
    U.roundRect(ctx, x0 - r * 2.4, y - r * 2.2, w + r * 4.8, r * 4.4, r * 2.2);
    ctx.fill();
    for (let i = 0; i < total; i++) {
      const x = x0 + gap * i;
      const on = i <= idx;
      ctx.fillStyle = on ? 'rgba(224,122,60,0.95)' : 'rgba(150,110,80,0.32)';
      ctx.beginPath(); ctx.arc(x, y, i === idx ? r * 1.5 : r, 0, U.TAU); ctx.fill();
      if (i === idx) {
        ctx.strokeStyle = 'rgba(255,255,255,0.95)';
        ctx.lineWidth = Math.max(2, r * 0.42);
        ctx.beginPath(); ctx.arc(x, y, r * 1.5, 0, U.TAU); ctx.stroke();
      }
    }
    ctx.restore();
  };

  /* ---------- 画面を横切るきらきら（ごほうび） ---------- */
  UI.celebrate = function (ctx, L, t) {
    const n = 26;
    ctx.save();
    for (let i = 0; i < n; i++) {
      const rnd = U.mulberry32(i * 977);
      const x = rnd() * L.w;
      const sp = 0.5 + rnd();
      const y = ((t * 120 * sp + rnd() * L.h) % (L.h + 60)) - 30;
      const r = 5 + rnd() * 9;
      const hue = [340, 42, 190, 280, 120][i % 5];
      ctx.fillStyle = `hsla(${hue},85%,72%,0.85)`;
      Scene.star(ctx, x, y, r, r * 0.42, 5, t * 2 + i);
      ctx.fill();
    }
    ctx.restore();
  };

  global.UI = UI;
})(window);
