// ------------------------------------------------------------------
// main.js — game controller: phases, one-finger input, camera moves,
// the show sequence, and test hooks (window.__game).
// ------------------------------------------------------------------
import * as THREE from '../vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { SoundKit } from './audio.js';
import { MoviePainter, THEMES } from './movie.js';

// ---------- renderer / scene --------------------------------------
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x140f1c);
scene.fog = new THREE.Fog(0x140f1c, 20, 70);

const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 80);
const refs = buildWorld(scene);
const sounds = new SoundKit();
const painter = new MoviePainter();
const movieTex = new THREE.CanvasTexture(painter.canvas);
movieTex.colorSpace = THREE.SRGBColorSpace;
refs.movieMat.map = movieTex;
refs.movieMat.needsUpdate = true;

// ---------- camera rig --------------------------------------------
const rig = {
  pos: new THREE.Vector3(5.2, 4.8, 5.2),
  target: new THREE.Vector3(0, 3, -6),
  fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(),
  fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3(),
  t: 1, dur: 1.6,
};
function easeInOut(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
function moveCam(pos, tgt, dur = 1.6) {
  rig.fromPos.copy(rig.pos); rig.toPos.set(...pos);
  rig.fromTgt.copy(rig.target); rig.toTgt.set(...tgt);
  rig.t = 0; rig.dur = dur;
}
const STATIONS = {
  title: { pos: [5.4, 5.0, 4.6], tgt: [0, 3.2, -6] },
  lens: { pos: [0.95, 3.85, 5.75], tgt: [0, 3.6, 7.1] },
  filmPick: { pos: [-1.85, 4.0, 11.35], tgt: [-1.85, 3.45, 9.2] },
  filmThread: { pos: [3.05, 4.35, 8.15], tgt: [0.3, 3.9, 8.15] },
  sound: { pos: [0.35, 4.75, 11.0], tgt: [1.5, 2.95, 9.0] },
  focus: { pos: [0.75, 4.35, 10.6], tgt: [0, 3.7, -15] },
  seats: { pos: [0, 6.6, 3.8], tgt: [0, 0.7, -5.5] },
  curtain: { pos: [1.9, 3.7, -8.2], tgt: [4.9, 3.1, -14.3] },
  ready: { pos: [-1.75, 4.6, 6.25], tgt: [-0.36, 3.9, 8.05] },
  show: { pos: [0.9, 2.8, 3.8], tgt: [0, 3.5, -15] },
};

function applyAspect() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect >= 1 ? 55 : Math.min(86, 55 / Math.max(0.42, camera.aspect));
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', applyAspect);
applyAspect();

// ---------- hint hand sprite --------------------------------------
function handTexture() {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.translate(64, 64);
  x.fillStyle = 'rgba(255,255,255,0.98)';
  x.strokeStyle = 'rgba(60,50,80,0.9)';
  x.lineWidth = 5; x.lineJoin = 'round';
  const p = new Path2D(
    'M -6 -52 a 9 9 0 0 1 18 0 L 12 -6 L 22 -12 a 9 8 0 0 1 14 6 L 34 22 ' +
    'Q 32 44 12 48 L -4 48 Q -22 44 -26 20 L -30 -2 a 8 8 0 0 1 14 -6 L -6 4 Z');
  x.fill(p); x.stroke(p);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const hint = new THREE.Sprite(new THREE.SpriteMaterial({
  map: handTexture(), transparent: true, depthTest: false, opacity: 0.95, fog: false }));
hint.scale.set(0.34, 0.34, 1);
hint.renderOrder = 20;
hint.visible = false;
scene.add(hint);
const hintState = { base: new THREE.Vector3(), mode: 'tap', scale: 0.34 };
function setHint(v, mode = 'tap', scale = 0.34) {
  if (!v) { hint.visible = false; return; }
  hintState.base.copy(v); hintState.mode = mode; hintState.scale = scale;
  hint.visible = true;
}

// glow ring highlight (marks the tap target)
const ringTex = (() => {
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = '#ffd94d'; x.lineWidth = 10;
  x.shadowColor = '#ffd94d'; x.shadowBlur = 14;
  x.beginPath(); x.arc(64, 64, 44, 0, 7); x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const glowRing = new THREE.Sprite(new THREE.SpriteMaterial({
  map: ringTex, transparent: true, depthTest: false, opacity: 0.9, fog: false }));
glowRing.renderOrder = 19;
glowRing.visible = false;
scene.add(glowRing);
function setRing(v, scale = 0.5) {
  if (!v) { glowRing.visible = false; return; }
  glowRing.position.copy(v); glowRing.visible = true;
  glowRing.userData.scale = scale;
}

// ---------- sparkle bursts ----------------------------------------
const starTex = (() => {
  const c = document.createElement('canvas'); c.width = 64; c.height = 64;
  const x = c.getContext('2d');
  x.translate(32, 32); x.fillStyle = '#fff6c8';
  x.shadowColor = '#ffe27d'; x.shadowBlur = 8;
  x.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 26 : 11, a = i / 10 * Math.PI * 2 - Math.PI / 2;
    x[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  x.closePath(); x.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const bursts = [];
function sparkleBurst(pos, scale = 1) {
  const n = 16;
  const geo = new THREE.BufferGeometry();
  const p = new Float32Array(n * 3);
  const vel = [];
  for (let i = 0; i < n; i++) {
    p.set([pos.x, pos.y, pos.z], i * 3);
    const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2;
    const s = (0.6 + Math.random() * 1.1) * scale;
    vel.push(new THREE.Vector3(Math.cos(a) * Math.cos(e) * s, Math.sin(e) * s + 0.7 * scale, Math.sin(a) * Math.cos(e) * s));
  }
  geo.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({
    map: starTex, size: 0.14 * scale, transparent: true, opacity: 1,
    depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  bursts.push({ pts, vel, life: 0 });
}
function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life += dt;
    const arr = b.pts.geometry.attributes.position;
    for (let j = 0; j < b.vel.length; j++) {
      arr.setXYZ(j,
        arr.getX(j) + b.vel[j].x * dt,
        arr.getY(j) + (b.vel[j].y -= dt * 2.2) * dt + b.vel[j].y * 0, // gravity applied to vel
        arr.getZ(j) + b.vel[j].z * dt);
    }
    arr.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, 1 - b.life / 0.9);
    if (b.life > 0.9) {
      scene.remove(b.pts);
      b.pts.geometry.dispose(); b.pts.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

// ---------- tweens ------------------------------------------------
const tweens = [];
function tween(obj, key, to, dur, ease = easeInOut, done = null) {
  tweens.push({ obj, key, from: obj[key], to, t: 0, dur, ease, done });
}
function tweenV3(v, to, dur, ease = easeInOut, done = null) {
  const from = v.clone();
  tweens.push({ v, from, to: to.clone(), t: 0, dur, ease, done });
}
function updateTweens(dt) {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t += dt;
    const k = Math.min(1, tw.t / tw.dur);
    const e = tw.ease(k);
    if (tw.v) tw.v.copy(tw.from).lerp(tw.to, e);
    else tw.obj[tw.key] = tw.from + (tw.to - tw.from) * e;
    if (k >= 1) {
      tweens.splice(i, 1);
      if (tw.done) tw.done();
    }
  }
}
function bounceOut(t) {
  const n1 = 7.5625, d1 = 2.75;
  if (t < 1 / d1) return n1 * t * t;
  if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
  if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
  return n1 * (t -= 2.625 / d1) * t + 0.984375;
}

// ---------- game state --------------------------------------------
const PH = { TITLE: 'title', LENS: 'lens', FILM_PICK: 'filmPick', FILM_THREAD: 'filmThread',
  SOUND: 'sound', FOCUS: 'focus', SEATS: 'seats', CURTAIN: 'curtain', READY: 'ready', SHOW: 'show' };
const state = {
  phase: PH.TITLE,
  clean: 0,            // 0..1 lens cleanliness
  theme: null,
  pickedReel: null,
  filmT: 0,
  focus: 1,            // 1 blurry .. 0 sharp
  plugged: false,
  curtainClosed: false,
  showT: -1,
  time: 0,
};

const hudSteps = [...document.querySelectorAll('#hud .step')];
const HUD_INDEX = { [PH.LENS]: 0, [PH.FILM_PICK]: 1, [PH.FILM_THREAD]: 1, [PH.SOUND]: 2,
  [PH.FOCUS]: 3, [PH.SEATS]: 4, [PH.CURTAIN]: 4, [PH.READY]: 5, [PH.SHOW]: 5 };
function refreshHud() {
  const cur = HUD_INDEX[state.phase];
  hudSteps.forEach((el, i) => {
    el.classList.toggle('now', i === cur);
    el.classList.toggle('done', cur !== undefined ? i < cur : false);
  });
  if (state.phase === PH.SHOW) hudSteps.forEach(el => el.classList.add('done'));
}

// lens-cleaning coverage grid
const lensGrid = { cells: new Set(), total: 0 };
{
  const N = 10;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const cx = (i + 0.5) / N - 0.5, cy = (j + 0.5) / N - 0.5;
    if (Math.hypot(cx, cy) <= 0.48) lensGrid.total++;
  }
}

// sponge for lens cleaning
const sponge = new THREE.Group();
{
  const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.07, 0.11),
    new THREE.MeshStandardMaterial({ color: 0xffd94d, roughness: 0.95 }));
  const s2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.11),
    new THREE.MeshStandardMaterial({ color: 0x63c257, roughness: 0.95 }));
  s2.position.y = -0.05;
  sponge.add(s1); sponge.add(s2);
  sponge.visible = false;
  scene.add(sponge);
}

// generous invisible hit disc over the lens (kid-sized touch target)
const lensHitDisc = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24),
  new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, transparent: true }));
