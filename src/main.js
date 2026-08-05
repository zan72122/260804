// ふんすいを なおそう！ — fountain maintenance 3D game for little hands.
// One-finger taps only, no failure states. Fix the pumps underground,
// then turn the giant valve and watch the plaza become a water show.
import * as THREE from 'three';
import { buildRoom, PIPE_Y, PIPE_Z } from './room.js';
import { buildPlaza, POOL_Y, POOL_R } from './plaza.js';
import { Jet, RingWaves, Mist, HoseBubbles, JET_SCALE } from './water.js';
import { UI } from './ui.js';
import { ensureAudio, sfx, setWaterBed, startMusic } from './audio.js';
import { dotSprite } from './textures.js';

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.style.cssText = 'margin:0;overflow:hidden;background:#000;touch-action:none;';
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 220);

// ---------------------------------------------------------------- scenes
const roomScene = new THREE.Scene();
roomScene.background = new THREE.Color(0x0b1114);
roomScene.fog = new THREE.Fog(0x0b1114, 6, 20);
const { group: roomG, parts: room } = buildRoom();
roomScene.add(roomG);
roomScene.add(new THREE.AmbientLight(0x2c3a44, 0.8));
const roomHemi = new THREE.HemisphereLight(0x33454f, 0x1a1512, 0.7);
roomScene.add(roomHemi);
const spot = new THREE.SpotLight(0xcfe8ff, 60, 14, 0.55, 0.65, 1.6);
spot.position.set(0, 3.9, 0.5);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
const spotTarget = new THREE.Object3D();
roomScene.add(spotTarget);
spot.target = spotTarget;
roomScene.add(spot);

const plazaScene = new THREE.Scene();
plazaScene.fog = new THREE.Fog(0x3e2f38, 26, 75);
const { group: plazaG, parts: plaza } = buildPlaza();
plazaScene.add(plazaG);

let activeScene = plazaScene; // title shows the quiet plaza

// ---------------------------------------------------------------- helpers
const tweens = [];
function tween(dur, fn, { ease = (k) => k * k * (3 - 2 * k), onDone = null, delay = 0 } = {}) {
  tweens.push({ dur, fn, ease, onDone, t: -delay });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    if (tw.t < 0) continue;
    const k = Math.min(1, tw.t / tw.dur);
    tw.fn(tw.ease(k));
    if (k >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
  }
}

const testJets = []; // debug-only jets (see window.__game.testJet)

// tap sparkles (feedback for every touch)
const sparkPool = [];
{
  const map = dotSprite();
  for (let i = 0; i < 24; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map, color: 0xfff2b0, transparent: true, opacity: 0, depthWrite: false,
      depthTest: false, blending: THREE.AdditiveBlending,
    }));
    s.renderOrder = 50;
    sparkPool.push({ s, t: 1 });
  }
}
function attachSparks(scene) { sparkPool.forEach(p => scene.add(p.s)); }
attachSparks(roomScene);
function sparkle(pos, color = 0xfff2b0, size = 0.5) {
  for (let n = 0; n < 5; n++) {
    const p = sparkPool.find(q => q.t >= 1);
    if (!p) return;
    p.t = 0;
    p.s.material.color.set(color);
    p.s.position.copy(pos);
    p.vx = (Math.random() - 0.5) * 1.6;
    p.vy = Math.random() * 1.8 + 0.4;
    p.vz = (Math.random() - 0.5) * 1.6;
    p.size = size * (0.5 + Math.random() * 0.8);
  }
}
function updateSparks(dt) {
  for (const p of sparkPool) {
    if (p.t >= 1) { p.s.material.opacity = 0; continue; }
    p.t = Math.min(1, p.t + dt / 0.7);
    p.s.position.x += p.vx * dt;
    p.s.position.y += (p.vy - p.t * 2.2) * dt;
    p.s.position.z += p.vz * dt;
    p.s.material.opacity = (1 - p.t) * 0.9;
    p.s.scale.setScalar(p.size * (0.4 + p.t * 0.8));
  }
}

