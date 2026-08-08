/* =========================================================
   bakery.js — 実寸のパン屋の作業場（すべてメートル）
   近景：作業台の手前の縁・道具・垂れた布
   中景：クーシュとバゲット・石窯
   遠景：奥の壁・棚・窓。空気遠近はフォグで。
   ========================================================= */
import * as THREE from 'three';
import { woodMaps, linenMaps, brickMaps, plasterMaps, ironMaps, heightToNormal } from './textures.js';

/* 実寸のメモ
   床 y=0 / 作業台の天板上面 y=0.92 / 天井 y=3.0
   石窯の前面 z=-1.72 / 炉口 幅1.02 高0.44 中心 y=1.06
   奥の壁 z=-4.4 */
export const WORLD = {
  benchTop: 0.92,
  benchW: 2.30, benchD: 0.98, benchTh: 0.065,
  ovenFront: -2.85,
  mouthW: 1.34, mouthH: 0.60, mouthY: 1.25,
  deckY: 0.96,
  ovenDepth: 1.15,
};

function rrShape(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/* 面取りされた箱（角が立っていないと安っぽく見える） */
export function chamferBox(w, h, d, bevel = 0.006, curveSeg = 2) {
  const g = new THREE.ExtrudeGeometry(rrShape(w, h, Math.min(bevel * 3, w / 2, h / 2)), {
    depth: Math.max(0.001, d - bevel * 2),
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
    bevelSegments: curveSeg, curveSegments: 4,
  });
  g.translate(0, 0, -(d - bevel * 2) / 2);
  g.computeVertexNormals();
  return g;
}

function setUvScale(geo, scale) {
  const uv = geo.attributes.uv;
  if (!uv) return geo;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
  uv.needsUpdate = true;
  return geo;
}

/* 箱の各面に実寸どおりのUVを張る（テクスチャが伸びないように） */
function boxWorldUV(geo, scalePerMeter = 1) {
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
    let u, v;
    if (ny >= nx && ny >= nz) { u = x; v = z; }
    else if (nx >= nz) { u = z; v = y; }
    else { u = x; v = y; }
    uv[i * 2] = u * scalePerMeter;
    uv[i * 2 + 1] = v * scalePerMeter;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

/* =========================================================
   部屋
   ========================================================= */
export function buildRoom() {
  const grp = new THREE.Group();
  const pl = plasterMaps();

  const wallMat = new THREE.MeshStandardMaterial({
    map: pl.map, normalMap: pl.normalMap, roughness: 0.94, metalness: 0,
  });
  wallMat.map.repeat.set(1, 1);
  wallMat.normalScale.set(0.7, 0.7);

  const floorMat = new THREE.MeshStandardMaterial({
    map: brickMaps(0.35).map, normalMap: brickMaps(0.35).normalMap,
    roughness: 0.88, metalness: 0, color: 0x9a8f84,
  });

  /* 床（テラコッタ） */
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  boxWorldUV(floor.geometry, 1.55);
  floor.geometry.attributes.uv.needsUpdate = true;
  grp.add(floor);

  /* 奥の壁 */
  const back = new THREE.Mesh(new THREE.PlaneGeometry(15, 3.6), wallMat.clone());
  back.position.set(0, 1.8, -6.3);
  back.receiveShadow = true;
  setUvScale(back.geometry, 3.0);
  grp.add(back);

  /* 側壁（左に窓） */
  const left = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.6), wallMat.clone());
  left.rotation.y = Math.PI / 2;
  left.position.set(-4.3, 1.8, -1.6);
  left.receiveShadow = true;
  setUvScale(left.geometry, 2.6);
  grp.add(left);

  const right = new THREE.Mesh(new THREE.PlaneGeometry(13, 3.6), wallMat.clone());
  right.rotation.y = -Math.PI / 2;
  right.position.set(4.3, 1.8, -1.6);
  right.receiveShadow = true;
  setUvScale(right.geometry, 2.6);
  grp.add(right);

  /* 天井 */
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(15, 15), new THREE.MeshStandardMaterial({
    color: 0xe6d9c4, roughness: 1.0,
  }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.y = 3.20;
  grp.add(ceil);

  /* 腰壁のタイル（奥の壁の下半分） */
  const tileH = makeTileHeight();
  const tileMat = new THREE.MeshStandardMaterial({
    color: 0xdfd6c4, roughness: 0.22, metalness: 0.0,
    map: makeTileTexture(),
    normalMap: tileH,
  });
  tileMat.normalScale.set(0.8, 0.8);
  const tiles = new THREE.Mesh(new THREE.PlaneGeometry(15, 1.30), tileMat);
  tiles.position.set(0, 0.65, -6.28);
  tiles.receiveShadow = true;
  grp.add(tiles);
  /* 見切りの木縁 */
  const rail = new THREE.Mesh(chamferBox(15, 0.05, 0.035, 0.004), new THREE.MeshStandardMaterial({
    color: 0x7a5836, roughness: 0.75,
  }));
  rail.position.set(0, 1.31, -6.26);
  grp.add(rail);

  /* 窓（左手前）：明るい面。ここから主光源が来る */
  const winGrp = new THREE.Group();
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.7, 1.62),
    new THREE.MeshBasicMaterial({ color: 0xfffaf0, toneMapped: false })
  );
  pane.rotation.y = Math.PI / 2;
  pane.position.set(-4.27, 1.78, -0.5);
  winGrp.add(pane);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf3ece0, roughness: 0.6 });
  const bars = [
    [0.05, 1.62, 0.05, 0, 0], [0.05, 0.05, 1.66, 0, 0],
  ];
  for (const [w, h, d, dy, dz] of bars) {
    const m = new THREE.Mesh(chamferBox(d, h, w, 0.006), frameMat);
    m.position.set(-4.25, 1.78 + dy, -0.5 + dz);
    winGrp.add(m);
  }
  const sill = new THREE.Mesh(chamferBox(0.20, 0.05, 1.72, 0.008), frameMat);
  sill.position.set(-4.19, 0.99, -0.5);
  sill.castShadow = true;
  winGrp.add(sill);
  grp.add(winGrp);

  return grp;
}

