// Underground pump room: worn concrete, heavy pipes, warm bulbs, deep corridor.
// Returns the scene group plus references for the interactive stations.
import * as THREE from 'three';
import { concreteTex, metalTex } from './textures.js';

export const PIPE_Y = 1.0;
export const PIPE_Z = -3.1;

function metalMat(color = 0x8b9298, rough = 0.42) {
  return new THREE.MeshStandardMaterial({
    map: metalTex(), color, metalness: 0.85, roughness: rough,
  });
}

function pipe(len, r = 0.16, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), mat);
  m.rotation.z = Math.PI / 2; // axis along X
  return m;
}

function flange(r = 0.16, mat) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.45, r * 1.45, 0.07, 20), mat);
  m.rotation.z = Math.PI / 2;
  return m;
}

export function makeTextSprite(text, { size = 90, color = '#fff', bg = 'rgba(20,90,140,0.9)' } = {}) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(64, 64, 58, 0, 7);
  ctx.fillStyle = bg; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#fff'; ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = `bold ${size}px sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
  s.scale.setScalar(0.28);
  return s;
}

export function buildRoom() {
  const g = new THREE.Group();
  const parts = {};

  // ---------- shell ----------
  const wallMat = new THREE.MeshStandardMaterial({ map: concreteTex('#4d5654'), roughness: 0.95 });
  const floorMat = new THREE.MeshStandardMaterial({ map: concreteTex('#3d4442'), roughness: 0.85 });
  floorMat.map.repeat.set(3, 2);
  const W = 13, H = 4.1, D = 9;
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wallMat);
  back.position.set(0, H / 2, -4);
  g.add(back);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -4 + D / 2);
  floor.receiveShadow = true;
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), wallMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, -4 + D / 2);
  g.add(ceil);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wallMat);
  left.rotation.y = Math.PI / 2;
  left.position.set(-W / 2, H / 2, -4 + D / 2);
  g.add(left);
  const right = left.clone();
  right.rotation.y = -Math.PI / 2;
  right.position.x = W / 2;
  g.add(right);

  // corridor receding into darkness (depth cue) — an opening in the back wall
  const corW = 1.6, corH = 2.6, corX = -5.0;
  const corridor = new THREE.Group();
  const corMat = new THREE.MeshStandardMaterial({ map: concreteTex('#39403f'), roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const z = -4 - i * 2.4;
    const arch = new THREE.Mesh(new THREE.BoxGeometry(corW + 0.5, 0.35, 0.35), corMat);
    arch.position.set(corX, corH, z - 1.2);
    corridor.add(arch);
    const colL = new THREE.Mesh(new THREE.BoxGeometry(0.3, corH, 0.35), corMat);
    colL.position.set(corX - corW / 2 - 0.1, corH / 2, z - 1.2);
    corridor.add(colL);
    const colR = colL.clone(); colR.position.x = corX + corW / 2 + 0.1;
    corridor.add(colR);
  }
  const corFloor = new THREE.Mesh(new THREE.PlaneGeometry(corW + 0.8, 10), corMat);
  corFloor.rotation.x = -Math.PI / 2;
  corFloor.position.set(corX, 0.001, -9);
  corridor.add(corFloor);
  const corWallL = new THREE.Mesh(new THREE.PlaneGeometry(10, H), corMat);
  corWallL.rotation.y = Math.PI / 2;
  corWallL.position.set(corX - corW / 2 - 0.25, H / 2, -9);
  corridor.add(corWallL);
  const corWallR = corWallL.clone(); corWallR.rotation.y = -Math.PI / 2;
  corWallR.position.x = corX + corW / 2 + 0.25;
  corridor.add(corWallR);
  const farLight = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0x88ffcc }));
  farLight.position.set(corX, 2.2, -13.5);
  corridor.add(farLight);
  g.add(corridor);
  // punch the opening: dark frame drawn over wall
  const hole = new THREE.Mesh(new THREE.PlaneGeometry(corW + 0.4, corH + 0.3),
    new THREE.MeshBasicMaterial({ color: 0x000000 }));
  hole.position.set(corX, (corH + 0.3) / 2, -4.001);
  g.add(hole); // corridor renders in front of it (deeper z), black backs it up

  // ---------- main pipeline along the back wall ----------
  const mPipe = metalMat(0x87919a, 0.4);
  const mPipeOld = metalMat(0x6e7477, 0.6);
  const mBrass = metalMat(0xb8925a, 0.35);

  const addSeg = (x0, x1, r = 0.16, mat = mPipe, y = PIPE_Y, z = PIPE_Z) => {
    const p = pipe(x1 - x0, r, mat);
    p.position.set((x0 + x1) / 2, y, z);
    p.castShadow = true;
    g.add(p);
    return p;
  };

  // fixed segments
  addSeg(-6.5, -4.3, 0.16, mPipeOld);
  const f1 = flange(0.16, mPipeOld); f1.position.set(-4.3, PIPE_Y, PIPE_Z); g.add(f1);
  // GAP: -4.3 .. -1.5  (player installs 2 metal pieces + 1 clear hose)
  const f2 = flange(0.16, mPipeOld); f2.position.set(-1.5, PIPE_Y, PIPE_Z); g.add(f2);
  addSeg(-1.5, -1.2, 0.16, mPipeOld);
  // glass inspection section -1.2 .. 0.4 (clog station)
  addSeg(0.4, 4.6, 0.16, mPipe);
  [1.6, 3.0].forEach(x => { const f = flange(0.16, mPipe); f.position.set(x, PIPE_Y, PIPE_Z); g.add(f); });

  // ---------- STATION 1: pipe pieces ----------
  // slots: [-4.3,-3.4] metal, [-3.4,-2.5] metal, [-2.5,-1.5] clear hose (sagging)
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0x53d8ff, transparent: true, opacity: 0.22, depthWrite: false,
  });
  const pieceDefs = [];
  const mkStraight = (mat) => {
    const grp = new THREE.Group();
    const body = pipe(0.9, 0.16, mat); grp.add(body);
    const fa = flange(0.16, mat); fa.position.x = -0.42; grp.add(fa);
    const fb = flange(0.16, mat); fb.position.x = 0.42; grp.add(fb);
    return grp;
  };
  const hoseCurvePts = [
    new THREE.Vector3(-2.5, PIPE_Y, PIPE_Z),
    new THREE.Vector3(-2.25, PIPE_Y - 0.22, PIPE_Z + 0.05),
    new THREE.Vector3(-1.75, PIPE_Y - 0.22, PIPE_Z + 0.05),
    new THREE.Vector3(-1.5, PIPE_Y, PIPE_Z),
  ];
  const hoseCurve = new THREE.CatmullRomCurve3(hoseCurvePts);
  const mkHose = () => {
    const grp = new THREE.Group();
    const local = hoseCurvePts.map(p => new THREE.Vector3(p.x + 2.0, p.y - PIPE_Y, p.z - PIPE_Z));
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(local), 24, 0.13, 14),
      new THREE.MeshPhysicalMaterial({
        color: 0x9fd8ec, transparent: true, opacity: 0.24, roughness: 0.08,
        metalness: 0, side: THREE.DoubleSide, depthWrite: false,
      })
    );
    grp.add(tube);
    const ca = flange(0.15, mBrass); ca.position.set(-0.5, 0, 0); grp.add(ca);
    const cb = flange(0.15, mBrass); cb.position.set(0.5, 0, 0); grp.add(cb);
    return grp;
  };
  const slotDefs = [
    { pos: new THREE.Vector3(-3.85, PIPE_Y, PIPE_Z), make: () => mkStraight(mPipe), kind: 'straight' },
    { pos: new THREE.Vector3(-2.95, PIPE_Y, PIPE_Z), make: () => mkStraight(mBrass), kind: 'straight2' },
    { pos: new THREE.Vector3(-2.0, PIPE_Y, PIPE_Z), make: mkHose, kind: 'hose' },
  ];
  // shelf with loose pieces
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.09, 0.7),
    new THREE.MeshStandardMaterial({ map: concreteTex('#6b5636'), roughness: 0.9 }));
  shelf.position.set(-3.2, 0.55, -2.1);
  g.add(shelf);
  [[-4.4, 0.55, -2.1], [-3.2, 0.55, -2.1], [-2.0, 0.55, -2.1]].forEach((sp, i) => {
    const sd = slotDefs[i];
    const piece = sd.make();
    piece.position.set(sp[0], sp[1] + 0.28, sp[2]);
    piece.rotation.z = 0.12 * (i - 1);
    g.add(piece);
    // ghost at target
    const ghost = sd.make();
    ghost.traverse(o => { if (o.isMesh) { o.material = ghostMat; } });
    ghost.position.copy(sd.pos);
    g.add(ghost);
    // fat invisible hit sphere over the piece
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.55, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(piece.position);
    g.add(hit);
    pieceDefs.push({ piece, ghost, hit, target: sd.pos.clone(), home: piece.position.clone(), done: false, kind: sd.kind });
  });
  parts.pieces = pieceDefs;
  parts.hoseCurve = hoseCurve;

  // ---------- STATION 2: clog (glass inspection pipe) ----------
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.19, 0.19, 1.6, 24, 1, true),
    new THREE.MeshPhysicalMaterial({
      color: 0xbfe2ee, transparent: true, opacity: 0.28, roughness: 0.05,
      metalness: 0, side: THREE.DoubleSide, depthWrite: false,
    })
  );
  glass.rotation.z = Math.PI / 2;
  glass.position.set(-0.4, PIPE_Y, PIPE_Z);
  g.add(glass);
  [-1.2, 0.4].forEach(x => { const f = flange(0.19, mBrass); f.position.set(x, PIPE_Y, PIPE_Z); g.add(f); });
  const gunkMat = new THREE.MeshStandardMaterial({ color: 0x4a5527, roughness: 0.9 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x5f7030, roughness: 0.85, side: THREE.DoubleSide });
  const gunks = [];
  const gunkX = [-0.95, -0.6, -0.2, 0.15];
  gunkX.forEach((x, i) => {
    const grp = new THREE.Group();
    const blob = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), gunkMat);
    blob.scale.set(1.15, 0.8, 1);
    grp.add(blob);
    if (i % 2 === 0) {
      const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.09, 8), leafMat);
      leaf.rotation.set(0.7, 0.4 * i, 0);
      leaf.position.set(0.05, 0.08, 0.05);
      grp.add(leaf);
    }
    grp.position.set(x, PIPE_Y - 0.02 + (i % 2) * 0.05, PIPE_Z);
    g.add(grp);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(grp.position);
    g.add(hit);
    gunks.push({ grp, hit, done: false });
  });
  parts.gunks = gunks;
  parts.glass = glass;

  // ---------- STATION 3: nozzle test rig ----------
  const rig = new THREE.Group();
  rig.position.set(1.35, 0, -2.15);
  const rigBase = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.75, 0.55), metalMat(0x37505a, 0.6));
  rigBase.position.y = 0.375;
  rigBase.castShadow = true;
  rig.add(rigBase);
  const manifold = pipe(1.5, 0.09, mBrass);
  manifold.position.set(0, 0.85, 0);
  rig.add(manifold);
  const nozzles = [];
  [-0.5, 0, 0.5].forEach((x, i) => {
    const nz = new THREE.Group();
    nz.position.set(x, 0.9, 0);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.22, 12), mBrass);
    stem.position.y = 0.1;
    nz.add(stem);
    // three interchangeable heads
    const heads = [];
    const hStraight = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.05, 0.16, 12), mBrass);
    hStraight.position.y = 0.28; nz.add(hStraight); heads.push(hStraight);
    const hArc = new THREE.Group();
    const bend = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.038, 10, 14, Math.PI / 2), mBrass);
    bend.rotation.z = Math.PI / 2; bend.rotation.y = Math.PI / 2;
    bend.position.y = 0.24;
    hArc.add(bend);
    nz.add(hArc); heads.push(hArc);
    const hFan = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.03, 0.13, 12, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xb8925a, metalness: 0.8, roughness: 0.35, side: THREE.DoubleSide }));
    hFan.position.y = 0.28; nz.add(hFan); heads.push(hFan);
    heads[1].visible = heads[2].visible = false;
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x, 1.2, 0);
    rig.add(hit);
    rig.add(nz);
    nozzles.push({ nz, heads, hit, type: 0, tapped: false });
  });
  g.add(rig);
  parts.nozzles = nozzles;
  parts.rig = rig;

  // ---------- STATION 4: light bench ----------
  const bench = new THREE.Group();
  bench.position.set(3.3, 0, -2.15);
  const bTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.12, 0.6), metalMat(0x4a4038, 0.7));
  bTop.position.y = 0.75;
  bench.add(bTop);
  [[-0.8, 0.35], [0.8, 0.35]].forEach(([x, y]) => {
    const legM = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.75, 0.5), metalMat(0x3a332c, 0.8));
    legM.position.set(x, y, 0);
    bench.add(legM);
  });
  const lamps = [];
  [-0.66, -0.22, 0.22, 0.66].forEach((x, i) => {
    const lg = new THREE.Group();
    lg.position.set(x, 0.88, 0);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.09, 14), metalMat(0x666e73, 0.5));
    lg.add(base);
    const domeMat = new THREE.MeshPhysicalMaterial({
      color: 0x9fb6bd, roughness: 0.15, transparent: true, opacity: 0.9,
      emissive: 0x000000, emissiveIntensity: 1.6,
    });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), domeMat);
    dome.position.y = 0.045;
    lg.add(dome);
    const hit = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(x, 0.98, 0);
    bench.add(hit);
    bench.add(lg);
    const badge = makeTextSprite('');
    badge.position.set(x, 1.35, 0);
    badge.visible = false;
    bench.add(badge);
    lamps.push({ lg, domeMat, hit, badge, colorIdx: -1, order: -1 });
  });
  g.add(bench);
  parts.lamps = lamps;
  parts.bench = bench;

  // ---------- pump + riser + valve ----------
  const pump = new THREE.Group();
  pump.position.set(4.9, 0, -3.1);
  const pBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.1), metalMat(0x2e4a3d, 0.55));
  pBase.position.y = 0.25; pBase.castShadow = true;
  pump.add(pBase);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.1, 20), metalMat(0x33584a, 0.4));
  motor.rotation.z = Math.PI / 2;
  motor.position.y = 0.85;
  motor.castShadow = true;
  pump.add(motor);
  const fins = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 0.9), metalMat(0x274438, 0.6));
  fins.position.y = 1.32;
  pump.add(fins);
  g.add(pump);
  parts.pump = pump;

  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.0, 20), mPipe);
  riser.position.set(4.9, 2.6, -3.1);
  g.add(riser);
  // flange collar on the vertical riser: plain cylinder, axis already vertical
  const riserFl = new THREE.Mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.07, 20), mPipe);
  riserFl.position.set(4.9, 2.0, -3.1);
  g.add(riserFl);
  // ceiling collar
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 20), mPipeOld);
  collar.position.set(4.9, H - 0.06, -3.1);
  g.add(collar);

  // valve wheel on the riser, facing the camera
  const valve = new THREE.Group();
  valve.position.set(4.9, 1.75, -2.55);
  const vRed = new THREE.MeshStandardMaterial({ color: 0xb03030, metalness: 0.55, roughness: 0.45 });
  const wheel = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.48, 0.06, 12, 40), vRed);
  wheel.add(rim);
  for (let i = 0; i < 4; i++) {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.92, 10), vRed);
    spoke.rotation.z = (i * Math.PI) / 4 + (i < 2 ? 0 : Math.PI / 4);
    wheel.add(spoke);
  }
  // fix spokes: 2 crossing at 0 and 90 deg
  wheel.children.length = 1;
  [0, Math.PI / 2].forEach(a => {
    const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.94, 10), vRed);
    spoke.rotation.z = a;
    wheel.add(spoke);
  });
  const hub = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 12), mBrass);
  wheel.add(hub);
  wheel.rotation.x = Math.PI / 2; // wheel plane horizontal? no — face +z: keep default (torus faces +z already)
  wheel.rotation.x = 0;
  valve.add(wheel);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.55, 12), mPipe);
  stem.rotation.x = Math.PI / 2;
  stem.position.z = -0.3;
  valve.add(stem);
  const vHit = new THREE.Mesh(new THREE.SphereGeometry(0.72, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }));
  valve.add(vHit);
  g.add(valve);
  parts.valve = { group: valve, wheel, hit: vHit, turns: 0 };

  // pressure gauge on the riser
  const gauge = new THREE.Group();
  gauge.position.set(4.9, 3.0, -2.82);
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.05, 20),
    new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.5 }));
  dial.rotation.x = Math.PI / 2;
  gauge.add(dial);
  const rimG = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 10, 24), mBrass);
  gauge.add(rimG);
  const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.01),
    new THREE.MeshBasicMaterial({ color: 0xc02020 }));
  needle.position.set(0, 0.045, 0.035);
  const needlePivot = new THREE.Group();
  needlePivot.add(needle);
  needlePivot.rotation.z = 1.2;
  gauge.add(needlePivot);
  g.add(gauge);
  parts.gaugeNeedle = needlePivot;

  // ---------- dressing: bulbs, cables, stains, puddles, foreground ----------
  const bulbs = [];
  [-3.2, 0.2, 3.6].forEach(x => {
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6),
      new THREE.MeshBasicMaterial({ color: 0x111111 }));
    cable.position.set(x, H - 0.25, -1.4);
    g.add(cable);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 10),
      new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
    bulb.position.set(x, H - 0.52, -1.4);
    g.add(bulb);
    const shade2 = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.16, 0.12, 14, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x2c4a3a, roughness: 0.6, side: THREE.DoubleSide }));
    shade2.position.set(x, H - 0.44, -1.4);
    g.add(shade2);
    const pl = new THREE.PointLight(0xffc98a, 14, 9, 1.8);
    pl.position.set(x, H - 0.6, -1.4);
    g.add(pl);
    bulbs.push({ bulb, light: pl, phase: Math.random() * 10 });
  });
  parts.bulbs = bulbs;

  // wall stains under pipe joints
  const stainMat = new THREE.MeshBasicMaterial({
    color: 0x141a18, transparent: true, opacity: 0.35, depthWrite: false,
  });
  [-4.3, -1.5, 1.6, 3.0].forEach(x => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.9), stainMat);
    s.position.set(x, PIPE_Y - 0.55, -3.98);
    g.add(s);
  });
  // puddles
  const puddleMat = new THREE.MeshStandardMaterial({
    color: 0x0d1a1f, roughness: 0.05, metalness: 0.1,
  });
  [[-2.2, -2.9, 0.8], [0.9, -3.0, 0.5], [4.5, -2.4, 0.7]].forEach(([x, z, r]) => {
    const p = new THREE.Mesh(new THREE.CircleGeometry(r, 20), puddleMat);
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.006, z);
    p.scale.y = 0.7;
    g.add(p);
  });
  // foreground occluders (near-plane silhouettes for parallax depth)
  const fgMat = new THREE.MeshStandardMaterial({ color: 0x14181a, roughness: 0.9 });
  const fgPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 16, 14), fgMat);
  fgPipe.rotation.z = Math.PI / 2;
  fgPipe.position.set(0, 3.95, 3.4);
  g.add(fgPipe);
  const fgCable = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 16, 8), fgMat);
  fgCable.rotation.z = Math.PI / 2;
  fgCable.position.set(0, 3.62, 3.6);
  g.add(fgCable);

  // back-wall extra pipes for busy silhouette
  [2.2, 2.6].forEach(y => {
    const bp = pipe(13, 0.07, mPipeOld);
    bp.position.set(0, y, -3.85);
    g.add(bp);
  });
  const vp = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, H, 12), mPipeOld);
  vp.position.set(-6.1, H / 2, -3.6);
  g.add(vp);

  return { group: g, parts };
}