lensHitDisc.position.set(0, 3.62, 7.10);
lensHitDisc.rotation.y = Math.PI;
scene.add(lensHitDisc);

// film curve samples for threading
const curvePts = refs.filmCurve.getSpacedPoints(refs.ribbon.samples);

// ---------- phase transitions -------------------------------------
function enter(phase) {
  state.phase = phase;
  refreshHud();
  const S = STATIONS[phase] || STATIONS.title;
  moveCam(S.pos, S.tgt);
  setHint(null); setRing(null);
  sponge.visible = false;

  if (phase === PH.TITLE) {
    setRing(new THREE.Vector3(0, 4.1, 8.2), 1.3);
  } else if (phase === PH.LENS) {
    const p = new THREE.Vector3(0, 3.62, 7.08);
    setHint(p.clone().add(new THREE.Vector3(0.22, -0.18, 0.3)), 'rub', 0.22);
    setRing(p, 0.42);
  } else if (phase === PH.FILM_PICK) {
    const p = new THREE.Vector3(-1.85, 3.6, 9.6);
    setHint(p.clone().add(new THREE.Vector3(0.3, -0.25, 0.5)), 'tap', 0.3);
  } else if (phase === PH.FILM_THREAD) {
    refs.filmHandle.visible = true;
    state.filmT = 0.015;
    setHint(curvePts[6].clone().add(new THREE.Vector3(0.3, -0.1, 0)), 'drag', 0.22);
  } else if (phase === PH.SOUND) {
    setHint(refs.plug.position.clone().add(new THREE.Vector3(0.15, -0.05, 0.35)), 'drag', 0.26);
    const sp = new THREE.Vector3();
    refs.socket.getWorldPosition(sp);
    setRing(sp, 0.4);
  } else if (phase === PH.FOCUS) {
    refs.focusMat.uniforms.uOn.value = 0;
    tween(refs.focusMat.uniforms.uOn, 'value', 1, 1.4);
    const rp = new THREE.Vector3();
    refs.focusRing.getWorldPosition(rp);
    setHint(rp.clone().add(new THREE.Vector3(0.35, -0.05, 0.6)), 'swipe', 0.26);
  } else if (phase === PH.SEATS) {
    const first = refs.crooked.find(s => !s.fixed);
    if (first) {
      const p = first.group.position.clone().add(new THREE.Vector3(0, 1.0, 0));
      setHint(p, 'tap', 0.42);
    }
  } else if (phase === PH.CURTAIN) {
    const p = refs.tassel.position.clone().add(new THREE.Vector3(0, 0.3, 0));
    setHint(p.clone().add(new THREE.Vector3(-0.35, -0.3, 0.4)), 'tap', 0.3);
    setRing(p, 0.6);
  } else if (phase === PH.READY) {
    const bp = new THREE.Vector3();
    refs.startBtn.getWorldPosition(bp);
    setHint(bp.clone().add(new THREE.Vector3(-0.25, -0.1, -0.35)), 'tap', 0.24);
    setRing(bp, 0.34);
    refs.startBtnMat.emissiveIntensity = 1;
  } else if (phase === PH.SHOW) {
    document.getElementById('showui').classList.add('on');
    document.querySelectorAll('.reelbtn').forEach((b, i) =>
      b.classList.toggle('now', THEMES[i] === state.theme));
  }
}