// ---------------------------------------------------------------- camera rig
const camDefs = {
  title: { pos: [11, 7.5, 14], look: [0, 1.2, 0] },
  overview: { pos: [0, 2.0, 6.4], look: [0, 1.4, -2.4] },
  pipes: { pos: [-3.1, 1.6, 0.6], look: [-3.1, 1.0, -3.1] },
  clog: { pos: [-0.4, 1.55, 0.3], look: [-0.4, 1.0, -3.1] },
  nozzle: { pos: [1.35, 1.75, 0.9], look: [1.35, 1.05, -2.15] },
  lights: { pos: [3.3, 1.7, 1.0], look: [3.3, 0.95, -2.15] },
  valve: { pos: [3.9, 1.85, 0.6], look: [4.85, 1.75, -2.7] },
};
const camPos = new THREE.Vector3(11, 7.5, 14);
const camLook = new THREE.Vector3(0, 1.2, 0);
const camPosGoal = camPos.clone();
const camLookGoal = camLook.clone();
let camLerp = 2.2;
let shake = 0;
function goCam(name, lerp = 2.2) {
  const d = camDefs[name];
  camPosGoal.set(...d.pos);
  camLookGoal.set(...d.look);
  camLerp = lerp;
}
function portraitFactor() {
  const a = innerWidth / innerHeight;
  return a < 1 ? Math.min(1.9, 1 + (1 - a) * 1.35) : 1;
}
function updateCamera(dt, t) {
  const pf = portraitFactor();
  const dir = camPosGoal.clone().sub(camLookGoal);
  const goal = camLookGoal.clone().add(dir.multiplyScalar(pf));
  const k = Math.min(1, dt * camLerp);
  camPos.lerp(goal, k);
  camLook.lerp(camLookGoal, k);
  const sway = phase === 'show' ? 0 : 0.03;
  camera.position.set(
    camPos.x + Math.sin(t * 0.5) * sway + (Math.random() - 0.5) * shake,
    camPos.y + Math.sin(t * 0.7) * sway + (Math.random() - 0.5) * shake,
    camPos.z
  );
  camera.lookAt(camLook);
  shake = Math.max(0, shake - dt * 0.25);
}

// ---------------------------------------------------------------- UI + state
const ui = new UI();
let phase = 'title';
let stars = 0;
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let hitList = [];      // [{mesh, handler}]
const handlerByMesh = new Map();
function setHits(list) {
  hitList = list.map(x => x.mesh);
  handlerByMesh.clear();
  list.forEach(x => handlerByMesh.set(x.mesh, x.handler));
}

renderer.domElement.addEventListener('pointerdown', (e) => {
  ensureAudio();
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(hitList, false);
  if (hits.length) {
    const h = handlerByMesh.get(hits[0].object);
    if (h) { h(hits[0]); return; }
  }
  // friendly feedback even on a miss — nothing can fail
  const p = raycaster.ray.at(3.5, new THREE.Vector3());
  sparkle(p, 0x9fd9ff, 0.3);
  if (phase === 'show') {
    // tapping during the show makes ripples in the pool
    const ground = raycaster.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), -POOL_Y), new THREE.Vector3());
    if (ground && ground.length() < 30) {
      showRings.spawn(ground.x, ground.z, 2.0, 1.2, currentSeqColor());
      sfx.sparkle();
      return;
    }
  }
  sfx.tap();
});

// ---------------------------------------------------------------- title
ui.showTitle(true);
ui.button('はじめる', () => {
  ensureAudio();
  sfx.chime();
  ui.button(null);
  ui.showTitle(false);
  ui.fade(1, 0.9);
  ui.message('ちかの ポンプしつへ！', 2.2);
  setTimeout(() => {
    activeScene = roomScene;
    attachSparks(roomScene);
    goCam('overview', 99);
    ui.fade(0, 0.9);
    setTimeout(() => enterPipes(), 700);
  }, 1000);
});

// title camera drift
let titleT = 0;

// ---------------------------------------------------------------- ghost pulse for pipes phase
function pulseGhosts(t) {
  const op = 0.14 + 0.14 * (0.5 + 0.5 * Math.sin(t * 4));
  for (const pd of room.pieces) {
    if (!pd.done) pd.ghost.traverse(o => { if (o.isMesh) o.material.opacity = op; });
  }
}

// ============================================================== PHASE: pipes
function enterPipes() {
  phase = 'pipes';
  ui.showStars(true);
  ui.setStars(stars);
  ui.setBanner('🔧 パイプを タップして つなごう！');
  goCam('pipes');
  spotTarget.position.set(-3.1, 1.0, -3.1);
  setHits(room.pieces.filter(p => !p.done).map(pd => ({
    mesh: pd.hit,
    handler: () => installPiece(pd),
  })));
}
function installPiece(pd) {
  if (pd.done) return;
  pd.done = true;
  setHits(room.pieces.filter(p => !p.done).map(q => ({ mesh: q.hit, handler: () => installPiece(q) })));
  sfx.tap();
  const from = pd.home.clone();
  const to = pd.target.clone();
  const startRot = pd.piece.rotation.z;
  tween(0.75, (k) => {
    pd.piece.position.lerpVectors(from, to, k);
    pd.piece.position.y += Math.sin(k * Math.PI) * 0.75;
    pd.piece.rotation.z = startRot * (1 - k);
  }, {
    onDone: () => {
      pd.ghost.visible = false;
      sfx.snap();
      sparkle(to, 0xaef4ff, 0.5);
      if (room.pieces.every(p => p.done)) {
        sfx.chime();
        stars = 1; ui.setStars(stars);
        ui.message('つながった！', 1.6);
        setTimeout(enterClog, 1300);
      }
    },
  });
}

