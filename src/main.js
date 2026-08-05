import * as THREE from 'three';
import { V3, lerp, dampV3, easeOutCubic } from './util.js';
import { buildWorld, LAYOUT } from './world.js';
import { Effects } from './effects.js';
import { Finale } from './finale.js';
import { SoundKit } from './audio.js';
import { UI } from './ui.js';

/* ---------------- renderer / scene ---------------- */
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, 1, 0.5, 400);

const world = buildWorld(scene);
const waterLines = [
  [V3(0, 0, -12.8), V3(0, 0, -6)], [V3(0, 0, -6), V3(-9, 0, -6)],
  [V3(-9, 0, -6), V3(-9, 0, 3)], [V3(0, 0, -6), V3(9, 0, -6)],
  [V3(9, 0, -6), V3(9, 0, 2.9)], [V3(0, 0, -6), V3(0, 0, 3.4)],
];
const fx = new Effects(scene, waterLines, LAYOUT);
const snd = new SoundKit();
const ui = new UI();
const finale = new Finale(world, fx, snd, ui);

/* ---------------- camera rig ---------------- */
const FRAMINGS = {
  intro: { t: V3(0, 0.5, -4), yaw: -14, pitch: 30, rh: 18, rv: 13, hFit: 0.5 },
  overview: { t: V3(0, 0.5, -2.5), yaw: 0, pitch: 40, rh: 16.5, rv: 12, hFit: 0.55 },
  leaves: { t: V3(1.6, 0, 4.2), yaw: -6, pitch: 47, rh: 6.2, rv: 5.4, hFit: 0.8 },
  till: { t: V3(-11.9, 0, -1.2), yaw: 30, pitch: 48, rh: 5.0, rv: 5.4, hFit: 0.8 },
  channel: { t: V3(-1.8, 0, -5.2), yaw: 5, pitch: 51, rh: 10.5, rv: 8.5, hFit: 0.62 },
  nozzle: { t: V3(0, 1.0, 3.4), yaw: 0, pitch: 32, rh: 4.6, rv: 3.6, hFit: 0.85 },
  gate: { t: V3(0, 1.7, -13.3), yaw: 0, pitch: 25, rh: 5.6, rv: 4.2, hFit: 0.72 },
  finale: { t: V3(0, 0.5, -3), yaw: 0, pitch: 38, rh: 16.5, rv: 12.5, hFit: 0.55 },
  fountainView: { t: V3(0, 0.9, 3.4), yaw: 8, pitch: 33, rh: 5.2, rv: 4.2, hFit: 0.85 },
  wheelView: { t: V3(9, 0.9, 0.2), yaw: -18, pitch: 35, rh: 5.6, rv: 4.4, hFit: 0.85 },
};
const FINALE_CAM = { overview: 'finale', fountain: 'fountainView', wheel: 'wheelView', beds: 'till' };

const rig = {
  cur: { t: V3(0, 0.5, -4), pos: V3(0, 26, 30) },
  goal: FRAMINGS.intro,
  yawDrift: 0,
  followWater: 0, // 0..1 blend toward the water head during the finale
};

function framingDist(f) {
  const v = THREE.MathUtils.degToRad(camera.fov);
  const h = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
  const dv = f.rv / Math.tan(v / 2);
  const dh = (f.rh * (camera.aspect < 1 ? f.hFit : 1)) / Math.tan(h / 2);
  return Math.max(dv, dh, 4);
}

function framingPos(f, yawExtra = 0) {
  const yaw = THREE.MathUtils.degToRad(f.yaw + yawExtra);
  const pitch = THREE.MathUtils.degToRad(f.pitch);
  const d = framingDist(f);
  return V3(
    f.t.x + Math.sin(yaw) * Math.cos(pitch) * d,
    f.t.y + Math.sin(pitch) * d,
    f.t.z + Math.cos(yaw) * Math.cos(pitch) * d
  );
}