function makeTileTexture() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#b9ad98'; g.fillRect(0, 0, S, S);
  const n = 8, cell = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const j = ((x * 7 + y * 13) % 5) / 5;
      g.fillStyle = `rgb(${232 - j * 14},${226 - j * 12},${212 - j * 10})`;
      g.fillRect(x * cell + 2, y * cell + 2, cell - 4, cell - 4);
      /* 貫入と汚れ */
      g.strokeStyle = `rgba(150,138,120,${0.05 + j * 0.08})`;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x * cell + cell * 0.2, y * cell + cell * 0.1);
      g.lineTo(x * cell + cell * (0.4 + j * 0.4), y * cell + cell * 0.9);
      g.stroke();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 1);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/* タイルの目地を凹ませる法線マップ */
function makeTileHeight() {
  const S = 512, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  const n = 8, cell = S / n;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      g.fillStyle = '#e8e8e8';
      const r = 4;
      const px = x * cell + 3, py = y * cell + 3, w = cell - 6, h = cell - 6;
      g.beginPath();
      g.moveTo(px + r, py);
      g.arcTo(px + w, py, px + w, py + h, r);
      g.arcTo(px + w, py + h, px, py + h, r);
      g.arcTo(px, py + h, px, py, r);
      g.arcTo(px, py, px + w, py, r);
      g.closePath(); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(heightToNormal(c, 2.6));
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(10, 1);
  return t;
}

/* =========================================================
   作業台（近景の主役）
   ========================================================= */
