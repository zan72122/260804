/* =========================================================================
   props.js — 実寸に基づく養蜂道具のジオメトリ
   単位は メートル。ラングストロス型巣箱の実寸（50.8 x 41.3 x 24.2 cm）を基準に
   すべての道具の寸法・厚み・重さの見えかたを合わせている。
   ========================================================================= */
(function (global) {
  'use strict';

  var P = {};
  var V3 = THREE.Vector3;

  /* ---------- 汎用ヘルパ ---------- */

  function box(w, h, d, mat, x, y, z) {
    var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x || 0, y || 0, z || 0);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function cyl(rt, rb, h, seg, mat, open) {
    var m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg || 24, 1, !!open), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function torus(r, t, mat, seg) {
    var m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, seg || 28), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  P.box = box; P.cyl = cyl; P.torus = torus;

  // 断面リストをロフトして閉じた筒を作る
  P.loft = function (rings, closeCaps) {
    var n = rings.length, m = rings[0].length;
    var pos = [], idx = [];
    for (var i = 0; i < n; i++) for (var j = 0; j < m; j++) {
      var p = rings[i][j]; pos.push(p.x, p.y, p.z);
    }
    for (var i2 = 0; i2 < n - 1; i2++) {
      for (var j2 = 0; j2 < m; j2++) {
        var a = i2 * m + j2, b = i2 * m + (j2 + 1) % m;
        var c = (i2 + 1) * m + j2, d = (i2 + 1) * m + (j2 + 1) % m;
        idx.push(a, c, b, b, c, d);
      }
    }
    if (closeCaps) {
      var c0 = pos.length / 3;
      var s = new V3(), e = new V3();
      for (var k = 0; k < m; k++) { s.add(rings[0][k]); e.add(rings[n - 1][k]); }
      s.multiplyScalar(1 / m); e.multiplyScalar(1 / m);
      pos.push(s.x, s.y, s.z); pos.push(e.x, e.y, e.z);
      var ci = c0, ce = c0 + 1;
      for (var j3 = 0; j3 < m; j3++) {
        idx.push(ci, (j3 + 1) % m, j3);
        idx.push(ce, (n - 1) * m + j3, (n - 1) * m + (j3 + 1) % m);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  // 接地影（ソフトな丸い影を地面に落として「置かれている感」を出す）
  P.shadowBlob = function (rx, rz, op) {
    var m = new THREE.Mesh(
      new THREE.PlaneGeometry(rx * 2, (rz || rx) * 2),
      new THREE.MeshBasicMaterial({
        map: TEX.shadowBlob(), transparent: true, opacity: op == null ? 0.5 : op,
        depthWrite: false, blending: THREE.NormalBlending
      })
    );
    m.rotation.x = -Math.PI / 2;
    m.renderOrder = 1;
    return m;
  };

  /* =======================================================================
     巣箱（ラングストロス型・ペンキが剥げた古い箱）
     ======================================================================= */
  P.hive = function (opt) {
    opt = opt || {};
    var col = opt.color || '#e8f0e2';
    var seed = opt.seed || 3;
    var W = 0.508, D = 0.413, H = 0.242, T = 0.022;
    var g = new THREE.Group();
    var mat = MAT.painted(col, seed);
    var matIn = MAT.wood({ seed: seed + 1, repX: 2, repY: 1 });
    var y0 = 0;

    // --- 箱本体（4枚の板：内側が見えるよう板として組む）---
    var body = new THREE.Group();
    var front = box(W, H, T, mat, 0, H / 2, D / 2 - T / 2);
    var back = box(W, H, T, mat, 0, H / 2, -D / 2 + T / 2);
    var left = box(T, H, D - T * 2, mat, -W / 2 + T / 2, H / 2, 0);
    var right = box(T, H, D - T * 2, mat, W / 2 - T / 2, H / 2, 0);
    body.add(front, back, left, right);
    // 内壁（未塗装の木）
    var iw = 0.004;
    body.add(box(W - T * 2, H - 0.02, iw, matIn, 0, H / 2, D / 2 - T - iw / 2));
    body.add(box(W - T * 2, H - 0.02, iw, matIn, 0, H / 2, -D / 2 + T + iw / 2));
    // 巣枠を受ける「さん（ラベット）」
    var rab = MAT.wood({ seed: seed + 5 });
    body.add(box(W - T * 2, 0.010, 0.012, rab, 0, H - 0.016, D / 2 - T - 0.006));
    body.add(box(W - T * 2, 0.010, 0.012, rab, 0, H - 0.016, -D / 2 + T + 0.006));
    // 持ち手のくぼみ
    body.add(box(0.20, 0.026, 0.008, MAT.painted(col, seed + 9, 0x8f9a8a), 0, H * 0.62, D / 2 - 0.004));
    body.add(box(0.20, 0.026, 0.008, MAT.painted(col, seed + 9, 0x8f9a8a), 0, H * 0.62, -D / 2 + 0.004));
    body.position.y = y0;
    g.add(body);
    g.userData.body = body;
    g.userData.dims = { W: W, D: D, H: H, T: T };

    // --- 底板と巣門 ---
    var floor = new THREE.Group();
    floor.add(box(W + 0.02, 0.019, D + 0.012, MAT.painted(col, seed + 2), 0, -0.0095, 0));
    // 着地板（斜めに張り出す）
    var land = box(0.34, 0.010, 0.10, MAT.wood({ seed: seed + 4 }), 0, -0.012, D / 2 + 0.046);
    land.rotation.x = -0.10;
    floor.add(land);
    // 巣門の暗がり
    var slot = box(0.30, 0.016, 0.006, new THREE.MeshStandardMaterial({ color: MAT.C(0x120c06), roughness: 1 }),
      0, 0.008, D / 2 - T + 0.002);
    floor.add(slot);
    g.add(floor);
    g.userData.entrance = new V3(0, 0.010, D / 2 + 0.01);

    // --- 内ぶた ---
    var inner = new THREE.Group();
    inner.add(box(W - 0.004, 0.012, D - 0.004, MAT.wood({ seed: seed + 6, repX: 2 }), 0, H + 0.006, 0));
    inner.add(box(0.09, 0.014, 0.05, new THREE.MeshStandardMaterial({ color: MAT.C(0x1a1208), roughness: 1 }), 0, H + 0.006, 0));
    inner.visible = true;
    g.add(inner);
    g.userData.innerCover = inner;

    // --- 屋根（かぶせぶた・ブリキ張り）---
    var lid = new THREE.Group();
    var lidH = 0.075, lidW = W + 0.028, lidD = D + 0.028;
    var lm = MAT.painted(col, seed + 11);
    lid.add(box(lidW, 0.014, lidD, MAT.metal({ base: '#c3c9cc', grime: 1.3, seed: seed + 3, rough: .5, metal: .8 }), 0, lidH - 0.007, 0));
    lid.add(box(lidW, lidH - 0.014, 0.014, lm, 0, (lidH - 0.014) / 2, lidD / 2 - 0.007));
    lid.add(box(lidW, lidH - 0.014, 0.014, lm, 0, (lidH - 0.014) / 2, -lidD / 2 + 0.007));
    lid.add(box(0.014, lidH - 0.014, lidD - 0.028, lm, -lidW / 2 + 0.007, (lidH - 0.014) / 2, 0));
    lid.add(box(0.014, lidH - 0.014, lidD - 0.028, lm, lidW / 2 - 0.007, (lidH - 0.014) / 2, 0));
    // ブリキの縁
    lid.add(box(lidW + 0.004, 0.010, lidD + 0.004, MAT.metal({ base: '#b6bcc0', grime: 1.5, seed: seed + 7, rough: .55, metal: .85 }), 0, lidH - 0.004, 0));
    lid.position.y = H + 0.012;
    lid.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(lid);
    g.userData.lid = lid;
    g.userData.lidHome = lid.position.clone();
    g.userData.topY = H;

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  /* =======================================================================
     巣枠（フレーム）
     ======================================================================= */
  P.FRAME = { W: 0.482, H: 0.232, T: 0.024, COMB_W: 0.436, COMB_H: 0.192, LUG: 0.020 };

  P.frame = function (opt) {
    opt = opt || {};
    var F = P.FRAME;
    var g = new THREE.Group();
    var wm = MAT.wood({ seed: opt.seed || 21, repX: 3, repY: 1, base: [198, 162, 108], dark: [140, 100, 56] });
    var bar = 0.020, side = 0.024;

    // 上桟（両端に耳＝ラグ）
    var top = box(F.W - F.LUG * 2, 0.022, F.T, wm, 0, F.H / 2 - 0.011, 0);
    g.add(top);
    g.add(box(F.LUG, 0.011, 0.019, wm, -(F.W - F.LUG) / 2, F.H / 2 - 0.0165, 0));
    g.add(box(F.LUG, 0.011, 0.019, wm, (F.W - F.LUG) / 2, F.H / 2 - 0.0165, 0));
    // 下桟
    g.add(box(F.W - F.LUG * 2 - 0.006, 0.014, 0.014, wm, 0, -F.H / 2 + 0.007, 0));
    // 側桟
    var sx = (F.COMB_W + side) / 2;
    g.add(box(side, F.H - 0.032, 0.020, wm, -sx, -0.004, 0));
    g.add(box(side, F.H - 0.032, 0.020, wm, sx, -0.004, 0));

    // 針金（実物どおり水平に3本）
    var wire = new THREE.MeshStandardMaterial({ color: MAT.C(0x9aa0a4), roughness: .35, metalness: .9, envMap: MAT.env });
    for (var i = 0; i < 3; i++) {
      var w = cyl(0.0007, 0.0007, F.COMB_W, 6, wire);
      w.rotation.z = Math.PI / 2;
      w.position.set(0, -0.058 + i * 0.058, 0);
      w.castShadow = false;
      g.add(w);
    }

    // --- 巣脾（コム）---
    var mask = new MAT.CapMask(176, 84);
    mask.reset(opt.uncapped ? 1 : 0);
    var aspect = F.COMB_H / F.COMB_W;
    var cm = MAT.combMaterial(mask.tex, opt.cells || 19, aspect);
    cm.uniforms.uPollen.value = opt.pollen == null ? 0.045 : opt.pollen;
    cm.side = THREE.FrontSide;

    var core = box(F.COMB_W, F.COMB_H, 0.019,
      new THREE.MeshStandardMaterial({ color: MAT.C(0x7d5a26), roughness: .85 }), 0, -0.004, 0);
    g.add(core);

    var cg = new THREE.PlaneGeometry(F.COMB_W, F.COMB_H, 1, 1);
    var front = new THREE.Mesh(cg, cm);
    front.position.set(0, -0.004, 0.0098);
    front.castShadow = false; front.receiveShadow = false;
    g.add(front);
    var back = new THREE.Mesh(cg, cm);
    back.position.set(0, -0.004, -0.0098);
    back.rotation.y = Math.PI;
    back.castShadow = false;
    g.add(back);

    g.traverse(function (o) { if (o.isMesh && o !== front && o !== back) { o.castShadow = true; o.receiveShadow = true; } });

    g.userData.mask = mask;
    g.userData.comb = cm;
    g.userData.combFront = front;
    g.userData.combBack = back;
    return g;
  };

  /* =======================================================================
     燻煙器（スモーカー）
     ======================================================================= */
  P.smoker = function () {
    var g = new THREE.Group();
    var steel = MAT.metal({ base: '#9fa7ad', grime: 1.8, dents: 28, seed: 41, rough: 0.56, metal: 0.80, envI: 0.5 });
    var steelD = MAT.metal({ base: '#7f878d', grime: 2.2, dents: 22, seed: 44, rough: 0.64, metal: 0.74, envI: 0.4 });
    var wire = new THREE.MeshStandardMaterial({ color: MAT.C(0x5c6167), roughness: .5, metalness: .85, envMap: MAT.env, envMapIntensity: 0.5 });
    var R = 0.053, BH = 0.175;

    /* --- 火室 --- */
    var body = cyl(R, R * 0.99, BH, 28, steel);
    body.position.y = BH / 2;
    g.add(body);
    [0.24, 0.70].forEach(function (t) {
      var ring = torus(R + 0.002, 0.0035, steelD, 30);
      ring.rotation.x = Math.PI / 2; ring.position.y = BH * t; g.add(ring);
    });
    var foot = torus(R * 0.92, 0.005, steelD, 26);
    foot.rotation.x = Math.PI / 2; foot.position.y = 0.006; g.add(foot);
    // 底の灰受け
    var ash = cyl(R * 0.94, R * 0.94, 0.010, 24, steelD);
    ash.position.y = 0.005; g.add(ash);

    /* --- ふた（円錐＋曲がったノズル）--- */
    var lidG = new THREE.Group();
    var coneH = 0.060;
    var cone = cyl(0.023, R * 1.04, coneH, 28, steel);
    cone.position.y = coneH / 2;
    lidG.add(cone);
    var collar = torus(0.023, 0.003, steelD, 22);
    collar.rotation.x = Math.PI / 2; collar.position.y = coneH; lidG.add(collar);

    var nozzle = new THREE.Group();
    var nz1 = cyl(0.0165, 0.021, 0.030, 18, steel);
    nz1.position.y = 0.015; nozzle.add(nz1);
    var nz2 = cyl(0.0145, 0.0165, 0.036, 18, steelD);
    nz2.position.y = 0.047; nozzle.add(nz2);
    var lip = torus(0.0150, 0.0022, steelD, 18);
    lip.rotation.x = Math.PI / 2; lip.position.y = 0.064; nozzle.add(lip);
    nozzle.position.y = coneH;
    nozzle.rotation.z = -0.52;                 // 前方へ曲がった煙の出口
    lidG.add(nozzle);
    // ちょうつがい
    lidG.add(box(0.018, 0.012, 0.034, steelD, -R * 0.88, 0.010, 0));
    lidG.position.y = BH + 0.002;
    g.add(lidG);
    g.userData.lid = lidG;
    // ノズル先端（局所座標）
    var tip = new V3(0, 0.070, 0).applyAxisAngle(new V3(0, 0, 1), -0.52);
    g.userData.spout = new V3(tip.x, BH + 0.002 + coneH + tip.y, 0);
    g.userData.spoutDir = new V3(Math.sin(-0.52) * -1, Math.cos(-0.52), 0).normalize();

    /* --- 熱よけの金網かご（実物どおりの太いワイヤ）--- */
    for (var i = 0; i < 3; i++) {
      var b = torus(R + 0.012, 0.0018, wire, 26);
      b.rotation.x = Math.PI / 2; b.position.y = 0.028 + i * 0.058;
      b.castShadow = false;
      g.add(b);
    }
    for (var k = 0; k < 7; k++) {
      var a = k / 7 * Math.PI * 2 + 0.4;
      var v = cyl(0.0017, 0.0017, 0.132, 5, wire);
      v.position.set(Math.cos(a) * (R + 0.012), 0.028 + 0.066, Math.sin(a) * (R + 0.012));
      v.castShadow = false;
      g.add(v);
    }
    // 巣箱に引っかけるフック
    var hook = new THREE.Mesh(new THREE.TorusGeometry(0.019, 0.0026, 6, 14, Math.PI * 1.25), wire);
    hook.rotation.y = Math.PI / 2;
    hook.rotation.z = -0.6;
    hook.position.set(R + 0.016, BH * 0.84, 0);
    g.add(hook);

    /* --- 蛇腹（ふいご）--- */
    var bel = new THREE.Group();
    var L = 0.172, Hh = 0.094;
    var shape = new THREE.Shape();
    shape.moveTo(0, 0.018);
    shape.quadraticCurveTo(-L * 0.30, Hh * 0.88, -L * 0.68, Hh * 0.84);
    shape.quadraticCurveTo(-L * 1.00, Hh * 0.76, -L * 0.99, 0);
    shape.quadraticCurveTo(-L * 1.00, -Hh * 0.76, -L * 0.68, -Hh * 0.84);
    shape.quadraticCurveTo(-L * 0.30, -Hh * 0.88, 0, -0.018);
    shape.closePath();
    var pts = shape.getPoints(44);

    var plateG = new THREE.ExtrudeGeometry(shape, {
      depth: 0.011, bevelEnabled: true, bevelSize: 0.0025, bevelThickness: 0.0025, bevelSegments: 2
    });
    var plateM = MAT.wood({ seed: 55, repX: 1, repY: 1, base: [150, 106, 60], dark: [88, 56, 26] });
    var pA = new THREE.Mesh(plateG, plateM);
    var pB = new THREE.Mesh(plateG, plateM);
    pA.castShadow = pB.castShadow = true;
    pA.receiveShadow = pB.receiveShadow = true;
    bel.add(pA, pB);

    var leather = new THREE.MeshStandardMaterial({
      color: MAT.C(0x5e2d18), roughness: .95, metalness: 0, side: THREE.DoubleSide,
      envMap: MAT.env, envMapIntensity: .10, flatShading: false
    });
    var NR = 11;
    function buildWall(spread) {
      var rings = [];
      for (var i = 0; i < NR; i++) {
        var t = i / (NR - 1);
        var z = (t - 0.5) * spread;
        var sc0 = (i === 0 || i === NR - 1) ? 1.0 : (i % 2 ? 0.72 : 1.12);
        var ring = [];
        for (var j = 0; j < pts.length; j++) {
          var pt = pts[j];
          var hinge = U.sat(1.0 + pt.x / (L * 0.55));
          var sc = U.lerp(sc0, 1.0, hinge * hinge);
          var zz = z * U.lerp(1.0, 0.10, hinge * hinge);
          ring.push(new V3(pt.x, pt.y * sc, zz));
        }
        rings.push(ring);
      }
      return P.loft(rings, false);
    }
    var wall = new THREE.Mesh(buildWall(0.070), leather);
    wall.castShadow = true;
    bel.add(wall);
    bel.userData.rebuild = function (spread) {
      wall.geometry.dispose();
      wall.geometry = buildWall(spread);
      pA.position.z = spread / 2;
      pB.position.z = -spread / 2 - 0.011;
    };
    bel.userData.rebuild(0.070);
    // 蛇腹の口金
    bel.add(box(0.024, 0.024, 0.034, steelD, 0.008, 0, 0));
    bel.position.set(-R - 0.006, BH * 0.50, 0);
    bel.rotation.z = -0.14;
    g.add(bel);
    g.userData.bellows = bel;

    var nzIn = cyl(0.007, 0.009, 0.028, 12, steelD);
    nzIn.rotation.z = Math.PI / 2;
    nzIn.position.set(-R - 0.004, BH * 0.50, 0);
    g.add(nzIn);

    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  /* =======================================================================
     蜜刀／蜜掻きフォーク（蜜蓋を除去する道具）
     ======================================================================= */
  P.uncapFork = function () {
    var g = new THREE.Group();
    var handleM = new THREE.MeshStandardMaterial({
      color: MAT.C(0xa8341d), roughness: .55, metalness: .04, envMap: MAT.env, envMapIntensity: .3
    });
    var steel = MAT.metal({ base: '#bcc2c6', grime: .8, dents: 10, seed: 61, rough: .36, metal: .9, envI: 0.5 });

    // 刃先が原点。歯は -Z（巣脾の中）へ向く。柄は +Z・-Y（手前・下）へ伸びる。
    for (var i = 0; i < 15; i++) {
      var t = cyl(0.0009, 0.0017, 0.026, 5, steel);
      t.rotation.x = Math.PI / 2;
      t.position.set(-0.042 + i * 0.006, 0, 0.012);
      t.castShadow = false;
      g.add(t);
    }
    // 歯を支える台座
    g.add(box(0.096, 0.011, 0.013, steel, 0, 0.001, 0.031));
    g.add(box(0.090, 0.007, 0.008, steel, 0, 0.008, 0.038));

    // 首（台座から手前下へ）
    var dir = new V3(0, -0.60, 0.80).normalize();
    var neck = cyl(0.0062, 0.0075, 0.040, 12, steel);
    neck.quaternion.setFromUnitVectors(new V3(0, 1, 0), dir);
    neck.position.set(0, 0.002, 0.040).addScaledVector(dir, 0.020);
    g.add(neck);

    // 握り（太くて安全な形）
    var base = new V3(0, 0.002, 0.040).addScaledVector(dir, 0.040);
    var q = new THREE.Quaternion().setFromUnitVectors(new V3(0, 1, 0), dir);
    var h = cyl(0.0195, 0.0235, 0.120, 20, handleM);
    h.quaternion.copy(q);
    h.position.copy(base).addScaledVector(dir, 0.060);
    g.add(h);
    var ring = torus(0.0215, 0.0035, handleM, 20);
    ring.quaternion.copy(q); ring.rotateX(Math.PI / 2);
    ring.position.copy(base).addScaledVector(dir, 0.006);
    g.add(ring);
    var cap = new THREE.Mesh(new THREE.SphereGeometry(0.0225, 16, 10), handleM);
    cap.position.copy(base).addScaledVector(dir, 0.120);
    g.add(cap);

    g.userData.tip = new V3(0, 0, 0);
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  /* =======================================================================
     遠心分離機（採蜜機）
     ドラムはステンレスだが，中が見えるように大きなアクリル窓を持つ実機仕様。
     ======================================================================= */
  P.EXTRACTOR = { R: 0.325, H: 0.50, LEG: 0.42, GATE_Y: 0.075, POCKETS: 3 };

  P.extractor = function (glassMat) {
    var E = P.EXTRACTOR;
    var g = new THREE.Group();
    var steel = MAT.metal({ base: '#9aa2a8', grime: 1.0, dents: 14, seed: 71, rough: .52, metal: .55, envI: 0.45 });
    var steelD = MAT.metal({ base: '#7c848a', grime: 1.3, dents: 16, seed: 73, rough: .62, metal: .48, envI: 0.35 });

    var baseY = E.LEG;

    // --- 脚（3本・傾斜）---
    for (var i = 0; i < 3; i++) {
      var a = i / 3 * Math.PI * 2 + 0.5;
      var leg = new THREE.Group();
      var l = cyl(0.011, 0.013, E.LEG + 0.03, 10, steelD);
      l.position.y = (E.LEG + 0.03) / 2;
      leg.add(l);
      var foot = cyl(0.026, 0.028, 0.012, 12, new THREE.MeshStandardMaterial({ color: MAT.C(0x2b2b2e), roughness: .95 }));
      foot.position.y = 0.006; leg.add(foot);
      leg.position.set(Math.cos(a) * (E.R * 0.72), 0, Math.sin(a) * (E.R * 0.72));
      leg.rotation.z = -Math.cos(a) * 0.10;
      leg.rotation.x = Math.sin(a) * 0.10;
      g.add(leg);
    }

    // --- 円錐底 ---
    var coneH = 0.10;
    var coneM = MAT.metal({ base: '#6e767c', grime: 1.6, dents: 14, seed: 79, rough: .74, metal: .30, envI: 0.20 });
    coneM.side = THREE.DoubleSide;
    var cone = cyl(E.R, E.R * 0.30, coneH, 40, coneM, true);
    cone.position.y = baseY + coneH / 2;
    g.add(cone);
    var plate = cyl(E.R * 0.30, E.R * 0.30, 0.012, 24, steelD);
    plate.position.y = baseY + 0.006; g.add(plate);

    // --- 胴（アクリルの覗き窓つき）---
    var wallY0 = baseY + coneH;
    var drum = new THREE.Mesh(
      new THREE.CylinderGeometry(E.R, E.R, E.H, 48, 1, true),
      glassMat || new THREE.MeshPhysicalMaterial({
        color: MAT.C(0xdfeaee), roughness: .06, metalness: 0, transparent: true, opacity: .22,
        side: THREE.DoubleSide, envMap: MAT.env, envMapIntensity: 1.4
      })
    );
    drum.position.y = wallY0 + E.H / 2;
    drum.renderOrder = 12;
    g.add(drum);
    g.userData.drum = drum;

    // 補強のリング（上下）
    var r1 = torus(E.R + 0.004, 0.008, steel, 44); r1.rotation.x = Math.PI / 2; r1.position.y = wallY0 + 0.006; g.add(r1);
    var r2 = torus(E.R + 0.004, 0.010, steel, 44); r2.rotation.x = Math.PI / 2; r2.position.y = wallY0 + E.H - 0.004; g.add(r2);
    var r3 = torus(E.R + 0.004, 0.005, steelD, 44); r3.rotation.x = Math.PI / 2; r3.position.y = wallY0 + E.H * 0.5; g.add(r3);
    // 縦の桟（3本）— 窓を分割して「機械」らしくする
    for (var s = 0; s < 3; s++) {
      var aa = s / 3 * Math.PI * 2 + 0.5;
      var st = box(0.016, E.H, 0.010, steelD,
        Math.cos(aa) * (E.R + 0.004), wallY0 + E.H / 2, Math.sin(aa) * (E.R + 0.004));
      st.lookAt(0, wallY0 + E.H / 2, 0);
      st.position.set(Math.cos(aa) * (E.R + 0.005), wallY0 + E.H / 2, Math.sin(aa) * (E.R + 0.005));
      g.add(st);
    }

    // --- 上部の十字ブリッジと歯車箱 ---
    var topY = wallY0 + E.H;
    var br1 = box(E.R * 2 + 0.02, 0.014, 0.036, steel, 0, topY + 0.007, 0);
    g.add(br1);
    var gearBox = new THREE.Group();
    gearBox.add(cyl(0.048, 0.055, 0.052, 20, steel));
    var gr = torus(0.050, 0.006, steelD, 22); gr.rotation.x = Math.PI / 2; gr.position.y = 0.026; gearBox.add(gr);
    gearBox.position.y = topY + 0.040;
    g.add(gearBox);

    // --- クランク（ハンドル）---
    var crank = new THREE.Group();
    var shaft = cyl(0.010, 0.010, 0.052, 12, steelD); shaft.position.y = 0.026; crank.add(shaft);
    var arm = box(0.140, 0.020, 0.018, steelD, 0.064, 0.052, 0); crank.add(arm);
    var armEnd = cyl(0.008, 0.008, 0.055, 10, steelD);
    armEnd.position.set(0.122, 0.052 + 0.024, 0); crank.add(armEnd);
    var knobM = new THREE.MeshStandardMaterial({ color: MAT.C(0x8f2a16), roughness: .55, metalness: .04, envMap: MAT.env, envMapIntensity: .3 });
    var knob = cyl(0.021, 0.024, 0.062, 18, knobM);
    knob.position.set(0.122, 0.052 + 0.052, 0); crank.add(knob);
    var knobTop = new THREE.Mesh(new THREE.SphereGeometry(0.021, 16, 10), knobM);
    knobTop.position.set(0.122, 0.052 + 0.083, 0); crank.add(knobTop);
    crank.position.y = topY + 0.066;
    crank.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(crank);
    g.userData.crank = crank;
    g.userData.crankKnobLocal = new V3(0.122, 0.052 + 0.052, 0);
    g.userData.crankY = topY + 0.066;

    // --- 蜜栓（ハニーゲート）---
    var gate = new THREE.Group();
    var gm = MAT.metal({ base: '#a2aab0', grime: .8, seed: 77, rough: .44, metal: .62, envI: 0.45 });
    var neck = cyl(0.022, 0.024, 0.045, 16, gm);
    neck.rotation.x = Math.PI / 2; neck.position.set(0, 0, 0.022); gate.add(neck);
    var bodyG = box(0.052, 0.062, 0.030, gm, 0, 0, 0.052); gate.add(bodyG);
    var out = cyl(0.014, 0.016, 0.034, 14, gm);
    out.rotation.x = Math.PI / 2; out.position.set(0, -0.014, 0.070); gate.add(out);
    var lip2 = torus(0.015, 0.002, gm, 16); lip2.rotation.x = Math.PI / 2 + Math.PI / 2; lip2.position.set(0, -0.014, 0.086);
    gate.add(lip2);
    // レバー
    var lever = new THREE.Group();
    var lv = box(0.011, 0.070, 0.011, gm, 0, 0.035, 0);
    lever.add(lv);
    var lknob = new THREE.Mesh(new THREE.SphereGeometry(0.016, 14, 10),
      new THREE.MeshStandardMaterial({ color: MAT.C(0x8f2a16), roughness: .55, envMap: MAT.env, envMapIntensity: .3 }));
    lknob.position.y = 0.078; lever.add(lknob);
    lever.position.set(0, 0.020, 0.052);
    gate.add(lever);
    gate.userData.lever = lever;
    gate.position.set(0, baseY + 0.030, E.R * 0.62);
    gate.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.add(gate);
    g.userData.gate = gate;
    g.userData.spoutWorld = new V3(0, baseY + 0.030 - 0.014, E.R * 0.62 + 0.086);

    // --- 回転かご（ローター）---
    var rotor = new THREE.Group();
    var cageM = new THREE.MeshStandardMaterial({ color: MAT.C(0x7b838a), roughness: .52, metalness: .55, envMap: MAT.env, envMapIntensity: .4 });
    var axle = cyl(0.014, 0.014, E.H + 0.06, 12, cageM);
    axle.position.y = E.H / 2; rotor.add(axle);
    for (var q = 0; q < 2; q++) {
      var yy = q ? E.H - 0.05 : 0.05;
      var hub = torus(E.R * 0.74, 0.004, cageM, 32);
      hub.rotation.x = Math.PI / 2; hub.position.y = yy; hub.castShadow = false; rotor.add(hub);
      for (var sp = 0; sp < 4; sp++) {
        var ang = sp / 4 * Math.PI * 2;
        var spk = cyl(0.003, 0.003, E.R * 0.74, 6, cageM);
        spk.rotation.z = Math.PI / 2; spk.rotation.y = -ang;
        spk.position.set(Math.cos(ang) * E.R * 0.37, yy, Math.sin(ang) * E.R * 0.37);
        spk.castShadow = false;
        rotor.add(spk);
      }
    }
    // 巣枠を差し込むポケット（2枚・接線方向）
    var pockets = [];
    for (var pk = 0; pk < E.POCKETS; pk++) {
      var pa = pk * Math.PI * 2 / E.POCKETS;
      var pg = new THREE.Group();
      pg.position.set(Math.cos(pa) * E.R * 0.50, E.H * 0.5, Math.sin(pa) * E.R * 0.50);
      pg.rotation.y = -pa + Math.PI / 2;
      // 受けのメッシュ枠
      for (var e2 = -1; e2 <= 1; e2 += 2) {
        var rail = box(0.006, E.H * 0.62, 0.010, cageM, e2 * 0.238, 0, 0);
        rail.castShadow = false;
        pg.add(rail);
      }
      var netM = new THREE.MeshStandardMaterial({ color: MAT.C(0x8d949b), roughness: .4, metalness: .85, envMap: MAT.env, transparent: true, opacity: .30, side: THREE.DoubleSide });
      var net = new THREE.Mesh(new THREE.PlaneGeometry(0.478, E.H * 0.60), netM);
      net.position.z = -0.021; net.castShadow = false;
      pg.add(net);
      rotor.add(pg);
      pockets.push(pg);
    }
    rotor.position.y = wallY0;
    g.add(rotor);
    g.userData.rotor = rotor;
    g.userData.pockets = pockets;
    g.userData.wallY0 = wallY0;
    g.userData.topY = topY;

    g.traverse(function (o) { if (o.isMesh && o !== drum) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  /* =======================================================================
     ガラス瓶
     ======================================================================= */
  P.JAR = { R: 0.048, H: 0.135, NECK: 0.030 };

  P.jar = function (glassMat) {
    var J = P.JAR;
    var g = new THREE.Group();
    // 外形（肩のある瓶）
    var prof = [];
    function add(y, r) { prof.push(new THREE.Vector2(r, y)); }
    add(0, 0);
    add(0.0, J.R * 0.94);
    add(0.006, J.R);
    add(J.H * 0.70, J.R);
    add(J.H * 0.82, J.R * 0.86);
    add(J.H * 0.90, J.NECK * 1.05);
    add(J.H, J.NECK);
    var geo = new THREE.LatheGeometry(prof, 40);
    var glass = glassMat || new THREE.MeshPhysicalMaterial({
      color: MAT.C(0xe8f4f6), roughness: .04, metalness: 0, transparent: true, opacity: .30,
      side: THREE.DoubleSide, envMap: MAT.env, envMapIntensity: 1.6
    });
    var body = new THREE.Mesh(geo, glass);
    body.renderOrder = 14;
    g.add(body);
    g.userData.body = body;
    // 口の縁（ねじ山）
    var mouth = new THREE.Mesh(new THREE.CylinderGeometry(J.NECK * 1.10, J.NECK * 1.10, 0.010, 32, 1, true), glass);
    mouth.position.y = J.H - 0.005; mouth.renderOrder = 14;
    g.add(mouth);
    g.userData.inner = { r: J.R - 0.004, h: J.H * 0.80 };
    return g;
  };

  P.jarLid = function () {
    var J = P.JAR;
    var g = new THREE.Group();
    var m = MAT.metal({ base: '#d8a02c', grime: .3, seed: 91, rough: .3, metal: .8 });
    var top = cyl(J.NECK * 1.16, J.NECK * 1.16, 0.016, 32, m);
    g.add(top);
    // ぎざぎざ
    for (var i = 0; i < 26; i++) {
      var a = i / 26 * Math.PI * 2;
      var t = box(0.004, 0.014, 0.004, m, Math.cos(a) * J.NECK * 1.16, 0, Math.sin(a) * J.NECK * 1.16);
      t.castShadow = false;
      g.add(t);
    }
    var lab = new THREE.Mesh(new THREE.CircleGeometry(J.NECK * 0.95, 24),
      new THREE.MeshStandardMaterial({ map: TEX.label(), transparent: true, roughness: .8 }));
    lab.rotation.x = -Math.PI / 2; lab.position.y = 0.0085;
    g.add(lab);
    return g;
  };

  /* =======================================================================
     まわりの小物
     ======================================================================= */
  P.table = function (w, d, h) {
    w = w || 1.10; d = d || 0.62; h = h || 0.74;
    var g = new THREE.Group();
    var wm = MAT.wood({ seed: 101, repX: 3, repY: 1, base: [186, 148, 96], dark: [122, 86, 44] });
    // 天板（板を並べる）
    var planks = 5;
    for (var i = 0; i < planks; i++) {
      var pw = d / planks - 0.004;
      var p = box(w, 0.026, pw, wm, 0, h - 0.013, -d / 2 + pw / 2 + i * (d / planks) + 0.002);
      p.rotation.x = (i - 2) * 0.002;
      g.add(p);
    }
    // 幕板と脚
    var lm = MAT.wood({ seed: 103, repX: 1, repY: 2, base: [170, 132, 84], dark: [108, 74, 38] });
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (s) {
      var leg = box(0.052, h - 0.026, 0.052, lm, s[0] * (w / 2 - 0.05), (h - 0.026) / 2, s[1] * (d / 2 - 0.05));
      g.add(leg);
    });
    g.add(box(w - 0.12, 0.05, 0.02, lm, 0, h - 0.075, d / 2 - 0.05));
    g.add(box(w - 0.12, 0.05, 0.02, lm, 0, h - 0.075, -d / 2 + 0.05));
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  P.crate = function (w, h, d, seed) {
    w = w || 0.40; h = h || 0.30; d = d || 0.32;
    var g = new THREE.Group();
    var wm = MAT.wood({ seed: seed || 111, repX: 2, repY: 1, base: [176, 140, 92], dark: [116, 80, 40] });
    var t = 0.014;
    g.add(box(w, t, d, wm, 0, h - t / 2, 0));
    g.add(box(w, t, d, wm, 0, t / 2, 0));
    var rails = Math.max(1, Math.round((h - 0.03) / 0.085));
    var rh = Math.min(0.055, (h - t * 2) / rails * 0.72);
    [-1, 1].forEach(function (s) {
      for (var i = 0; i < rails; i++) {
        var y = t + rh / 2 + i * ((h - t * 2 - rh) / Math.max(1, rails - 1) || 0);
        if (rails === 1) y = h / 2;
        g.add(box(w, rh, t, wm, 0, y, s * (d / 2 - t / 2)));
        g.add(box(t, rh, d, wm, s * (w / 2 - t / 2), y, 0));
      }
    });
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  // 瓶を載せる無垢の木の台
  P.plinth = function (w, h, d, seed) {
    var g = new THREE.Group();
    var wm = MAT.wood({ seed: seed || 233, repX: 2, repY: 1, base: [166, 126, 78], dark: [104, 70, 34] });
    g.add(box(w, h * 0.80, d, wm, 0, h * 0.40, 0));
    g.add(box(w * 1.10, h * 0.20, d * 1.10, wm, 0, h * 0.90, 0));
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  // 巣枠を立てて置く木の台
  P.frameRack = function (n) {
    n = n || 3;
    var g = new THREE.Group();
    var wm = MAT.wood({ seed: 121, repX: 2, repY: 1, base: [180, 142, 92], dark: [118, 82, 42] });
    // 巣枠の耳（±0.241m）が桟に載るよう幅を実寸に合わせる
    var w = 0.452, d = 0.10 + n * 0.052, h = 0.30;
    [-1, 1].forEach(function (s) {
      g.add(box(0.030, h, 0.030, wm, s * (w / 2 - 0.02), h / 2, d / 2 - 0.02));
      g.add(box(0.030, h, 0.030, wm, s * (w / 2 - 0.02), h / 2, -d / 2 + 0.02));
      g.add(box(0.024, 0.018, d, wm, s * (w / 2 - 0.02), h - 0.009, 0));
    });
    g.add(box(w, 0.016, 0.05, wm, 0, 0.03, d / 2 - 0.03));
    g.add(box(w, 0.016, 0.05, wm, 0, 0.03, -d / 2 + 0.03));
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.userData.topY = h;
    return g;
  };

  // 蜜蓋を受けるトレイ
  P.tray = function (w, d) {
    w = w || 0.62; d = d || 0.34;
    var g = new THREE.Group();
    var m = MAT.metal({ base: '#8d8a7f', grime: 2.0, dents: 14, seed: 131, rough: .80, metal: .12, envI: 0.10 });
    var h = 0.06, t = 0.006;
    g.add(box(w, t, d, m, 0, t / 2, 0));
    g.add(box(w, h, t, m, 0, h / 2, d / 2));
    g.add(box(w, h, t, m, 0, h / 2, -d / 2));
    g.add(box(t, h, d, m, -w / 2, h / 2, 0));
    g.add(box(t, h, d, m, w / 2, h / 2, 0));
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  // 木・低ポリ
  P.tree = function (h, seed) {
    var rnd = U.mulberry(seed || 1);
    var g = new THREE.Group();
    h = h || 4;
    var trunkM = new THREE.MeshStandardMaterial({ color: MAT.C(0x5a4630), roughness: .95 });
    var tr = cyl(h * 0.028, h * 0.055, h * 0.42, 7, trunkM);
    tr.position.y = h * 0.21; g.add(tr);
    var greens = [0x4b7a35, 0x568a3c, 0x3f6a2c];
    for (var i = 0; i < 4; i++) {
      var r = h * (0.30 - i * 0.045);
      var m = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0),
        new THREE.MeshStandardMaterial({ color: greens[i % 3], roughness: 1, flatShading: true }));
      m.position.set((rnd() - .5) * h * .10, h * (0.40 + i * 0.16), (rnd() - .5) * h * .10);
      m.scale.y = 0.82;
      m.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
      g.add(m);
    }
    g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    return g;
  };

  global.P = P;
})(window);