function stepDone(chimeIdx, next, delay = 1.1) {
  sounds.chime(chimeIdx);
  setHint(null); setRing(null);
  setTimeout(() => enter(next), delay * 1000);
}

// ---------- the show sequence -------------------------------------
const showFx = { beamFlicker: 0, glowSample: 0 };
function startShow() {
  state.showT = 0;
  enter(PH.SHOW);
  sounds.clunk();
  // button press-down
  tween(refs.startBtn.position, 'y', refs.startBtn.position.y - 0.03, 0.12, easeInOut, () => {
    tween(refs.startBtn.position, 'y', refs.startBtn.position.y + 0.03, 0.3);
  });
  refs.startBtnMat.emissiveIntensity = 0.15;
  sounds.humStart();

  // 1) house lights dim
  setTimeout(() => {
    const L = refs.lights;
    tween(L.house, 'intensity', 2.2, 2.0);
    tween(L.hemi, 'intensity', 0.13, 2.0);
    tween(L.amb, 'intensity', 0.1, 2.0);
    tween(L.boothLight, 'intensity', 2.5, 2.0);
    refs.sconceLights.forEach(pl => tween(pl, 'intensity', 0.7, 2.0));
    refs.sconceBulbs.forEach(m => tween(m, 'emissiveIntensity', 0.12, 2.0));
    refs.ceilLampMats.forEach(m => tween(m, 'emissiveIntensity', 0.04, 2.0));
  }, 400);

  // 2) curtains open
  setTimeout(() => {
    sounds.swish(1.6);
    tween(refs.curtainL.scale, 'x', 0.22, 2.6);
    tween(refs.curtainR.scale, 'x', 0.22, 2.6);
  }, 2500);

  // 3) beam bursts out of the booth
  setTimeout(() => {
    sounds.whoosh(1.4);
    refs.spot.visible = true;
    tween(refs.spot, 'intensity', 480, 1.0);
    tween(refs.beam.mat1, 'opacity', 0.085, 1.0);
    tween(refs.beam.mat2, 'opacity', 0.05, 1.0);
    tween(refs.dust.mat, 'opacity', 0.5, 1.4);
    painter.paintWhite();
    movieTex.needsUpdate = true;
    tween(refs.movieMat, 'opacity', 1, 0.9);
  }, 5000);

  // 4) the movie fades in
  setTimeout(() => {
    sounds.fanfare();
    painter.setTheme(state.theme || 'meadow');
    tween(refs.screenGlow, 'intensity', 15, 1.5);
  }, 6100);
  setTimeout(() => sounds.musicStart(state.theme || 'meadow'), 6900);

  // camera: linger at the projector, then settle into the audience
  setTimeout(() => moveCam(STATIONS.show.pos, STATIONS.show.tgt, 3.4), 1600);
}