export function buildBench() {
  const grp = new THREE.Group();
  const wm = woodMaps();
  const topMat = new THREE.MeshStandardMaterial({
    map: wm.map, roughnessMap: wm.roughnessMap, normalMap: wm.normalMap,
    roughness: 1.0, metalness: 0,
  });
  topMat.normalScale.set(0.85, 0.85);

  const W = WORLD.benchW, D = WORLD.benchD, TH = WORLD.benchTh;
  const top = new THREE.Mesh(chamferBox(W, TH, D, 0.008, 3), topMat);
  boxWorldUV(top.geometry, 1.45);
  top.position.set(0, WORLD.benchTop - TH / 2, 0);
  top.castShadow = true; top.receiveShadow = true;
  grp.add(top);

  /* 幕板と脚（実際に体重を支えられそうな太さ） */
  const legMat = new THREE.MeshStandardMaterial({
    map: wm.map, normalMap: wm.normalMap, roughness: 0.95, metalness: 0, color: 0x9c7a52,
  });
  const apron = new THREE.Mesh(chamferBox(W - 0.14, 0.10, D - 0.14, 0.006), legMat);
  boxWorldUV(apron.geometry, 1.45);
  apron.position.set(0, WORLD.benchTop - TH - 0.055, 0);
  apron.castShadow = true; apron.receiveShadow = true;
  grp.add(apron);

  const lw = 0.085;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(chamferBox(lw, WORLD.benchTop - TH - 0.02, lw, 0.005), legMat);
      boxWorldUV(leg.geometry, 1.45);
      leg.position.set(sx * (W / 2 - 0.11), (WORLD.benchTop - TH) / 2, sz * (D / 2 - 0.11));
      leg.castShadow = true; leg.receiveShadow = true;
      grp.add(leg);
    }
  }
  /* 下段の棚 */
  const shelf = new THREE.Mesh(chamferBox(W - 0.24, 0.035, D - 0.24, 0.005), legMat);
  boxWorldUV(shelf.geometry, 1.45);
  shelf.position.set(0, 0.26, 0);
  shelf.castShadow = true; shelf.receiveShadow = true;
  grp.add(shelf);

  return grp;
}

/* =========================================================
   クーシュ（発酵布）— 襞のある実ジオメトリ
   ========================================================= */
export function buildCouche(width = 1.35, depth = 0.62, folds = 3, pitch = 0.115) {
  const lm = linenMaps();
  const mat = new THREE.MeshStandardMaterial({
    map: lm.map, normalMap: lm.normalMap,
    roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  });
  mat.map.repeat.set(width / 0.115, depth / 0.115);
  mat.normalMap.repeat.set(width / 0.115, depth / 0.115);
  mat.normalScale.set(0.55, 0.55);

  const NX = 64, NZ = 96;
  const g = new THREE.PlaneGeometry(width, depth, NX, NZ);
  g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    /* 布の襞：谷にバゲットが収まる。山は立ち上がる */
    const q = z / pitch;
    const w = Math.abs(((q % 1) + 1) % 1 - 0.5) * 2;      /* 0=谷 1=山 */
    let y = (1 - Math.cos(Math.PI * w)) * 0.5 * 0.044;
    /* 端はテーブルの上でたるむ */
    const ex = Math.max(0, Math.abs(x) / (width / 2) - 0.80) / 0.20;
    y -= ex * ex * 0.012;
    /* 全体のよれ */
    y += Math.sin(x * 7.3 + z * 3.1) * 0.0022 + Math.cos(x * 3.1 - z * 9.7) * 0.0018;
    pos.setY(i, y);
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  m.userData.pitch = pitch;
  return m;
}

/* =========================================================
   石窯
   ========================================================= */
