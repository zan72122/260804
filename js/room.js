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
    lens:     { az: 96, r: 27 },
    shelf:    { az: 126, r: 128 },
    slot:     { az: 54, r: 27 },
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
    cPar = new Float32Array(n * 2);
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
    b.push(GLC.disk(FR, 96), T(0, FY + 0.2, 0), COL.floor, 0, 1);

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

    /* --- 中央の 投影機（スターボール） --- */
    b.push(GLC.cylinder(9, 6.5, 9, 28), T(0, FY + 4.5, 0), COL.drum, 0, 2);
    b.push(GLC.cylinder(3.0, 2.6, 15, 20), T(0, FY + 16, 0), COL.metal, 0.02, 2);
    b.push(GLC.sphere(5.4, 24, 16, 180, false), T(0, FY + 26, 0), COL.dark, 0.55, 2);
    b.push(GLC.cylinder(1.7, 1.7, 8, 14), T(0, FY + 34.5, 0), COL.metal, 0.05, 2);
    b.push(GLC.sphere(5.4, 24, 16, 180, false), T(0, FY + 43, 0), COL.dark, 0.55, 2);
    b.push(GLC.cylinder(2.3, 1.2, 4.5, 14), T(0, FY + 49.5, 0), COL.metal, 0.35, 2);

    /* ============ ① 対物レンズ（下球の 横に つき出た 鏡筒） ============ */
    var la = U.rad(ST.lens.az), lr = 6.0;
    var lensDir = [Math.cos(la), 0, Math.sin(la)];
    var lensBase = [lensDir[0] * lr, FY + 24, lensDir[2] * lr];
    var lensRot = mul(RY(-la), RZ(U.rad(90)));     // 円柱を 横向きに
    /* 鏡筒 */
    b.push(GLC.cylinder(3.6, 4.4, 9, 20),
      mul(T(lensBase[0] + lensDir[0] * 4, lensBase[1], lensBase[2] + lensDir[2] * 4), lensRot),
      COL.metal, 0.02, 2);
    /* 縁のリング */
    b.push(GLC.cylinder(4.8, 4.8, 1.6, 20),
      mul(T(lensBase[0] + lensDir[0] * 8.6, lensBase[1], lensBase[2] + lensDir[2] * 8.6), lensRot),
      COL.brass, 0.05, 2);
    R.focus.lens = [lensBase[0] + lensDir[0] * 9.4, lensBase[1], lensBase[2] + lensDir[2] * 9.4];
    R.lensDir = lensDir;
    R.lensRadius = 4.2;

    /* ============ ③ ディスク挿入口（ドラムの 反対がわ） ============ */
    var sa = U.rad(ST.slot.az);
    var sdir = [Math.cos(sa), 0, Math.sin(sa)];
    var sHousing = [sdir[0] * 8.5, FY + 15, sdir[2] * 8.5];
    b.push(GLC.roundBox(15, 12, 7, 1.6, 2),
      mul(T(sHousing[0], sHousing[1], sHousing[2]), RY(-sa - Math.PI / 2)), COL.panel, 0, 2);
    /* 差込口の 暗い みぞ */
    b.push(GLC.box(11.5, 1.8, 1.2),
      mul(T(sHousing[0] + sdir[0] * 3.4, sHousing[1] + 1.5, sHousing[2] + sdir[2] * 3.4), RY(-sa - Math.PI / 2)),
      [0.02, 0.02, 0.03], 0, 2);
    R.focus.slot = [sHousing[0] + sdir[0] * 4.0, sHousing[1] + 1.5, sHousing[2] + sdir[2] * 4.0];
    R.slotDir = sdir;

    /* ============ ② ディスク棚（壁ぎわ） ============ */
    var ha = U.rad(ST.shelf.az), hr = ST.shelf.r + 22;
    var hpos = [Math.cos(ha) * hr, FY, Math.sin(ha) * hr];
    var hrot = RY(-ha - Math.PI / 2);
    b.push(GLC.roundBox(84, 4, 20, 1.2, 2), mul(T(hpos[0], FY + 21, hpos[2]), hrot), COL.wood, 0, 3);
    b.push(GLC.roundBox(84, 4, 20, 1.2, 2), mul(T(hpos[0], FY + 3, hpos[2]), hrot), COL.wood, 0, 3);
    b.push(GLC.box(4, 24, 20), mul(T(hpos[0], FY + 11, hpos[2]), hrot), COL.woodHi, 0, 3);
    /* 側板（棚のはしを 局所 X 方向に） */
    var hx = [-Math.sin(ha), 0, Math.cos(ha)];
    for (var e = -1; e <= 1; e += 2) {
      b.push(GLC.box(4, 24, 20),
        mul(T(hpos[0] + hx[0] * 42 * e, FY + 11, hpos[2] + hx[2] * 42 * e), hrot), COL.woodHi, 0, 3);
    }
    b.push(GLC.box(84, 26, 3),
      mul(T(hpos[0] + Math.cos(ha) * 9, FY + 11, hpos[2] + Math.sin(ha) * 9), hrot), COL.wood, 0, 3);
    R.shelfSlots = [];
    for (var d = 0; d < 4; d++) {
      var off = (d - 1.5) * 20;
      R.shelfSlots.push([hpos[0] + hx[0] * off, FY + 13, hpos[2] + hx[2] * off]);
    }
    R.focus.shelf = [hpos[0], FY + 14, hpos[2]];
    R.shelfDir = [-Math.cos(ha), 0, -Math.sin(ha)];   // 棚が 向いている ほう（部屋の中心へ）

    /* ============ ④ 惑星コンソール ============ */
    var ca = U.rad(ST.console.az), cr = ST.console.r + 18;
    var cpos = [Math.cos(ca) * cr, FY, Math.sin(ca) * cr];
    var crot = RY(-ca - Math.PI / 2);
    var cx = [-Math.sin(ca), 0, Math.cos(ca)];
    b.push(GLC.roundBox(62, 5, 26, 1.8, 2), mul(T(cpos[0], FY + 16, cpos[2]), crot), COL.panel, 0, 4);
    b.push(GLC.cylinder(4, 5, 16, 12), T(cpos[0] + cx[0] * 24, FY + 8, cpos[2] + cx[2] * 24), COL.metal, 0, 4);
    b.push(GLC.cylinder(4, 5, 16, 12), T(cpos[0] - cx[0] * 24, FY + 8, cpos[2] - cx[2] * 24), COL.metal, 0, 4);
    /* 3本の レール（みぞ） */
    R.rails = [];
    for (var k = 0; k < 3; k++) {
      var rz = (k - 1) * 7.5;
      var rc = [cpos[0] + Math.cos(ca) * rz, FY + 18.6, cpos[2] + Math.sin(ca) * rz];
      b.push(GLC.box(38, 1.2, 2.6), mul(T(rc[0], rc[1], rc[2]), crot), [0.05, 0.05, 0.07], 0, 4);
      R.rails.push({ c: rc, x: cx, half: 17 });
    }
    R.focus.console = [cpos[0], FY + 20, cpos[2]];
    R.consoleDir = [-Math.cos(ca), 0, -Math.sin(ca)];

    /* ============ ⑤ 配電盤（壁の下、しゃがむ） ============ */
    var pa = U.rad(ST.power.az), pr = ST.power.r + 14;
    var ppos = [Math.cos(pa) * pr, FY, Math.sin(pa) * pr];
    var prot = RY(-pa - Math.PI / 2);
    var px = [-Math.sin(pa), 0, Math.cos(pa)];
    b.push(GLC.roundBox(46, 22, 8, 1.6, 2), mul(T(ppos[0], FY + 12, ppos[2]), prot), COL.panel, 0, 4);
    b.push(GLC.box(42, 2, 1.5),
      mul(T(ppos[0] - Math.cos(pa) * 4, FY + 22, ppos[2] - Math.sin(pa) * 4), prot), COL.metal, 0, 4);
    R.sockets = [];
    for (var q = 0; q < 3; q++) {
      var so = (q - 1) * 13;
      var sc = [ppos[0] + px[0] * so - Math.cos(pa) * 4.6, FY + 12, ppos[2] + px[2] * so - Math.sin(pa) * 4.6];
      b.push(GLC.roundBox(9, 9, 2.5, 1.0, 2), mul(T(sc[0], sc[1], sc[2]), prot), [0.10, 0.10, 0.14], 0, 4);
      b.push(GLC.box(5, 1.6, 1.2), mul(T(sc[0] - Math.cos(pa) * 1.0, sc[1], sc[2] - Math.sin(pa) * 1.0), prot),
        [0.02, 0.02, 0.02], 0, 4);
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
    b.push(GLC.roundBox(34, 5, 22, 1.6, 2), mul(T(vpos[0], FY + 17, vpos[2]), vrot), COL.panel, 0, 4);
    b.push(GLC.cylinder(6, 7, 17, 14), T(vpos[0], FY + 8.5, vpos[2]), COL.metal, 0, 4);
    b.push(GLC.roundBox(7, 3, 16, 1.0, 2), mul(T(vpos[0], FY + 20, vpos[2]), vrot), [0.06, 0.06, 0.09], 0, 4);
    R.leverPivot = [vpos[0], FY + 20, vpos[2]];
    R.leverAxis = [-Math.sin(va), 0, Math.cos(va)];   // レバーは この軸まわりに 倒れる
    R.leverDir = [-Math.cos(va), 0, -Math.sin(va)];
    R.focus.lever = [vpos[0], FY + 26, vpos[2]];

    hall = b.upload(gl);
    R.hallVerts = b.vo;
  }

  /* ============================================================
     動くもの（それぞれ 原点に つくり、行列で 置く）
     ============================================================ */
  function buildParts() {
    var b = new GLC.Builder();

    /* ディスク（テーマ色は uTintMul で 変える） */
    idx.disc = b.push(GLC.cylinder(9.5, 9.5, 1.5, 26), U.M.identity(), [1, 1, 1], 0, 3);
    idx.discFace = b.push(GLC.cylinder(9.0, 3.0, 0.6, 22), T(0, 0.9, 0), [1, 1, 1], 0.25, 3);
    idx.discHole = b.push(GLC.cylinder(2.2, 2.2, 2.0, 12), U.M.identity(), [0.08, 0.08, 0.12], 0, 3);

    /* レバー（原点を 支点に、+Y へ のびる） */
    idx.leverArm = b.push(GLC.cylinder(1.5, 1.2, 15, 12), T(0, 7.5, 0), COL.metal, 0, 4);
    idx.leverGrip = b.push(GLC.roundBox(6.5, 6, 6.5, 2.2, 3), T(0, 16, 0), COL.red, 0.15, 4);
    idx.leverTip = b.push(GLC.sphere(1.6, 12, 8, 180, false), T(0, 19.5, 0), COL.brass, 0.5, 4);

    /* 惑星ノブ */
    idx.knob = b.push(GLC.sphere(5.8, 18, 12, 180, false), U.M.identity(), [1, 1, 1], 0.10, 4);
    idx.knobStem = b.push(GLC.cylinder(1.6, 1.4, 3.4, 10), T(0, -3.6, 0), COL.metal, 0, 4);
    idx.knobRing = b.push(GLC.cylinder(8.8, 8.8, 0.5, 20), T(0, 0.6, 0), [1, 1, 1], 0.3, 4);

    /* ケーブルの コネクタ */
    idx.plug = b.push(GLC.roundBox(8.2, 8.2, 9.5, 1.8, 2), U.M.identity(), [1, 1, 1], 0, 4);
    idx.plugPin = b.push(GLC.box(4.4, 1.6, 3), T(0, 0, -6), COL.brass, 0.2, 4);

    /* みがき用の クロス */
    idx.cloth = b.push(GLC.roundBox(7, 1.6, 7, 0.7, 2), U.M.identity(), [0.94, 0.90, 0.72], 0, 3);

    /* ランプ（点いたら 光る 小球） */
    idx.lamp = b.push(GLC.sphere(1.7, 12, 8, 180, false), U.M.identity(), [1, 1, 1], 1.0, 4);

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
    Scene.drawObj(parts, m, idx.discFace.first, idx.discFace.count,
      [col[0] * 1.4, col[1] * 1.4, col[2] * 1.4]);
    Scene.drawObj(parts, m, idx.discHole.first, idx.discHole.count);
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
