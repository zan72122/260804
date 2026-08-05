/**
 * どうろを つくろう — メイン
 *
 * ながれ：
 *   1) ショベルカーで つちを すくって ダンプへ（ざくっ → どさっ）
 *   2) ダンプが いっぱいに なったら はしって いく
 *   3) ロードローラーで ごろごろ、みちを たいらに
 *   4) できた！
 *
 * こどもむけの ほうしん：
 *   ・しっぱい なし・てんすう なし・タイムリミット なし
 *   ・ゆびの いちから 「やりたい こと」を すいそくして つよく ほじょする
 *   ・きかいは ばねで ゆっくり おいかける（おおきい きかいの おもみ）
 */
import * as THREE from 'three';
import { Terrain, AREA, GRADE, FLOOR_Y } from './terrain.js';
import { createRenderer, buildWorld, CameraRig } from './scene.js';
import { Excavator } from './excavator.js';
import { DumpTruck, RoadRoller, LittleCar } from './vehicles.js';
import { SoilParticles, DustPuffs, Confetti } from './effects.js';
import { GameAudio } from './audio.js';
import { UI } from './ui.js';
import { clamp, lerp, damp, roundedBox, matteMaterial } from './util.js';

/* ================= きほん セットアップ ================= */

// デバッグ用の パラメータ（?timescale=4 / ?noshadow=1）。ふつうに あそぶ ときは つかわない。
const qs = new URLSearchParams(location.search);
const TIME_SCALE = clamp(parseFloat(qs.get('timescale')) || 1, 0.25, 8);
const NO_SHADOW = qs.get('noshadow') === '1';

const canvas = document.getElementById('scene');
const renderer = createRenderer(canvas);
if (NO_SHADOW) renderer.shadowMap.enabled = false;
const scene = new THREE.Scene();
const world = buildWorld(scene);
const rig = new CameraRig();
const camera = rig.camera;

const terrain = new Terrain();
scene.add(terrain.mesh);

const excavator = new Excavator(terrain, { x: -8.9, z: 1.4, yaw: 1.95 });
scene.add(excavator.group);

const truck = new DumpTruck({ x: -12.1, z: -1.8, exitDir: -1 });
scene.add(truck.group);

const roller = new RoadRoller(terrain, { x: AREA.maxX + 5.4, z: 0 });
roller.group.visible = false;
scene.add(roller.group);

const car = new LittleCar();
scene.add(car.group);

const soil = new SoilParticles(scene, terrain, 240);
const dust = new DustPuffs(scene, 150);
const confetti = new Confetti(scene, 180);

const audio = new GameAudio();
const ui = new UI(camera);

// どうろの センターライン（さいごに でてくる）
const centerLine = new THREE.Group();
{
  const mat = matteMaterial('#fdf8ec', { roughness: 0.7 });
  const geo = roundedBox(1.0, 0.03, 0.16, 0.015);
  for (let x = AREA.minX + 0.9; x < AREA.maxX - 0.4; x += 2.0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, GRADE + 0.02, 0);
    m.receiveShadow = true;
    m.scale.setScalar(0.001);
    m.visible = false;
    centerLine.add(m);
  }
}
scene.add(centerLine);

/* ================= じょうたい ================= */

const STATE = {
  TITLE: 'title',
  DIG: 'dig',
  TRUCK_OUT: 'truckOut',
  ROLL: 'roll',
  FINALE: 'finale',
  CLEAR: 'clear',
};
let state = STATE.TITLE;
let stateT = 0;
let idleT = 0;
let running = false;