// ============================================================== PHASE: clog
function enterClog() {
  phase = 'clog';
  ui.setBanner('🍂 つまった ゴミを タップして とろう！');
  goCam('clog');
  spotTarget.position.set(-0.4, 1.0, -3.1);
  setHits(room.gunks.filter(g => !g.done).map(gd => ({
    mesh: gd.hit,
    handler: () => popGunk(gd),
  })));
}
function popGunk(gd) {
  if (gd.done) return;
  gd.done = true;
  setHits(room.gunks.filter(g => !g.done).map(q => ({ mesh: q.hit, handler: () => popGunk(q) })));
  sfx.squish();
  const g0 = gd.grp.scale.clone();
  tween(0.16, (k) => { gd.grp.scale.set(g0.x * (1 + k * 0.4), g0.y * (1 - k * 0.6), g0.z * (1 + k * 0.4)); }, {
    onDone: () => {
      sfx.pop();
      sparkle(gd.grp.position, 0xd8ff9a, 0.45);
      tween(0.3, (k) => {
        gd.grp.scale.setScalar(Math.max(0.001, (1 - k)));
        gd.grp.position.y += dtGlobal * 1.2;
      }, {
        onDone: () => {
          gd.grp.visible = false;
          if (room.gunks.every(x => x.done)) {
            sfx.chime();
            stars = 2; ui.setStars(stars);
            ui.message('ピカピカ！', 1.6);
            // the glass pipe gleams
            const gm = room.glass.material;
            tween(1.2, (k) => { gm.opacity = 0.28 + Math.sin(k * Math.PI) * 0.35; });
            setTimeout(enterNozzle, 1300);
          }
        },
      });
    },
  });
}

// ============================================================== PHASE: nozzle
const NOZZLE_PREVIEWS = [];
function trajDots(type) {
  // hologram dotted arcs previewing the water shape
  const pts = [];
  const mk = (v0x, v0y, v0z, gN, steps = 16, T = 1) => {
    for (let i = 1; i <= steps; i++) {
      const s = (i / steps) * T;
      pts.push(new THREE.Vector3(v0x * s, v0y * s - 0.5 * gN * s * s, v0z * s));
    }
  };
  if (type === 0) mk(0, 1.6, 0, 0.4, 14, 0.55);            // straight column
  else if (type === 1) mk(0.75, 1.15, 0, 2.6);              // arc
  else { mk(-0.55, 0.9, 0, 2.4, 10, 0.8); mk(0, 1.0, 0, 2.4, 10, 0.8); mk(0.55, 0.9, 0, 2.4, 10, 0.8); }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0x8fe8ff, size: 0.045, transparent: true, opacity: 0.9,
    depthWrite: false, blending: THREE.AdditiveBlending,
  }));
}
function enterNozzle() {
  phase = 'nozzle';
  ui.setBanner('⛲ ふきだしぐちを タップして えらぼう！');
  goCam('nozzle');
  spotTarget.position.set(1.35, 1.0, -2.15);
  setHits(room.nozzles.map((nd, i) => ({ mesh: nd.hit, handler: () => cycleNozzle(nd, i) })));
  room.nozzles.forEach((nd, i) => {
    const pv = trajDots(nd.type);
    pv.position.set(0, 0.36, 0);
    nd.nz.add(pv);
    NOZZLE_PREVIEWS[i] = pv;
  });
  checkNozzleDone();
}
function cycleNozzle(nd, i) {
  nd.tapped = true;
  nd.type = (nd.type + 1) % 3;
  nd.heads.forEach((h, k) => h.visible = k === nd.type);
  sfx.cycle();
  const wp = new THREE.Vector3();
  nd.nz.getWorldPosition(wp);
  wp.y += 0.4;
  sparkle(wp, 0x8fe8ff, 0.35);
  const old = NOZZLE_PREVIEWS[i];
  if (old) { nd.nz.remove(old); old.geometry.dispose(); }
  const pv = trajDots(nd.type);
  pv.position.set(0, 0.36, 0);
  nd.nz.add(pv);
  NOZZLE_PREVIEWS[i] = pv;
  checkNozzleDone();
}
function checkNozzleDone() {
  if (phase !== 'nozzle') return;
  if (room.nozzles.every(n => n.tapped)) {
    ui.button('これで OK！', () => {
      ui.button(null);
      sfx.chime();
      stars = 3; ui.setStars(stars);
      NOZZLE_PREVIEWS.forEach((pv, i) => { if (pv) room.nozzles[i].nz.remove(pv); });
      ui.message('いいかんじ！', 1.5);
      setTimeout(enterLights, 1100);
    });
  }
}

