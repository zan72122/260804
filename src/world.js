/* =========================================================================
   world.js — 遠景・中景・近景を分けた養蜂場の風景
   遠景 : 空／連なる山（空気遠近で青ざめる）
   中景 : 起伏する草地・林・他の巣箱・柵
   近景 : 作業台・草むら・花・道具
   ========================================================================= */
(function (global) {
  'use strict';

  var World = {
    scene: null, sunDir: new THREE.Vector3(0.42, 0.62, 0.46).normalize(),
    sun: null, hemi: null, fill: null,
    ground: null, hives: [], activeHive: null,
    _shadowFocus: new THREE.Vector3(),
    clouds: [], grass: null
  };

  var SKY_TOP = MAT.C(0x3f86c4);
  var SKY_BOT = MAT.C(0xd6e9f2);
  var FOG_COL = MAT.C(0xc3ddea);

  /* ---------- 空 ---------- */
  function buildSky() {
    var g = new THREE.SphereGeometry(600, 32, 20);
    var m = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: SKY_TOP }, uBot: { value: SKY_BOT },
        uSun: { value: World.sunDir.clone() },
        uSunCol: { value: MAT.C(0xfff4d8) }
      },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }',
      fragmentShader: [
        'uniform vec3 uTop, uBot, uSunCol; uniform vec3 uSun; varying vec3 vD;',
        'void main(){',
        '  float h = clamp(vD.y*1.05+0.06, 0.0, 1.0);',
        '  vec3 c = mix(uBot, uTop, pow(h, 0.72));',
        '  float sd = max(dot(normalize(vD), normalize(uSun)), 0.0);',
        '  c += uSunCol * pow(sd, 6.0) * 0.30;',
        '  c += uSunCol * pow(sd, 260.0) * 1.6;',
        '  c = mix(c, vec3(0.90,0.94,0.97), pow(1.0-h, 6.0)*0.55);',
        '  gl_FragColor = vec4(c, 1.0);',
        '  #include <tonemapping_fragment>',
        '  #include <encodings_fragment>',
        '}'
      ].join('\n')
    });
    var sky = new THREE.Mesh(g, m);
    sky.renderOrder = -1000;
    sky.frustumCulled = false;
    return sky;
  }

  /* ---------- 遠景の山なみ（空気遠近で層をつくる） ---------- */
  function ridge(dist, height, color, seed, jag) {
    var rnd = U.mulberry(seed);
    var N = 90, W = dist * 3.4;
    var shape = new THREE.Shape();
    shape.moveTo(-W / 2, -height * 2);
    var pts = [];
    for (var i = 0; i <= N; i++) {
      var t = i / N;
      var x = -W / 2 + t * W;
      var y = 0;
      y += Math.sin(t * 6.1 + seed) * 0.42 + Math.sin(t * 13.7 + seed * 2.1) * 0.26
        + Math.sin(t * 29.3 + seed * 3.3) * 0.14 + (rnd() - .5) * jag;
      y = (y * 0.5 + 0.5);
      y = Math.pow(U.sat(y), 1.25) * height;
      pts.push(new THREE.Vector2(x, y));
    }
    shape.lineTo(pts[0].x, pts[0].y);
    for (var k = 1; k < pts.length; k++) shape.lineTo(pts[k].x, pts[k].y);
    shape.lineTo(W / 2, -height * 2);
    shape.closePath();
    var geo = new THREE.ShapeGeometry(shape, 1);
    var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: color, fog: false, depthWrite: false }));
    m.position.z = -dist;
    m.renderOrder = -900 + Math.round(dist);
    return m;
  }

  /* ---------- 雲 ---------- */
  function buildClouds(scene) {
    var tex = TEX.cloud();
    for (var i = 0; i < 12; i++) {
      var s = U.rand(28, 72);
      var m = new THREE.Mesh(
        new THREE.PlaneGeometry(s, s * 0.5),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: U.rand(.5, .95), depthWrite: false, fog: false })
      );
      var a = U.rand(-1.5, 1.5);
      var d = U.rand(120, 300);
      m.position.set(Math.sin(a) * d, U.rand(28, 78), -Math.cos(a) * d);
      m.lookAt(0, m.position.y, 0);
      m.renderOrder = -850;
      m.userData.spd = U.rand(0.25, 0.8);
      scene.add(m);
      World.clouds.push(m);
    }
  }

  /* ---------- 地面 ---------- */
  function buildGround(scene) {
    var S = 520, N = 128;
    var g = new THREE.PlaneGeometry(S, S, N, N);
    var pos = g.attributes.position;
    var rnd = U.mulberry(9);
    // 低周波の起伏（作業場のまわりだけ平らにする）
    var grid = [];
    for (var i = 0; i < 40 * 40; i++) grid.push(rnd());
    function noise(x, z) {
      var gx = ((x / S + .5) * 39), gz = ((z / S + .5) * 39);
      var x0 = Math.floor(gx), z0 = Math.floor(gz);
      var tx = gx - x0, tz = gz - z0;
      tx = tx * tx * (3 - 2 * tx); tz = tz * tz * (3 - 2 * tz);
      function G(a, b) { return grid[(U.clamp(b, 0, 39) * 40 + U.clamp(a, 0, 39))]; }
      var a1 = U.lerp(G(x0, z0), G(x0 + 1, z0), tx);
      var a2 = U.lerp(G(x0, z0 + 1), G(x0 + 1, z0 + 1), tx);
      return U.lerp(a1, a2, tz);
    }
    for (var v = 0; v < pos.count; v++) {
      var x = pos.getX(v), y = pos.getY(v);
      var d = Math.hypot(x, y);
      var flat = U.smooth(3.5, 26, d);
      var h = (noise(x, y) - 0.5) * 9.0 + (noise(x * 3.1, y * 3.1) - 0.5) * 2.2;
      pos.setZ(v, h * flat);
    }
    g.computeVertexNormals();
    var m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({
      map: TEX.grass(), roughness: 0.97, metalness: 0
    }));
    m.rotation.x = -Math.PI / 2;
    m.receiveShadow = true;
    scene.add(m);
    World.ground = m;

    // 踏み固められた土（作業場の通り道だけ・ふちはぼかす）
    var dirtC = document.createElement('canvas'); dirtC.width = dirtC.height = 256;
    var dg = dirtC.getContext('2d');
    var rd = U.mulberry(404);
    dg.clearRect(0, 0, 256, 256);
    for (var q = 0; q < 260; q++) {
      var qa = rd() * Math.PI * 2, qr = Math.pow(rd(), 0.55) * 118;
      var qx = 128 + Math.cos(qa) * qr, qy = 128 + Math.sin(qa) * qr;
      var rr2 = 10 + rd() * 34;
      var rg2 = dg.createRadialGradient(qx, qy, 0, qx, qy, rr2);
      var sh = 0.55 + rd() * 0.35;
      rg2.addColorStop(0, 'rgba(' + Math.round(126 * sh + 34) + ',' + Math.round(104 * sh + 26) + ',' + Math.round(74 * sh + 16) + ',0.9)');
      rg2.addColorStop(1, 'rgba(120,98,68,0)');
      dg.fillStyle = rg2; dg.beginPath(); dg.arc(qx, qy, rr2, 0, 7); dg.fill();
    }
    // ふちをやわらかく抜く
    dg.globalCompositeOperation = 'destination-in';
    var fade = dg.createRadialGradient(128, 128, 40, 128, 128, 128);
    fade.addColorStop(0, 'rgba(0,0,0,1)');
    fade.addColorStop(0.72, 'rgba(0,0,0,0.85)');
    fade.addColorStop(1, 'rgba(0,0,0,0)');
    dg.fillStyle = fade; dg.fillRect(0, 0, 256, 256);
    dg.globalCompositeOperation = 'source-over';
    var dtex = new THREE.CanvasTexture(dirtC);
    dtex.encoding = THREE.sRGBEncoding;
    var dirt = new THREE.Mesh(
      new THREE.CircleGeometry(1.62, 48),
      new THREE.MeshStandardMaterial({
        map: dtex, transparent: true, roughness: 1, metalness: 0,
        polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2
      })
    );
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.y = 0.004;
    dirt.receiveShadow = true;
    scene.add(dirt);
  }

  /* ---------- 近景の草むら ---------- */
  function grassBladeTex() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 64;
    var g = c.getContext('2d');
    var rnd = U.mulberry(77);
    for (var i = 0; i < 26; i++) {
      var x = 4 + rnd() * 56, h = 18 + rnd() * 34, w = 1.6 + rnd() * 2.6;
      var bend = (rnd() - .5) * 18;
      var grd = g.createLinearGradient(x, 64, x, 64 - h);
      grd.addColorStop(0, 'rgba(96,126,54,1)');
      grd.addColorStop(.55, 'rgba(134,172,72,1)');
      grd.addColorStop(1, 'rgba(184,214,108,1)');
      g.fillStyle = grd;
      g.beginPath();
      g.moveTo(x - w, 64);
      g.quadraticCurveTo(x - w * .4 + bend * .5, 64 - h * .6, x + bend, 64 - h);
      g.quadraticCurveTo(x + w * .4 + bend * .5, 64 - h * .6, x + w, 64);
      g.closePath(); g.fill();
    }
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function buildGrassTufts(scene) {
    var tex = grassBladeTex();
    var mat = new THREE.MeshStandardMaterial({
      map: tex, alphaTest: 0.52, transparent: false, side: THREE.DoubleSide,
      roughness: 1, metalness: 0
    });
    var g1 = new THREE.PlaneGeometry(0.20, 0.15); g1.translate(0, 0.075, 0);
    var g2 = g1.clone(); g2.rotateY(Math.PI / 3);
    var g3 = g1.clone(); g3.rotateY(-Math.PI / 3);
    var geo = mergeGeoms([{ geo: g1 }, { geo: g2 }, { geo: g3 }]);
    var N = 340;
    var im = new THREE.InstancedMesh(geo, mat, N);
    im.castShadow = false; im.receiveShadow = true;
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    var k = 0;
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = 1.45 + Math.pow(Math.random(), 0.55) * 8.5;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
      var sc = U.rand(0.7, 1.25);
      s.set(sc, sc * U.rand(.8, 1.2), sc);
      m.compose(p, q, s);
      im.setMatrixAt(k++, m);
    }
    scene.add(im);
    World.grass = im;
  }

  /* ---------- 花畑（中景） ---------- */
  function flowerTex() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var g = c.getContext('2d');
    g.clearRect(0, 0, 64, 64);
    // 茎
    g.strokeStyle = '#4e7a2c'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(32, 64); g.lineTo(32, 30); g.stroke();
    // 花びら
    for (var i = 0; i < 6; i++) {
      var a = i / 6 * Math.PI * 2;
      g.fillStyle = '#f6e37a';
      g.beginPath(); g.ellipse(32 + Math.cos(a) * 11, 24 + Math.sin(a) * 11, 7, 5, a, 0, 7); g.fill();
    }
    g.fillStyle = '#c98a1e';
    g.beginPath(); g.arc(32, 24, 7, 0, 7); g.fill();
    var t = new THREE.CanvasTexture(c);
    t.encoding = THREE.sRGBEncoding;
    return t;
  }

  function buildFlowers(scene) {
    var mat = new THREE.MeshStandardMaterial({
      map: flowerTex(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1
    });
    var g1 = new THREE.PlaneGeometry(0.16, 0.16); g1.translate(0, 0.08, 0);
    var g2 = g1.clone(); g2.rotateY(Math.PI / 2);
    var geo = mergeGeoms([{ geo: g1 }, { geo: g2 }]);
    var N = 700;
    var im = new THREE.InstancedMesh(geo, mat, N);
    im.receiveShadow = true;
    var m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var r = 4 + Math.pow(Math.random(), 0.5) * 34;
      p.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6.28);
      var sc = U.rand(0.75, 1.5);
      s.set(sc, sc, sc);
      m.compose(p, q, s);
      im.setMatrixAt(i, m);
    }
    scene.add(im);
  }

  /* ---------- 林・柵・他の巣箱 ---------- */
  function buildScenery(scene) {
    /* --- 林（中景）：1メッシュにまとめて描画負荷を下げる --- */
    var trunkParts = [], leafParts = [];
    var greens = [MAT.C(0x4b7a35), MAT.C(0x568a3c), MAT.C(0x3f6a2c), MAT.C(0x5f9646)];
    var trunkCol = MAT.C(0x5a4630);
    var trunkGeo = new THREE.CylinderGeometry(1, 1, 1, 7);
    var leafGeo = new THREE.IcosahedronGeometry(1, 0);
    for (var i = 0; i < 20; i++) {
      var rnd = U.mulberry(i * 17 + 5);
      var a = rnd() * Math.PI * 2, r = 17 + rnd() * 58, h = 3.4 + rnd() * 5.2;
      var bx = Math.cos(a) * r, bz = Math.sin(a) * r;
      var m = new THREE.Matrix4().makeScale(h * 0.030, h * 0.44, h * 0.030);
      m.setPosition(bx, h * 0.22, bz);
      trunkParts.push({ geo: trunkGeo, matrix: m, color: trunkCol });
      for (var k = 0; k < 4; k++) {
        var rr = h * (0.30 - k * 0.045);
        var lm = new THREE.Matrix4().makeScale(rr, rr * 0.82, rr);
        lm.setPosition(bx + (rnd() - .5) * h * .10, h * (0.40 + k * 0.16), bz + (rnd() - .5) * h * .10);
        leafParts.push({ geo: leafGeo, matrix: lm, color: greens[(i + k) % greens.length] });
      }
    }
    var trunkMesh = new THREE.Mesh(mergeGeoms(trunkParts),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, metalness: 0 }));
    var leafMesh = new THREE.Mesh(mergeGeoms(leafParts),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0, flatShading: true }));
    trunkMesh.receiveShadow = leafMesh.receiveShadow = true;
    scene.add(trunkMesh, leafMesh);

    /* --- ずっと遠くの林（シルエット・空気遠近） --- */
    var farParts = [];
    var coneGeo = new THREE.ConeGeometry(1, 1, 6);
    for (var j = 0; j < 44; j++) {
      var rj = U.mulberry(j * 29 + 11);
      var aa = rj() * Math.PI * 2, rr2 = 92 + rj() * 130, hh = 6 + rj() * 9;
      var cm = new THREE.Matrix4().makeScale(hh * 0.30, hh, hh * 0.30);
      cm.setPosition(Math.cos(aa) * rr2, hh / 2, Math.sin(aa) * rr2);
      farParts.push({
        geo: coneGeo, matrix: cm,
        color: MAT.C(0x6d8f77).lerp(FOG_COL, U.smooth(90, 230, rr2))
      });
    }
    var farMesh = new THREE.Mesh(mergeGeoms(farParts),
      new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
    scene.add(farMesh);

    /* --- 木の柵（1メッシュ） --- */
    var fenceParts = [];
    var postGeo = new THREE.BoxGeometry(1, 1, 1);
    for (var k2 = 0; k2 < 26; k2++) {
      var rk = U.mulberry(k2 * 13 + 3);
      var x = -9 + k2 * 0.72;
      var ph = 1.0 + rk() * 0.16;
      var pm = new THREE.Matrix4().makeRotationZ((rk() - .5) * 0.08);
      pm.scale(new THREE.Vector3(0.075, ph, 0.06));
      pm.setPosition(x, 0.55, -6.4);
      fenceParts.push({ geo: postGeo, matrix: pm });
    }
    for (var b2 = 0; b2 < 2; b2++) {
      var rm = new THREE.Matrix4().makeScale(18.5, 0.09, 0.035);
      rm.setPosition(-0.7, 0.52 + b2 * 0.36, -6.4);
      fenceParts.push({ geo: postGeo, matrix: rm });
    }
    var fence = new THREE.Mesh(mergeGeoms(fenceParts),
      MAT.wood({ seed: 301, repX: 1, repY: 1, base: [158, 128, 88], dark: [96, 74, 44] }));
    fence.castShadow = true; fence.receiveShadow = true;
    scene.add(fence);

    /* --- 他の巣箱（養蜂場らしい列） --- */
    var cols = ['#c4d6bd', '#d8caa0', '#b3cbd8', '#d9bda9'];
    var pos = [[-2.35, -1.05, -0.34], [-3.42, -1.45, -0.30], [2.30, -1.30, 0.30], [3.35, -1.75, 0.26]];
    for (var h2 = 0; h2 < pos.length; h2++) {
      var stand = P.crate(0.62, 0.30, 0.50, 200 + h2 * 5);
      stand.position.set(pos[h2][0], 0, pos[h2][1]);
      stand.rotation.y = pos[h2][2];
      scene.add(stand);
      var hv = P.hive({ color: cols[h2 % cols.length], seed: 40 + h2 * 13 });
      hv.position.set(pos[h2][0], 0.30, pos[h2][1]);
      hv.rotation.y = pos[h2][2];
      scene.add(hv);
      World.hives.push(hv);
      var sb = P.shadowBlob(0.42, 0.40, 0.42);
      sb.position.set(pos[h2][0], 0.006, pos[h2][1]);
      scene.add(sb);
    }
  }

  /* =======================================================================
     build
     ======================================================================= */
  World.build = function (scene, renderer, quality) {
    World.scene = scene;
    scene.background = null;
    scene.fog = new THREE.Fog(0xc3ddea, 14, 260);

    scene.add(buildSky());

    // 遠景の山（空気遠近：遠いほど空の色に溶ける）
    scene.add(ridge(320, 46, MAT.C(0x9db9ce).lerp(SKY_BOT, 0.42), 3, 0.30));
    scene.add(ridge(230, 34, MAT.C(0x86a5bc).lerp(SKY_BOT, 0.26), 11, 0.36));
    scene.add(ridge(150, 20, MAT.C(0x7a9a8a).lerp(SKY_BOT, 0.16), 23, 0.42));

    buildClouds(scene);
    buildGround(scene);
    buildScenery(scene);
    buildFlowers(scene);
    buildGrassTufts(scene);

    /* --- 照明 --- */
    var hemi = new THREE.HemisphereLight(0xbcdcf0, 0x6f7a48, 0.52);
    hemi.color.convertSRGBToLinear(); hemi.groundColor.convertSRGBToLinear();
    scene.add(hemi);
    World.hemi = hemi;

    var sun = new THREE.DirectionalLight(0xfff0d2, 2.35);
    sun.color.convertSRGBToLinear();
    sun.position.copy(World.sunDir).multiplyScalar(9);
    sun.castShadow = true;
    var sm = quality === 'low' ? 1024 : 2048;
    sun.shadow.mapSize.set(sm, sm);
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 22;
    sun.shadow.camera.left = -1.9; sun.shadow.camera.right = 1.9;
    sun.shadow.camera.top = 1.9; sun.shadow.camera.bottom = -1.9;
    sun.shadow.bias = -0.0009;
    sun.shadow.normalBias = 0.018;
    sun.shadow.radius = 2.0;
    scene.add(sun);
    scene.add(sun.target);
    World.sun = sun;

    // 空からの弱い補助光（影の中を潰さない）
    var fill = new THREE.DirectionalLight(0xa8ccdf, 0.40);
    fill.color.convertSRGBToLinear();
    fill.position.set(-0.6, 0.5, -0.7);
    scene.add(fill);
    World.fill = fill;

    return World;
  };

  // 影を落とすカメラの中心を作業対象に合わせる
  World.setShadowFocus = function (v) {
    World._shadowFocus.copy(v);
  };

  World.update = function (dt, time, camera) {
    // 影のフォーカス追従
    var f = World._shadowFocus;
    if (World.sun) {
      World.sun.target.position.copy(f);
      World.sun.position.copy(f).addScaledVector(World.sunDir, 8);
      World.sun.target.updateMatrixWorld();
    }
    // 雲を流す
    for (var i = 0; i < World.clouds.length; i++) {
      var c = World.clouds[i];
      c.position.x += c.userData.spd * dt;
      if (c.position.x > 340) c.position.x = -340;
    }
  };

  // 作業する巣箱を配置
  World.placeActiveHive = function (scene) {
    var stand = P.crate(0.66, 0.34, 0.54, 171);
    stand.position.set(0, 0, 0);
    scene.add(stand);
    var hv = P.hive({ color: '#cfdac2', seed: 7 });
    hv.position.set(0, 0.34, 0);
    scene.add(hv);
    World.activeHive = hv;
    World.hiveStand = stand;
    var sb = P.shadowBlob(0.44, 0.42, 0.5);
    sb.position.set(0, 0.007, 0);
    scene.add(sb);
    return hv;
  };

  global.World = World;
})(window);
