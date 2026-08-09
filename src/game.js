import * as THREE from 'three';
import { AudioKit } from './audio.js';
import {
  buildWorld, Sparkles, LAYOUT, TOTAL_CHOUX, TOWER_TOP_Y, coneRadiusAt,
} from './world.js';
import { strandGeometry, spunStrandGeometry } from './geo.js';

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;

// magnet strength: 0 at `far`, 1 once we are inside `near`
function step01(far, near, x) {
  const t = clamp((x - far) / (near - far), 0, 1);
  return t * t * (3 - 2 * t);
}
const easeOut = (t) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const POT_PULL = { far: 1.25, near: 0.34 };   // how far the caramel reaches for a choux
const SLOT_PULL = { far: 1.00, near: 0.22 };  // how far the tower reaches for a choux
const DIP_TIME = 0.26;                        // contact time before the bottom is coated
const SUGAR_STRANDS = 34;                     // strands needed to finish the veil
const WELD_AXIS = new THREE.Vector3(0, 0, 1);  // local long axis of a caramel weld

export function boot(container) {
  const game = new Game(container);
  game.start();
  window.__croq = game;
  return game;
}

class Game {
  constructor(container) {
    this.container = container;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: false, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.18;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.w = buildWorld(this.renderer);
    this.scene = this.w.scene;
    this.mats = this.w.mats;
    this.sparks = new Sparkles(this.scene);
    this.audio = new AudioKit();

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
    this.camAz = 0.40;
    this.camEl = 0.34;
    this.camFocus = new THREE.Vector3(0, 0.9, 0);
    this.camDist = 8;
    this.camSnap = true;

    this.raycaster = new THREE.Raycaster();
    this.dragPlane = new THREE.Plane();
    this.planeAt = new THREE.Vector3(0, 1.0, 0);
    this._planeWant = new THREE.Vector3();
    this.camSnapPlane = true;
    this.ndc = new THREE.Vector2();
    this.pointerPx = new THREE.Vector2();
    this.pointerActive = false;
    this.lastPx = null;

    this.fx = [];
    this.choux = [];
    this.threads = [];
    this.sugar = [];
    this.ghosts = [];
    this.trayChoux = [];
    this.variantSeq = 0;

    this.clock = new THREE.Clock();
    this.time = 0;
    this.idleT = 0;
    this.phase = 'place';        // place -> crowning -> sugar -> finale
    this.held = null;
    this.ready = null;
    this.sugarProgress = 0;
    this.swipeAccum = 0;
    this.rippleCd = 0;
    this.potHint = 0;
    this.finaleT = 0;
    this.finaleReady = false;
    this.sugarHinted = false;
    this.forkDir = 1;

    this.againEl = document.getElementById('again');
    this.veilEl = document.getElementById('veil');

    this.weldGeo = new THREE.SphereGeometry(1, 10, 8);

    this._buildSlots();
    this._buildGhosts();
    this._buildFork();
    this._fillTray();
    this._bindEvents();
    this.resize();
  }

  // ------------------------------------------------------------- setup

  _buildSlots() {
    this.slots = [];
    LAYOUT.layers.forEach((L, li) => {
      for (let i = 0; i < L.n; i++) {
        const a = (i / L.n) * Math.PI * 2 + li * 0.51;
        this.slots.push({
          layer: li,
          angle: a,
          pos: new THREE.Vector3(Math.cos(a) * L.r, L.y, Math.sin(a) * L.r),
          filled: null,
        });
      }
    });
  }

  _buildGhosts() {
    const maxPerLayer = Math.max(...LAYOUT.layers.map((l) => l.n));
    for (let i = 0; i < maxPerLayer; i++) {
      const m = new THREE.Mesh(this.w.chouxGeos[i % this.w.chouxGeos.length], this.mats.ghostMat);
      m.scale.setScalar(LAYOUT.chouxR);
      m.visible = false;
      m.renderOrder = 2;
      this.scene.add(m);
      this.ghosts.push(m);
    }
  }