// ============================================================== PHASE: lights
const PALETTE = [0xff6fa5, 0x4db8ff, 0x63e87a, 0xffd94d, 0xb97fff];
let lightOrderCount = 0;
function enterLights() {
  phase = 'lights';
  ui.setBanner('💡 ライトを タップして いろを えらぼう！');
  goCam('lights');
  spotTarget.position.set(3.3, 0.95, -2.15);
  setHits(room.lamps.map((ld, i) => ({ mesh: ld.hit, handler: () => cycleLamp(ld, i) })));
}
function cycleLamp(ld, i) {
  if (ld.order < 0) {
    ld.order = lightOrderCount++;
    ld.badge.material.map.dispose();
    const num = makeBadge(String(ld.order + 1));
    ld.badge.material.map = num;
    ld.badge.visible = true;
  }
  ld.colorIdx = (ld.colorIdx + 1) % PALETTE.length;
  const c = PALETTE[ld.colorIdx];
  ld.domeMat.emissive.set(c);
  ld.domeMat.color.set(c);
  sfx.cycle();
  const wp = new THREE.Vector3();
  ld.lg.getWorldPosition(wp);
  wp.y += 0.25;
  sparkle(wp, c, 0.4);
  if (room.lamps.every(l => l.order >= 0)) {
    ui.button('これで OK！', () => {
      ui.button(null);
      sfx.chime();
      stars = 4; ui.setStars(stars);
      ui.message('きれい！', 1.5);
      setTimeout(enterValve, 1100);
    });
  }
}
function makeBadge(text) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  ctx.beginPath(); ctx.arc(64, 64, 56, 0, 7);
  ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();
  ctx.lineWidth = 7; ctx.strokeStyle = '#1a7ab8'; ctx.stroke();
  ctx.fillStyle = '#1a7ab8';
  ctx.font = 'bold 82px sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 64, 70);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ============================================================== PHASE: valve
const VALVE_TURNS = 5;
function enterValve() {
  phase = 'valve';
  ui.setBanner('🎡 おおきな バルブを なんかいも タップ！');
  goCam('valve');
  spotTarget.position.set(4.85, 1.75, -2.6);
  setHits([{ mesh: room.valve.hit, handler: turnValve }]);
}
let valveRotTarget = 0;
function turnValve() {
  if (room.valve.turns >= VALVE_TURNS) return;
  room.valve.turns++;
  const n = room.valve.turns;
  sfx.creak(n);
  valveRotTarget -= Math.PI * 2 / 3;
  shake = Math.min(0.05, 0.012 * n);
  sparkle(new THREE.Vector3(4.85, 1.75, -2.5), 0xffd0a0, 0.4);
  if (n >= VALVE_TURNS) {
    stars = 5; ui.setStars(stars);
    sfx.thunk();
    setTimeout(startRush, 500);
  }
}
function updateValve(dt) {
  // wheel eases toward its target so every rapid tap still counts
  const w = room.valve.wheel;
  w.rotation.z += (valveRotTarget - w.rotation.z) * Math.min(1, dt * 6);
  const prog = Math.min(1, -w.rotation.z / (Math.PI * 2 / 3 * VALVE_TURNS));
  room.gaugeNeedle.rotation.z = 1.2 - prog * 2.4;
}