function switchTheme(theme) {
  if (state.phase !== PH.SHOW || theme === state.theme) return;
  state.theme = theme;
  sounds.click();
  sounds.musicStop();
  // brief white flicker like a reel change
  tween(refs.movieMat, 'opacity', 0.15, 0.18, easeInOut, () => {
    painter.setTheme(theme);
    sounds.musicStart(theme);
    tween(refs.movieMat, 'opacity', 1, 0.35);
  });
  document.querySelectorAll('.reelbtn').forEach((b, i) =>
    b.classList.toggle('now', THEMES[i] === theme));
}

// ---------- input -------------------------------------------------
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pointer = { down: false, id: null, x: 0, y: 0, lastX: 0, lastY: 0 };
const dragPlane = new THREE.Plane();
const planeHit = new THREE.Vector3();
let draggingFilm = false, draggingPlug = false, rubbingLens = false;

function toNDC(e) {
  ndc.x = (e.clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(e.clientY / window.innerHeight) * 2 + 1;
}
function castAt(objects) {
  ray.setFromCamera(ndc, camera);
  return ray.intersectObjects(objects, true);
}
function nearScreen(v3, e, px) { // is world point within px of the touch?
  const p = v3.clone().project(camera);
  const sx = (p.x + 1) / 2 * window.innerWidth;
  const sy = (-p.y + 1) / 2 * window.innerHeight;
  return Math.hypot(sx - e.clientX, sy - e.clientY) < px;
}

function onDown(e) {
  sounds.ensure();
  if (pointer.id !== null) return;
  pointer.id = e.pointerId;
  pointer.down = true;
  pointer.x = pointer.lastX = e.clientX;
  pointer.y = pointer.lastY = e.clientY;
  toNDC(e);

  switch (state.phase) {
    case PH.TITLE:
      sounds.pop();
      enter(PH.LENS);
      break;

    case PH.LENS: {
      const hit = castAt([lensHitDisc]);
      if (hit.length || nearScreen(new THREE.Vector3(0, 3.62, 7.08), e, 120)) {
        rubbingLens = true;
        sponge.visible = true;
        if (hit.length) sponge.position.copy(hit[0].point).add(new THREE.Vector3(0, 0.02, -0.06));
        rubAt(hit);
      }
      break;
    }

    case PH.FILM_PICK: {
      for (const r of refs.shelfReels) {
        const hit = castAt([r.group]);
        const wp = new THREE.Vector3();
        r.group.getWorldPosition(wp);
        if (hit.length || nearScreen(wp, e, 70)) { pickReel(r); break; }
      }
      break;
    }

    case PH.FILM_THREAD: {
      const hp = refs.filmHandle.position;
      if (nearScreen(hp, e, 110)) {
        draggingFilm = true;
        setHint(null);
        sounds.click();
      }
      break;
    }

    case PH.SOUND: {
      const wp = new THREE.Vector3();
      refs.plug.getWorldPosition(wp);
      const hit = castAt([refs.plug]);
      if (hit.length || nearScreen(wp, e, 100)) {
        draggingPlug = true;
        setHint(null);
        sounds.pop();
        tween(refs.plug.rotation, 'z', 0, 0.3); // stand the plug up
      }
      break;
    }

    case PH.FOCUS:
      // any horizontal rubbing sharpens; nothing to hit-test
      break;

    case PH.SEATS: {
      for (const s of refs.crooked) {
        if (s.fixed) continue;
        const hit = castAt([s.group]);
        const wp = s.group.position.clone().add(new THREE.Vector3(0, 0.6, 0));
        if (hit.length || nearScreen(wp, e, 60)) { fixSeat(s); break; }
      }
      break;
    }

    case PH.CURTAIN: {
      const hit = castAt([refs.tassel]);
      const wp = refs.tassel.position.clone().add(new THREE.Vector3(0, 0.3, 0));
      if (hit.length || nearScreen(wp, e, 110)) pullTassel();
      break;
    }

    case PH.READY: {
      const bp = new THREE.Vector3();
      refs.startBtn.getWorldPosition(bp);
      const hit = castAt([refs.startBtn]);
      if (hit.length || nearScreen(bp, e, 110)) startShow();
      break;
    }

    case PH.SHOW: {
      const hit = castAt([refs.moviePlane]);
      if (hit.length && refs.movieMat.opacity > 0.5) {
        const uv = hit[0].uv;
        painter.tap(uv.x, 1 - uv.y);
        sounds.pop();
      }
      break;
    }
  }
}

function onMove(e) {
  if (e.pointerId !== pointer.id) return;
  toNDC(e);
  const dx = e.clientX - pointer.lastX;
  pointer.lastX = e.clientX; pointer.lastY = e.clientY;

  if (rubbingLens) {
    const hit = castAt([lensHitDisc]);
    rubAt(hit);
    if (hit.length) {
      sponge.position.copy(hit[0].point).add(new THREE.Vector3(0, 0.02, -0.06));
      sponge.rotation.z = Math.sin(state.time * 14) * 0.25;
    }
  } else if (draggingFilm) {
    dragPlane.setComponents(1, 0, 0, -0.3); // plane x = 0.3
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(dragPlane, planeHit)) {
      const curIdx = Math.round(state.filmT * refs.ribbon.samples);
      let best = curIdx, bestD = Infinity;
      const lo = Math.max(0, curIdx - 8), hi = Math.min(refs.ribbon.samples, curIdx + 22);
      for (let i = lo; i <= hi; i++) {
        const d = curvePts[i].distanceToSquared(planeHit);
        if (d < bestD) { bestD = d; best = i; }
      }
      if (bestD < 1.2) {
        const newT = best / refs.ribbon.samples;
        if (newT > state.filmT) sounds.reelTick();
        state.filmT = Math.max(state.filmT, newT); // ratchet forward
        if (state.filmT >= 0.985) finishThreading();
      }
    }
  } else if (draggingPlug) {
    const sp = new THREE.Vector3();
    refs.socket.getWorldPosition(sp);
    dragPlane.setComponents(0, 1, 0, -sp.y); // horizontal plane at socket height
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(dragPlane, planeHit)) {
      planeHit.x = THREE.MathUtils.clamp(planeHit.x, -1.5, 3.4);
      planeHit.z = THREE.MathUtils.clamp(planeHit.z, 7.6, 10.4);
      refs.plug.position.set(planeHit.x, planeHit.y, planeHit.z);
      refs.updateCable();
      if (Math.hypot(planeHit.x - sp.x, planeHit.z - sp.z) < 0.22) plugIn(sp);
    }
  } else if (state.phase === PH.FOCUS && pointer.down) {
    const d = Math.abs(dx) / window.innerWidth;
    if (d > 0) {
      state.focus = Math.max(0, state.focus - d * 3.2);
      refs.focusMat.uniforms.uBlur.value = state.focus;
      refs.focusRing.rotation.z += dx * 0.02;
      if (Math.abs(dx) > 2) sounds.squeak();
      if (state.focus <= 0.04) focusDone();
    }
  }
}

