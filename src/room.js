// 部屋・家具・窓外レイヤーの構築（古い状態⇄新しい状態の切替を持つ）
import * as THREE from 'three';
import * as TX from './textures.js';

export const ROOM = {
  W: 4.4, H: 2.6, D: 3.8,
  backZ: -1.9, leftX: -2.2, rightX: 2.2, frontZ: 1.9,
};

// 窓（左壁）
export const WIN = { z0: -1.25, z1: 0.05, y0: 0.85, y1: 2.05 };

function box(w, h, d, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}

export function buildRoom(scene) {
  const R = {};
  const root = new THREE.Group();
  scene.add(root);
  R.root = root;

  // ---- テクスチャ ----
  const texOldFloor = TX.oldFloorTexture();
  const texNewFloor = TX.newFloorTexture();
  const texOldCeil = TX.ceilingTexture(true);
  const texNewCeil = TX.ceilingTexture(false);
  const texOldWood = TX.woodTexture(true);
  const texNewWood = TX.woodTexture(false);
  const texOldSofa = TX.sofaTexture(true);
  const texNewSofa = TX.sofaTexture(false);
  R.texOldWallpaper = TX.oldWallpaperTexture();
  R.texWallpaperBack = TX.wallpaperBackTexture();

  // ---- 床 ----
  const floorMat = new THREE.MeshStandardMaterial({ map: texOldFloor, roughness: 0.92, metalness: 0 });
  const floor = box(ROOM.W, 0.12, ROOM.D, floorMat);
  floor.position.set(0, -0.06, 0);
  floor.receiveShadow = true;
  root.add(floor);
  R.floor = floor;
  R.swapFloor = () => {
    floorMat.map = texNewFloor;
    floorMat.roughness = 0.45;
    floorMat.needsUpdate = true;
  };

  // ---- 天井 ----
  const ceilMat = new THREE.MeshStandardMaterial({ map: texOldCeil, roughness: 1 });
  const ceil = box(ROOM.W, 0.12, ROOM.D, ceilMat);
  ceil.position.set(0, ROOM.H + 0.06, 0);
  root.add(ceil);
  R.swapCeil = () => { ceilMat.map = texNewCeil; ceilMat.needsUpdate = true; };

  // ---- 壁（側面は無地の古い漆喰、正面はペイントキャンバス） ----
  const oldSideMat = new THREE.MeshStandardMaterial({ color: 0x8f8471, roughness: 0.95 });
  const newSideMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  R.newSideMat = newSideMat;

  // 奥の壁（躯体）
  const backWall = box(ROOM.W, ROOM.H, 0.15, oldSideMat);
  backWall.position.set(0, ROOM.H / 2, ROOM.backZ - 0.075);
  root.add(backWall);

  // 奥の壁の表面 = ペイント用キャンバス
  const pc = document.createElement('canvas');
  pc.width = 1024; pc.height = 640;
  const pg = pc.getContext('2d');
  TX.drawPlaster(pg, pc.width, pc.height);
  const paintTexture = new THREE.CanvasTexture(pc);
  paintTexture.colorSpace = THREE.SRGBColorSpace;
  paintTexture.anisotropy = 4;
  const paintMat = new THREE.MeshStandardMaterial({ map: paintTexture, roughness: 0.9 });
  const paintPlane = new THREE.Mesh(new THREE.PlaneGeometry(ROOM.W, ROOM.H), paintMat);
  paintPlane.position.set(0, ROOM.H / 2, ROOM.backZ + 0.004);
  paintPlane.receiveShadow = true;
  root.add(paintPlane);
  R.paintCanvas = pc; R.paintCtx = pg; R.paintTexture = paintTexture;
  R.paintPlane = paintPlane;
  R.paintMat = paintMat;

  // 右の壁
  const rightWall = box(0.15, ROOM.H, ROOM.D, oldSideMat.clone());
  rightWall.position.set(ROOM.rightX + 0.075, ROOM.H / 2, 0);
  root.add(rightWall);
  R.rightWall = rightWall;

  // 左の壁（窓の開口をあけて4分割）
  const lw = [];
  const lwMat = oldSideMat.clone();
  {
    const t = 0.15, x = ROOM.leftX - t / 2;
    // 窓の下
    let m = box(t, WIN.y0, WIN.z1 - WIN.z0, lwMat);
    m.position.set(x, WIN.y0 / 2, (WIN.z0 + WIN.z1) / 2);
    lw.push(m);
    // 窓の上
    m = box(t, ROOM.H - WIN.y1, WIN.z1 - WIN.z0, lwMat);
    m.position.set(x, (ROOM.H + WIN.y1) / 2, (WIN.z0 + WIN.z1) / 2);
    lw.push(m);
    // 窓より奥
    m = box(t, ROOM.H, WIN.z0 - (-ROOM.D / 2), lwMat);
    m.position.set(x, ROOM.H / 2, (WIN.z0 + (-ROOM.D / 2)) / 2);
    lw.push(m);
    // 窓より手前
    m = box(t, ROOM.H, ROOM.D / 2 - WIN.z1, lwMat);
    m.position.set(x, ROOM.H / 2, (WIN.z1 + ROOM.D / 2) / 2);
    lw.push(m);
    lw.forEach(w => root.add(w));
  }
  R.leftWallMat = lwMat;
  R.swapWalls = (colorHex) => {
    // 選んだペンキ色を少し淡くして側面の壁に
    const c = new THREE.Color(colorHex).lerp(new THREE.Color(0xffffff), 0.35);
    lwMat.color.copy(c); lwMat.roughness = 0.85;
    rightWall.material.color.copy(c); rightWall.material.roughness = 0.85;
    oldSideMat.color.copy(c);
  };

  // ---- 巾木（古い＝濃い茶 → 新しい＝白） ----
  const skirtMat = new THREE.MeshStandardMaterial({ color: 0x3d2c1e, roughness: 0.8 });
  const skirts = [];
  const mkSkirt = (w, d, x, z) => {
    const s = box(w, 0.11, d, skirtMat);
    s.position.set(x, 0.055, z);
    skirts.push(s); root.add(s);
  };
  mkSkirt(ROOM.W, 0.03, 0, ROOM.backZ + 0.015);
  mkSkirt(0.03, ROOM.D, ROOM.leftX + 0.015, 0);
  mkSkirt(0.03, ROOM.D, ROOM.rightX - 0.015, 0);
  R.swapSkirt = () => { skirtMat.color.set(0xf7f3ec); skirtMat.roughness = 0.5; };

  // ---- 窓枠・ガラス・外の景色 ----
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x7a7263, roughness: 0.8 });
  const frameG = new THREE.Group();
  {
    const t = 0.07, depth = 0.18, x = ROOM.leftX - 0.02;
    const zc = (WIN.z0 + WIN.z1) / 2, yc = (WIN.y0 + WIN.y1) / 2;
    const zw = WIN.z1 - WIN.z0, yh = WIN.y1 - WIN.y0;
    const top = box(depth, t, zw + t * 2, frameMat); top.position.set(x, WIN.y1 + t / 2, zc);
    const bot = box(depth, t, zw + t * 2, frameMat); bot.position.set(x, WIN.y0 - t / 2, zc);
    const s1 = box(depth, yh, t, frameMat); s1.position.set(x, yc, WIN.z0 - t / 2);
    const s2 = box(depth, yh, t, frameMat); s2.position.set(x, yc, WIN.z1 + t / 2);
    const mull = box(depth * 0.6, yh, 0.035, frameMat); mull.position.set(x, yc, zc);
    const mull2 = box(depth * 0.6, 0.035, zw, frameMat); mull2.position.set(x, yc, zc);
    // 窓台（部屋側に少し出っぱる）
    const sill = box(0.26, 0.045, zw + 0.3, frameMat); sill.position.set(ROOM.leftX + 0.05, WIN.y0 - t - 0.02, zc);
    frameG.add(top, bot, s1, s2, mull, mull2, sill);
    // ガラス
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(zw, yh),
      new THREE.MeshPhysicalMaterial({
        color: 0xcfe4ee, transparent: true, opacity: 0.18, roughness: 0.15, metalness: 0,
        side: THREE.DoubleSide,
      })
    );
    glass.rotation.y = Math.PI / 2;
    glass.position.set(ROOM.leftX - 0.1, yc, zc);
    frameG.add(glass);
  }
  root.add(frameG);
  R.swapWindowFrame = () => { frameMat.color.set(0xfbf8f2); frameMat.roughness = 0.4; };

  // 外の景色：空・丘・木（視差と空気遠近のレイヤー）
  {
    const sky = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 9),
      new THREE.MeshBasicMaterial({ map: TX.skyTexture(), fog: false })
    );
    sky.rotation.y = Math.PI / 2;
    sky.position.set(-9.5, 3.2, -0.6);
    root.add(sky);

    const hills = new THREE.Mesh(
      new THREE.PlaneGeometry(11, 5.5),
      new THREE.MeshBasicMaterial({ map: TX.hillsTexture(), transparent: true })
    );
    hills.rotation.y = Math.PI / 2;
    hills.position.set(-7, 1.6, -0.6);
    root.add(hills);

    const tree = new THREE.Mesh(
      new THREE.PlaneGeometry(1.9, 3.8),
      new THREE.MeshBasicMaterial({ map: TX.treeTexture(), transparent: true })
    );
    tree.rotation.y = Math.PI / 2;
    tree.position.set(-3.6, 1.7, -0.75);
    root.add(tree);
    R.outdoor = { sky, hills, tree };
  }

  // ---- 家具 ----
  R.furniture = {};
  const legWoodMat = new THREE.MeshStandardMaterial({ map: texOldWood, roughness: 0.7 });

  // ソファ
  {
    const g = new THREE.Group();
    const fabric = new THREE.MeshStandardMaterial({ map: texOldSofa, roughness: 0.95 });
    const base = box(1.7, 0.34, 0.8, fabric); base.position.set(0, 0.29, 0);
    const back = box(1.7, 0.72, 0.2, fabric); back.position.set(0, 0.62, -0.3);
    const armL = box(0.2, 0.6, 0.8, fabric); armL.position.set(-0.75, 0.5, 0);
    const armR = box(0.2, 0.6, 0.8, fabric); armR.position.set(0.75, 0.5, 0);
    const cushGeo = new THREE.BoxGeometry(0.6, 0.16, 0.56, 2, 2, 2);
    const c1 = new THREE.Mesh(cushGeo, fabric); c1.position.set(-0.32, 0.54, 0.06);
    const c2 = new THREE.Mesh(cushGeo, fabric); c2.position.set(0.33, 0.54, 0.06);
    const bc1 = box(0.6, 0.44, 0.14, fabric); bc1.position.set(-0.32, 0.85, -0.16); bc1.rotation.x = -0.12;
    const bc2 = box(0.6, 0.44, 0.14, fabric); bc2.position.set(0.33, 0.85, -0.16); bc2.rotation.x = -0.12;
    g.add(base, back, armL, armR, c1, c2, bc1, bc2);
    for (const [lx, lz] of [[-0.78, 0.33], [0.78, 0.33], [-0.78, -0.33], [0.78, -0.33]]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.028, 0.14, 8), legWoodMat);
      leg.position.set(lx, 0.06, lz);
      g.add(leg);
    }
    g.position.set(-1.05, 0, -1.0);
    g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    root.add(g);
    R.furniture.sofa = g;
    R.swapSofa = () => { fabric.map = texNewSofa; fabric.needsUpdate = true; };
    // ぬいぐるみのくま（新しい部屋にだけ登場）
    const bear = new THREE.Group();
    const bearMat = new THREE.MeshStandardMaterial({ color: 0xc98d4f, roughness: 0.95 });
    const bearBelly = new THREE.MeshStandardMaterial({ color: 0xe8c493, roughness: 0.95 });
    const b1 = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 12), bearMat); b1.position.y = 0.12; b1.scale.y = 1.15;
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), bearBelly); belly.position.set(0, 0.11, 0.075);
    const b2 = new THREE.Mesh(new THREE.SphereGeometry(0.095, 14, 12), bearMat); b2.position.y = 0.31;
    const muzzle = new THREE.Mesh(new THREE.SphereGeometry(0.042, 10, 8), bearBelly); muzzle.position.set(0, 0.285, 0.08);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a })); nose.position.set(0, 0.295, 0.115);
    const e1 = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), bearMat); e1.position.set(-0.075, 0.39, 0);
    const e2 = e1.clone(); e2.position.x = 0.075;
    const a1 = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), bearMat); a1.position.set(-0.13, 0.16, 0.05); a1.scale.set(1, 1.6, 1); a1.rotation.z = 0.5;
    const a2 = a1.clone(); a2.position.x = 0.13; a2.rotation.z = -0.5;
    const l1 = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), bearMat); l1.position.set(-0.085, 0.045, 0.1); l1.scale.set(1, 0.8, 1.5);
    const l2 = l1.clone(); l2.position.x = 0.085;
    bear.add(b1, belly, b2, muzzle, nose, e1, e2, a1, a2, l1, l2);
    bear.position.set(-1.37, 0.62, -0.95);
    bear.rotation.y = 0.35;
    bear.visible = false;
    root.add(bear);
    R.bear = bear;
  }

  // 丸テーブル
  {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: texOldWood, roughness: 0.75 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 28), woodMat);
    top.position.y = 0.71;
    g.add(top);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.024, 0.69, 8), woodMat);
      leg.position.set(Math.cos(a) * 0.3, 0.345, Math.sin(a) * 0.3);
      leg.rotation.z = Math.cos(a) * -0.09;
      leg.rotation.x = Math.sin(a) * 0.09;
      g.add(leg);
    }
    g.position.set(1.05, 0, -0.75);
    g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    root.add(g);
    R.furniture.table = g;
    R.swapTable = () => { woodMat.map = texNewWood; woodMat.roughness = 0.4; woodMat.needsUpdate = true; };
    // 花びん（新しい部屋にだけ登場）
    const flowers = new THREE.Group();
    const vase = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.07, 0.16, 12),
      new THREE.MeshStandardMaterial({ color: 0x9fd8d4, roughness: 0.3 })
    );
    vase.position.y = 0.08;
    flowers.add(vase);
    const petalCols = [0xff8fa3, 0xffd166, 0xc9a7eb];
    for (let i = 0; i < 3; i++) {
      const stem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.006, 0.2, 6),
        new THREE.MeshStandardMaterial({ color: 0x4e8a4e })
      );
      stem.position.set((i - 1) * 0.035, 0.22, (i % 2) * 0.03 - 0.015);
      stem.rotation.z = (i - 1) * 0.25;
      const head = new THREE.Group();
      for (let p = 0; p < 6; p++) {
        const a = (p / 6) * Math.PI * 2;
        const petal = new THREE.Mesh(
          new THREE.SphereGeometry(0.02, 8, 6),
          new THREE.MeshStandardMaterial({ color: petalCols[i] })
        );
        petal.position.set(Math.cos(a) * 0.026, 0, Math.sin(a) * 0.026);
        petal.scale.set(1.2, 0.6, 1.2);
        head.add(petal);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.015, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfff1b8 }));
      head.add(core);
      head.position.set((i - 1) * 0.085, 0.33, (i % 2) * 0.05 - 0.025);
      flowers.add(stem, head);
    }
    flowers.position.set(1.05, 0.735, -0.75);
    flowers.visible = false;
    root.add(flowers);
    R.flowers = flowers;
  }

  // 棚（右の壁ぎわ）
  {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: texOldWood, roughness: 0.8 });
    const side1 = box(0.26, 1.1, 0.05, woodMat); side1.position.set(0, 0.55, -0.36);
    const side2 = box(0.26, 1.1, 0.05, woodMat); side2.position.set(0, 0.55, 0.36);
    g.add(side1, side2);
    for (let s = 0; s < 3; s++) {
      const sh = box(0.26, 0.04, 0.77, woodMat);
      sh.position.set(0, 0.18 + s * 0.42, 0);
      g.add(sh);
    }
    // 本（古い＝くすんだ色 / 新しいおもちゃは別グループ）
    const oldBookCols = [0x5a4a3a, 0x4a4a52, 0x5f5648, 0x474038];
    const newBookCols = [0xef6f81, 0x59b0e0, 0xffc94d, 0x8fc978, 0xb894e0];
    const oldBooks = new THREE.Group();
    const newToys = new THREE.Group();
    for (let s = 0; s < 2; s++) {
      for (let i = 0; i < 5; i++) {
        const bh = 0.2 + (i % 3) * 0.03;
        const b = box(0.16, bh, 0.045, new THREE.MeshStandardMaterial({ color: oldBookCols[(i + s) % 4], roughness: 0.9 }));
        b.position.set(0, 0.2 + s * 0.42 + bh / 2, -0.25 + i * 0.09);
        b.rotation.x = (i === 4 && s === 0) ? 0.5 : 0;
        oldBooks.add(b);
        const nb = box(0.16, bh, 0.05, new THREE.MeshStandardMaterial({ color: newBookCols[(i + s) % 5], roughness: 0.6 }));
        nb.position.copy(b.position);
        newToys.add(nb);
      }
    }
    // おもちゃのボール・つみき
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 12), new THREE.MeshStandardMaterial({ color: 0xef6f81, roughness: 0.4 }));
    ball.position.set(0, 1.09, 0.16);
    const blockA = box(0.09, 0.09, 0.09, new THREE.MeshStandardMaterial({ color: 0x59b0e0, roughness: 0.5 }));
    blockA.position.set(0, 1.065, -0.12);
    blockA.rotation.y = 0.4;
    const blockB = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.1, 4), new THREE.MeshStandardMaterial({ color: 0xffc94d, roughness: 0.5 }));
    blockB.position.set(0, 1.16, -0.12);
    blockB.rotation.y = 0.4;
    newToys.add(ball, blockA, blockB);
    newToys.visible = false;
    g.add(oldBooks, newToys);
    g.position.set(1.98, 0, 0.55);
    g.traverse(o => { o.castShadow = true; o.receiveShadow = true; });
    root.add(g);
    R.furniture.shelf = g;
    R.swapShelf = () => {
      woodMat.map = texNewWood; woodMat.roughness = 0.45; woodMat.needsUpdate = true;
      oldBooks.visible = false; newToys.visible = true;
    };
  }

  // 接地感：家具の下の落ち影（柔らかい円）
  {
    const c = document.createElement('canvas');
    c.width = 128; c.height = 128;
    const g2 = c.getContext('2d');
    const gr = g2.createRadialGradient(64, 64, 6, 64, 64, 62);
    gr.addColorStop(0, 'rgba(0,0,0,0.45)');
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gr;
    g2.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(c);
    const mkBlob = (x, z, sx, sz) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(sx, sz),
        new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.85 })
      );
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, 0.008, z);
      m.renderOrder = 1;
      root.add(m);
    };
    mkBlob(-1.05, -1.0, 2.1, 1.25);
    mkBlob(1.05, -0.75, 1.1, 1.1);
    mkBlob(1.95, 0.55, 0.55, 1.0);
  }

  // ---- 古い照明（裸電球） / 新しいペンダントライト ----
  {
    const g = new THREE.Group();
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.45, 6),
      new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cord.position.y = -0.225;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xcf9d43, emissiveIntensity: 0.8, roughness: 0.3 }));
    bulb.position.y = -0.5;
    const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.06, 8),
      new THREE.MeshStandardMaterial({ color: 0x554433 }));
    socket.position.y = -0.44;
    g.add(cord, bulb, socket);
    g.position.set(0, ROOM.H, -0.3);
    root.add(g);
    R.oldLamp = g;

    // 新しいペンダント（LIGHTフェーズで取り付け）
    const ng = new THREE.Group();
    const ncord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 6),
      new THREE.MeshStandardMaterial({ color: 0xf7f3ec }));
    ncord.position.y = -0.25;
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.22, 24, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf8b8c4, roughness: 0.5, side: THREE.DoubleSide }));
    shade.position.y = -0.56;
    const nbulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 12),
      new THREE.MeshStandardMaterial({ color: 0xfff6dd, emissive: 0xffdf9e, emissiveIntensity: 0.0, roughness: 0.3 }));
    nbulb.position.y = -0.62;
    ng.add(ncord, shade, nbulb);
    ng.position.set(0, ROOM.H, -0.3);
    ng.visible = false;
    root.add(ng);
    R.newLamp = ng;
    R.newLampBulbMat = nbulb.material;
    R.newLampShade = shade;
  }

  // ---- カーテン（古い1枚 / 新しい2枚＋レール） ----
  {
    const oldCur = new THREE.Mesh(
      wavyPanelGeometry(0.72, 1.5, 5),
      new THREE.MeshStandardMaterial({ map: TX.curtainTexture(true), roughness: 1, side: THREE.DoubleSide })
    );
    oldCur.rotation.y = Math.PI / 2;
    oldCur.position.set(ROOM.leftX + 0.09, (WIN.y0 + WIN.y1) / 2 + 0.16, WIN.z0 + 0.3);
    root.add(oldCur);
    R.oldCurtain = oldCur;

    const ng = new THREE.Group();
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, WIN.z1 - WIN.z0 + 0.55, 10),
      new THREE.MeshStandardMaterial({ color: 0xd9c8a8, roughness: 0.35, metalness: 0.4 }));
    rod.rotation.x = Math.PI / 2;
    rod.position.set(ROOM.leftX + 0.12, WIN.y1 + 0.18, (WIN.z0 + WIN.z1) / 2);
    const knob1 = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), rod.material);
    knob1.position.set(ROOM.leftX + 0.12, WIN.y1 + 0.18, WIN.z0 - 0.29);
    const knob2 = knob1.clone(); knob2.position.z = WIN.z1 + 0.29;
    const curMat = new THREE.MeshStandardMaterial({ map: TX.curtainTexture(false), roughness: 0.9, side: THREE.DoubleSide });
    const p1 = new THREE.Mesh(wavyPanelGeometry(0.5, 1.46, 6), curMat);
    p1.rotation.y = Math.PI / 2;
    p1.position.set(ROOM.leftX + 0.12, WIN.y1 + 0.16 - 0.73, WIN.z0 - 0.04);
    const p2 = new THREE.Mesh(wavyPanelGeometry(0.5, 1.46, 6), curMat);
    p2.rotation.y = Math.PI / 2;
    p2.position.set(ROOM.leftX + 0.12, WIN.y1 + 0.16 - 0.73, WIN.z1 + 0.04);
    ng.add(rod, knob1, knob2, p1, p2);
    ng.visible = false;
    root.add(ng);
    R.newCurtain = ng;
    R.newCurtainPanels = [p1, p2];
  }

  // ---- 近景の小道具：脚立・ペンキ缶・シートの山・道具箱 ----
  {
    const ladder = new THREE.Group();
    const alMat = new THREE.MeshStandardMaterial({ color: 0x9aa3ab, roughness: 0.45, metalness: 0.55 });
    for (const side of [-1, 1]) {
      const rail1 = box(0.045, 1.25, 0.045, alMat);
      rail1.position.set(side * 0.21, 0.6, 0.16);
      rail1.rotation.x = -0.22;
      const rail2 = box(0.045, 1.25, 0.045, alMat);
      rail2.position.set(side * 0.21, 0.6, -0.16);
      rail2.rotation.x = 0.22;
      ladder.add(rail1, rail2);
    }
    for (let s = 0; s < 4; s++) {
      const st = box(0.4, 0.03, 0.09, alMat);
      const y = 0.18 + s * 0.3;
      st.position.set(0, y, 0.16 + (0.6 - y) * 0.22);
      ladder.add(st);
    }
    const topCap = box(0.46, 0.04, 0.14, alMat);
    topCap.position.set(0, 1.17, 0);
    ladder.add(topCap);
    ladder.position.set(-1.72, 0, 1.25);
    ladder.rotation.y = 0.5;
    ladder.traverse(o => { o.castShadow = true; });
    root.add(ladder);
    R.ladder = ladder;

    // ペンキ缶（色選びに使う3つ）
    R.buckets = [];
    const bucketCols = [0xf6a8b8, 0x9fd8c4, 0x9ec7ea];
    for (let i = 0; i < 3; i++) {
      const bg = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.12, 0.2, 18),
        new THREE.MeshStandardMaterial({ color: 0xd8d8d8, roughness: 0.35, metalness: 0.6 }));
      can.position.y = 0.1;
      const label = new THREE.Mesh(new THREE.CylinderGeometry(0.131, 0.121, 0.12, 18),
        new THREE.MeshStandardMaterial({ color: bucketCols[i], roughness: 0.5 }));
      label.position.y = 0.1;
      const paintTop = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.012, 18),
        new THREE.MeshStandardMaterial({ color: bucketCols[i], roughness: 0.25 }));
      paintTop.position.y = 0.205;
      const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.02, 18), can.material);
      lid.position.y = 0.215;
      bg.add(can, label, paintTop, lid);
      bg.position.set(1.25 + (i % 2) * 0.32, 0, 1.3 + i * 0.17);
      bg.userData.color = bucketCols[i];
      bg.userData.lid = lid;
      bg.traverse(o => { o.castShadow = true; });
      root.add(bg);
      R.buckets.push(bg);
    }

    // たたんだシートの山
    const stack = new THREE.Group();
    const shMat = new THREE.MeshStandardMaterial({ color: 0xeef0f2, roughness: 0.9 });
    for (let i = 0; i < 4; i++) {
      const b = box(0.42 - i * 0.02, 0.05, 0.34 - i * 0.02, shMat);
      b.position.y = 0.03 + i * 0.052;
      b.rotation.y = (i % 2) * 0.18 - 0.09;
      stack.add(b);
    }
    stack.position.set(-0.45, 0, 1.42);
    stack.traverse(o => { o.castShadow = true; });
    root.add(stack);
    R.sheetStack = stack;
  }

  return R;
}

// 波打つカーテンパネル
function wavyPanelGeometry(w, h, waves) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 4);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const amp = 0.045 * (0.5 + 0.5 * (1 - (y / h + 0.5) * 0.4));
    pos.setZ(i, Math.sin((x / w) * Math.PI * waves) * amp);
  }
  geo.computeVertexNormals();
  return geo;
}
