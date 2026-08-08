/* ------------------------------------------------------------------
   tex.js — 手続き的なマテリアル（アルベド／法線／ラフネス）
   すべて Canvas で焼いて THREE.CanvasTexture にする。外部画像は使わない。
   実物の材質応答を出すために、色だけでなく凹凸（法線）と粗さも作る。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const T = (PZ.tex = {});
  const TAU = Math.PI * 2;

  /* ---------- 値ノイズ ---------- */
  function noiseField(seed) {
    const r = U.mulberry32(seed);
    const S = 256;
    const g = new Float32Array(S * S);
    for (let i = 0; i < S * S; i++) g[i] = r();
    return function (x, y) {
      x = x - Math.floor(x / S) * S;
      y = y - Math.floor(y / S) * S;
      const x0 = Math.floor(x), y0 = Math.floor(y);
      const fx = x - x0, fy = y - y0;
      const x1 = (x0 + 1) % S, y1 = (y0 + 1) % S;
      const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
      const a = g[y0 * S + x0], b = g[y0 * S + x1], c = g[y1 * S + x0], d = g[y1 * S + x1];
      return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
    };
  }

  function fbm(nf, x, y, oct, lac, gain) {
    let s = 0, a = 0.5, f = 1, tot = 0;
    for (let i = 0; i < (oct || 4); i++) {
      s += nf(x * f, y * f) * a;
      tot += a;
      f *= (lac || 2.03); a *= (gain || 0.5);
    }
    return s / tot;
  }

  /* ---------- キャンバス生成 ---------- */
  function cv(size) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    return c;
  }
  T.cv = cv;

  function texture(canvas, repeat, srgb) {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 8;
    if (repeat) t.repeat.set(repeat[0], repeat[1]);
    if (srgb) t.encoding = THREE.sRGBEncoding;
    t.needsUpdate = true;
    return t;
  }
  T.texture = texture;

  /* 高さマップ（グレースケール canvas）から法線マップを作る */
  T.normalFromHeight = function (heightCanvas, strength) {
    const S = heightCanvas.width;
    const src = heightCanvas.getContext('2d').getImageData(0, 0, S, S).data;
    const out = cv(S);
    const ctx = out.getContext('2d');
    const img = ctx.createImageData(S, S);
    const d = img.data;
    const k = strength === undefined ? 2.2 : strength;
    const at = (x, y) => src[(((y + S) % S) * S + ((x + S) % S)) * 4] / 255;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const dx = (at(x - 1, y) - at(x + 1, y)) * k;
        const dy = (at(x, y - 1) - at(x, y + 1)) * k;
        let nx = dx, ny = dy, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        nx /= l; ny /= l; nz /= l;
        const i = (y * S + x) * 4;
        d[i] = (nx * 0.5 + 0.5) * 255;
        d[i + 1] = (ny * 0.5 + 0.5) * 255;
        d[i + 2] = (nz * 0.5 + 0.5) * 255;
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    return out;
  };

  /* グレースケール canvas をそのままラフネス／AO に使う */
  T.gray = function (canvas, repeat) {
    return texture(canvas, repeat, false);
  };

  /* ================================================================
     レンガ壁（目地・欠け・すす）
  ================================================================ */
  T.bricks = function (opt) {
    opt = opt || {};
    const S = 512;
    const alb = cv(S), hei = cv(S), rou = cv(S);
    const a = alb.getContext('2d'), h = hei.getContext('2d'), r = rou.getContext('2d');
    const nf = noiseField(opt.seed || 3);
    const rows = opt.rows || 8, cols = opt.cols || 4;
    const bh = S / rows, bw = S / cols;
    const mortar = opt.mortar || '#b9a894';

    a.fillStyle = mortar; a.fillRect(0, 0, S, S);
    h.fillStyle = '#3a3a3a'; h.fillRect(0, 0, S, S);
    r.fillStyle = '#c8c8c8'; r.fillRect(0, 0, S, S);

    const base = opt.base || [150, 78, 56];
    const rnd = U.mulberry32((opt.seed || 3) * 77 + 5);
    for (let iy = -1; iy <= rows; iy++) {
      const off = (iy % 2) ? bw * 0.5 : 0;
      for (let ix = -1; ix <= cols; ix++) {
        const x = ix * bw + off + 3, y = iy * bh + 3;
        const w = bw - 6, hh = bh - 6;
        const v = rnd();
        const col = [
          U.clamp(base[0] + (v - 0.5) * 46, 0, 255),
          U.clamp(base[1] + (v - 0.5) * 34, 0, 255),
          U.clamp(base[2] + (v - 0.5) * 28, 0, 255)
        ];
        a.fillStyle = U.css(col);
        U.roundRect(a, x, y, w, hh, 5); a.fill();
        h.fillStyle = 'rgb(' + (188 + v * 40 | 0) + ',' + (188 + v * 40 | 0) + ',' + (188 + v * 40 | 0) + ')';
        U.roundRect(h, x, y, w, hh, 5); h.fill();
        r.fillStyle = 'rgb(' + (150 + v * 60 | 0) + ',0,0)';
        U.roundRect(r, x, y, w, hh, 5); r.fill();
        // 角の欠け
        if (rnd() < 0.28) {
          const cxp = x + (rnd() < 0.5 ? 0 : w), cyp = y + (rnd() < 0.5 ? 0 : hh);
          a.fillStyle = mortar;
          a.beginPath(); a.arc(cxp, cyp, 4 + rnd() * 9, 0, TAU); a.fill();
          h.fillStyle = '#4a4a4a';
          h.beginPath(); h.arc(cxp, cyp, 4 + rnd() * 9, 0, TAU); h.fill();
        }
      }
    }
    // 表面のざらつき
    const ai = a.getImageData(0, 0, S, S), hi = h.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const n = fbm(nf, x * 0.09, y * 0.09, 4) - 0.5;
        const n2 = fbm(nf, x * 0.5, y * 0.5, 2) - 0.5;
        const i = (y * S + x) * 4;
        const k = n * 34 + n2 * 16;
        ai.data[i] = U.clamp(ai.data[i] + k, 0, 255);
        ai.data[i + 1] = U.clamp(ai.data[i + 1] + k * 0.9, 0, 255);
        ai.data[i + 2] = U.clamp(ai.data[i + 2] + k * 0.8, 0, 255);
        hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = U.clamp(hi.data[i] + k * 0.8, 0, 255);
      }
    }
    a.putImageData(ai, 0, 0); h.putImageData(hi, 0, 0);
    return { albedo: alb, height: hei, rough: rou };
  };

  /* ================================================================
     漆喰・スタッコ（窯のドーム／壁）
  ================================================================ */
  T.stucco = function (opt) {
    opt = opt || {};
    const S = 512;
    const alb = cv(S), hei = cv(S), rou = cv(S);
    const a = alb.getContext('2d'), h = hei.getContext('2d'), r = rou.getContext('2d');
    const nf = noiseField(opt.seed || 11);
    const base = opt.base || [226, 206, 180];
    const ai = a.createImageData(S, S), hi = h.createImageData(S, S), ri = r.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const n = fbm(nf, x * 0.035, y * 0.035, 5);
        const grit = fbm(nf, x * 0.9 + 40, y * 0.9, 2);
        const k = (n - 0.5) * 30 + (grit - 0.5) * 22;
        ai.data[i] = U.clamp(base[0] + k, 0, 255);
        ai.data[i + 1] = U.clamp(base[1] + k * 0.97, 0, 255);
        ai.data[i + 2] = U.clamp(base[2] + k * 0.92, 0, 255);
        ai.data[i + 3] = 255;
        const hv = 128 + (n - 0.5) * 120 + (grit - 0.5) * 90;
        hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = U.clamp(hv, 0, 255);
        hi.data[i + 3] = 255;
        const rv = 205 + (grit - 0.5) * 60;
        ri.data[i] = U.clamp(rv, 0, 255); ri.data[i + 3] = 255;
      }
    }
    a.putImageData(ai, 0, 0); h.putImageData(hi, 0, 0); r.putImageData(ri, 0, 0);
    return { albedo: alb, height: hei, rough: rou };
  };

  /* ================================================================
     木（板目）— オーク／バーチを引数で
  ================================================================ */
  T.wood = function (opt) {
    opt = opt || {};
    const S = 512;
    const alb = cv(S), hei = cv(S), rou = cv(S);
    const a = alb.getContext('2d'), h = hei.getContext('2d'), r = rou.getContext('2d');
    const nf = noiseField(opt.seed || 21);
    const light = opt.light || [206, 166, 112];
    const dark = opt.dark || [140, 96, 52];
    const rings = opt.rings || 26;
    const ai = a.createImageData(S, S), hi = h.createImageData(S, S), ri = r.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        // 年輪：横方向に流れる縞をノイズでゆがめる
        const warp = fbm(nf, x * 0.012, y * 0.05, 4) * 42;
        const v = (y + warp) / S * rings;
        let g = Math.abs(Math.sin(v * Math.PI));
        g = Math.pow(g, 0.55);
        const fine = fbm(nf, x * 0.5, y * 2.2, 3) - 0.5;
        const t = U.clamp(g * 0.8 + fine * 0.35 + 0.1, 0, 1);
        const c = U.mixColor(light, dark, t);
        ai.data[i] = c[0]; ai.data[i + 1] = c[1]; ai.data[i + 2] = c[2]; ai.data[i + 3] = 255;
        const hv = 150 - t * 70 + fine * 40;
        hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = U.clamp(hv, 0, 255);
        hi.data[i + 3] = 255;
        const rv = (opt.roughBase || 190) + t * 40 + fine * 25;
        ri.data[i] = U.clamp(rv, 0, 255); ri.data[i + 3] = 255;
      }
    }
    a.putImageData(ai, 0, 0); h.putImageData(hi, 0, 0); r.putImageData(ri, 0, 0);
    // 板の継ぎ目
    if (opt.planks) {
      a.strokeStyle = 'rgba(40,22,10,0.55)'; a.lineWidth = 3;
      h.strokeStyle = '#2a2a2a'; h.lineWidth = 4;
      for (let i = 1; i < opt.planks; i++) {
        const yy = (i / opt.planks) * S;
        a.beginPath(); a.moveTo(0, yy); a.lineTo(S, yy); a.stroke();
        h.beginPath(); h.moveTo(0, yy); h.lineTo(S, yy); h.stroke();
      }
    }
    return { albedo: alb, height: hei, rough: rou };
  };

  /* ================================================================
     大理石（作業台の天板）
  ================================================================ */
  T.marble = function (opt) {
    opt = opt || {};
    const S = 512;
    const alb = cv(S), hei = cv(S), rou = cv(S);
    const a = alb.getContext('2d'), h = hei.getContext('2d'), r = rou.getContext('2d');
    const nf = noiseField(opt.seed || 31);
    const ai = a.createImageData(S, S), hi = h.createImageData(S, S), ri = r.createImageData(S, S);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = (y * S + x) * 4;
        const w = fbm(nf, x * 0.01, y * 0.01, 5) * 6.0;
        const vein = Math.abs(Math.sin((x * 0.012 + y * 0.006 + w) * Math.PI));
        const v2 = Math.pow(1 - vein, 8);
        const spec = fbm(nf, x * 0.28, y * 0.28, 3) - 0.5;
        const base = 236 + spec * 14;
        const c = base - v2 * 62;
        ai.data[i] = U.clamp(c + 4, 0, 255);
        ai.data[i + 1] = U.clamp(c + 1, 0, 255);
        ai.data[i + 2] = U.clamp(c - 4, 0, 255);
        ai.data[i + 3] = 255;
        hi.data[i] = hi.data[i + 1] = hi.data[i + 2] = U.clamp(140 + spec * 30 - v2 * 20, 0, 255);
        hi.data[i + 3] = 255;
        ri.data[i] = U.clamp(66 + spec * 40 + v2 * 40, 0, 255); ri.data[i + 3] = 255;
      }
    }
    a.putImageData(ai, 0, 0); h.putImageData(hi, 0, 0); r.putImageData(ri, 0, 0);
    return { albedo: alb, height: hei, rough: rou };
  };

  /* ================================================================
     テラコッタの床タイル
  ================================================================ */
  T.floorTiles = function (opt) {
    opt = opt || {};
    const S = 512;
    const alb = cv(S), hei = cv(S), rou = cv(S);
    const a = alb.getContext('2d'), h = hei.getContext('2d'), r = rou.getContext('2d');
    const nf = noiseField(opt.seed || 41);
    const n = opt.n || 3, t = S / n;
    a.fillStyle = '#8a7a68'; a.fillRect(0, 0, S, S);
    h.fillStyle = '#3c3c3c'; h.fillRect(0, 0, S, S);
    r.fillStyle = '#d2d2d2'; r.fillRect(0, 0, S, S);
    const rnd = U.mulberry32(7);
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const v = rnd();
        const c = [174 + v * 34, 104 + v * 26, 74 + v * 20];
        a.fillStyle = U.css(c);
        U.roundRect(a, ix * t + 5, iy * t + 5, t - 10, t - 10, 7); a.fill();
        h.fillStyle = 'rgb(' + (196 + v * 30 | 0) + ',' + (196 + v * 30 | 0) + ',' + (196 + v * 30 | 0) + ')';
        U.roundRect(h, ix * t + 5, iy * t + 5, t - 10, t - 10, 7); h.fill();
        r.fillStyle = 'rgb(' + (120 + v * 60 | 0) + ',0,0)';
        U.roundRect(r, ix * t + 5, iy * t + 5, t - 10, t - 10, 7); r.fill();
      }
    }
    const ai = a.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const k = (fbm(nf, x * 0.06, y * 0.06, 4) - 0.5) * 40;
      ai.data[i] = U.clamp(ai.data[i] + k, 0, 255);
      ai.data[i + 1] = U.clamp(ai.data[i + 1] + k * 0.9, 0, 255);
      ai.data[i + 2] = U.clamp(ai.data[i + 2] + k * 0.8, 0, 255);
    }
    a.putImageData(ai, 0, 0);
    return { albedo: alb, height: hei, rough: rou };
  };

  /* ================================================================
     炉床の耐火レンガ（すすと焦げつき）
  ================================================================ */
  T.hearth = function (opt) {
    opt = opt || {};
    const S = 512;
    const alb = cv(S), hei = cv(S), rou = cv(S);
    const a = alb.getContext('2d'), h = hei.getContext('2d'), r = rou.getContext('2d');
    const nf = noiseField(51);
    const n = 4, t = S / n;
    a.fillStyle = '#5a4a3a'; a.fillRect(0, 0, S, S);
    h.fillStyle = '#3a3a3a'; h.fillRect(0, 0, S, S);
    r.fillStyle = '#e0e0e0'; r.fillRect(0, 0, S, S);
    const rnd = U.mulberry32(13);
    for (let iy = 0; iy < n; iy++) {
      for (let ix = 0; ix < n; ix++) {
        const v = rnd();
        a.fillStyle = U.css([176 + v * 30, 152 + v * 26, 124 + v * 22]);
        a.fillRect(ix * t + 4, iy * t + 4, t - 8, t - 8);
        h.fillStyle = 'rgb(' + (200 + v * 26 | 0) + ',' + (200 + v * 26 | 0) + ',' + (200 + v * 26 | 0) + ')';
        h.fillRect(ix * t + 4, iy * t + 4, t - 8, t - 8);
      }
    }
    // すす・焼けあと
    const ai = a.getImageData(0, 0, S, S);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const soot = Math.pow(fbm(nf, x * 0.02, y * 0.02, 5), 2.0);
      const grit = (fbm(nf, x * 0.4, y * 0.4, 3) - 0.5) * 34;
      const k = 1 - soot * 0.86;
      ai.data[i] = U.clamp(ai.data[i] * k + grit, 0, 255);
      ai.data[i + 1] = U.clamp(ai.data[i + 1] * k * 0.97 + grit, 0, 255);
      ai.data[i + 2] = U.clamp(ai.data[i + 2] * k * 0.93 + grit, 0, 255);
    }
    a.putImageData(ai, 0, 0);
    return { albedo: alb, height: hei, rough: rou };
  };

  /* ================================================================
     すす（窯口まわりに重ねる汚し）
  ================================================================ */
  T.sootAlpha = function () {
    const S = 256;
    const c = cv(S);
    const x = c.getContext('2d');
    const nf = noiseField(61);
    const img = x.createImageData(S, S);
    for (let y = 0; y < S; y++) for (let i2 = 0; i2 < S; i2++) {
      const i = (y * S + i2) * 4;
      const v = Math.pow(fbm(nf, i2 * 0.02, y * 0.02, 5), 1.6);
      img.data[i] = img.data[i + 1] = img.data[i + 2] = 12;
      img.data[i + 3] = U.clamp(v * 320 - 40, 0, 255);
    }
    x.putImageData(img, 0, 0);
    return c;
  };

  /* ================================================================
     小麦粉・煙・火の粉のスプライト
  ================================================================ */
  T.softDisc = function (col, power) {
    const S = 128, c = cv(S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    const p = power || 2;
    for (let i = 0; i <= 8; i++) {
      const u = i / 8;
      g.addColorStop(u, 'rgba(' + col + ',' + Math.pow(1 - u, p).toFixed(3) + ')');
    }
    x.fillStyle = g; x.fillRect(0, 0, S, S);
    return c;
  };

  T.flameSprite = function () {
    const S = 128, c = cv(S), x = c.getContext('2d');
    const g = x.createRadialGradient(S / 2, S * 0.72, 0, S / 2, S * 0.6, S * 0.55);
    g.addColorStop(0, 'rgba(255,244,214,1)');
    g.addColorStop(0.25, 'rgba(255,206,96,0.92)');
    g.addColorStop(0.55, 'rgba(255,128,26,0.55)');
    g.addColorStop(0.8, 'rgba(214,58,10,0.16)');
    g.addColorStop(1, 'rgba(160,30,0,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(S / 2, 4);
    x.bezierCurveTo(S * 0.92, S * 0.42, S * 0.86, S * 0.94, S / 2, S - 4);
    x.bezierCurveTo(S * 0.14, S * 0.94, S * 0.08, S * 0.42, S / 2, 4);
    x.closePath();
    x.fill();
    return c;
  };

  /* ゴーストハンド（案内用） */
  T.handSprite = function () {
    const S = 256, c = cv(S), x = c.getContext('2d');
    x.translate(S / 2, S / 2);
    x.scale(1.9, 1.9);
    x.shadowColor = 'rgba(0,0,0,0.45)'; x.shadowBlur = 12;
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.beginPath();
    x.moveTo(0, -46);
    x.bezierCurveTo(9, -46, 12, -38, 12, -28);
    x.lineTo(12, -6);
    x.bezierCurveTo(22, -10, 32, -6, 32, 6);
    x.bezierCurveTo(32, 30, 24, 50, 6, 54);
    x.bezierCurveTo(-14, 58, -26, 44, -28, 22);
    x.bezierCurveTo(-30, 6, -22, 0, -12, 2);
    x.lineTo(-12, -28);
    x.bezierCurveTo(-12, -38, -9, -46, 0, -46);
    x.closePath();
    x.fill();
    x.shadowBlur = 0;
    x.fillStyle = 'rgba(250,186,204,0.7)';
    x.beginPath(); x.arc(0, -38, 8, 0, TAU); x.fill();
    return c;
  };

  /* ================================================================
     マテリアル一式を作るヘルパ
  ================================================================ */
  T.standard = function (set, opt) {
    opt = opt || {};
    const rep = opt.repeat || [1, 1];
    const m = new THREE.MeshStandardMaterial({
      map: texture(set.albedo, rep, true),
      normalMap: texture(T.normalFromHeight(set.height, opt.normalStrength || 2.2), rep, false),
      roughnessMap: set.rough ? texture(set.rough, rep, false) : null,
      roughness: opt.roughness === undefined ? 1 : opt.roughness,
      metalness: opt.metalness === undefined ? 0 : opt.metalness,
      color: opt.color === undefined ? 0xffffff : opt.color
    });
    m.normalScale = new THREE.Vector2(opt.normalScale || 1, opt.normalScale || 1);
    if (opt.envIntensity !== undefined) m.envMapIntensity = opt.envIntensity;
    return m;
  };

})();
