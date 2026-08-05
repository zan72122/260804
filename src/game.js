// おへや ぴかぴか — 4歳向け内装職人3Dゲーム本体
// フェーズ: COVER(養生) → HOLES(穴埋め) → PEEL(壁紙はがし) → PICK(色えらび)
//        → PAINT(ローラー塗装) → PATTERN(模様) → LIGHT(照明) → CURTAIN(カーテン)
//        → PULL(大きなシートを引く) → REVEAL(大変身) → PLAY(自由あそび)
import * as THREE from 'three';
import { buildRoom, ROOM, WIN } from './room.js';
import { SheetManager } from './sheets.js';
import { ParticleManager } from './particles.js';
import * as TX from './textures.js';
import { unlockAudio, sfx, rollerStart, rollerMove, rollerStop, musicToBright } from './audio.js';

// ---------- 基本セットアップ ----------
const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.92;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x17141a);
scene.fog = new THREE.Fog(0xbcc8ce, 7, 15);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, 0.1, 40);
scene.add(camera);

// ---------- ライティング（古い部屋 → 明るい部屋へ遷移可能に） ----------
const hemi = new THREE.HemisphereLight(0x6f7d8c, 0x453629, 0.55);
scene.add(hemi);
const amb = new THREE.AmbientLight(0x2a241e, 1.2);
scene.add(amb);
// 窓からの外光
const sun = new THREE.DirectionalLight(0x9fb4c8, 1.1);
sun.position.set(-5.5, 3.4, -0.4);
sun.target.position.set(1.6, 0.4, -0.4);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 14;
sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -3;
sun.shadow.bias = -0.002;
scene.add(sun, sun.target);
// 古い裸電球
const bulbLight = new THREE.PointLight(0xffb066, 6.5, 8, 1.8);
bulbLight.position.set(0, 1.92, -0.3);
scene.add(bulbLight);
// 新しいペンダント（最初は消灯）
const pendantLight = new THREE.PointLight(0xffd9a0, 0, 9, 1.7);
pendantLight.position.set(0, 1.9, -0.3);
scene.add(pendantLight);

const LIGHT_OLD = {
  hemiSky: 0x6f7d8c, hemiGround: 0x453629, hemiI: 0.78,
  sunColor: 0x9fb4c8, sunI: 1.5, bulbI: 6.5, pendantI: 0, exposure: 0.92,
  fogColor: 0xbcc8ce, bg: 0x17141a,
};
const LIGHT_NEW = {
  hemiSky: 0xfff0dd, hemiGround: 0xb08968, hemiI: 1.15,
  sunColor: 0xffe3b0, sunI: 2.6, bulbI: 0, pendantI: 26, exposure: 1.12,
  fogColor: 0xdfeaf0, bg: 0x2a2430,
};

// ---------- シーン構築 ----------
const room = buildRoom(scene);
const sheetMgr = new SheetManager(scene, room.root);
const particles = new ParticleManager(scene);

// ---------- 壁紙ストリップ（めくりシステム） ----------
const strips = [];
{
  const stripW = 0.885, stripH = 2.5;
  const present = [0, 1, 3, 4]; // 2番は最初から剥がれて下地が見えている
  for (const i of present) {
    const cx = -2.2 + 0.88 * (i + 0.5);
    const geo = new THREE.PlaneGeometry(stripW, stripH, 4, 36);
    const base = geo.attributes.position.array.slice();
    const frontTex = room.texOldWallpaper.clone();
    frontTex.needsUpdate = true;
    frontTex.repeat.set(0.8, 2.27);
    frontTex.offset.set(i * 0.8, 0);
    const front = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: frontTex, roughness: 0.95, side: THREE.FrontSide, transparent: true,
    }));
    const back = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      map: room.texWallpaperBack, roughness: 1, side: THREE.BackSide, transparent: true,
    }));
    const g = new THREE.Group();
    g.add(front, back);
    g.position.set(cx, 0.1 + stripH / 2, ROOM.backZ + 0.012);
    room.root.add(g);
    // あたり判定用の少し大きい透明板
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(stripW + 0.12, stripH + 0.2), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.position.copy(g.position);
    hit.position.z += 0.02;
    room.root.add(hit);
    strips.push({
      idx: i, group: g, geo, base, front, back, hit,
      p: i === 3 ? 0.34 : 0, done: false, falling: 0,
    });
  }
  for (const s of strips) updateStripCurl(s);
}

function updateStripCurl(s) {
  const pos = s.geo.attributes.position;
  const r = 0.085;
  const yF = 1.25 - s.p * 3.0;
  for (let i = 0; i < pos.count; i++) {
    const bx = s.base[i * 3], by = s.base[i * 3 + 1];
    if (by <= yF) {
      pos.setXYZ(i, bx, by, 0);
    } else {
      const th = (by - yF) / r * (1 - 0.05 * Math.sin(bx * 9));
      const re = r * (1 + 0.055 * th);
      pos.setXYZ(i, bx, yF + Math.sin(th) * re, (1 - Math.cos(th)) * re);
    }
  }
  pos.needsUpdate = true;
  s.geo.computeVertexNormals();
}

// ---------- 壁の穴（3か所） ----------
const holes = [];
{
  const holeTex = TX.holeTexture();
  const patchTex = TX.patchTexture();
  const spots = [[-0.25, 1.55], [0.12, 0.98], [0.82, 1.92]];
  for (const [hx, hy] of spots) {
    const hole = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshStandardMaterial({ map: holeTex, transparent: true, roughness: 1 })
    );
    hole.position.set(hx, hy, ROOM.backZ + 0.008);
    room.root.add(hole);
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.38, 0.38),
      new THREE.MeshStandardMaterial({ map: patchTex, transparent: true, roughness: 0.95 })
    );
    patch.position.set(hx, hy, ROOM.backZ + 0.01);
    patch.scale.set(0.001, 0.001, 1);
    patch.visible = false;
    room.root.add(patch);
    const hit = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.55), new THREE.MeshBasicMaterial());
    hit.visible = false;
    hit.position.set(hx, hy, ROOM.backZ + 0.02);
    room.root.add(hit);
    holes.push({ hole, patch, hit, x: hx, y: hy, filled: false, anim: 0 });
  }
}

// パテごて（穴埋めのお供）
const trowel = new THREE.Group();
{
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.1, 0.01),
    new THREE.MeshStandardMaterial({ color: 0xc7ccd2, metalness: 0.7, roughness: 0.3 }));
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.02, 0.11, 8),
    new THREE.MeshStandardMaterial({ color: 0xc75b39, roughness: 0.6 }));
  grip.position.set(0, -0.02, 0.07);
  grip.rotation.x = 1.1;
  trowel.add(blade, grip);
  trowel.visible = false;
  scene.add(trowel);
}

