/* ============================================================
   ぬいぬい！ フェルトタウン — felt.js
   フェルト・糸・ボタン・レース・リボンの描画プリミティブ
   ============================================================ */
'use strict';

const Felt = {
  _texCache: new Map(),

  // フェルトの繊維テクスチャ（色ごとにキャッシュ）
  fiberTex(color) {
    if (this._texCache.has(color)) return this._texCache.get(color);
    const S = 128;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = color;
    x.fillRect(0, 0, S, S);
    const rnd = U.mulberry32(1234 + color.length * 7 + (color.charCodeAt(1) || 0) * 31 + (color.charCodeAt(3) || 0) * 101);
    // 細かい繊維：明暗の短い毛
    for (let i = 0; i < 900; i++) {
      const px = rnd() * S, py = rnd() * S;
      const a = rnd() * U.TAU, l = 1.5 + rnd() * 3.5;
      x.strokeStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.10)' : 'rgba(60,30,60,0.07)';
      x.lineWidth = 0.8;
      x.beginPath();
      x.moveTo(px, py);
      x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l);
      x.stroke();
    }
    // ぽつぽつしたノイズ
    for (let i = 0; i < 350; i++) {
      x.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,40,80,0.05)';
      x.beginPath();
      x.arc(rnd() * S, rnd() * S, 0.6 + rnd() * 0.9, 0, U.TAU);
      x.fill();
    }
    this._texCache.set(color, c);
    return c;
  },

  // パスを構築（点列→ctx.beginPath 済み状態にする）
  tracePath(ctx, pts, close) {
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    if (close) ctx.closePath();
  },

  // フェルト片：影 → 繊維テクスチャ塗り → 縁の内側にぬい目
  // shape: (ctx)=>{ ctx.beginPath()...; } でパスを作る関数
  piece(ctx, shapeFn, color, opt) {
    opt = opt || {};
    const stitchCol = opt.stitchColor || 'rgba(255,255,255,0.85)';
    // 本体（繊維パターン）＋やわらかい落ち影（shadowBlurはiOS Safariでも安定）
    ctx.save();
    shapeFn(ctx);
    const pat = ctx.createPattern(this.fiberTex(color), 'repeat');
    ctx.shadowColor = 'rgba(120,70,110,0.30)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = opt.shadowY !== undefined ? opt.shadowY : 6;
    ctx.fillStyle = pat;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.clip();
    // 面のふくらみ：上辺にハイライト、下辺に落ち込み（フェルトの厚み）
    ctx.save();
    ctx.translate(0, -5);
    shapeFn(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 11;
    ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(0, 6);
    shapeFn(ctx);
    ctx.strokeStyle = 'rgba(110,60,100,0.15)';
    ctx.lineWidth = 13;
    ctx.stroke();
    ctx.restore();
    // ふち周辺をほんのり明るく（毛羽立ち感）
    shapeFn(ctx);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 5;
    ctx.stroke();
    // ふちのぬい目：クリップで外半分が欠ける分、倍幅で描いて内側にフル幅を残す
    if (opt.stitch !== false) {
      shapeFn(ctx);
      ctx.strokeStyle = stitchCol;
      ctx.lineWidth = (opt.stitchWidth || 3) * 2;
      ctx.setLineDash([8, 7]);
      ctx.lineDashOffset = opt.dashOffset || 0;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  },

  // 角丸長方形パス関数を作る
  rrect(x, y, w, h, r) {
    return (ctx) => {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    };
  },

  circle(cx, cy, r) {
    return (ctx) => { ctx.beginPath(); ctx.arc(cx, cy, r, 0, U.TAU); };
  },

  // 点列（閉じる）パス関数
  poly(pts) {
    return (ctx) => this.tracePath(ctx, pts, true);
  },

  // ============ 子どもの線＝毛糸ライン ============
  // progress: 0..1 でここまで描く（描画中/リプレイ演出用）
  yarn(ctx, pts, color, width, progress) {
    if (pts.length < 2) return;
    const n = Math.max(2, Math.floor(pts.length * (progress === undefined ? 1 : progress)));
    const p = pts.slice(0, n);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // ふわっとした光（下地）
    this.tracePath(ctx, p);
    ctx.strokeStyle = U.rgba(color, 0.25);
    ctx.lineWidth = width * 2.2;
    ctx.stroke();
    // 本体
    this.tracePath(ctx, p);
    ctx.strokeStyle = U.shade(color, -0.12);
    ctx.lineWidth = width;
    ctx.stroke();
    // 明るい芯
    this.tracePath(ctx, p);
    ctx.strokeStyle = U.shade(color, 0.35);
    ctx.lineWidth = width * 0.45;
    ctx.stroke();
    // より糸のねじれ模様
    this.tracePath(ctx, p);
    ctx.strokeStyle = U.rgba('#ffffff', 0.55);
    ctx.lineWidth = width * 0.3;
    ctx.setLineDash([width * 0.7, width * 0.9]);
    ctx.stroke();
    ctx.setLineDash([]);
    // 毛羽（ところどころ細い毛）
    for (let i = 2; i < p.length - 2; i += 4) {
      const a = Math.atan2(p[i + 1].y - p[i - 1].y, p[i + 1].x - p[i - 1].x) + Math.PI / 2;
      const s = ((i * 7919) % 13) / 13 - 0.5;
      const l = width * (0.5 + Math.abs(s));
      ctx.strokeStyle = U.rgba(color, 0.35);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p[i].x, p[i].y);
      ctx.lineTo(p[i].x + Math.cos(a) * l * Math.sign(s || 1), p[i].y + Math.sin(a) * l * Math.sign(s || 1));
      ctx.stroke();
    }
    ctx.restore();
  },

  // ぬい目ライン（点線ステッチ）
  stitchLine(ctx, pts, color, width, progress, dash) {
    if (pts.length < 2) return;
    const n = Math.max(2, Math.floor(pts.length * (progress === undefined ? 1 : progress)));
    const p = pts.slice(0, n);
    ctx.save();
    ctx.lineCap = 'round';
    this.tracePath(ctx, p);
    ctx.strokeStyle = 'rgba(120,70,110,0.18)';
    ctx.lineWidth = width + 2;
    ctx.setLineDash(dash || [9, 7]);
    ctx.stroke();
    this.tracePath(ctx, p);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash || [9, 7]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  // ============ ボタン ============
  button(ctx, x, y, r, color, scale) {
    const s = scale === undefined ? 1 : scale;
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    // 影
    ctx.beginPath(); ctx.arc(2, 4, r, 0, U.TAU);
    ctx.fillStyle = 'rgba(120,70,110,0.28)'; ctx.fill();
    // 本体（つやのあるグラデ）
    const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.15, 0, 0, r * 1.15);
    g.addColorStop(0, U.shade(color, 0.55));
    g.addColorStop(0.55, color);
    g.addColorStop(1, U.shade(color, -0.28));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, U.TAU);
    ctx.fillStyle = g; ctx.fill();
    // ふちのリム
    ctx.beginPath(); ctx.arc(0, 0, r * 0.82, 0, U.TAU);
    ctx.strokeStyle = U.shade(color, -0.2); ctx.lineWidth = r * 0.09; ctx.stroke();
    // 4つの穴と糸
    const hr = r * 0.13, off = r * 0.3;
    const holes = [[-off, -off], [off, -off], [-off, off], [off, off]];
    // 十字の糸
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = r * 0.13; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-off, -off); ctx.lineTo(off, off); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(off, -off); ctx.lineTo(-off, off); ctx.stroke();
    for (const [hx, hy] of holes) {
      ctx.beginPath(); ctx.arc(hx, hy, hr, 0, U.TAU);
      ctx.fillStyle = U.shade(color, -0.45); ctx.fill();
    }
    // キラッとハイライト
    ctx.beginPath();
    ctx.ellipse(-r * 0.4, -r * 0.45, r * 0.28, r * 0.16, -0.7, 0, U.TAU);
    ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fill();
    ctx.restore();
  },

  // ============ スカラップ（半円の連なる縁飾りレース） ============
  scallopTrim(ctx, pts, r, color, progress) {
    const total = U.polyLength(pts);
    const count = Math.max(2, Math.floor(total / (r * 1.7)));
    const n = Math.floor(count * (progress === undefined ? 1 : progress));
    ctx.save();
    for (let i = 0; i < n; i++) {
      const q = U.pointAt(pts, (i + 0.5) / count);
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(q.ang);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(120,70,110,0.15)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 内側の小さな点（レースの穴）
      ctx.beginPath(); ctx.arc(0, r * 0.45, r * 0.14, 0, U.TAU);
      ctx.fillStyle = 'rgba(120,70,110,0.18)'; ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  },

  // ============ リボン（ちょうちょ結び） ============
  bow(ctx, x, y, size, color, scale) {
    const s = (scale === undefined ? 1 : scale) * size / 40;
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    const dark = U.shade(color, -0.22), lite = U.shade(color, 0.3);
    // 左右の輪
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(dir * 14, -22, dir * 42, -16, dir * 36, 2);
      ctx.bezierCurveTo(dir * 32, 14, dir * 10, 10, 0, 0);
      ctx.fillStyle = color; ctx.fill();
      ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
      // 輪の中の影
      ctx.beginPath();
      ctx.moveTo(dir * 6, -2);
      ctx.bezierCurveTo(dir * 16, -12, dir * 30, -8, dir * 26, 2);
      ctx.strokeStyle = U.rgba(dark, 0.5); ctx.lineWidth = 3; ctx.stroke();
    }
    // 垂れ下がり
    for (const dir of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(dir * 8, 16, dir * 14, 26);
      ctx.lineTo(dir * 6, 26);
      ctx.quadraticCurveTo(dir * 2, 14, 0, 6);
      ctx.closePath();
      ctx.fillStyle = dark; ctx.fill();
    }
    // 中央の結び目
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, U.TAU);
    ctx.fillStyle = lite; ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  },

  // ============ 花 ============
  flower(ctx, x, y, r, petalColor, centerColor, petals, scale, rot) {
    const s = scale === undefined ? 1 : scale;
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);
    const n = petals || 6;
    // 花びら（フェルトのぷっくり感）
    for (let i = 0; i < n; i++) {
      const a = (i / n) * U.TAU - Math.PI / 2;
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(r * 0.62, 0, r * 0.55, r * 0.38, 0, 0, U.TAU);
      ctx.fillStyle = petalColor;
      ctx.fill();
      ctx.strokeStyle = U.rgba(U.shade(petalColor, -0.3), 0.55);
      ctx.lineWidth = 1.6;
      ctx.setLineDash([4, 3.5]);
      ctx.stroke();
      ctx.setLineDash([]);
      // ハイライト
      ctx.beginPath();
      ctx.ellipse(r * 0.5, -r * 0.1, r * 0.2, r * 0.1, 0, 0, U.TAU);
      ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.fill();
      ctx.restore();
    }
    this.button(ctx, 0, 0, r * 0.42, centerColor, 1);
    ctx.restore();
  },

  // ============ ハート ============
  heart(ctx, x, y, r, color, scale) {
    const s = scale === undefined ? 1 : scale;
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s * r / 20, s * r / 20);
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.bezierCurveTo(-22, -8, -10, -22, 0, -10);
    ctx.bezierCurveTo(10, -22, 22, -8, 0, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([3.5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  // ============ 星 ============
  star(ctx, x, y, r, color, scale, rot) {
    const s = scale === undefined ? 1 : scale;
    if (s <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s, s);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rr = i % 2 === 0 ? r : r * 0.45;
      const a = (i / 10) * U.TAU - Math.PI / 2;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([3, 2.6]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  },

  // ============ 綿（わた）のもこもこ ============
  cotton(ctx, x, y, r, scale, seed) {
    const s = scale === undefined ? 1 : scale;
    if (s <= 0.01) return;
    const rnd = U.mulberry32(seed || 7);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * U.TAU + rnd();
      const rr = r * (0.45 + rnd() * 0.25);
      const dx = Math.cos(a) * r * 0.55, dy = Math.sin(a) * r * 0.4;
      const g = ctx.createRadialGradient(dx - rr * 0.3, dy - rr * 0.3, rr * 0.1, dx, dy, rr);
      g.addColorStop(0, 'rgba(255,255,255,0.98)');
      g.addColorStop(1, 'rgba(235,225,240,0.9)');
      ctx.beginPath(); ctx.arc(dx, dy, rr, 0, U.TAU);
      ctx.fillStyle = g; ctx.fill();
    }
    ctx.restore();
  },

  // きらきらスパーク（完成演出用）
  sparkle(ctx, x, y, r, t) {
    const a = Math.sin(t * Math.PI); // 0→1→0
    if (a <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 2);
    ctx.globalAlpha = a;
    ctx.strokeStyle = '#fff7c9';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * U.TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(ang) * r * 0.25, Math.sin(ang) * r * 0.25);
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
      ctx.stroke();
    }
    ctx.fillStyle = '#fffef0';
    ctx.beginPath(); ctx.arc(0, 0, r * 0.16, 0, U.TAU); ctx.fill();
    ctx.restore();
  }
};
