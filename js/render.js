// render — Canvas2D 描画・カメラ・座標変換（Agent-RENDER 所有）
// テーマ: 和菓子「はさみ菊」。丸い練り切りに切り込みを入れるたび花びらが立ち上がり、
// 最後に美しい菊が咲く。写実よりやわらかく・マットで・4歳女児に愛される見た目を狙う。
(function () {
  'use strict';

  var canvas = null;
  var ctx = null;

  // --- ビュー状態（このモジュール専有） ---
  var view = {
    wCss: 0, hCss: 0, dpr: 1,
    cx: 0, cy: 0, scale: 1, rotation: 0,
  };

  // カメラのズームは滑らかにイージングする内部値
  var camZoom = 1.0;
  var camInited = false;

  // 呼吸アニメ用の位相
  var breathT = 0;
  // ガイド(nextHint)のパルス位相
  var hintT = 0;

  // オフスクリーンにキャッシュする和紙テクスチャパターン
  var paperPatternCanvas = null;
  var paperPatternSize = 0;

  // ============ ユーティリティ ============
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
    t = clamp(t, 0, 1);
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }
  function easeOutCubic(t) {
    t = clamp(t, 0, 1);
    return 1 - Math.pow(1 - t, 3);
  }

  // 16進カラー -> {r,g,b}
  var hexCache = {};
  function hexToRgb(hex) {
    var c = hexCache[hex];
    if (c) return c;
    var h = hex.replace('#', '');
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    }
    var num = parseInt(h, 16);
    c = { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
    hexCache[hex] = c;
    return c;
  }
  function rgbaStr(hex, a) {
    var c = hexToRgb(hex);
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + a + ')';
  }
  function mixHex(hexA, hexB, t) {
    var a = hexToRgb(hexA), b = hexToRgb(hexB);
    var r = Math.round(lerp(a.r, b.r, t));
    var g = Math.round(lerp(a.g, b.g, t));
    var bl = Math.round(lerp(a.b, b.b, t));
    return 'rgb(' + r + ',' + g + ',' + bl + ')';
  }

  function defaultTheme() {
    return { id: 'sakura', base: '#f6b8c8', deep: '#e88aa6', tip: '#fdeef3', shibe: '#f4cf6a' };
  }
  function getTheme(state) {
    try {
      var themes = window.NCFG && window.NCFG.THEMES;
      if (themes && state && themes[state.themeIndex]) return themes[state.themeIndex];
      if (themes && themes[0]) return themes[0];
    } catch (e) { /* noop */ }
    return defaultTheme();
  }

  // ============ 座標変換 ============
  function worldToScreenXY(wx, wy) {
    // wx,wy はローカル(rotation適用済み)ワールド座標
    return {
      x: view.cx + wx * view.scale,
      y: view.cy + wy * view.scale,
    };
  }

  function localToScreen(angle, radius) {
    var a = angle + view.rotation;
    var wx = Math.cos(a) * radius;
    var wy = Math.sin(a) * radius;
    return worldToScreenXY(wx, wy);
  }

  function screenToLocal(px, py) {
    var dx = (px - view.cx) / view.scale;
    var dy = (py - view.cy) / view.scale;
    var radius = Math.sqrt(dx * dx + dy * dy);
    var angle = Math.atan2(dy, dx) - view.rotation;
    return { angle: angle, radius: radius };
  }

  function getView() {
    return { cx: view.cx, cy: view.cy, scale: view.scale, rotation: view.rotation };
  }

  // ============ 初期化 / リサイズ ============
  function init(cnv) {
    canvas = cnv;
    ctx = canvas.getContext('2d');
    camInited = false;
    buildPaperPattern();
  }

  function resize(wCss, hCss, dpr) {
    view.wCss = wCss;
    view.hCss = hCss;
    view.dpr = dpr || 1;
    // main.js が canvas.width/height と style.width/height を既に設定している。
    // render() 前でも screenToLocal/getView が破綻しないよう、暫定のcx/cy/scaleを先に計算しておく。
    var CAM = (window.NCFG && window.NCFG.CAMERA) || {};
    var baseScale = CAM.baseScale != null ? CAM.baseScale : 0.30;
    var centerYShift = CAM.centerYShift != null ? CAM.centerYShift : -0.04;
    var shortSide = Math.min(wCss, hCss);
    view.scale = shortSide * baseScale * (camInited ? camZoom : 1.0);
    view.cx = wCss / 2;
    view.cy = hCss / 2 + shortSide * centerYShift;
  }

  // ============ 和紙背景テクスチャ（一度だけ生成してパターン化） ============
  function buildPaperPattern() {
    var size = 160;
    paperPatternSize = size;
    var off = document.createElement('canvas');
    off.width = size; off.height = size;
    var octx = off.getContext('2d');
    // ベースは透明。淡い斑点を撒く。
    var rnd = mulberry32(20260810);
    octx.clearRect(0, 0, size, size);
    var count = 130;
    for (var i = 0; i < count; i++) {
      var x = rnd() * size, y = rnd() * size;
      var r = 0.4 + rnd() * 1.1;
      var alpha = 0.02 + rnd() * 0.035;
      octx.beginPath();
      octx.arc(x, y, r, 0, Math.PI * 2);
      octx.fillStyle = 'rgba(150,110,80,' + alpha.toFixed(3) + ')';
      octx.fill();
    }
    // ごく淡い繊維の筋
    for (var j = 0; j < 18; j++) {
      octx.strokeStyle = 'rgba(170,130,90,' + (0.015 + rnd() * 0.02).toFixed(3) + ')';
      octx.lineWidth = 0.6 + rnd() * 0.5;
      octx.beginPath();
      var sx = rnd() * size, sy = rnd() * size;
      var len = 10 + rnd() * 26;
      var ang = rnd() * Math.PI;
      octx.moveTo(sx, sy);
      octx.lineTo(sx + Math.cos(ang) * len, sy + Math.sin(ang) * len);
      octx.stroke();
    }
    paperPatternCanvas = off;
  }

  // シードつき擬似乱数（決定的テクスチャ用）
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ============ カメラ ============
  function computeZoomTarget(state) {
    var CAM = (window.NCFG && window.NCFG.CAMERA) || {};
    var byStage = CAM.zoomByStage || [1.0, 1.12, 1.24];
    var revealZ = (CAM.zoomReveal != null) ? CAM.zoomReveal : 0.82;
    var phase = state.phase;
    if (phase === 'reveal') {
      var t = clamp(state.revealT || 0, 0, 1);
      var fromZ = byStage[byStage.length - 1];
      return lerp(fromZ, revealZ, easeOutCubic(t));
    }
    if (phase === 'finishing') {
      return byStage[byStage.length - 1];
    }
    var idx = clamp(state.activeRing || 0, 0, byStage.length - 1);
    return byStage[idx];
  }

  function updateCamera(state, dt) {
    var CAM = (window.NCFG && window.NCFG.CAMERA) || {};
    var ease = CAM.ease != null ? CAM.ease : 3.0;
    var target = computeZoomTarget(state);
    if (!camInited) {
      camZoom = target;
      camInited = true;
    } else {
      var k = 1 - Math.exp(-ease * Math.max(dt, 0));
      camZoom += (target - camZoom) * k;
    }
    var baseScale = CAM.baseScale != null ? CAM.baseScale : 0.30;
    var shortSide = Math.min(view.wCss, view.hCss);
    view.scale = shortSide * baseScale * camZoom;
    var centerYShift = CAM.centerYShift != null ? CAM.centerYShift : -0.04;
    view.cx = view.wCss / 2;
    view.cy = view.hCss / 2 + shortSide * centerYShift;
    view.rotation = state.rotation || 0;
  }

  // ============ 背景 ============
  function drawBackground(state) {
    var w = view.wCss, h = view.hCss;
    var g = ctx.createRadialGradient(
      w * 0.5, h * 0.38, Math.min(w, h) * 0.05,
      w * 0.5, h * 0.55, Math.max(w, h) * 0.85
    );
    g.addColorStop(0, '#fffaf1');
    g.addColorStop(0.45, '#fbf1e2');
    g.addColorStop(1, '#efe0c9');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    if (paperPatternCanvas) {
      try {
        var pat = ctx.createPattern(paperPatternCanvas, 'repeat');
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.fillStyle = pat;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      } catch (e) { /* パターン生成失敗時は無視 */ }
    }

    // 画面端をほんの少し暗くして視線を中央へ（ビネット）
    var vg = ctx.createRadialGradient(
      w * 0.5, h * 0.45, Math.min(w, h) * 0.35,
      w * 0.5, h * 0.5, Math.max(w, h) * 0.72
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(70,45,30,0.10)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // ============ 菓子皿 ============
  function drawPlate() {
    var plateR = 1.75 * view.scale;
    var cx = view.cx, cy = view.cy;

    // ソフトな影(皿の下)
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + plateR * 0.12, plateR * 0.96, plateR * 0.62, 0, 0, Math.PI * 2);
    var shadowG = ctx.createRadialGradient(cx, cy + plateR * 0.12, plateR * 0.1, cx, cy + plateR * 0.12, plateR * 0.98);
    shadowG.addColorStop(0, 'rgba(40,25,20,0.28)');
    shadowG.addColorStop(1, 'rgba(40,25,20,0)');
    ctx.fillStyle = shadowG;
    ctx.fill();
    ctx.restore();

    // 皿本体（漆黒、わずかに縦長のふちどり感を出すためやや楕円）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, plateR, 0, Math.PI * 2);
    var plateG = ctx.createRadialGradient(
      cx - plateR * 0.28, cy - plateR * 0.32, plateR * 0.05,
      cx, cy, plateR
    );
    plateG.addColorStop(0, '#2c2427');
    plateG.addColorStop(0.55, '#1c1417');
    plateG.addColorStop(1, '#0e0a0c');
    ctx.fillStyle = plateG;
    ctx.fill();

    // リム（縁の明るい輪）
    ctx.lineWidth = Math.max(1, plateR * 0.022);
    ctx.strokeStyle = 'rgba(255,235,210,0.14)';
    ctx.beginPath();
    ctx.arc(cx, cy, plateR * 0.985, 0, Math.PI * 2);
    ctx.stroke();

    // リムハイライト（左上の縁だけをふちどる細く淡い光。汚れ/欠けに見えないよう
    // 縁に沿った弧のみに限定し、面を横切る光筋は作らない）
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, plateR, 0, Math.PI * 2);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, plateR * 0.975, -2.35, -0.95);
    ctx.lineWidth = Math.max(1, plateR * 0.020);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, plateR * 0.975, -2.05, -1.25);
    ctx.lineWidth = Math.max(1, plateR * 0.010);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // ============ 練り切り本体（ベース球） ============
  function drawMochiBase(state, theme, breathScale) {
    var r = 1.0 * view.scale * breathScale;
    var cx = view.cx, cy = view.cy;

    // 落ち影（下寄り）
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + r * 0.62, r * 0.92, r * 0.34, 0, 0, Math.PI * 2);
    var sg = ctx.createRadialGradient(cx, cy + r * 0.62, r * 0.05, cx, cy + r * 0.62, r * 0.95);
    sg.addColorStop(0, 'rgba(30,18,16,0.22)');
    sg.addColorStop(1, 'rgba(30,18,16,0)');
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();

    // 締まり具合（中心タップ数）で少し扁平に見せる: activeRing===2 で center.count に応じ潰れ&squishパルス
    var squish = 0;
    if (state.center) squish = state.center.squish || 0;
    var flat = 1 - squish * 0.06;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, flat);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    // tip(明) -> deep(暗) の繊細なラジアルグラデ。トップライトはごく淡く。
    var bodyG = ctx.createRadialGradient(-r * 0.22, -r * 0.32, r * 0.05, 0, 0, r * 1.05);
    bodyG.addColorStop(0, mixHex(theme.tip, theme.base, 0.35));
    bodyG.addColorStop(0.55, theme.base);
    bodyG.addColorStop(1, theme.deep);
    ctx.fillStyle = bodyG;
    ctx.fill();

    // ごく淡いトップライト（マット、テカらせない）
    ctx.beginPath();
    ctx.ellipse(-r * 0.28, -r * 0.34, r * 0.42, r * 0.28, -0.4, 0, Math.PI * 2);
    var topG = ctx.createRadialGradient(-r * 0.28, -r * 0.34, 0, -r * 0.28, -r * 0.34, r * 0.42);
    topG.addColorStop(0, 'rgba(255,255,255,0.22)');
    topG.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = topG;
    ctx.fill();

    // 下部のソフトな陰(球体感)
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    var botG = ctx.createRadialGradient(0, r * 0.15, r * 0.4, 0, r * 0.15, r * 1.05);
    botG.addColorStop(0, 'rgba(0,0,0,0)');
    botG.addColorStop(1, rgbaStr(theme.deep, 0.28));
    ctx.fillStyle = botG;
    ctx.fill();

    ctx.restore();
  }

  // ============ 花びらの形（Path2D） ============
  // ローカル原点=花びら根元、+x方向が外側を指す向きで構築し、呼び出し側で回転/移動する。
  function buildPetalPath(len, width) {
    var p = new Path2D();
    var baseW = width * 0.5;
    // 根元から先端へ、はさみ菊らしい細長いへら型。密度を出すため先端近くまで
    // あまり細くならないよう（テーパーを緩めて）隣同士がしっかり重なる幅を保つ。
    p.moveTo(0, baseW * 0.62);
    p.bezierCurveTo(len * 0.20, baseW * 1.05, len * 0.50, baseW * 0.95, len * 0.82, baseW * 0.50);
    p.quadraticCurveTo(len * 1.00, 0, len * 0.82, -baseW * 0.50);
    p.bezierCurveTo(len * 0.50, -baseW * 0.95, len * 0.20, -baseW * 1.05, 0, -baseW * 0.62);
    p.quadraticCurveTo(-len * 0.05, 0, 0, baseW * 0.62);
    p.closePath();
    return p;
  }

  var petalPathCache = {};
  function getPetalPath(lenKey, widKey) {
    var key = lenKey + '_' + widKey;
    var p = petalPathCache[key];
    if (!p) {
      p = buildPetalPath(lenKey, widKey);
      petalPathCache[key] = p;
    }
    return p;
  }

  // 花びら1枚を描画。angle=ローカル角(rotation加算済み,画面基準),
  // rootBase/growth=根元半径の起点/せり出し量(world), outerLen/width=world単位, lift=0..1
  function drawPetal(theme, angle, rootBase, growth, outerLen, width, lift) {
    var t = easeOutBack(lift);
    var liftC = clamp(lift, 0, 1);
    var scaleT = 0.35 + 0.65 * clamp(t, 0, 1.15);
    // 切り込みから起き上がるにつれ、根元が外側へせり出す(リングごとの growth 量)
    var rootRadius = rootBase + growth * clamp(t, 0, 1.15);

    var rootX = view.cx + Math.cos(angle) * rootRadius * view.scale;
    var rootY = view.cy + Math.sin(angle) * rootRadius * view.scale;

    var lenPx = outerLen * view.scale * scaleT;
    var widPx = width * view.scale * scaleT;
    var path = getPetalPath(1, 1); // 単位パス、transformでスケール

    // 根元の接地陰(花びらが本体から起き上がって見えるコントラクトシャドウ)
    ctx.save();
    ctx.translate(rootX, rootY);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.ellipse(widPx * 0.06, 0, widPx * 0.55, widPx * 0.30, 0, 0, Math.PI * 2);
    var cs = ctx.createRadialGradient(0, 0, 0, 0, 0, widPx * 0.55);
    cs.addColorStop(0, rgbaStr(theme.deep, 0.30 * liftC));
    cs.addColorStop(1, rgbaStr(theme.deep, 0));
    ctx.fillStyle = cs;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(rootX, rootY);
    ctx.rotate(angle);
    ctx.scale(lenPx, widPx);

    // 花びらグラデ: 根元(deep寄り・はっきり) -> 中間(base) -> 先端(tip寄り、明るい)
    var g = ctx.createLinearGradient(0, 0, 1.0, 0);
    g.addColorStop(0, mixHex(theme.deep, theme.base, 0.28));
    g.addColorStop(0.4, theme.base);
    g.addColorStop(1, mixHex(theme.base, theme.tip, clamp(0.4 + 0.28 * t, 0, 0.78)));
    ctx.fillStyle = g;
    ctx.fill(path);

    // 中央の淡い筋（マットな質感の陰影・花弁の谷）
    ctx.save();
    ctx.clip(path);
    ctx.strokeStyle = rgbaStr(theme.deep, 0.20);
    ctx.lineWidth = 0.045;
    ctx.beginPath();
    ctx.moveTo(0.1, 0);
    ctx.lineTo(0.88, 0);
    ctx.stroke();
    // 縁の内側にほんの少し影を落として輪郭を締める
    ctx.strokeStyle = rgbaStr(theme.deep, 0.14);
    ctx.lineWidth = 0.045;
    ctx.stroke(path);
    // 先端の明るいハイライト（控えめ）
    var hi = ctx.createRadialGradient(0.76, -0.06, 0.02, 0.76, -0.06, 0.42);
    hi.addColorStop(0, 'rgba(255,255,255,0.28)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fillRect(0, -0.5, 1, 1);
    ctx.restore();

    // (根元の切り込みは個々の花びらへ直線ストロークを描かず、drawCenterCrease() の
    //  柔らかい円形クリースでまとめて表現する。花びらが多数並ぶとここの直線が隣同士で
    //  つながり、中心の周りに硬い多角形の輪郭線に見えてしまうため。)

    ctx.restore();
  }

  // ============ リング & 花びら描画 ============
  // 花びらのジオメトリ: ring.r はコア(ゲームロジック)所有の値なので描画では使わず、
  // 見た目の迫力(密度・豪華さ)専用の値をここで独立管理する。
  //   rootBase : 切った直後(lift=0)の根元半径(world)
  //   growth   : lift到達時に根元がさらにせり出す量(world)。完了時の根元半径 ≈ rootBase+growth
  //   len      : 花びらの長さパラメータ(world)。buildPetalPathの先端は二次ベジエの制御点由来で
  //              実際の最大到達点は len の約0.91倍(制御点1.00そのものではない)。
  //              完了時の先端半径 ≈ (rootBase+growth) + len*0.91
  //   width    : 花びらの幅パラメータ(world)
  var PETAL_GEOM = [
    { rootBase: 0.28, growth: 0.12, len: 0.705, width: 0.62 }, // 外周10枚: 根元≈0.40→先端≈1.04(花のシルエットが円でなくスカラップ状に見える分だけ練り切りの縁より外へ)
    { rootBase: 0.11, growth: 0.07, len: 0.42, width: 0.42 }, // 中段7枚: 根元≈0.18→先端≈0.60(外周花びらの根元に重なる)
  ];
  var PETAL_GEOM_FALLBACK = { rootBase: 0.05, growth: 0.03, len: 0.20, width: 0.18 };
  function petalGeomForRing(ringIndex) {
    return PETAL_GEOM[ringIndex] || PETAL_GEOM_FALLBACK;
  }

  function drawPetalsForRing(state, theme, ringIndex) {
    var ring = state.rings[ringIndex];
    if (!ring) return;
    var geo = petalGeomForRing(ringIndex);
    var n = ring.n;
    for (var slot = 0; slot < n; slot++) {
      if (!ring.cut[slot]) continue;
      var lift = ring.lift[slot] || 0;
      var localAngle = ring.offset + slot * (Math.PI * 2 / n);
      var screenAngle = localAngle + view.rotation;
      drawPetal(theme, screenAngle, geo.rootBase, geo.growth, geo.len, geo.width, lift);
    }
  }

  function drawAllPetals(state, theme) {
    // 外周を先(下)、中段を後(上)に重ねる。リング配列は外→内なので index昇順でよい。
    for (var i = 0; i < state.rings.length; i++) {
      drawPetalsForRing(state, theme, i);
    }
  }

  // ============ 中心まわりの柔らかいクリース ============
  // 未完成の中央ドームと花びらの間の「継ぎ目」を、直線の集合(=硬い多角形)ではなく
  // 完全な円(グラデーションの薄い影の輪)で表現する。ctx.arc由来の真円なので
  // 花びらの枚数に関わらずカクカクした輪郭にはならない。
  function drawCenterCrease(state, theme, breathScale) {
    var cx = view.cx, cy = view.cy;
    var squish = (state.center && state.center.squish) || 0;
    var need = (state.center && state.center.need) || 3;
    var count = (state.center && state.center.count) || 0;
    var progress = need > 0 ? clamp(count / need, 0, 1) : 0;

    // 花芯が締まる(progress上昇)につれてクリースも少し内側へ寄る。squishでほんの少し息づく。
    var pulse = 1 + 0.05 * Math.sin(squish * Math.PI);
    var innerR = (0.27 - progress * 0.05) * view.scale * breathScale * pulse;
    var outerR = (0.47 - progress * 0.07) * view.scale * breathScale * pulse;
    if (outerR <= innerR + 0.001) return;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.beginPath();
    ctx.arc(0, 0, outerR, 0, Math.PI * 2);
    var cg = ctx.createRadialGradient(0, 0, innerR, 0, 0, outerR);
    cg.addColorStop(0, 'rgba(0,0,0,0)');
    cg.addColorStop(0.5, rgbaStr(theme.deep, 0.15));
    cg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.restore();
  }

  // ============ 中心のしべ ============
  function drawCenter(state, theme, breathScale) {
    var cx = view.cx, cy = view.cy;
    var squish = (state.center && state.center.squish) || 0;
    var need = (state.center && state.center.need) || 3;
    var count = (state.center && state.center.count) || 0;
    var progress = need > 0 ? clamp(count / need, 0, 1) : 0;

    var isDone = state.phase === 'finishing' || state.phase === 'reveal' ||
      (state.activeRing >= 2 && progress >= 1);

    var baseR = 0.30 * view.scale * breathScale;
    // activeRing<2: 滑らかな山なり(まだ未着手の中央ドーム)
    // count が増えるごとに締まる: 半径を少し縮め、盛り上がりを持たせる
    var r = baseR * (1 - progress * 0.28);
    var pulse = 1 - 0.16 * Math.sin(squish * Math.PI); // squish時にぷにっと凹む

    ctx.save();
    ctx.translate(cx, cy);

    // ドーム本体
    ctx.beginPath();
    ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
    var domeG = ctx.createRadialGradient(-r * 0.25, -r * 0.3, r * 0.05, 0, 0, r * 1.05);
    domeG.addColorStop(0, mixHex(theme.tip, theme.base, 0.2));
    domeG.addColorStop(0.6, theme.base);
    domeG.addColorStop(1, mixHex(theme.deep, theme.base, 0.5));
    ctx.fillStyle = domeG;
    ctx.fill();

    // 淡いハイライト
    ctx.beginPath();
    ctx.ellipse(-r * 0.22, -r * 0.26, r * 0.34, r * 0.22, -0.4, 0, Math.PI * 2);
    var hi = ctx.createRadialGradient(-r * 0.22, -r * 0.26, 0, -r * 0.22, -r * 0.26, r * 0.34);
    hi.addColorStop(0, 'rgba(255,255,255,0.28)');
    hi.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = hi;
    ctx.fill();

    // 完成したら黄色いしべ粒(菊の芯)
    if (isDone) {
      var grains = 10;
      var gR = r * 0.64;
      var grainSize = r * 0.18;
      for (var i = 0; i < grains; i++) {
        var a = (i / grains) * Math.PI * 2 + 0.3;
        var gx = Math.cos(a) * gR;
        var gy = Math.sin(a) * gR;
        ctx.beginPath();
        ctx.arc(gx, gy, grainSize, 0, Math.PI * 2);
        var gg = ctx.createRadialGradient(gx - grainSize * 0.3, gy - grainSize * 0.3, grainSize * 0.05, gx, gy, grainSize);
        gg.addColorStop(0, mixHex(theme.shibe, '#ffffff', 0.35));
        gg.addColorStop(1, theme.shibe);
        ctx.fillStyle = gg;
        ctx.fill();
      }
      // 中心の小さな一粒
      ctx.beginPath();
      ctx.arc(0, 0, grainSize * 0.85, 0, Math.PI * 2);
      ctx.fillStyle = mixHex(theme.shibe, '#ffffff', 0.3);
      ctx.fill();
    } else if (count > 0) {
      // タップ途中: 中心に小さな凹みの影で「押されている感」
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.35 * (1 + squish * 0.3), 0, Math.PI * 2);
      ctx.fillStyle = rgbaStr(theme.deep, 0.18 + 0.12 * (count / need));
      ctx.fill();
    }

    ctx.restore();
  }

  // ============ nextHint ガイド ============
  function drawHint(state, dt) {
    if (!state.nextHint) return;
    hintT += dt;
    var pulse = 0.5 + 0.5 * Math.sin(hintT * 3.4);
    var pos;
    if (state.nextHint.ringIndex === 2) {
      pos = { x: view.cx, y: view.cy };
    } else {
      pos = localToScreen(state.nextHint.angle, state.nextHint.radius);
    }

    ctx.save();
    ctx.translate(pos.x, pos.y);

    // きらめき(背後の淡い光暈)
    var glowR = view.scale * (0.16 + 0.03 * pulse);
    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, 'rgba(255,250,220,' + (0.45 * pulse + 0.15).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    // 小さなきらきら十字(スパークル) x3
    drawSparkle(0, 0, view.scale * (0.09 + 0.015 * pulse), 0.9);
    drawSparkle(glowR * 0.55, -glowR * 0.35, view.scale * 0.035, 0.6 * pulse + 0.2);
    drawSparkle(-glowR * 0.5, glowR * 0.4, view.scale * 0.028, 0.5 * pulse + 0.2);

    // 簡略ハサミ(✂風)アイコン: 支点(原点)を中心に2本の腕が交差するX字。
    // 各腕は「持ち手の輪(手前)〜支点〜刃先(奥)」が一直線になるよう構成し、
    // 2本の腕の角度を上下対称にすることで本物のハサミらしい交差が生まれる。
    var s = view.scale * (0.20 + 0.014 * pulse);
    ctx.save();
    ctx.rotate(-0.5);
    var armAngle = 0.36; // 腕の開き角(rad)
    var handleLen = s * 0.62;
    var bladeLen = s * 0.98;
    var ringR = s * 0.20;
    var outline = 'rgba(110,64,54,0.92)';
    var fillCol = 'rgba(255,255,255,0.97)';

    function drawArm(ang) {
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var hx = -handleLen * dx, hy = -handleLen * dy; // 持ち手側
      var bx = bladeLen * dx, by = bladeLen * dy;      // 刃先側
      // 腕(白フチ+濃い縁)
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = fillCol;
      ctx.lineWidth = s * 0.155;
      ctx.stroke();
      ctx.strokeStyle = outline;
      ctx.lineWidth = s * 0.06;
      ctx.stroke();
      // 刃先(小さな三角の切っ先)
      var nx = -dy, ny = dx;
      var tipW = s * 0.085;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - dx * s * 0.16 + nx * tipW, by - dy * s * 0.16 + ny * tipW);
      ctx.lineTo(bx - dx * s * 0.16 - nx * tipW, by - dy * s * 0.16 - ny * tipW);
      ctx.closePath();
      ctx.fillStyle = outline;
      ctx.fill();
      // 持ち手の輪(指を通す穴)
      ctx.beginPath();
      ctx.arc(hx, hy, ringR, 0, Math.PI * 2);
      ctx.fillStyle = fillCol;
      ctx.fill();
      ctx.lineWidth = s * 0.075;
      ctx.strokeStyle = outline;
      ctx.stroke();
    }

    drawArm(-armAngle);
    drawArm(armAngle);

    // 支点のねじ
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.075, 0, Math.PI * 2);
    ctx.fillStyle = outline;
    ctx.fill();

    ctx.restore();
    ctx.restore();
  }

  function drawSparkle(x, y, r, alpha) {
    if (r <= 0 || alpha <= 0) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = 'rgba(255,255,255,' + clamp(alpha, 0, 1).toFixed(3) + ')';
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
    ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
    ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
    ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ============ メインレンダー ============
  function render(state, dt) {
    if (!ctx || !canvas || !state) return;
    dt = (typeof dt === 'number' && isFinite(dt)) ? dt : 0;

    try {
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      updateCamera(state, dt);

      var theme = getTheme(state);

      // 背景
      drawBackground(state);

      // 呼吸(finishing/reveal のみ)
      var breathScale = 1;
      if (state.phase === 'finishing' || state.phase === 'reveal') {
        breathT += dt;
        breathScale = 1 + Math.sin(breathT * 1.6) * 0.012;
      }

      // 皿(回さない)
      drawPlate();

      // 練り切り+花びらは rotation を適用済みの角度で描画(drawPetal内でview.rotationを加算)
      drawMochiBase(state, theme, breathScale);
      drawCenterCrease(state, theme, breathScale);
      if (state.rings) drawAllPetals(state, theme);
      drawCenter(state, theme, breathScale);

      // ガイド
      drawHint(state, dt);
    } catch (e) {
      console.error('NerikiriRender.render error', e);
    }
  }

  window.NerikiriRender = {
    init: init,
    resize: resize,
    render: render,
    screenToLocal: screenToLocal,
    localToScreen: localToScreen,
    getView: getView,
  };
})();