// ---------- ペンキローラー ----------
const roller = new THREE.Group();
let rollerCyl;
{
  rollerCyl = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.25, 14),
    new THREE.MeshStandardMaterial({ color: 0xfff2e2, roughness: 0.9 }));
  rollerCyl.rotation.z = Math.PI / 2;
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 8),
    new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.6, roughness: 0.4 }));
  arm.position.set(0.1, -0.1, 0.05);
  arm.rotation.x = 0.9;
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 0.13, 8),
    new THREE.MeshStandardMaterial({ color: 0xc75b39, roughness: 0.6 }));
  grip.position.set(0.1, -0.2, 0.13);
  grip.rotation.x = 0.9;
  roller.add(rollerCyl, arm, grip);
  roller.visible = false;
  scene.add(roller);
}

// ---------- ガイド（手のしるし＋光るリング、文字なし） ----------
const guide = {};
{
  const handMat = new THREE.SpriteMaterial({ map: TX.handTexture(), transparent: true, depthTest: false });
  guide.hand = new THREE.Sprite(handMat);
  guide.hand.scale.set(0.34, 0.34, 1);
  guide.hand.renderOrder = 20;
  scene.add(guide.hand);
  const ringMat = new THREE.SpriteMaterial({ map: TX.ringTexture(), transparent: true, depthTest: false });
  guide.ring = new THREE.Sprite(ringMat);
  guide.ring.scale.set(0.4, 0.4, 1);
  guide.ring.renderOrder = 19;
  scene.add(guide.ring);
  guide.mode = null; // {type:'tap'|'drag', a:Vector3, b:Vector3}
  guide.t = 0;
}
function setGuide(mode) { guide.mode = mode; guide.t = 0; }
function updateGuide(dt) {
  guide.t += dt;
  const m = guide.mode;
  const show = !!m && !pointer.down;
  guide.hand.visible = show;
  guide.ring.visible = show && m.type === 'tap';
  if (!show) return;
  if (m.type === 'tap') {
    const pulse = 1 + Math.sin(guide.t * 5) * 0.12;
    guide.ring.position.copy(m.a);
    guide.ring.scale.set(0.4 * pulse, 0.4 * pulse, 1);
    guide.hand.position.copy(m.a).add(new THREE.Vector3(0.13, -0.2, 0.12));
    const bob = Math.max(0, Math.sin(guide.t * 5)) * 0.045;
    guide.hand.position.y -= bob;
  } else {
    const k = (Math.sin(guide.t * 2.4 - Math.PI / 2) + 1) / 2; // 0..1 を往復
    guide.hand.position.lerpVectors(m.a, m.b, k);
  }
}

// ---------- リプレイボタン（矢印アイコンのみ） ----------
const replayBtn = new THREE.Sprite(new THREE.SpriteMaterial({ map: TX.replayTexture(), transparent: true, depthTest: false }));
replayBtn.scale.set(0.16, 0.16, 1);
replayBtn.visible = false;
replayBtn.renderOrder = 30;
camera.add(replayBtn);

// ---------- カメラ制御 ----------
const camState = {
  pos: new THREE.Vector3(), look: new THREE.Vector3(),
  fromPos: new THREE.Vector3(), fromLook: new THREE.Vector3(),
  toPos: new THREE.Vector3(), toLook: new THREE.Vector3(),
  t: 1, dur: 1.4,
};
function isPortrait() { return window.innerWidth < window.innerHeight; }
// フェーズ内で注目点へゆっくり寄せる横方向オフセット
const camFocus = { current: 0, target: 0 };
function setCamFocus(x) { camFocus.target = x; }
function poseFor(phase) {
  const p = isPortrait();
  const wideZ = p ? 5.9 : 4.6;
  const wideY = p ? 1.6 : 1.5;
  switch (phase) {
    case 'COVER': {
      // 養生対象ごとにカメラを寄せる（縦画面でも必ず画面内に入る）
      const poses = [
        { pos: [-0.45, 1.35, p ? 4.9 : 4.2], look: [-1.05, 0.65, -1.0], fov: p ? 58 : 50 },
        { pos: [0.45, 1.3, p ? 4.6 : 4.0], look: [1.05, 0.55, -0.75], fov: p ? 58 : 50 },
        { pos: [0.35, 1.3, p ? 4.2 : 3.6], look: [1.85, 0.75, 0.55], fov: p ? 58 : 50 },
        { pos: [0, 1.85, p ? 5.0 : 4.5], look: [0, 0.1, 0.3], fov: p ? 60 : 52 },
      ];
      return poses[Math.min(state.coverIdx, 3)];
    }
    case 'INTRO':
    case 'PULL':
    case 'REVEAL':
    case 'PLAY':
      return { pos: [0, wideY, wideZ], look: [0, 1.02, -0.6], fov: p ? 62 : 52 };
    case 'HOLES':
      return { pos: [0.25, 1.42, p ? 1.7 : 1.1], look: [0.18, 1.42, ROOM.backZ], fov: p ? 58 : 50 };
    case 'PEEL':
    case 'PAINT':
    case 'PATTERN':
      return { pos: [0, 1.4, p ? 2.9 : 2.1], look: [0, 1.32, ROOM.backZ], fov: p ? 60 : 52 };
    case 'PICK':
      return { pos: [0.5, 1.15, p ? 3.6 : 3.2], look: [1.35, 0.25, 1.35], fov: p ? 58 : 50 };
    case 'LIGHT':
      return { pos: [0, 1.35, p ? 3.2 : 2.6], look: [0, 2.1, -0.35], fov: p ? 60 : 52 };
    case 'CURTAIN':
      return { pos: [1.25, 1.4, p ? 1.1 : 0.7], look: [ROOM.leftX, 1.4, -0.62], fov: p ? 60 : 54 };
    default:
      return { pos: [0, wideY, wideZ], look: [0, 1.05, -0.6], fov: p ? 62 : 52 };
  }
}
function moveCameraTo(phase, snap = false) {
  camFocus.target = 0;
  const pose = poseFor(phase);
  camState.toPos.fromArray(pose.pos);
  camState.toLook.fromArray(pose.look);
  camera.fov = pose.fov;
  camera.updateProjectionMatrix();
  if (snap) {
    camState.t = 1;
    camState.pos.copy(camState.toPos);
    camState.look.copy(camState.toLook);
  } else {
    camState.fromPos.copy(camState.pos);
    camState.fromLook.copy(camState.look);
    camState.t = 0;
  }
}
function updateCamera(dt, time) {
  if (camState.t < 1) {
    camState.t = Math.min(1, camState.t + dt / camState.dur);
    const e = camState.t * camState.t * (3 - 2 * camState.t);
    camState.pos.lerpVectors(camState.fromPos, camState.toPos, e);
    camState.look.lerpVectors(camState.fromLook, camState.toLook, e);
  }
  // 注目点への横パン（塗り残し・次のターゲットが必ず画面に入るように）
  camFocus.current += (camFocus.target - camFocus.current) * Math.min(1, dt * 2.4);
  // わずかな揺れで視差を感じさせる
  const sway = phase === 'REVEAL' ? 0.02 : 0.05;
  camera.position.set(
    camState.pos.x + camFocus.current + Math.sin(time * 0.31) * sway,
    camState.pos.y + Math.sin(time * 0.23 + 1) * sway * 0.5,
    camState.pos.z
  );
  camera.lookAt(camState.look.x + camFocus.current, camState.look.y, camState.look.z);
}