// ============================================================== PHASE: rush
// water charges through the pipes, then we surface to the plaza
const pulseRings = [];
{
  const mat = new THREE.MeshBasicMaterial({
    color: 0x9fe8ff, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.07, 10, 24), mat.clone());
    m.visible = false;
    roomScene.add(m);
    pulseRings.push(m);
  }
}
// piecewise pipe path: left main → across the wall → up the riser
const PATH = [
  new THREE.Vector3(-6.2, PIPE_Y, PIPE_Z),
  new THREE.Vector3(4.9, PIPE_Y, PIPE_Z),
  new THREE.Vector3(4.9, 4.1, PIPE_Z),
];
const SEG1 = PATH[1].x - PATH[0].x; // 11.1
const SEG2 = PATH[2].y - PATH[1].y; // 3.1
const PATH_LEN = SEG1 + SEG2;
function pathAt(d, out) {
  if (d < SEG1) { out.set(PATH[0].x + d, PIPE_Y, PIPE_Z); return 'x'; }
  out.set(4.9, PIPE_Y + Math.min(SEG2, d - SEG1), PIPE_Z); return 'y';
}
let hoseBubbles = null;
let glassWater = null;
let rushT = -1;
function startRush() {
  phase = 'rush';
  ui.setBanner(null);
  ui.button(null);
  rushT = 0;
  sfx.whoosh(2.6, 0.5);
  setWaterBed(0.5);
  // water appears inside the glass section
  glassWater = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1.58, 16),
    new THREE.MeshStandardMaterial({
      color: 0x2fa8d8, transparent: true, opacity: 0.55,
      emissive: 0x0d4a66, emissiveIntensity: 1.2, roughness: 0.2,
    })
  );
  glassWater.rotation.z = Math.PI / 2;
  glassWater.position.set(-0.4, PIPE_Y, PIPE_Z);
  glassWater.scale.y = 0.001;
  roomScene.add(glassWater);
  hoseBubbles = new HoseBubbles(room.hoseCurve, { count: 46, size: 0.05 });
  roomScene.add(hoseBubbles.group);
  hoseBubbles.on = 1;
  goCam('overview', 3);
  shake = 0.03;
  ui.message('みずが きた！', 2.0);
}
const _pv = new THREE.Vector3();
function updateRush(dt, t) {
  rushT += dt;
  const speed = 5.2;
  for (let i = 0; i < pulseRings.length; i++) {
    const d = (rushT - i * 0.38) * speed;
    const m = pulseRings[i];
    if (d < 0 || d > PATH_LEN) { m.visible = false; continue; }
    m.visible = true;
    const axis = pathAt(d, _pv);
    m.position.copy(_pv);
    m.rotation.set(0, 0, 0);
    if (axis === 'x') m.rotation.y = Math.PI / 2; else m.rotation.x = Math.PI / 2;
    m.material.opacity = 0.75;
    m.scale.setScalar(1 + Math.sin(rushT * 20 + i) * 0.1);
  }
  if (glassWater) {
    const fillStart = (0 - PATH[0].x - 1.2) / speed; // when the front reaches the glass
    const k = Math.min(1, Math.max(0.001, (rushT - fillStart + 1.2) / 0.5));
    glassWater.scale.y = k;
  }
  // camera chases the front up the riser
  if (rushT > 1.6 && rushT < 3.4) {
    camPosGoal.set(3.4, 1.9, 1.6);
    camLookGoal.set(4.9, 1.4 + (rushT - 1.6) * 1.5, PIPE_Z);
    camLerp = 3.2;
  }
  if (rushT > 3.1 && !rushFlash) {
    rushFlash = true;
    shake = 0.05;
    sfx.whoosh(1.4, 0.55);
    ui.flash(1, 1.0);
    setTimeout(() => startShow(), 500);
  }
}
let rushFlash = false;

// ============================================================== PHASE: show
let showJets = null;
let showRings = null;
let showMist = null;
let popJets = [];
let showT = 0;
const fired = {};
function once(key, when, fn) { if (showT >= when && !fired[key]) { fired[key] = true; fn(); } }

function lightSeq() {
  // colors in the order the player first tapped them; safe defaults
  const chosen = [...room.lamps]
    .filter(l => l.order >= 0)
    .sort((a, b) => a.order - b.order)
    .map(l => PALETTE[Math.max(0, l.colorIdx)]);
  return chosen.length ? chosen : [0xff6fa5, 0x4db8ff, 0x63e87a, 0xffd94d];
}
let seq = [0xff6fa5, 0x4db8ff, 0x63e87a, 0xffd94d];
function currentSeqColor() {
  return seq[Math.floor(showT / 1.2) % seq.length];
}

