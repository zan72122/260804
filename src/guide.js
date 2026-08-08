// ---------------------------------------------------------------------------
//  The wordless instruction layer.
//
//  A thick chevron ribbon lying on the fish shows where the line runs and
//  which way it goes; a pointing-hand pictogram demonstrates the gesture on a
//  loop until the player takes over. No text, no timer, no failure.
// ---------------------------------------------------------------------------
import * as THREE from 'three';
import { clamp, lerp, damp } from './util.js';
import { chevronTexture, glowTexture, sparkTexture } from './textures.js';

const RIBBON_W = 0.115;

export function createGuide(scene) {
  const chev = chevronTexture();
  chev.wrapS = THREE.RepeatWrapping;
  chev.wrapT = THREE.ClampToEdgeWrapping;

  const matDone = new THREE.MeshBasicMaterial({
    map: chev, color: '#5d7f96', transparent: true, opacity: 0.30,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
  });
  // Deliberately not yellow: the dorsal finlets are yellow, and the long cut
  // runs right along them.
  const matTodo = new THREE.MeshBasicMaterial({
    map: chev, color: '#d8f4ff', transparent: true, opacity: 0.95,
    depthTest: false, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    blending: THREE.AdditiveBlending,
  });

  const MAXSEG = 128;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array((MAXSEG + 1) * 2 * 3);
  const uv = new Float32Array((MAXSEG + 1) * 2 * 2);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geom.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  const idx = [];
  for (let i = 0; i < MAXSEG; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  geom.setIndex(idx);

  const done = new THREE.Mesh(geom, matDone);
  const todo = new THREE.Mesh(geom, matTodo);
  done.frustumCulled = false; todo.frustumCulled = false;
  done.renderOrder = 900; todo.renderOrder = 901;
  const group = new THREE.Group();
  group.add(done, todo);
  scene.add(group);

  // the bright bead riding the cut
  const head = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture('rgba(255,246,214,1)'), color: '#fff2cf', transparent: true,
    depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  head.renderOrder = 903;
  head.scale.setScalar(0.34);
  group.add(head);

  // the demonstration hand; its texture is supplied by the game
  const hand = new THREE.Sprite(new THREE.SpriteMaterial({
    transparent: true, depthTest: false, depthWrite: false, toneMapped: false, opacity: 0,
  }));
  hand.renderOrder = 905;
  hand.center.set(0.30, 0.86);
  group.add(hand);

  const state = {
    path: null, segs: 0, progress: 0, visible: false,
    demoT: 0, demoOn: true, opacity: 0, time: 0, handSize: 0.4,
  };

  const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _w = new THREE.Vector3();

  function setHandTexture(tex) { hand.material.map = tex; hand.material.needsUpdate = true; }

  function rebuild() {
    const path = state.path;
    if (!path) { state.segs = 0; return; }
    const N = Math.min(MAXSEG, path.n - 1);
    const reps = Math.max(2, Math.round(path.length / 0.17));
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      path.pointAt(t, _p);
      path.normalAt(t, _n);
      path.tangentAt(t, _t);
      _w.crossVectors(_t, _n).normalize().multiplyScalar(RIBBON_W * 0.5);
      _p.addScaledVector(_n, 0.050);
      const k = i * 2;
      pos[k * 3] = _p.x - _w.x; pos[k * 3 + 1] = _p.y - _w.y; pos[k * 3 + 2] = _p.z - _w.z;
      pos[(k + 1) * 3] = _p.x + _w.x; pos[(k + 1) * 3 + 1] = _p.y + _w.y; pos[(k + 1) * 3 + 2] = _p.z + _w.z;
      uv[k * 2] = t * reps; uv[k * 2 + 1] = 0;
      uv[(k + 1) * 2] = t * reps; uv[(k + 1) * 2 + 1] = 1;
    }
    geom.getAttribute('position').needsUpdate = true;
    geom.getAttribute('uv').needsUpdate = true;
    geom.computeBoundingSphere();
    state.segs = N;
    done.geometry.setDrawRange(0, N * 6);
  }

  function setPath(path) {
    state.path = path;
    state.progress = 0;
    state.demoT = -0.55;
    state.demoOn = true;
    rebuild();
    show();
  }
  function show() { state.visible = true; }
  function hide() { state.visible = false; }
  function setProgress(p) { state.progress = clamp(p, 0, 1); }
  function stopDemo() { state.demoOn = false; }

  function update(dt, camera) {
    state.time += dt;
    const targetOp = state.visible ? 1 : 0;
    state.opacity = damp(state.opacity, targetOp, 7, dt);
    group.visible = state.opacity > 0.01;
    if (!group.visible || !state.path) return;

    const path = state.path;
    if (path.object) rebuild();                       // the fish may be moving

    chev.offset.x -= dt * 0.55;

    const N = state.segs;
    const start = Math.floor(state.progress * N);
    todo.geometry.setDrawRange(start * 6, Math.max(0, (N - start) * 6));

    const breathe = 0.82 + 0.18 * Math.sin(state.time * 3.1);
    matTodo.opacity = 0.92 * state.opacity * breathe;
    matDone.opacity = 0.26 * state.opacity;

    // head bead
    path.pointAt(state.progress, _p);
    path.normalAt(state.progress, _n);
    head.position.copy(_p).addScaledVector(_n, 0.03);
    const dist = camera.position.distanceTo(_p);
    head.scale.setScalar(dist * 0.055 * (0.9 + 0.2 * Math.sin(state.time * 7)));
    head.material.opacity = state.opacity * (state.progress > 0.002 && state.progress < 0.999 ? 0.95 : 0.35);

    // demo hand: loops the gesture until the player joins in
    if (state.demoOn && hand.material.map) {
      state.demoT += dt * 0.52;
      if (state.demoT > 1.55) state.demoT = -0.45;
      const dt2 = clamp(state.demoT, 0, 1);
      const fade = clamp(Math.min(state.demoT + 0.45, 1.25 - state.demoT) * 3, 0, 1);
      path.pointAt(Math.max(dt2, state.progress), _p);
      path.normalAt(Math.max(dt2, state.progress), _n);
      hand.position.copy(_p).addScaledVector(_n, 0.08);
      const d2 = camera.position.distanceTo(hand.position);
      hand.scale.setScalar(d2 * state.handSize * 0.30);
      hand.material.opacity = fade * state.opacity * 0.92;
    } else {
      hand.material.opacity = damp(hand.material.opacity, 0, 10, dt);
    }
  }

  return { group, setPath, setProgress, show, hide, stopDemo, update, setHandTexture, state };
}