// ---------- フェーズ管理 ----------
let phase = 'INTRO';
const state = {
  coverIdx: 0,                 // 養生の進み（0:ソファ 1:テーブル 2:棚 3:床）
  holesFilled: 0,
  paintColor: 0xf6a8b8,
  coverage: null, coveredCells: 0, totalCells: 0,
  painting: false,
  patternDone: 0,
  pull: 0,
  revealT: -1,
  lightMix: 0,
  playTime: 0,
};

const COVER_TARGETS = [
  { key: 'sofa', pos: () => new THREE.Vector3(-1.05, 0.85, -1.0) },
  { key: 'table', pos: () => new THREE.Vector3(1.05, 0.8, -0.75) },
  { key: 'shelf', pos: () => new THREE.Vector3(1.85, 1.2, 0.55) },
  { key: 'floor', pos: () => new THREE.Vector3(0, 0.25, 0.6) },
];

const PATTERN_SPOTS = [
  [-1.45, 1.9], [0, 2.0], [1.45, 1.9],
  [-1.45, 1.28], [0, 1.35], [1.45, 1.28],
];
const patternMarks = [];

let wallSheetRecs = { left: null, right: null, back: null };

function setPhase(next, delay = 0) {
  const go = () => {
    phase = next;
    moveCameraTo(next);
    onPhaseStart(next);
  };
  if (delay > 0) setTimeout(go, delay * 1000);
  else go();
}

function onPhaseStart(p) {
  if (p === 'COVER') {
    setGuideForCover();
  } else if (p === 'HOLES') {
    trowel.visible = true;
    trowel.position.set(0.6, 0.7, -1.2);
    setGuideForHoles();
  } else if (p === 'PEEL') {
    trowel.visible = false;
    setGuideForPeel();
  } else if (p === 'PICK') {
    setGuideForPick();
  } else if (p === 'PAINT') {
    rollerCyl.material.color.set(state.paintColor);
    initCoverage();
    setGuideForPaint();
  } else if (p === 'PATTERN') {
    roller.visible = false;
    makePatternMarks();
    setGuideForPattern();
  } else if (p === 'LIGHT') {
    setGuide({ type: 'tap', a: new THREE.Vector3(0, 2.15, -0.3) });
  } else if (p === 'CURTAIN') {
    animateOldCurtainAway();
    liftWallSheet('left');
    setGuide({ type: 'tap', a: new THREE.Vector3(ROOM.leftX + 0.25, WIN.y1 + 0.1, -0.6) });
  } else if (p === 'PULL') {
    dropWallSheetBack('left');
    const a = new THREE.Vector3(0, 0.35, 1.7);
    setGuide({ type: 'drag', a, b: new THREE.Vector3(0, 2.0, 0.6) });
  } else if (p === 'REVEAL') {
    setGuide(null);
    startReveal();
  } else if (p === 'PLAY') {
    setGuide(null);
  }
}

// ---------- ガイド設定ヘルパー ----------
function setGuideForCover() {
  const t = COVER_TARGETS[state.coverIdx];
  if (t) setGuide({ type: 'tap', a: t.pos() });
}
function setGuideForHoles() {
  const h = holes.find(h => !h.filled);
  if (h) {
    setGuide({ type: 'tap', a: new THREE.Vector3(h.x, h.y, ROOM.backZ + 0.05) });
    setCamFocus(h.x * 0.6);
  }
}
function setGuideForPeel() {
  const s = strips.find(s => !s.done);
  if (s) {
    const x = s.group.position.x;
    setGuide({
      type: 'drag',
      a: new THREE.Vector3(x, 2.0, ROOM.backZ + 0.15),
      b: new THREE.Vector3(x, 0.6, ROOM.backZ + 0.25),
    });
    setCamFocus(x * 0.8);
  }
}
function setGuideForPick() {
  setGuide({ type: 'tap', a: room.buckets[0].position.clone().add(new THREE.Vector3(0, 0.3, 0)) });
}
function setGuideForPaint() {
  setGuide({
    type: 'drag',
    a: new THREE.Vector3(-0.8, 2.1, ROOM.backZ + 0.15),
    b: new THREE.Vector3(-0.8, 0.5, ROOM.backZ + 0.15),
  });
}
function setGuideForPattern() {
  const i = state.patternDone;
  if (i < PATTERN_SPOTS.length) {
    const [x, y] = PATTERN_SPOTS[i];
    setGuide({ type: 'tap', a: new THREE.Vector3(x, y, ROOM.backZ + 0.05) });
    setCamFocus(x * 0.8);
  }
}
// 塗り残しのある列へカメラを寄せる（PAINT中に定期的に呼ぶ）
function focusUnpainted() {
  if (!state.coverage) return;
  let bestX = null;
  for (let gx = 0; gx < state.covNx && bestX === null; gx++) {
    for (let gy = 0; gy < state.covNy; gy++) {
      if (!state.coverage[gy * state.covNx + gx]) {
        bestX = (gx + 0.5) / state.covNx * ROOM.W - ROOM.W / 2;
        break;
      }
    }
  }
  if (bestX !== null) setCamFocus(THREE.MathUtils.clamp(bestX * 0.8, -1.7, 1.7));
}