function buildShowJets() {
  const t = room.nozzles.map(n => n.type); // [ring, arc, fan] styles
  const g = new THREE.Group();
  const A = plaza.nozzleAnchors;

  // center geyser (the star of the show)
  const center = new Jet({
    count: 1700, life: 2.0, speed: 12, dir: new THREE.Vector3(0, 1, 0),
    spread: 0.05, size: 13, floor: POOL_Y, origin: A.center.clone(),
    mirror: true, color: 0xcfeaff,
  });
  g.add(center.group);

  // ring of 8 small jets — style from nozzle 1
  const ringStyle = t[0];
  const ringJets = A.ring.map((p, i) => {
    const out = p.clone().setY(0).normalize();
    const dir = ringStyle === 1
      ? new THREE.Vector3(out.x * 0.45, 1, out.z * 0.45)
      : new THREE.Vector3(0, 1, 0);
    const j = new Jet({
      count: 260, life: 1.25, speed: 6.5,
      dir, spread: ringStyle === 2 ? 0.34 : 0.05,
      size: ringStyle === 2 ? 10 : 8, floor: POOL_Y, origin: p.clone(), mirror: true,
    });
    g.add(j.group);
    return j;
  });

  // crossing arches from the rim — style from nozzle 2
  const arcStyle = t[1];
  const arcJets = A.arc.map((p) => {
    const toC = p.clone().multiplyScalar(-1).setY(0).normalize();
    const up = arcStyle === 0 ? 1.7 : arcStyle === 1 ? 1.15 : 1.3;
    const dir = new THREE.Vector3(toC.x, up, toC.z);
    const j = new Jet({
      count: 420, life: 1.75, speed: arcStyle === 0 ? 8.6 : 7.6,
      dir, spread: arcStyle === 2 ? 0.22 : 0.05,
      size: 9, floor: POOL_Y, origin: p.clone(), mirror: true, color: 0xbfe2ff,
    });
    g.add(j.group);
    return j;
  });

  // two feature jets — style from nozzle 3
  const fanStyle = t[2];
  const fanJets = A.fan.map((p, i) => {
    const dir = fanStyle === 1 ? new THREE.Vector3(i ? 0.5 : -0.5, 1, 0) : new THREE.Vector3(0, 1, 0);
    const j = new Jet({
      count: 420, life: 1.5, speed: fanStyle === 0 ? 9.5 : 5.8,
      dir, spread: fanStyle === 2 ? 0.5 : 0.06,
      size: fanStyle === 2 ? 12 : 9, floor: POOL_Y, origin: p.clone(), mirror: true,
    });
    g.add(j.group);
    return j;
  });

  // rising crown ring (the "water ring")
  const crownOrig = [];
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2;
    crownOrig.push(new THREE.Vector3(Math.cos(a) * 1.55, POOL_Y, Math.sin(a) * 1.55));
  }
  const crown = new Jet({
    count: 700, life: 1.15, speed: 7.2, dir: new THREE.Vector3(0, 1, 0),
    spread: 0.02, size: 8, floor: POOL_Y, origin: crownOrig, mirror: true, color: 0xd8f2ff,
  });
  g.add(crown.group);

  // pop jets from the plaza floor, outside the basin
  popJets = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 8;
    const p = new THREE.Vector3(Math.cos(a) * 6.4, 0.02, Math.sin(a) * 6.4);
    const j = new Jet({
      count: 240, life: 1.1, speed: 7.5, dir: new THREE.Vector3(0, 1, 0),
      spread: 0.05, size: 9, floor: 0.02, origin: p,
    });
    g.add(j.group);
    popJets.push(j);
  }

  plazaScene.add(g);
  return { group: g, center, ringJets, arcJets, fanJets, crown };
}

function startShow() {
  phase = 'show';
  activeScene = plazaScene;
  attachSparks(plazaScene);
  seq = lightSeq();
  showT = 0;
  for (const k in fired) delete fired[k];
  showJets = showJets || buildShowJets();
  showRings = showRings || (() => { const r = new RingWaves({ y: POOL_Y + 0.02 }); plazaScene.add(r.group); return r; })();
  showMist = showMist || (() => { const m = new Mist({ area: 3.4 }); m.group.position.y = POOL_Y; plazaScene.add(m.group); return m; })();
  setHits([]);
  ui.setBanner(null);
  camPos.set(0, 2.2, 17);
  camLook.set(0, 2, 0);
  camPosGoal.copy(camPos);
  camLookGoal.copy(camLook);
  setWaterBed(0.25);
}