export function buildOven() {
  const grp = new THREE.Group();
  const bm = brickMaps(1.0);
  const brick = new THREE.MeshStandardMaterial({
    map: bm.map, normalMap: bm.normalMap, roughness: 0.95, metalness: 0,
  });
  brick.normalScale.set(1.1, 1.1);

  const BW = 2.45, BH = 2.20, BD = WORLD.ovenDepth;
  const frontZ = WORLD.ovenFront;

  /* 炉口をくり抜いた前面 */
  const face = new THREE.Shape();
  face.moveTo(-BW / 2, 0); face.lineTo(BW / 2, 0);
  face.lineTo(BW / 2, BH); face.lineTo(-BW / 2, BH); face.closePath();

  const mw = WORLD.mouthW / 2, my0 = WORLD.mouthY - WORLD.mouthH / 2, my1 = WORLD.mouthY + WORLD.mouthH / 2;
  const hole = new THREE.Path();
  hole.moveTo(-mw, my0);
  hole.lineTo(mw, my0);
  hole.lineTo(mw, my1 - 0.10);
  hole.quadraticCurveTo(mw, my1, mw - 0.10, my1);
  hole.lineTo(-mw + 0.10, my1);
  hole.quadraticCurveTo(-mw, my1, -mw, my1 - 0.10);
  hole.closePath();
  face.holes.push(hole);

  const faceGeo = new THREE.ExtrudeGeometry(face, {
    depth: 0.30, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 8,
  });
  faceGeo.translate(0, 0, -0.30);
  faceGeo.computeVertexNormals();
  boxWorldUV(faceGeo, 2.25);
  const faceMesh = new THREE.Mesh(faceGeo, brick);
  faceMesh.position.set(0, 0, frontZ);
  faceMesh.castShadow = true; faceMesh.receiveShadow = true;
  grp.add(faceMesh);

  /* 本体は「筒」。中を刳り抜かないと炉の中が見えない。
     外形の矩形に、アーチ天井の炉室をあけて押し出す。 */
  const IW = WORLD.mouthW + 0.20, ID = BD;         /* 炉室の内寸 */
  const chY0 = WORLD.deckY, chH = 0.62;
  const bodyShape = new THREE.Shape();
  bodyShape.moveTo(-BW / 2, 0); bodyShape.lineTo(BW / 2, 0);
  bodyShape.lineTo(BW / 2, BH); bodyShape.lineTo(-BW / 2, BH); bodyShape.closePath();
  const chPath = new THREE.Path();
  const cw = IW / 2, cy1 = chY0 + chH, arcR = Math.min(cw * 0.8, chH * 0.5);
  chPath.moveTo(-cw, chY0);
  chPath.lineTo(cw, chY0);
  chPath.lineTo(cw, cy1 - arcR);
  chPath.quadraticCurveTo(cw, cy1, cw - arcR, cy1);
  chPath.lineTo(-cw + arcR, cy1);
  chPath.quadraticCurveTo(-cw, cy1, -cw, cy1 - arcR);
  chPath.closePath();
  bodyShape.holes.push(chPath);

  const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, {
    depth: BD, bevelEnabled: false, curveSegments: 12,
  });
  bodyGeo.translate(0, 0, -BD);
  bodyGeo.computeVertexNormals();
  boxWorldUV(bodyGeo, 2.25);
  const body = new THREE.Mesh(bodyGeo, brick);
  body.position.set(0, 0, frontZ - 0.30);
  body.castShadow = true; body.receiveShadow = true;
  grp.add(body);

  /* 炉室の奥を塞ぐ壁 */
  const backGeo = chamferBox(BW, BH, 0.16, 0.01);
  boxWorldUV(backGeo, 2.25);
  const backSlab = new THREE.Mesh(backGeo, new THREE.MeshStandardMaterial({
    map: bm.map, normalMap: bm.normalMap, roughness: 0.96, metalness: 0, color: 0x5f4d42,
  }));
  backSlab.position.set(0, BH / 2, frontZ - 0.30 - BD - 0.08);
  backSlab.castShadow = true; backSlab.receiveShadow = true;
  grp.add(backSlab);

  /* 天板の笠石 */
  const cap = new THREE.Mesh(chamferBox(BW + 0.14, 0.09, BD + 0.42, 0.010), new THREE.MeshStandardMaterial({
    color: 0x8e8175, roughness: 0.9,
  }));
  cap.position.set(0, BH + 0.045, frontZ - 0.30 - BD / 2 + 0.06);
  cap.castShadow = true; cap.receiveShadow = true;
  grp.add(cap);

  /* 煙突 */
  const flue = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 1.0, 20, 1, true), new THREE.MeshStandardMaterial({
    ...ironMaps(), roughness: 0.75, metalness: 0.65, side: THREE.DoubleSide, color: 0x6e655d,
  }));
  flue.position.set(0.55, BH + 0.55, frontZ - 0.9);
  flue.castShadow = true;
  grp.add(flue);

  /* --- 炉床（耐火煉瓦の敷き） --- */
  const inner = new THREE.Group();
  const deckMat = new THREE.MeshStandardMaterial({
    map: brickMaps(1.0).map, normalMap: brickMaps(1.0).normalMap,
    roughness: 0.94, metalness: 0, color: 0x87705f,
  });
  const deckGeo = new THREE.PlaneGeometry(IW - 0.006, BD + 0.34, 1, 1);
  deckGeo.rotateX(-Math.PI / 2);
  boxWorldUV(deckGeo, 2.6);
  const deck = new THREE.Mesh(deckGeo, deckMat);
  deck.position.set(0, WORLD.deckY + 0.004, frontZ - 0.30 - BD / 2 + 0.02);
  deck.receiveShadow = true;
  inner.add(deck);

  grp.add(inner);

  /* 炉口の石枠（まぐさ・敷居・脇石） */
  const stone = new THREE.MeshStandardMaterial({
    color: 0x8d8175, roughness: 0.88, metalness: 0,
    map: brickMaps(0.8).map, normalMap: brickMaps(0.8).normalMap,
  });
  const lintel = new THREE.Mesh(chamferBox(WORLD.mouthW + 0.42, 0.13, 0.14, 0.008), stone);
  boxWorldUV(lintel.geometry, 2.0);
  lintel.position.set(0, my1 + 0.075, frontZ + 0.055);
  lintel.castShadow = true; lintel.receiveShadow = true;
  grp.add(lintel);

  const sillStone = new THREE.Mesh(chamferBox(WORLD.mouthW + 0.42, 0.075, 0.20, 0.008), stone);
  boxWorldUV(sillStone.geometry, 2.0);
  sillStone.position.set(0, my0 - 0.030, frontZ + 0.085);
  sillStone.castShadow = true; sillStone.receiveShadow = true;
  grp.add(sillStone);

  for (const sx of [-1, 1]) {
    const jamb = new THREE.Mesh(chamferBox(0.16, WORLD.mouthH + 0.10, 0.10, 0.008), stone);
    boxWorldUV(jamb.geometry, 2.0);
    jamb.position.set(sx * (mw + 0.08), WORLD.mouthY, frontZ + 0.035);
    jamb.castShadow = true; jamb.receiveShadow = true;
    grp.add(jamb);
  }

  /* --- 鉄の扉（上に跳ね上がる） --- */
  const im = ironMaps();
  const doorMat = new THREE.MeshStandardMaterial({
    map: im.map, roughnessMap: im.roughnessMap, roughness: 1.0, metalness: 0.72,
  });
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0, my1 + 0.02, frontZ + 0.012);
  const DW = WORLD.mouthW + 0.16, DH = WORLD.mouthH + 0.12;
  const door = new THREE.Mesh(chamferBox(DW, DH, 0.032, 0.006), doorMat);
  boxWorldUV(door.geometry, 2.4);
  door.position.set(0, -DH / 2, 0);
  door.castShadow = true; door.receiveShadow = true;
  doorPivot.add(door);
  /* 扉の縁の額縁 */
  const frameM = new THREE.MeshStandardMaterial({ color: 0x33302c, roughness: 0.62, metalness: 0.75 });
  for (const [w, h, x, y] of [
    [DW, 0.030, 0, -0.020], [DW, 0.030, 0, -DH + 0.020],
    [0.030, DH, -DW / 2 + 0.016, -DH / 2], [0.030, DH, DW / 2 - 0.016, -DH / 2],
  ]) {
    const bar = new THREE.Mesh(chamferBox(w, h, 0.012, 0.003), frameM);
    bar.position.set(x, y, 0.021);
    bar.castShadow = true;
    doorPivot.add(bar);
  }
  /* 鋲 */
  for (let i = 0; i < 8; i++) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.008, 10, 8), frameM);
    const k = -DW / 2 + 0.05 + (DW - 0.10) * (i / 7);
    rivet.position.set(k, -0.020, 0.028);
    doorPivot.add(rivet);
    const r2 = rivet.clone();
    r2.position.y = -DH + 0.020;
    doorPivot.add(r2);
  }
  /* 蝶番 */
  for (const sx of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 12), frameM);
    h.rotation.z = Math.PI / 2;
    h.position.set(sx * (DW / 2 - 0.09), 0.005, 0.005);
    h.castShadow = true;
    doorPivot.add(h);
  }
  /* 取っ手 */
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.011, 8, 20, Math.PI), new THREE.MeshStandardMaterial({
    color: 0x2e2a26, roughness: 0.5, metalness: 0.8,
  }));
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -DH + 0.035, 0.048);
  handle.castShadow = true;
  doorPivot.add(handle);
  grp.add(doorPivot);

  return { group: grp, doorPivot, innerCenter: new THREE.Vector3(0, WORLD.deckY, frontZ - 0.30 - BD * 0.5) };
}

