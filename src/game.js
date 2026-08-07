// Engine, shared state and the stage machine.
//
// The stage definitions themselves live in ./stages.js; this file owns the
// renderer, the world, the input plumbing and everything the stages share.

import * as THREE from './core/three.js';
import { Rig } from './core/rig.js';
import { Input } from './core/input.js';
import { audio } from './core/audio.js';
import { Hud } from './ui/hud.js';
import { buildWorkshop, updateWorkshop, shakeWorkshop, FOG_COLOR } from './world/workshop.js';
import { ParticlePool, FX } from './world/particles.js';
import { MoldRig } from './world/moldRig.js';
import { SHAPES } from './world/profiles.js';
import { makeDotTexture } from './world/materials.js';
import { clamp, clamp01, lerp, damp, TAU, angDelta } from './core/util.js';
import { STAGES, STAGE_ORDER } from './stages.js';

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.clock = 0;
    this.running = false;
    this._raf = 0;
    this._acc = [];
    this.quality = 1;
    this.tmpV = new THREE.Vector3();
    this.tmpV2 = new THREE.Vector3();
    this.ray = new THREE.Raycaster();
  }

  /* =============================== boot =============================== */
  init() {
    const renderer = new THREE.WebGLRenderer({
      canvas: this.canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance', stencil: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer = renderer;

    // iOS can drop the GL context when the app is backgrounded for a while
    this.canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); this.running = false; });
    this.canvas.addEventListener('webglcontextrestored', () => { this.running = true; this._tick(); });

    this.scene = new THREE.Scene();
    this.rig = new Rig(this.canvas);
    this.world = buildWorkshop(this.scene, renderer);

    this.pDust = new ParticlePool(this.scene, { max: 340, additive: false, soft: 0.35 });
    this.pGlow = new ParticlePool(this.scene, { max: 260, additive: true, soft: 0.55, renderOrder: 4 });

    this.hud = new Hud(this.rig);
    this.input = new Input(this.canvas);
    this.input.on('down', (i) => this._onDown(i));
    this.input.on('move', (i) => this._onMove(i));
    this.input.on('up', (i) => this._onUp(i));
    this.input.on('tap', (i) => this._onTap(i));

    // the motes that hang in the light shafts -- they only read once the
    // camera moves, which is exactly what sells the depth
    for (let i = 0; i < 90; i++) {
      this.pGlow.spawn({
        ...FX.mote({
          x: (Math.random() - 0.5) * 12, y: 0.5 + Math.random() * 5.5, z: -5 + Math.random() * 8,
        }, { x: 0, y: 0.03, z: 0 }),
        life: 9999, color0: [1, 0.86, 0.68, 0.26], color1: [1, 0.86, 0.68, 0.26],
      });
    }

    this._bindResize();
    this.resize();

    this.state = null;
    this.stage = null;
    this.stageName = null;

    // warm up shader compilation before the first frame the child sees
    this.renderer.compile(this.scene, this.rig.camera);
    return this;
  }

  _bindResize() {
    let to = 0;
    const fire = () => {
      clearTimeout(to);
      this.resize();
      // Safari reports stale metrics for a beat after a rotation
      to = setTimeout(() => this.resize(), 260);
      setTimeout(() => this.resize(), 700);
    };
    window.addEventListener('resize', fire);
    window.addEventListener('orientationchange', fire);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', fire);
  }

  resize() {
    const w = Math.max(1, Math.round(window.innerWidth));
    const h = Math.max(1, Math.round(window.innerHeight));
    if (w === this._w && h === this._h) return;
    this._w = w; this._h = h;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * this.quality);
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
    if (this.stage?.resize) this.stage.resize(this);
  }

  /* =============================== run =============================== */
  start() {
    if (this.running) return;
    this.running = true;
    this._last = performance.now();
    this._tick();
  }

  _tick = () => {
    if (!this.running) return;
    this._raf = requestAnimationFrame(this._tick);
    const now = performance.now();
    let dt = (now - this._last) / 1000;
    this._last = now;
    // a backgrounded tab returns with a huge dt; never let physics explode
    dt = clamp(dt, 0.0005, 0.05);
    this.clock += dt;
    this.update(dt);
    this.renderer.render(this.scene, this.rig.camera);
    this._autoQuality(now);
  };

  /** if the device is struggling, spend less on pixels rather than on content */
  _autoQuality(now) {
    this._acc.push(now);
    if (this._acc.length < 60) return;
    const span = (now - this._acc[0]) / this._acc.length;
    this._acc.length = 0;
    if (span > 26 && this.quality > 0.62) {
      this.quality = 0.62;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2) * this.quality);
      this.renderer.setSize(this._w, this._h, false);
    } else if (span > 34 && this.renderer.shadowMap.enabled) {
      this.renderer.shadowMap.enabled = false;
      this.world.key.castShadow = false;
      this.scene.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    }
  }

  update(dt) {
    this.input.tick(dt);
    this.rig.update(dt);
    updateWorkshop(this.world, dt, this.clock);
    if (this.stage?.update) this.stage.update(this, dt);
    this.pDust.update(dt);
    this.pGlow.update(dt);
    this.hud.update(dt, this.input.active);
  }

  /* ============================ stage machine ============================ */
  setStage(name) {
    if (this.stage?.exit) this.stage.exit(this);
    this.hud.clearHint();
    this.hud.showNext(false);
    this.stageName = name;
    this.stage = STAGES[name];
    this._stageT = 0;
    if (this.stage?.enter) this.stage.enter(this);
  }

  nextStage() {
    const i = STAGE_ORDER.indexOf(this.stageName);
    if (i >= 0 && i < STAGE_ORDER.length - 1) this.setStage(STAGE_ORDER[i + 1]);
  }

  /** establishing shot shown behind the title card */
  idle() {
    this.state = { shapeKey: 'tulip', metal: 'gold', decorCount: 0, strikes: 0 };
    this.rig.setShot(
      { target: new THREE.Vector3(-0.6, 2.6, 0), w: 9.5, h: 8.2, yaw: 0.06, pitch: 0.10 },
      { target: new THREE.Vector3(-1.0, 2.7, -0.3), w: 16.5, h: 8.0, yaw: 0.12, pitch: 0.09 },
      true
    );
  }

  /* ============================ new game ============================ */
  newRun() {
    if (this.rigMold) { this.rigMold.dispose(); this.rigMold = null; }
    this.pDust.clear(); this.pGlow.clear();
    for (const b of this.world.birds) {
      b.obj.visible = true; b.flying = 0; b.obj.position.copy(b.home); b.vel.set(0, 0, 0);
    }
    for (const s of this.world.swingers) s.amp = 0;
    this.world.door.position.x = this.world.doorOpenX;
    this.world.crucibleMelt.visible = false;
    this.world.ladleMelt.visible = false;
    this.world.furnaceGlowMat.opacity = 0;
    this.world.hearthMat.color.setHex(0x120806);
    this.world.fireLight.intensity = 0;
    this.world.pourLight.intensity = 0;
    for (const k of Object.keys(this.world.gear)) for (const m of this.world.gear[k]) m.visible = false;
    this.world.ladle.rotation.z = 0;
    this.world.ladleRig.rotation.y = 0;
    this.world.lever.rotation.z = 0;
    this.world.setChain(5.5, 4.6);
    this.world.hook.position.set(0, 4.6, 0);
    this.world.hook.rotation.set(0, 0, 0);
    this.world.founder.position.set(-2.25, 0, 1.35);
    this.world.founder.rotation.y = 0.85;
    audio.setLoop('furnace', 0); audio.setLoop('pour', 0);
    audio.setLoop('scrape', 0); audio.setLoop('brush', 0); audio.setLoop('chain', 0);

    this.state = {
      shapeKey: 'tulip',
      metal: 'gold',
      decorCount: 0,
      strikes: 0,
    };
    this.hud.showReplay(false);
    this.hud.hideTray();
    this.hud.hideProgress();
    this.setStage(STAGE_ORDER[0]);
  }

  makeMold(shapeKey) {
    this.state.shapeKey = shapeKey;
    this.rigMold = new MoldRig(this.scene, shapeKey, SHAPES);
    return this.rigMold;
  }

  /* ============================ input relay ============================ */
  _onDown(i) { this.hud.poke(); audio.unlock(); if (this.stage?.down) this.stage.down(this, i); }
  _onMove(i) {
    this.hud.poke();
    const r = this.canvas.getBoundingClientRect();
    this.rig.setParallax(((i.x - r.left) / r.width) * 2 - 1, -(((i.y - r.top) / r.height) * 2 - 1));
    if (this.stage?.move) this.stage.move(this, i);
  }
  _onUp(i) { if (this.stage?.up) this.stage.up(this, i); }
  _onTap(i) { if (this.stage?.tap) this.stage.tap(this, i); }

  /* ============================ helpers ============================ */

  /** raycast the current pointer against a list of objects */
  hit(objects, recursive = false) {
    this.ray.setFromCamera(this.input.ndc, this.rig.camera);
    const hits = this.ray.intersectObjects(Array.isArray(objects) ? objects : [objects], recursive);
    return hits.length ? hits[0] : null;
  }

  /** raycast from arbitrary screen coords (used by the tray's drag-and-drop) */
  hitAt(clientX, clientY, objects, recursive = false) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = {
      x: ((clientX - r.left) / r.width) * 2 - 1,
      y: -(((clientY - r.top) / r.height) * 2 - 1),
    };
    this.ray.setFromCamera(ndc, this.rig.camera);
    const hits = this.ray.intersectObjects(Array.isArray(objects) ? objects : [objects], recursive);
    return hits.length ? hits[0] : null;
  }

  /** metres per screen pixel at a given distance from the camera */
  metresPerPixel(worldPoint) {
    const d = this.rig.camera.position.distanceTo(worldPoint);
    const vh = 2 * d * Math.tan((this.rig.camera.fov * Math.PI) / 360);
    return vh / Math.max(1, this._h);
  }

  /** raycast against an arbitrary plane; returns a world point or null */
  hitPlane(plane, out = new THREE.Vector3()) {
    this.ray.setFromCamera(this.input.ndc, this.rig.camera);
    return this.ray.ray.intersectPlane(plane, out);
  }

  /** screen position (css px) of a world point */
  screen(v3, out = {}) { return this.rig.project(v3, out); }

  /** point the circular-gesture accumulator at a world position */
  anchorCircle(v3) {
    const s = this.screen(v3, {});
    this.input.setCircleCenter(s.x, s.y);
  }

  shake(power) { this.rig.kick(power); }
  shakeRoom(power) { shakeWorkshop(this.world, power); }

  /** convert a world hit on the casting axis into (theta, normalised height) */
  axisCoords(point, height) {
    const theta = Math.atan2(point.z, point.x);
    const y = point.y - this.rigMold.group.position.y;
    return { theta: (theta + TAU) % TAU, u: clamp01(y / height), y };
  }
}