let ringBeatT = 0;
let orbitA = 0.12;
function updateShow(dt, t) {
  showT += dt;
  const T = showT;
  const night = Math.min(1, T / 3);
  plaza.skyMat.uniforms.uNight.value = night;
  plaza.starMat.opacity = night * 0.9;
  plaza.moonMat.opacity = night * 0.85;
  plaza.hemi.intensity = 0.9 - night * 0.55;
  plaza.duskSun.intensity = 1.1 * (1 - night);
  plazaScene.fog.color.setRGB(
    0.24 - night * 0.20, 0.18 - night * 0.12, 0.22 - night * 0.11);
  plaza.winMats.forEach((w, i) => {
    w.opacity = night * ((i * 37) % 10 < 6 ? 0.85 : 0);
  });

  // 1) underwater lights wake up, one by one, in the chosen order
  const uw = plaza.uwLights;
  for (let i = 0; i < uw.length; i++) {
    const onAt = 0.8 + (i % seq.length) * 0.55;
    const on = T > onAt ? 1 : 0;
    const col = seq[(i + Math.floor(T / 1.2)) % seq.length];
    uw[i].sprite.material.color.set(col);
    const tw = 0.75 + 0.25 * Math.sin(T * 3 + i);
    uw[i].sprite.material.opacity = on * 0.5 * tw * Math.min(1, (T - onAt) * 2);
  }
  once('l1', 0.8, () => { sfx.sparkle(); });
  once('l2', 1.6, () => sfx.sparkle());
  if (T > 0.8) {
    plaza.poolLight.intensity = 26;
    plaza.poolLight.color.set(currentSeqColor());
    plaza.caustics.material.opacity = Math.min(0.3, (T - 0.8) * 0.1);
    plaza.caustics.rotation.z += dt * 0.15;
  }

  // 2) ring jets pop up
  const J = showJets;
  J.ringJets.forEach((j, i) => {
    const onAt = 3.0 + i * 0.16;
    j.on = T > onAt ? 1 : 0;
    j.speedTarget = 6.2 + Math.sin(T * 2.2 + i * 0.785) * 1.8 * (T > 7 ? 1 : 0.3);
    if (T > onAt && !fired['rj' + i]) { fired['rj' + i] = true; sfx.pop(); }
  });

  // 3) crossing arches
  J.arcJets.forEach((j, i) => {
    j.on = T > 5 + i * 0.12 ? 1 : 0;
  });
  once('arc', 5, () => { sfx.whoosh(1.4, 0.35); setWaterBed(0.6); });

  // 4) grand geyser + the whole plaza wakes up
  once('geyser', 7, () => {
    sfx.burst();
    ui.flash(0.7, 1.1);
    shake = 0.06;
    startMusic();
    setWaterBed(1);
    plaza.lampheads.forEach(l => { l.headMat.emissive.set(0xffca70); l.light.intensity = 9; });
    ui.message('わあ！ ふんすいの ショー！', 2.6);
  });
  J.center.on = T > 7 ? 1 : 0;
  const burstPhase = (T - 7) % 6;
  J.center.speedTarget = T > 7 ? (burstPhase < 1.2 ? 14.5 : 9.5 + Math.sin(T * 1.3) * 1.5) : 12;
  if (T > 7 && burstPhase < 0.05 && !fired['b' + Math.floor(T)]) {
    fired['b' + Math.floor(T)] = true;
    sfx.burst();
  }

  // crown ring pulses (water rings rising)
  J.crown.on = T > 9 && Math.sin(T * 1.05) > 0.15 ? 1 : 0;

  // feature jets
  J.fanJets.forEach((j, i) => {
    j.on = T > 8 ? 1 : 0;
    j.speedTarget = (i ? 6.5 : 7.5) + Math.sin(T * 1.7 + i * 2) * 1.6;
  });

  // pop jets around the plaza floor
  popJets.forEach((j, i) => {
    j.on = T > 10 && ((T * 0.7 + i * 0.25) % 1) < 0.4 ? 1 : 0;
  });

  // beams + decals + show light
  plaza.beams.forEach((b, i) => {
    const vis = T > 7.5 ? 1 : 0;
    b.cone.material.opacity = vis * (0.10 + 0.05 * Math.sin(T * 2 + i));
    b.piv.rotation.y = b.baseA + Math.sin(T * 0.4 + i) * 0.7;
    b.piv.rotation.z = Math.sin(T * 0.3 + i * 1.3) * 0.4;
  });
  plaza.decals.forEach((d, i) => {
    d.material.opacity = (T > 7.5 ? 1 : 0) * (0.06 + 0.05 * Math.sin(T * 2.4 + i * 1.1));
    d.material.color.set(seq[(i + Math.floor(T / 1.2)) % seq.length]);
  });
  plaza.showLight.intensity = T > 7 ? 24 : 0;
  plaza.showLight.color.set(seq[(1 + Math.floor(T / 1.2)) % seq.length]);
  plaza.poolMat.color.setHex(T > 7 ? 0x0a3242 : 0x07242f);

  // beat ripples in the pool
  ringBeatT -= dt;
  if (T > 3 && ringBeatT <= 0) {
    ringBeatT = 0.55;
    const A = plaza.nozzleAnchors;
    const src = T > 7 && Math.random() < 0.4
      ? A.center
      : A.ring[Math.floor(Math.random() * A.ring.length)];
    showRings.spawn(src.x, src.z, 1.6 + Math.random() * 1.4, 1.3, currentSeqColor());
  }
  showMist.level = T > 7 ? 1 : T > 3 ? 0.4 : 0;

  // celebration sparkles high in the spray
  if (T > 8 && Math.random() < dt * 1.6) {
    const a = Math.random() * Math.PI * 2;
    sparkle(new THREE.Vector3(Math.cos(a) * 2, 3.5 + Math.random() * 3, Math.sin(a) * 2),
      seq[Math.floor(Math.random() * seq.length)], 0.6);
  }
  once('yatta', 13.5, () => {
    sfx.sparkle();
    ui.message('やったね！', 3.0);
  });
  once('replay', 17, () => {
    ui.button('もういちど みる', () => {
      showT = 1.5;
      for (const k in fired) delete fired[k];
      ui.button(null);
      sfx.chime();
    });
  });

  // slow orbit camera
  orbitA += dt * (T < 7 ? 0.02 : 0.065);
  const r = T < 7 ? 15.5 : 13.5;
  camPosGoal.set(Math.sin(orbitA) * r, T < 7 ? 2.4 : 4.6 + Math.sin(T * 0.22) * 0.9, Math.cos(orbitA) * r);
  camLookGoal.set(0, T < 7 ? 1.8 : 2.4, 0);
  camLerp = 1.6;

  // water systems tick
  J.center.update(t, dt);
  J.crown.update(t, dt);
  J.ringJets.forEach(j => j.update(t, dt));
  J.arcJets.forEach(j => j.update(t, dt));
  J.fanJets.forEach(j => j.update(t, dt));
  popJets.forEach(j => j.update(t, dt));
  showRings.update(dt);
  showMist.update(t, dt);
}