/* =========================================================
   壁の棚・パン籠・冷却ラック
   ========================================================= */
export function buildShelves(loafProto) {
  const grp = new THREE.Group();
  const wm = woodMaps();
  const shelfMat = new THREE.MeshStandardMaterial({
    map: wm.map, normalMap: wm.normalMap, roughness: 0.92, color: 0x9c7b53,
  });
  for (let s = 0; s < 3; s++) {
    const y = 1.20 + s * 0.56;
    const board = new THREE.Mesh(chamferBox(3.0, 0.045, 0.36, 0.005), shelfMat);
    boxWorldUV(board.geometry, 0.7);
    board.position.set(2.25, y, -6.0);
    board.rotation.y = 0;
    board.castShadow = true; board.receiveShadow = true;
    grp.add(board);
    for (const bx of [-1.0, 0, 1.0]) {
      const br = new THREE.Mesh(chamferBox(0.05, 0.20, 0.30, 0.004), shelfMat);
      br.position.set(2.25 + bx, y - 0.12, -6.01);
      br.castShadow = true;
      grp.add(br);
    }
  }
  return grp;
}

export function buildRack() {
  const grp = new THREE.Group();
  const im = ironMaps();
  const wire = new THREE.MeshStandardMaterial({
    color: 0xb9bfc4, roughness: 0.42, metalness: 0.85, map: im.map,
  });
  const W = 0.80, D = 0.36;
  for (let i = 0; i < 17; i++) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0028, 0.0028, D, 6), wire);
    bar.rotation.x = Math.PI / 2;
    bar.position.set(-W / 2 + (W * i) / 16, 0, 0);
    bar.castShadow = true;
    grp.add(bar);
  }
  for (const z of [-D / 2 + 0.03, 0, D / 2 - 0.03]) {
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.0038, 0.0038, W, 6), wire);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, -0.005, z);
    bar.castShadow = true;
    grp.add(bar);
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.022, 6), wire);
      foot.position.set(sx * (W / 2 - 0.05), -0.014, sz * (D / 2 - 0.05));
      grp.add(foot);
    }
  }
  return grp;
}

