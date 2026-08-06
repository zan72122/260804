/* =========================================================
   room.js — ドームホールの なかみ
   床・客席・投影機・6つの持ち場・床の足あとパッド
   ========================================================= */
(function (global) {
  'use strict';

  var R = {};
  var PLUG_COL = [[0.42, 0.80, 0.95], [0.95, 0.78, 0.36], [0.92, 0.52, 0.80]];
  R.PLUG_COL = PLUG_COL;
  R.knobTarget = [0.30, 0.55, 0.72];
  var gl = null;
  var FY = 0, FR = 0;           // 床の高さ・半径

  var T = null, RY = null, RX = null, RZ = null, mul = null;

  /* ---------------- 持ち場 ---------------- */
  /* az は U.dirFromAzAlt 準拠（0 が +X、90 が +Z）
     作業エリアは az 40°〜140°、客席は その反対がわ */
  var ST = {
    entrance: { az: 112, r: 120 },
    lens:     { az: 96, r: 20.5 },
    shelf:    { az: 126, r: 128 },
    slot:     { az: 54, r: 20.5 },
    console:  { az: 62, r: 122, off: -15 },
    power:    { az: 101, r: 158, off: -12 },
    lever:    { az: 88, r: 104 }
  };
  R.ST = ST;

  function at(az, r, y) {
    var a = U.rad(az);
    return [Math.cos(a) * r, (y === undefined ? FY : FY + y), Math.sin(a) * r];
  }
  R.at = at;

  /* 持ち場の 立ち位置（世界座標） */
  R.stand = function (key) {
    var s = ST[key];
    var p = at(s.az, s.r, 0);
    if (s.off) {
      var a = U.rad(s.az);
      p[0] += -Math.sin(a) * s.off;
      p[2] += Math.cos(a) * s.off;
    }
    return p;
  };
  /* 持ち場で 向くべき 方位（度）: 中心を向く／壁を向く */
  R.facing = function (key) {
    var s = ST[key];
    if (key === 'lens' || key === 'slot') return s.az + 180;   // 投影機のほうへ
    return s.az;                                               // 壁のほうへ
  };

  /* ---------------- 作業対象の位置（カメラと手の目標） ---------------- */
  R.focus = {};

  /* ---------------- ビルド ---------------- */
  var hall = null, parts = null, pads = null;
  var idx = {};                 // 可動パーツの index 範囲

  /* 素材: 0=塗装 1=金属/真鍮 2=ニスの木 3=フェルト/布 4=樹脂 5=ガラス */
  var MAT = { paint: 0, metal: 1, wood: 2, felt: 3, resin: 4, glass: 5 };
  R.MAT = MAT;

  var COL = {
    floor:  [0.26, 0.22, 0.31],
    seatA:  [0.40, 0.21, 0.33],
    seatB:  [0.35, 0.19, 0.36],
    seatC:  [0.44, 0.24, 0.31],
    metal:  [0.34, 0.36, 0.44],
    dark:   [0.16, 0.17, 0.22],
    drum:   [0.33, 0.33, 0.40],
    wood:   [0.44, 0.29, 0.18],
    woodHi: [0.55, 0.38, 0.24],
    panel:  [0.29, 0.30, 0.38],
    brass:  [0.62, 0.47, 0.20],
    glass:  [0.40, 0.60, 0.72],
    white:  [0.82, 0.82, 0.86],
    red:    [0.62, 0.16, 0.20],
    rubber: [0.13, 0.13, 0.16]
  };

  R.init = function () {
    gl = Scene.gl;
    FY = Scene.floorY();
    FR = Scene.floorR();
    T = U.M.translate; RY = U.M.rotateY; RX = U.M.rotateX; RZ = U.M.rotateZ;
    mul = U.M.multiply;

    buildHall();
    buildParts();
    buildPads();
    buildLens();
    buildCables();
  };

  /* ============================================================
     ① 対物レンズの ガラス面（くもりを ゆびで こする）
     ============================================================ */
  var LENS_VS = [
    'attribute vec3 aPos; attribute vec2 aUV;',
    'uniform mat4 uVP, uModel;',
    'varying vec2 vUV;',
    'void main(){ vUV=aUV; gl_Position = uVP*uModel*vec4(aPos,1.0); }'
  ].join('\n');

  var LENS_FS = [
    'precision mediump float;',
    'varying vec2 vUV;',
    'uniform sampler2D uFog;',
    'uniform float uFogAmt, uRoomLight, uShine, uTime;',
    'void main(){',
    '  vec2 p = vUV*2.0-1.0;',
    '  float r = length(p);',
    '  if(r > 1.0) discard;',
    '  float fog = texture2D(uFog, vUV).r * uFogAmt;',
    '  vec3 glass = mix(vec3(0.03,0.09,0.15), vec3(0.24,0.52,0.66), pow(1.0-r,1.4));',
    '  float hi = exp(-pow((p.x+0.34)*2.1,2.0)-pow((p.y-0.40)*2.8,2.0));',
    '  glass += vec3(0.55,0.78,0.88)*hi*0.85;',
    '  float ring = smoothstep(0.90,0.99,r);',
    '  glass = mix(glass, vec3(0.45,0.36,0.14), ring*0.7);',
    '  vec3 col = mix(glass, vec3(0.74,0.75,0.77), fog);',
    '  col *= (0.30 + 0.85*uRoomLight);',
    '  float spark = uShine * exp(-pow((p.x - (sin(uTime*3.0)*0.7))*3.0,2.0)) * (1.0-r*0.6);',
    '  col += vec3(1.0,0.98,0.90)*spark;',
    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  var lensProg = null, lensMesh = null, lensTex = null;
  var FOG_N = 16;
  var fogData = null;
  R.lensShine = 0;
  R.lensFogAmt = 1;

  function buildLens() {
    lensProg = GLC.program(gl, LENS_VS, LENS_FS);
    /* 円板（局所 XY 平面、法線 +Z） */
    var pos = [0, 0, 0], uv = [0.5, 0.5], I = [];
    var N = 28, rr = R.lensRadius;
    for (var i = 0; i <= N; i++) {
      var a = i / N * Math.PI * 2;
      pos.push(Math.cos(a) * rr, Math.sin(a) * rr, 0);
      uv.push(0.5 + Math.cos(a) * 0.5, 0.5 + Math.sin(a) * 0.5);
      if (i > 0) I.push(0, i, i + 1);
    }
    lensMesh = {
      pos: GLC.buffer(gl, new Float32Array(pos)),
      uv: GLC.buffer(gl, new Float32Array(uv)),
      idx: GLC.buffer(gl, new Uint16Array(I), gl.ELEMENT_ARRAY_BUFFER),
      count: I.length
    };
    lensTex = gl.createTexture();
    fogData = new Uint8Array(FOG_N * FOG_N);
    R.lensReset();
  }

  R.lensReset = function () {
    for (var i = 0; i < fogData.length; i++) fogData[i] = 255;
    R.lensShine = 0;
    R.lensFogAmt = 1;
    uploadFog();
  };

  function uploadFog() {
    gl.bindTexture(gl.TEXTURE_2D, lensTex);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, FOG_N, FOG_N, 0,
                  gl.LUMINANCE, gl.UNSIGNED_BYTE, fogData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  /* uv(0..1) のまわりを こする */
  R.lensWipe = function (u, v, rad) {
    var changed = false;
    var cx = u * FOG_N, cy = v * FOG_N;
    var pr = rad * FOG_N;
    for (var y = 0; y < FOG_N; y++) {
      for (var x = 0; x < FOG_N; x++) {
        var d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d > pr) continue;
        var cut = 255 * (1 - d / pr) * 0.85;
        var i = y * FOG_N + x;
        var nv = Math.max(0, fogData[i] - cut);
        if (nv !== fogData[i]) { fogData[i] = nv; changed = true; }
      }
    }
    if (changed) uploadFog();
    return changed;
  };

  /* 円のなかで どれくらい きれいに なったか */
  R.lensProgress = function () {
    var tot = 0, sum = 0;
    for (var y = 0; y < FOG_N; y++) {
      for (var x = 0; x < FOG_N; x++) {
        var dx = (x + 0.5) / FOG_N - 0.5, dy = (y + 0.5) / FOG_N - 0.5;
        if (dx * dx + dy * dy > 0.25) continue;
        tot++; sum += fogData[y * FOG_N + x];
      }
    }
    return tot ? 1 - (sum / tot) / 255 : 0;
  };

  /* 画面の ゆび → レンズ面の uv */
  R.lensHit = function (sx, sy) {
    var ray = Pick.ray(sx, sy);
    if (!ray) return null;
    var hit = Pick.diskHit(ray, R.focus.lens, R.lensDir, R.lensRadius * 1.25);
    if (!hit) return null;
    /* 局所 XY に もどす */
    var m = lensMatrix();
    var xA = [m[0], m[1], m[2]], yA = [m[4], m[5], m[6]];
    var lx = U.V.dot(hit.local, xA) / R.lensRadius;
    var ly = U.V.dot(hit.local, yA) / R.lensRadius;
    return { u: U.clamp(lx * 0.5 + 0.5, 0, 1), v: U.clamp(ly * 0.5 + 0.5, 0, 1), p: hit.p };
  };

  function lensMatrix() {
    return U.M.orient(R.focus.lens, R.lensDir, [0, 1, 0]);
  }
  R.lensMatrix = lensMatrix;

  R.renderLens = function (VP) {
    var p = lensProg;
    gl.useProgram(p.p);
    GLC.attrib(gl, p, 'aPos', lensMesh.pos, 3);
    GLC.attrib(gl, p, 'aUV', lensMesh.uv, 2);
    gl.uniformMatrix4fv(p.u.uVP, false, VP);
    gl.uniformMatrix4fv(p.u.uModel, false, lensMatrix());
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, lensTex);
    gl.uniform1i(p.u.uFog, 0);
    gl.uniform1f(p.u.uFogAmt, R.lensFogAmt);
    gl.uniform1f(p.u.uRoomLight, Scene.state.roomLight);
    gl.uniform1f(p.u.uShine, R.lensShine);
    gl.uniform1f(p.u.uTime, Scene.t);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, lensMesh.idx);
    gl.drawElements(gl.TRIANGLES, lensMesh.count, gl.UNSIGNED_SHORT, 0);
    GLC.disableAll(gl, p);
  };

  /* ============================================================
     ⑤ ケーブル（毎フレーム 作りなおす チューブ）
     ============================================================ */
  var cableBuf = null, CSEG = 12, CSIDE = 6, cableVerts = 0;
  var cPos = null, cNrm = null, cCol = null, cPar = null;

  function buildCables() {
    var n = 3 * (CSEG + 1) * (CSIDE + 1);
    cableVerts = n;
    cPos = new Float32Array(n * 3);
    cNrm = new Float32Array(n * 3);
    cCol = new Float32Array(n * 3);
    cPar = new Float32Array(n * 3);
    var I = [];
    for (var c = 0; c < 3; c++) {
      var base = c * (CSEG + 1) * (CSIDE + 1);
      for (var s = 0; s < CSEG; s++) {
        for (var k = 0; k < CSIDE; k++) {
          var a = base + s * (CSIDE + 1) + k;
          var b2 = a + CSIDE + 1;
          I.push(a, b2, a + 1, a + 1, b2, b2 + 1);
        }
      }
      for (var q = 0; q < (CSEG + 1) * (CSIDE + 1); q++) {
        cCol[(base + q) * 3] = PLUG_COL[c][0] * 0.55;
        cCol[(base + q) * 3 + 1] = PLUG_COL[c][1] * 0.55;
        cCol[(base + q) * 3 + 2] = PLUG_COL[c][2] * 0.55;
        cPar[(base + q) * 3 + 2] = MAT.resin;
      }
    }
    cableBuf = {
      pos: gl.createBuffer(), nrm: gl.createBuffer(),
      col: GLC.buffer(gl, cCol), par: GLC.buffer(gl, cPar),
      idx: GLC.buffer(gl, new Uint16Array(I), gl.ELEMENT_ARRAY_BUFFER),
      type: gl.UNSIGNED_SHORT, count: I.length
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, cableBuf.pos);
    gl.bufferData(gl.ARRAY_BUFFER, cPos, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, cableBuf.nrm);
    gl.bufferData(gl.ARRAY_BUFFER, cNrm, gl.DYNAMIC_DRAW);
  }

  function updateCables() {
    var st = R.state;
    for (var c = 0; c < 3; c++) {
      var a = R.cableAnchor[c];
      var e = st.plugDrag[c] || (st.plugState[c] === 2 ? R.sockets[c].c : R.cableHome[c]);
      /* ゆるく たれた ベジエ */
      var mid = [(a[0] + e[0]) / 2, Math.min(a[1], e[1]) - 2.5, (a[2] + e[2]) / 2];
      var base = c * (CSEG + 1) * (CSIDE + 1);
      var prev = null;
      for (var s = 0; s <= CSEG; s++) {
        var t = s / CSEG, it = 1 - t;
        var p = [
          it * it * a[0] + 2 * it * t * mid[0] + t * t * e[0],
          it * it * a[1] + 2 * it * t * mid[1] + t * t * e[1],
          it * it * a[2] + 2 * it * t * mid[2] + t * t * e[2]
        ];
        var dir = prev ? U.V.norm(U.V.sub(p, prev)) : [0, 0, 1];
        prev = p;
        var up = Math.abs(dir[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
        var xA = U.V.norm(U.V.cross(up, dir));
        var yA = U.V.norm(U.V.cross(dir, xA));
        for (var k = 0; k <= CSIDE; k++) {
          var ang = k / CSIDE * Math.PI * 2;
          var nx = xA[0] * Math.cos(ang) + yA[0] * Math.sin(ang);
          var ny = xA[1] * Math.cos(ang) + yA[1] * Math.sin(ang);
          var nz = xA[2] * Math.cos(ang) + yA[2] * Math.sin(ang);
          var i = (base + s * (CSIDE + 1) + k) * 3;
          cPos[i] = p[0] + nx * 1.8; cPos[i + 1] = p[1] + ny * 1.8; cPos[i + 2] = p[2] + nz * 1.8;
          cNrm[i] = nx; cNrm[i + 1] = ny; cNrm[i + 2] = nz;
        }
      }
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, cableBuf.pos);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, cPos);
    gl.bindBuffer(gl.ARRAY_BUFFER, cableBuf.nrm);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, cNrm);
  }
  R.updateCables = updateCables;

  /* ============================================================
     動かないもの
     ============================================================ */
  function buildHall() {
    var b = new GLC.Builder();

    /* --- 床 --- */
    b.push(GLC.disk(FR, 96), T(0, FY + 0.2, 0), COL.floor, 0, 1, MAT.felt);

    /* --- 客席（作業エリアを あけた 扇形） --- */
    var seatBase = GLC.roundBox(8.2, 4.6, 8.4, 1.6, 2);
    var seatBack = GLC.roundBox(8.2, 10.5, 2.8, 1.2, 2);
    var rings = [[54, 20], [76, 27], [98, 34], [120, 41], [142, 48]];
    var cols = [COL.seatA, COL.seatB, COL.seatC];
    for (var ri = 0; ri < rings.length; ri++) {
      var rad = rings[ri][0], cnt = rings[ri][1];
      for (var s = 0; s < cnt; s++) {
        var deg = (s / cnt) * 360 + ri * 3;
        var norm = ((deg % 360) + 360) % 360;
        if (norm > 34 && norm < 146) continue;          // ← 通路（作業エリア）
        var a = U.rad(deg);
        var col = cols[(ri + s) % 3];
        var lift = FY + ri * 2.2;
        var rot = RY(-a - Math.PI / 2);
        b.push(seatBase, mul(T(Math.cos(a) * rad, lift + 4.0, Math.sin(a) * rad), rot), col, 0, 0);
        b.push(seatBack,
          mul(mul(T(Math.cos(a) * (rad + 4.0), lift + 9.6, Math.sin(a) * (rad + 4.0)), rot), RX(U.rad(13))),
          [col[0] * 1.18, col[1] * 1.18, col[2] * 1.22], 0, 0);
      }
    }

    /* ============================================================
       中央の 投影機（この 部屋の 主役）
       ── 鋳物の 台座、段つきの 支柱、星球 2つ、対物レンズ
       ============================================================ */
    var SEG = 30;
    /* 脚 3本 */
    for (var lg = 0; lg < 3; lg++) {
      var lga = lg / 3 * Math.PI * 2 + 0.4;
      b.push(GLC.lathe([[3.2, 0], [3.2, 0], [3.0, 1.0], [1.9, 1.4], [1.9, 3.0]], 12),
        T(Math.cos(lga) * 9.5, FY, Math.sin(lga) * 9.5), COL.dark, 0, 2, MAT.resin);
    }
    /* 鋳物の 台座（段と 面取りを もった 回転体） */
    b.push(GLC.lathe([
      [0, FY + 2.2], [10.2, FY + 2.2],
      [10.2, FY + 2.2], [10.8, FY + 3.0],
      [10.8, FY + 3.0], [10.8, FY + 4.6],
      [10.8, FY + 4.6], [10.1, FY + 5.4],
      [10.1, FY + 5.4], [9.7, FY + 9.4],
      [9.7, FY + 9.4], [9.2, FY + 11.0],
      [9.2, FY + 11.0], [6.4, FY + 12.4],
      [6.4, FY + 12.4], [4.4, FY + 13.6]
    ], SEG, false, false), null, COL.drum, 0, 2, MAT.paint);
    /* 台座の 天板 */
    b.push(GLC.disc(4.6, 0, 0.7, SEG), T(0, FY + 13.7, 0), COL.metal, 0.02, 2, MAT.metal);
    /* 放熱スリット */
    for (var sl = 0; sl < 14; sl++) {
      var sa2 = sl / 14 * Math.PI * 2;
      b.push(GLC.box(1.5, 3.4, 0.9),
        mul(T(Math.cos(sa2) * 9.9, FY + 7.4, Math.sin(sa2) * 9.9), RY(-sa2 - Math.PI / 2)),
        [0.05, 0.05, 0.07], 0, 2, MAT.resin);
    }
    /* 台座の 締めリングと 銘板 */
    b.push(GLC.torus(10.4, 0.45, SEG, 8), T(0, FY + 5.0, 0), COL.brass, 0.05, 2, MAT.metal);
    b.push(GLC.roundBox(6.4, 2.2, 0.5, 0.25, 2),
      mul(T(Math.cos(U.rad(75)) * 10.2, FY + 8.2, Math.sin(U.rad(75)) * 10.2), RY(-U.rad(75) - Math.PI / 2)),
      COL.brass, 0.08, 2, MAT.metal);
    /* パイロットランプ 2つ */
    [[62, [0.9, 0.25, 0.22]], [88, [0.35, 0.85, 0.45]]].forEach(function (pl) {
      var pa2 = U.rad(pl[0]);
      b.push(GLC.sphere(0.85, 10, 8, 180, false),
        T(Math.cos(pa2) * 10.0, FY + 10.4, Math.sin(pa2) * 10.0), pl[1], 0.85, 2, MAT.glass);
    });

    /* 支柱（段つき） */
    b.push(GLC.lathe([
      [3.4, FY + 13.6], [3.4, FY + 13.6],
      [2.9, FY + 15.0], [2.9, FY + 17.4],
      [2.9, FY + 17.4], [3.5, FY + 18.0],
      [3.5, FY + 18.0], [3.5, FY + 19.2],
      [3.5, FY + 19.2], [2.7, FY + 19.9],
      [2.7, FY + 21.6]
    ], 20, false, false), null, COL.metal, 0.02, 2, MAT.metal);
    /* 高さ調整の カラー */
    b.push(GLC.torus(3.0, 0.5, 20, 8), T(0, FY + 20.6, 0), COL.brass, 0.06, 2, MAT.metal);

    /* --- 下の 星球 --- */
    var BALL_LO = FY + 26.6, BALL_HI = FY + 44.0;
    b.push(GLC.sphere(5.4, 26, 18, 180, false), T(0, BALL_LO, 0), COL.dark, 0.55, 2, MAT.paint);
    b.push(GLC.torus(5.42, 0.30, 26, 7), T(0, BALL_LO, 0), COL.brass, 0.10, 2, MAT.metal);
    b.push(GLC.lathe([[2.9, BALL_LO - 5.6], [2.9, BALL_LO - 5.6], [2.4, BALL_LO - 4.6]], 16, true, false),
      null, COL.metal, 0.02, 2, MAT.metal);
    /* --- 中つぎの 軸 --- */
    b.push(GLC.lathe([
      [1.9, BALL_LO + 4.2], [1.9, BALL_LO + 4.2],
      [1.5, BALL_LO + 5.4], [1.5, BALL_HI - 5.4],
      [1.5, BALL_HI - 5.4], [1.9, BALL_HI - 4.2]
    ], 16, true, true), null, COL.metal, 0.05, 2, MAT.metal);
    b.push(GLC.torus(1.75, 0.34, 16, 7), T(0, (BALL_LO + BALL_HI) / 2, 0), COL.brass, 0.08, 2, MAT.metal);
    /* --- 上の 星球 --- */
    b.push(GLC.sphere(5.4, 26, 18, 180, false), T(0, BALL_HI, 0), COL.dark, 0.55, 2, MAT.paint);
    b.push(GLC.torus(5.42, 0.30, 26, 7), T(0, BALL_HI, 0), COL.brass, 0.10, 2, MAT.metal);
    /* --- てっぺんの 飾り --- */
    b.push(GLC.lathe([
      [2.4, BALL_HI + 4.6], [2.4, BALL_HI + 4.6],
      [2.9, BALL_HI + 5.2], [2.9, BALL_HI + 5.2],
      [1.5, BALL_HI + 7.4], [0.5, BALL_HI + 8.4]
    ], 16), null, COL.brass, 0.4, 2, MAT.metal);

    /* ============ ① 対物レンズ（下球の 横に つき出た 鏡筒） ============ */
    var la = U.rad(ST.lens.az);
    var lensDir = [Math.cos(la), 0, Math.sin(la)];
    var lensY = FY + 24.5;
    /* 鏡筒は +Z 方向に つくって、レンズの 向きへ 回す */
    var lensM = U.M.orient([lensDir[0] * 4.6, lensY, lensDir[2] * 4.6], lensDir, [0, 1, 0]);
    var barrelM = mul(lensM, RX(U.rad(90)));        // lathe の 軸(+Y) を +Z（レンズの向き）へ
    b.push(GLC.lathe([
      [3.1, 0], [3.1, 0],
      [3.5, 1.0], [3.5, 3.4],
      [3.5, 3.4], [3.1, 3.9],
      [3.1, 3.9], [3.1, 5.6],
      [3.1, 5.6], [4.3, 6.2],
      [4.3, 6.2], [4.3, 7.2]
    ], 24, false, false), barrelM, COL.metal, 0.02, 2, MAT.metal);
    /* ローレット刻みの 絞りリング */
    b.push(GLC.torus(3.75, 0.62, 26, 8),
      mul(barrelM, T(0, 4.7, 0)), COL.brass, 0.06, 2, MAT.metal);
    for (var kn = 0; kn < 20; kn++) {
      var ka = kn / 20 * Math.PI * 2;
      b.push(GLC.box(0.34, 0.34, 1.5),
        mul(mul(barrelM, T(Math.cos(ka) * 4.2, 4.7, Math.sin(ka) * 4.2)), RY(-ka)),
        COL.brass, 0.04, 2, MAT.metal);
    }
    /* フードの 縁（真鍮） */
    b.push(GLC.torus(4.35, 0.36, 26, 8),
      mul(barrelM, T(0, 7.2, 0)), COL.brass, 0.08, 2, MAT.metal);
    R.focus.lens = [lensDir[0] * (4.6 + 7.0), lensY, lensDir[2] * (4.6 + 7.0)];
    R.lensDir = lensDir;
    R.lensRadius = 4.05;
    /* 外した レンズキャップが 台座の 上に おいてある */
    b.push(GLC.lathe([[3.4, 0], [3.4, 0], [3.6, 0.5], [3.6, 1.6], [3.6, 1.6], [3.2, 2.0]], 18),
      mul(T(Math.cos(U.rad(120)) * 2.6, FY + 14.4, Math.sin(U.rad(120)) * 2.6), RX(U.rad(12))),
      COL.dark, 0, 2, MAT.resin);

    /* ============ ③ ディスク挿入口（ドラムの 反対がわ） ============ */
    var sa = U.rad(ST.slot.az);
    var sdir = [Math.cos(sa), 0, Math.sin(sa)];
    var sHousing = [sdir[0] * 8.6, FY + 15.4, sdir[2] * 8.6];
    var sRot = RY(-sa - Math.PI / 2);
    b.push(GLC.roundBox(13.5, 9.5, 5.5, 1.1, 2),
      mul(T(sHousing[0], sHousing[1], sHousing[2]), sRot), COL.panel, 0, 2, MAT.paint);
    /* 差込口の 暗い みぞ と 真鍮の 口金 */
    b.push(GLC.box(11.2, 1.5, 1.0),
      mul(T(sHousing[0] + sdir[0] * 2.7, sHousing[1] + 0.6, sHousing[2] + sdir[2] * 2.7), sRot),
      [0.015, 0.015, 0.02], 0, 2, MAT.resin);
    b.push(GLC.roundBox(12.4, 3.0, 0.7, 0.3, 2),
      mul(T(sHousing[0] + sdir[0] * 2.9, sHousing[1] + 0.6, sHousing[2] + sdir[2] * 2.9), sRot),
      COL.brass, 0.05, 2, MAT.metal);
    /* 小さな 表示窓 */
    b.push(GLC.roundBox(3.2, 1.6, 0.5, 0.2, 2),
      mul(T(sHousing[0] + sdir[0] * 2.9, sHousing[1] + 3.4, sHousing[2] + sdir[2] * 2.9), sRot),
      [0.30, 0.55, 0.45], 0.5, 2, MAT.glass);
    R.focus.slot = [sHousing[0] + sdir[0] * 3.6, sHousing[1] + 0.6, sHousing[2] + sdir[2] * 3.6];
    R.slotDir = sdir;

    /* ============ ② ディスク棚（壁ぎわ） ============ */
    var ha = U.rad(ST.shelf.az), hr = ST.shelf.r + 22;
    var hpos = [Math.cos(ha) * hr, FY, Math.sin(ha) * hr];
    var hrot = RY(-ha - Math.PI / 2);
    b.push(GLC.roundBox(62, 3.4, 16, 1.0, 2), mul(T(hpos[0], FY + 20, hpos[2]), hrot), COL.wood, 0, 3, MAT.wood);
    b.push(GLC.roundBox(62, 3.4, 16, 1.0, 2), mul(T(hpos[0], FY + 3, hpos[2]), hrot), COL.wood, 0, 3, MAT.wood);
    b.push(GLC.box(2.6, 17, 16), mul(T(hpos[0], FY + 11.5, hpos[2]), hrot), COL.woodHi, 0, 3, MAT.wood);
    /* 側板（棚のはしを 局所 X 方向に） */
    var hx = [-Math.sin(ha), 0, Math.cos(ha)];
    for (var e = -1; e <= 1; e += 2) {
      b.push(GLC.box(2.6, 17, 16),
        mul(T(hpos[0] + hx[0] * 30 * e, FY + 11.5, hpos[2] + hx[2] * 30 * e), hrot), COL.woodHi, 0, 3, MAT.wood);
    }
    b.push(GLC.box(62, 19, 2.4),
      mul(T(hpos[0] + Math.cos(ha) * 7, FY + 11.5, hpos[2] + Math.sin(ha) * 7), hrot), COL.wood, 0, 3, MAT.wood);
    R.shelfSlots = [];
    for (var d = 0; d < 4; d++) {
      var off = (d - 1.5) * 13;
      R.shelfSlots.push([hpos[0] + hx[0] * off, FY + 11.5, hpos[2] + hx[2] * off]);
    }
    R.focus.shelf = [hpos[0], FY + 14, hpos[2]];
    R.shelfDir = [-Math.cos(ha), 0, -Math.sin(ha)];   // 棚が 向いている ほう（部屋の中心へ）

    /* ============ ④ 惑星コンソール ============ */
    var ca = U.rad(ST.console.az), cr = ST.console.r + 18;
    var cpos = [Math.cos(ca) * cr, FY, Math.sin(ca) * cr];
    var crot = RY(-ca - Math.PI / 2);
    var cx = [-Math.sin(ca), 0, Math.cos(ca)];
    b.push(GLC.roundBox(62, 5, 26, 1.8, 2), mul(T(cpos[0], FY + 16, cpos[2]), crot), COL.panel, 0, 4, MAT.paint);
    b.push(GLC.cylinder(4, 5, 16, 12), T(cpos[0] + cx[0] * 24, FY + 8, cpos[2] + cx[2] * 24), COL.metal, 0, 4, MAT.metal);
    b.push(GLC.cylinder(4, 5, 16, 12), T(cpos[0] - cx[0] * 24, FY + 8, cpos[2] - cx[2] * 24), COL.metal, 0, 4, MAT.metal);
    /* 3本の レール（みぞ） */
    R.rails = [];
    for (var k = 0; k < 3; k++) {
      var rz = (k - 1) * 7.5;
      var rc = [cpos[0] + Math.cos(ca) * rz, FY + 18.6, cpos[2] + Math.sin(ca) * rz];
      b.push(GLC.box(38, 1.2, 2.6), mul(T(rc[0], rc[1], rc[2]), crot), [0.05, 0.05, 0.07], 0, 4, MAT.resin);
      R.rails.push({ c: rc, x: cx, half: 17 });
    }
    R.focus.console = [cpos[0], FY + 20, cpos[2]];
    R.consoleDir = [-Math.cos(ca), 0, -Math.sin(ca)];

    /* ============ ⑤ 配電盤（壁の下、しゃがむ） ============ */
    var pa = U.rad(ST.power.az), pr = ST.power.r + 14;
    var ppos = [Math.cos(pa) * pr, FY, Math.sin(pa) * pr];
    var prot = RY(-pa - Math.PI / 2);
    var px = [-Math.sin(pa), 0, Math.cos(pa)];
    b.push(GLC.roundBox(46, 22, 8, 1.6, 2), mul(T(ppos[0], FY + 12, ppos[2]), prot), COL.panel, 0, 4, MAT.paint);
    b.push(GLC.box(42, 2, 1.5),
      mul(T(ppos[0] - Math.cos(pa) * 4, FY + 22, ppos[2] - Math.sin(pa) * 4), prot), COL.metal, 0, 4, MAT.metal);
    R.sockets = [];
    for (var q = 0; q < 3; q++) {
      var so = (q - 1) * 13;
      var sc = [ppos[0] + px[0] * so - Math.cos(pa) * 4.6, FY + 12, ppos[2] + px[2] * so - Math.sin(pa) * 4.6];
      b.push(GLC.roundBox(9, 9, 2.5, 1.0, 2), mul(T(sc[0], sc[1], sc[2]), prot), [0.10, 0.10, 0.14], 0, 4, MAT.resin);
      b.push(GLC.box(5, 1.6, 1.2), mul(T(sc[0] - Math.cos(pa) * 1.0, sc[1], sc[2] - Math.sin(pa) * 1.0), prot),
        [0.02, 0.02, 0.02], 0, 4, MAT.resin);
      R.sockets.push({ c: sc, used: false, lamp: [sc[0], sc[1] + 7.5, sc[2]] });
    }
    R.focus.power = [ppos[0] - Math.cos(pa) * 6, FY + 12, ppos[2] - Math.sin(pa) * 6];
    R.powerDir = [-Math.cos(pa), 0, -Math.sin(pa)];
    R.cableHome = [];
    R.cableAnchor = [];
    for (var w = 0; w < 3; w++) {
      var wo = (w - 1) * 13;
      R.cableAnchor.push([ppos[0] + px[0] * wo - Math.cos(pa) * 3.0, FY + 2.6,
                          ppos[2] + px[2] * wo - Math.sin(pa) * 3.0]);
      R.cableHome.push([ppos[0] + px[0] * (w - 1) * 13 - Math.cos(pa) * 22, FY + 2.4,
                        ppos[2] + px[2] * (w - 1) * 13 - Math.sin(pa) * 22]);
    }

    /* ============ ⑥ 主投影レバー台 ============ */
    var va = U.rad(ST.lever.az), vr = ST.lever.r + 15;
    var vpos = [Math.cos(va) * vr, FY, Math.sin(va) * vr];
    var vrot = RY(-va - Math.PI / 2);
    b.push(GLC.roundBox(34, 5, 22, 1.6, 2), mul(T(vpos[0], FY + 17, vpos[2]), vrot), COL.panel, 0, 4, MAT.paint);
    b.push(GLC.cylinder(6, 7, 17, 14), T(vpos[0], FY + 8.5, vpos[2]), COL.metal, 0, 4, MAT.metal);
    b.push(GLC.roundBox(7, 3, 16, 1.0, 2), mul(T(vpos[0], FY + 20, vpos[2]), vrot), [0.06, 0.06, 0.09], 0, 4, MAT.resin);
    R.leverPivot = [vpos[0], FY + 20, vpos[2]];
    R.leverAxis = [-Math.sin(va), 0, Math.cos(va)];   // レバーは この軸まわりに 倒れる
    R.leverDir = [-Math.cos(va), 0, -Math.sin(va)];
    R.focus.lever = [vpos[0], FY + 26, vpos[2]];

    /* ============ 当たり判定 ============ */
    R.colliders = [
      { kind: 'cyl', x: 0, z: 0, r: 11.5 },                                  // 投影機
      { kind: 'box', x: hpos[0], z: hpos[2], hw: 32, hd: 9, yaw: ha },       // 棚
      { kind: 'box', x: cpos[0], z: cpos[2], hw: 32, hd: 14, yaw: ca },      // コンソール
      { kind: 'box', x: ppos[0], z: ppos[2], hw: 24, hd: 5, yaw: pa },       // 配電盤
      { kind: 'box', x: vpos[0], z: vpos[2], hw: 18, hd: 12, yaw: va },      // レバー台
      { kind: 'ring', r0: 46, r1: 154, az0: 144, az1: 396 },                 // 客席のかたまり
      { kind: 'wall', r: 186 }                                               // ドームの 壁
    ];

    hall = b.upload(gl);
    R.hallVerts = b.vo;
  }

  /* ============================================================
     動くもの（それぞれ 原点に つくり、行列で 置く）
     ============================================================ */
  function buildParts() {
    var b = new GLC.Builder();

    /* ディスク（本物の 円盤。うわ面・した面・外周・中心穴）
       半径 5.0（＝直径 40cm）。テーマ色は uTintMul で 変える。 */
    idx.disc = b.push(GLC.disc(5.0, 1.15, 0.55, 30), U.M.identity(), [1, 1, 1], 0, 3, MAT.paint);
    idx.discRim = b.push(GLC.torus(5.05, 0.34, 30, 8), U.M.identity(), COL.brass, 0.10, 3, MAT.metal);
    idx.discHub = b.push(GLC.torus(1.45, 0.30, 20, 7), U.M.identity(), COL.brass, 0.10, 3, MAT.metal);
    idx.discLabel = b.push(GLC.disc(2.6, 1.2, 0.72, 24), U.M.identity(), [1, 1, 1], 0.22, 3, MAT.paint);

    /* レバー（原点を 支点に、+Y へ のびる） */
    idx.leverArm = b.push(GLC.cylinder(1.5, 1.2, 15, 12), T(0, 7.5, 0), COL.metal, 0, 4, MAT.metal);
    idx.leverGrip = b.push(GLC.roundBox(6.5, 6, 6.5, 2.2, 3), T(0, 16, 0), COL.red, 0.15, 4, MAT.paint);
    idx.leverTip = b.push(GLC.sphere(1.6, 12, 8, 180, false), T(0, 19.5, 0), COL.brass, 0.5, 4, MAT.metal);

    /* 惑星ノブ */
    idx.knob = b.push(GLC.sphere(5.8, 18, 12, 180, false), U.M.identity(), [1, 1, 1], 0.10, 4, MAT.paint);
    idx.knobStem = b.push(GLC.cylinder(1.6, 1.4, 3.4, 10), T(0, -3.6, 0), COL.metal, 0, 4, MAT.metal);
    idx.knobRing = b.push(GLC.cylinder(8.8, 8.8, 0.5, 20), T(0, 0.6, 0), [1, 1, 1], 0.3, 4, MAT.metal);

    /* ケーブルの コネクタ */
    idx.plug = b.push(GLC.roundBox(8.2, 8.2, 9.5, 1.8, 2), U.M.identity(), [1, 1, 1], 0, 4, MAT.resin);
    idx.plugPin = b.push(GLC.box(4.4, 1.6, 3), T(0, 0, -6), COL.brass, 0.2, 4, MAT.metal);

    /* みがき用の クロス */
    idx.cloth = b.push(GLC.roundBox(6, 1.4, 6, 0.6, 2), U.M.identity(), [0.94, 0.90, 0.72], 0, 3, MAT.felt);

    /* ランプ（点いたら 光る 小球） */
    idx.lamp = b.push(GLC.sphere(1.7, 12, 8, 180, false), U.M.identity(), [1, 1, 1], 1.0, 4, MAT.glass);

    parts = b.upload(gl);
    R.idx = idx;
  }

  /* ============================================================
     床の 足あとパッド
     ============================================================ */
  var padList = [];
  R.padList = padList;
  var PAD_R = 9.5;
  R.PAD_R = PAD_R;

  function addPad(p, key, flag) {
    padList.push({ p: p, key: key || null, flag: flag || 0 });
  }
  R.outroPads = [];

  function buildPads() {
    padList.length = 0;
    /* 持ち場の パッド */
    ['entrance', 'lens', 'shelf', 'slot', 'console', 'power', 'lever'].forEach(function (k) {
      addPad(R.stand(k), k);
    });
    /* まわりに 敷きつめる（持ち場に 近すぎるものは 置かない） */
    for (var r = 34; r <= 176; r += 27) {
      var step = Math.max(9, 1500 / r);
      for (var deg = 42; deg <= 138; deg += step) {
        var p = at(deg, r, 0);
        var ok = true;
        for (var i = 0; i < padList.length; i++) {
          if (Math.hypot(padList[i].p[0] - p[0], padList[i].p[2] - p[2]) < 24) { ok = false; break; }
        }
        if (ok) addPad(p, null);
      }
    }

    /* おわりの ふたつの 輪 */
    R.outroPads = [at(76, 52, 0), at(104, 52, 0)];
    addPad(R.outroPads[0], 'again', 1);
    addPad(R.outroPads[1], 'other', 1);

    /* まとめて 1つの メッシュに */
    var P = [], UVv = [], CEN = [], FL = [], I = [], vo = 0;
    var y = FY + 0.55;
    for (var k = 0; k < padList.length; k++) {
      var c = padList[k].p;
      var rr = padList[k].flag ? PAD_R * 1.5 : (padList[k].key ? PAD_R * 1.18 : PAD_R);
      P.push(c[0] - rr, y, c[2] - rr, c[0] + rr, y, c[2] - rr,
             c[0] + rr, y, c[2] + rr, c[0] - rr, y, c[2] + rr);
      UVv.push(-1, -1, 1, -1, 1, 1, -1, 1);
      CEN.push(c[0], c[2], c[0], c[2], c[0], c[2], c[0], c[2]);
      var fl = padList[k].flag;
      FL.push(fl, fl, fl, fl);
      I.push(vo, vo + 1, vo + 2, vo, vo + 2, vo + 3);
      vo += 4;
    }
    pads = {
      pos: GLC.buffer(gl, new Float32Array(P)),
      uv: GLC.buffer(gl, new Float32Array(UVv)),
      cen: GLC.buffer(gl, new Float32Array(CEN)),
      flag: GLC.buffer(gl, new Float32Array(FL)),
      idx: GLC.buffer(gl, new Uint16Array(I), gl.ELEMENT_ARRAY_BUFFER),
      count: I.length
    };
  }

  /* ============================================================
     当たり判定 ── めり込ませない
     ============================================================ */
  R.BODY_R = 4.2;

  /* p=[x,?,z] が どれかの 当たり判定の 中（半径 rad ぶん ふくらませた）に あれば
     いちばん 近い 外へ 押し出した [x,z] を 返す。なければ null。 */
  var PUSH_EPS = 0.4;              // ぴったり境界だと 判定が ゆれるので 少し 外へ

  function pushOne(c, x, z, rad) {
    rad = rad + PUSH_EPS;
    if (c.kind === 'cyl') {
      var dx = x - c.x, dz = z - c.z;
      var d = Math.hypot(dx, dz);
      var need = c.r + rad;
      if (d >= need) return null;
      if (d < 1e-4) return [c.x + need, c.z];
      return [c.x + dx / d * need, c.z + dz / d * need];
    }
    if (c.kind === 'box') {
      var ca2 = Math.cos(c.yaw), sa2 = Math.sin(c.yaw);
      /* 局所X = 接線方向、局所Z = 半径方向 */
      var ex = [-sa2, ca2], ez = [ca2, sa2];
      var rx = x - c.x, rz = z - c.z;
      var lx = rx * ex[0] + rz * ex[1];
      var lz = rx * ez[0] + rz * ez[1];
      var hw = c.hw + rad, hd = c.hd + rad;
      if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) return null;
      var px = hw - Math.abs(lx), pz = hd - Math.abs(lz);
      if (px < pz) lx = (lx < 0 ? -hw : hw);
      else lz = (lz < 0 ? -hd : hd);
      return [c.x + ex[0] * lx + ez[0] * lz, c.z + ex[1] * lx + ez[1] * lz];
    }
    if (c.kind === 'ring') {
      var rr = Math.hypot(x, z);
      if (rr < 1e-4) return null;
      var deg = Math.atan2(z, x) * 180 / Math.PI;
      var a = deg; while (a < c.az0) a += 360; while (a > c.az0 + 360) a -= 360;
      if (a > c.az1) return null;
      if (rr < c.r0 - rad || rr > c.r1 + rad) return null;
      /* 内へ 出るか、角度の はしから 出るか、近いほうへ */
      var dIn = rr - (c.r0 - rad);
      var dA0 = U.rad(a - c.az0) * rr;
      var dA1 = U.rad(c.az1 - a) * rr;
      if (dIn <= dA0 && dIn <= dA1) {
        var k = (c.r0 - rad) / rr;
        return [x * k, z * k];
      }
      var na = U.rad((dA0 < dA1) ? c.az0 - 0.5 : c.az1 + 0.5);
      return [Math.cos(na) * rr, Math.sin(na) * rr];
    }
    if (c.kind === 'wall') {
      var wr = Math.hypot(x, z);
      var lim = c.r - rad;
      if (wr <= lim) return null;
      return [x / wr * lim, z / wr * lim];
    }
    return null;
  }

  /* 何度か くり返して、どの 当たり判定にも 入らない 位置へ */
  R.pushOut = function (x, z, rad) {
    if (!R.colliders) return [x, z];
    var r = (rad === undefined) ? R.BODY_R : rad;
    for (var pass = 0; pass < 4; pass++) {
      var moved = false;
      for (var i = 0; i < R.colliders.length; i++) {
        var out = pushOne(R.colliders[i], x, z, r);
        if (out) { x = out[0]; z = out[1]; moved = true; }
      }
      if (!moved) break;
    }
    return [x, z];
  };

  R.blockedAt = function (x, z, rad) {
    if (!R.colliders) return false;
    var r = (rad === undefined) ? R.BODY_R : rad;
    for (var i = 0; i < R.colliders.length; i++) {
      if (pushOne(R.colliders[i], x, z, r - PUSH_EPS)) return true;
    }
    return false;
  };

  /* 線分が 通れるか（等間隔に 見ていく） */
  R.segmentClear = function (ax, az2, bx, bz, rad) {
    var d = Math.hypot(bx - ax, bz - az2);
    var n = Math.max(2, Math.ceil(d / 5));
    for (var i = 0; i <= n; i++) {
      var t = i / n;
      if (R.blockedAt(ax + (bx - ax) * t, az2 + (bz - az2) * t, rad)) return false;
    }
    return true;
  };

  /* 立ち位置は 当たり判定の 外へ 逃がす */
  R.standSafe = function (key) {
    var p = R.stand(key);
    var o = R.pushOut(p[0], p[2]);
    return [o[0], p[1], o[1]];
  };

  /* 指の位置に いちばん近い パッドを 返す（あたりは 大きめ） */
  R.padAt = function (sx, sy) {
    var ray = Pick.ray(sx, sy);
    var hit = Pick.floorHit(ray, FY + 0.55);
    if (!hit) return null;
    var mode = R.state.padMode || 0;
    var best = null, bd = PAD_R * 2.6;
    for (var i = 0; i < padList.length; i++) {
      if ((padList[i].flag || 0) !== mode) continue;
      var d = Math.hypot(padList[i].p[0] - hit[0], padList[i].p[2] - hit[2]);
      if (d < bd) { bd = d; best = padList[i]; }
    }
    return best;
  };

  /* ---------------- 状態（ゲームから 書きかえる） ---------------- */
  R.state = {
    hotPad: [0, 0], hotAmt: 0, girlXZ: [0, 0], padAlpha: 1, padMode: 0,
    shelfGlow: 0, slotGlow: 0,
    discTaken: -1,                  // 棚から 抜いた ディスク
    discIn: false,                  // 挿さった
    discSpin: 0,
    carry: null,                    // 運んでいる ディスクの 位置と 向き
    lever: 0,                       // 0..1
    knobT: [0.18, 0.62, 0.74],      // レール上の 位置 0..1
    knobShow: 0,
    plugPos: [null, null, null],    // つないだら ソケット位置
    plugState: [0, 0, 0],           // 0=床 1=つかんでる 2=ささった
    plugDrag: [null, null, null],
    lampOn: [0, 0, 0],
    themeColors: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]],
    knobColors: [[1, 1, 1], [1, 1, 1], [1, 1, 1]]
  };

  /* もういっかい 遊ぶ ための かたづけ */
  R.resetForReplay = function (keepDisc) {
    var st = R.state;
    R.lensReset();
    if (!keepDisc) {
      st.discTaken = -1;
      st.discIn = false;
      st.discSpin = 0;
    }
    st.carry = null;
    st.lever = 0;
    st.knobShow = 0;
    st.knobT = [0.18, 0.62, 0.74];
    st.plugState = [0, 0, 0];
    st.plugDrag = [null, null, null];
    st.lampOn = [0, 0, 0];
    st.padMode = 0;
    st.shelfGlow = 0; st.slotGlow = 0;
    for (var i = 0; i < 3; i++) R.sockets[i].used = false;
    if (keepDisc) { st.discTaken = -1; st.discIn = false; st.discSpin = 0; }
  };

  R.setThemeColors = function (themes) {
    R.state.themeColors = themes.map(function (t) {
      var c = t.disc[0];
      var n = parseInt(c.slice(1), 16);
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    });
  };

  /* ---------------- 描画 ---------------- */
  R.render = function () {
    var st = R.state;
    Scene.drawObj(hall, null);

    /* --- 棚の ディスク --- */
    for (var i = 0; i < 4; i++) {
      if (st.discTaken === i) continue;
      var p = R.shelfSlots[i];
      var m = mul(U.M.trs(p, Math.atan2(R.shelfDir[0], R.shelfDir[2]), 1), RX(U.rad(90)));
      drawDisc(m, st.themeColors[i]);
    }

    /* --- 運んでいる ディスク --- */
    if (st.carry) {
      drawDisc(st.carry, st.themeColors[Math.max(0, st.discTaken)]);
    }

    /* --- 差しこまれた ディスク（まわる） --- */
    if (st.discIn) {
      var sm = mul(
        mul(U.M.orient(R.focus.slot, R.slotDir, [0, 1, 0]), RX(U.rad(90))),
        RY(U.rad(st.discSpin))
      );
      drawDisc(sm, st.themeColors[Math.max(0, st.discTaken)]);
    }

    /* --- みがき用の クロス（右手に） --- */
    if (Actor.holdCloth) {
      var hp = Actor.handPos('R');
      Scene.drawObj(parts, U.M.trs(hp, U.rad(-Actor.yaw), 1),
        idx.cloth.first, idx.cloth.count);
    }

    /* --- おわりの ふたつの めじるし --- */
    if (st.padMode === 1) {
      var tt = Scene.t;
      var a0 = R.outroPads[0];
      Scene.drawObj(parts, U.M.trs([a0[0], a0[1] + 15 + Math.sin(tt * 1.6) * 1.8, a0[2]], tt * 0.6, 4.2),
        idx.lamp.first, idx.lamp.count, [1.0, 0.92, 0.6]);
      var b0 = R.outroPads[1];
      for (var di = 0; di < 4; di++) {
        var ang = tt * 0.7 + di * Math.PI / 2;
        var dm = mul(U.M.trs([b0[0] + Math.cos(ang) * 8.5, b0[1] + 15 + Math.sin(tt * 1.6 + di) * 1.2,
                              b0[2] + Math.sin(ang) * 8.5], ang, 0.58), RX(U.rad(90)));
        drawDisc(dm, st.themeColors[di]);
      }
    }

    /* --- 惑星ノブ --- */
    if (st.knobShow > 0.01) {
      for (var k = 0; k < 3; k++) {
        var rail = R.rails[k];
        var t = st.knobT[k] * 2 - 1;
        var pos = [rail.c[0] + rail.x[0] * t * rail.half, rail.c[1] + 5.4,
                   rail.c[2] + rail.x[2] * t * rail.half];
        var mm = U.M.trs(pos, 0, 1);
        Scene.drawObj(parts, mm, idx.knob.first, idx.knob.count, st.knobColors[k]);
        Scene.drawObj(parts, mm, idx.knobStem.first, idx.knobStem.count);
        if (Math.abs(st.knobT[k] - R.knobTarget[k]) < 0.10) {
          Scene.drawObj(parts, mm, idx.knobRing.first, idx.knobRing.count, [1.0, 0.92, 0.6]);
        }
      }
    }

    /* --- ケーブル本体 --- */
    updateCables();
    Scene.drawObj(cableBuf, null);

    /* --- ケーブルの コネクタ --- */
    for (var q = 0; q < 3; q++) {
      var pp = st.plugDrag[q] || (st.plugState[q] === 2 ? R.sockets[q].c : R.cableHome[q]);
      var yaw = Math.atan2(R.powerDir[0], R.powerDir[2]) + Math.PI;
      var pm = U.M.trs(pp, yaw, 1);
      Scene.drawObj(parts, pm, idx.plug.first, idx.plug.count, PLUG_COL[q]);
      Scene.drawObj(parts, pm, idx.plugPin.first, idx.plugPin.count);
      if (st.lampOn[q] > 0.01) {
        var lm = U.M.trs(R.sockets[q].lamp, 0, 1);
        Scene.drawObj(parts, lm, idx.lamp.first, idx.lamp.count,
          [PLUG_COL[q][0] * 1.6, PLUG_COL[q][1] * 1.6, PLUG_COL[q][2] * 1.6]);
      }
    }

    /* --- 主レバー --- */
    var ang = U.lerp(-0.42, 0.72, st.lever);
    var lm2 = U.M.trs(R.leverPivot, Math.atan2(R.leverDir[0], R.leverDir[2]), 1, ang);
    Scene.drawObj(parts, lm2, idx.leverArm.first, idx.leverArm.count);
    Scene.drawObj(parts, lm2, idx.leverGrip.first, idx.leverGrip.count);
    Scene.drawObj(parts, lm2, idx.leverTip.first, idx.leverTip.count);
    R.leverGripPos = [
      lm2[4] * 16 + lm2[12],
      lm2[5] * 16 + lm2[13],
      lm2[6] * 16 + lm2[14]
    ];
  };


  function drawDisc(m, col) {
    Scene.drawObj(parts, m, idx.disc.first, idx.disc.count, col);
    Scene.drawObj(parts, m, idx.discLabel.first, idx.discLabel.count,
      [col[0] * 1.5 + 0.15, col[1] * 1.5 + 0.15, col[2] * 1.5 + 0.15]);
    Scene.drawObj(parts, m, idx.discRim.first, idx.discRim.count);
    Scene.drawObj(parts, m, idx.discHub.first, idx.discHub.count);
  }
  R.drawDisc = drawDisc;
  R.drawPart = function (name, m, tint) {
    Scene.drawObj(parts, m, idx[name].first, idx[name].count, tint);
  };

  /* ---------------- パッドの 発光 ---------------- */
  R.renderPads = function (VP) {
    var st = R.state;
    if (st.padAlpha <= 0.01) return;
    var p = Scene.padProgram();
    gl.useProgram(p.p);
    GLC.attrib(gl, p, 'aPos', pads.pos, 3);
    GLC.attrib(gl, p, 'aUV', pads.uv, 2);
    GLC.attrib(gl, p, 'aCen', pads.cen, 2);
    GLC.attrib(gl, p, 'aFlag', pads.flag, 1);
    gl.uniform1f(p.u.uPadMode, st.padMode || 0);
    gl.uniformMatrix4fv(p.u.uVP, false, VP);
    gl.uniform1f(p.u.uTime, Scene.t);
    gl.uniform1f(p.u.uHotAmt, st.hotAmt);
    gl.uniform1f(p.u.uAlpha, st.padAlpha);
    gl.uniform2fv(p.u.uHot, st.hotPad);
    gl.uniform2fv(p.u.uGirl, st.girlXZ);
    gl.uniform3f(p.u.uColor, 0.42, 0.62, 0.85);
    gl.uniform3f(p.u.uHotColor, 1.0, 0.86, 0.52);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, pads.idx);
    gl.drawElements(gl.TRIANGLES, pads.count, gl.UNSIGNED_SHORT, 0);
    GLC.disableAll(gl, p);
  };

  global.Room = R;
})(window);