  _buildFork() {
    // the spun-sugar tool: a cut whisk / fork, tines pointing along -X
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({
      color: '#efe9df', roughness: 0.22, metalness: 0.92, envMapIntensity: 1.6,
    });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.05, 0.66, 10), metal);
    handle.rotation.z = Math.PI / 2;
    handle.position.x = 0.38;
    g.add(handle);
    const spine = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.05, 0.34), metal);
    spine.position.x = 0.05;
    g.add(spine);
    for (let i = 0; i < 4; i++) {
      const z = -0.13 + i * 0.087;
      const tine = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.006, 0.44, 6), metal);
      tine.rotation.z = Math.PI / 2;
      tine.position.set(-0.19, 0, z);
      g.add(tine);
      const drip = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), this.mats.threadMat);
      drip.scale.set(1, 1.6, 1);
      drip.position.set(-0.40, -0.02, z);
      g.add(drip);
    }
    g.visible = false;
    this.fork = g;
    this.scene.add(g);
  }

  _newChoux() {
    const v = (this.variantSeq++) % this.w.chouxGeos.length;
    const g = new THREE.Group();

    const body = new THREE.Mesh(this.w.chouxGeos[v], this.mats.chouxMat);
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);

    const coatMat = this.mats.caramelMat.clone();
    coatMat.opacity = 0;
    const coat = new THREE.Mesh(this.w.coatGeos[v], coatMat);
    coat.visible = false;
    g.add(coat);

    const dropMat = this.mats.threadMat.clone();
    dropMat.opacity = 0;
    const dropGeo = new THREE.SphereGeometry(0.15, 10, 8);
    const drop = new THREE.Mesh(dropGeo, dropMat);
    drop.position.y = -0.62;
    drop.visible = false;
    g.add(drop);

    g.scale.setScalar(LAYOUT.chouxR);
    this.scene.add(g);

    const c = {
      group: g, body, coat, coatMat, drop, dropGeo, dropMat,
      state: 'tray', slot: null, tween: null,
      dipped: false, dipT: 0, dropT: 0, grabT: 0, pull: 0,
      jiggleT: 99, jiggleAmp: 0, squash: 0,
      aimSlot: null,
      basePos: new THREE.Vector3(),
      tilt: new THREE.Euler(
        (Math.random() - 0.5) * 0.28, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.28
      ),
    };
    g.rotation.copy(c.tilt);
    this.choux.push(c);
    return c;
  }

  _fillTray() {
    const seats = [[-0.20, 0.40, -0.09], [0.21, 0.39, 0.13], [0.00, 0.42, 0.25], [-0.02, 0.63, 0.03]];
    for (const s of seats) {
      const c = this._newChoux();
      c.state = 'decor';
      c.seat = s;
      c.group.position.set(LAYOUT.tray.x + s[0], s[1], LAYOUT.tray.z + s[2]);
      c.group.scale.setScalar(LAYOUT.chouxR * 0.88);
      this.trayChoux.push(c);
    }
  }

  _readyPos(target = new THREE.Vector3()) {
    return target.set(LAYOUT.tray.x, 0.95, LAYOUT.tray.z - 0.06);
  }

  _spawnReady() {
    if (this.ready) return;
    if (this.placedCount() >= TOTAL_CHOUX) return;

    const c = this._newChoux();
    c.state = 'ready';
    this._readyPos(c.group.position);
    c.group.position.y -= 0.45;
    c.group.scale.setScalar(LAYOUT.chouxR * 0.2);
    this.ready = c;

    const from = c.group.position.clone();
    const to = this._readyPos(new THREE.Vector3());
    c.tween = this._tween(0.40, (t) => {
      const e = easeOut(t);
      c.group.position.lerpVectors(from, to, e);
      const s = LAYOUT.chouxR * (0.2 + 0.8 * e) * (1 + 0.16 * Math.sin(t * Math.PI));
      c.group.scale.setScalar(s);
    }, () => { c.tween = null; });

    // the bowl slowly empties as the tower fills up
    const want = Math.max(1, Math.round(4 * (1 - this.placedCount() / TOTAL_CHOUX)));
    while (this.trayChoux.length > want) this._removeChoux(this.trayChoux.pop());
  }

  placedCount() { return this.slots.reduce((n, s) => n + (s.filled ? 1 : 0), 0); }

  // ------------------------------------------------------------- events

  _bindEvents() {
    const el = this.renderer.domElement;
    const opts = { passive: false };
    el.addEventListener('pointerdown', (e) => this._onDown(e), opts);
    el.addEventListener('pointermove', (e) => this._onMove(e), opts);
    el.addEventListener('pointerup', (e) => this._onUp(e), opts);
    el.addEventListener('pointercancel', (e) => this._onUp(e), opts);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 150));
  }

  _setPointer(e) {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.pointerPx.set(e.clientX - r.left, e.clientY - r.top);
    this.ndc.set(
      (this.pointerPx.x / Math.max(1, r.width)) * 2 - 1,
      -(this.pointerPx.y / Math.max(1, r.height)) * 2 + 1
    );
  }

  _onDown(e) {
    e.preventDefault();
    this.audio.unlock();
    this._setPointer(e);
    this.pointerActive = true;
    this.idleT = 0;
    this.lastPx = this.pointerPx.clone();
    try { this.renderer.domElement.setPointerCapture(e.pointerId); } catch (_) { /* not fatal */ }

    if (this.phase === 'finale') {
      if (this.finaleReady) this._reset();
      return;
    }

    // a tap anywhere picks up the waiting choux: no aiming required
    if (this.phase === 'place' && !this.held && this.ready) {
      const c = this.ready;
      this._cancelTween(c);
      this.ready = null;
      this.held = c;
      c.state = 'held';
      c.grabT = 0;
      this.audio.pick();
    }

    if (this.phase === 'sugar') this.sugarHinted = true;
  }

  _onMove(e) {
    if (!this.pointerActive) return;
    e.preventDefault();
    this._setPointer(e);
    this.idleT = 0;

    if (this.phase === 'sugar' && this.lastPx) {
      const dx = this.pointerPx.x - this.lastPx.x;
      if (dx !== 0) this.forkDir = dx > 0 ? 1 : -1;
      this.swipeAccum += Math.abs(dx);
      const stride = Math.max(64, Math.min(window.innerWidth, window.innerHeight) * 0.20);
      while (this.swipeAccum >= stride && this.sugarProgress < SUGAR_STRANDS) {
        this.swipeAccum -= stride;
        this._addSugar(4 + (Math.random() < 0.5 ? 1 : 0));
      }
    }
    this.lastPx.copy(this.pointerPx);
  }

  _onUp() {
    if (!this.pointerActive) return;
    this.pointerActive = false;
    this.lastPx = null;
    if (this.held) this._release(this.held);
  }

  // ------------------------------------------------------------- helpers

  _tween(dur, update, done) {
    const o = { t: 0, dur, update, done, dead: false };
    this.fx.push(o);
    return o;
  }

  _cancelTween(c) {
    if (!c || !c.tween) return;
    const i = this.fx.indexOf(c.tween);
    if (i >= 0) this.fx.splice(i, 1);
    c.tween = null;
  }

  _clearFx() {
    const list = this.fx.slice();
    this.fx.length = 0;
    for (const o of list) if (o.done) o.done();
  }

  _removeChoux(c) {
    this._cancelTween(c);
    this.scene.remove(c.group);
    c.coatMat.dispose();
    c.dropMat.dispose();
    c.dropGeo.dispose();
    const i = this.choux.indexOf(c);
    if (i >= 0) this.choux.splice(i, 1);
  }

  currentLayer() {
    for (let li = 0; li < LAYOUT.layers.length; li++) {
      if (this.slots.some((s) => s.layer === li && !s.filled)) return li;
    }
    return LAYOUT.layers.length - 1;
  }

  openSlots() {
    const li = this.currentLayer();
    return this.slots.filter((s) => s.layer === li && !s.filled);
  }

  potAnchor(target = new THREE.Vector3()) {
    return target.set(LAYOUT.pot.x, LAYOUT.potSurfaceY + LAYOUT.chouxR * 0.62, LAYOUT.pot.z);
  }

  towerTopY() {
    let y = LAYOUT.plateH;
    for (const s of this.slots) if (s.filled) y = Math.max(y, s.pos.y + LAYOUT.chouxR);
    const open = this.openSlots();
    if (open.length) y = Math.max(y, open[0].pos.y + LAYOUT.chouxR);
    return y;
  }

  // ------------------------------------------------------------- dragging

  _updateDrag(dt) {
    const c = this.held;
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const free = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.dragPlane, free)) return;
    free.y = Math.max(free.y, 0.32);

    const anchor = new THREE.Vector3();
    const target = free.clone();
    const ray = this.raycaster.ray;
    let pull = 0;
    let aimSlot = null;

    if (!c.dipped) {
      // step one: only the caramel is magnetic
      this.potAnchor(anchor);
      pull = step01(POT_PULL.far, POT_PULL.near, ray.distanceToPoint(anchor));
      target.lerp(anchor, pull * 0.96);

      if (pull > 0.5) {
        c.dipT += dt;
        if (!c.coat.visible) { c.coat.visible = true; this.audio.dipTouch(); }
        this._setCoat(c, easeOut(clamp(c.dipT / DIP_TIME, 0, 1)));
        this.rippleCd -= dt;
        if (this.rippleCd <= 0) { this._ripple(); this.rippleCd = 0.20; }
        if (c.dipT >= DIP_TIME) this._finishDip(c);
      } else if (c.dipT > 0) {
        c.dipT = Math.max(0, c.dipT - dt * 0.7);
        this._setCoat(c, easeOut(clamp(c.dipT / DIP_TIME, 0, 1)));
        if (c.dipT <= 0.001) c.coat.visible = false;
      }
    } else {
      // step two: every open seat in the current ring reaches out
      let best = null;
      let bestD = Infinity;
      for (const s of this.openSlots()) {
        const d = ray.distanceToPoint(s.pos);
        if (d < bestD) { bestD = d; best = s; }
      }
      if (best) {
        aimSlot = best;
        pull = step01(SLOT_PULL.far, SLOT_PULL.near, bestD);
        target.lerp(best.pos, pull * 0.97);
      }
      c.aimSlot = best;
      this._updateDrip(c, dt);
    }

    // ease toward the finger so grabbing from anywhere never feels like a jump
    c.grabT = Math.min(1, c.grabT + dt * 6.5);
    const k = 1 - Math.exp(-(10 + 24 * c.grabT) * dt);
    c.group.position.lerp(target, k);
    c.group.rotation.y += dt * 0.5;

    const s = LAYOUT.chouxR * (1 + 0.07 * pull);
    c.group.scale.lerp(this._tmpScale(s), 1 - Math.exp(-14 * dt));
    c.pull = pull;

    this._updateGhosts(aimSlot, pull);
  }

  _tmpScale(s) {
    this._sv = this._sv || new THREE.Vector3();
    return this._sv.set(s, s, s);
  }

  _setCoat(c, k) {
    c.coat.scale.set(1, Math.max(0.02, k), 1);
    c.coat.position.y = -0.52 * (1 - k);
    c.coatMat.opacity = 0.9 * k;
  }

  _finishDip(c) {
    c.dipped = true;
    c.dropT = 0;
    this._setCoat(c, 1);
    this.audio.dipDone();
    this.audio.thread();
    this.sparks.burst(
      new THREE.Vector3(LAYOUT.pot.x, LAYOUT.potSurfaceY + 0.06, LAYOUT.pot.z), 10,
      { spread: 0.22, speed: 0.5, up: 0.7, life: 0.55, size: 0.07 }
    );
    this._stretchThread(c);
    c.drop.visible = true;
  }

  // caramel pulling into a thread as the choux is lifted out of the pot
  _stretchThread(c) {
    const from = new THREE.Vector3(LAYOUT.pot.x, LAYOUT.potSurfaceY, LAYOUT.pot.z);
    const mat = this.mats.threadMat.clone();
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    mesh.frustumCulled = false;
    this.scene.add(mesh);
    const to = new THREE.Vector3();
    this._tween(0.55, (t) => {
      to.copy(c.group.position);
      to.y -= LAYOUT.chouxR * 0.7;
      if (to.distanceToSquared(from) < 1e-5) return;
      mesh.geometry.dispose();
      mesh.geometry = strandGeometry(from, to, 0.08 + 0.30 * t, 0.020 * (1 - t) + 0.003, 12);
      mat.opacity = 0.9 * (1 - t * t);
    }, () => {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      mat.dispose();
    });
  }

  _ripple() {
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffc06a', transparent: true, opacity: 0.5,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const geo = new THREE.RingGeometry(0.10, 0.145, 28);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(LAYOUT.pot.x, LAYOUT.potSurfaceY + 0.004, LAYOUT.pot.z);
    this.scene.add(m);
    this._tween(0.55, (t) => {
      const s = 0.6 + t * 3.0;
      m.scale.set(s, s, s);
      mat.opacity = 0.5 * (1 - t);
    }, () => { this.scene.remove(m); geo.dispose(); mat.dispose(); });
  }

  _updateDrip(c, dt) {
    c.dropT += dt;
    const k = clamp(1 - c.dropT / 1.7, 0, 1);
    c.dropMat.opacity = 0.85 * k;
    const s = 0.5 + 0.5 * k;
    c.drop.scale.set(s * 0.85, s * 1.7, s * 0.85);
    c.drop.position.y = -0.62 - 0.04 * Math.sin(c.dropT * 6);
    if (k <= 0.01) c.drop.visible = false;
  }

  _updateGhosts(aim, pull) {
    const open = this.held && this.held.dipped ? this.openSlots() : [];
    const puls = 0.5 + 0.5 * Math.sin(this.time * 4.2);
    for (let i = 0; i < this.ghosts.length; i++) {
      const g = this.ghosts[i];
      const s = open[i];
      if (!s) { g.visible = false; continue; }
      g.visible = true;
      g.position.copy(s.pos);
      const isAim = aim === s;
      const sc = LAYOUT.chouxR * (isAim ? 1.02 + 0.07 * puls - 0.10 * pull : 0.84 + 0.04 * puls);
      g.scale.lerp(this._tmpScale(sc), 0.3);
      g.rotation.y = this.time * 0.4 + i;
    }
    this.mats.ghostMat.opacity = 0.16 + 0.14 * puls;
  }

  _hideGhosts() { for (const g of this.ghosts) g.visible = false; }

  // ------------------------------------------------------------- placing

  _release(c) {
    this.held = null;
    c.group.scale.setScalar(LAYOUT.chouxR);

    if (!c.dipped) {
      // no caramel yet - hop gently back and let the pot call out louder
      c.state = 'returning';
      this.ready = c;
      this.audio.wrong();
      this.potHint = 1.8;
      const from = c.group.position.clone();
      const to = this._readyPos(new THREE.Vector3());
      c.tween = this._tween(0.40, (t) => {
        c.group.position.lerpVectors(from, to, easeInOut(t));
        c.group.position.y += Math.sin(t * Math.PI) * 0.30;
      }, () => {
        c.tween = null;
        c.state = 'ready';
        c.dipT = 0;
        c.coat.visible = false;
      });
      return;
    }

    const slot = (c.aimSlot && !c.aimSlot.filled) ? c.aimSlot : this.openSlots()[0];
    if (!slot) return;
    this._attach(c, slot);
  }

  _attach(c, slot) {
    slot.filled = c;
    c.slot = slot;
    c.state = 'flying';
    c.drop.visible = false;

    const from = c.group.position.clone();
    const to = slot.pos.clone();
    const dur = clamp(0.12 + from.distanceTo(to) * 0.06, 0.12, 0.28);

    this._spawnReady();   // the next choux is waiting before this one even lands

    c.tween = this._tween(dur, (t) => {
      const e = easeOut(t);
      c.group.position.lerpVectors(from, to, e);
      c.group.position.y += Math.sin(t * Math.PI) * 0.09 * (1 - e * 0.4);
    }, () => { c.tween = null; this._landed(c, slot); });
  }

  _landed(c, slot) {
    c.state = 'placed';
    c.basePos.copy(slot.pos);
    c.group.position.copy(slot.pos);
    c.group.rotation.copy(c.tilt);
    // lean outward a little, the way real choux rest against the cone
    c.group.rotation.z += -Math.cos(slot.angle) * 0.14;
    c.group.rotation.x += Math.sin(slot.angle) * 0.14;
    c.squash = 1;
    c.jiggleT = 0;
    c.jiggleAmp = 0.036;

    this.audio.attach(slot.layer);
    this.sparks.burst(slot.pos, 9, { spread: 0.26, speed: 0.7, up: 0.55, life: 0.5, size: 0.075 });
    this._glue(c, slot);
    this._pulsePlate();

    for (const s of this.slots) {
      if (!s.filled || s.filled === c) continue;
      if (s.pos.distanceTo(slot.pos) < LAYOUT.chouxR * 2.5) {
        s.filled.jiggleT = 0;
        s.filled.jiggleAmp = 0.018;
      }
    }

    const li = slot.layer;
    if (!this.slots.some((s) => s.layer === li && !s.filled)) {
      if (li === LAYOUT.layers.length - 1) this._crown(slot);
      else this._ringComplete(li);
    }
  }

  // Caramel welds in the visible crevices. Everything is placed on the OUTSIDE
  // of the joint (pushed away from the tower axis), because a strand drawn
  // between two overlapping centres would poke through the pastry.
  _glue(c, slot) {
    const targets = this.slots
      .filter((s) => s.filled && s.filled !== c)
      .map((s) => ({ p: s.pos, d: s.pos.distanceTo(slot.pos) }))
      .filter((o) => o.d < LAYOUT.chouxR * 2.6)
      .sort((a, b) => a.d - b.d)
      .slice(0, 2)
      .map((o) => o.p);

    const spots = [];
    for (const tp of targets) {
      const axis = tp.clone().sub(slot.pos);
      if (axis.lengthSq() < 1e-6) continue;
      axis.normalize();
      const mid = slot.pos.clone().lerp(tp, 0.5);
      const out = new THREE.Vector3(mid.x, 0, mid.z);
      if (out.lengthSq() < 1e-4) out.set(0, 0, 1);
      out.normalize();
      spots.push({ at: mid.addScaledVector(out, LAYOUT.chouxR * 0.56), axis });
    }

    // the first choux of the bottom ring still gets a foot of caramel
    if (slot.layer === 0) {
      const out = new THREE.Vector3(slot.pos.x, 0, slot.pos.z).normalize();
      const foot = out.clone().multiplyScalar(LAYOUT.layers[0].r + LAYOUT.chouxR * 0.42);
      foot.y = LAYOUT.plateH + 0.045;
      spots.push({ at: foot, axis: new THREE.Vector3(-out.z, 0, out.x) });
    }

    for (const s of spots) {
      // one squashed blob of caramel lying along the seam
      const weld = new THREE.Mesh(this.weldGeo, this.mats.caramelMat);
      weld.position.copy(s.at);
      weld.quaternion.setFromUnitVectors(WELD_AXIS, s.axis);
      weld.scale.set(0.05, 0.05, 0.05);
      this.scene.add(weld);
      this.threads.push(weld);
      this._tween(0.35, (t) => {
        const e = easeOut(t) * (1 + 0.22 * Math.sin(t * Math.PI));
        weld.scale.set(e * 0.045, e * 0.032, e * 0.105);
      });
    }
  }

  _pulsePlate() {
    const g = this.w.plateGlow;
    this._tween(0.5, (t) => {
      g.material.opacity = 0.32 * (1 - t) * (1 - t);
      const s = 0.85 + t * 0.35;
      g.scale.set(s, s, s);
    }, () => { g.material.opacity = 0; });
  }

  _ringComplete(li) {
    const L = LAYOUT.layers[li];
    this.audio.ringDone(li);
    this.sparks.ring(L.y + LAYOUT.chouxR * 0.4, L.r + LAYOUT.chouxR * 0.9, 26);

    const mat = new THREE.MeshBasicMaterial({
      color: '#ffcb7a', transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const geo = new THREE.RingGeometry(L.r + LAYOUT.chouxR * 0.75, L.r + LAYOUT.chouxR * 1.05, 44);
    const ring = new THREE.Mesh(geo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = L.y;
    this.scene.add(ring);
    this._tween(0.85, (t) => {
      const s = 1 + t * 0.7;
      ring.scale.set(s, s, s);
      ring.position.y = L.y + t * 0.35;
      mat.opacity = 0.7 * (1 - t);
    }, () => { this.scene.remove(ring); geo.dispose(); mat.dispose(); });

    // the finished ring takes a bow, one choux after another
    let k = 0;
    for (const s of this.slots) {
      if (s.layer !== li || !s.filled) continue;
      const c = s.filled;
      const delay = 0.055 * (k++);
      this._tween(delay + 0.001, null, () => { c.jiggleT = 0; c.jiggleAmp = 0.028; });
    }
  }

  // The bench has done its job: shrink it away so the tower gets the stage.
  _benchProps() { return [this.w.pot, this.w.tray, this.w.potShadow, this.w.trayShadow]; }

  _showBench(on) {
    for (const p of this._benchProps()) { p.scale.setScalar(on ? 1 : 0.0001); p.visible = on; }
    for (const c of this.trayChoux) {
      c.group.scale.setScalar(on ? LAYOUT.chouxR * 0.88 : 0.0001);
      c.group.visible = on;
    }
  }

  _hideBench() {
    const props = this._benchProps();
    const decor = this.trayChoux.slice();
    this._tween(0.55, (t) => {
      const k = 1 - easeOut(t);
      for (const p of props) { p.scale.setScalar(Math.max(0.0001, k)); p.visible = k > 0.02; }
      for (const c of decor) {
        c.group.scale.setScalar(Math.max(0.0001, LAYOUT.chouxR * 0.88 * k));
        c.group.visible = k > 0.02;
      }
    }, () => this._showBench(false));
  }

  _crown(slot) {
    this.phase = 'crowning';
    this.audio.crown();
    this._hideGhosts();
    this._hideBench();

    const top = slot.pos.clone();
    top.y += LAYOUT.chouxR;
    this.sparks.burst(top, 60, { spread: 0.35, speed: 1.5, up: 1.6, life: 1.4, size: 0.13 });
    for (let i = 0; i < 3; i++) {
      this._tween(0.14 * i + 0.001, null,
        () => this.sparks.ring(top.y - 0.25 - i * 0.42, 0.5 + i * 0.34, 24));
    }

    const mat = new THREE.MeshBasicMaterial({
      color: '#ffd489', transparent: true, opacity: 0.9,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const geo = new THREE.RingGeometry(0.06, 0.17, 40);
    const ring = new THREE.Mesh(geo, mat);
    ring.position.copy(top);
    this.scene.add(ring);
    this._tween(1.1, (t) => {
      ring.quaternion.copy(this.camera.quaternion);
      const s = 1 + t * 9;
      ring.scale.set(s, s, s);
      mat.opacity = 0.9 * (1 - t) * (1 - t);
    }, () => { this.scene.remove(ring); geo.dispose(); mat.dispose(); });

    this._tween(1.25, null, () => {
      if (this.phase !== 'crowning') return;
      this.phase = 'sugar';
      this.sugarHinted = false;
      this.swipeAccum = 0;
      this.fork.visible = true;
    });
  }

  // ------------------------------------------------------------- spun sugar

  _addSugar(count) {
    for (let i = 0; i < count && this.sugarProgress < SUGAR_STRANDS; i++) {
      this.sugarProgress++;
      const a0 = Math.random() * Math.PI * 2;
      const turns = 0.55 + Math.random() * 1.15;
      const dir = Math.random() < 0.5 ? -1 : 1;
      const yTop = TOWER_TOP_Y + 0.06 - Math.random() * 0.45;
      const yBot = 0.10 + Math.random() * 0.30;
      const pts = [];
      const N = 18;
      for (let k = 0; k <= N; k++) {
        const t = k / N;
        const y = lerp(yTop, yBot, t);
        const a = a0 + dir * turns * Math.PI * 2 * t;
        const rad = coneRadiusAt(y) * 1.03 + 0.045 + 0.045 * Math.sin(t * 8.5 + a0);
        pts.push(new THREE.Vector3(
          Math.cos(a) * rad, y + 0.035 * Math.sin(t * 6.5 + a0), Math.sin(a) * rad
        ));
      }
      const geo = spunStrandGeometry(pts, 0.0042 + Math.random() * 0.0032);
      const mesh = new THREE.Mesh(geo, this.mats.sugarMat);
      mesh.frustumCulled = false;
      const total = geo.index.count;
      geo.setDrawRange(0, 0);
      this.scene.add(mesh);
      this.sugar.push(mesh);
      this._tween(0.42, (t) => {
        geo.setDrawRange(0, Math.floor((total * easeOut(t)) / 3) * 3);
      }, () => geo.setDrawRange(0, total));

      this.sparks.burst(pts[Math.floor(N * 0.3)], 5,
        { spread: 0.18, speed: 0.5, up: 0.5, life: 0.6, size: 0.07 });
    }
    this.audio.whoosh(this.sugarProgress);

    if (this.sugarProgress >= SUGAR_STRANDS && this.phase === 'sugar') {
      this._tween(0.7, null, () => { if (this.phase === 'sugar') this._finale(); });
    }
  }

  _finale() {
    this.phase = 'finale';
    this.finaleT = 0;
    this.finaleReady = false;
    this.fork.visible = false;
    this.audio.finale();
    this._hideGhosts();

    this.sparks.burst(new THREE.Vector3(0, TOWER_TOP_Y, 0), 70,
      { spread: 0.4, speed: 1.4, up: 1.5, life: 1.8, size: 0.14 });
    for (let i = 0; i < 6; i++) {
      const y = 0.3 + i * 0.42;
      this._tween(0.22 * i + 0.001, null, () => {
        this.sparks.ring(y, coneRadiusAt(y) * 1.15, 22);
        this.audio.sparkle();
      });
    }
    this._tween(2.6, null, () => {
      this.finaleReady = true;
      if (this.againEl) this.againEl.classList.add('show');
    });
  }

  // ------------------------------------------------------------- reset

  _reset() {
    if (this.againEl) this.againEl.classList.remove('show');
    this._clearFx();

    for (const m of this.sugar) { this.scene.remove(m); m.geometry.dispose(); }
    this.sugar.length = 0;
    for (const m of this.threads) {
      this.scene.remove(m);
      if (m.geometry !== this.weldGeo) m.geometry.dispose();
    }
    this.threads.length = 0;
    for (const c of this.choux.slice()) this._removeChoux(c);
    this.choux.length = 0;
    this.trayChoux.length = 0;

    for (const s of this.slots) s.filled = null;
    this.held = null;
    this.ready = null;
    this.sugarProgress = 0;
    this.swipeAccum = 0;
    this.finaleReady = false;
    this.phase = 'place';
    this.camAz = 0.40;
    this.fork.visible = false;
    this.mats.sugarMat.emissiveIntensity = 0.9;

    this._fillTray();
    this._showBench(true);
    this._spawnReady();
  }

  // ------------------------------------------------------------- camera

  _framePoints() {
    const pts = [];
    const R = LAYOUT.plateR;
    const add = (x, y, z) => pts.push(new THREE.Vector3(x, y, z));

    if (this.phase === 'place') {
      add(R, 0.02, 0); add(-R, 0.02, 0); add(0, 0.02, R); add(0, 0.02, -R);
      add(LAYOUT.pot.x - LAYOUT.potR, 0.04, LAYOUT.pot.z);
      add(LAYOUT.pot.x, 0.36, LAYOUT.pot.z + LAYOUT.potR * 0.9);
      add(LAYOUT.tray.x + LAYOUT.trayR, 0.04, LAYOUT.tray.z);
      add(LAYOUT.tray.x, 1.25, LAYOUT.tray.z + LAYOUT.trayR * 0.9);
      // keep some sky above the tower from the very first choux, so the frame
      // settles instead of lurching upward every ring
      add(0, Math.max(this.towerTopY() + 0.34, TOWER_TOP_Y * 0.62), 0);
    } else {
      // the tower has the stage to itself from the crown onward
      add(R * 1.1, 0, 0); add(-R * 1.1, 0, 0);
      add(0, 0, R * 1.1); add(0, 0, -R * 1.1);
      add(0, TOWER_TOP_Y + 0.30, 0);
      add(0, -0.05, 0);
    }
    return pts;
  }

  _updateCamera(dt) {
    if (this.phase === 'finale') {
      this.finaleT += dt;
      this.camAz = 0.40 + Math.min(1, this.finaleT / 7) * 0.62;
      this.camEl = lerp(this.camEl, 0.24, 1 - Math.exp(-0.7 * dt));
    } else if (this.phase === 'place') {
      // as the tower grows the camera drops a touch so the height reads
      const grown = this.towerTopY() / (TOWER_TOP_Y + 0.3);
      this.camEl = lerp(this.camEl, 0.325 - 0.06 * grown, 1 - Math.exp(-1.2 * dt));
    } else {
      this.camEl = lerp(this.camEl, 0.26, 1 - Math.exp(-1.2 * dt));
    }

    const pts = this._framePoints();
    const box = new THREE.Box3();
    for (const p of pts) box.expandByPoint(p);
    const focus = box.getCenter(new THREE.Vector3());

    const D = new THREE.Vector3(
      Math.sin(this.camAz) * Math.cos(this.camEl),
      Math.sin(this.camEl),
      Math.cos(this.camAz) * Math.cos(this.camEl)
    ).normalize();
    const worldUp = new THREE.Vector3(0, 1, 0);
    const RX = new THREE.Vector3().crossVectors(worldUp, D).normalize();
    const UY = new THREE.Vector3().crossVectors(D, RX).normalize();

    const vHalf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    const hHalf = Math.atan(Math.tan(vHalf) * this.camera.aspect);
    // how much of the frustum the scene is allowed to fill
    const fill = this.phase === 'finale' ? 0.68
      : (this.phase === 'place' ? (this.benchPortrait ? 0.92 : 0.86) : 0.82);
    const tanH = Math.tan(hHalf) * fill;
    const tanV = Math.tan(vHalf) * fill;

    let dist = 3;
    const rel = new THREE.Vector3();
    for (const p of pts) {
      rel.copy(p).sub(focus);
      const u = rel.dot(D);
      dist = Math.max(dist, u + Math.abs(rel.dot(RX)) / tanH, u + Math.abs(rel.dot(UY)) / tanV);
    }

    if (this.camSnap) {
      this.camFocus.copy(focus);
      this.camDist = dist;
      this.camSnap = false;
    } else {
      const k = 1 - Math.exp(-2.2 * dt);
      this.camFocus.lerp(focus, k);
      this.camDist = lerp(this.camDist, dist, k);
    }

    this.camera.position.copy(this.camFocus).addScaledVector(D, this.camDist);
    this.camera.lookAt(this.camFocus);
    this.camera.updateMatrixWorld();

    // The drag plane faces the camera. Its *depth* follows whatever the choux is
    // working on — the pot while it still needs caramel, the tower once it has
    // some — so nothing jumps toward or away from the viewer mid-carry.
    const want = this._planeWant;
    if (this.held && !this.held.dipped) this.potAnchor(want);
    else want.set(0, clamp(this.camFocus.y, 0.4, 3.0), 0);
    this.planeAt.lerp(want, this.camSnapPlane ? 1 : 1 - Math.exp(-5 * dt));
    this.camSnapPlane = false;

    const fwd = new THREE.Vector3();
    this.camera.getWorldDirection(fwd);
    this.dragPlane.setFromNormalAndCoplanarPoint(fwd.negate(), this.planeAt);
  }

  // Re-compose the bench for the current orientation. In landscape the pot and
  // the bowl sit left and right of the tower; in portrait they move toward the
  // viewer instead, so the frame stays tall rather than wide.
  _applyBench(portrait) {
    const b = portrait ? LAYOUT.bench.portrait : LAYOUT.bench.landscape;
    if (this.benchPortrait === portrait) return;
    this.benchPortrait = portrait;
    LAYOUT.pot.copy(b.pot);
    LAYOUT.tray.copy(b.tray);
    this.w.pot.position.copy(LAYOUT.pot);
    this.w.tray.position.copy(LAYOUT.tray);
    this.w.potShadow.position.set(LAYOUT.pot.x, 0.006, LAYOUT.pot.z);
    this.w.trayShadow.position.set(LAYOUT.tray.x, 0.006, LAYOUT.tray.z);
    for (const c of this.trayChoux) {
      c.group.position.set(LAYOUT.tray.x + c.seat[0], c.seat[1], LAYOUT.tray.z + c.seat[2]);
    }
    if (this.ready && this.ready.state === 'ready') this._readyPos(this.ready.group.position);
    this.camSnap = true;
  }

  resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    // A much wider lens in portrait: a narrow frame otherwise pushes the camera
    // so far back that the tower stops reading as tall.
    this.camera.fov = h > w ? 54 : 40;
    this.camera.updateProjectionMatrix();
    this._applyBench(h > w);

    const bufH = this.renderer.getDrawingBufferSize(new THREE.Vector2()).y;
    const vHalf = THREE.MathUtils.degToRad(this.camera.fov) / 2;
    this.sparks.points.material.uniforms.uScale.value = bufH / (2 * Math.tan(vHalf));
  }

  // ------------------------------------------------------------- loop

  start() {
    this._spawnReady();
    this._updateCamera(0.016);
    this.renderer.compile(this.scene, this.camera);
    this.renderer.render(this.scene, this.camera);
    if (this.veilEl) {
      this.veilEl.classList.add('gone');
      setTimeout(() => this.veilEl && this.veilEl.remove(), 900);
    }
    this.clock.start();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.1);
    this.time += dt;
    this.idleT += dt;

    for (let i = this.fx.length - 1; i >= 0; i--) {
      const o = this.fx[i];
      o.t += dt;
      const t = clamp(o.t / o.dur, 0, 1);
      if (o.update) o.update(t);
      if (t >= 1) {
        this.fx.splice(i, 1);
        if (o.done) o.done();
      }
    }

    if (this.phase === 'place') {
      if (this.held) this._updateDrag(dt);
      else { this._hideGhosts(); this._bobReady(dt); }
    } else {
      this._hideGhosts();
      if (this.phase === 'sugar') this._updateFork(dt);
    }

    this._settle(dt);
    this._glowPot(dt);
    this._shimmer(dt);
    this.sparks.update(dt);
    this._updateCamera(dt);

    this.renderer.render(this.scene, this.camera);
  }

  _bobReady(dt) {
    const c = this.ready;
    if (!c || c.state !== 'ready') return;
    const p = this._readyPos(new THREE.Vector3());
    const hint = this.idleT > 3.5 ? 1 : 0;
    const bob = Math.sin(this.time * 2.2) * 0.045
      + hint * Math.abs(Math.sin(this.time * 3.2)) * 0.11;
    c.group.position.lerp(p.setY(p.y + bob), 0.16);
    c.group.rotation.y += dt * 0.35;
    const s = LAYOUT.chouxR * (1 + 0.04 * Math.sin(this.time * 2.2) + hint * 0.05);
    c.group.scale.lerp(this._tmpScale(s), 0.14);
  }

  _settle(dt) {
    for (const c of this.choux) {
      if (c.state !== 'placed') continue;
      c.jiggleT += dt;
      const amp = c.jiggleAmp * Math.exp(-9 * c.jiggleT);
      c.group.position.set(c.basePos.x, c.basePos.y + amp * Math.sin(c.jiggleT * 34), c.basePos.z);
      if (c.squash > 0) {
        c.squash = Math.max(0, c.squash - dt * 3.4);
        const e = c.squash * c.squash;
        c.group.scale.set(
          LAYOUT.chouxR * (1 + 0.20 * e),
          LAYOUT.chouxR * (1 - 0.24 * e),
          LAYOUT.chouxR * (1 + 0.20 * e)
        );
      }
    }
  }

  _glowPot(dt) {
    const g = this.w.potGlow;
    const wantDip = this.phase === 'place' && (!this.held || !this.held.dipped);
    this.potHint = Math.max(0, this.potHint - dt);
    let target = 0;
    if (wantDip) {
      target = 0.15 + 0.09 * Math.sin(this.time * 3.2);
      if (this.held) target += 0.10;
      if (this.idleT > 3.5) target += 0.09;
      target += this.potHint * 0.15;
    }
    g.material.opacity = lerp(g.material.opacity, target, 1 - Math.exp(-6 * dt));
    const s = 1 + 0.06 * Math.sin(this.time * 3.2);
    g.scale.set(s, s, s);
    this.w.potCaramel.material.emissiveIntensity = 0.42 + 0.16 * Math.sin(this.time * 2.4);
  }

  _shimmer() {
    if (!this.sugar.length) return;
    const base = this.phase === 'finale' ? 1.3 : 0.85;
    this.mats.sugarMat.emissiveIntensity = base + 0.45 * Math.sin(this.time * 2.6);
  }

  _updateFork(dt) {
    const f = this.fork;
    f.visible = true;
    const p = new THREE.Vector3();

    if (this.pointerActive) {
      this.raycaster.setFromCamera(this.ndc, this.camera);
      if (!this.raycaster.ray.intersectPlane(this.dragPlane, p)) p.copy(f.position);
      else p.addScaledVector(this.dragPlane.normal, 1.05);
      f.position.lerp(p, 1 - Math.exp(-24 * dt));
    } else {
      // wordless invitation: the fork sweeps side to side on its own
      const sway = Math.sin(this.time * 1.5);
      this.dragPlane.projectPoint(
        new THREE.Vector3(sway * 1.5, TOWER_TOP_Y * 0.55, 0), p
      );
      p.addScaledVector(this.dragPlane.normal, 1.05);
      f.position.lerp(p, 1 - Math.exp(-5 * dt));
      if (!this.sugarHinted) this.forkDir = Math.cos(this.time * 1.5) > 0 ? 1 : -1;
    }

    f.quaternion.copy(this.camera.quaternion);
    if (this.forkDir >= 0) f.rotateY(Math.PI);
    f.rotateZ(-0.2);
  }
}
