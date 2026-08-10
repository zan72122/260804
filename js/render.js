// render — Canvas2D 描画・カメラ・座標変換（Agent-RENDER 所有） v2
// テーマ: 和菓子「はさみ菊」練り切り。丸いドームに無数の小さな鱗状花びらを彫り込み、
// 斜め3/4視点の疑似3Dで「彫刻された密度」と「ドームの盛り上がり」を表現する。
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

  // 呼吸アニメ用の位相 / ガイドのパルス位相
  var breathT = 0;
  var hintT = 0;

  // オフスクリーンにキャッシュする和紙テクスチャパターン
  var paperPatternCanvas = null;

  // 小花びらスプライトキャッシュ: spriteCache[themeId][sizeClass] = {canvas, originX, originY}
  var spriteCache = {};
  var spriteBakedScale = 0; // resize時のズーム非依存の基準scale(px/world)
  var SPRITE_HEADROOM = 1.4; // カメラズーム最大(~1.24)でもボケないための余裕

  // クラスター(スロット内の小花びら配置)は静的ジオメトリなのでキャッシュ
  var clusterCache = {};
  var centerRingCache = null;

  // ============ 疑似3D 投影パラメータ ============
  var TILT = 34 * Math.PI / 180; // チルト角(斜め3/4視点)
  var COS_T = Math.cos(TILT), SIN_T = Math.sin(TILT);
  var DOME_H0 = 0.55;       // ドーム中央の最大高さ(world)
  var DOME_RIM_R = 1.0;     // このrまではcosプロファイル
  var DOME_FLAT_R = 1.3;    // このrで高さ0(皿面)に収束

  // ============ ユーティリティ ============
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeOutBack(t) {
    var c1 = 1.70158, c3 = c1 + 1;
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
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
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

  // シードつき擬似乱数(整数シード1発 -> 0..1)。手作業感ジッタ用、決定論的。
  function seededRand(seed) {
    var t = seed >>> 0;
    t = (t + 0x6D2B79F5) | 0;
    var r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  }
  // 決定的テクスチャ用(連続呼び出しで系列を生成するタイプ)
  function mulberry32(seed) {
    var t = seed >>> 0;
    return function () {
      t |= 0; t = (t + 0x6D2B79F5) | 0;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
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

  // ============ ドーム面プロファイル & 疑似3D投影 ============
  // domeHeight: r=0(中央)で最大、rim(=1.0)へなだらかに下がり、1.3で皿面(高さ0)に収束。
  function domeHeight(r) {
    if (r < 0) r = 0;
    if (r <= DOME_RIM_R) {
      return DOME_H0 * Math.cos(r * Math.PI / 2 * 0.9);
    }
    var edge = DOME_H0 * Math.cos(DOME_RIM_R * Math.PI / 2 * 0.9);
    var t = (r - DOME_RIM_R) / (DOME_FLAT_R - DOME_RIM_R);
    if (t > 1) t = 1;
    return edge * (1 - t);
  }

  // worldAngle(=ローカル角+rotation), r -> 3D点+スクリーン座標
  function project(worldAngle, r, extraScale) {
    var s = view.scale * (extraScale || 1);
    var x = Math.cos(worldAngle) * r;
    var y = Math.sin(worldAngle) * r;
    var z = domeHeight(r);
    return {
      x: x, y: y, z: z,
      sx: view.cx + x * s,
      sy: view.cy + (y * COS_T - z * SIN_T) * s,
    };
  }

  // 投影面上である方向(rを微増させた向き)がスクリーン上でどちらを向くか。
  // ドームの傾斜・チルトを織り込んだ「見た目の外向き」角度(花びらの向きに使う)。
  function outwardScreenAngle(worldAngle, r, extraScale) {
    var a = project(worldAngle, Math.max(0.02, r), extraScale);
    var b = project(worldAngle, r + 0.06, extraScale);
    var dx = b.sx - a.sx, dy = b.sy - a.sy;
    if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return worldAngle;
    return Math.atan2(dy, dx);
  }

  // ============ 座標変換API(契約: 互いに逆写像) ============
  function localToScreen(angle, radius) {
    var a = angle + view.rotation;
    var p = project(a, radius, 1);
    return { x: p.sx, y: p.sy };
  }

  function screenToLocal(px, py) {
    var dx = (px - view.cx) / view.scale;
    var dyRaw = (py - view.cy) / view.scale;
    // zはrに依存するため、初期推定→固定点反復で収束させる(往復誤差<=0.02world狙い)
    var z = domeHeight(0.5);
    var wy = 0, r = 0;
    for (var i = 0; i < 8; i++) {
      wy = (dyRaw + z * SIN_T) / COS_T;
      r = Math.sqrt(dx * dx + wy * wy);
      z = domeHeight(r);
    }
    var angle = Math.atan2(wy, dx) - view.rotation;
    return { angle: angle, radius: r };
  }

  function getView() {
    return { cx: view.cx, cy: view.cy, scale: view.scale, rotation: view.rotation };
  }

  // ============ 初期化 / リサイズ ============
  function init(cnv) {
    canvas = cnv;
    ctx = canvas.getContext('2d');
    camInited = false;
    clusterCache = {};
    centerRingCache = null;
    buildPaperPattern();
    buildSprites();
  }

  function resize(wCss, hCss, dpr) {
    view.wCss = wCss;
    view.hCss = hCss;
    view.dpr = dpr || 1;
    var CAM = (window.NCFG && window.NCFG.CAMERA) || {};
    var baseScale = CAM.baseScale != null ? CAM.baseScale : 0.30;
    var centerYShift = CAM.centerYShift != null ? CAM.centerYShift : -0.04;
    var shortSide = Math.min(wCss, hCss);
    view.scale = shortSide * baseScale * (camInited ? camZoom : 1.0);
    view.cx = wCss / 2;
    view.cy = hCss / 2 + shortSide * centerYShift;
    // スプライトはズーム非依存の基準scaleで焼き直す(テーマ変更/resize時のみ)
    spriteBakedScale = shortSide * baseScale;
    buildSprites();
  }

  // ============ 和紙背景テクスチャ ============
  function buildPaperPattern() {
    var size = 160;
    var off = document.createElement('canvas');
    off.width = size; off.height = size;
    var octx = off.getContext('2d');
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
    if (phase === 'finishing') return byStage[byStage.length - 1];
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

    var vg = ctx.createRadialGradient(
      w * 0.5, h * 0.45, Math.min(w, h) * 0.35,
      w * 0.5, h * 0.5, Math.max(w, h) * 0.72
    );
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(70,45,30,0.10)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  // ============ 菓子皿(チルトに合わせた楕円) ============
  function drawPlate(theme, glowAlpha) {
    var s = view.scale;
    var rx = 1.75 * s, ry = 1.75 * s * COS_T;
    var cx = view.cx, cy = view.cy;

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + ry * 0.16, rx * 0.97, ry * 0.62, 0, 0, Math.PI * 2);
    var shadowG = ctx.createRadialGradient(cx, cy + ry * 0.16, rx * 0.1, cx, cy + ry * 0.16, rx * 0.98);
    shadowG.addColorStop(0, 'rgba(40,25,20,0.28)');
    shadowG.addColorStop(1, 'rgba(40,25,20,0)');
    ctx.fillStyle = shadowG;
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    var plateG = ctx.createRadialGradient(cx - rx * 0.28, cy - ry * 0.32, rx * 0.05, cx, cy, rx);
    plateG.addColorStop(0, '#2c2427');
    plateG.addColorStop(0.55, '#1c1417');
    plateG.addColorStop(1, '#0e0a0c');
    ctx.fillStyle = plateG;
    ctx.fill();

    if (glowAlpha > 0) {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      var glowG = ctx.createRadialGradient(cx, cy, rx * 0.05, cx, cy, rx * 0.78);
      glowG.addColorStop(0, rgbaStr(theme.base, 0.22 * glowAlpha));
      glowG.addColorStop(1, rgbaStr(theme.base, 0));
      ctx.fillStyle = glowG;
      ctx.fill();
    }

    ctx.lineWidth = Math.max(1, rx * 0.022);
    ctx.strokeStyle = 'rgba(255,235,210,0.14)';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.985, ry * 0.985, 0, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.975, ry * 0.975, 0, -2.35, -0.95);
    ctx.lineWidth = Math.max(1, rx * 0.020);
    ctx.strokeStyle = 'rgba(255,255,255,0.09)';
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx * 0.975, ry * 0.975, 0, -2.05, -1.25);
    ctx.lineWidth = Math.max(1, rx * 0.010);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }

  // ============ 練り切りドーム本体(層状楕円+球面ライティング) ============
  // r=const の円は(x,y,z)投影の下で常に「楕円」になる(zはrのみに依存するため)。
  // これを外側(r大)から内側(r=0/頂点)へ塗り重ねることで、なめらかな盛り上がりを表現する。
  var DOME_BANDS = 16;
  var DOME_MAX_R = 1.2;
  function drawMochiDome(theme, breathMul, flat) {
    var s = view.scale * breathMul;

    // 接地影(皿への設置感)
    var edgeZ = domeHeight(DOME_MAX_R);
    var baseCy = view.cy - edgeZ * SIN_T * s;
    var shR = DOME_MAX_R * s;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(view.cx, baseCy + shR * COS_T * 0.22, shR * 0.98, shR * COS_T * 0.5 * flat, 0, 0, Math.PI * 2);
    var shG = ctx.createRadialGradient(view.cx, baseCy + shR * COS_T * 0.22, shR * 0.1, view.cx, baseCy + shR * COS_T * 0.22, shR);
    shG.addColorStop(0, 'rgba(30,18,16,0.30)');
    shG.addColorStop(1, 'rgba(30,18,16,0)');
    ctx.fillStyle = shG;
    ctx.fill();
    ctx.restore();

    var outerRx = 0, outerRy = 0, outerCy = 0, apexCy = 0;
    var apexCol = mixHex('#fffdf5', theme.tip, 0.32);
    var edgeCol = mixHex(theme.base, theme.deep, 0.38);
    for (var i = DOME_BANDS; i >= 0; i--) {
      var r = DOME_MAX_R * (i / DOME_BANDS);
      var z = domeHeight(r);
      var cy2 = view.cy - z * SIN_T * s;
      var rx = r * s;
      var ry = r * s * COS_T * flat;
      if (i === DOME_BANDS) { outerRx = rx; outerRy = ry; outerCy = cy2; }
      if (i === 0) apexCy = cy2;
      if (rx <= 0.01) continue;
      var t = i / DOME_BANDS;
      var col = mixHex(apexCol, edgeCol, t);
      ctx.beginPath();
      ctx.ellipse(view.cx, cy2, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = col;
      ctx.fill();
    }

    // 球面ライティング・オーバーレイ(radialGradient 1発): 中央上部が明るく、縁へ落ちる
    if (outerRx > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(view.cx, outerCy, outerRx, outerRy, 0, 0, Math.PI * 2);
      ctx.clip();
      var lightCx = view.cx - outerRx * 0.22;
      var lightCy = apexCy - outerRy * 0.10;
      var lg = ctx.createRadialGradient(lightCx, lightCy, outerRx * 0.02, lightCx, lightCy, outerRx * 1.15);
      lg.addColorStop(0, 'rgba(255,255,255,0.30)');
      lg.addColorStop(0.5, 'rgba(255,255,255,0.03)');
      lg.addColorStop(1, 'rgba(55,35,28,0.16)');
      ctx.fillStyle = lg;
      ctx.fillRect(view.cx - outerRx * 1.3, outerCy - outerRy * 2.4, outerRx * 2.6, outerRy * 4.2);
      ctx.restore();
    }
  }

  // ============ 小花びらスプライト生成(テーマ×サイズ段階) ============
  // ローカル単位: 根元(0,0)、先端方向+y。中央稜線で左右2面に分割し、
  // 受光面(明)/影面(暗)+根元AO+先端ハイライトを1枚のスプライトに焼き込む。
  var SIZE_CLASSES = [
    { len: 0.150, wid: 0.100 }, // 0: S(中心寄り)
    { len: 0.205, wid: 0.140 }, // 1: M
    { len: 0.265, wid: 0.180 }, // 2: L
    { len: 0.330, wid: 0.225 }, // 3: XL(外周)
  ];

  function renderPetalSprite(theme, sizeSpec, ppu) {
    var halfW = sizeSpec.wid / 2;
    var len = sizeSpec.len;
    var padSide = 0.24, padBottom = 0.30;
    var cw = Math.max(6, Math.round(sizeSpec.wid * (1 + padSide * 2) * ppu));
    var ch = Math.max(6, Math.round(len * (1 + padBottom) * ppu));
    var off = document.createElement('canvas');
    off.width = cw; off.height = ch;
    var o = off.getContext('2d');
    var originX = cw / 2;
    var originY = ch - padBottom * 0.55 * len * ppu;

    function toPx(wx, wy) { return [originX + wx * ppu, originY - wy * ppu]; }

    // 根元の落ち影(AO)
    var aoRx = halfW * 1.35 * ppu, aoRy = halfW * 0.62 * ppu;
    var aoP = toPx(0, 0);
    o.save();
    o.beginPath();
    o.ellipse(aoP[0], aoP[1] + aoRy * 0.35, aoRx, aoRy, 0, 0, Math.PI * 2);
    var aoG = o.createRadialGradient(aoP[0], aoP[1] + aoRy * 0.35, 1, aoP[0], aoP[1] + aoRy * 0.35, aoRx);
    aoG.addColorStop(0, 'rgba(70,45,35,0.34)');
    aoG.addColorStop(1, 'rgba(70,45,35,0)');
    o.fillStyle = aoG;
    o.fill();
    o.restore();

    // しずく型パス: 根元やや細く、途中で膨らみ、先端は立ち上がる尖り
    var p0 = toPx(0, 0);
    var r1 = toPx(halfW * 0.92, len * 0.06), r2 = toPx(halfW * 1.06, len * 0.42), r3 = toPx(halfW * 0.16, len * 0.85);
    var tip = toPx(0, len * 1.0);
    var l3 = toPx(-halfW * 0.16, len * 0.85), l2 = toPx(-halfW * 1.06, len * 0.42), l1 = toPx(-halfW * 0.92, len * 0.06);
    var path = new Path2D();
    path.moveTo(p0[0], p0[1]);
    path.bezierCurveTo(r1[0], r1[1], r2[0], r2[1], r3[0], r3[1]);
    path.quadraticCurveTo(tip[0], tip[1], l3[0], l3[1]);
    path.bezierCurveTo(l2[0], l2[1], l1[0], l1[1], p0[0], p0[1]);
    path.closePath();

    // ベースグラデ: 根元(白〜クリーム) -> 先端(テーマdeep)
    var g = o.createLinearGradient(p0[0], p0[1], tip[0], tip[1]);
    g.addColorStop(0, '#f7f2e8');
    g.addColorStop(0.42, theme.base);
    g.addColorStop(1, theme.deep);
    o.fillStyle = g;
    o.fill(path);

    // 中央稜線で左右2面に分割: 受光面(明)/影面(暗) — 彫り込みの立体感の核心
    o.save();
    o.clip(path);
    o.fillStyle = 'rgba(255,255,255,0.24)';
    o.fillRect(originX - halfW * 1.3 * ppu, originY - len * 1.15 * ppu, halfW * 1.3 * ppu, len * 1.3 * ppu);
    o.fillStyle = 'rgba(60,35,30,0.20)';
    o.fillRect(originX, originY - len * 1.15 * ppu, halfW * 1.3 * ppu, len * 1.3 * ppu);
    // 稜線の細いハイライト
    o.strokeStyle = 'rgba(255,255,255,0.35)';
    o.lineWidth = Math.max(0.5, ppu * 0.01);
    o.beginPath();
    o.moveTo(p0[0], p0[1]);
    o.lineTo(tip[0], tip[1]);
    o.stroke();
    // 先端のきらめき
    var tipG = o.createRadialGradient(tip[0], tip[1], 0, tip[0], tip[1], halfW * 0.9 * ppu);
    tipG.addColorStop(0, 'rgba(255,255,255,0.35)');
    tipG.addColorStop(1, 'rgba(255,255,255,0)');
    o.fillStyle = tipG;
    o.beginPath();
    o.arc(tip[0], tip[1], halfW * 0.9 * ppu, 0, Math.PI * 2);
    o.fill();
    o.restore();

    // 輪郭は極細のトーン差のみ(暗色の縁取り線は使わない)
    o.strokeStyle = 'rgba(120,85,60,0.16)';
    o.lineWidth = Math.max(0.5, ppu * 0.008);
    o.stroke(path);

    return { canvas: off, originX: originX, originY: originY };
  }

  function buildSprites() {
    var themes = (window.NCFG && window.NCFG.THEMES) || [defaultTheme()];
    var ppu = Math.max(20, spriteBakedScale * SPRITE_HEADROOM);
    var cache = {};
    for (var i = 0; i < themes.length; i++) {
      var th = themes[i];
      var arr = [];
      for (var s = 0; s < SIZE_CLASSES.length; s++) {
        arr.push(renderPetalSprite(th, SIZE_CLASSES[s], ppu));
      }
      cache[th.id] = arr;
    }
    spriteCache = cache;
  }

  // ============ クラスター彫り込みジオメトリ ============
  // 外周スロット(36°扇形相当): 3列(段違い)=8枚。中段スロット(51.4°扇形相当): 2列=5枚。
  var CLUSTER_DEF = [
    { columns: [
      { r: 0.95, count: 3, sizeClass: 3, pitch: 0.0 },
      { r: 0.76, count: 3, sizeClass: 2, pitch: 0.5 },
      { r: 0.58, count: 2, sizeClass: 1, pitch: 0.25 },
    ] },
    { columns: [
      { r: 0.42, count: 3, sizeClass: 1, pitch: 0.0 },
      { r: 0.27, count: 2, sizeClass: 0, pitch: 0.5 },
    ] },
  ];

  function getClusterPetals(ringIndex, slot, n) {
    var key = ringIndex + '_' + slot;
    var hit = clusterCache[key];
    if (hit) return hit;
    var def = CLUSTER_DEF[ringIndex];
    if (!def) { clusterCache[key] = []; return []; }
    var sectorWidth = (Math.PI * 2 / n) * 1.06; // わずかに重なるよう広めに
    var list = [];
    var idx = 0;
    for (var c = 0; c < def.columns.length; c++) {
      var col = def.columns[c];
      var step = sectorWidth / col.count;
      for (var i = 0; i < col.count; i++) {
        var baseAngle = -sectorWidth / 2 + step * (i + 0.5) + (col.pitch || 0) * step;
        var seedBase = (ringIndex + 1) * 1000000 + slot * 10000 + c * 1000 + i * 10;
        var aJ = (seededRand(seedBase + 1) - 0.5) * 2 * 0.05 * sectorWidth;
        var rJ = 1 + (seededRand(seedBase + 2) - 0.5) * 2 * 0.05;
        var sJ = 1 + (seededRand(seedBase + 3) - 0.5) * 2 * 0.06;
        var rotJ = (seededRand(seedBase + 4) - 0.5) * 2 * 0.14;
        list.push({
          angleOffset: baseAngle + aJ,
          radius: col.r * rJ,
          sizeClass: col.sizeClass,
          sizeMul: sJ,
          rot: rotJ,
          idx: idx,
        });
        idx++;
      }
    }
    var total = list.length;
    for (var k = 0; k < total; k++) {
      list[k].phase = total > 1 ? (list[k].idx / (total - 1)) * 0.35 : 0;
    }
    clusterCache[key] = list;
    return list;
  }

  // 現フレームで描くべき全花びらインスタンスを収集(奥→手前ソート用のsortYを付与)
  function collectPetalInstances(state) {
    var list = [];
    for (var ri = 0; ri < 2; ri++) {
      var ring = state.rings && state.rings[ri];
      if (!ring) continue;
      for (var slot = 0; slot < ring.n; slot++) {
        if (!ring.cut[slot]) continue;
        var liftRaw = ring.lift[slot] || 0;
        var slotAngle = ring.offset + slot * (Math.PI * 2 / ring.n);
        var cluster = getClusterPetals(ri, slot, ring.n);
        for (var k = 0; k < cluster.length; k++) {
          var e = cluster[k];
          var denom = 1 - e.phase; if (denom <= 0.0001) denom = 0.0001;
          var localT = (liftRaw - e.phase) / denom;
          if (localT <= 0) continue;
          if (localT > 1) localT = 1;
          var worldAngle = slotAngle + e.angleOffset + view.rotation;
          list.push({
            worldAngle: worldAngle,
            radius: e.radius,
            sizeClass: e.sizeClass,
            sizeMul: e.sizeMul,
            rot: e.rot,
            liftT: localT,
            sortY: e.radius * Math.sin(worldAngle),
          });
        }
      }
    }
    return list;
  }

  function drawPetalInstance(theme, inst, breathMul) {
    var sprites = spriteCache[theme.id];
    if (!sprites) return;
    var sprite = sprites[inst.sizeClass] || sprites[0];
    if (!sprite) return;
    var eased = easeOutBack(inst.liftT);
    var scaleT = 0.22 + 0.78 * clamp(eased, -0.3, 1.2);
    if (scaleT <= 0.001) return;
    var p = project(inst.worldAngle, inst.radius, breathMul);
    var outward = outwardScreenAngle(inst.worldAngle, inst.radius, breathMul);
    var ratio = (view.scale * breathMul / (spriteBakedScale || 1)) * inst.sizeMul * scaleT;
    if (!(ratio > 0)) return;
    ctx.save();
    ctx.translate(p.sx, p.sy);
    ctx.rotate(outward + Math.PI / 2 + inst.rot);
    var dw = sprite.canvas.width * ratio, dh = sprite.canvas.height * ratio;
    ctx.drawImage(sprite.canvas, -sprite.originX * ratio, -sprite.originY * ratio, dw, dh);
    ctx.restore();
  }

  // ============ 中心タップ: 最内周の微小花びら環 ============
  var CENTER_RING_COUNT = 14;
  function getCenterRingPetals() {
    if (centerRingCache) return centerRingCache;
    var list = [];
    for (var i = 0; i < CENTER_RING_COUNT; i++) {
      var seed = 9000000 + i * 10;
      var baseAngle = (i / CENTER_RING_COUNT) * Math.PI * 2;
      var aJ = (seededRand(seed + 1) - 0.5) * 2 * 0.12;
      var rJ = 1 + (seededRand(seed + 2) - 0.5) * 2 * 0.06;
      var rotJ = (seededRand(seed + 3) - 0.5) * 2 * 0.18;
      list.push({ angle: baseAngle + aJ, rMul: rJ, rot: rotJ, idx: i });
    }
    centerRingCache = list;
    return list;
  }

  function drawCenterRing(state, theme, breathMul) {
    var sprites = spriteCache[theme.id];
    if (!sprites) return;
    var sprite = sprites[0];
    var need = (state.center && state.center.need) || 0;
    var count = (state.center && state.center.count) || 0;
    var p = need > 0 ? clamp(count / need, 0, 1) : 0;
    var squish = (state.center && state.center.squish) || 0;
    var petals = getCenterRingPetals();
    var total = petals.length;
    for (var i = 0; i < total; i++) {
      var e = petals[i];
      var phase = (i / (total - 1)) * 0.6;
      var denom = 1 - phase; if (denom <= 0.0001) denom = 0.0001;
      var localT = clamp((p - phase) / denom, 0, 1);
      if (localT <= 0) continue;
      var eased = easeOutBack(localT);
      var baseR = lerp(0.195, 0.135, clamp(eased, 0, 1.2));
      var pulse = 1 - 0.10 * Math.sin(squish * Math.PI);
      var radius = baseR * e.rMul * pulse;
      var scaleT = 0.3 + 0.7 * clamp(eased, -0.3, 1.15);
      var worldAngle = e.angle + view.rotation;
      var pp = project(worldAngle, radius, breathMul);
      var outward = outwardScreenAngle(worldAngle, radius, breathMul);
      var ratio = (view.scale * breathMul / (spriteBakedScale || 1)) * scaleT * 0.85;
      if (!(ratio > 0)) continue;
      ctx.save();
      ctx.translate(pp.sx, pp.sy);
      ctx.rotate(outward + Math.PI / 2 + e.rot);
      var dw = sprite.canvas.width * ratio, dh = sprite.canvas.height * ratio;
      ctx.drawImage(sprite.canvas, -sprite.originX * ratio, -sprite.originY * ratio, dw, dh);
      ctx.restore();
    }
  }

  // ============ しべ(黄粒)+金箔風の小片 ============
  function drawGoldFlake(spec, breathMul) {
    var worldAngle = spec.a + view.rotation;
    var centerP = project(worldAngle, spec.r, breathMul);
    var s = spec.size * view.scale * breathMul;
    ctx.save();
    ctx.translate(centerP.sx, centerP.sy);
    ctx.rotate(spec.rot);
    var pts = [[-s * 0.5, -s * 0.32], [s * 0.55, -s * 0.42], [s * 0.42, s * 0.5], [-s * 0.48, s * 0.38]];
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    var g = ctx.createLinearGradient(-s * 0.5, -s * 0.5, s * 0.5, s * 0.5);
    g.addColorStop(0, '#fff3c4');
    g.addColorStop(0.5, '#e3b34a');
    g.addColorStop(1, '#b9852a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,250,220,0.55)';
    ctx.lineWidth = Math.max(0.4, s * 0.05);
    ctx.stroke();
    ctx.restore();
  }

  function drawStamenAndGold(theme, breathMul) {
    var grains = 10, gR = 0.062, grainSize = 0.020;
    for (var i = 0; i < grains; i++) {
      var a = (i / grains) * Math.PI * 2 + 0.3 + view.rotation;
      var pp = project(a, gR, breathMul);
      var gx = pp.sx, gy = pp.sy;
      var gsz = grainSize * view.scale * breathMul;
      ctx.beginPath();
      ctx.arc(gx, gy, gsz, 0, Math.PI * 2);
      var gg = ctx.createRadialGradient(gx - gsz * 0.3, gy - gsz * 0.3, gsz * 0.05, gx, gy, gsz);
      gg.addColorStop(0, mixHex(theme.shibe, '#ffffff', 0.35));
      gg.addColorStop(1, theme.shibe);
      ctx.fillStyle = gg;
      ctx.fill();
    }
    var centerP = project(view.rotation, 0, breathMul);
    ctx.beginPath();
    ctx.arc(centerP.sx, centerP.sy, grainSize * 0.85 * view.scale * breathMul, 0, Math.PI * 2);
    ctx.fillStyle = mixHex(theme.shibe, '#ffffff', 0.3);
    ctx.fill();

    var flakes = [
      { a: 0.9, r: 0.075, rot: 0.4, size: 0.045 },
      { a: 3.4, r: 0.09, rot: -0.6, size: 0.038 },
      { a: 5.1, r: 0.06, rot: 1.1, size: 0.03 },
    ];
    for (var f = 0; f < flakes.length; f++) drawGoldFlake(flakes[f], breathMul);
  }

  function computeIsDone(state) {
    if (state.phase === 'finishing' || state.phase === 'reveal') return true;
    var need = (state.center && state.center.need) || 0;
    var count = (state.center && state.center.count) || 0;
    return state.activeRing >= 2 && need > 0 && count >= need;
  }

  // ============ nextHint ガイド ============
  function drawHint(state, dt) {
    if (!state.nextHint) return;
    hintT += dt;
    var pulse = 0.5 + 0.5 * Math.sin(hintT * 3.4);
    var pos = localToScreen(state.nextHint.angle, state.nextHint.radius);

    ctx.save();
    ctx.translate(pos.x, pos.y);

    var glowR = view.scale * (0.16 + 0.03 * pulse);
    var glow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
    glow.addColorStop(0, 'rgba(255,250,220,' + (0.45 * pulse + 0.15).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255,250,220,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, glowR, 0, Math.PI * 2);
    ctx.fill();

    drawSparkle(0, 0, view.scale * (0.09 + 0.015 * pulse), 0.9);
    drawSparkle(glowR * 0.55, -glowR * 0.35, view.scale * 0.035, 0.6 * pulse + 0.2);
    drawSparkle(-glowR * 0.5, glowR * 0.4, view.scale * 0.028, 0.5 * pulse + 0.2);

    var s = view.scale * (0.20 + 0.014 * pulse);
    ctx.save();
    ctx.rotate(-0.5);
    var armAngle = 0.36;
    var handleLen = s * 0.62;
    var bladeLen = s * 0.98;
    var ringR = s * 0.20;
    var outline = 'rgba(110,64,54,0.92)';
    var fillCol = 'rgba(255,255,255,0.97)';

    function drawArm(ang) {
      var dx = Math.cos(ang), dy = Math.sin(ang);
      var hx = -handleLen * dx, hy = -handleLen * dy;
      var bx = bladeLen * dx, by = bladeLen * dy;
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
      var nx = -dy, ny = dx;
      var tipW = s * 0.085;
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - dx * s * 0.16 + nx * tipW, by - dy * s * 0.16 + ny * tipW);
      ctx.lineTo(bx - dx * s * 0.16 - nx * tipW, by - dy * s * 0.16 - ny * tipW);
      ctx.closePath();
      ctx.fillStyle = outline;
      ctx.fill();
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

      drawBackground(state);

      var breathMul = 1;
      if (state.phase === 'finishing' || state.phase === 'reveal') {
        breathT += dt;
        breathMul = 1 + Math.sin(breathT * 1.6) * 0.014;
      }
      var squish = (state.center && state.center.squish) || 0;
      var flat = 1 - squish * 0.05;
      var isDone = computeIsDone(state);
      var glowAlpha = (state.phase === 'reveal') ? clamp(state.revealT || 0, 0, 1) : (state.phase === 'finishing' ? 0.4 : 0);

      drawPlate(theme, glowAlpha);
      drawMochiDome(theme, breathMul, flat);

      var instances = collectPetalInstances(state);
      instances.sort(function (a, b) { return a.sortY - b.sortY; });
      for (var i = 0; i < instances.length; i++) drawPetalInstance(theme, instances[i], breathMul);

      if (state.activeRing >= 2) drawCenterRing(state, theme, breathMul);
      if (isDone) drawStamenAndGold(theme, breathMul);

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