function updateCamera(dt, time) {
  if (phase === 'finale') rig.goal = FRAMINGS[FINALE_CAM[finale.camFocus]] || FRAMINGS.finale;
  const f = rig.goal;
  rig.yawDrift = phase === 'finale' || phase === 'free' ? Math.sin(time * 0.12) * 10 : Math.sin(time * 0.3) * 1.2;
  const goalT = f.t.clone();
  const goalP = framingPos(f, rig.yawDrift);
  if (rig.followWater > 0.01 && finale.started) {
    // early finale: peek at the water head racing down the main channel
    const head = V3(0, 0.3, Math.min(-12.8 + (finale.clock - 0.5) * 3.4, -6));
    goalT.lerp(head, rig.followWater * 0.85);
    goalP.lerp(V3(head.x + 4.5, 6.5, head.z + 8.5), rig.followWater * 0.8);
  }
  dampV3(rig.cur.t, goalT, 2.4, dt);
  dampV3(rig.cur.pos, goalP, 2.0, dt);
  camera.position.copy(rig.cur.pos);
  camera.lookAt(rig.cur.t);
}

/* ---------------- phase machine ---------------- */
let phase = 'title';
let inputLock = 0;
const counts = { leaves: 0, planted: 0, gaps: 0, nozzles: 0 };
const PLANTS_GOAL = 9;

const PHASES = {
  intro: {
    enter() {
      rig.goal = FRAMINGS.intro;
      ui.showBanner('🥀', 'みずの とまった こうえん…');
      setTimeout(() => { if (phase === 'intro') setPhase('leaves'); }, 3400);
    },
  },
  leaves: {
    task: 0,
    enter() {
      rig.goal = FRAMINGS.leaves;
      ui.showBanner('🍂', 'はっぱを あつめよう', `0/${world.leaves.length}`);
    },
    hint() {
      const lf = world.leaves.find((l) => l.state === 'ground');
      return lf ? { mode: 'swipe', a: lf.pos.clone().setY(0.2) } : null;
    },
  },
  till: {
    task: 1,
    enter() {
      rig.goal = FRAMINGS.till;
      ui.showBanner('⛏️', 'つちを たがやそう', '0/3');
    },
    hint() {
      const bed = world.beds.find((b) => !b.tilled);
      return bed ? { mode: 'swipe', a: bed.center.clone().setY(0.4) } : null;
    },
  },
  plant: {
    task: 2,
    enter() {
      rig.goal = FRAMINGS.till;
      ui.showBanner('🌷', 'たねを うえよう', `0/${PLANTS_GOAL}`);
    },
    hint() {
      const bed = world.beds.find((b) => b.plants.length < 3);
      return bed ? { mode: 'tap', a: bed.center.clone().setY(0.4) } : null;
    },
  },
  channel: {
    task: 3,
    enter() {
      refreshChannelCamera();
      ui.showBanner('🧩', 'すいろを つなごう', '0/3');
    },
    hint() {
      const pair = activeChannelPair();
      if (!pair || pair.piece.dragging) return null;
      return {
        mode: 'drag',
        a: pair.piece.group.position.clone().setY(0.5),
        b: pair.gap.center.clone().setY(0.3),
      };
    },
  },
  nozzle: {
    task: 4,
    enter() {
      rig.goal = FRAMINGS.nozzle;
      ui.showBanner('⛲', 'ふんすいを なおそう', '0/3');
    },
    hint() {
      const n = world.nozzles.find((x) => !x.fixed);
      if (!n) return null;
      return { mode: 'tap', a: n.group.getWorldPosition(V3()).add(V3(0, 0.25, 0)) };
    },
  },
  gate: {
    task: 5,
    enter() {
      rig.goal = FRAMINGS.gate;
      ui.showBanner('🌊', 'すいもんを あけよう！');
    },
    hint() {
      return { mode: 'dragup', a: world.gateHandlePos() };
    },
  },
  finale: {
    enter() {
      ui.hideBanner();
      ui.setHint(null);
      rig.goal = FRAMINGS.finale;
      rig.followWater = 1;
      finale.start();
      setTimeout(() => { rig.followWater = 0; }, 2600);
    },
  },
  free: {
    enter() {
      ui.allTasksDone();
      ui.showBanner('🦋', 'こうえんが げんきに なったね！');
      setTimeout(() => { if (phase === 'free') ui.hideBanner(); }, 7000);
    },
  },
};

function setPhase(name) {
  phase = name;
  const p = PHASES[name];
  if (p.task !== undefined) ui.setTask(p.task);
  ui.setHint(null);
  p.enter();
}