function onUp(e) {
  if (e.pointerId !== pointer.id) return;
  pointer.id = null;
  pointer.down = false;
  rubbingLens = false;
  draggingPlug = false;
  if (draggingFilm) {
    draggingFilm = false;
    if (state.phase === PH.FILM_THREAD)
      setHint(refs.filmHandle.position.clone().add(new THREE.Vector3(0.3, -0.1, 0)), 'drag', 0.22);
  }
  sponge.visible = false;
}

canvas.addEventListener('pointerdown', onDown);
window.addEventListener('pointermove', onMove);
window.addEventListener('pointerup', onUp);
window.addEventListener('pointercancel', onUp);

// ---------- task logic --------------------------------------------
function rubAt(hit) {
  if (!hit.length) return;
  const h = hit[0];
  if (!h.uv) return;
  // hit disc (r=0.2) uv → dirt disc (r=0.125) uv, same center
  const K = 0.2 / 0.125;
  const u = 0.5 + (h.uv.x - 0.5) * K, v = 0.5 + (h.uv.y - 0.5) * K;
  sounds.squeak();
  if (u < -0.05 || u > 1.05 || v < -0.05 || v > 1.05) return;
  const { canvas: dc, tex } = refs.lensDirt;
  const ctx = dc.getContext('2d');
  const px = u * dc.width, py = (1 - v) * dc.height;
  ctx.globalCompositeOperation = 'destination-out';
  const g = ctx.createRadialGradient(px, py, 4, px, py, 30);
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(px, py, 30, 0, 7); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  tex.needsUpdate = true;
  // coverage bookkeeping (uv centered grid)
  const N = 10;
  const gx = Math.floor(u * N), gy = Math.floor(v * N);
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const cx = gx + a, cy = gy + b;
    if (cx < 0 || cy < 0 || cx >= N || cy >= N) continue;
    const ux = (cx + 0.5) / N - 0.5, uy = (cy + 0.5) / N - 0.5;
    if (Math.hypot(ux, uy) <= 0.48) lensGrid.cells.add(cx * N + cy);
  }
  state.clean = lensGrid.cells.size / lensGrid.total;
  if (Math.random() < 0.2) sparkleBurst(h.point, 0.4);
  if (state.clean >= 0.84) lensDone();
}

