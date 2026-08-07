/* =========================================================================
   tex.js — Canvas による手続き的テクスチャ生成
   （外部画像ファイルを一切使わずに，木目・剥げた塗装・傷んだ金属・草地を作る）
   ========================================================================= */
(function (global) {
  'use strict';

  var TEX = {};
  var cache = {};

  function make(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function toTex(canvas, repX, repY, aniso) {
    var t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repX || 1, repY || 1);
    t.anisotropy = aniso || 4;
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  // 値ノイズ（フラクタル）
  function fbm(rnd, w, h, octaves, base) {
    var out = new Float32Array(w * h);
    var amp = 1, total = 0;
    for (var o = 0; o < octaves; o++) {
      var gw = Math.max(2, Math.round(base * Math.pow(2, o)));
      var gh = Math.max(2, Math.round(base * Math.pow(2, o) * h / w));
      var grid = new Float32Array(gw * gh);
      for (var i = 0; i < grid.length; i++) grid[i] = rnd();
      for (var y = 0; y < h; y++) {
        var fy = y / h * gh, y0 = Math.floor(fy) % gh, y1 = (y0 + 1) % gh, ty = fy - Math.floor(fy);
        ty = ty * ty * (3 - 2 * ty);
        for (var x = 0; x < w; x++) {
          var fx = x / w * gw, x0 = Math.floor(fx) % gw, x1 = (x0 + 1) % gw, tx = fx - Math.floor(fx);
          tx = tx * tx * (3 - 2 * tx);
          var a = grid[y0 * gw + x0], b = grid[y0 * gw + x1];
          var c = grid[y1 * gw + x0], d = grid[y1 * gw + x1];
          out[y * w + x] += amp * ((a + (b - a) * tx) + ((c + (d - c) * tx) - (a + (b - a) * tx)) * ty);
        }
      }
      total += amp; amp *= 0.5;
    }
    for (var k = 0; k < out.length; k++) out[k] /= total;
    return out;
  }

  /* ---------- 木材（松材のフレーム／巣箱） ---------- */
  TEX.wood = function (opt) {
    opt = opt || {};
    var key = 'wood' + JSON.stringify(opt);
    if (cache[key]) return cache[key];
    var W = 512, H = 512;
    var c = make(W, H), g = c.getContext('2d');
    var rnd = U.mulberry(opt.seed || 7);
    var base = opt.base || [188, 152, 100];
    var dark = opt.dark || [128, 92, 50];

    var n = fbm(rnd, W, H, 4, 3);
    var img = g.createImageData(W, H);
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var i = y * W + x;
        // 木目：横方向に伸びた縞（U 方向に走る）
        var warp = n[i] * 26;
        var rings = Math.sin((y * 0.30 + warp + Math.sin(x * 0.012) * 7) * 1.0);
        rings = Math.pow(Math.abs(rings), 0.42);
        var grain = (rnd() - 0.5) * 0.10;
        var t = U.sat(rings * 0.72 + n[i] * 0.34 + grain);
        var p = i * 4;
        img.data[p] = U.lerp(base[0], dark[0], t);
        img.data[p + 1] = U.lerp(base[1], dark[1], t);
        img.data[p + 2] = U.lerp(base[2], dark[2], t);
        img.data[p + 3] = 255;
      }
    }
    g.putImageData(img, 0, 0);

    // 節（ふし）
    var knots = opt.knots == null ? 3 : opt.knots;
    for (var k = 0; k < knots; k++) {
      var kx = rnd() * W, ky = rnd() * H, kr = 8 + rnd() * 16;
      for (var r = kr * 2.6; r > 1; r -= 1.6) {
        g.beginPath();
        g.ellipse(kx, ky, r, r * 0.55, 0, 0, Math.PI * 2);
        g.strokeStyle = 'rgba(96,64,28,' + (0.05 + 0.16 * (1 - r / (kr * 2.6))) + ')';
        g.lineWidth = 1.4; g.stroke();
      }
      g.beginPath();
      g.ellipse(kx, ky, kr * 0.34, kr * 0.2, 0, 0, Math.PI * 2);
      g.fillStyle = 'rgba(78,50,20,.75)'; g.fill();
    }
    // 経年の汚れ
    g.globalAlpha = 0.12;
    for (var s = 0; s < 40; s++) {
      g.fillStyle = 'rgba(80,58,30,1)';
      g.fillRect(rnd() * W, rnd() * H, rnd() * 90 + 10, rnd() * 3 + 1);
    }
    g.globalAlpha = 1;

    var t2 = toTex(c, opt.repX || 1, opt.repY || 1, 8);
    cache[key] = t2;
    return t2;
  };

  /* ---------- 塗装された巣箱（塗装が剥げて木が覗く） ---------- */
  TEX.paintedWood = function (col, seed) {
    var key = 'paint' + col + seed;
    if (cache[key]) return cache[key];
    var W = 512, H = 512;
    var c = make(W, H), g = c.getContext('2d');
    var rnd = U.mulberry(seed || 3);

    // 下地の木
    var n = fbm(rnd, W, H, 4, 3);
    var img = g.createImageData(W, H);
    for (var y = 0; y < H; y++) for (var x = 0; x < W; x++) {
      var i = y * W + x, p = i * 4;
      var rings = Math.pow(Math.abs(Math.sin((y * 0.3 + n[i] * 24) )), 0.45);
      var t = U.sat(rings * 0.7 + n[i] * 0.3);
      img.data[p] = U.lerp(196, 138, t);
      img.data[p + 1] = U.lerp(156, 96, t);
      img.data[p + 2] = U.lerp(104, 52, t);
      img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);

    // 塗装レイヤ（穴あき）
    var pc = make(W, H), pg = pc.getContext('2d');
    pg.fillStyle = col; pg.fillRect(0, 0, W, H);
    // 刷毛目
    pg.globalAlpha = 0.10;
    for (var b = 0; b < 160; b++) {
      pg.strokeStyle = rnd() > .5 ? '#ffffff' : '#000000';
      pg.lineWidth = rnd() * 2.2 + .4;
      var by = rnd() * H;
      pg.beginPath(); pg.moveTo(0, by);
      pg.bezierCurveTo(W * .3, by + rnd() * 6 - 3, W * .7, by + rnd() * 6 - 3, W, by + rnd() * 4 - 2);
      pg.stroke();
    }
    pg.globalAlpha = 1;
    // 剥がれ（destination-out で木を露出）
    pg.globalCompositeOperation = 'destination-out';
    for (var f = 0; f < 22; f++) {
      var fx = rnd() * W, fy = rnd() * H, fr = 2 + rnd() * rnd() * 15;
      pg.beginPath();
      var pts = 7 + Math.floor(rnd() * 5);
      for (var q = 0; q <= pts; q++) {
        var a = q / pts * Math.PI * 2;
        var rr = fr * (0.55 + rnd() * 0.75);
        var px = fx + Math.cos(a) * rr, py = fy + Math.sin(a) * rr * 0.8;
        if (q === 0) pg.moveTo(px, py); else pg.lineTo(px, py);
      }
      pg.closePath(); pg.fill();
    }
    // 端の摩耗
    var eg = pg.createLinearGradient(0, 0, 0, H);
    pg.globalCompositeOperation = 'destination-out';
    for (var e = 0; e < 190; e++) {
      var ex = rnd() * W;
      var ey = rnd() < .5 ? rnd() * 14 : H - rnd() * 14;
      pg.globalAlpha = .5;
      pg.fillRect(ex, ey, rnd() * 10 + 2, rnd() * 4 + 1);
    }
    pg.globalAlpha = 1;
    pg.globalCompositeOperation = 'source-over';

    g.drawImage(pc, 0, 0);
    // 雨だれ／汚れ
    g.globalAlpha = 0.10;
    for (var d = 0; d < 26; d++) {
      var dx = rnd() * W;
      var grad = g.createLinearGradient(dx, 0, dx, H);
      grad.addColorStop(0, 'rgba(60,50,30,0)');
      grad.addColorStop(1, 'rgba(60,50,30,1)');
      g.fillStyle = grad;
      g.fillRect(dx, rnd() * H * .5, rnd() * 8 + 2, H);
    }
    g.globalAlpha = 1;

    var t = toTex(c, 1, 1, 8);
    cache[key] = t;
    return t;
  };

  /* ---------- 金属（ヘアライン＋小傷） ---------- */
  TEX.metal = function (opt) {
    opt = opt || {};
    var key = 'metal' + JSON.stringify(opt);
    if (cache[key]) return cache[key];
    var W = 512, H = 512;
    var c = make(W, H), g = c.getContext('2d');
    var rnd = U.mulberry(opt.seed || 11);
    g.fillStyle = opt.base || '#b9bfc4';
    g.fillRect(0, 0, W, H);
    // ヘアライン
    for (var i = 0; i < 2600; i++) {
      var y = rnd() * H;
      g.strokeStyle = 'rgba(255,255,255,' + (rnd() * 0.09) + ')';
      g.lineWidth = rnd() * 1.4;
      g.beginPath(); g.moveTo(rnd() * W, y); g.lineTo(rnd() * W, y + rnd() * 2 - 1); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,' + (rnd() * 0.07) + ')';
      g.beginPath(); g.moveTo(rnd() * W, y); g.lineTo(rnd() * W, y + rnd() * 2 - 1); g.stroke();
    }
    // 汚れ・くすみ
    var n = fbm(rnd, 128, 128, 3, 3);
    var sc = make(128, 128), sg = sc.getContext('2d');
    var im = sg.createImageData(128, 128);
    for (var k = 0; k < 128 * 128; k++) {
      var v = n[k];
      im.data[k * 4] = 60; im.data[k * 4 + 1] = 52; im.data[k * 4 + 2] = 40;
      im.data[k * 4 + 3] = U.sat((v - 0.5) * 2.6) * 90 * (opt.grime == null ? 1 : opt.grime);
    }
    sg.putImageData(im, 0, 0);
    g.drawImage(sc, 0, 0, W, H);
    // へこみ／打痕
    for (var d = 0; d < (opt.dents || 16); d++) {
      var dx = rnd() * W, dy = rnd() * H, dr = 4 + rnd() * 14;
      var rg = g.createRadialGradient(dx - dr * .3, dy - dr * .3, 1, dx, dy, dr);
      rg.addColorStop(0, 'rgba(255,255,255,.14)');
      rg.addColorStop(.55, 'rgba(0,0,0,.10)');
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(dx, dy, dr, 0, 7); g.fill();
    }
    var t = toTex(c, opt.repX || 1, opt.repY || 1, 8);
    cache[key] = t;
    return t;
  };

  /* ---------- 地面（草地） ---------- */
  TEX.grass = function () {
    if (cache.grass) return cache.grass;
    var W = 512, H = 512;
    var c = make(W, H), g = c.getContext('2d');
    var rnd = U.mulberry(23);
    var n = fbm(rnd, W, H, 5, 2);
    var img = g.createImageData(W, H);
    for (var i = 0; i < W * H; i++) {
      var v = n[i];
      var p = i * 4;
      img.data[p] = U.lerp(96, 150, v) + (rnd() - .5) * 16;
      img.data[p + 1] = U.lerp(126, 178, v) + (rnd() - .5) * 16;
      img.data[p + 2] = U.lerp(52, 84, v) + (rnd() - .5) * 12;
      img.data[p + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // 草の筋
    for (var s = 0; s < 5200; s++) {
      var x = rnd() * W, y = rnd() * H, len = 3 + rnd() * 9, a = rnd() * Math.PI * 2;
      g.strokeStyle = rnd() > .55 ? 'rgba(168,196,96,.5)' : 'rgba(64,96,38,.45)';
      g.lineWidth = rnd() * 1.3 + .3;
      g.beginPath(); g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    }
    // 小さな花
    for (var f = 0; f < 220; f++) {
      var fx = rnd() * W, fy = rnd() * H;
      g.fillStyle = U.pick(['rgba(255,236,150,.75)', 'rgba(255,255,255,.7)', 'rgba(232,168,220,.6)', 'rgba(180,200,255,.55)']);
      g.beginPath(); g.arc(fx, fy, rnd() * 2 + 1, 0, 7); g.fill();
    }
    var t = toTex(c, 110, 110, 16);
    cache.grass = t;
    return t;
  };

  /* ---------- 煙のスプライト ---------- */
  TEX.smoke = function () {
    if (cache.smoke) return cache.smoke;
    var S = 128, c = make(S, S), g = c.getContext('2d');
    var rnd = U.mulberry(5);
    // ふわふわした塊
    for (var i = 0; i < 26; i++) {
      var a = rnd() * Math.PI * 2, r = Math.pow(rnd(), .7) * S * .26;
      var x = S / 2 + Math.cos(a) * r, y = S / 2 + Math.sin(a) * r;
      var rr = S * (0.10 + rnd() * 0.17);
      var rg = g.createRadialGradient(x, y, 0, x, y, rr);
      rg.addColorStop(0, 'rgba(255,255,255,.30)');
      rg.addColorStop(.5, 'rgba(255,255,255,.13)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, rr, 0, 7); g.fill();
    }
    // 中心のコア
    var cg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S * .46);
    cg.addColorStop(0, 'rgba(255,255,255,.42)');
    cg.addColorStop(.45, 'rgba(255,255,255,.16)');
    cg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = cg; g.fillRect(0, 0, S, S);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    cache.smoke = t;
    return t;
  };

  /* ---------- 丸いソフト粒（きらめき・蜜しぶき） ---------- */
  TEX.blob = function () {
    if (cache.blob) return cache.blob;
    var S = 64, c = make(S, S), g = c.getContext('2d');
    var rg = g.createRadialGradient(S * .38, S * .34, 1, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(.32, 'rgba(255,232,150,1)');
    rg.addColorStop(.78, 'rgba(226,150,26,.92)');
    rg.addColorStop(1, 'rgba(200,120,10,0)');
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    cache.blob = t;
    return t;
  };

  TEX.spark = function () {
    if (cache.spark) return cache.spark;
    var S = 64, c = make(S, S), g = c.getContext('2d');
    var rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(255,255,255,1)');
    rg.addColorStop(.25, 'rgba(255,244,200,.85)');
    rg.addColorStop(1, 'rgba(255,210,90,0)');
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    // 十字の光条
    g.globalCompositeOperation = 'lighter';
    var lg = g.createLinearGradient(0, S / 2, S, S / 2);
    lg.addColorStop(0, 'rgba(255,255,255,0)');
    lg.addColorStop(.5, 'rgba(255,255,255,.8)');
    lg.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg; g.fillRect(0, S / 2 - 1.5, S, 3);
    var lg2 = g.createLinearGradient(S / 2, 0, S / 2, S);
    lg2.addColorStop(0, 'rgba(255,255,255,0)');
    lg2.addColorStop(.5, 'rgba(255,255,255,.8)');
    lg2.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = lg2; g.fillRect(S / 2 - 1.5, 0, 3, S);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    cache.spark = t;
    return t;
  };

  /* ---------- 接地影（丸いソフトシャドウ） ---------- */
  TEX.shadowBlob = function () {
    if (cache.sh) return cache.sh;
    var S = 128, c = make(S, S), g = c.getContext('2d');
    var rg = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    rg.addColorStop(0, 'rgba(0,0,0,.55)');
    rg.addColorStop(.45, 'rgba(0,0,0,.30)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(0, 0, S, S);
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    cache.sh = t;
    return t;
  };

  /* ---------- 遠景の雲 ---------- */
  TEX.cloud = function () {
    if (cache.cloud) return cache.cloud;
    var W = 256, H = 128, c = make(W, H), g = c.getContext('2d');
    var rnd = U.mulberry(31);
    for (var i = 0; i < 40; i++) {
      var x = W * .5 + (rnd() - .5) * W * .72;
      var y = H * .62 - Math.pow(rnd(), 2) * H * .4;
      var r = H * (.13 + rnd() * .26);
      var rg = g.createRadialGradient(x, y - r * .25, 0, x, y, r);
      rg.addColorStop(0, 'rgba(255,255,255,.55)');
      rg.addColorStop(.6, 'rgba(250,252,255,.22)');
      rg.addColorStop(1, 'rgba(240,246,255,0)');
      g.fillStyle = rg; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    cache.cloud = t;
    return t;
  };

  /* ---------- ガラス瓶のラベル ---------- */
  TEX.label = function () {
    if (cache.label) return cache.label;
    var W = 256, H = 256, c = make(W, H), g = c.getContext('2d');
    g.clearRect(0, 0, W, H);
    // 紙
    g.fillStyle = '#fdf3d8';
    g.beginPath();
    g.ellipse(W / 2, H / 2, W * .30, H * .26, 0, 0, 7); g.fill();
    g.strokeStyle = '#c58f2a'; g.lineWidth = 4; g.stroke();
    // ミツバチのマーク
    g.save();
    g.translate(W / 2, H / 2 + 6);
    g.fillStyle = '#3a2a12';
    g.beginPath(); g.ellipse(0, 0, 20, 14, 0, 0, 7); g.fill();
    g.fillStyle = '#f2b52c';
    g.beginPath(); g.ellipse(2, 0, 15, 12, 0, 0, 7); g.fill();
    g.fillStyle = '#3a2a12';
    g.fillRect(-4, -12, 5, 24); g.fillRect(6, -10, 5, 20);
    g.fillStyle = 'rgba(255,255,255,.72)';
    g.beginPath(); g.ellipse(-4, -16, 13, 7, -0.5, 0, 7); g.fill();
    g.beginPath(); g.ellipse(9, -15, 10, 6, 0.5, 0, 7); g.fill();
    g.restore();
    // 上下の飾り
    g.fillStyle = '#c58f2a';
    for (var i = -2; i <= 2; i++) {
      g.beginPath(); g.arc(W / 2 + i * 16, H / 2 - 42, 3, 0, 7); g.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    cache.label = t;
    return t;
  };

  global.TEX = TEX;
})(window);
