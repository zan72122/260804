/* 空港グランドハンドリング — プロシージャルテクスチャ生成 */
(function (AG) {
  'use strict';
  const T = (AG.T = {});

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  T.cv = cv;

  /* 決定的な擬似乱数 */
  function rngFactory(seed) {
    let s = seed >>> 0;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }
  T.rng = rngFactory;

  function valueNoise(w, h, scale, seed) {
    const rnd = rngFactory(seed);
    const gw = Math.ceil(w / scale) + 2, gh = Math.ceil(h / scale) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = y / scale, y0 = Math.floor(fy), ty = fy - y0;
      const sy = ty * ty * (3 - 2 * ty);
      for (let x = 0; x < w; x++) {
        const fx = x / scale, x0 = Math.floor(fx), tx = fx - x0;
        const sx = tx * tx * (3 - 2 * tx);
        const a = g[(y0 % gh) * gw + (x0 % gw)], b = g[(y0 % gh) * gw + ((x0 + 1) % gw)];
        const c = g[((y0 + 1) % gh) * gw + (x0 % gw)], d = g[((y0 + 1) % gh) * gw + ((x0 + 1) % gw)];
        out[y * w + x] = (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
      }
    }
    return out;
  }

  function fbmField(w, h, seed, octaves, baseScale) {
    const out = new Float32Array(w * h);
    let amp = 1, tot = 0, sc = baseScale;
    for (let o = 0; o < octaves; o++) {
      const n = valueNoise(w, h, sc, seed + o * 977);
      for (let i = 0; i < out.length; i++) out[i] += n[i] * amp;
      tot += amp; amp *= 0.5; sc = Math.max(2, sc * 0.5);
    }
    for (let i = 0; i < out.length; i++) out[i] /= tot;
    return out;
  }
  T.fbm = fbmField;

  /* ---- エプロン舗装（タイル可能） ---- */
  T.apron = function () {
    const S = 512, c = cv(S, S), g = c.getContext('2d');
    const grain = fbmField(S, S, 7717, 5, 64);
    const fine = fbmField(S, S, 991, 3, 6);
    const img = g.createImageData(S, S);
    const d = img.data;
    for (let i = 0; i < S * S; i++) {
      let v = 0.40 + grain[i] * 0.18 + (fine[i] - 0.5) * 0.20;
      /* 骨材のきらめき */
      const spark = fine[i] > 0.80 ? (fine[i] - 0.80) * 1.6 : 0;
      v += spark;
      const r = v * 148, gg = v * 150, b = v * 152;
      d[i * 4] = r; d[i * 4 + 1] = gg; d[i * 4 + 2] = b; d[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    /* 目地・打継ぎ目 */
    g.strokeStyle = 'rgba(30,30,32,0.45)';
    g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(0, 4); g.lineTo(S, 4); g.moveTo(4, 0); g.lineTo(4, S); g.stroke();
    /* 油染み */
    const rnd = rngFactory(31);
    for (let i = 0; i < 22; i++) {
      const x = rnd() * S, y = rnd() * S, r = 8 + rnd() * 46;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.05 + rnd() * 0.16;
      grd.addColorStop(0, `rgba(18,16,14,${a})`);
      grd.addColorStop(1, 'rgba(18,16,14,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, 7); g.fill();
    }
    return c;
  };

  /* ---- ゲート標示（大判デカール・アルファ付き） ----
     板は 幅160m(x:-80..80) x 奥行220m(z:-195..25)、中心 (0,-85)。
     世界座標をそのままキャンバス座標へ写して描く。 */
  T.GATE = { W: 160, D: 220, CZ: -85 };
  T.gateMarks = function () {
    const W = 1024, H = 2048, c = cv(W, H), g = c.getContext('2d');
    const PX = W / T.GATE.W, PZ = H / T.GATE.D;
    const X = (x) => (x + T.GATE.W / 2) * PX;
    const Y = (z) => (T.GATE.CZ + T.GATE.D / 2 - z) * PZ;
    g.clearRect(0, 0, W, H);
    const YEL = '#e8c22a', WHT = '#e6e6e2', RED = '#c0392b', BLK = '#141414';

    function rect(x0, z0, x1, z1, col, a) {
      g.save(); g.globalAlpha = a === undefined ? 0.92 : a; g.fillStyle = col;
      g.fillRect(X(Math.min(x0, x1)), Y(Math.max(z0, z1)),
        Math.abs(X(x1) - X(x0)), Math.abs(Y(z1) - Y(z0)));
      g.restore();
    }
    function dashBox(x0, z0, x1, z1, col, w, dash, a) {
      g.save(); g.globalAlpha = a === undefined ? 0.8 : a;
      g.strokeStyle = col; g.lineWidth = w * PZ; g.setLineDash([dash * PZ, dash * 0.7 * PZ]);
      g.strokeRect(X(x0), Y(z1), X(x1) - X(x0), Y(z0) - Y(z1));
      g.restore();
    }
    function label(txt, x, z, size, col, a) {
      g.save();
      g.globalAlpha = a === undefined ? 0.85 : a;
      g.translate(X(x), Y(z)); g.scale(1, -1);
      g.fillStyle = col; g.font = 'bold ' + (size * PZ) + 'px sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(txt, 0, 0);
      g.restore();
    }

    /* --- 誘導センターライン（奥から停止線まで） --- */
    rect(-0.45, -192, -0.20, -9.5, BLK, 0.55);
    rect(0.20, -192, 0.45, -9.5, BLK, 0.55);
    rect(-0.22, -192, 0.22, -9.5, YEL, 0.95);
    /* 停止線（横棒）と機種表示 */
    rect(-4.6, -9.9, 4.6, -9.1, YEL, 0.95);
    rect(5.4, -13.2, 6.1, -6.0, YEL, 0.92);
    label('A320', 8.6, -9.5, 2.2, YEL);
    /* 主脚の目安 */
    rect(-6.0, -28.5, -2.6, -27.9, WHT, 0.85);
    rect(2.6, -28.5, 6.0, -27.9, WHT, 0.85);
    /* 安全区域（赤の破線枠） */
    dashBox(-27, -62, 27, -3, RED, 0.55, 4.0, 0.75);
    /* 機材待機ライン（白破線） */
    g.save();
    g.globalAlpha = 0.7; g.strokeStyle = WHT; g.lineWidth = 0.45 * PZ;
    g.setLineDash([5 * PZ, 3.4 * PZ]);
    for (const sx of [-33, 33]) {
      g.beginPath(); g.moveTo(X(sx), Y(-62)); g.lineTo(X(sx), Y(-3)); g.stroke();
    }
    g.restore();
    /* 前方の車両道路 */
    rect(-78, 9.0, 78, 9.4, WHT, 0.6);
    rect(-78, 15.6, 78, 16.0, WHT, 0.6);
    /* ゲート番号 */
    label('4', -13, 2.5, 7.5, YEL, 0.85);
    label('GATE', -13, 8.0, 2.0, YEL, 0.6);
    /* ボーディングブリッジ可動範囲のハッチング */
    g.save();
    g.globalAlpha = 0.36; g.strokeStyle = YEL; g.lineWidth = 0.4 * PZ;
    for (let i = 0; i < 22; i++) {
      const x = -34 + i * 1.5;
      g.beginPath(); g.moveTo(X(x), Y(-20.5)); g.lineTo(X(x + 3.0), Y(-27.0)); g.stroke();
    }
    g.restore();
    /* 給油・電源の作業区画 */
    dashBox(-11.5, -22.5, -3.5, -13.5, WHT, 0.35, 2.4, 0.45);
    dashBox(3.5, -34, 13.5, -24, WHT, 0.35, 2.4, 0.45);
    return c;
  };

  /* ---- 胴体（窓・ドア・塗装） ----
     u = 機首(0)→尾部(1)、v = 上(0) → +X側(0.25) → 下(0.5) → -X側(0.75)。
     ボーディングブリッジは -X 側に接続するので、そちらを L 側とする。 */
  T.fuselage = function () {
    const W = 2048, H = 512, c = cv(W, H), g = c.getContext('2d');
    const Y = (v) => v * H;                 /* 幾何のv → キャンバスy */
    const PLUS_X = 0.25, MINUS_X = 0.75;

    /* ベース塗装 */
    g.fillStyle = '#eceef0'; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, Y(0.5), 0, Y(0));
    gr.addColorStop(0, '#e4e6e9'); gr.addColorStop(1, '#f5f6f7');
    g.fillStyle = gr; g.fillRect(0, 0, W, Y(0.5));
    /* 腹部の未塗装アルミとチートライン */
    function band(v0, v1, col) { g.fillStyle = col; g.fillRect(0, Y(v0), W, Y(v1) - Y(v0)); }
    band(0.385, 0.615, '#a9adb2');
    band(0.360, 0.386, '#123a72'); band(0.376, 0.386, '#d84a3a');
    band(0.614, 0.640, '#123a72'); band(0.614, 0.624, '#d84a3a');

    /* 客室窓 */
    function windows(vc) {
      const wh = 16, ww = 12;
      for (let i = 0; i < 70; i++) {
        const x = 296 + i * 25;
        if (x > W - 330) break;
        g.fillStyle = '#1d232b';
        roundRect(g, x, Y(vc) - wh / 2, ww, wh, 4.5); g.fill();
        g.fillStyle = 'rgba(158,196,228,0.42)';
        roundRect(g, x + 1.6, Y(vc) - wh / 2 + 1.6, ww - 3.2, wh * 0.40, 3); g.fill();
      }
    }
    windows(PLUS_X + 0.005); windows(MINUS_X - 0.005);

    /* 円筒の裏側(v>0.5)ではテクスチャが180度回って見えるので、文字はそれを打ち消す */
    function oriented(cx, v, fn) {
      g.save();
      g.translate(cx, Y(v));
      if (v > 0.5) g.scale(-1, -1);
      fn();
      g.restore();
    }
    function door(x, vc, w, h, label) {
      g.save();
      g.strokeStyle = 'rgba(88,94,100,0.9)'; g.lineWidth = 3;
      g.fillStyle = '#e6e9ec';
      roundRect(g, x, Y(vc) - h / 2, w, h, 8); g.fill(); g.stroke();
      g.fillStyle = 'rgba(120,126,132,0.85)';
      g.fillRect(x + w * 0.70, Y(vc) - 6, 10, 12);
      g.strokeStyle = 'rgba(150,156,162,0.55)'; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(x + 4, Y(vc) - h / 2 + 5); g.lineTo(x + w - 4, Y(vc) - h / 2 + 5); g.stroke();
      g.restore();
      if (label) oriented(x + w / 2, vc, () => {
        g.fillStyle = '#39404a'; g.font = 'bold 17px sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(label, 0, h / 2 + 16);
      });
    }
    door(232, MINUS_X, 46, 78, 'L1'); door(232, PLUS_X, 46, 78, 'R1');
    door(1556, MINUS_X, 44, 74, 'L2'); door(1556, PLUS_X, 44, 74, 'R2');
    /* 主翼上の非常口 */
    for (const v of [PLUS_X, MINUS_X]) {
      g.save();
      g.strokeStyle = 'rgba(100,106,112,0.8)'; g.lineWidth = 2.5;
      g.fillStyle = 'rgba(232,235,238,1)';
      roundRect(g, 900, Y(v) - 24, 30, 48, 5); g.fill(); g.stroke();
      roundRect(g, 960, Y(v) - 24, 30, 48, 5); g.fill(); g.stroke();
      g.restore();
    }

    /* 貨物室ドア（+X側の下部＝ベルトローダー側） */
    function cargoDoor(x, w, h) {
      g.save();
      g.fillStyle = '#a3a8ad'; g.strokeStyle = 'rgba(64,68,72,0.95)'; g.lineWidth = 3.5;
      roundRect(g, x, Y(0.40) - h / 2, w, h, 7); g.fill(); g.stroke();
      g.strokeStyle = 'rgba(70,74,78,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 8, Y(0.40) - h / 2 + 8); g.lineTo(x + w - 8, Y(0.40) - h / 2 + 8); g.stroke();
      g.fillStyle = '#4a4e52'; g.fillRect(x + w * 0.44, Y(0.40) + h / 2 - 12, 22, 7);
      g.fillStyle = '#d84a3a';
      for (let i = 0; i < 7; i++) g.fillRect(x + 6 + i * 10, Y(0.40) - h / 2 - 8, 5, 4);
      g.restore();
    }
    cargoDoor(520, 142, 70); cargoDoor(1318, 118, 60);
    /* 地上電源パネル（-X側の機首下部）とサービスパネル */
    g.save();
    g.fillStyle = '#c9ced3'; g.strokeStyle = 'rgba(70,76,82,0.9)'; g.lineWidth = 3;
    roundRect(g, 132, Y(0.610) - 20, 54, 40, 5); g.fill(); g.stroke();
    g.fillStyle = '#2d3238'; g.fillRect(142, Y(0.610) - 12, 34, 24);
    g.strokeStyle = 'rgba(120,126,132,0.6)'; g.lineWidth = 2;
    g.strokeRect(1975, Y(0.30) - 16, 40, 32);
    g.strokeRect(1080, Y(0.47) - 12, 40, 24);
    g.restore();

    /* 操縦室窓 */
    for (const v of [PLUS_X - 0.105, MINUS_X + 0.105]) oriented(124, v, () => {
      g.fillStyle = '#141a22';
      g.beginPath();
      g.moveTo(-46, 21); g.lineTo(26, 26); g.lineTo(35, -14); g.lineTo(-43, -20);
      g.closePath(); g.fill();
      g.strokeStyle = '#5c6268'; g.lineWidth = 4; g.stroke();
      g.strokeStyle = '#e9ebee'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-8, 23); g.lineTo(-6, -17); g.stroke();
    });

    /* 社名（両舷） */
    for (const v of [0.155, 0.845]) oriented(880, v, () => {
      g.textAlign = 'left'; g.textBaseline = 'middle';
      g.fillStyle = '#123a72'; g.font = 'bold 78px sans-serif';
      g.fillText('SORAIRO', -240, 0);
      g.fillStyle = '#d84a3a'; g.font = 'bold 38px sans-serif';
      g.fillText('AIR', 200, 4);
    });
    /* 機体記号 */
    for (const v of [0.190, 0.810]) oriented(1840, v, () => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#33404e'; g.font = 'bold 26px sans-serif';
      g.fillText('JA812S', 0, 0);
    });

    /* 汚れ・排気筋 */
    const dirt = fbmField(256, 64, 5501, 4, 24);
    const di = g.createImageData(256, 64);
    for (let i = 0; i < 256 * 64; i++) {
      di.data[i * 4] = 40; di.data[i * 4 + 1] = 40; di.data[i * 4 + 2] = 42;
      di.data[i * 4 + 3] = Math.max(0, dirt[i] - 0.56) * 160;
    }
    const dc = cv(256, 64); dc.getContext('2d').putImageData(di, 0, 0);
    g.globalAlpha = 0.5;
    g.drawImage(dc, 0, Y(0.30), W, Y(0.50) - Y(0.30));
    g.drawImage(dc, 0, Y(0.50), W, Y(0.70) - Y(0.50));
    g.globalAlpha = 1;
    /* パネルライン */
    g.strokeStyle = 'rgba(122,128,134,0.30)'; g.lineWidth = 1.6;
    for (let i = 1; i < 26; i++) {
      const x = i * (W / 26);
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    }
    for (const v of [0.12, 0.34, 0.66, 0.88]) {
      g.beginPath(); g.moveTo(0, Y(v)); g.lineTo(W, Y(v)); g.stroke();
    }
    return c;
  };

  function roundRect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  T.roundRect = roundRect;

  /* ---- 垂直尾翼のロゴ ---- */
  T.fin = function () {
    const W = 512, H = 512, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#123a72'; g.fillRect(0, 0, W, H);
    /* 翼をかたどった白い鳥のマーク */
    g.save();
    g.translate(W * 0.52, H * 0.46);
    g.fillStyle = '#f2f5f8';
    g.beginPath();
    g.moveTo(-150, 40);
    g.quadraticCurveTo(-30, -30, 130, -120);
    g.quadraticCurveTo(30, 10, -20, 70);
    g.closePath(); g.fill();
    g.fillStyle = '#d84a3a';
    g.beginPath();
    g.moveTo(-140, 90);
    g.quadraticCurveTo(-20, 40, 120, -30);
    g.quadraticCurveTo(20, 60, -30, 112);
    g.closePath(); g.fill();
    g.restore();
    return c;
  };

  /* ---- ターミナルのガラス面 ---- */
  T.terminal = function () {
    const W = 512, H = 256, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#3a4650'; g.fillRect(0, 0, W, H);
    const rnd = rngFactory(4242);
    for (let y = 0; y < 6; y++) for (let x = 0; x < 32; x++) {
      const v = 0.45 + rnd() * 0.5;
      const warm = rnd() > 0.7;
      g.fillStyle = warm ? `rgba(${200 * v},${180 * v},${140 * v},1)` : `rgba(${90 * v},${125 * v},${150 * v},1)`;
      g.fillRect(x * 16 + 2, y * 42 + 4, 12, 34);
    }
    g.strokeStyle = 'rgba(200,205,210,0.55)'; g.lineWidth = 2;
    for (let x = 0; x <= 32; x++) { g.beginPath(); g.moveTo(x * 16, 0); g.lineTo(x * 16, H); g.stroke(); }
    for (let y = 0; y <= 6; y++) { g.beginPath(); g.moveTo(0, y * 42); g.lineTo(W, y * 42); g.stroke(); }
    return c;
  };

  /* ---- 金属パネル（車両・ブリッジ外皮） ---- */
  T.panel = function (base, seed) {
    const W = 256, H = 256, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = base || '#c8ccd0'; g.fillRect(0, 0, W, H);
    const n = fbmField(W, H, seed || 13, 4, 32);
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) {
      const k = (n[i] - 0.5) * 34;
      img.data[i * 4] += k; img.data[i * 4 + 1] += k; img.data[i * 4 + 2] += k;
    }
    g.putImageData(img, 0, 0);
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
    for (let i = 1; i < 4; i++) {
      g.beginPath(); g.moveTo(0, i * H / 4); g.lineTo(W, i * H / 4); g.stroke();
    }
    /* リベット */
    g.fillStyle = 'rgba(255,255,255,0.20)';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 26; j++) {
      g.beginPath(); g.arc(j * 10 + 5, i * H / 4 + 3, 1.3, 0, 7); g.fill();
    }
    return c;
  };

  /* ---- ベルトコンベア面（矢羽根） ---- */
  T.belt = function () {
    const W = 128, H = 128, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#2b2b2e'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#3d3d42'; g.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const y = i * 16;
      g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke();
    }
    g.fillStyle = '#4a4a50';
    for (let i = 0; i < 4; i++) {
      g.fillRect(0, i * 32 + 8, W, 7);
    }
    return c;
  };

  /* ---- タイヤトレッド ---- */
  T.tire = function () {
    const W = 128, H = 128, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = '#26262a'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#17171a';
    for (let i = 0; i < 4; i++) g.fillRect(0, 22 + i * 24, W, 9);
    const n = fbmField(W, H, 88, 3, 10);
    const img = g.getImageData(0, 0, W, H);
    for (let i = 0; i < W * H; i++) {
      const k = (n[i] - 0.5) * 24;
      img.data[i * 4] += k; img.data[i * 4 + 1] += k; img.data[i * 4 + 2] += k;
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  /* ---- 草地 ---- */
  T.grass = function () {
    const S = 256, c = cv(S, S), g = c.getContext('2d');
    const n = fbmField(S, S, 3141, 5, 40);
    const f = fbmField(S, S, 271, 2, 4);
    const img = g.createImageData(S, S);
    for (let i = 0; i < S * S; i++) {
      const v = 0.55 + n[i] * 0.45 + (f[i] - 0.5) * 0.35;
      img.data[i * 4] = 74 * v; img.data[i * 4 + 1] = 96 * v; img.data[i * 4 + 2] = 52 * v;
      img.data[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
  };

  /* ---- スーツケースの面 ---- */
  T.bag = function (col) {
    const W = 64, H = 64, c = cv(W, H), g = c.getContext('2d');
    g.fillStyle = col; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 2;
    for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(i * 10, 0); g.lineTo(i * 10, H); g.stroke(); }
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 0, W, 6);
    return c;
  };
})(window.AG);