// ---------- 養生（カバー）フェーズ ----------
function doCover(key) {
  sfx.whoosh();
  setTimeout(() => sfx.clothSettle(), 350);
  if (key === 'sofa') {
    sheetMgr.drapeOver(room.furniture.sofa, 2.35, 1.5, -1.05, -1.0, 1.1).tag = 'sofa';
  } else if (key === 'table') {
    sheetMgr.drapeOver(room.furniture.table, 1.4, 1.4, 1.05, -0.75, 0.78).tag = 'table';
  } else if (key === 'shelf') {
    sheetMgr.drapeOver(room.furniture.shelf, 0.78, 1.3, 1.86, 0.55, 1.2).tag = 'shelf';
  } else if (key === 'floor') {
    sheetMgr.coverFloor().tag = 'floor';
  }
  // シートの山がひとつ減る
  if (room.sheetStack.children.length > 0) {
    const top = room.sheetStack.children[room.sheetStack.children.length - 1];
    room.sheetStack.remove(top);
  }
  state.coverIdx++;
  if (state.coverIdx >= COVER_TARGETS.length) {
    setGuide(null);
    // 左右の壁に半透明シートを吊るす
    setTimeout(() => {
      sfx.whoosh(true);
      wallSheetRecs.left = sheetMgr.hangOnWall('left', { w: ROOM.D - 0.1, h: ROOM.H - 0.15 });
      wallSheetRecs.left.tag = 'left';
      sheetMgr.dropWallSheet(wallSheetRecs.left);
    }, 700);
    setTimeout(() => {
      sfx.whoosh(true);
      wallSheetRecs.right = sheetMgr.hangOnWall('right', { w: ROOM.D - 0.1, h: ROOM.H - 0.15 });
      wallSheetRecs.right.tag = 'right';
      sheetMgr.dropWallSheet(wallSheetRecs.right);
    }, 1300);
    setTimeout(() => sfx.chime(), 2100);
    setPhase('HOLES', 2.6);
  } else {
    setGuideForCover();
    moveCameraTo('COVER'); // 次の家具へカメラを寄せる
  }
}

// ---------- 穴埋めフェーズ ----------
function fillHole(h) {
  if (h.filled) return;
  h.filled = true;
  state.holesFilled++;
  // こてが穴へ動いてひと塗り
  const target = new THREE.Vector3(h.x + 0.1, h.y - 0.05, ROOM.backZ + 0.09);
  animateVec(trowel.position, target, 0.28, () => {
    sfx.squish();
    particles.dust(new THREE.Vector3(h.x, h.y, ROOM.backZ + 0.1));
    h.anim = 0.001; // パッチ拡大開始
    h.patch.visible = true;
    // こてのひと塗りモーション
    const p0 = trowel.position.clone();
    animateVec(trowel.position, p0.clone().add(new THREE.Vector3(-0.18, 0.12, 0)), 0.3);
  });
  if (state.holesFilled >= holes.length) {
    setGuide(null);
    setTimeout(() => sfx.chime(), 800);
    setPhase('PEEL', 1.5);
  } else {
    setTimeout(setGuideForHoles, 400);
  }
}

// ---------- 壁紙はがしフェーズ ----------
let peelActive = null;
function finishStrip(s) {
  if (s.done) return;
  s.done = true;
  sfx.paperFall();
  particles.dust(new THREE.Vector3(s.group.position.x, 0.6, ROOM.backZ + 0.2), 10);
  s.falling = 0.001;
  const remaining = strips.filter(x => !x.done).length;
  if (remaining === 0) {
    setGuide(null);
    setTimeout(() => sfx.chime(), 700);
    setPhase('PICK', 1.4);
  } else {
    setGuideForPeel();
  }
}

// ---------- 色えらび ----------
function pickBucket(bucket) {
  state.paintColor = bucket.userData.color;
  sfx.bucket();
  // ふたがポンと飛ぶ
  const lid = bucket.userData.lid;
  const start = lid.position.clone();
  let t = 0;
  const fly = () => {
    t += 0.03;
    lid.position.set(start.x + t * 1.2, start.y + Math.sin(Math.min(t * 2.4, Math.PI)) * 0.5 - t * t * 1.2, start.z + t * 0.5);
    lid.rotation.x += 0.2; lid.rotation.z += 0.13;
    if (t < 1) requestAnimationFrame(fly);
    else lid.visible = false;
  };
  fly();
  particles.burst(bucket.position.clone().add(new THREE.Vector3(0, 0.35, 0)), { color: bucket.userData.color, count: 12 });
  setGuide(null);
  setPhase('PAINT', 1.0);
}

// ---------- ペンキ塗りフェーズ ----------
const paintPx = { w: 1024, h: 640 };
function initCoverage() {
  const nx = 32, ny = 20;
  state.coverage = new Uint8Array(nx * ny);
  state.coveredCells = 0;
  state.totalCells = nx * ny;
  state.covNx = nx; state.covNy = ny;
}
function wallToPx(x, y) {
  return [((x + ROOM.W / 2) / ROOM.W) * paintPx.w, (1 - y / ROOM.H) * paintPx.h];
}
function paintStroke(x0, y0, x1, y1) {
  const g = room.paintCtx;
  const col = new THREE.Color(state.paintColor);
  const rgb = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},`;
  const [px0, py0] = wallToPx(x0, y0);
  const [px1, py1] = wallToPx(x1, y1);
  const dist = Math.hypot(px1 - px0, py1 - py0);
  const steps = Math.max(1, Math.ceil(dist / 12));
  const R = 64;
  for (let i = 0; i <= steps; i++) {
    const px = px0 + (px1 - px0) * (i / steps);
    const py = py0 + (py1 - py0) * (i / steps);
    const gr = g.createRadialGradient(px, py, R * 0.45, px, py, R);
    gr.addColorStop(0, rgb + '0.95)');
    gr.addColorStop(0.8, rgb + '0.55)');
    gr.addColorStop(1, rgb + '0)');
    g.fillStyle = gr;
    g.beginPath(); g.arc(px, py, R, 0, Math.PI * 2); g.fill();
    // カバレッジ更新（ローラー半径ぶんのセルをまとめて塗り済みに）
    const Rm = R * 1.4;
    const gx0 = Math.max(0, Math.floor((px - Rm) / paintPx.w * state.covNx));
    const gx1 = Math.min(state.covNx - 1, Math.floor((px + Rm) / paintPx.w * state.covNx));
    const gy0 = Math.max(0, Math.floor((py - Rm) / paintPx.h * state.covNy));
    const gy1 = Math.min(state.covNy - 1, Math.floor((py + Rm) / paintPx.h * state.covNy));
    for (let gy = gy0; gy <= gy1; gy++) {
      for (let gx = gx0; gx <= gx1; gx++) {
        const idx = gy * state.covNx + gx;
        if (!state.coverage[idx]) {
          state.coverage[idx] = 1;
          state.coveredCells++;
        }
      }
    }
  }
  room.paintTexture.needsUpdate = true;
  if (state.coveredCells / state.totalCells > 0.5 && phase === 'PAINT') {
    completePaint();
  }
}
function completePaint() {
  if (state.paintDone) return;
  state.paintDone = true;
  rollerStop();
  setGuide(null);
  // 残りをふわっと塗り上げる
  const g = room.paintCtx;
  const col = new THREE.Color(state.paintColor);
  let alpha = 0;
  const fill = () => {
    alpha += 0.09;
    g.fillStyle = `rgba(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0},${Math.min(0.35, alpha)})`;
    g.fillRect(0, 0, paintPx.w, paintPx.h);
    room.paintTexture.needsUpdate = true;
    if (alpha < 1.15) requestAnimationFrame(fill);
    else {
      // 最後にむらのない仕上げ塗り＋かすかなローラーの艶
      g.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`;
      g.fillRect(0, 0, paintPx.w, paintPx.h);
      g.fillStyle = 'rgba(255,255,255,0.05)';
      for (let x = 0; x < paintPx.w; x += 64) g.fillRect(x, 0, 30, paintPx.h);
      room.paintTexture.needsUpdate = true;
      // パテ跡もペンキの下に消える
      for (const h of holes) { h.patch.visible = false; h.hole.visible = false; }
    }
  };
  fill();
  sfx.chime();
  particles.burst(new THREE.Vector3(0, 1.6, ROOM.backZ + 0.3), { count: 18, speed: 1.4 });
  setPhase('PATTERN', 1.6);
}

