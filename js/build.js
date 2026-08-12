/* ============================================================
   ぬいぬい！ フェルトタウン — build.js
   子どもの「一本の線」と「一点」から作品を自動で仕立てる
   すべてボード空間（1000x1000）で生成・描画する
   ============================================================ */
'use strict';

// 選べる3色（フェルト・糸のパレット）
const PALETTES = [
  { id: 'pink',     main: '#ff9ec6', light: '#ffd9e9', dark: '#e2679f', accent: '#ffe27a', ui: '#ff9ec6' },
  { id: 'mint',     main: '#7fd8b8', light: '#d2f4e6', dark: '#3fae87', accent: '#ffb7d2', ui: '#7fd8b8' },
  { id: 'lavender', main: '#b9a2ea', light: '#e6dbfa', dark: '#8a6cd0', accent: '#ffd3e4', ui: '#b9a2ea' }
];

const BOARD = 1000;          // ボード空間の一辺
const GROUND = 830;          // 地面ライン

const Build = {

  // 点列を法線方向にオフセット（橋の板・屋根の厚みなどに使う）
  offset(pts, d) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      const ang = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
      out.push({ x: pts[i].x + Math.cos(ang) * d, y: pts[i].y + Math.sin(ang) * d });
    }
    return out;
  },

  // 作品データを作る（保存対象。描画パラメータはすべてここで確定）
  make(spotId, rawStroke, dot, colorIdx, seed) {
    const an = U.analyzeStroke(rawStroke);
    const stroke = U.resample(U.smooth(an.pts, 2), 64);
    return {
      spotId, colorIdx, seed,
      stroke,                       // 平滑化済みの子どもの線（ボード空間）
      dot: { x: dot.x, y: dot.y },
      an: {
        len: an.len, curvy: an.curvy, wavy: an.wavy,
        pointy: an.pointy, round: an.round, bbox: an.bbox
      }
    };
  },

  // 完成品を描く
  // t: 仕立てアニメの進行 0..1（町では常に1）
  // time: 常時アニメ用の経過秒（煙・蝶・旗ゆれ）
  draw(ctx, item, t, time) {
    const gen = this.GEN[item.spotId];
    if (gen) gen.call(this, ctx, item, U.clamp(t, 0, 1), time || 0);
  },

  // 区間ヘルパー：t0..t1 をイージング付き 0..1 に
  k(t, t0, t1, ease) { return (ease || U.easeOutCubic)(U.span(t, t0, t1)); },

  // フェルト片をアンカーからぽよんと生やす共通処理
  grow(ctx, t, t0, t1, ax, ay, fn) {
    const k = U.span(t, t0, t1);
    if (k <= 0) return;
    const s = k >= 1 ? 1 : U.easeOutBack(k);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.scale(Math.max(0.001, s), Math.max(0.001, s));
    ctx.translate(-ax, -ay);
    ctx.globalAlpha *= Math.min(1, k * 3);
    fn();
    ctx.restore();
  },

  // 子どもの線：糸→ぬい目化の演出つきで最前面に描く
  childLine(ctx, item, t, color, width) {
    const trace = this.k(t, 0, 0.22);
    Felt.yarn(ctx, item.stroke, color, width || 20, t < 0.22 ? trace : 1);
    // ぬい目のオーバーレイ（線が「縫われた」ことを示す）
    if (t > 0.06) {
      Felt.stitchLine(ctx, item.stroke, 'rgba(255,255,255,0.85)', 3.2, this.k(t, 0.06, 0.3));
    }
  },

  // 完成後のきらきら
  sparkles(ctx, item, t, time, cx, cy, r) {
    if (t < 0.8) return;
    const rnd = U.mulberry32(item.seed + 55);
    for (let i = 0; i < 8; i++) {
      const a = rnd() * U.TAU, rr = r * (0.4 + rnd() * 0.8);
      const ph = (time * 0.9 + rnd() * 2) % 2;
      if (ph < 1) {
        Felt.sparkle(ctx, cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, 16 + rnd() * 10, ph);
      }
    }
  },

  GEN: {

    /* ============ A：ふわふわハウス ============
       線 = 屋根の稜線・飾り縫い / 点 = ドア or ボタン窓 */
    house(ctx, item, t, time) {
      const P = PALETTES[item.colorIdx];
      const B = this;
      const bb = item.an.bbox;
      const rnd = U.mulberry32(item.seed);

      // 家の横幅は線の広がりから（長い線→大きな家）
      const w = U.clamp(bb.w * 1.05, 300, 760);
      const cx = U.clamp(bb.x + bb.w / 2, 240, 760);
      const roofBase = U.clamp(bb.y + bb.h + 20, 330, 640);
      const x0 = cx - w / 2, x1 = cx + w / 2;
      const wallCol = P.light, roofCol = P.main;

      // --- 壁（地面から生える）---
      Build.grow(ctx, t, 0.15, 0.5, cx, GROUND, () => {
        Felt.piece(ctx, Felt.rrect(x0, roofBase, w, GROUND - roofBase, 26), wallCol,
          { stitchColor: U.rgba(P.dark, 0.65) });
      });

      // --- 屋根（子どもの線の真下に布が張られる）---
      const roofPoly = item.stroke.slice();
      roofPoly.push({ x: Math.max(x1 + 24, item.stroke[63].x), y: roofBase + 14 });
      roofPoly.push({ x: Math.min(x0 - 24, item.stroke[0].x), y: roofBase + 14 });
      const apex = U.pointAt(item.stroke, 0.5);
      Build.grow(ctx, t, 0.3, 0.62, apex.x, roofBase + 10, () => {
        Felt.piece(ctx, Felt.poly(roofPoly), roofCol, { stitchColor: 'rgba(255,255,255,0.9)' });
      });

      // --- 窓（丸いボタン窓を左右に）---
      const winY = U.lerp(roofBase, GROUND, 0.38);
      const winR = U.clamp(w * 0.09, 26, 46);
      const doorMode = item.dot.y > U.lerp(roofBase, GROUND, 0.45) && t >= 0; // 点が下半分ならドア
      const winXs = doorMode ? [x0 + w * 0.24, x1 - w * 0.24] : [x0 + w * 0.24];
      winXs.forEach((wx, i) => {
        Build.grow(ctx, t, 0.5 + i * 0.06, 0.72 + i * 0.06, wx, winY, () => {
          ctx.beginPath(); ctx.arc(wx, winY, winR + 8, 0, U.TAU);
          ctx.fillStyle = U.shade(wallCol, -0.1); ctx.fill();
          ctx.beginPath(); ctx.arc(wx, winY, winR, 0, U.TAU);
          ctx.fillStyle = '#fdf8e8'; ctx.fill();
          ctx.strokeStyle = P.dark; ctx.lineWidth = 4;
          ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
          // 窓の十字桟
          ctx.strokeStyle = U.rgba(P.dark, 0.6); ctx.lineWidth = 3; ctx.setLineDash([]);
          ctx.beginPath(); ctx.moveTo(wx - winR, winY); ctx.lineTo(wx + winR, winY);
          ctx.moveTo(wx, winY - winR); ctx.lineTo(wx, winY + winR); ctx.stroke();
        });
      });

      // --- 点 → ドア or ボタン窓 ---
      const doorW = U.clamp(w * 0.24, 80, 130);
      if (doorMode) {
        const dx = U.clamp(item.dot.x, x0 + doorW / 2 + 20, x1 - doorW / 2 - 20);
        item._doorX = dx;
        Build.grow(ctx, t, 0.58, 0.8, dx, GROUND, () => {
          const dh = doorW * 1.5;
          const fn = (c) => {
            c.beginPath();
            c.moveTo(dx - doorW / 2, GROUND);
            c.lineTo(dx - doorW / 2, GROUND - dh + doorW / 2);
            c.arc(dx, GROUND - dh + doorW / 2, doorW / 2, Math.PI, 0);
            c.lineTo(dx + doorW / 2, GROUND);
            c.closePath();
          };
          Felt.piece(ctx, fn, P.main, { stitchColor: 'rgba(255,255,255,0.9)' });
          Felt.button(ctx, dx + doorW * 0.22, GROUND - dh * 0.42, doorW * 0.14, P.accent, 1);
        });
      } else {
        // 上のほうに置いたら 大きなボタン窓
        const wx = U.clamp(item.dot.x, x0 + winR + 24, x1 - winR - 24);
        const wy = U.clamp(item.dot.y, roofBase - 40, GROUND - winR - 30);
        Build.grow(ctx, t, 0.62, 0.82, wx, wy, () => {
          Felt.button(ctx, wx, wy, winR * 1.25, P.accent, 1);
        });
        item._doorX = cx;
      }

      // --- 屋根のスカラップ縁飾り（線に沿って）---
      Felt.scallopTrim(ctx, Build.offset(item.stroke, 16), 15, '#fffdf5', B.k(t, 0.55, 0.8));

      // --- えんとつ + 綿のけむり ---
      const chX = U.clamp(apex.x + w * 0.22, x0 + 60, x1 - 40);
      const chTop = U.pointAt(item.stroke, 0.72).y - 10;
      Build.grow(ctx, t, 0.66, 0.84, chX, chTop + 60, () => {
        Felt.piece(ctx, Felt.rrect(chX - 26, chTop - 60, 52, 90, 10), P.dark,
          { stitchColor: 'rgba(255,255,255,0.8)' });
      });
      if (t > 0.85) {
        for (let i = 0; i < 3; i++) {
          const ph = ((time * 0.25 + i * 0.33) % 1);
          ctx.save();
          ctx.globalAlpha = (1 - ph) * 0.9;
          Felt.cotton(ctx, chX + Math.sin(time + i * 2) * 14, chTop - 70 - ph * 130,
            26 + ph * 30, 0.6 + ph * 0.5, item.seed + i);
          ctx.restore();
        }
      }

      // --- ハートの壁飾り ---
      Felt.heart(ctx, x0 + w * 0.5, winY + 6, 15, P.accent, B.k(t, 0.78, 0.9, U.easeOutBack));

      // --- 子どもの線（屋根の飾り縫いとして必ず残る）---
      B.childLine(ctx, item, t, P.dark);
      B.sparkles(ctx, item, t, time, cx, (roofBase + GROUND) / 2, w * 0.55);
    },

    /* ============ B：おはなガーデン ============
       線 = 茎・飾り草のライン / 点 = 大きなボタン花の中心 */
    garden(ctx, item, t, time) {
      const P = PALETTES[item.colorIdx];
      const B = this;
      const rnd = U.mulberry32(item.seed);
      const stemCol = '#69b96e';

      // --- 花壇（フェルトの土台）---
      const bedY = GROUND - 60;
      Build.grow(ctx, t, 0.12, 0.4, 500, GROUND, () => {
        Felt.piece(ctx, Felt.rrect(120, bedY, 760, 130, 46), '#a5794f',
          { stitchColor: 'rgba(255,244,220,0.85)' });
        Felt.piece(ctx, Felt.rrect(160, bedY - 26, 680, 60, 30), '#8fce8f',
          { stitchColor: 'rgba(255,255,255,0.7)', shadowY: 3 });
      });

      // --- 茎（子どもの線が緑の糸で縫われる）---
      const stemTrace = B.k(t, 0.05, 0.3);
      Felt.yarn(ctx, item.stroke, stemCol, 18, stemTrace);

      // --- 葉っぱ（線に沿って交互に）---
      const leafN = U.clamp(Math.round(item.an.len / 150), 2, 6);
      for (let i = 0; i < leafN; i++) {
        const q = U.pointAt(item.stroke, (i + 0.6) / (leafN + 1));
        const dir = i % 2 === 0 ? -1 : 1;
        Build.grow(ctx, t, 0.3 + i * 0.04, 0.5 + i * 0.04, q.x, q.y, () => {
          ctx.save();
          ctx.translate(q.x, q.y);
          ctx.rotate(q.ang + dir * 1.1);
          ctx.beginPath();
          ctx.ellipse(34, 0, 34, 15, 0, 0, U.TAU);
          ctx.fillStyle = '#8fce8f'; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]); ctx.stroke(); ctx.setLineDash([]);
          ctx.strokeStyle = 'rgba(60,120,70,0.5)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(60, 0); ctx.stroke();
          ctx.restore();
        });
      }

      // --- 花（線に沿って咲く。波線→花びら多め、尖り→星型花）---
      const flowerN = U.clamp(Math.round(item.an.len / 200) + 1, 2, 6);
      const petals = item.an.pointy > 0.5 ? 5 : (item.an.wavy > 0.4 ? 8 : 6);
      for (let i = 0; i < flowerN; i++) {
        const ti = flowerN === 1 ? 0 : i / (flowerN - 1);
        const q = U.pointAt(item.stroke, ti);
        const r = 34 + rnd() * 16;
        const col = i % 2 === 0 ? P.main : P.accent;
        const k = B.k(t, 0.42 + i * 0.05, 0.62 + i * 0.05, U.easeOutElastic);
        const sway = Math.sin(time * 1.3 + i) * 0.05;
        Felt.flower(ctx, q.x, q.y, r, col, i % 2 === 0 ? P.accent : P.main, petals, k, sway);
      }

      // --- 点 → いちばん大きなボタン花 ---
      const k = B.k(t, 0.68, 0.88, U.easeOutElastic);
      const sway = Math.sin(time * 1.1) * 0.04;
      Felt.flower(ctx, item.dot.x, item.dot.y, 62, P.light, P.main, petals, k, sway);

      // --- ぬい目オーバーレイ（子どもの線を選んだ色で残す）---
      if (t > 0.06) {
        Felt.stitchLine(ctx, item.stroke, U.rgba(P.main, 0.95), 3.4, B.k(t, 0.06, 0.3));
      }

      // --- 蝶（完成後にひらひら）---
      if (t > 0.9) {
        for (let i = 0; i < 2; i++) {
          const a = time * (0.5 + i * 0.17) + i * 3;
          const bx = item.dot.x + Math.cos(a) * (130 + i * 60);
          const by = item.dot.y - 60 + Math.sin(a * 1.7) * 70;
          const flap = Math.sin(time * 14 + i) * 0.6;
          ctx.save();
          ctx.translate(bx, by);
          for (const d of [-1, 1]) {
            ctx.save();
            ctx.scale(d * Math.max(0.25, Math.cos(flap)), 1);
            ctx.beginPath();
            ctx.ellipse(10, -4, 11, 7, -0.4, 0, U.TAU);
            ctx.ellipse(9, 6, 8, 6, 0.4, 0, U.TAU);
            ctx.fillStyle = i === 0 ? P.accent : '#fff'; ctx.fill();
            ctx.restore();
          }
          ctx.fillStyle = '#5a3b52';
          ctx.beginPath(); ctx.ellipse(0, 0, 2.5, 8, 0, 0, U.TAU); ctx.fill();
          ctx.restore();
        }
      }
      B.sparkles(ctx, item, t, time, item.dot.x, item.dot.y, 160);
    },

    /* ============ C：りぼんショップ ============
       線 = 看板リボン・屋根の縁飾り / 点 = ボタン飾り */
    shop(ctx, item, t, time) {
      const P = PALETTES[item.colorIdx];
      const B = this;
      const bb = item.an.bbox;
      const w = U.clamp(bb.w * 1.1, 340, 720);
      const cx = U.clamp(bb.x + bb.w / 2, 260, 740);
      const x0 = cx - w / 2, x1 = cx + w / 2;
      const topY = U.clamp(bb.y + bb.h + 30, 320, 560);

      // --- 店の箱 ---
      Build.grow(ctx, t, 0.15, 0.48, cx, GROUND, () => {
        Felt.piece(ctx, Felt.rrect(x0, topY, w, GROUND - topY, 24), '#fdf3e3',
          { stitchColor: U.rgba(P.dark, 0.6) });
      });

      // --- ひさし（ストライプのオーニング）---
      const awnY = U.lerp(topY, GROUND, 0.42);
      const awnH = 66;
      Build.grow(ctx, t, 0.34, 0.6, cx, awnY, () => {
        const seg = 8;
        for (let i = 0; i < seg; i++) {
          const sx = x0 - 16 + (w + 32) * i / seg;
          const sw = (w + 32) / seg;
          ctx.beginPath();
          ctx.moveTo(sx, awnY);
          ctx.lineTo(sx + sw, awnY);
          ctx.lineTo(sx + sw, awnY + awnH - 14);
          ctx.arc(sx + sw / 2, awnY + awnH - 14, sw / 2, 0, Math.PI);
          ctx.closePath();
          ctx.fillStyle = i % 2 === 0 ? P.main : '#fffdf5';
          ctx.fill();
          ctx.strokeStyle = U.rgba(P.dark, 0.35); ctx.lineWidth = 2; ctx.stroke();
        }
      });

      // --- ショーウィンドウ ---
      Build.grow(ctx, t, 0.48, 0.68, cx, U.lerp(awnY, GROUND, 0.55), () => {
        const wy = awnY + awnH + 14;
        const wh = GROUND - wy - 34;
        Felt.piece(ctx, Felt.rrect(cx - w * 0.32, wy, w * 0.64, wh, 20), '#fdf8e8',
          { stitchColor: U.rgba(P.dark, 0.7) });
        // 窓の中の小物（リボンとハート）
        Felt.bow(ctx, cx - w * 0.15, wy + wh * 0.5, 34, P.accent, 1);
        Felt.heart(ctx, cx + w * 0.15, wy + wh * 0.5, 16, P.main, 1);
      });

      // --- 看板リボン（子どもの線に布の帯が張られる）---
      const bandK = B.k(t, 0.3, 0.58);
      if (bandK > 0) {
        const n = Math.max(2, Math.floor(item.stroke.length * bandK));
        const part = item.stroke.slice(0, n);
        const up = Build.offset(part, -26), dn = Build.offset(part, 26);
        const poly = up.concat(dn.slice().reverse());
        Felt.piece(ctx, Felt.poly(poly), P.light, { stitchColor: U.rgba(P.dark, 0.8), shadowY: 4 });
      }
      // リボン帯のスカラップ縁
      Felt.scallopTrim(ctx, Build.offset(item.stroke, 30), 13, P.main, B.k(t, 0.55, 0.78));
      // 両端にちょうちょ結び
      const e0 = item.stroke[0], e1 = item.stroke[63];
      Felt.bow(ctx, e0.x, e0.y, 46, P.main, B.k(t, 0.6, 0.78, U.easeOutBack));
      Felt.bow(ctx, e1.x, e1.y, 46, P.main, B.k(t, 0.66, 0.84, U.easeOutBack));

      // --- ドア ---
      const doorW = 100;
      item._doorX = cx;
      Build.grow(ctx, t, 0.52, 0.72, cx, GROUND, () => {
        const dh = 150;
        const fn = (c) => {
          c.beginPath();
          c.moveTo(cx - doorW / 2, GROUND);
          c.lineTo(cx - doorW / 2, GROUND - dh + doorW / 2);
          c.arc(cx, GROUND - dh + doorW / 2, doorW / 2, Math.PI, 0);
          c.lineTo(cx + doorW / 2, GROUND);
          c.closePath();
        };
        Felt.piece(ctx, fn, P.main, { stitchColor: 'rgba(255,255,255,0.9)' });
      });

      // --- 点 → 大きなボタン飾り ---
      const bk = B.k(t, 0.74, 0.9, U.easeOutElastic);
      Felt.button(ctx, item.dot.x, item.dot.y, 44, P.accent, bk);

      // --- 子どもの線（看板の縫いラインとして残る）---
      B.childLine(ctx, item, t, P.dark, 17);
      B.sparkles(ctx, item, t, time, cx, awnY, w * 0.5);
    },

    /* ============ D：ふわふわブリッジ ============
       線 = 橋のアーチ / 点 = 中央の旗・ボタン */
    bridge(ctx, item, t, time) {
      const P = PALETTES[item.colorIdx];
      const B = this;

      // --- 川（水色のフェルト帯 + 波ステッチ）---
      Build.grow(ctx, t, 0.1, 0.34, 500, GROUND, () => {
        Felt.piece(ctx, Felt.rrect(40, GROUND - 130, 920, 190, 60), '#a8dcf0',
          { stitchColor: 'rgba(255,255,255,0.75)', shadowY: 3 });
        // 波の刺繍
        for (let r = 0; r < 3; r++) {
          const wy = GROUND - 100 + r * 46;
          const wave = [];
          for (let i = 0; i <= 30; i++) {
            const wx2 = 90 + (820 / 30) * i;
            wave.push({ x: wx2, y: wy + Math.sin(i * 0.8 + r * 2) * 8 });
          }
          Felt.stitchLine(ctx, wave, 'rgba(255,255,255,0.8)', 3, 1, [8, 8]);
        }
      });

      // --- 橋げた（アーチの下の支え）---
      const deck = item.stroke;
      const mid = U.pointAt(deck, 0.5);
      [0.2, 0.8].forEach((ti, i) => {
        const q = U.pointAt(deck, ti);
        Build.grow(ctx, t, 0.3 + i * 0.05, 0.5 + i * 0.05, q.x, GROUND + 20, () => {
          Felt.piece(ctx, Felt.rrect(q.x - 30, q.y, 60, GROUND + 30 - q.y, 14), P.dark,
            { stitch: false, shadowY: 2 });
        });
      });

      // --- 橋の本体（子どもの線に沿った布の帯）---
      const bodyK = B.k(t, 0.26, 0.56);
      if (bodyK > 0) {
        const n = Math.max(2, Math.floor(deck.length * bodyK));
        const part = deck.slice(0, n);
        const up = Build.offset(part, -20), dn = Build.offset(part, 34);
        Felt.piece(ctx, Felt.poly(up.concat(dn.slice().reverse())), P.main,
          { stitchColor: 'rgba(255,255,255,0.85)' });
      }

      // --- 板のステッチ（まくら木のように）---
      const plankN = U.clamp(Math.round(item.an.len / 70), 6, 16);
      const plankK = B.k(t, 0.5, 0.72);
      for (let i = 0; i < Math.floor(plankN * plankK); i++) {
        const q = U.pointAt(deck, (i + 0.5) / plankN);
        const a = q.ang + Math.PI / 2;
        Felt.stitchLine(ctx, [
          { x: q.x + Math.cos(a) * -16, y: q.y + Math.sin(a) * -16 },
          { x: q.x + Math.cos(a) * 30, y: q.y + Math.sin(a) * 30 }
        ], U.rgba(P.light, 0.95), 4, 1, [6, 5]);
      }

      // --- らんかん（支柱 + 上のロープ糸）---
      const postN = 5;
      for (let i = 0; i < postN; i++) {
        const ti = i / (postN - 1);
        const q = U.pointAt(deck, U.lerp(0.04, 0.96, ti));
        Build.grow(ctx, t, 0.56 + i * 0.03, 0.7 + i * 0.03, q.x, q.y, () => {
          Felt.piece(ctx, Felt.rrect(q.x - 9, q.y - 66, 18, 66, 8), P.dark,
            { stitch: false, shadowY: 2 });
          Felt.button(ctx, q.x, q.y - 70, 11, P.accent, 1);
        });
      }
      // 手すりロープ（支柱の頭を結ぶ、たわむ糸）
      const ropeK = B.k(t, 0.68, 0.84);
      if (ropeK > 0) {
        const rope = [];
        for (let i = 0; i <= 24; i++) {
          const ti = U.lerp(0.04, 0.96, i / 24);
          const q = U.pointAt(deck, ti);
          const sag = Math.sin((i / 24) * Math.PI * (postN - 1)) * 0;
          rope.push({ x: q.x, y: q.y - 66 + Math.abs(Math.sin(i / 24 * Math.PI * 4)) * 10 });
        }
        Felt.yarn(ctx, rope, P.accent, 7, ropeK);
      }

      // --- 点 → 旗（点が高い位置）or 大ボタン（低い位置）---
      const dq = U.pointAt(deck, 0.5);
      const flagMode = item.dot.y < dq.y - 30;
      if (flagMode) {
        const fx = U.clamp(item.dot.x, 150, 850);
        const fy = Math.min(item.dot.y, dq.y - 60);
        const fk = B.k(t, 0.76, 0.92, U.easeOutBack);
        if (fk > 0.01) {
          const near = U.pointAt(deck, U.clamp((fx - deck[0].x) / Math.max(deck[63].x - deck[0].x, 1), 0.1, 0.9));
          ctx.save();
          ctx.globalAlpha = Math.min(1, fk * 2);
          Felt.stitchLine(ctx, [near, { x: fx, y: fy }], U.rgba(P.dark, 0.9), 4, fk, [7, 6]);
          const wob = Math.sin(time * 3) * 8;
          ctx.beginPath();
          ctx.moveTo(fx, fy);
          ctx.quadraticCurveTo(fx + 45, fy + 12 + wob * 0.4, fx + 78, fy + 6 + wob);
          ctx.quadraticCurveTo(fx + 45, fy + 30 + wob * 0.4, fx, fy + 42);
          ctx.closePath();
          ctx.fillStyle = P.main; ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2.4;
          ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
          Felt.heart(ctx, fx + 34, fy + 21 + wob * 0.5, 10, '#fff', 1);
          Felt.button(ctx, fx, fy, 12, P.accent, fk);
          ctx.restore();
        }
      } else {
        Felt.button(ctx, item.dot.x, item.dot.y, 40, P.accent, B.k(t, 0.76, 0.92, U.easeOutElastic));
      }

      // --- 子どもの線（アーチの縫いラインとして残る）---
      B.childLine(ctx, item, t, P.dark, 19);
      B.sparkles(ctx, item, t, time, mid.x, mid.y - 40, 220);
    }
  }
};