/* =========================================================
   道具（近景に置く。大人の職人の持ち物）
   ========================================================= */
export function buildLame() {
  const grp = new THREE.Group();
  /* 木の柄：長さ11cm 直径1.6cm */
  const wood = new THREE.MeshStandardMaterial({ color: 0xa9773f, roughness: 0.62, metalness: 0 });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.0092, 0.112, 18), wood);
  handle.castShadow = true;
  grp.add(handle);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.0086, 0.0086, 0.012, 18), new THREE.MeshStandardMaterial({
    color: 0xd8dde1, roughness: 0.3, metalness: 0.9,
  }));
  collar.position.y = 0.062;
  grp.add(collar);
  /* 剃刀の刃：薄く小さく（3.5cm） */
  const bladeShape = new THREE.Shape();
  bladeShape.moveTo(-0.008, 0);
  bladeShape.quadraticCurveTo(-0.010, 0.020, -0.002, 0.034);
  bladeShape.quadraticCurveTo(0.006, 0.022, 0.006, 0);
  bladeShape.closePath();
  const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, { depth: 0.0004, bevelEnabled: false });
  const blade = new THREE.Mesh(bladeGeo, new THREE.MeshStandardMaterial({
    color: 0xe6ecf2, roughness: 0.12, metalness: 1.0, side: THREE.DoubleSide,
  }));
  blade.position.y = 0.066;
  blade.castShadow = true;
  grp.add(blade);
  return grp;
}