// ---------- 模様スタンプ ----------
function makePatternMarks() {
  const ringTex = TX.ringTexture();
  for (const [x, y] of PATTERN_SPOTS) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: ringTex, transparent: true, opacity: 0.9, depthTest: false }));
    m.position.set(x, y, ROOM.backZ + 0.06);
    m.scale.set(0.3, 0.3, 1);
    room.root.add(m);
    patternMarks.push(m);
  }
}
function stampPattern(i) {
  const [x, y] = PATTERN_SPOTS[i];
  const g = room.paintCtx;
  const [px, py] = wallToPx(x, y);
  // 白い花＋黄色い芯
  g.save();
  g.translate(px, py);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    g.beginPath();
    g.ellipse(Math.cos(a) * 26, Math.sin(a) * 26, 17, 12, a, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#ffd166';
  g.beginPath(); g.arc(0, 0, 12, 0, Math.PI * 2); g.fill();
  g.restore();
  room.paintTexture.needsUpdate = true;
  const mark = patternMarks[i];
  if (mark) { room.root.remove(mark); patternMarks[i] = null; }
  sfx.stamp();
  particles.burst(new THREE.Vector3(x, y, ROOM.backZ + 0.15), { count: 10, speed: 0.8 });
  state.patternDone++;
  if (state.patternDone >= PATTERN_SPOTS.length) {
    setGuide(null);
    // 塗った壁を大きな布で隠す（お楽しみは最後まで）
    setTimeout(() => {
      sfx.whoosh(true);
      wallSheetRecs.back = sheetMgr.hangOnWall('back', { w: ROOM.W - 0.06, h: ROOM.H + 0.02, cloth: true });
      wallSheetRecs.back.tag = 'back';
      sheetMgr.dropWallSheet(wallSheetRecs.back);
    }, 900);
    setTimeout(() => sfx.chime(), 1700);
    setPhase('LIGHT', 2.2);
  } else {
    setGuideForPattern();
  }
}

// ---------- 照明・カーテンの取り付け ----------
function animateOldLampAway() {
  const lamp = room.oldLamp;
  let t = 0;
  bulbTargetI = 0;
  const anim = () => {
    t += 0.02;
    lamp.position.y = ROOM.H + t * 1.2;
    if (t < 1) requestAnimationFrame(anim);
    else lamp.visible = false;
  };
  anim();
}
let lampInstalled = false;
function installNewLamp() {
  if (lampInstalled) return;
  lampInstalled = true;
  sfx.install();
  // 古い電球を外して、新しいペンダントが包装ごしに柔らかく点く
  animateOldLampAway();
  setTimeout(() => {
    LIGHT_OLD.pendantI = 9;
    pendantLight.intensity = 9;
    room.newLampBulbMat.emissiveIntensity = 0.7;
  }, 1100);
  const lamp = room.newLamp;
  lamp.visible = true;
  // 包装された状態（白い袋）
  room.newLampShade.material.color.set(0xe8e9ea);
  room.newLampShade.material.roughness = 0.35;
  lamp.position.y = ROOM.H + 1.2;
  let t = 0;
  const anim = () => {
    t += 0.022;
    const e = 1 - Math.pow(1 - Math.min(1, t), 2);
    lamp.position.y = ROOM.H + 1.2 * (1 - e);
    lamp.rotation.z = Math.sin(t * 6) * 0.08 * (1 - t);
    if (t < 1) requestAnimationFrame(anim);
  };
  anim();
  particles.burst(new THREE.Vector3(0, 2.1, -0.3), { count: 10, speed: 0.7 });
  setGuide(null);
  setTimeout(() => sfx.chime(), 900);
  setPhase('CURTAIN', 1.6);
}
function animateOldCurtainAway() {
  const cur = room.oldCurtain;
  if (!cur.visible) return;
  let t = 0;
  const y0 = cur.position.y;
  const anim = () => {
    t += 0.025;
    cur.position.y = y0 - t * 1.4;
    cur.material.opacity = 1 - t;
    cur.material.transparent = true;
    if (t < 1) requestAnimationFrame(anim);
    else cur.visible = false;
  };
  anim();
  sfx.paperFall();
}
function liftWallSheet(kind) {
  const rec = wallSheetRecs[kind];
  if (!rec || rec.removed) return;
  rec.lifted = true;
  animateNum(v => { rec.mesh.position.y = (rec.baseY ?? rec.mesh.position.y0 ?? ROOM.H / 2 - 0.05) + v; }, 0, 2.3, 0.9);
  if (rec.baseY === undefined) rec.baseY = ROOM.H / 2 - 0.055;
}
function dropWallSheetBack(kind) {
  const rec = wallSheetRecs[kind];
  if (!rec || rec.removed || !rec.lifted) return;
  rec.lifted = false;
  sfx.whoosh();
  animateNum(v => { rec.mesh.position.y = (rec.baseY ?? ROOM.H / 2 - 0.055) + (2.3 - v); }, 0, 2.3, 0.9);
}
let curtainInstalled = false;
function installCurtain() {
  if (curtainInstalled) return;
  curtainInstalled = true;
  sfx.install();
  const cur = room.newCurtain;
  cur.visible = true;
  // 包装された見た目（無地の白）で入ってくる
  for (const p of room.newCurtainPanels) {
    p.userData.finalMat = p.material;
    p.material = new THREE.MeshStandardMaterial({ color: 0xe9ebec, roughness: 0.45, side: THREE.DoubleSide });
  }
  const z0 = cur.position.z;
  cur.position.z = z0 + 2.6;
  animateNum(v => { cur.position.z = z0 + 2.6 - v; }, 0, 2.6, 1.0);
  particles.burst(new THREE.Vector3(ROOM.leftX + 0.3, WIN.y1, -0.6), { count: 10, speed: 0.7 });
  setGuide(null);
  setTimeout(() => sfx.chime(), 1100);
  setPhase('PULL', 1.8);
}

// ---------- 大公開 ----------
let bulbTargetI = LIGHT_OLD.bulbI;
function startReveal() {
  state.revealT = 0;
  sfx.whoosh(true);
  setTimeout(() => sfx.fanfare(), 400);
  musicToBright();
  // 全シートが順に飛び、下から新しい部屋が現れる
  sheetMgr.flyOffAll((rec, wp) => {
    sfx.whoosh();
    particles.burst(wp.add(new THREE.Vector3(0, 0.4, 0)), { count: 12, speed: 1.2 });
    switch (rec.tag) {
      case 'sofa': room.swapSofa(); room.bear.visible = true; break;
      case 'table': room.swapTable(); room.flowers.visible = true; break;
      case 'shelf': room.swapShelf(); break;
      case 'floor': room.swapFloor(); break;
      case 'left': room.swapWalls(state.paintColor); room.swapWindowFrame(); break;
      case 'right': room.swapWalls(state.paintColor); break;
      case 'back': room.swapSkirt(); room.swapCeil(); break;
    }
  });
  // 照明・カーテンの包みを外す
  setTimeout(() => {
    room.newLampShade.material.color.set(0xf8b8c4);
    room.newLampShade.material.roughness = 0.5;
    room.newLampBulbMat.emissiveIntensity = 1.4;
    popScale(room.newLamp);
    for (const p of room.newCurtainPanels) {
      if (p.userData.finalMat) p.material = p.userData.finalMat;
    }
    popScale(room.newCurtain);
    particles.burst(new THREE.Vector3(0, 2.0, -0.3), { count: 14 });
    particles.burst(new THREE.Vector3(ROOM.leftX + 0.3, 1.5, -0.6), { count: 14 });
  }, 1400);
  // 道具たちは片付く
  setTimeout(() => {
    for (const obj of [room.ladder, room.sheetStack, ...room.buckets, trowel, roller]) {
      shrinkAway(obj);
    }
  }, 1800);
  // 紙ふぶき
  setTimeout(() => {
    particles.confettiShower(new THREE.Vector3(0, 1.2, 0), 56);
  }, 1200);
  setTimeout(() => setPhase('PLAY'), 5200);
}
function popScale(obj) {
  let t = 0;
  const anim = () => {
    t += 0.06;
    const s = 1 + Math.sin(Math.min(t, 1) * Math.PI) * 0.12;
    obj.scale.set(s, s, s);
    if (t < 1) requestAnimationFrame(anim);
    else obj.scale.set(1, 1, 1);
  };
  anim();
}
function shrinkAway(obj) {
  let t = 0;
  const anim = () => {
    t += 0.03;
    const s = Math.max(0.001, 1 - t);
    obj.scale.set(s, s, s);
    if (t < 1) requestAnimationFrame(anim);
    else obj.visible = false;
  };
  anim();
}

// ---------- 汎用アニメーションヘルパー ----------
function animateVec(vec, target, dur, onDone) {
  const from = vec.clone();
  const t0 = performance.now();
  const anim = () => {
    const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
    const e = t * t * (3 - 2 * t);
    vec.lerpVectors(from, target, e);
    if (t < 1) requestAnimationFrame(anim);
    else if (onDone) onDone();
  };
  anim();
}
function animateNum(setter, from, to, dur, onDone) {
  const t0 = performance.now();
  const anim = () => {
    const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
    const e = t * t * (3 - 2 * t);
    setter(from + (to - from) * e);
    if (t < 1) requestAnimationFrame(anim);
    else if (onDone) onDone();
  };
  anim();
}

// ---------- 入力 ----------
const pointer = { down: false, id: null, x: 0, y: 0, lastX: 0, lastY: 0, world: new THREE.Vector3() };
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const backWallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -ROOM.backZ);