const box = (a, b, c, d, e, f, fx, fy, fz) => ({
  min: new THREE.Vector3(a, b, c),
  max: new THREE.Vector3(d, e, f),
  focus: new THREE.Vector3(fx, fy, fz),
});
// よこ画面よう ／ たて画面よう の わく（たては ショベルまわりに よる）
const ROI = {
  [STATE.DIG]: {
    land: box(-15.2, 0, -3.4, -0.6, 3.4, 5.0, -7.8, 0.9, 0.6),
    portrait: box(-15.0, 0, -3.4, -1.6, 3.4, 5.0, -8.4, 0.9, 0.6),
  },
  [STATE.TRUCK_OUT]: {
    land: box(-15.2, 0, -3.4, -0.6, 3.4, 5.0, -7.8, 0.9, 0.6),
    portrait: box(-15.0, 0, -3.4, -1.6, 3.4, 5.0, -8.4, 0.9, 0.6),
  },
  [STATE.ROLL]: {
    land: box(-8.6, 0, -3.8, 8.6, 2.6, 4.6, 0, 0.5, 0.4),
    portrait: box(-8.4, 0, -3.6, 8.4, 2.4, 4.4, 0, 0.4, 0.4),
  },
  [STATE.FINALE]: {
    land: box(-9.8, 0, -4.4, 9.8, 3.4, 7.0, 0, 0.9, 1.2),
    portrait: box(-9.6, 0, -4.2, 9.6, 3.2, 6.4, 0, 0.8, 1.2),
  },
};
function applyROI(key, immediate = false) {
  const r = ROI[key] || ROI[STATE.DIG];
  rig.setROI(r.land, r.portrait);
  if (immediate) rig.update(0.016, true);
}

/* ================= にゅうりょく ================= */

const pointer = {
  active: false,
  id: null,
  nx: 0, ny: 0,          // -1..1
  moved: false,
};
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
// ローラーそうさ用：ドラムの まんなか あたりの へいめん
const rollerPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.32);
const _rollHit = new THREE.Vector3();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();

const view = { x: 0, y: 0, w: window.innerWidth, h: window.innerHeight };
function setPointerFromEvent(e) {
  pointer.nx = ((e.clientX - view.x) / view.w) * 2 - 1;
  pointer.ny = -(((e.clientY - view.y) / view.h) * 2 - 1);
}

canvas.addEventListener('pointerdown', (e) => {
  if (!running) return;
  if (pointer.active && pointer.id !== e.pointerId) return;
  pointer.active = true;
  pointer.id = e.pointerId;
  pointer.moved = false;
  setPointerFromEvent(e);
  idleT = 0;
  ui.hideHint();
  canvas.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}, { passive: false });

canvas.addEventListener('pointermove', (e) => {
  if (!pointer.active || e.pointerId !== pointer.id) return;
  setPointerFromEvent(e);
  pointer.moved = true;
  idleT = 0;
  e.preventDefault();
}, { passive: false });