function lensDone() {
  if (state.phase !== PH.LENS) return;
  state.phase = '_wait';
  refs.lensDirt.mesh.visible = false;
  refs.lensGlass.material.emissiveIntensity = 1.4;
  sparkleBurst(new THREE.Vector3(0, 3.62, 7.0), 1);
  sounds.sparkle();
  stepDone(0, PH.FILM_PICK);
}

function pickReel(r) {
  if (state.pickedReel) return;
  state.pickedReel = r;
  state.theme = r.theme;
  sounds.boing();
  state.phase = '_wait';
  // fly the reel onto the projector's supply arm
  const wp = new THREE.Vector3();
  r.group.getWorldPosition(wp);
  refs.shelf.remove(r.group);
  r.group.position.copy(wp);
  r.group.rotation.set(0, 0, 0);
  scene.add(r.group);
  const dest = new THREE.Vector3(0.3, 4.58, 7.58); // supply arm hub
  const mid = wp.clone().lerp(dest, 0.5).add(new THREE.Vector3(0, 1.0, 0));
  const start = wp.clone();
  const fly = { t: 0 };
  tween(fly, 't', 1, 1.2, easeInOut, () => {
    sounds.pop();
    sparkleBurst(dest, 0.8);
    stepDone(-1, PH.FILM_THREAD, 0.5);
  });
  fly.update = () => {
    const t = fly.t;
    const a = start.clone().lerp(mid, t), b = mid.clone().lerp(dest, t);
    r.group.position.copy(a.lerp(b, t));
    r.group.rotation.x += 0.1;
  };
  flying.push(fly);
}
const flying = [];

function finishThreading() {
  if (state.phase !== PH.FILM_THREAD) return;
  state.phase = '_wait';
  state.filmT = 1;
  draggingFilm = false;
  refs.ribbon.mesh.geometry.setDrawRange(0, refs.ribbon.samples * 6);
  refs.filmHandle.visible = false;
  refs.takeupReel.userData.wound?.scale.set(1, 1, 1);
  sparkleBurst(curvePts[refs.ribbon.samples - 4].clone(), 0.9);
  sounds.sparkle();
  stepDone(1, PH.SOUND);
}

function plugIn(socketPos) {
  if (state.plugged) return;
  state.plugged = true;
  draggingPlug = false;
  refs.plug.position.set(socketPos.x, socketPos.y + 0.06, socketPos.z);
  refs.plug.rotation.set(0, 0, 0);
  refs.updateCable();
  sounds.plugIn();
  state.phase = '_wait';
  setRing(null);
  // speakers wiggle & thump
  setTimeout(() => {
    sounds.speakerTest();
    for (const sp of refs.speakers) {
      for (const ring of sp.rings) {
        tween(ring.scale, 'x', 1.25, 0.16, easeInOut, () => tween(ring.scale, 'x', 1, 0.3, bounceOut));
        tween(ring.scale, 'y', 1.25, 0.16, easeInOut, () => tween(ring.scale, 'y', 1, 0.3, bounceOut));
      }
    }
    sparkleBurst(refs.plug.position.clone(), 0.7);
  }, 350);
  stepDone(2, PH.FOCUS, 1.6);
}