function setNdc(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
function raycastHit(objects) {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(objects, true);
  return hits.length ? hits[0] : null;
}
function wallPoint() {
  raycaster.setFromCamera(ndc, camera);
  const p = new THREE.Vector3();
  raycaster.ray.intersectPlane(backWallPlane, p);
  return p;
}
// タップ位置がターゲットの画面上の近くか（NDC距離）
function screenNear(worldPos, maxDist) {
  const v = worldPos.clone().project(camera);
  return Math.hypot((v.x - ndc.x) * camera.aspect, v.y - ndc.y) < maxDist * Math.max(1, camera.aspect);
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  unlockAudio();
  if (pointer.down) return; // 一指操作：最初の指だけ
  pointer.down = true; pointer.id = e.pointerId;
  pointer.x = pointer.lastX = e.clientX;
  pointer.y = pointer.lastY = e.clientY;
  setNdc(e);
  onTouchStart(e);
});
renderer.domElement.addEventListener('pointermove', (e) => {
  if (!pointer.down || e.pointerId !== pointer.id) return;
  pointer.lastX = pointer.x; pointer.lastY = pointer.y;
  pointer.x = e.clientX; pointer.y = e.clientY;
  setNdc(e);
  onTouchMove(e);
});
const endPointer = (e) => {
  if (!pointer.down || (e.pointerId !== undefined && e.pointerId !== pointer.id)) return;
  pointer.down = false; pointer.id = null;
  onTouchEnd(e);
};
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);
document.addEventListener('gesturestart', (e) => e.preventDefault());

let dragState = null;