function endPointer(e) {
  if (!pointer.active || (e && e.pointerId !== pointer.id)) return;
  pointer.active = false;
  pointer.id = null;
  idleT = 0;
  onRelease();
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
window.addEventListener('blur', () => endPointer());

// iOS の ダブルタップ ズーム／スクロール よけ
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('touchmove', (e) => { if (e.cancelable) e.preventDefault(); }, { passive: false });
document.addEventListener('dblclick', (e) => e.preventDefault());

/* ---- ゆびの いち → せかいの いち ---- */

/** せんかいじく まわりの えんとうの 「おく がわ」との こうてん */
function cylinderFar(origin, dir, cx, cz, R) {
  const ox = origin.x - cx, oz = origin.z - cz;
  const a = dir.x * dir.x + dir.z * dir.z;
  if (a < 1e-6) return null;
  const b = 2 * (dir.x * ox + dir.z * oz);
  const c = ox * ox + oz * oz - R * R;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  const t = (-b + s) / (2 * a);
  if (t <= 0) return null;
  return tmpV2.copy(origin).addScaledVector(dir, t);
}

const DIG_DEPTH = 0.34;

// ダンプの あたり はんてい（ざっくり おおきめ ＝ ほじょ）
const truckZone = new THREE.Box3();
function updateTruckZone() {
  const p = truck.group.position;
  truckZone.min.set(p.x - 3.9, -0.4, p.z - 2.4);
  truckZone.max.set(p.x + 3.9, 5.2, p.z + 2.4);
}
updateTruckZone();
const _zoneHit = new THREE.Vector3();
const _terrHit = new THREE.Vector3();
const _groundHit = new THREE.Vector3();

/** ゆびの いちから 「なにを したいか」を きめる（つよい ほじょ） */
function resolveExcavatorTarget() {
  raycaster.setFromCamera({ x: pointer.nx, y: pointer.ny }, camera);
  const origin = raycaster.ray.origin;
  const dir = raycaster.ray.direction;

  // ① つちの ひょうめん（やまの しゃめんに あたる）
  const hitTerrain = terrain.raycast(origin, dir);
  if (hitTerrain) _terrHit.copy(hitTerrain);
  // ② じめん（y=0）。やまの むこうを ねらった ときや、
  //    レイが みちの そとを とおって しまった ときの うけざら
  const g = raycaster.ray.intersectPlane(groundPlane, _groundHit);
  const hitGround = (g && g.distanceTo(origin) < 90) ? _groundHit : null;

  const surface = hitTerrain ? _terrHit : hitGround;

  const ex = excavator.group.position;
  const loaded = excavator.load > 0.03;

  // ① ダンプに ゆびが かかったら → どさっ（つみこみ）
  if (loaded && truck.state === 'parked') {
    const tTerrain = hitTerrain ? origin.distanceTo(_terrHit) : Infinity;
    let hitTruck = Infinity;
    if (raycaster.ray.intersectBox(truckZone, _zoneHit)) {
      hitTruck = origin.distanceTo(_zoneHit);
    }
    // じめんの さきが ダンプの ちかく でも OK に する
    let nearGround = false;
    if (surface) {
      nearGround = Math.hypot(surface.x - truck.group.position.x,
                              surface.z - truck.group.position.z) < 3.9;
    }
    if (nearGround || hitTruck < tTerrain) {
      tmpV.copy(truck.dropPoint);
      tmpV.y += 1.05;
      return { point: tmpV.clone(), mode: 'dump' };
    }
  }

  // ② つちの うえ → ざくっ（ほる）
  // つちの ひょうめんに あたれば そこ。あたらなくても じめんが みちの うえなら そこを ほる。
  let digPt = null;
  if (hitTerrain && terrain.inside(_terrHit.x, _terrHit.z, -0.45)) digPt = _terrHit;
  else if (hitGround && terrain.inside(hitGround.x, hitGround.z, -2.6)) {
    // すこし はみだして いても、みちの なかへ そっと ひきもどす
    _groundHit.x = clamp(_groundHit.x, AREA.minX + 0.1, AREA.maxX - 0.1);
    _groundHit.z = clamp(_groundHit.z, AREA.minZ + 0.1, AREA.maxZ - 0.1);
    digPt = _groundHit;
  }
  if (digPt) {
    const reach = Math.hypot(digPt.x - ex.x, digPt.z - ex.z);
    if (reach < excavator.reachMax + 1.4) {
      const h = terrain.heightAt(digPt.x, digPt.z);
      const depth = excavator.load < 1 ? DIG_DEPTH : 0.02;
      return {
        point: new THREE.Vector3(digPt.x, Math.max(h - depth, FLOOR_Y), digPt.z),
        mode: 'dig',
      };
    }
  }

  // ③ それ いがい → そらへ もちあげる
  const R = 4.3;
  const q = cylinderFar(origin, dir, ex.x, ex.z, R);
  if (q) {
    const yaw = Math.atan2(q.x - ex.x, q.z - ex.z);
    const y = clamp(q.y, 0.45, 4.6);
    return {
      point: new THREE.Vector3(ex.x + Math.sin(yaw) * R, y, ex.z + Math.cos(yaw) * R),
      mode: 'air',
    };
  }
  if (surface) {
    const yaw = Math.atan2(surface.x - ex.x, surface.z - ex.z);
    return {
      point: new THREE.Vector3(ex.x + Math.sin(yaw) * R, 1.9, ex.z + Math.cos(yaw) * R),
      mode: 'air',
    };
  }
  return null;
}

/** ゆびを はなした とき：すくって いたら「もちあげて みせる」 */
let showOffT = 0;
function onRelease() {
  if (state === STATE.DIG && excavator.load > 0.06) {
    showOffT = 1.1;
    const ex = excavator.group.position;
    const yaw = excavator.yaw;
    excavator.setTarget(new THREE.Vector3(ex.x + Math.sin(yaw) * 4.0, 2.6, ex.z + Math.cos(yaw) * 4.0), 'air');
  } else {
    excavator.idle();
  }
}

/* ================= えんしゅつの コールバック ================= */

let digSoundT = 0;
let digPopT = 0;
let dumpPopDone = false;
let fullAnnounced = false;

excavator.onDig = (tip, removed, speed) => {
  const n = clamp(Math.round(removed * 220), 0, 3);
  for (let i = 0; i < n; i++) {
    soil.spawn(
      tip.x + (Math.random() - 0.5) * 0.5,
      tip.y + 0.25 + Math.random() * 0.2,
      tip.z + (Math.random() - 0.5) * 0.5,
      (Math.random() - 0.5) * 1.6,
      1.2 + Math.random() * 1.8,
      (Math.random() - 0.5) * 1.6,
      { color: '#7a5334', scale: 0.5 + Math.random() * 0.8 }
    );
  }
  if (Math.random() < 0.35) dust.puff(tip, 1, { color: '#d8c3a4', size: 0.55, r: 0.5, vy: 0.5, life: 0.7 });
  if (digSoundT <= 0 && speed > 0.35) {
    audio.dig(clamp(0.5 + speed * 0.25, 0.4, 1));
    digSoundT = 0.16;
    rig.bump(0.18);
  }
  if (digPopT <= 0 && speed > 0.9) {
    ui.popup('ざくっ', tip, 'dig');
    digPopT = 1.4;
  }
};

excavator.onDumpTick = (tip, amount) => {
  truck.addSoil(amount * 0.26);
  const n = clamp(Math.round(amount * 90), 0, 3);
  const dp = truck.dropPoint;
  for (let i = 0; i < n; i++) {
    soil.spawn(
      tip.x + (Math.random() - 0.5) * 0.7,
      tip.y - 0.1,
      tip.z + (Math.random() - 0.5) * 0.7,
      (dp.x - tip.x) * 0.5 + (Math.random() - 0.5) * 0.5,
      -0.4,
      (dp.z - tip.z) * 0.5 + (Math.random() - 0.5) * 0.5,
      { color: '#7d5636', scale: 0.6 + Math.random() * 0.8, life: 0.7 }
    );
  }
  dust.puff(dp, 1, { color: '#e3d2b6', size: 0.85, r: 0.9, vy: 0.7, life: 0.9 });
  if (!dumpPopDone) {
    dumpPopDone = true;
    ui.popup('どさっ', dp, 'dump');
    audio.dump(1);
    rig.bump(0.5);
  }
};

roller.onRoll = (pos, moved, speed) => {
  if (speed > 0.35 && Math.random() < 0.55) {
    const side = Math.random() < 0.5 ? -1 : 1;
    dust.puff(
      { x: pos.x + Math.cos(roller.heading) * side * 1.1, y: 0.12, z: pos.z - Math.sin(roller.heading) * side * 1.1 },
      1, { color: '#e0cfb2', size: 0.7, r: 0.6, vy: 0.35, life: 0.8 }
    );
  }
};

/* ================= しんこう ================= */

let rollPopT = 0;
let rollProgress = 0;

function setState(next) {
  state = next;
  stateT = 0;
  applyROI(next);
  if (next === STATE.DIG) {
    ui.setTask('🚜', 'つちを すくって ダンプへ');
    ui.setMeter(truck.fill, '🚚');
  } else if (next === STATE.ROLL) {
    ui.setTask('🛞', 'ごろごろ たいらに しよう');
    ui.setMeter(0, '🛣️');
  } else if (next === STATE.FINALE) {
    ui.setTask('🎉', 'どうろの かんせい！');
    ui.setMeter(1, '🛣️');
  }
}

function startGame() {
  running = true;
  ui.showHud(true);
  setState(STATE.DIG);
  applyROI(STATE.DIG, true);
  idleT = 0;
}

function resetGame() {
  terrain.reset();
  excavator.reset();
  truck.reset();
  truck.group.visible = true;
  roller.reset();
  roller.group.visible = false;
  soil.clear();
  dust.clear();
  confetti.hide();
  car.running = false;
  car.group.visible = false;
  for (const m of centerLine.children) { m.visible = false; m.scale.setScalar(0.001); }
  world.flowers.userData.bloom(0);
  dumpPopDone = false;
  fullAnnounced = false;
  rollProgress = 0;
  showOffT = 0;
  startGame();
}

/* ================= ヒント ================= */

const hintPos = new THREE.Vector3();
function updateHint(dt) {
  if (pointer.active) { idleT = 0; ui.hideHint(); return; }
  idleT += dt;
  if (idleT < 3.2) { ui.hideHint(); return; }

  if (state === STATE.DIG) {
    if (excavator.load > 0.4) {
      hintPos.copy(truck.dropPoint).setY(truck.dropPoint.y + 0.7);
    } else {
      const ex = excavator.group.position;
      terrain.bestDigPoint(ex.x, ex.z, excavator.reachMax + 0.7, hintPos);
      hintPos.y += 0.35;
    }
    ui.showHintAt(hintPos);
  } else if (state === STATE.ROLL) {
    // まだ ならして いない ところ
    let bx = 0, bz = 0, best = -1;
    for (let j = 3; j < terrain.nz - 3; j += 3) {
      for (let i = 3; i < terrain.nx - 3; i += 3) {
        const k = j * terrain.nx + i;
        const score = (1 - terrain.road[k]) + Math.max(0, terrain.h[k] - GRADE);
        if (score > best) {
          best = score;
          bx = AREA.minX + i * terrain.dx;
          bz = AREA.minZ + j * terrain.dz;
        }
      }
    }
    hintPos.set(bx, terrain.heightAt(bx, bz) + 0.4, bz);
    ui.showHintAt(hintPos);
  } else {
    ui.hideHint();
  }
}

/* ================= ループ ================= */

let last = performance.now();
let paused = false;
let fps = 60, frameCount = 0, fpsAccum = 0;

/**
 * ふるい たんまつでも とまらない ように、おそく なったら
 * じどうで えの きめこまかさを さげる（3だんかい）。
 */
let quality = 2;         // 2 = きれい / 1 = ふつう / 0 = かるい
let slowFor = 0, fastFor = 0;
let qualityGrace = 4;   // さいしょの すうびょうは シェーダーの じゅんびで おそいので みのがす
function adaptQuality() {
  if (NO_SHADOW) return;
  if (qualityGrace > 0) { qualityGrace -= 0.5; return; }
  if (fps < 38) { slowFor += 0.5; fastFor = 0; } else if (fps > 55) { fastFor += 0.5; slowFor = 0; } else { slowFor = fastFor = 0; }
  if (slowFor >= 2.5 && quality > 0) { setQuality(quality - 1); slowFor = 0; }
  else if (fastFor >= 8 && quality < 2) { setQuality(quality + 1); fastFor = 0; }
}
function setQuality(q) {
  quality = q;
  const dpr = window.devicePixelRatio || 1;
  renderer.setPixelRatio(q >= 2 ? Math.min(dpr, 2) : q === 1 ? Math.min(dpr, 1.35) : 1);
  renderer.shadowMap.enabled = q > 0;
  world.sun.shadow.mapSize.set(q >= 2 ? 2048 : 1024, q >= 2 ? 2048 : 1024);
  if (world.sun.shadow.map) { world.sun.shadow.map.dispose(); world.sun.shadow.map = null; }
  scene.traverse((o) => { if (o.isMesh && o.material && o.material.needsUpdate !== undefined) o.material.needsUpdate = true; });
  const rect = canvas.getBoundingClientRect();
  renderer.setSize(Math.max(1, Math.round(rect.width)), Math.max(1, Math.round(rect.height)), false);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (paused) { last = now; return; }
  const rawDt = (now - last) / 1000;
  last = now;
  let dt = rawDt;
  if (dt > 0.06) dt = 0.06;   // タブが とまって いた ときの ジャンプ よけ
  dt *= TIME_SCALE;
  if (dt <= 0) return;

  frameCount++;
  fpsAccum += rawDt;
  if (fpsAccum > 0.5) {
    fps = frameCount / fpsAccum;
    frameCount = 0; fpsAccum = 0;
    adaptQuality();
  }

  digSoundT -= dt;
  digPopT -= dt;
  rollPopT -= dt;
  stateT += dt;

  world.tick(dt);

  if (running) {
    switch (state) {
      case STATE.DIG: updateDig(dt); break;
      case STATE.TRUCK_OUT: updateTruckOut(dt); break;
      case STATE.ROLL: updateRoll(dt); break;
      case STATE.FINALE: updateFinale(dt); break;
      default: break;
    }
    updateHint(dt);
  }

  excavator.update(dt);
  truck.update(dt);
  roller.update(dt);
  car.update(dt);
  terrain.update(dt);
  soil.update(dt);
  dust.update(dt);
  confetti.update(dt);

  rig.update(dt);
  ui.updateHint();
  renderer.render(scene, camera);
}

/* ---- 1) ほる ---- */
function updateDig(dt) {
  if (pointer.active) {
    const r = resolveExcavatorTarget();
    if (r) excavator.setTarget(r.point, r.mode);
    if (excavator.mode !== 'dump') dumpPopDone = false;
    showOffT = 0;
  } else if (showOffT > 0) {
    showOffT -= dt;
    if (showOffT <= 0) excavator.idle();
  }

  // エンジンおと は うごきに あわせて
  const activity = clamp(excavator.tipSpeed * 0.5 + (pointer.active ? 0.35 : 0.12), 0.12, 1);
  audio.setEngine(activity);
  audio.setRumble(0);

  // マフラーの けむり
  if (Math.random() < dt * 6) {
    excavator.exhaust.getWorldPosition(tmpV);
    dust.spawn(tmpV.x, tmpV.y, tmpV.z, { color: '#d9dde2', size: 0.32, vy: 0.85, life: 1.1, spread: 0.15 });
  }

  ui.setMeter(truck.fill, '🚚');

  // バケットが いっぱいに なった しゅんかん の あいず
  if (excavator.load >= 0.999 && !fullAnnounced) {
    fullAnnounced = true;
    ui.popup('すくえた！', excavator.tipWorld.clone().setY(excavator.tipWorld.y + 0.7), 'cheer');
    audio.clank(0.22);
  } else if (excavator.load < 0.2) {
    fullAnnounced = false;
  }

  if (truck.fill >= 0.985 && truck.state === 'parked') {
    truck.leave();
    audio.horn();
    ui.popup('いっぱい！', truck.dropPoint, 'cheer');
    setState(STATE.TRUCK_OUT);
    excavator.park();
    ui.setTask('🚚', 'ダンプ いってらっしゃい');
  }
}

/* ---- 2) ダンプが でていく ---- */
function updateTruckOut(dt) {
  audio.setEngine(0.3);
  if (truck.state === 'gone') truck.group.visible = false;
  if (Math.random() < dt * 10 && truck.state === 'leaving') {
    dust.puff({ x: truck.group.position.x + 2.6, y: 0.15, z: truck.group.position.z }, 1,
      { color: '#ded0b8', size: 0.8, r: 0.7, vy: 0.5, life: 0.9 });
  }
  if (stateT > 2.4) {
    setState(STATE.ROLL);
    roller.group.visible = true;
    roller.driveIn();
    ui.popup('つぎは ローラー！', new THREE.Vector3(AREA.maxX - 1.2, 2.0, 0), 'roll');
  }
}

/* ---- 3) ならす ---- */
function updateRoll(dt) {
  if (pointer.active) {
    raycaster.setFromCamera({ x: pointer.nx, y: pointer.ny }, camera);
    // つちの やまに さえぎられない ように、ドラムの たかさの へいめん で うけとる
    const hit = raycaster.ray.intersectPlane(rollerPlane, _rollHit);
    if (hit) roller.setTarget(hit.x, hit.z);
  }
  const moving = roller.speed > 0.25;
  audio.setEngine(0.18);
  audio.setRumble(moving ? clamp(roller.speed / 2.4, 0.3, 1) : 0.08);
  if (moving) rig.bump(dt * 0.5);

  rollProgress = damp(rollProgress, terrain.rollProgress(), 4, dt);
  ui.setMeter(rollProgress / 0.82, '🛣️');

  if (moving && rollPopT <= 0) {
    ui.popup('ごろごろ', roller.group.position.clone().setY(1.9), 'roll');
    rollPopT = 2.6;
  }

  if (rollProgress >= 0.82) {
    setState(STATE.FINALE);
    audio.setRumble(0);
    audio.fanfare();
    confetti.fire(new THREE.Vector3(0, 1, 1));
    ui.popup('できた！', new THREE.Vector3(0, 2.4, 0.5), 'cheer');
    roller.active = false;
    roller.setTarget(AREA.maxX + 2.4, 0);
  }
}

/* ---- 4) かんせい ---- */
let finaleStep = 0;
function updateFinale(dt) {
  audio.setEngine(0.12);
  audio.setRumble(0.05);

  // どうろ ぜんたいを ひだりから しあげる（はしっこも ピカピカに）
  const finishX = lerp(AREA.minX - 0.2, AREA.maxX + 0.2, clamp(stateT / 1.6, 0, 1));
  terrain.finishTo(finishX, dt);

  // センターライン が ぽんぽん でてくる
  const n = Math.floor(clamp((stateT - 0.5) / 0.09, 0, centerLine.children.length));
  for (let i = 0; i < centerLine.children.length; i++) {
    const m = centerLine.children[i];
    if (i < n) {
      if (!m.visible) { m.visible = true; audio.blip(760 + i * 12); }
      m.scale.setScalar(damp(m.scale.x, 1, 12, dt));
    }
  }

  // おはなが さく
  world.flowers.userData.bloom(clamp((stateT - 0.6) / 2.2, 0, 1));

  if (finaleStep === 0 && stateT > 2.6) {
    finaleStep = 1;
    car.start(AREA.minX - 8, 1.35, 4.6);
  }
  if (finaleStep === 1 && stateT > 5.4) {
    finaleStep = 2;
    ui.showOverlay(ui.clearScreen);
    ui.showHud(false);
    state = STATE.CLEAR;
  }
}

/* ================= がめん サイズ ================= */

function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  view.x = rect.left; view.y = rect.top; view.w = w; view.h = h;
  ui.setViewport({ x: rect.left, y: rect.top, w, h });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);
  rig.resize(w, h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));