function focusDone() {
  if (state.phase !== PH.FOCUS) return;
  state.phase = '_wait';
  refs.focusMat.uniforms.uBlur.value = 0;
  sounds.sparkle();
  const s = refs.screenSpec;
  sparkleBurst(new THREE.Vector3(0, s.y, s.z + 0.4), 2.4);
  // test light off again — the screen stays plain white until showtime
  setTimeout(() => tween(refs.focusMat.uniforms.uOn, 'value', 0, 1.0), 900);
  stepDone(3, PH.SEATS, 1.5);
}

function fixSeat(s) {
  s.fixed = true;
  sounds.boing();
  tween(s.cushionPivot.rotation, 'x', 0, 0.55, bounceOut);
  tween(s.group.rotation, 'y', 0, 0.4);
  sparkleBurst(s.group.position.clone().add(new THREE.Vector3(0, 0.7, 0)), 0.6);
  const left = refs.crooked.filter(c => !c.fixed);
  if (left.length === 0) {
    state.phase = '_wait';
    stepDone(-1, PH.CURTAIN, 0.9);
  } else {
    setHint(left[0].group.position.clone().add(new THREE.Vector3(0, 1.0, 0)), 'tap', 0.42);
  }
}

function pullTassel() {
  if (state.curtainClosed) return;
  state.curtainClosed = true;
  state.phase = '_wait';
  setRing(null); setHint(null);
  sounds.click();
  tween(refs.tassel.position, 'y', refs.tassel.position.y - 0.35, 0.3, easeInOut, () => {
    tween(refs.tassel.position, 'y', refs.tassel.position.y + 0.35, 0.5);
  });
  setTimeout(() => {
    sounds.swish(1.8);
    tween(refs.curtainL.scale, 'x', 1.0, 2.2);
    tween(refs.curtainR.scale, 'x', 1.0, 2.2, easeInOut, () => {
      sounds.chime(4);
      setTimeout(() => enter(PH.READY), 900);
    });
  }, 350);
}

// ---------- show-time UI ------------------------------------------
document.querySelectorAll('.reelbtn').forEach((b, i) =>
  b.addEventListener('click', () => switchTheme(THEMES[i])));
document.getElementById('replay').addEventListener('click', () => window.location.reload());

// ---------- main loop ---------------------------------------------
const clock = new THREE.Clock();
let movieAccum = 0;
const glowColor = new THREE.Color();
const sampleCanvas = document.createElement('canvas');
sampleCanvas.width = 4; sampleCanvas.height = 4;
const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  state.time += dt;
  updateTweens(dt);
  updateBursts(dt);
  for (let i = flying.length - 1; i >= 0; i--) {
    flying[i].update();
    if (flying[i].t >= 1) flying.splice(i, 1);
  }

  // camera rig
  if (rig.t < 1) {
    rig.t = Math.min(1, rig.t + dt / rig.dur);
    const e = easeInOut(rig.t);
    rig.pos.copy(rig.fromPos).lerp(rig.toPos, e);
    rig.target.copy(rig.fromTgt).lerp(rig.toTgt, e);
  }
  camera.position.copy(rig.pos);
  if (state.phase === PH.TITLE) { // gentle orbit on the title view
    camera.position.x += Math.sin(state.time * 0.25) * 0.5;
    camera.position.y += Math.sin(state.time * 0.4) * 0.15;
  }
  if (state.phase === PH.SHOW && state.showT > 6) { // subtle sway in the audience
    camera.position.x += Math.sin(state.time * 0.22) * 0.25;
    camera.position.y += Math.sin(state.time * 0.31) * 0.08;
  }
  camera.lookAt(rig.target);

  // hint hand animation
  if (hint.visible) {
    const t = state.time;
    hint.position.copy(hintState.base);
    if (hintState.mode === 'tap') hint.position.y += Math.abs(Math.sin(t * 3.2)) * 0.12;
    else if (hintState.mode === 'rub') { hint.position.x += Math.sin(t * 5) * 0.08; hint.position.y += Math.cos(t * 5) * 0.05; }
    else if (hintState.mode === 'swipe') hint.position.x += Math.sin(t * 2.6) * 0.3;
    else if (hintState.mode === 'drag') hint.position.y += Math.sin(t * 2.6) * 0.08;
    const s = hintState.scale * (1 + Math.sin(t * 3.2) * 0.06);
    hint.scale.set(s, s, 1);
  }
  if (glowRing.visible) {
    const s = (glowRing.userData.scale || 0.5) * (1 + Math.sin(state.time * 4) * 0.12);
    glowRing.scale.set(s, s, 1);
    glowRing.material.opacity = 0.65 + Math.sin(state.time * 4) * 0.3;
  }

  // film ribbon reveal + handle
  if (state.phase === PH.FILM_THREAD || draggingFilm) {
    const idx = Math.floor(state.filmT * refs.ribbon.samples);
    refs.ribbon.mesh.geometry.setDrawRange(0, Math.max(0, idx * 6));
    const p = curvePts[Math.min(idx, refs.ribbon.samples)];
    refs.filmHandle.position.copy(p);
    refs.filmHandleGlow.material.opacity = 0.35 + Math.sin(state.time * 6) * 0.2;
  }

  // reels spin during the show
  if (state.showT >= 0) {
    state.showT += dt;
    const spin = dt * 2.6;
    if (state.pickedReel) state.pickedReel.group.rotation.x += spin;
    refs.takeupReel.rotation.x += spin;
    // beam flicker (after the fade-in tweens have finished)
    if (refs.spot.visible && state.showT > 6.2) {
      const f = 1 + Math.sin(state.time * 43) * 0.05 + Math.sin(state.time * 17) * 0.04;
      refs.beam.mat1.opacity = 0.085 * f;
      refs.beam.mat2.opacity = 0.05 * f;
      if (state.showT > 7.8) refs.screenGlow.intensity = 15 * f;
    }
    // dust drift
    const dp = refs.dust.points.geometry.attributes.position;
    for (let i = 0; i < dp.count; i++) {
      const y = dp.getY(i) + Math.sin(state.time * 0.7 + refs.dust.seed[i]) * dt * 0.03;
      dp.setY(i, y);
      let z = dp.getZ(i) - dt * 0.35;
      if (z < refs.dust.scrPos.z) z = refs.dust.lensPos.z;
      dp.setZ(i, z);
    }
    dp.needsUpdate = true;
    // movie frames
    if (state.showT > 6.1 && refs.movieMat.opacity > 0.1) {
      movieAccum += dt;
      if (movieAccum > 1 / 30) {
        painter.update(movieAccum);
        movieAccum = 0;
        movieTex.needsUpdate = true;
      }
      // screen light color follows the picture
      showFx.glowSample += dt;
      if (showFx.glowSample > 0.4) {
        showFx.glowSample = 0;
        sampleCtx.drawImage(painter.canvas, 0, 0, 4, 4);
        const d = sampleCtx.getImageData(0, 0, 4, 4).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
        const n = d.length / 4;
        glowColor.setRGB(r / n / 255, g / n / 255, b / n / 255);
        refs.screenGlow.color.lerp(glowColor, 0.6);
      }
    }
  }

  // idle: reels on the shelf glint / start button pulses
  if (state.phase === PH.READY)
    refs.startBtnMat.emissiveIntensity = 1.2 + Math.sin(state.time * 5) * 0.8;

  renderer.render(scene, camera);
  if (!window.__game.ready) window.__game.ready = true;
}