function onTouchStart() {
  // リプレイ
  if (replayBtn.visible) {
    const hit = raycastHit([replayBtn]);
    if (hit) { location.reload(); return; }
  }
  if (phase === 'COVER') {
    const t = COVER_TARGETS[state.coverIdx];
    if (!t) return;
    // 対象への直接ヒット、または画面上でターゲットの近く（やさしい判定）
    const groups = { sofa: room.furniture.sofa, table: room.furniture.table, shelf: room.furniture.shelf };
    let ok;
    if (t.key === 'floor') {
      ok = !!raycastHit([room.floor]) || screenNear(t.pos(), 0.5);
    } else {
      ok = !!raycastHit([groups[t.key]]) || screenNear(t.pos(), 0.34);
    }
    if (ok) { sfx.pop(); doCover(t.key); }
    else sfx.tap();
  } else if (phase === 'HOLES') {
    const hit = raycastHit(holes.filter(h => !h.filled).map(h => h.hit));
    if (hit) {
      const h = holes.find(h => h.hit === hit.object);
      if (h) fillHole(h);
    } else {
      const near = holes.find(h => !h.filled && screenNear(new THREE.Vector3(h.x, h.y, ROOM.backZ), 0.2));
      if (near) fillHole(near);
    }
  } else if (phase === 'PEEL') {
    const hit = raycastHit(strips.filter(s => !s.done && !s.falling).map(s => s.hit));
    if (hit) {
      const s = strips.find(s => s.hit === hit.object);
      if (s) {
        peelActive = s;
        dragState = { startY: pointer.y, startP: s.p };
        sfx.peel(s.p);
      }
    }
  } else if (phase === 'PICK') {
    const hit = raycastHit(room.buckets);
    if (hit) {
      let g = hit.object;
      while (g.parent && !room.buckets.includes(g)) g = g.parent;
      if (room.buckets.includes(g)) pickBucket(g);
    }
  } else if (phase === 'PAINT') {
    if (state.paintDone) return;
    state.painting = true;
    roller.visible = true;
    rollerStart();
    const p = wallPoint();
    if (p) {
      dragState = { last: p.clone() };
      paintAt(p, p);
    }
  } else if (phase === 'PATTERN') {
    const p = wallPoint();
    if (p) {
      for (let i = 0; i < PATTERN_SPOTS.length; i++) {
        if (!patternMarks[i]) continue;
        const [x, y] = PATTERN_SPOTS[i];
        if (Math.hypot(p.x - x, p.y - y) < 0.45) { stampPattern(i); break; }
      }
    }
  } else if (phase === 'LIGHT') {
    // 天井の光る場所ならどこでも
    installNewLamp();
  } else if (phase === 'CURTAIN') {
    installCurtain();
  } else if (phase === 'PULL') {
    dragState = { sx: pointer.x, sy: pointer.y, base: state.pull };
  } else if (phase === 'PLAY') {
    const hit = raycastHit([room.furniture.sofa, room.furniture.table, room.furniture.shelf, room.bear, room.flowers]);
    if (hit) {
      let g = hit.object;
      while (g.parent && g.parent !== room.root) g = g.parent;
      popScale(g);
      sfx.happy();
      const wp = new THREE.Vector3();
      g.getWorldPosition(wp);
      particles.burst(wp.add(new THREE.Vector3(0, 0.8, 0)), { count: 10, speed: 0.9 });
    }
  }
}

function onTouchMove() {
  if (phase === 'PEEL' && peelActive && dragState) {
    const dy = (pointer.y - dragState.startY) / window.innerHeight;
    const before = peelActive.p;
    peelActive.p = THREE.MathUtils.clamp(dragState.startP + dy * 2.2, 0, 1);
    if (peelActive.p - before > 0.02) sfx.peel(peelActive.p);
    updateStripCurl(peelActive);
    if (peelActive.p >= 0.99) {
      finishStrip(peelActive);
      peelActive = null;
      dragState = null;
    }
  } else if (phase === 'PAINT' && state.painting && dragState && !state.paintDone) {
    const p = wallPoint();
    if (p) {
      paintAt(dragState.last, p);
      const speed = Math.hypot(pointer.x - pointer.lastX, pointer.y - pointer.lastY) / window.innerHeight;
      rollerMove(speed);
      dragState.last = p.clone();
    }
  } else if (phase === 'PULL' && dragState) {
    const d = Math.hypot(pointer.x - dragState.sx, pointer.y - dragState.sy);
    const amount = THREE.MathUtils.clamp(
      dragState.base + d / (Math.min(window.innerWidth, window.innerHeight) * 0.5), 0, 1);
    if (amount - state.pull > 0.08) sfx.bigPullCreak(amount);
    state.pull = amount;
    sheetMgr.setPull(amount);
    if (amount >= 1) {
      dragState = null;
      setPhase('REVEAL');
    }
  }
}

function onTouchEnd() {
  if (phase === 'PEEL' && peelActive) {
    const s = peelActive;
    peelActive = null;
    dragState = null;
    if (s.p > 0.32) {
      // じゅうぶん剥がれたら最後まで自動で
      const step = () => {
        if (s.done) return;
        s.p = Math.min(1, s.p + 0.045);
        updateStripCurl(s);
        sfx.peel(s.p);
        if (s.p >= 1) finishStrip(s);
        else requestAnimationFrame(step);
      };
      step();
    }
  } else if (phase === 'PAINT') {
    state.painting = false;
    rollerStop();
    dragState = null;
  } else if (phase === 'PULL' && dragState) {
    dragState = null;
    if (state.pull < 1) {
      // すこしだけ戻る（進捗は積み重なる：失敗なし）
      state.pull *= 0.85;
      sheetMgr.setPull(state.pull);
    }
  }
}

function paintAt(from, to) {
  const clampY = (y) => THREE.MathUtils.clamp(y, 0.1, ROOM.H - 0.05);
  const clampX = (x) => THREE.MathUtils.clamp(x, -ROOM.W / 2 + 0.05, ROOM.W / 2 - 0.05);
  paintStroke(clampX(from.x), clampY(from.y), clampX(to.x), clampY(to.y));
  roller.position.set(clampX(to.x), clampY(to.y), ROOM.backZ + 0.07);
  rollerCyl.rotation.x += (to.y - from.y) * -14;
  if (Math.random() < 0.15) sfx.rollerTick();
}

// ---------- INTRO：ちょっと部屋を見せてスタート ----------
setPhase('INTRO');
moveCameraTo('INTRO', true);
setTimeout(() => setPhase('COVER'), 2200);

// ---------- リサイズ ----------
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  moveCameraTo(phase, true);
});