/* --------------------------------------------------------------------- *
 *  The kerf: the dark seam the blade actually leaves behind it. Unlike the
 *  guide it is depth-tested, so it sits in the fish rather than over it.
 * --------------------------------------------------------------------- */
export function createKerf(scene) {
  const MAXSEG = 128;
  const geom = new THREE.BufferGeometry();
  const pos = new Float32Array((MAXSEG + 1) * 2 * 3);
  geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const idx = [];
  for (let i = 0; i < MAXSEG; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 3, a, a + 3, a + 2);
  }
  geom.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({
    color: '#5e1a1c', transparent: true, opacity: 0.9, side: THREE.DoubleSide,
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 5;
  mesh.visible = false;
  scene.add(mesh);

  const _p = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3(), _w = new THREE.Vector3();
  let path = null, segs = 0, width = 0.03, progress = 0;

  function rebuild() {
    if (!path) return;
    const N = Math.min(MAXSEG, path.n - 1);
    for (let i = 0; i <= N; i++) {
      const t = i / N;
      path.pointAt(t, _p);
      path.normalAt(t, _n);
      path.tangentAt(t, _t);
      _w.crossVectors(_t, _n).normalize().multiplyScalar(width * 0.5);
      _p.addScaledVector(_n, 0.004);
      const k = i * 2;
      pos[k * 3] = _p.x - _w.x; pos[k * 3 + 1] = _p.y - _w.y; pos[k * 3 + 2] = _p.z - _w.z;
      pos[(k + 1) * 3] = _p.x + _w.x; pos[(k + 1) * 3 + 1] = _p.y + _w.y; pos[(k + 1) * 3 + 2] = _p.z + _w.z;
    }
    geom.getAttribute('position').needsUpdate = true;
    geom.computeBoundingSphere();
    segs = N;
  }

  return {
    setPath(p, color, w) {
      path = p; width = w || 0.03; progress = 0;
      mat.color.set(color || '#5e1a1c');
      mesh.visible = true;
      rebuild();
      geom.setDrawRange(0, 0);
    },
    setProgress(v) {
      progress = clamp(v, 0, 1);
      geom.setDrawRange(0, Math.floor(progress * segs) * 6);
    },
    update() { if (mesh.visible && path && path.object) { rebuild(); geom.setDrawRange(0, Math.floor(progress * segs) * 6); } },
    hide() { mesh.visible = false; path = null; },
  };
}

/* --------------------------------------------------------------------- *
 *  A small pool of sparkles for the reveal and tidy-up beats.
 * --------------------------------------------------------------------- */
export function createSparkles(scene, count = 64) {
  const tex = sparkTexture();
  const pool = [];
  const group = new THREE.Group();
  scene.add(group);
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: tex, transparent: true, depthTest: false, depthWrite: false,
      blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0,
    }));
    s.renderOrder = 910;
    s.visible = false;
    group.add(s);
    pool.push({ s, life: 0, max: 1, vel: new THREE.Vector3(), size: 0.1 });
  }
  let cursor = 0;

  function burst(center, n = 16, spread = 0.35, size = 0.16, up = 0.6) {
    for (let i = 0; i < n; i++) {
      const p = pool[cursor % pool.length]; cursor++;
      p.s.position.copy(center).add(new THREE.Vector3(
        (Math.random() - 0.5) * spread * 2,
        (Math.random() - 0.5) * spread,
        (Math.random() - 0.5) * spread * 2,
      ));
      p.vel.set((Math.random() - 0.5) * 0.5, up * (0.4 + Math.random() * 0.8), (Math.random() - 0.5) * 0.5);
      p.life = 0;
      p.max = 0.7 + Math.random() * 0.7;
      p.size = size * (0.6 + Math.random() * 0.9);
      p.s.visible = true;
    }
  }

  function update(dt) {
    for (const p of pool) {
      if (!p.s.visible) continue;
      p.life += dt;
      if (p.life >= p.max) { p.s.visible = false; p.s.material.opacity = 0; continue; }
      const k = p.life / p.max;
      p.s.position.addScaledVector(p.vel, dt);
      p.vel.y -= dt * 0.8;
      p.s.material.opacity = Math.sin(k * Math.PI) * 0.95;
      p.s.scale.setScalar(p.size * (0.6 + k * 0.9));
    }
  }
  return { burst, update, group };
}