function celebrate(next, at) {
  inputLock = 1.6;
  ui.celebrate();
  snd.fanfare();
  fx.sparkle.burst(at || rig.cur.t.clone().setY(1.5), 30, 2, 2.5, 1.2);
  ui.setHint(null);
  setTimeout(() => setPhase(next), 1500);
}

/* ---------------- picking helpers ---------------- */
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const groundPlane = new THREE.Plane(V3(0, 1, 0), 0);

function setRay(x, y) {
  ndc.set((x / window.innerWidth) * 2 - 1, -(y / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
}

function rayGround(x, y) {
  setRay(x, y);
  const p = V3();
  return raycaster.ray.intersectPlane(groundPlane, p) ? p : null;
}

/** the gap the child should fill next, and the loose piece that goes with it */
function activeChannelPair() {
  const gap = world.channels.gaps.find((g) => !g.filled);
  if (!gap) return null;
  const paired = world.channels.pieces[gap.index];
  const piece = !paired.snapped ? paired : world.channels.pieces.find((p) => !p.snapped);
  return piece ? { gap, piece } : null;
}

/** frame the current piece↔gap pair; markers only on the active gap */
function refreshChannelCamera() {
  const pair = activeChannelPair();
  world.channels.gaps.forEach((g) => {
    g.marker.visible = pair && g === pair.gap;
  });
  if (!pair) return;
  const a = pair.gap.center, b = pair.piece.home.pos;
  const span = a.distanceTo(b);
  rig.goal = {
    t: V3((a.x + b.x) / 2, 0, (a.z + b.z) / 2),
    yaw: 10, pitch: 50,
    rh: span / 2 + 3.4, rv: span / 2 + 2.8, hFit: 0.95,
  };
}

function nearestGap(pos, maxDist) {
  let best = null, bd = maxDist;
  for (const g of world.channels.gaps) {
    if (g.filled) continue;
    const d = g.center.distanceTo(pos);
    if (d < bd) { bd = d; best = g; }
  }
  return best;
}

/* ---------------- input ---------------- */
const pointer = {
  id: null, down: false, mode: null,
  lastTillPoint: null, piece: null,
  gateStartY: 0, gateStartOpen: 0, lastRatchet: 0,
  x: 0, y: 0,
};
let lastSwishAt = 0, lastScrapeAt = 0;

function collectLeavesNear(p) {
  let got = 0;
  for (const lf of world.leaves) {
    if (lf.state === 'ground' && Math.hypot(lf.pos.x - p.x, lf.pos.z - p.z) < 1.0) {
      world.collectLeaf(lf);
      got++;
    }
  }
  if (got) {
    counts.leaves = world.leavesCollected;
    ui.setCount(`${counts.leaves}/${world.leaves.length}`);
    const now = performance.now();
    if (now - lastSwishAt > 90) { snd.swish(); lastSwishAt = now; }
    fx.sparkle.burst(p.clone().setY(0.3), 3, 0.4, 1.4, 0.5);
    if (counts.leaves >= world.leaves.length)

      celebrate('till', V3(LAYOUT.basket.x, 1, LAYOUT.basket.z));
  }
}

function onDown(e) {
  if (e.isPrimary === false || inputLock > 0) return;
  pointer.id = e.pointerId;
  pointer.down = true;
  pointer.mode = null;
  pointer.x = e.clientX; pointer.y = e.clientY;
  const x = e.clientX, y = e.clientY;

  if (phase === 'leaves') {
    const p = rayGround(x, y);
    if (p) collectLeavesNear(p);
    pointer.mode = 'paint';
  } else if (phase === 'till') {
    pointer.mode = 'till';
    pointer.lastTillPoint = null;
    tillAt(x, y);
  } else if (phase === 'plant') {
    plantAt(x, y);
  } else if (phase === 'channel') {
    setRay(x, y);
    const hits = raycaster.intersectObjects(
      world.channels.pieces.filter((p) => !p.snapped).map((p) => p.hit)
    );
    if (hits.length) {
      const piece = world.channels.pieces.find((p) => p.hit === hits[0].object);
      pointer.mode = 'piece';
      pointer.piece = piece;
      piece.dragging = true;
      snd.tap();
    }
  } else if (phase === 'nozzle') {
    setRay(x, y);
    const hits = raycaster.intersectObjects(
      world.nozzles.filter((n) => !n.fixed).map((n) => n.hit)
    );
    if (hits.length) {
      const n = world.nozzles.find((z) => z.hit === hits[0].object);
      world.fixNozzle(n);
      snd.boing();
      fx.sparkle.burst(n.group.getWorldPosition(V3()), 10, 0.5, 1.6, 0.7);
      counts.nozzles++;
      ui.setCount(`${counts.nozzles}/3`);
      if (counts.nozzles >= 3) celebrate('gate', LAYOUT.fountain.clone().setY(1.8));
    }
  } else if (phase === 'gate') {
    setRay(x, y);
    if (raycaster.intersectObject(world.gateHit).length) {
      pointer.mode = 'gate';
      pointer.gateStartY = y;
      pointer.gateStartOpen = world.gateOpen;
      snd.tap();
    }
  } else if (phase === 'free' || phase === 'finale') {
    const p = rayGround(x, y);
    if (p) {
      fx.sparkle.burst(p.setY(0.4), 8, 0.7, 1.8, 0.8);
      snd.chimeNote(Math.floor(Math.random() * 5), 0, 0.12);
    }
  }
}

function tillAt(x, y) {
  setRay(x, y);
  const hits = raycaster.intersectObjects(world.beds.map((b) => b.soil));
  if (!hits.length) { pointer.lastTillPoint = null; return; }
  const bed = world.beds.find((b) => b.soil === hits[0].object);
  const p = hits[0].point;
  if (bed.tilled) { pointer.lastTillPoint = p; return; }
  if (pointer.lastTillPoint) {
    const d = Math.min(pointer.lastTillPoint.distanceTo(p), 0.6);
    const was = bed.tilled;
    world.tillBed(bed, d / 6.5);
    const now = performance.now();
    if (d > 0.03 && now - lastScrapeAt > 130) { snd.scrape(); lastScrapeAt = now; }
    if (d > 0.03) fx.dust.burst(p.clone().setY(0.4), 2, 0.5, 1.1, 0.5);
    if (!was && bed.tilled) {
      snd.chimeNote(bed.index * 2, 0, 0.2);
      fx.sparkle.burst(bed.center.clone().setY(0.6), 14, 1.2, 1.8, 0.8);
      const doneCount = world.beds.filter((b) => b.tilled).length;
      ui.setCount(`${doneCount}/3`);
      if (doneCount >= 3) celebrate('plant', world.beds[1].center.clone().setY(1));
    }
  }
  pointer.lastTillPoint = p;
}

function plantAt(x, y) {
  setRay(x, y);
  const hits = raycaster.intersectObjects(world.beds.map((b) => b.soil));
  if (!hits.length) return;
  const bed = world.beds.find((b) => b.soil === hits[0].object);
  if (!bed.tilled || bed.plants.length >= 3) { snd.tap(); return; }
  const p = hits[0].point.clone();
  // keep a friendly minimum spacing – nudge instead of refusing
  for (const other of bed.plants) {
    const d = Math.hypot(other.pos.x - p.x, other.pos.z - p.z);
    if (d < 0.55) {
      const ang = Math.atan2(p.z - other.pos.z, p.x - other.pos.x) || Math.random() * 6.28;
      p.x = other.pos.x + Math.cos(ang) * 0.6;
      p.z = other.pos.z + Math.sin(ang) * 0.6;
    }
  }
  const hw = LAYOUT.bedW / 2 - 0.25, hd = LAYOUT.bedD / 2 - 0.25;
  p.x = THREE.MathUtils.clamp(p.x, bed.center.x - hw, bed.center.x + hw);
  p.z = THREE.MathUtils.clamp(p.z, bed.center.z - hd, bed.center.z + hd);
  world.plantSeed(bed, p);
  snd.plant();
  fx.dust.burst(p.clone().setY(0.4), 4, 0.3, 1, 0.5);
  fx.sparkle.burst(p.clone().setY(0.4), 4, 0.3, 1.2, 0.5);
  counts.planted = world.plants.length;
  ui.setCount(`${counts.planted}/${PLANTS_GOAL}`);
  if (counts.planted >= PLANTS_GOAL) celebrate('channel', world.beds[1].center.clone().setY(1));
}

function onMove(e) {
  if (!pointer.down || e.pointerId !== pointer.id || inputLock > 0) return;
  pointer.x = e.clientX; pointer.y = e.clientY;
  const x = e.clientX, y = e.clientY;
  if (pointer.mode === 'paint' && phase === 'leaves') {
    const p = rayGround(x, y);
    if (p) collectLeavesNear(p);
  } else if (pointer.mode === 'till' && phase === 'till') {
    tillAt(x, y);
  } else if (pointer.mode === 'piece' && pointer.piece) {
    const p = rayGround(x, y);
    if (p) {
      pointer.piece.group.position.set(p.x, 0.7, p.z);
      const near = nearestGap(p, 1.8);
      for (const g of world.channels.gaps) g.marker.userData.hot = g === near;
    }
  } else if (pointer.mode === 'gate') {
    const h = window.innerHeight;
    const open = pointer.gateStartOpen + (pointer.gateStartY - y) / (h * 0.33);
    const prev = world.gateOpen;
    world.setGateOpen(open);
    if (Math.floor(world.gateOpen * 12) !== Math.floor(prev * 12)) snd.ratchet();
    if (world.gateOpen >= 1 && phase === 'gate') {
      pointer.mode = null;
      setPhase('finale');
    }
  }
}

function onUp(e) {
  if (e.pointerId !== pointer.id) return;
  pointer.down = false;
  if (pointer.mode === 'piece' && pointer.piece) {
    const piece = pointer.piece;
    piece.dragging = false;
    const gap = nearestGap(piece.group.position, 1.8);
    for (const g of world.channels.gaps) g.marker.userData.hot = false;
    if (gap) {
      world.snapPiece(piece, gap);
      snd.snap();
      fx.sparkle.burst(gap.center.clone().setY(0.6), 12, 0.8, 1.6, 0.7);
      counts.gaps++;
      ui.setCount(`${counts.gaps}/3`);
      if (counts.gaps >= 3) {
        world.setGapMarkers(false);
        celebrate('nozzle', V3(0, 1, -6));
      } else {
        refreshChannelCamera();
      }
    } else {
      // float back home
      const from = piece.group.position.clone();
      const fromRot = piece.group.rotation.y;
      world.anims.push({
        t: 0, dur: 0.5,
        fn: (k) => {
          const e2 = easeOutCubic(k);
          piece.group.position.lerpVectors(from, piece.home.pos, e2);
          piece.group.position.y = Math.sin(k * Math.PI) * 0.6 + (1 - e2) * from.y * 0;
          piece.group.rotation.y = lerp(fromRot, piece.home.rot, e2);
        },
      });
    }
    pointer.piece = null;
  }
  pointer.mode = null;
}

canvas.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);
document.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', (e) => e.preventDefault());

/* ---------------- resize ---------------- */
function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
resize();

/* ---------------- hint projection ---------------- */
const hintV = V3();
function updateHint(dt) {
  const p = PHASES[phase];
  if (!p || !p.hint || pointer.down || inputLock > 0) {
    if (pointer.down) ui.setHint(null);
    ui.updateHint(dt);
    return;
  }
  const h = p.hint();
  if (!h) { ui.setHint(null); return; }
  const toScreen = (v3) => {
    hintV.copy(v3).project(camera);
    return { x: (hintV.x * 0.5 + 0.5) * window.innerWidth, y: (-hintV.y * 0.5 + 0.5) * window.innerHeight };
  };
  ui.setHint(h.mode, toScreen(h.a), h.b ? toScreen(h.b) : undefined);
  ui.updateHint(dt);
}

/* ---------------- main loop ---------------- */
const clock = new THREE.Clock();
let timeScale = 1;
let fpsAcc = 0, fpsN = 0, fpsVal = 60;

function tick() {
  requestAnimationFrame(tick);
  let dt = Math.min(clock.getDelta(), 0.1) * timeScale;
  const time = clock.elapsedTime;
  fpsAcc += dt / timeScale; fpsN++;
  if (fpsAcc > 0.5) { fpsVal = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
  if (inputLock > 0) inputLock -= dt;

  world.update(dt, time);
  fx.update(dt, time);
  if (phase === 'finale' || phase === 'free') {
    finale.update(dt, time);
    if (finale.flags.done && phase === 'finale') setPhase('free');
  }
  updateCamera(dt, time);
  updateHint(dt);
  renderer.render(scene, camera);
}

/* ---------------- boot + debug API ---------------- */
ui.onStart(() => {
  snd.unlock();
  snd.tap();
  setPhase('intro');
});

const PHASE_ORDER = ['leaves', 'till', 'plant', 'channel', 'nozzle', 'gate', 'finale', 'free'];

/** test/debug helper: instantly complete tasks up to (not including) `target` */
function cheatTo(target) {
  const want = PHASE_ORDER.indexOf(target);
  if (want < 0) return;
  if (want > 0) {
    for (const lf of world.leaves) if (lf.state === 'ground') world.collectLeaf(lf);
    counts.leaves = world.leavesCollected;
  }
  if (want > PHASE_ORDER.indexOf('till')) {
    for (const b of world.beds) world.tillBed(b, 1);
  }
  if (want > PHASE_ORDER.indexOf('plant')) {
    for (const b of world.beds) {
      for (let j = b.plants.length; j < 3; j++) {
        world.plantSeed(b, V3(b.center.x - 0.9 + j * 0.9, 0, b.center.z + (j % 2 ? 0.5 : -0.4)));
      }
    }
    counts.planted = world.plants.length;
  }
  if (want > PHASE_ORDER.indexOf('channel')) {
    world.channels.gaps.forEach((g, i) => {
      if (!g.filled) world.snapPiece(world.channels.pieces[i], g);
    });
    counts.gaps = 3;
    world.setGapMarkers(false);
  }
  if (want > PHASE_ORDER.indexOf('nozzle')) {
    for (const n of world.nozzles) if (!n.fixed) world.fixNozzle(n);
    counts.nozzles = 3;
  }
  if (want > PHASE_ORDER.indexOf('gate')) {
    world.setGateOpen(1);
  }
  setPhase(target);
}

window.PARK_DEBUG = {
  phase: () => phase,
  cheatTo,
  fps: () => fpsVal,
  setTimeScale: (s) => { timeScale = s; },
  skipIntro: () => { if (phase === 'intro') setPhase('leaves'); },
  state: () => ({
    leaves: { collected: world.leavesCollected, total: world.leaves.length },
    beds: world.beds.map((b) => ({ progress: b.progress, tilled: b.tilled, plants: b.plants.length })),
    planted: world.plants.length,
    bloomedPlants: world.plants.filter((p) => p.state === 'bloomed').length,
    gaps: world.channels.gaps.map((g) => g.filled),
    pieces: world.channels.pieces.map((p) => p.snapped),
    nozzles: world.nozzles.map((n) => n.fixed),
    gateOpen: world.gateOpen,
    finale: { ...finale.flags, clock: finale.clock, life: world.life },
    ambientBloomed: fx.bloomedCount,
    wheelSpeed: world.wheelSpeed,
    draws: renderer.info.render.calls,
  }),
  screen: (kind, i = 0, j = 0) => {
    const project = (v) => {
      const v2 = v.clone().project(camera);
      return {
        x: (v2.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v2.y * 0.5 + 0.5) * window.innerHeight,
      };
    };
    switch (kind) {
      case 'leaf': {
        const lf = world.leaves.filter((l) => l.state === 'ground')[i];
        return lf ? project(lf.pos) : null;
      }
      case 'bed': return project(world.beds[i].center.clone().setY(0.3));
      case 'bedPoint': {
        const c = world.beds[i].center;
        return project(V3(c.x - 0.9 + j * 0.9, 0.3, c.z + (j % 2 ? 0.5 : -0.4)));
      }
      case 'piece': return project(world.channels.pieces[i].group.position.clone().setY(0.4));
      case 'gap': return project(world.channels.gaps[i].center.clone().setY(0.2));
      case 'nozzle': return project(world.nozzles[i].group.getWorldPosition(V3()));
      case 'gate': return project(world.gateHandlePos());
      case 'fountain': return project(LAYOUT.fountain.clone().setY(1));
      default: return null;
    }
  },
};

tick();