// ---------- test hooks --------------------------------------------
function worldToScreen(v) {
  const p = v.clone().project(camera);
  return { x: (p.x + 1) / 2 * window.innerWidth, y: (-p.y + 1) / 2 * window.innerHeight };
}
window.__game = {
  ready: false,
  state,
  refs,
  THREE,
  camera,
  camIdle: () => rig.t >= 1,
  target: () => { // screen-space location of the current interaction target
    switch (state.phase) {
      case PH.TITLE: return { x: innerWidth / 2, y: innerHeight / 2 };
      case PH.LENS: return worldToScreen(new THREE.Vector3(0, 3.62, 7.06));
      case PH.FILM_PICK: {
        const wp = new THREE.Vector3();
        refs.shelfReels[1].group.getWorldPosition(wp);
        return worldToScreen(wp);
      }
      case PH.FILM_THREAD: return worldToScreen(refs.filmHandle.position);
      case PH.SOUND: {
        const wp = new THREE.Vector3();
        refs.plug.getWorldPosition(wp);
        return worldToScreen(wp);
      }
      case PH.FOCUS: return { x: innerWidth / 2, y: innerHeight / 2 };
      case PH.SEATS: {
        const s = refs.crooked.find(c => !c.fixed);
        return s ? worldToScreen(s.group.position.clone().add(new THREE.Vector3(0, 0.5, 0))) : null;
      }
      case PH.CURTAIN: return worldToScreen(refs.tassel.position.clone().add(new THREE.Vector3(0, 0.3, 0)));
      case PH.READY: {
        const bp = new THREE.Vector3();
        refs.startBtn.getWorldPosition(bp);
        return worldToScreen(bp);
      }
      case PH.SHOW: return worldToScreen(new THREE.Vector3(0, 3.6, refs.screenSpec.z));
      default: return null;
    }
  },
  curvePointScreen: (t) => worldToScreen(refs.filmCurve.getPointAt(Math.min(1, Math.max(0, t)))),
  socketScreen: () => {
    const wp = new THREE.Vector3();
    refs.socket.getWorldPosition(wp);
    return worldToScreen(wp);
  },
};

refreshHud();
enter(PH.TITLE);
animate();
