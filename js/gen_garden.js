/* にじいろタウン - にじいろ花壇 生成器
   子どもの線 → 茎・つる。最後の点 → 大輪の花。 */
window.NT = window.NT || {};
(function () {
  const U = NT.U;
  NT.generators = NT.generators || {};

  const CRAYONS = [
    { label: 'ピンク', base: '#ff8fc6', dark: '#d9569a', light: '#ffd2e9', sparkle: '#fff', hue: 333 },
    { label: 'すみれ', base: '#b48aff', dark: '#8257d8', light: '#e2d2ff', sparkle: '#fff', hue: 268 },
    { label: 'にじ', rainbow: true, base: '#ffd48a', dark: '#e8a84e', light: '#fff0d0', sparkle: '#fff', hue: -1 }
  ];

  function petalColor(hue, i, n, light) {
    if (hue < 0) { // にじ
      const h = (i / n) * 360;
      return `hsla(${h},95%,${light ? 85 : 72}%,`;
    }
    const h = hue + (i % 2) * 12 - 6;
    return `hsla(${h},95%,${light ? 86 : 74}%,`;
  }

  // 大輪の花
  function drawHeroFlower(ctx, x, y, R, hue, t, k, rng2) {
    const sway = Math.sin(t * 1.1) * 0.035;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(sway);
    ctx.scale(k, k);
    const nP = 9;
    // 外輪の花びら（半透明・グラデーション）
    for (let ring = 0; ring < 2; ring++) {
      const rr = ring === 0 ? R : R * 0.62;
      const off = ring === 0 ? 0 : Math.PI / nP;
      for (let i = 0; i < nP; i++) {
        const a = (i / nP) * U.TAU + off + Math.sin(t * 0.9 + i) * 0.012;
        ctx.save();
        ctx.rotate(a);
        const col = petalColor(hue, i, nP, ring === 1);
        const g = ctx.createLinearGradient(0, 0, rr, 0);
        g.addColorStop(0, col + '0.95)');
        g.addColorStop(0.75, col + '0.8)');
        g.addColorStop(1, col.replace('%,', '%,').replace('hsla', 'hsla') + '0.5)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(rr * 0.3, -rr * 0.34, rr * 0.85, -rr * 0.3, rr, 0);
        ctx.bezierCurveTo(rr * 0.85, rr * 0.3, rr * 0.3, rr * 0.34, 0, 0);
        ctx.closePath();
        ctx.fill();
        // パール光沢
        ctx.globalAlpha = 0.4;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(rr * 0.55, -rr * 0.1, rr * 0.26, rr * 0.09, -0.2, 0, U.TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }
    // 花芯
    const cg = ctx.createRadialGradient(-R * 0.06, -R * 0.06, 1, 0, 0, R * 0.3);
    cg.addColorStop(0, '#fff6d8');
    cg.addColorStop(0.6, '#ffd76e');
    cg.addColorStop(1, '#e8a838');
    ctx.fillStyle = cg;
    ctx.beginPath(); ctx.arc(0, 0, R * 0.28, 0, U.TAU); ctx.fill();
    // 花粉の粒
    for (let i = 0; i < 10; i++) {
      const a = rng2.f(0, U.TAU), rr = rng2.f(0, R * 0.2);
      ctx.fillStyle = i % 3 ? '#fff2b8' : '#fff';
      ctx.globalAlpha = 0.8;
      ctx.beginPath(); ctx.arc(Math.cos(a) * rr, Math.sin(a) * rr, 1.6, 0, U.TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // きらめき
    const tw = (Math.sin(t * 2.4) + 1) / 2;
    ctx.globalAlpha = 0.5 + tw * 0.5;
    ctx.fillStyle = '#fff';
    U.starPath(ctx, R * 0.42, -R * 0.42, 5 + tw * 2.5, 4, 0.4);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function drawLeaf(ctx, x, y, ang, len, k, flip) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(ang + (flip ? -0.9 : 0.9));
    ctx.scale(k, k);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, '#7cc86e');
    g.addColorStop(1, '#4f9e56');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.42, len, -len * 0.08);
    ctx.quadraticCurveTo(len * 0.5, len * 0.3, 0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, -1);
    ctx.quadraticCurveTo(len * 0.5, -len * 0.12, len * 0.88, -len * 0.08);
    ctx.stroke();
    ctx.restore();
  }

  function drawSmallFlower(ctx, x, y, r, hue, k, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.4 + x * 0.02) * 0.05);
    ctx.scale(k, k);
    const h = hue < 0 ? (x * 7) % 360 : (hue + 25) % 360;
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * U.TAU - Math.PI / 2;
      ctx.fillStyle = `hsla(${h},92%,80%,0.95)`;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.42, r * 0.3, a, 0, U.TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#ffe27a';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.3, 0, U.TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(-r * 0.1, -r * 0.1, r * 0.1, 0, U.TAU); ctx.fill();
    ctx.restore();
  }

  function drawDew(ctx, x, y, r, t) {
    const tw = (Math.sin(t * 3 + x) + 1) / 2;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 0.5, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,0.95)');
    g.addColorStop(0.5, 'rgba(190,235,255,0.75)');
    g.addColorStop(1, 'rgba(140,200,240,0.45)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, U.TAU); ctx.fill();
    ctx.globalAlpha = 0.6 + tw * 0.4;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.35, r * 0.3, 0, U.TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  NT.generators.garden = {
    crayons: CRAYONS,
    build: function (record, site) {
      const pal = CRAYONS[record.colorIdx % CRAYONS.length];
      const f = NT.stroke.analyze(record.pts);
      const rng = U.rngHelpers(U.mulberry32(record.seed));
      const pon = record.pon;
      const parts = [];
      const hue = pal.hue;

      const groundY = site.groundY;
      const heroR = U.clamp(30 + f.length * 0.055, 34, 78);

      // 土のマウンド（線の下端あたり）
      const mx = f.cx, my = Math.min(groundY - 4, f.bbox.maxy + 12);
      parts.push({
        t0: 0.02, dur: 0.2, draw: (ctx, k) => {
          ctx.save();
          ctx.translate(mx, my);
          ctx.scale(k, k);
          const g = ctx.createLinearGradient(0, -12, 0, 12);
          g.addColorStop(0, '#a5714c');
          g.addColorStop(1, '#7a4f33');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, U.clamp(f.bbox.w * 0.4, 40, 150), 15, 0, 0, U.TAU);
          ctx.fill();
          ctx.globalAlpha = 0.35;
          ctx.fillStyle = '#5a3a24';
          for (let i = 0; i < 7; i++) {
            ctx.beginPath();
            ctx.arc((rng.raw() - 0.5) * f.bbox.w * 0.6, (rng.raw() - 0.5) * 14, 2 + rng.raw() * 2, 0, U.TAU);
            ctx.fill();
          }
          ctx.globalAlpha = 1;
          ctx.restore();
        }
      });

      // 茎の下support（線の下の淡い緑の影 → 線が茎に「効いている」感）
      const stemPts = f.smooth;
      const wAvg = record.pts.reduce((a, p) => a + (p.w || 14), 0) / record.pts.length;
      parts.push({
        t0: 0.0, dur: 0.22, draw: (ctx, k) => {
          ctx.save();
          ctx.globalAlpha = 0.55 * k;
          ctx.strokeStyle = '#3f8a4e';
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.lineWidth = (wAvg * 1.2 + 3) * k;
          ctx.beginPath();
          ctx.moveTo(stemPts[0].x, stemPts[0].y + 3);
          for (const p of stemPts) ctx.lineTo(p.x, p.y + 3);
          ctx.stroke();
          ctx.restore();
        }
      });

      // 子どものクレヨン線（主役・そのまま残す）
      parts.push({
        t0: 0.0, dur: 0.18, isStroke: true, draw: (ctx, k) => {
          ctx.save();
          if (k < 1) ctx.globalAlpha = 0.6 + 0.4 * k;
          NT.stroke.drawFull(ctx, record.pts, pal, record.seed, 1);
          ctx.restore();
        }
      });

      // 葉：線に沿って交互に
      const nLeaves = U.clamp(Math.round(f.length / 62), 2, 10);
      for (let i = 0; i < nLeaves; i++) {
        const tt = (i + 0.6) / (nLeaves + 0.6);
        const p = U.pointAlong(stemPts, tt);
        if (U.dist(p.x, p.y, pon.x, pon.y) < heroR * 0.9) continue;
        const flip = i % 2 === 0;
        const len = rng.f(20, 30) + f.length * 0.012;
        parts.push({
          t0: 0.2 + tt * 0.35, dur: 0.22, popAt: { x: p.x, y: p.y },
          draw: (ctx, k) => drawLeaf(ctx, p.x, p.y, p.ang, len, U.easeOutBack(k), flip)
        });
      }

      // 山・谷ごとに小さな花（線のかたちが効く）
      const spots = [...f.peaks, ...f.valleys].slice(0, 6);
      spots.forEach((pk, i) => {
        const r = rng.f(9, 14);
        parts.push({
          t0: 0.42 + i * 0.07, dur: 0.25, popAt: { x: pk.x, y: pk.y }, dynamic: true,
          draw: (ctx, k, t) => drawSmallFlower(ctx, pk.x, pk.y - 4, r, hue, U.easeOutBack(k), t)
        });
      });

      // 渦巻きなら、つるの先にくるくるテンドリル
      if (f.isSpiral || f.waviness >= 5) {
        const e = f.end;
        parts.push({
          t0: 0.5, dur: 0.3, draw: (ctx, k) => {
            ctx.save();
            ctx.strokeStyle = '#5faf63';
            ctx.lineWidth = 3.2;
            ctx.lineCap = 'round';
            ctx.beginPath();
            const n = Math.floor(26 * k);
            for (let i = 0; i <= n; i++) {
              const a = i * 0.32, rr = 2 + i * 1.15;
              const px = e.x + Math.cos(a) * rr, py = e.y - 6 - Math.sin(a) * rr * 0.8;
              i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      // 露（葉先あたりにいくつか・きらめく）
      const nDew = 3;
      for (let i = 0; i < nDew; i++) {
        const p = U.pointAlong(stemPts, rng.f(0.15, 0.9));
        const dx = p.x + rng.f(-16, 16), dy = p.y - rng.f(4, 18);
        const r = rng.f(3.5, 5.5);
        parts.push({
          t0: 0.62 + i * 0.06, dur: 0.2, dynamic: true,
          draw: (ctx, k, t) => { ctx.save(); ctx.globalAlpha = k; drawDew(ctx, dx, dy, r, t); ctx.restore(); }
        });
      }

      // まわりの草
      for (let i = 0; i < 7; i++) {
        const gx = f.cx + rng.f(-1, 1) * (f.bbox.w * 0.65 + 50);
        const gy = Math.min(groundY - 2, f.bbox.maxy + rng.f(0, 18));
        const gh = rng.f(9, 17);
        parts.push({
          t0: 0.3 + rng.f(0, 0.3), dur: 0.2, draw: (ctx, k) => {
            ctx.save();
            ctx.strokeStyle = i % 2 ? '#6fbc6a' : '#8ed07e';
            ctx.lineWidth = 2.4;
            ctx.lineCap = 'round';
            for (let b = -1; b <= 1; b++) {
              ctx.beginPath();
              ctx.moveTo(gx + b * 3, gy);
              ctx.quadraticCurveTo(gx + b * 5, gy - gh * k * 0.6, gx + b * 7, gy - gh * k);
              ctx.stroke();
            }
            ctx.restore();
          }
        });
      }

      // ヒーロー：最後の点から大輪の花
      const rng2 = U.rngHelpers(U.mulberry32(record.seed + 7));
      parts.push({
        t0: 0.8, dur: 0.2, hero: true, dynamic: true, popAt: { x: pon.x, y: pon.y },
        draw: (ctx, k, t) => drawHeroFlower(ctx, pon.x, pon.y, heroR, hue, t, U.easeOutElastic(k), rng2)
      });

      return {
        parts,
        meta: {
          heroPos: { x: pon.x, y: pon.y },
          heroR,
          butterflies: U.clamp(2 + f.peaks.length, 2, 5),
          reactPos: { x: U.clamp(f.cx + 120, site.x - 200, site.x + 260), y: groundY + 26 }
        }
      };
    }
  };
})();
