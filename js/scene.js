/* ------------------------------------------------------------------
   scene.js — 店の 3D 空間を組み立てる（単位はメートル・実寸）
   近景＝作業台と生地／中景＝ピールと窯口／遠景＝炉床の奥と壁。
------------------------------------------------------------------ */
(function () {
  'use strict';
  const PZ = window.PZ;
  const U = PZ.util;
  const T = PZ.tex;
  const G = PZ.geo;
  const TAU = Math.PI * 2;

  /* ================================================================
     寸法（現実の石窯・作業台に合わせる）
  ================================================================ */
  const L = (PZ.LAY = {
    hearthY: 1.05,          // 炉床の高さ（職人が滑り込ませられる高さ）
    ovenX: 0.55, ovenZ: -1.98,
    domeOuter: 0.95, domeInner: 0.78, domeSquash: 0.90,
    mouthW: 0.58, mouthH: 0.50,
    faceZ: -1.35,           // 窯正面の手前面（ドームを切る面）
    faceThick: 0.20,        // 窯壁の厚み
    counterY: 0.92,
    counterZ: -0.35, counterD: 0.80,
    counterX: -0.45, counterW: 3.4,
    boardX: -0.62, boardZ: -0.34, boardR: 0.245,
    pathX: 0.55,
    bakeZ: -2.02,
    chefX: -1.02, chefZ: -1.06,
    pizzaMaxR: 0.15
  });

  /* ピール経路：手前 → 窯口 → 炉床の奥 */
  L.path = [
    { z: -0.22, y: L.counterY + 0.045 },
    { z: L.faceZ, y: L.hearthY + 0.042 },
    { z: -2.55, y: L.hearthY + 0.038 }
  ];

  /* v(-1..1) → ワールド座標 */
  PZ.pathAt = function (v) {
    const p = L.path;
    let z, y;
    if (v <= 0) {
      const t = v + 1;
      z = U.lerp(p[0].z, p[1].z, t);
      y = U.lerp(p[0].y, p[1].y, t);
    } else {
      z = U.lerp(p[1].z, p[2].z, v);
      y = U.lerp(p[1].y, p[2].y, v);
    }
    return { x: L.pathX, y: y, z: z };
  };

  /* ================================================================
     組み立て
  ================================================================ */
  const S = (PZ.scene3 = {});

  function mat(setName, opt) {
    return T.standard(setName, opt);
  }

  S.build = function (scene, renderer) {
    const root = new THREE.Group();
    scene.add(root);
    S.root = root;

    /* ---- 環境マップ（映り込みと拡散の下地） ---- */
    const envCv = T.cv(256);
    (function () {
      const c = envCv.getContext('2d');
      const g = c.createLinearGradient(0, 0, 0, 256);
      g.addColorStop(0, '#4a443c');
      g.addColorStop(0.42, '#2e2620');
      g.addColorStop(0.52, '#1e1712');
      g.addColorStop(1, '#120c09');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
      // 窯の方向のオレンジ
      const rg = c.createRadialGradient(128, 150, 0, 128, 150, 70);
      rg.addColorStop(0, 'rgba(255,140,54,0.6)');
      rg.addColorStop(1, 'rgba(255,120,40,0)');
      c.fillStyle = rg; c.fillRect(0, 0, 256, 256);
      // 天窓
      const wg = c.createRadialGradient(60, 40, 0, 60, 40, 60);
      wg.addColorStop(0, 'rgba(255,246,230,0.75)');
      wg.addColorStop(1, 'rgba(255,246,230,0)');
      c.fillStyle = wg; c.fillRect(0, 0, 256, 256);
    })();
    const envTex = new THREE.CanvasTexture(envCv);
    envTex.mapping = THREE.EquirectangularReflectionMapping;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(envTex).texture;
    scene.environment = env;
    pmrem.dispose();

    /* 窯の正面より手前は切り落とす（実際のクリップ面） */
    const clipFace = new THREE.Plane(new THREE.Vector3(0, 0, -1), L.faceZ);
    S.clipFace = clipFace;

    /* ---- マテリアル ---- */
    const M = (S.mats = {});
    M.brick = mat(T.bricks({ seed: 3, rows: 7, cols: 4, base: [138, 74, 56] }),
      { repeat: [3, 2], normalScale: 1.1, envIntensity: 0.30 });
    M.plaster = mat(T.stucco({ seed: 11, base: [222, 200, 172] }),
      { repeat: [2, 2], normalScale: 0.8, envIntensity: 0.4 });
    M.plasterDome = mat(T.stucco({ seed: 12, base: [206, 180, 152] }),
      { repeat: [3, 2], normalScale: 0.9, envIntensity: 0.35 });
    M.plasterDome.clippingPlanes = [clipFace];
    M.plasterDome.clipShadows = true;
    M.oak = mat(T.wood({ seed: 21, light: [178, 128, 78], dark: [104, 66, 34], rings: 22, roughBase: 200 }),
      { repeat: [2, 1], normalScale: 0.9, envIntensity: 0.3 });
    M.oakDark = mat(T.wood({ seed: 23, light: [150, 104, 62], dark: [78, 48, 26], rings: 18, roughBase: 210 }),
      { repeat: [3, 1], normalScale: 0.9, envIntensity: 0.25 });
    M.birch = mat(T.wood({ seed: 25, light: [232, 208, 168], dark: [186, 154, 108], rings: 30, roughBase: 150 }),
      { repeat: [1, 1], normalScale: 0.7, envIntensity: 0.5 });
    M.marble = mat(T.marble({ seed: 31 }),
      { repeat: [2, 1], normalScale: 0.35, envIntensity: 0.55 });
    M.floor = mat(T.floorTiles({ seed: 41, n: 3 }),
      { repeat: [8, 8], normalScale: 1.0, envIntensity: 0.3 });
    M.hearth = mat(T.hearth(),
      { repeat: [2, 2], normalScale: 1.2, envIntensity: 0.2 });
    M.hearthIn = mat(T.hearth(),
      { repeat: [3, 3], normalScale: 1.3, color: 0x8a7258, envIntensity: 0.04 });
    M.hearthWall = mat(T.hearth(),
      { repeat: [3, 2], normalScale: 1.0, color: 0x3a2418, envIntensity: 0.03 });
    M.hearthWall.clippingPlanes = [clipFace];
    M.hearthWall.side = THREE.BackSide;
    M.tileBand = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0, envMapIntensity: 0.7 });
    M.metal = new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.85, envMapIntensity: 0.6 });
    M.coat = new THREE.MeshStandardMaterial({ color: 0xf3ede0, roughness: 0.85, envMapIntensity: 0.4 });
    M.apron = new THREE.MeshStandardMaterial({ color: 0xe4759f, roughness: 0.8, envMapIntensity: 0.4 });
    M.skin = new THREE.MeshStandardMaterial({ color: 0xf0c9a8, roughness: 0.75, envMapIntensity: 0.4 });
    M.hair = new THREE.MeshStandardMaterial({ color: 0x3a241a, roughness: 0.7, envMapIntensity: 0.4 });
    M.dark = new THREE.MeshStandardMaterial({ color: 0x2a1a12, roughness: 0.95 });
    M.charcoal = new THREE.MeshStandardMaterial({ color: 0x1c1310, roughness: 0.95 });
    M.porcelain = new THREE.MeshStandardMaterial({ color: 0xfdf4f6, roughness: 0.18, envMapIntensity: 0.7 });
    M.porcelainPink = new THREE.MeshStandardMaterial({ color: 0xf2b6ce, roughness: 0.2, envMapIntensity: 0.7 });
    M.glass = new THREE.MeshStandardMaterial({ color: 0xd8e6e2, roughness: 0.08, metalness: 0.0, transparent: true, opacity: 0.55, envMapIntensity: 0.8 });

    function add(geo, m, x, y, z, cast, recv) {
      const o = new THREE.Mesh(geo, m);
      o.position.set(x || 0, y || 0, z || 0);
      o.castShadow = cast !== false;
      o.receiveShadow = recv !== false;
      root.add(o);
      return o;
    }
    S.add = add;

    /* ================== 部屋 ================== */
    // 床
    const floor = add(new THREE.PlaneGeometry(16, 16), M.floor, 0, 0, -1, false, true);
    floor.rotation.x = -Math.PI / 2;
    // 奥の壁
    const back = add(new THREE.PlaneGeometry(16, 6), M.brick, 0, 3, -4.2, false, true);
    // 左右の壁
    const wl = add(new THREE.PlaneGeometry(12, 6), M.brick, -4.6, 3, -1, false, true);
    wl.rotation.y = Math.PI / 2;
    const wr = add(new THREE.PlaneGeometry(12, 6), M.brick, 4.6, 3, -1, false, true);
    wr.rotation.y = -Math.PI / 2;
    // 天井
    const ceil = add(new THREE.PlaneGeometry(16, 16), M.plaster, 0, 3.7, -1, false, false);
    ceil.rotation.x = Math.PI / 2;
    // 天井の梁
    for (let i = -2; i <= 2; i++) {
      const b = add(G.box(0.12, 0.17, 9, 0.02), M.oakDark, i * 1.6, 3.55, -1.8, true, true);
    }

    /* ================== 石窯 ================== */
    const O = new THREE.Group();
    O.position.set(L.ovenX, 0, L.ovenZ);
    root.add(O);
    S.oven = O;

    // 台座（石積み）
    const baseH = L.hearthY;
    const base = new THREE.Mesh(G.box(2.05, baseH, 1.72, 0.03), M.brick);
    base.position.set(0, baseH / 2, -0.20);
    base.castShadow = base.receiveShadow = true;
    O.add(base);

    // 台座の前縁だけに張り出す石の見切り（窯の中には入り込ませない）
    const ledge = new THREE.Mesh(G.box(2.20, 0.05, 0.14, 0.010), M.marble);
    ledge.position.set(0, baseH - 0.02, 0.62);
    ledge.castShadow = ledge.receiveShadow = true;
    O.add(ledge);
    for (let sgn = -1; sgn <= 1; sgn += 2) {
      const side = new THREE.Mesh(G.box(0.14, 0.05, 1.66, 0.010), M.marble);
      side.position.set(sgn * 1.03, baseH - 0.02, -0.22);
      side.castShadow = side.receiveShadow = true;
      O.add(side);
    }

    // 薪置き場（台座前面のアーチ）
    const nicheZ = 0.66;   // 台座の前面（ローカル）
    const niche = new THREE.Mesh(
      G.holedWall({ w: 1.30, h: 0.86, holeW: 0.94, holeH: 0.70, holeY: 0.06, thick: 0.30 }),
      M.brick);
    niche.position.set(0, 0.06, nicheZ - 0.30);
    niche.castShadow = niche.receiveShadow = true;
    O.add(niche);
    const nicheBack = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), M.charcoal);
    nicheBack.position.set(0, 0.44, nicheZ - 0.40);
    nicheBack.receiveShadow = true;
    O.add(nicheBack);
    for (let row = 0; row < 4; row++) {
      for (let i = 0; i < 4; i++) {
        const r = 0.048 + (i % 2) * 0.007;
        const lg = new THREE.Mesh(G.log(r, 0.52, row * 7 + i), M.oakDark);
        lg.position.set(-0.27 + i * 0.18 + (row % 2) * 0.04, 0.12 + row * 0.108, nicheZ - 0.20);
        lg.rotation.y = Math.PI / 2;
        lg.castShadow = lg.receiveShadow = true;
        O.add(lg);
      }
    }

    // 炉床（耐火レンガ）
    const hearth = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.05, 44), M.hearthIn);
    hearth.position.set(0, L.hearthY + 0.005, 0);
    hearth.receiveShadow = true;
    O.add(hearth);
    S.hearth = hearth;

    // 内側のドーム（空洞）
    const inner = new THREE.Mesh(G.dome(L.domeInner, true, L.domeSquash), M.hearthWall);
    inner.position.set(0, L.hearthY + 0.03, 0);
    inner.receiveShadow = true;
    O.add(inner);

    // 外側のドーム
    const outer = new THREE.Mesh(G.dome(L.domeOuter, false, L.domeSquash), M.plasterDome);
    outer.position.set(0, L.hearthY - 0.01, 0);
    outer.castShadow = outer.receiveShadow = true;
    O.add(outer);
    // ドームの根元を隠す帯
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.955, 1.0, 0.10, 44, 1, true), M.plasterDome);
    skirt.position.set(0, L.hearthY + 0.03, 0);
    skirt.castShadow = skirt.receiveShadow = true;
    O.add(skirt);

    // 正面：ドームを切った断面（半円）に窯口をあける
    const cut = (L.faceZ - L.ovenZ);                 // 中心から手前へ
    const chord = Math.sqrt(Math.max(0.02, L.domeOuter * L.domeOuter - cut * cut));
    const faceW = chord * 2 * 0.99;
    const faceH = chord * L.domeSquash * 0.99;
    const face = new THREE.Mesh(
      G.holedWall({ w: faceW, h: faceH, outerArch: true, holeW: L.mouthW, holeH: L.mouthH, holeY: 0, thick: L.faceThick }),
      M.brick);
    face.position.set(0, L.hearthY + 0.03, cut - L.faceThick);
    face.castShadow = face.receiveShadow = true;
    O.add(face);
    S.ovenFace = face;

    // 窯口を囲むレンガのアーチ帯
    const band = new THREE.Mesh(
      G.archBand(L.mouthW + 0.02, L.mouthH + 0.01, 0.085, 0.05),
      M.hearth);
    band.position.set(0, L.hearthY + 0.03, cut - 0.002);
    band.castShadow = band.receiveShadow = true;
    O.add(band);

    // 窯口まわりのすす
    const sootMat = new THREE.MeshBasicMaterial({
      map: new THREE.CanvasTexture(T.sootAlpha()),
      transparent: true, depthWrite: false, opacity: 0.7
    });
    sootMat.map.encoding = THREE.sRGBEncoding;
    const soot = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.60), sootMat);
    soot.position.set(0, L.hearthY + 0.52, cut + 0.004);
    soot.renderOrder = 2;
    O.add(soot);

    // 飾りタイル帯（台座の縁）
    const rainbow = [0xf07ba0, 0xe8963c, 0xe3c246, 0x6fae5c, 0x5b9ec4, 0x9a82c0];
    for (let i = -6; i <= 6; i++) {
      const t = new THREE.Mesh(G.box(0.135, 0.105, 0.028, 0.010),
        new THREE.MeshStandardMaterial({
          color: rainbow[((i % 6) + 6) % 6], roughness: 0.14,
          metalness: 0.0, envMapIntensity: 0.9
        }));
      t.position.set(i * 0.148, L.hearthY - 0.085, nicheZ + 0.016);
      t.castShadow = true;
      O.add(t);
    }

    // 煙突
    const chim = new THREE.Mesh(G.box(0.26, 0.62, 0.26, 0.02), M.brick);
    chim.position.set(0.0, L.hearthY + 0.98, -0.30);
    chim.castShadow = chim.receiveShadow = true;
    O.add(chim);
    const cap = new THREE.Mesh(G.box(0.36, 0.06, 0.36, 0.012), M.brick);
    cap.position.set(0.0, L.hearthY + 1.32, -0.30);
    cap.castShadow = true;
    O.add(cap);

    /* ================== 作業台 ================== */
    const C = new THREE.Group();
    C.position.set(L.counterX, 0, L.counterZ);
    root.add(C);
    S.counter = C;

    const topH = 0.05;
    const top = new THREE.Mesh(G.box(L.counterW, topH, L.counterD + 0.05, 0.012), M.marble);
    top.position.set(0, L.counterY - topH / 2, 0);
    top.castShadow = top.receiveShadow = true;
    C.add(top);

    const body = new THREE.Mesh(G.box(L.counterW - 0.06, L.counterY - topH - 0.06, L.counterD - 0.06, 0.01), M.oak);
    body.position.set(0, (L.counterY - topH - 0.06) / 2 + 0.06, -0.01);
    body.castShadow = body.receiveShadow = true;
    C.add(body);

    // 扉と棚
    const doorW = 0.52, doorH = 0.56;
    for (let i = -3; i <= 2; i++) {
      const dx = i * 0.56 + 0.28;
      if (Math.abs(dx) > L.counterW / 2 - 0.34) continue;
      if (((i % 3) + 3) % 3 === 1) {
        // オープン棚：皿を積む
        const shelf = new THREE.Mesh(G.box(doorW, doorH, 0.06, 0.01), M.dark);
        shelf.position.set(dx, 0.46, L.counterD / 2 - 0.05);
        C.add(shelf);
        for (let k = 0; k < 6; k++) {
          const pl = new THREE.Mesh(G.plate(0.10, 0.012), k % 2 ? M.porcelain : M.porcelainPink);
          pl.position.set(dx - 0.12, 0.24 + k * 0.016, L.counterD / 2 - 0.10);
          pl.castShadow = true;
          C.add(pl);
        }
        for (let k = 0; k < 4; k++) {
          const pl = new THREE.Mesh(G.plate(0.085, 0.011), M.porcelain);
          pl.position.set(dx + 0.13, 0.24 + k * 0.015, L.counterD / 2 - 0.10);
          pl.castShadow = true;
          C.add(pl);
        }
      } else {
        const door = new THREE.Mesh(G.box(doorW, doorH, 0.035, 0.012), M.oakDark);
        door.position.set(dx, 0.46, L.counterD / 2 - 0.035);
        door.castShadow = door.receiveShadow = true;
        C.add(door);
        const knob = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10),
          new THREE.MeshStandardMaterial({ color: 0xf07fa8, roughness: 0.2, envMapIntensity: 0.7 }));
        knob.position.set(dx, 0.68, L.counterD / 2 - 0.012);
        knob.castShadow = true;
        C.add(knob);
      }
    }
    // 幅木
    const kick = new THREE.Mesh(G.box(L.counterW - 0.12, 0.09, L.counterD - 0.16, 0.008), M.charcoal);
    kick.position.set(0, 0.045, -0.02);
    C.add(kick);

    /* ================== 打ち粉の板 ================== */
    const boardG = new THREE.CylinderGeometry(L.boardR, L.boardR - 0.006, 0.028, 56);
    const board = new THREE.Mesh(boardG, M.birch);
    board.position.set(L.boardX, L.counterY + 0.014, L.boardZ);
    board.castShadow = board.receiveShadow = true;
    root.add(board);
    S.board = board;
    // 打ち粉
    const flourMat = new THREE.MeshStandardMaterial({
      map: new THREE.CanvasTexture(T.softDisc('255,255,255', 1.4)),
      transparent: true, opacity: 0.5, roughness: 1, depthWrite: false
    });
    const flourDecal = new THREE.Mesh(new THREE.CircleGeometry(L.boardR * 0.98, 40), flourMat);
    flourDecal.rotation.x = -Math.PI / 2;
    flourDecal.position.set(L.boardX, L.counterY + 0.0295, L.boardZ);
    flourDecal.renderOrder = 1;
    root.add(flourDecal);

    /* ================== 小道具 ================== */
    // 粉袋
    const sack = new THREE.Mesh(G.sack(0.28, 0.42, 0.22),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc4, roughness: 0.92, envMapIntensity: 0.3 }));
    sack.position.set(L.counterX - 1.42, L.counterY + 0.21, L.counterZ - 0.14);
    sack.castShadow = sack.receiveShadow = true;
    root.add(sack);
    const sackBand = new THREE.Mesh(new THREE.CylinderGeometry(0.152, 0.152, 0.09, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xef8fb4, roughness: 0.8, side: THREE.DoubleSide }));
    sackBand.position.set(L.counterX - 1.42, L.counterY + 0.26, L.counterZ - 0.14);
    root.add(sackBand);

    // トマトのかご
    const basket = new THREE.Mesh(G.bowl(0.16, 0.11, 0.10),
      new THREE.MeshStandardMaterial({ color: 0xb98a52, roughness: 0.85, envMapIntensity: 0.3 }));
    basket.position.set(L.counterX + 1.52, L.counterY, L.counterZ - 0.14);
    basket.castShadow = basket.receiveShadow = true;
    root.add(basket);
    const tomatoMat = new THREE.MeshStandardMaterial({ color: 0xcf3a2b, roughness: 0.32, envMapIntensity: 0.6 });
    for (let i = 0; i < 7; i++) {
      const a = i * 2.1;
      const t = new THREE.Mesh(new THREE.SphereGeometry(0.036, 16, 12), tomatoMat);
      t.position.set(L.counterX + 1.52 + Math.cos(a) * 0.07, L.counterY + 0.085 + (i % 2) * 0.03,
        L.counterZ - 0.14 + Math.sin(a) * 0.06);
      t.scale.set(1, 0.88, 1);
      t.castShadow = true;
      root.add(t);
    }

    // オリーブオイルの瓶
    const bottle = new THREE.Mesh(
      new THREE.LatheGeometry([
        new THREE.Vector2(0.001, 0), new THREE.Vector2(0.042, 0), new THREE.Vector2(0.045, 0.02),
        new THREE.Vector2(0.045, 0.15), new THREE.Vector2(0.018, 0.20), new THREE.Vector2(0.016, 0.28),
        new THREE.Vector2(0.001, 0.285)
      ], 24), M.glass);
    bottle.position.set(L.counterX - 1.05, L.counterY, L.counterZ - 0.18);
    bottle.castShadow = true;
    root.add(bottle);

    /* ================== 職人 ================== */
    S.chef = buildChef(M);
    S.chef.group.position.set(L.chefX, 0, L.chefZ);
    S.chef.group.rotation.y = 0.28;
    root.add(S.chef.group);

    /* ================== ピール ================== */
    const peel = new THREE.Group();
    const bladeR = 0.185;
    const blade = new THREE.Mesh(G.peelBlade(bladeR, 0.009), M.birch);
    blade.castShadow = blade.receiveShadow = true;
    peel.add(blade);
    const handleLen = 1.45;
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.020, handleLen, 14), M.birch);
    handle.rotation.x = Math.PI / 2;
    handle.position.set(0, 0.006, bladeR * 0.82 + handleLen / 2);
    handle.castShadow = true;
    peel.add(handle);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.34, 16),
      new THREE.MeshStandardMaterial({ color: 0xe4759f, roughness: 0.55, envMapIntensity: 0.6 }));
    grip.rotation.x = Math.PI / 2;
    grip.position.set(0, 0.006, bladeR * 0.82 + handleLen - 0.30);
    grip.castShadow = true;
    peel.add(grip);
    const knobEnd = new THREE.Mesh(new THREE.SphereGeometry(0.026, 14, 10), M.birch);
    knobEnd.position.set(0, 0.006, bladeR * 0.82 + handleLen);
    peel.add(knobEnd);
    peel.visible = false;
    root.add(peel);
    S.peel = peel;
    S.peelBladeR = bladeR;
    S.peelGripZ = bladeR * 0.82 + handleLen - 0.30;

    /* ================== 具材の器 ================== */
    S.bowls = [];

    /* ================== 皿（できあがり用） ================== */
    const servePlate = new THREE.Mesh(G.plate(0.21, 0.028), M.porcelainPink);
    servePlate.castShadow = servePlate.receiveShadow = true;
    servePlate.visible = false;
    root.add(servePlate);
    S.servePlate = servePlate;

    return root;
  };

  /* ================================================================
     職人（大人・1.72m）
  ================================================================ */
  function buildChef(M) {
    const g = new THREE.Group();
    const H = 1.72;

    // 脚
    const legMat = new THREE.MeshStandardMaterial({ color: 0x3c4450, roughness: 0.9 });
    for (let s = -1; s <= 1; s += 2) {
      const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.66, 6, 14), legMat);
      leg.position.set(s * 0.11, 0.42, 0);
      leg.castShadow = true;
      g.add(leg);
      const shoe = new THREE.Mesh(G.box(0.11, 0.07, 0.24, 0.03), M.charcoal);
      shoe.position.set(s * 0.11, 0.035, 0.04);
      shoe.castShadow = true;
      g.add(shoe);
    }

    // 胴（コックコート）
    const torsoPts = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      const y = t * 0.62;
      const r = 0.19 + Math.sin(t * Math.PI) * 0.035 - t * 0.02;
      torsoPts.push(new THREE.Vector2(r, y));
    }
    const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPts, 28), M.coat);
    torso.position.y = 0.74;
    torso.scale.z = 0.78;
    torso.castShadow = torso.receiveShadow = true;
    g.add(torso);

    // エプロン
    const apron = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.225, 0.52, 24, 1, true), M.apron);
    apron.position.set(0, 0.86, 0.02);
    apron.scale.z = 0.8;
    apron.material.side = THREE.DoubleSide;
    apron.castShadow = true;
    g.add(apron);
    const apronStrap = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 24, Math.PI), M.apron);
    apronStrap.position.set(0, 1.30, 0.0);
    apronStrap.rotation.x = Math.PI / 2;
    apronStrap.rotation.z = Math.PI;
    g.add(apronStrap);

    // 首と頭
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.08, 14), M.skin);
    neck.position.y = 1.40;
    g.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.108, 24, 18), M.skin);
    head.position.y = 1.52;
    head.scale.set(1, 1.06, 0.94);
    head.castShadow = true;
    g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.112, 22, 16, 0, TAU, 0, Math.PI * 0.55), M.hair);
    hair.position.y = 1.525;
    hair.scale.set(1, 1.02, 0.96);
    g.add(hair);
    // 目と口
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x2a1a14, roughness: 0.4 });
    for (let s = -1; s <= 1; s += 2) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), eyeMat);
      e.position.set(s * 0.038, 1.535, 0.098);
      g.add(e);
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8),
        new THREE.MeshStandardMaterial({ color: 0xe89a92, roughness: 0.9, transparent: true, opacity: 0.55 }));
      cheek.position.set(s * 0.062, 1.512, 0.086);
      cheek.scale.set(1, 0.7, 0.4);
      g.add(cheek);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.005, 6, 14, Math.PI), eyeMat);
    mouth.position.set(0, 1.508, 0.098);
    mouth.rotation.z = Math.PI;
    g.add(mouth);

    // コック帽
    const hatBand = new THREE.Mesh(new THREE.CylinderGeometry(0.114, 0.114, 0.055, 22), M.coat);
    hatBand.position.y = 1.625;
    hatBand.castShadow = true;
    g.add(hatBand);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.116, 0.116, 0.022, 22), M.apron);
    band.position.y = 1.618;
    g.add(band);
    const puff = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), M.coat);
      s.position.set(Math.cos(a) * 0.055, 1.685 + (i % 2) * 0.012, Math.sin(a) * 0.05);
      s.castShadow = true;
      puff.add(s);
    }
    const top = new THREE.Mesh(new THREE.SphereGeometry(0.072, 18, 14), M.coat);
    top.position.set(0, 1.706, 0);
    top.castShadow = true;
    puff.add(top);
    g.add(puff);

    // 腕（2 関節）
    function arm(side) {
      const grp = new THREE.Group();
      const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.24, 5, 12), M.coat);
      upper.castShadow = true;
      const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.22, 5, 12), M.coat);
      fore.castShadow = true;
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.052, 14, 10), M.skin);
      hand.scale.set(1, 0.82, 0.7);
      hand.castShadow = true;
      grp.add(upper); grp.add(fore); grp.add(hand);
      return { grp: grp, upper: upper, fore: fore, hand: hand, side: side };
    }
    const armL = arm(-1), armR = arm(1);
    g.add(armL.grp); g.add(armR.grp);

    return {
      group: g, armL: armL, armR: armR,
      shoulderL: new THREE.Vector3(-0.20, 1.30, 0.0),
      shoulderR: new THREE.Vector3(0.20, 1.30, 0.0),
      upperLen: 0.29, foreLen: 0.27,
      height: H
    };
  }

  /* 2 関節 IK：肩から手先へ腕を向ける */
  const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
  const _q = new THREE.Quaternion(), _up = new THREE.Vector3(0, 1, 0);
  S.solveArm = function (chef, a, shoulderLocal, targetWorld, poleSign) {
    const grp = chef.group;
    // 手先を職人ローカル座標へ
    _v1.copy(targetWorld);
    grp.worldToLocal(_v1);
    const l1 = chef.upperLen, l2 = chef.foreLen;
    _v2.copy(_v1).sub(shoulderLocal);
    let d = _v2.length();
    const maxd = (l1 + l2) * 0.995;
    if (d > maxd) { _v2.multiplyScalar(maxd / d); d = maxd; }
    if (d < 0.02) { _v2.set(0, -0.02, 0); d = 0.02; }
    const cosA = U.clamp((d * d + l1 * l1 - l2 * l2) / (2 * d * l1), -1, 1);
    const bend = Math.acos(cosA);
    // 肘を外側へ張る
    const dir = _v2.clone().normalize();
    let axis = _v3.copy(dir).cross(_up);
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0);
    axis.normalize().multiplyScalar(poleSign);
    const upperDir = dir.clone().applyAxisAngle(axis, bend);
    const elbow = shoulderLocal.clone().addScaledVector(upperDir, l1);
    const hand = shoulderLocal.clone().add(_v2);

    place(a.upper, shoulderLocal, elbow);
    place(a.fore, elbow, hand);
    a.hand.position.copy(hand);
    return hand;
  };

  function place(mesh, from, to) {
    mesh.position.copy(from).add(to).multiplyScalar(0.5);
    const dir = _v3.copy(to).sub(from);
    const len = dir.length();
    dir.normalize();
    _q.setFromUnitVectors(_up, dir);
    mesh.quaternion.copy(_q);
    mesh.scale.y = Math.max(0.2, len / (mesh.geometry.parameters.length + mesh.geometry.parameters.radius * 2));
  }

})();
