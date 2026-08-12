/* にじいろタウン - おうち広場 生成器
   子どもの線 → 屋根の稜線。最後の点 → 玄関。 */
window.NT = window.NT || {};
(function () {
  const U = NT.U;
  NT.generators = NT.generators || {};

  const CRAYONS = [
    { label: 'いちご', base: '#ff8fb8', dark: '#d95a8e', light: '#ffd0e2', sparkle: '#fff',
      roof1: '#ff9ec4', roof2: '#e0678f', wall1: '#fff6ea', wall2: '#ffe8d0', trim: '#e88bb8', door: '#e2608f' },
    { label: 'そら', base: '#7fd0e8', dark: '#4b9fc0', light: '#d0f2fc', sparkle: '#fff',
      roof1: '#8fd8ea', roof2: '#54a8c8', wall1: '#fffdf2', wall2: '#f2ecd8', trim: '#5fb2cc', door: '#4b9fc0' },
    { label: 'すみれ', base: '#b48aff', dark: '#8257d8', light: '#e2d2ff', sparkle: '#fff',
      roof1: '#bd9af5', roof2: '#8b62d8', wall1: '#fdf6ff', wall2: '#efe2f8', trim: '#a078e0', door: '#8b62d8' }
  ];

  function drawWindow(ctx, x, y, w, h, pal, k, lit, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(k, k);
    ctx.translate(-x, -y);
    // フレーム
    U.rr(ctx, x - w / 2 - 3, y - h / 2 - 3, w + 6, h + 6, 7);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = pal.trim;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // ガラス
    let g;
    if (lit) {
      g = ctx.createLinearGradient(x, y - h / 2, x, y + h / 2);
      const fl = 0.9 + Math.sin(t * 5.3 + x) * 0.08;
      g.addColorStop(0, `rgba(255,236,160,${fl})`);
      g.addColorStop(1, `rgba(255,196,110,${fl})`);
    } else {
      g = ctx.createLinearGradient(x - w / 2, y - h / 2, x + w / 2, y + h / 2);
      g.addColorStop(0, '#cfeefc');
      g.addColorStop(0.45, '#9fd4f0');
      g.addColorStop(0.55, '#c8ecfa');
      g.addColorStop(1, '#88bfe2');
    }
    U.rr(ctx, x - w / 2, y - h / 2, w, h, 5);
    ctx.fillStyle = g;
    ctx.fill();
    // 空の反射のきらめき
    if (!lit) {
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.28, y + h * 0.3);
      ctx.lineTo(x + w * 0.1, y - h * 0.3);
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.1, y + h * 0.34);
      ctx.lineTo(x + w * 0.24, y - h * 0.26);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // 桟
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - h / 2); ctx.lineTo(x, y + h / 2);
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x + w / 2, y);
    ctx.stroke();
    if (lit) {
      const gl = ctx.createRadialGradient(x, y, 2, x, y, w * 1.4);
      gl.addColorStop(0, 'rgba(255,220,130,0.5)');
      gl.addColorStop(1, 'rgba(255,220,130,0)');
      ctx.fillStyle = gl;
      ctx.beginPath(); ctx.arc(x, y, w * 1.4, 0, U.TAU); ctx.fill();
    }
    ctx.restore();
  }

  NT.generators.house = {
    crayons: CRAYONS,
    build: function (record, site) {
      const pal = CRAYONS[record.colorIdx % CRAYONS.length];
      const f = NT.stroke.analyze(record.pts);
      const rng = U.rngHelpers(U.mulberry32(record.seed));
      const pon = record.pon;
      const parts = [];
      const groundY = site.groundY;
      const dome = f.closed;

      // 壁の横幅：線の幅から（短い線→小さな小屋）
      const wallW = U.clamp(f.bbox.w * (dome ? 0.85 : 0.96), 90, 460);
      const wallCx = U.clamp(f.cx + f.bias * 14, site.x - 250, site.x + 250);
      const wx0 = wallCx - wallW / 2, wx1 = wallCx + wallW / 2;
      // 壁の上端：線の下端のすこし上（屋根が壁に重なる）
      const wallTop = Math.min(groundY - 64, f.bbox.maxy - 6);
      const wallH = groundY - wallTop;

      const state = { doorOpen: 0, lit: false }; // リアクションで操作

      // 壁
      parts.push({
        t0: 0.06, dur: 0.3, draw: (ctx, k) => {
          const h = wallH * U.easeOutCubic(k);
          const g = ctx.createLinearGradient(wx0, 0, wx1, 0);
          g.addColorStop(0, pal.wall1);
          g.addColorStop(0.55, pal.wall1);
          g.addColorStop(1, pal.wall2);
          ctx.fillStyle = g;
          U.rr(ctx, wx0, groundY - h, wallW, h, 6);
          ctx.fill();
          // しっくいの質感
          ctx.save();
          ctx.clip();
          ctx.globalAlpha = 0.16;
          for (let i = 0; i < 16; i++) {
            ctx.fillStyle = i % 2 ? '#fff' : '#d8c8b8';
            ctx.beginPath();
            ctx.arc(wx0 + rng.raw() * wallW, groundY - rng.raw() * h, 1 + rng.raw() * 2.4, 0, U.TAU);
            ctx.fill();
          }
          // 腰壁
          ctx.globalAlpha = 0.5;
          ctx.fillStyle = pal.wall2;
          ctx.fillRect(wx0, groundY - 16, wallW, 16);
          ctx.globalAlpha = 1;
          ctx.restore();
          // 軒の接触影（屋根の下）
          ctx.globalAlpha = 0.18 * k;
          ctx.fillStyle = '#6a4a6a';
          ctx.beginPath();
          ctx.ellipse(wallCx, groundY - h + 5, wallW * 0.48, 7, 0, 0, U.TAU);
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      });

      // 屋根（子どもの線の下に陶器の面を敷く）
      const roofPts = f.smooth;
      const roofDepth = U.clamp(20 + f.bbox.h * 0.14, 22, 44);
      parts.push({
        t0: 0.0, dur: 0.24, draw: (ctx, k) => {
          ctx.save();
          ctx.globalAlpha = k;
          const g = ctx.createLinearGradient(0, f.bbox.miny, 0, f.bbox.maxy + roofDepth);
          g.addColorStop(0, pal.roof1);
          g.addColorStop(1, pal.roof2);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(roofPts[0].x, roofPts[0].y);
          for (const p of roofPts) ctx.lineTo(p.x, p.y);
          if (dome) {
            ctx.closePath();
          } else {
            // 線から壁の上端まで屋根の面で埋める（アーチでも浮かない）
            const baseY = wallTop + 16;
            ctx.lineTo(roofPts[roofPts.length - 1].x, Math.max(roofPts[roofPts.length - 1].y + roofDepth, baseY));
            for (let i = roofPts.length - 1; i >= 0; i--) {
              ctx.lineTo(roofPts[i].x, Math.max(roofPts[i].y + roofDepth, baseY));
            }
            ctx.lineTo(roofPts[0].x, Math.max(roofPts[0].y + roofDepth, baseY));
            ctx.closePath();
          }
          ctx.fill();
          // 陶器の艶
          ctx.clip();
          ctx.globalAlpha = 0.32 * k;
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.ellipse(f.cx - f.bbox.w * 0.2, f.bbox.miny + f.bbox.h * 0.3 + roofDepth * 0.4,
            f.bbox.w * 0.3, Math.max(8, f.bbox.h * 0.16), -0.15, 0, U.TAU);
          ctx.fill();
          // 瓦のライン
          ctx.globalAlpha = 0.2 * k;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.6;
          for (let i = 1; i <= 2; i++) {
            ctx.beginPath();
            ctx.moveTo(roofPts[0].x, roofPts[0].y + roofDepth * i / 3);
            for (const p of roofPts) ctx.lineTo(p.x, p.y + roofDepth * i / 3);
            ctx.stroke();
          }
          ctx.restore();
        }
      });

      // 子どものクレヨン線＝屋根の稜線（主役）
      parts.push({
        t0: 0.0, dur: 0.18, isStroke: true, draw: (ctx, k) => {
          ctx.save();
          if (k < 1) ctx.globalAlpha = 0.6 + 0.4 * k;
          NT.stroke.drawFull(ctx, record.pts, pal, record.seed, 1);
          ctx.restore();
        }
      });

      // えんとつ（いちばん高い山の位置 / なければ左寄り）
      const topPeak = f.peaks.length
        ? f.peaks.reduce((a, b) => (b.y < a.y ? b : a))
        : { x: U.lerp(f.bbox.minx, f.bbox.maxx, 0.3), y: f.bbox.miny + f.bbox.h * 0.25 };
      const chX = U.clamp(topPeak.x, f.bbox.minx + 16, f.bbox.maxx - 16);
      const chY = topPeak.y;
      parts.push({
        t0: 0.36, dur: 0.2, popAt: { x: chX, y: chY - 30 }, draw: (ctx, k) => {
          ctx.save();
          ctx.translate(chX, chY);
          ctx.scale(1, U.easeOutBack(k));
          const g = ctx.createLinearGradient(-10, 0, 10, 0);
          g.addColorStop(0, '#e8b090');
          g.addColorStop(1, '#c07850');
          ctx.fillStyle = g;
          ctx.fillRect(-9, -34, 18, 34);
          ctx.fillStyle = '#a05f3e';
          U.rr(ctx, -12, -40, 24, 9, 3);
          ctx.fill();
          ctx.globalAlpha = 0.4;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.moveTo(-4, -30); ctx.lineTo(-4, -6); ctx.stroke();
          ctx.restore();
        }
      });

      // 煙（動的）
      const puffs = [];
      for (let i = 0; i < 3; i++) puffs.push({ off: i * 1.4 });
      parts.push({
        t0: 0.95, dur: 0.05, dynamic: true, draw: (ctx, k, t) => {
          for (const p of puffs) {
            const cyc = ((t * 0.5 + p.off) % 4.2) / 4.2;
            const px = chX + Math.sin(cyc * 5 + p.off) * 8 + cyc * 14;
            const py = chY - 42 - cyc * 55;
            const r = 5 + cyc * 11;
            ctx.globalAlpha = k * 0.4 * (cyc < 0.15 ? cyc / 0.15 : 1 - (cyc - 0.15) / 0.85);
            const g = ctx.createRadialGradient(px, py, 1, px, py, r);
            g.addColorStop(0, 'rgba(255,255,255,0.98)');
            g.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(px, py, r, 0, U.TAU); ctx.fill();
          }
          ctx.globalAlpha = 1;
        }
      });

      // 玄関：最後の点の位置（壁の中へクランプ）
      const doorH = U.clamp(wallH * 0.36, 54, 96);
      const doorW = Math.round(doorH * 0.6);
      const doorX = U.clamp(pon.x, wx0 + doorW / 2 + 10, wx1 - doorW / 2 - 10);
      const doorTop = groundY - doorH;
      parts.push({
        t0: 0.8, dur: 0.2, hero: true, dynamic: true, popAt: { x: doorX, y: doorTop + doorH / 2 },
        draw: (ctx, k, t) => {
          const kk = U.easeOutElastic(k);
          ctx.save();
          ctx.translate(doorX, groundY);
          ctx.scale(kk, kk);
          ctx.translate(-doorX, -groundY);
          // アーチ枠
          ctx.fillStyle = '#fff';
          ctx.beginPath();
          ctx.moveTo(doorX - doorW / 2 - 5, groundY);
          ctx.lineTo(doorX - doorW / 2 - 5, doorTop + doorW / 2);
          ctx.arc(doorX, doorTop + doorW / 2 + 2, doorW / 2 + 5, Math.PI, 0);
          ctx.lineTo(doorX + doorW / 2 + 5, groundY);
          ctx.closePath();
          ctx.fill();
          // とびら（開閉）
          const open = state.doorOpen;
          ctx.save();
          ctx.translate(doorX - doorW / 2, 0);
          ctx.scale(1 - open * 0.82, 1);
          ctx.translate(-(doorX - doorW / 2), 0);
          const g = ctx.createLinearGradient(doorX - doorW / 2, 0, doorX + doorW / 2, 0);
          g.addColorStop(0, pal.door);
          g.addColorStop(1, pal.roof2);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(doorX - doorW / 2, groundY);
          ctx.lineTo(doorX - doorW / 2, doorTop + doorW / 2);
          ctx.arc(doorX, doorTop + doorW / 2 + 2, doorW / 2, Math.PI, 0);
          ctx.lineTo(doorX + doorW / 2, groundY);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 0.35;
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(doorX - doorW * 0.2, groundY - 6);
          ctx.lineTo(doorX - doorW * 0.2, doorTop + 14);
          ctx.moveTo(doorX + doorW * 0.2, groundY - 6);
          ctx.lineTo(doorX + doorW * 0.2, doorTop + 14);
          ctx.stroke();
          ctx.globalAlpha = 1;
          ctx.fillStyle = '#ffe27a';
          ctx.beginPath(); ctx.arc(doorX + doorW * 0.3, groundY - doorH * 0.42, 3.4, 0, U.TAU); ctx.fill();
          ctx.restore();
          if (open > 0.1) {
            ctx.globalAlpha = open * 0.9;
            const gg = ctx.createLinearGradient(doorX, doorTop, doorX, groundY);
            gg.addColorStop(0, '#ffe9b0');
            gg.addColorStop(1, '#f0c078');
            ctx.fillStyle = gg;
            ctx.beginPath();
            ctx.moveTo(doorX - doorW / 2 + 3, groundY);
            ctx.lineTo(doorX - doorW / 2 + 3, doorTop + doorW / 2);
            ctx.arc(doorX, doorTop + doorW / 2 + 2, doorW / 2 - 3, Math.PI, 0);
            ctx.lineTo(doorX + doorW / 2 - 3, groundY);
            ctx.closePath();
            ctx.fill();
            ctx.globalAlpha = 1;
          }
          // 玄関灯
          const lx = doorX + doorW / 2 + 16, ly = doorTop + 8;
          ctx.strokeStyle = '#8a6a4a';
          ctx.lineWidth = 3;
          ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx, ly - 12); ctx.lineTo(lx - 8, ly - 16); ctx.stroke();
          const pulse = 0.75 + Math.sin(t * 2.2) * 0.25;
          const gl = ctx.createRadialGradient(lx, ly + 6, 1, lx, ly + 6, 16);
          gl.addColorStop(0, `rgba(255,230,150,${0.85 * pulse})`);
          gl.addColorStop(1, 'rgba(255,230,150,0)');
          ctx.fillStyle = gl;
          ctx.beginPath(); ctx.arc(lx, ly + 6, 16, 0, U.TAU); ctx.fill();
          ctx.fillStyle = '#fff2c8';
          ctx.strokeStyle = '#c8a868';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(lx, ly + 6, 5, 0, U.TAU); ctx.fill(); ctx.stroke();
          ctx.restore();
        }
      });

      // 窓（壁の広さに応じて・玄関を避ける）
      const winW = 30, winH = 34;
      const rows = U.clamp(Math.floor(wallH / 95), 1, 2);
      const cols = U.clamp(Math.floor(wallW / 90), 1, 4);
      const wins = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x = wx0 + wallW * (c + 0.5) / cols;
          const y = wallTop + wallH * (r + 0.42) / (rows + 0.4);
          if (Math.abs(x - doorX) < doorW / 2 + winW / 2 + 14 && y > doorTop - winH) continue;
          wins.push({ x, y });
        }
      }
      if (!wins.length) wins.push({ x: (Math.abs(wx0 - doorX) > Math.abs(wx1 - doorX) ? wx0 + 30 : wx1 - 30), y: wallTop + wallH * 0.4 });
      wins.forEach((wn, i) => {
        parts.push({
          t0: 0.44 + i * 0.06, dur: 0.2, dynamic: true, popAt: wn,
          draw: (ctx, k, t) => drawWindow(ctx, wn.x, wn.y, winW, winH, pal, U.easeOutBack(k), state.lit, t)
        });
      });

      // 丸窓（ドーム屋根のとき）
      if (dome) {
        parts.push({
          t0: 0.5, dur: 0.2, draw: (ctx, k) => {
            ctx.save();
            ctx.translate(f.cx, f.cy);
            ctx.scale(U.easeOutBack(k), U.easeOutBack(k));
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(0, 0, 20, 0, U.TAU); ctx.fill();
            const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 16);
            g.addColorStop(0, '#d8f2fc');
            g.addColorStop(1, '#88bfe2');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(0, 0, 16, 0, U.TAU); ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(16, 0); ctx.moveTo(0, -16); ctx.lineTo(0, 16); ctx.stroke();
            ctx.restore();
          }
        });
      }

      // 花壇ボックス＆敷石
      const boxX = wins[0] ? wins[0].x : wallCx;
      parts.push({
        t0: 0.6, dur: 0.2, draw: (ctx, k) => {
          ctx.save();
          ctx.globalAlpha = k;
          // 敷石
          ctx.fillStyle = '#e8dcc8';
          ctx.strokeStyle = '#c8b898';
          ctx.lineWidth = 1.2;
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.ellipse(doorX + (i - 1) * 6, groundY + 10 + i * 13, 15 - i * 2, 5.5, 0, 0, U.TAU);
            ctx.fill(); ctx.stroke();
          }
          // フラワーボックス
          const bx = boxX, by = groundY - 2;
          const g = ctx.createLinearGradient(bx - 24, 0, bx + 24, 0);
          g.addColorStop(0, '#c89058');
          g.addColorStop(1, '#a87038');
          ctx.fillStyle = g;
          U.rr(ctx, bx - 24, by - 12, 48, 12, 3);
          ctx.fill();
          for (let i = 0; i < 4; i++) {
            const fx = bx - 16 + i * 11;
            ctx.fillStyle = ['#ff8fb8', '#ffd48a', '#b48aff', '#ff8fb8'][i];
            for (let p = 0; p < 5; p++) {
              const a = p / 5 * U.TAU;
              ctx.beginPath();
              ctx.arc(fx + Math.cos(a) * 3.4, by - 15 + Math.sin(a) * 3.4, 2.4, 0, U.TAU);
              ctx.fill();
            }
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(fx, by - 15, 2, 0, U.TAU); ctx.fill();
          }
          ctx.restore();
        }
      });

      return {
        parts,
        state,
        meta: {
          heroPos: { x: doorX, y: doorTop + doorH / 2 },
          doorPos: { x: doorX, y: groundY },
          reactPos: { x: doorX, y: groundY + 30 },
          window: wins[0] || null,
          state
        }
      };
    }
  };
})();