/* ピール（パン板）：楢の一枚板。長さ1.15m 幅0.42m 厚さ12mm */
export function buildPeel() {
  const grp = new THREE.Group();
  const wm = woodMaps();
  const mat = new THREE.MeshStandardMaterial({
    map: wm.map, normalMap: wm.normalMap, roughness: 0.86, metalness: 0, color: 0xd8b483,
  });
  const shape = rrShape(0.42, 0.62, 0.03);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.011, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.004, bevelSegments: 2, curveSegments: 6,
  });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  boxWorldUV(geo, 1.1);
  const board = new THREE.Mesh(geo, mat);
  board.castShadow = true; board.receiveShadow = true;
  grp.add(board);
  /* 先端を薄く削いだ形（実際のピールは先が薄い） */
  const tipShape = rrShape(0.42, 0.16, 0.02);
  const tipGeo = new THREE.ExtrudeGeometry(tipShape, { depth: 0.004, bevelEnabled: false });
  tipGeo.rotateX(-Math.PI / 2);
  tipGeo.computeVertexNormals();
  boxWorldUV(tipGeo, 1.1);
  const tip = new THREE.Mesh(tipGeo, mat);
  tip.position.set(0, 0.0035, -0.38);
  tip.castShadow = true; tip.receiveShadow = true;
  grp.add(tip);
  /* 柄 */
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.019, 0.55, 14), mat);
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, 0.006, 0.58);
  handle.castShadow = true;
  grp.add(handle);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.024, 14, 10), mat);
  knob.position.set(0, 0.006, 0.855);
  knob.castShadow = true;
  grp.add(knob);
  return grp;
}

export function buildScraper() {
  const grp = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: 0xc9d0d6, roughness: 0.32, metalness: 0.9 });
  const b = new THREE.Mesh(chamferBox(0.15, 0.001, 0.105, 0.0005), steel);
  b.castShadow = true; b.receiveShadow = true;
  grp.add(b);
  const grip = new THREE.Mesh(chamferBox(0.15, 0.022, 0.026, 0.006), new THREE.MeshStandardMaterial({
    color: 0x6f4b2c, roughness: 0.7,
  }));
  grip.position.set(0, 0.011, -0.048);
  grip.castShadow = true;
  grp.add(grip);
  return grp;
}

export function buildDredger() {
  const grp = new THREE.Group();
  const tin = new THREE.MeshStandardMaterial({ color: 0xb6bcc2, roughness: 0.38, metalness: 0.85 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.042, 0.105, 24), tin);
  body.position.y = 0.052;
  body.castShadow = true; body.receiveShadow = true;
  grp.add(body);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.039, 0.022, 24), tin);
  lid.position.y = 0.114;
  lid.castShadow = true;
  grp.add(lid);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.008, 12, 10), tin);
  knob.position.y = 0.128;
  grp.add(knob);
  return grp;
}

/* 粉をかぶった布巾（近景の垂れ布） */
export function buildTowel(w = 0.34, h = 0.30) {
  const lm = linenMaps();
  const mat = new THREE.MeshStandardMaterial({
    map: lm.map, normalMap: lm.normalMap, roughness: 0.95, side: THREE.DoubleSide, color: 0xe8e0cf,
  });
  const g = new THREE.PlaneGeometry(w, h, 24, 24);
  const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const t = (y + h / 2) / h;                      /* 0=下 1=上 */
    pos.setZ(i, Math.sin(x * 22 + 0.4) * 0.010 * (1 - t) + Math.sin(x * 9) * 0.006);
    pos.setX(i, x * (0.86 + 0.14 * t));
  }
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/* パン籠 */
export function buildBasket(r = 0.13, h = 0.10) {
  const grp = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xa97c46, roughness: 0.9 });
  const rings = 5;
  for (let i = 0; i < rings; i++) {
    const y = (h * (i + 0.5)) / rings;
    const rr = r * (0.86 + 0.14 * (i / rings)) ;
    const t = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.0075, 6, 30), mat);
    t.rotation.x = Math.PI / 2;
    t.position.y = y;
    t.castShadow = true; t.receiveShadow = true;
    grp.add(t);
  }
  const base = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.80, 0.012, 26), mat);
  base.position.y = 0.006;
  base.receiveShadow = true;
  grp.add(base);
  return grp;
}