// ---------------------------------------------------------------- main loop
const clock = new THREE.Clock();
let dtGlobal = 0.016;
function loop() {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, clock.getDelta());
  dtGlobal = dt;
  const t = clock.elapsedTime;

  updateTweens(dt);
  updateSparks(dt);

  if (phase === 'title') {
    titleT += dt;
    const a = 0.12 + titleT * 0.018;
    camPosGoal.set(Math.sin(a) * 15, 8.5, Math.cos(a) * 15);
    camLookGoal.set(0, 1.0, 0);
    camLerp = 1.2;
  }
  if (phase === 'pipes') pulseGhosts(t);
  // hologram previews only exist while choosing nozzles
  NOZZLE_PREVIEWS.forEach(pv => { if (pv) pv.visible = phase === 'nozzle'; });
  if (phase === 'valve' || phase === 'rush') updateValve(dt);
  if (phase === 'rush') updateRush(dt, t);
  if (phase === 'show') updateShow(dt, t);

  // flickering bulbs in the pump room
  if (activeScene === roomScene) {
    for (const b of room.bulbs) {
      const f = 0.9 + 0.1 * Math.sin(t * 11 + b.phase) * Math.sin(t * 5.7 + b.phase * 2);
      b.light.intensity = 13 * f;
    }
    room.pump.position.y = phase === 'rush' ? Math.sin(t * 40) * 0.008 : 0;
    if (hoseBubbles) hoseBubbles.update(t, dt);
  }

  testJets.forEach(j => j.update(t, dt));
  updateCamera(dt, t);
  renderer.render(activeScene, camera);
}
loop();

function refreshJetScale() {
  JET_SCALE.value = renderer.domElement.height /
    (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
}
refreshJetScale();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  refreshJetScale();
});

// expose a tiny debug hook for automated play-testing
window.__game = {
  testJet() {
    const j = new Jet({
      count: 400, speed: 8, origin: new THREE.Vector3(0, POOL_Y, 0),
      mirror: true, floor: POOL_Y,
    });
    j.on = 1;
    plazaScene.add(j.group);
    activeScene = plazaScene;
    camPosGoal.set(0, 3, 12); camLookGoal.set(0, 2, 0);
    camPos.copy(camPosGoal); camLook.copy(camLookGoal);
    testJets.push(j);
    return true;
  },
  get phase() { return phase; },
  tapWorld(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(camera);
    const e = {
      clientX: (v.x * 0.5 + 0.5) * innerWidth,
      clientY: (-v.y * 0.5 + 0.5) * innerHeight,
    };
    renderer.domElement.dispatchEvent(new PointerEvent('pointerdown', e));
  },
  room, plaza,
  get showT() { return showT; },
};