if (window.visualViewport) window.visualViewport.addEventListener('resize', resize);
resize();
applyROI(STATE.DIG, true);

document.addEventListener('visibilitychange', () => {
  paused = document.hidden;
  if (document.hidden) audio.suspend(); else { audio.resume(); last = performance.now(); }
});

/* ================= ボタン ================= */

document.getElementById('startBtn').addEventListener('click', () => {
  audio.init();
  audio.blip(880);
  ui.hideOverlay(ui.startScreen, () => startGame());
});

document.getElementById('againBtn').addEventListener('click', () => {
  audio.blip(880);
  finaleStep = 0;
  ui.hideOverlay(ui.clearScreen, () => resetGame());
});

const soundBtn = document.getElementById('soundBtn');
soundBtn.addEventListener('click', () => {
  const on = soundBtn.classList.toggle('off');
  audio.setEnabled(!on);
  soundBtn.textContent = on ? '🔈' : '🔊';
});

/* ================= スタート ================= */

requestAnimationFrame((t) => { last = t; frame(t); });

// デバッグ／じどう しあそび よう
window.__game = {
  get state() { return state; },
  scene, camera, terrain, excavator, truck, roller, rig, ui, renderer,
  start: startGame,
  reset: resetGame,
  setPointer(nx, ny, active = true) {
    pointer.nx = nx; pointer.ny = ny; pointer.active = active;
    if (!active) onRelease();
  },
  project(x, y, z) {
    return ui.worldToScreen(new THREE.Vector3(x, y, z));
  },
  truckDrop() { return truck.dropPoint.toArray(); },
  resolveAt(nx, ny) {
    const sx = pointer.nx, sy = pointer.ny;
    pointer.nx = nx; pointer.ny = ny;
    const r = resolveExcavatorTarget();
    pointer.nx = sx; pointer.ny = sy;
    return r ? { mode: r.mode, point: r.point.toArray().map((v) => +v.toFixed(2)) } : null;
  },
  digSpot() {
    const ex = excavator.group.position;
    return terrain.bestDigPoint(ex.x, ex.z, excavator.reachMax + 0.5, new THREE.Vector3()).toArray();
  },
  info() {
    return {
      state,
      fps: +fps.toFixed(1),
      load: excavator.load,
      fill: truck.fill,
      roll: terrain.rollProgress(),
      above: terrain.volumeAboveGrade(),
      tip: excavator.tipWorld.toArray().map((v) => +v.toFixed(2)),
      yaw: +excavator.yaw.toFixed(2),
      camera: camera.position.toArray().map((v) => +v.toFixed(2)),
    };
  },
};