// ---------- メインループ ----------
const clock = new THREE.Clock();
const colTmpA = new THREE.Color();
const colTmpB = new THREE.Color();
function lerpLights(mix) {
  const m = THREE.MathUtils.clamp(mix, 0, 1);
  hemi.color.lerpColors(colTmpA.set(LIGHT_OLD.hemiSky), colTmpB.set(LIGHT_NEW.hemiSky), m);
  hemi.groundColor.lerpColors(colTmpA.set(LIGHT_OLD.hemiGround), colTmpB.set(LIGHT_NEW.hemiGround), m);
  hemi.intensity = THREE.MathUtils.lerp(LIGHT_OLD.hemiI, LIGHT_NEW.hemiI, m);
  sun.color.lerpColors(colTmpA.set(LIGHT_OLD.sunColor), colTmpB.set(LIGHT_NEW.sunColor), m);
  sun.intensity = THREE.MathUtils.lerp(LIGHT_OLD.sunI, LIGHT_NEW.sunI, m);
  pendantLight.intensity = THREE.MathUtils.lerp(LIGHT_OLD.pendantI, LIGHT_NEW.pendantI, m);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(LIGHT_OLD.exposure, LIGHT_NEW.exposure, m);
  scene.fog.color.lerpColors(colTmpA.set(LIGHT_OLD.fogColor), colTmpB.set(LIGHT_NEW.fogColor), m);
  scene.background.lerpColors(colTmpA.set(LIGHT_OLD.bg), colTmpB.set(LIGHT_NEW.bg), m);
}

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const time = clock.elapsedTime;

  sheetMgr.update(dt);
  particles.update(dt);
  updateGuide(dt);
  updateCamera(dt, time);

  // 電球のちらつき（古い部屋の空気感）
  if (state.revealT < 0) {
    bulbLight.intensity = bulbTargetI * (0.92 + Math.sin(time * 11) * 0.04 + Math.sin(time * 27) * 0.04);
  }

  // パテのパッチ拡大
  for (const h of holes) {
    if (h.anim > 0 && h.anim < 1) {
      h.anim = Math.min(1, h.anim + dt * 2.6);
      const e = 1 - Math.pow(1 - h.anim, 3);
      h.patch.scale.set(e, e, 1);
      h.hole.material.opacity = 1 - e;
    }
  }

  // 剥がれた壁紙の落下
  for (const s of strips) {
    if (s.falling > 0 && s.falling < 1) {
      s.falling = Math.min(1, s.falling + dt * 1.4);
      const t = s.falling;
      s.group.position.y = (0.1 + 2.5 / 2) - t * t * 1.6;
      s.group.rotation.x = t * 0.7;
      s.front.material.opacity = 1 - Math.max(0, (t - 0.5) / 0.5);
      s.back.material.opacity = s.front.material.opacity;
      if (t >= 1) {
        s.group.visible = false;
      }
    }
  }

  // 塗り残しへカメラを寄せる
  if (phase === 'PAINT' && !state.paintDone) {
    state.focusTimer = (state.focusTimer || 0) + dt;
    if (state.focusTimer > 0.6) {
      state.focusTimer = 0;
      focusUnpainted();
    }
  }

  // 模様マークのパルス
  for (const m of patternMarks) {
    if (m) {
      const sc = 0.3 + Math.sin(time * 4 + m.position.x * 3) * 0.03;
      m.scale.set(sc, sc, 1);
    }
  }

  // 大公開のライト遷移
  if (state.revealT >= 0 && state.lightMix < 1) {
    state.revealT += dt;
    if (state.revealT > 0.8) {
      state.lightMix = Math.min(1, state.lightMix + dt / 2.2);
      lerpLights(state.lightMix);
    }
  }

  // 自由あそび：リプレイボタン表示
  if (phase === 'PLAY') {
    state.playTime += dt;
    if (state.playTime > 6 && !replayBtn.visible) {
      replayBtn.visible = true;
      replayBtn.position.set(0.32 * camera.aspect, -0.42, -1);
    }
    // カーテンがそよぐ
    for (const p of room.newCurtainPanels) {
      p.rotation.x = Math.sin(time * 1.1 + p.position.z) * 0.03;
    }
    if (room.newLamp.visible) {
      room.newLamp.rotation.z = Math.sin(time * 0.9) * 0.02;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
lerpLights(0);
tick();

// ---------- 試遊用フック（画面座標のヒントを返す） ----------
function project(v3) {
  const v = v3.clone().project(camera);
  return { x: (v.x + 1) / 2 * window.innerWidth, y: (1 - (v.y + 1) / 2) * window.innerHeight };
}
window.__game = {
  get phase() { return phase; },
  get pointerDown() { return pointer.down; },
  covRatio() { return state.coverage ? state.coveredCells / state.totalCells : -1; },
  state,
  project: (x, y, z) => project(new THREE.Vector3(x, y, z)),
  getHint() {
    switch (phase) {
      case 'COVER': {
        const t = COVER_TARGETS[state.coverIdx];
        if (!t) return null;
        return { type: 'tap', ...project(t.pos()) };
      }
      case 'HOLES': {
        const h = holes.find(h => !h.filled);
        if (!h) return null;
        return { type: 'tap', ...project(new THREE.Vector3(h.x, h.y, ROOM.backZ + 0.02)) };
      }
      case 'PEEL': {
        const s = strips.find(s => !s.done && !s.falling);
        if (!s) return null;
        const a = project(new THREE.Vector3(s.group.position.x, 2.2, ROOM.backZ + 0.05));
        const b = project(new THREE.Vector3(s.group.position.x, 0.4, ROOM.backZ + 0.05));
        return { type: 'drag', ...a, x2: b.x, y2: b.y };
      }
      case 'PICK': {
        const b = room.buckets[0];
        return { type: 'tap', ...project(b.position.clone().add(new THREE.Vector3(0, 0.15, 0))) };
      }
      case 'PAINT': {
        // 未塗装セルを塗りに行く
        for (let gy = 0; gy < state.covNy; gy++) {
          for (let gx = 0; gx < state.covNx; gx++) {
            if (!state.coverage[gy * state.covNx + gx]) {
              const wx = (gx + 0.5) / state.covNx * ROOM.W - ROOM.W / 2;
              const a = project(new THREE.Vector3(wx, 2.55, ROOM.backZ));
              const b = project(new THREE.Vector3(wx, 0.12, ROOM.backZ));
              return { type: 'drag', ...a, x2: b.x, y2: b.y };
            }
          }
        }
        return null;
      }
      case 'PATTERN': {
        for (let i = 0; i < PATTERN_SPOTS.length; i++) {
          if (patternMarks[i]) {
            return { type: 'tap', ...project(new THREE.Vector3(PATTERN_SPOTS[i][0], PATTERN_SPOTS[i][1], ROOM.backZ + 0.02)) };
          }
        }
        return null;
      }
      case 'LIGHT':
        return { type: 'tap', ...project(new THREE.Vector3(0, 2.1, -0.3)) };
      case 'CURTAIN':
        return { type: 'tap', ...project(new THREE.Vector3(ROOM.leftX + 0.3, WIN.y1, -0.6)) };
      case 'PULL': {
        const a = project(new THREE.Vector3(0, 0.3, 1.7));
        const b = project(new THREE.Vector3(2.0, 1.4, 1.7));
        return { type: 'drag', ...a, x2: b.x, y2: b.y };
      }
      default:
        return null;
    }
  },
};
