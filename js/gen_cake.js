/* にじいろタウン - おかし屋さん 生成器
   子どもの線 → クリーム／ソース。最後の点 → イチゴ・チェリー・星あめ。 */
window.NT = window.NT || {};
(function () {
  const U = NT.U;
  NT.generators = NT.generators || {};

  const CRAYONS = [
    { label: 'いちご', base: '#ffb1d0', dark: '#e07aa8', light: '#ffe4ef', sparkle: '#fff',
      sponge1: '#fff2e0', sponge2: '#ffd9b8', glaze: '#ff9ec4', topper: 'strawberry' },
    { label: 'チョコ', base: '#b8794e', dark: '#8a5230', light: '#e0b48a', sparkle: '#ffe8c8',
      sponge1: '#f2ddc8', sponge2: '#d9b890', glaze: '#a05f3a', topper: 'cherry' },
    { label: 'ソーダ', base: '#8fd8ea', dark: '#54a8c8', light: '#d8f4fc', sparkle: '#fff',
      sponge1: '#f0fbff', sponge2: '#cceef8', glaze: '#7fd0e8', topper: 'star' }
  ];

  function drawStrawberry(ctx, x, y, r, k, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(Math.sin(t * 1.3) * 0.03);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, 1, 0, 0, r * 1.15);
    g.addColorStop(0, '#ff8f9e');
    g.addColorStop(0.55, '#ff4f68');
    g.addColorStop(1, '#d92840');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.62);
    ctx.bezierCurveTo(r * 0.95, -r * 0.72, r * 0.85, r * 0.42, 0, r);
    ctx.bezierCurveTo(-r * 0.85, r * 0.42, -r * 0.95, -r * 0.72, 0, -r * 0.62);
    ctx.closePath();
    ctx.fill();
    // つぶつぶ
    ctx.fillStyle = 'rgba(255,240,190,0.9)';
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * U.TAU;
      ctx.beginPath();
      ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.4 + r * 0.1, 1.4, 2, a, 0, U.TAU);
      ctx.fill();
    }
    // へた
    ctx.fillStyle = '#5faf63';
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.ellipse(i * r * 0.22, -r * 0.62, r * 0.16, r * 0.3, i * 0.4, 0, U.TAU);
      ctx.fill();
    }
    // 艶
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.25, r * 0.16, r * 0.28, 0.5, 0, U.TAU);
    ctx.fill();
    ctx.restore();
  }

  function drawCherry(ctx, x, y, r, k, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.strokeStyle = '#6a4a2e';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, r * 0.1);
    ctx.quadraticCurveTo(-r * 0.1, -r * 1.2, r * 0.5, -r * 0.9);
    ctx.stroke();
    for (const [cx, cy] of [[-r * 0.4, r * 0.35], [r * 0.42, r * 0.15]]) {
      const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.25, 1, cx, cy, r * 0.62);
      g.addColorStop(0, '#ff7a8e');
      g.addColorStop(0.6, '#e02848');
      g.addColorStop(1, '#a81830');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.58, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx - r * 0.18, cy - r * 0.22, r * 0.13, 0, U.TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawStarCandy(ctx, x, y, r, k, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.rotate(Math.sin(t * 1.8) * 0.08);
    const g = ctx.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, '#ffe27a');
    g.addColorStop(0.5, '#ffca4f');
    g.addColorStop(1, '#ff9e3e');
    ctx.fillStyle = g;
    U.starPath(ctx, 0, 0, r, 5, 0.5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, -r * 0.3, r * 0.18, r * 0.1, -0.6, 0, U.TAU);
    ctx.fill();
    const tw = (Math.sin(t * 3) + 1) / 2;
    ctx.globalAlpha = 0.5 + tw * 0.5;
    U.starPath(ctx, r * 0.7, -r * 0.7, 3 + tw * 2, 4, 0.4);
    ctx.fill();
    ctx.restore();
  }

  NT.generators.cake = {
    crayons: CRAYONS,
    build: function (record, site) {
      const pal = CRAYONS[record.colorIdx % CRAYONS.length];
      const f = NT.stroke.analyze(record.pts);
      const rng = U.rngHelpers(U.mulberry32(record.seed));
      const pon = record.pon;
      const parts = [];
      const counterY = site.counterY;

      // ケーキの幅・位置は線から
      const cakeW = U.clamp(f.bbox.w * 1.15 + 36, 110, 360);
      const cakeCx = U.clamp(f.cx, site.x - 170, site.x + 170);
      // 線の下端からカウンターまでをケーキ本体が埋める（高く描く→高いケーキ）
      const cakeTop = Math.min(counterY - 100, f.bbox.maxy + 6);
      const span = counterY - 12 - cakeTop;
      const tiers = U.clamp(Math.round(span / 95), 1, 3);

      // お皿
      parts.push({
        t0: 0.04, dur: 0.2, draw: (ctx, k) => {
          ctx.save();
          ctx.globalAlpha = k;
          ctx.translate(cakeCx, counterY - 6);
          const g = ctx.createLinearGradient(-cakeW * 0.62, 0, cakeW * 0.62, 0);
          g.addColorStop(0, '#fff');
          g.addColorStop(0.5, '#e8ecf8');
          g.addColorStop(1, '#c8d0e8');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.ellipse(0, 0, Math.min(cakeW * 0.6, 225), 13, 0, 0, U.TAU);
          ctx.fill();
          ctx.strokeStyle = 'rgba(160,170,210,0.6)';
          ctx.lineWidth = 1.4;
          ctx.stroke();
          ctx.restore();
        }
      });

      // 段（下から上へ）
      const tierHs = [];
      for (let i = 0; i < tiers; i++) tierHs.push(span / tiers);
      let yCursor = counterY - 12;
      for (let i = 0; i < tiers; i++) {
        const tw = cakeW * Math.pow(0.8, i);
        const th = tierHs[i];
        const y0 = yCursor - th;
        const idx = i;
        parts.push({
          t0: 0.08 + i * 0.14, dur: 0.24, popAt: { x: cakeCx, y: y0 + th / 2 },
          draw: (ctx, k) => {
            const kk = U.easeOutBack(k);
            ctx.save();
            ctx.translate(cakeCx, yCursorSaved[idx]);
            ctx.scale(kk, kk);
            ctx.translate(-cakeCx, -yCursorSaved[idx]);
            // スポンジ
            const g = ctx.createLinearGradient(cakeCx - tw / 2, 0, cakeCx + tw / 2, 0);
            g.addColorStop(0, pal.sponge1);
            g.addColorStop(0.6, pal.sponge1);
            g.addColorStop(1, pal.sponge2);
            ctx.fillStyle = g;
            U.rr(ctx, cakeCx - tw / 2, y0, tw, th, 10);
            ctx.fill();
            // 層のライン
            ctx.globalAlpha = 0.5;
            ctx.strokeStyle = pal.glaze;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cakeCx - tw / 2 + 6, y0 + th * 0.55);
            ctx.lineTo(cakeCx + tw / 2 - 6, y0 + th * 0.55);
            ctx.stroke();
            ctx.globalAlpha = 1;
            // 上面のグレーズ（ゼリーの垂れ・スカラップ）
            const drips = Math.max(3, Math.round(tw / 42));
            const gg = ctx.createLinearGradient(0, y0 - 4, 0, y0 + 26);
            gg.addColorStop(0, pal.glaze);
            gg.addColorStop(1, shade(pal.glaze, -18));
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.moveTo(cakeCx - tw / 2, y0 + 8);
            ctx.lineTo(cakeCx - tw / 2, y0);
            ctx.lineTo(cakeCx + tw / 2, y0);
            ctx.lineTo(cakeCx + tw / 2, y0 + 8);
            for (let d = 0; d < drips; d++) {
              const x1 = cakeCx + tw / 2 - (d + 0.5) * (tw / drips);
              const dh = 8 + ((d * 37 + idx * 13) % 11);
              ctx.quadraticCurveTo(x1 + tw / drips / 4, y0 + dh + 7, x1, y0 + dh);
              ctx.quadraticCurveTo(x1 - tw / drips / 4, y0 + dh + 7, x1 - tw / drips / 2, y0 + 8);
            }
            ctx.closePath();
            ctx.fill();
            // グレーズの艶
            ctx.globalAlpha = 0.55;
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.ellipse(cakeCx - tw * 0.22, y0 + 5, tw * 0.18, 3, 0, 0, U.TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
            ctx.restore();
          }
        });
        yCursor = y0;
      }
      // クロージャ用に各段の基準位置を保存
      const yCursorSaved = [];
      {
        let yc = counterY - 12;
        for (let i = 0; i < tiers; i++) { yCursorSaved.push(yc); yc -= tierHs[i]; }
      }

      // スプリンクル
      for (let i = 0; i < 14; i++) {
        const sx = cakeCx + rng.f(-0.42, 0.42) * cakeW;
        const sy = U.clamp(cakeTop + rng.f(0.1, 0.95) * span, cakeTop + 6, counterY - 18);
        const hue = rng.pick([333, 268, 195, 45, 150]);
        const ang = rng.f(0, U.TAU);
        parts.push({
          t0: 0.5 + rng.f(0, 0.25), dur: 0.14, draw: (ctx, k) => {
            ctx.save();
            ctx.globalAlpha = k;
            ctx.translate(sx, sy);
            ctx.rotate(ang);
            ctx.fillStyle = `hsl(${hue},90%,70%)`;
            U.rr(ctx, -3.2, -1.2, 6.4, 2.4, 1.2);
            ctx.fill();
            ctx.restore();
          }
        });
      }

      // 子どものクレヨン線＝クリーム（主役）: 下に白いクリームの土台を敷いて厚みを出す
      const creamPts = f.smooth;
      const wAvg = record.pts.reduce((a, p) => a + (p.w || 14), 0) / record.pts.length;
      parts.push({
        t0: 0.0, dur: 0.22, draw: (ctx, k) => {
          ctx.save();
          ctx.globalAlpha = 0.92 * k;
          ctx.strokeStyle = '#fff';
          ctx.lineCap = 'round'; ctx.lineJoin = 'round';
          ctx.lineWidth = wAvg * 1.3;
          ctx.beginPath();
          ctx.moveTo(creamPts[0].x, creamPts[0].y + 2);
          for (const p of creamPts) ctx.lineTo(p.x, p.y + 2);
          ctx.stroke();
          ctx.globalAlpha = 0.4 * k;
          ctx.strokeStyle = '#f0d8e0';
          ctx.lineWidth = wAvg * 1.35;
          ctx.beginPath();
          ctx.moveTo(creamPts[0].x + 1.5, creamPts[0].y + 4);
          for (const p of creamPts) ctx.lineTo(p.x + 1.5, p.y + 4);
          ctx.stroke();
          ctx.restore();
        }
      });
      parts.push({
        t0: 0.0, dur: 0.18, isStroke: true, draw: (ctx, k) => {
          ctx.save();
          if (k < 1) ctx.globalAlpha = 0.6 + 0.4 * k;
          NT.stroke.drawFull(ctx, record.pts, pal, record.seed, 1);
          ctx.restore();
        }
      });

      // 谷にクリームの雫（垂れ）
      f.valleys.slice(0, 4).forEach((v, i) => {
        parts.push({
          t0: 0.34 + i * 0.06, dur: 0.2, draw: (ctx, k) => {
            ctx.save();
            ctx.globalAlpha = k;
            const g = ctx.createLinearGradient(0, v.y, 0, v.y + 20);
            g.addColorStop(0, pal.base);
            g.addColorStop(1, pal.dark);
            ctx.fillStyle = g;
            ctx.beginPath();
            ctx.moveTo(v.x - 5, v.y + 2);
            ctx.quadraticCurveTo(v.x - 5, v.y + 12 * k, v.x, v.y + 17 * k);
            ctx.quadraticCurveTo(v.x + 5, v.y + 12 * k, v.x + 5, v.y + 2);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
          }
        });
      });

      // 山にクリームのぽっち＋キャンドル（山の数だけ・最大4）
      f.peaks.slice(0, 4).forEach((pk, i) => {
        parts.push({
          t0: 0.55 + i * 0.08, dur: 0.22, popAt: { x: pk.x, y: pk.y - 14 }, dynamic: true,
          draw: (ctx, k, t) => {
            const kk = U.easeOutBack(k);
            ctx.save();
            ctx.translate(pk.x, pk.y);
            ctx.scale(kk, kk);
            // ぽっちクリーム
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.quadraticCurveTo(-7, -8, 0, -11);
            ctx.quadraticCurveTo(7, -8, 8, 0);
            ctx.closePath();
            ctx.fill();
            // キャンドル
            const cg = ctx.createLinearGradient(-3, 0, 3, 0);
            cg.addColorStop(0, '#ffd0e0');
            cg.addColorStop(0.5, '#fff');
            cg.addColorStop(1, '#ffb1d0');
            ctx.fillStyle = cg;
            U.rr(ctx, -3, -30, 6, 21, 2.4);
            ctx.fill();
            // 炎（ゆらぎ）
            const fl = Math.sin(t * 9 + i * 2) * 1.6;
            const fg = ctx.createRadialGradient(fl * 0.3, -35, 1, fl * 0.3, -35, 8);
            fg.addColorStop(0, 'rgba(255,240,170,0.95)');
            fg.addColorStop(1, 'rgba(255,180,80,0)');
            ctx.fillStyle = fg;
            ctx.beginPath(); ctx.arc(fl * 0.3, -35, 8, 0, U.TAU); ctx.fill();
            ctx.fillStyle = '#ffca4f';
            ctx.beginPath();
            ctx.ellipse(fl * 0.3, -35, 2.6, 4.4 + Math.abs(fl), 0, 0, U.TAU);
            ctx.fill();
            ctx.restore();
          }
        });
      });

      // 渦巻きならウエハースを添える
      if (f.isSpiral) {
        const wx = f.bbox.maxx + 16, wy = f.bbox.miny + 10;
        parts.push({
          t0: 0.6, dur: 0.2, draw: (ctx, k) => {
            ctx.save();
            ctx.globalAlpha = k;
            ctx.translate(wx, wy);
            ctx.rotate(0.5);
            const g = ctx.createLinearGradient(0, -26, 0, 26);
            g.addColorStop(0, '#f0c890');
            g.addColorStop(1, '#d8a860');
            ctx.fillStyle = g;
            U.rr(ctx, -6, -26, 12, 52, 5);
            ctx.fill();
            ctx.strokeStyle = 'rgba(160,110,60,0.5)';
            ctx.lineWidth = 1.2;
            for (let i = -1; i <= 1; i++) {
              ctx.beginPath(); ctx.moveTo(i * 3, -22); ctx.lineTo(i * 3, 22); ctx.stroke();
            }
            ctx.restore();
          }
        });
      }

      // まわりのフルーツ（線の長さで数が変わる）
      const nFruit = U.clamp(Math.round(f.length / 130), 1, 5);
      for (let i = 0; i < nFruit; i++) {
        const fx = cakeCx + (i - (nFruit - 1) / 2) * (cakeW / nFruit) * 0.8 + rng.f(-8, 8);
        const fy = counterY - 16;
        const kind = rng.i(0, 2);
        parts.push({
          t0: 0.62 + i * 0.05, dur: 0.2, draw: (ctx, k) => {
            const kk = U.easeOutBack(k);
            ctx.save();
            ctx.translate(fx, fy);
            ctx.scale(kk, kk);
            if (kind === 0) drawStrawberry(ctx, 0, 0, 8, 1, 0);
            else if (kind === 1) { // オレンジスライス
              ctx.fillStyle = '#ffb060';
              ctx.beginPath(); ctx.arc(0, 0, 8, Math.PI, 0); ctx.closePath(); ctx.fill();
              ctx.fillStyle = '#ffd8a0';
              ctx.beginPath(); ctx.arc(0, 0, 6.4, Math.PI, 0); ctx.closePath(); ctx.fill();
              ctx.strokeStyle = '#ffb060';
              ctx.lineWidth = 1.2;
              for (let s = 1; s < 4; s++) {
                const a = Math.PI + s * Math.PI / 4;
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); ctx.stroke();
              }
            } else { // ぶどう
              ctx.fillStyle = '#b48aff';
              for (const [gx, gy] of [[-3, 0], [3, 0], [0, -4], [0, 2]]) {
                ctx.beginPath(); ctx.arc(gx, gy, 3.6, 0, U.TAU); ctx.fill();
              }
              ctx.fillStyle = 'rgba(255,255,255,0.7)';
              ctx.beginPath(); ctx.arc(-1, -5, 1.2, 0, U.TAU); ctx.fill();
            }
            ctx.restore();
          }
        });
      }

      // ヒーロー：最後の点のトッパー
      const topperR = U.clamp(14 + f.length * 0.02, 15, 26);
      const tx = U.clamp(pon.x, cakeCx - cakeW * 0.55, cakeCx + cakeW * 0.55);
      const ty = Math.min(pon.y, counterY - 30);
      parts.push({
        t0: 0.8, dur: 0.2, hero: true, dynamic: true, popAt: { x: tx, y: ty },
        draw: (ctx, k, t) => {
          const kk = U.easeOutElastic(k);
          if (pal.topper === 'strawberry') drawStrawberry(ctx, tx, ty, topperR, kk, t);
          else if (pal.topper === 'cherry') drawCherry(ctx, tx, ty, topperR, kk, t);
          else drawStarCandy(ctx, tx, ty, topperR, kk, t);
        }
      });

      function shade(hex, amt) {
        const n = parseInt(hex.slice(1), 16);
        const r = U.clamp((n >> 16) + amt, 0, 255), g = U.clamp(((n >> 8) & 255) + amt, 0, 255), b = U.clamp((n & 255) + amt, 0, 255);
        return `rgb(${r},${g},${b})`;
      }

      return {
        parts,
        meta: {
          heroPos: { x: tx, y: ty },
          cakePos: { x: cakeCx, y: cakeTop },
          reactPos: { x: cakeCx - 90, y: site.groundY + 24 },
          munchPos: { x: cakeCx - 40, y: site.groundY + 10 }
        }
      };
    }
  };
})();
