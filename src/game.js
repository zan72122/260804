import * as THREE from '../vendor/three.module.js';
import {
  BAR, BAR_LENGTH, CAB, CLAW, SLOT_X, SLOT_Y,
  SLOT_X_DEFAULT, SLOT_Y_DEFAULT, STORAGE_KEY, TRAY, HANDLE, PRIZE,
} from './config.js';
import { Stage } from './stage.js';
import { addStaticSurfaces, barEnds, barTopAt, inChute, makeBarState, startPose } from './rig.js';
import { World, Prize } from './physics.js';
import { Director, SHOTS, contactShot, fallShot } from './camera.js';
import * as A from './audio.js';

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _aabbMin = new THREE.Vector3();
const _aabbMax = new THREE.Vector3();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const nearestIndex = (arr, v) => {
  let bi = 0, bd = Infinity;
  for (let i = 0; i < arr.length; i++) {
    const d = Math.abs(arr[i] - v);
    if (d < bd) { bd = d; bi = i; }
  }
  return bi;
};

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.02;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.05, 8);
    this.stage = new Stage(this.renderer);
    this.director = new Director(this.camera);

    this.world = new World();
    this._buildWorld();

    this.mode = 'build';
    this.layout = { bars: [makeBarState(), makeBarState()], prizeKind: null };
    this.load();

    this.prize = null;
    this.drag = null;
    this.carry = null;
    this.trail = [];
    this.prevTrail = [];
    this.ghostTimer = 0;
    this.trinketOffset = new THREE.Vector3();
    this.trinketVel = new THREE.Vector3();
    this.frame = 0;
    this.idle = 0;
    this.chuteDone = false;

    this.play = {
      phase: 'aim', t: 0, clawX: 0, tipY: CLAW.homeTipY, gantryZ: 0,
      dir: 1, moved: 0, pulled: false, targetTipY: CLAW.homeTipY,
    };

    this._pickables();
    this._bindPointer();
    this._bindUI();

    if (this.layout.prizeKind) this.spawnPrize(this.layout.prizeKind, true);
    this.refreshBars();
    this.director.set(SHOTS.buildOverview.pos, SHOTS.buildOverview.target, { snap: true });
    this.resize();
    this.updateUI();
  }

  // ---------- 物理世界 ----------
  _buildWorld() {
    const w = this.world;
    this.barSegs = [];
    for (let i = 0; i < 2; i++) {
      this.barSegs.push(w.addSegment({
        radius: BAR.radius, mu: 0.45, samples: 52, tag: 'bar', side: 0, active: false,
      }));
    }
    this.clawSegs = [];
    for (let i = 0; i < 4; i++) {
      this.clawSegs.push(w.addSegment({
        radius: CLAW.bladeHalfX, mu: 0.35, samples: 16, tag: 'claw',
        maxImpulse: CLAW.maxImpulse, active: false,
      }));
    }

    addStaticSurfaces(w);
    w.assistBelowY = SLOT_Y[0] - 0.06;
  }

  // ---------- レイアウト ----------
  barEnds(i) {
    return barEnds(this.layout.bars[i], i);
  }

  otherSide(i) {
    const o = this.layout.bars[1 - i];
    return o.placed ? o.side : 0;
  }

  bothPlaced() {
    return this.layout.bars[0].placed && this.layout.bars[1].placed
      && this.layout.bars[0].side !== this.layout.bars[1].side;
  }

  refreshBars() {
    for (let i = 0; i < 2; i++) {
      const b = this.layout.bars[i];
      let a, c;
      if (this.carry && this.carry.index === i) {
        ({ a, b: c } = this.carry);
        this.stage.setBarEnds(i, a, c, { handles: false });
      } else {
        ({ a, b: c } = this.barEnds(i));
        this.stage.setBarEnds(i, a, c, { handles: b.placed && this.mode === 'build' });
      }
      const seg = this.barSegs[i];
      seg.a.copy(a); seg.b.copy(c);
      seg.side = b.placed ? b.side : 0;
      seg.active = b.placed && !(this.carry && this.carry.index === i);
      this.pick.bars[i].position.copy(_v.addVectors(a, c).multiplyScalar(0.5));
      this.pick.bars[i].quaternion.copy(_q.setFromUnitVectors(Y_AXIS, _v2.subVectors(c, a).normalize()));
      for (let e = 0; e < 2; e++) {
        const h = this.stage.bars[i].handles[e];
        this.pick.handles[i * 2 + e].position.copy(h.position);
        this.pick.handles[i * 2 + e].visible = h.visible;
      }
    }
    this.updatePrizeStart();
  }


  updatePrizeStart() {
    if (!this.prize) return;
    const ok = this.bothPlaced();
    this.stage.prizeMeshes[this.prize.kind].visible = ok || this.mode === 'play';
    if (!ok || this.mode !== 'build') return;
    const p = startPose(this.layout.bars, this.prize);
    this.prize.setPose(p.com, p.quat);
    this.prize.frozen = true;
    this.syncPrizeMesh();
  }

  spawnPrize(kind, silent) {
    this.layout.prizeKind = kind;
    this.prize = new Prize(PRIZE[kind]);
    this.prize.frozen = true;
    this.world.prize = this.prize;
    this.stage.showPrize(kind);
    this.trinketOffset.set(0, 0, 0);
    this.trinketVel.set(0, 0, 0);
    this.updatePrizeStart();
    if (!silent) A.sfxPlace();
    this.save();
    this.updateUI();
  }

  syncPrizeMesh() {
    if (!this.prize) return;
    const g = this.stage.prizeMeshes[this.prize.kind];
    this.prize.centerWorld(_v);
    g.position.copy(_v);
    g.quaternion.copy(this.prize.quat);
  }

  // ---------- ピック用の当たり判定 ----------
  _pickables() {
    const group = new THREE.Group();
    this.stage.scene.add(group);
    const invisible = () => new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
    this.pick = { bars: [], handles: [], group };
    const barGeo = new THREE.CylinderGeometry(0.030, 0.030, BAR_LENGTH, 8);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(barGeo, invisible());
      m.userData = { type: 'bar', index: i };
      group.add(m);
      this.pick.bars.push(m);
    }
    const hGeo = new THREE.SphereGeometry(HANDLE.pickRadius, 10, 8);
    for (let i = 0; i < 2; i++) {
      for (let e = 0; e < 2; e++) {
        const m = new THREE.Mesh(hGeo, invisible());
        m.userData = { type: 'handle', index: i, end: e };
        group.add(m);
        this.pick.handles.push(m);
      }
    }
    this.raycaster = new THREE.Raycaster();
  }

  ndc(ev, yOffsetPx = 0) {
    const r = this.canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((ev.clientX - r.left) / r.width) * 2 - 1,
      -((ev.clientY - r.top - yOffsetPx) / r.height) * 2 + 1,
    );
  }

  // ---------- 入力 ----------
  _bindPointer() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== undefined && this.pointerId !== null) return;
      A.initAudio();
      this.pointerId = e.pointerId;
      c.setPointerCapture(e.pointerId);
      this.onDown(e);
    });
    c.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.onMove(e);
    });
    const up = (e) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.onUp(e);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', up);
    c.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  onDown(ev) {
    this.idle = 0;
    if (this.mode === 'build') return this.buildDown(ev);
    return this.playDown(ev);
  }

  onMove(ev) {
    if (this.mode === 'build') return this.buildMove(ev);
    return this.playMove(ev);
  }

  onUp(ev) {
    if (this.mode === 'build') return this.buildUp(ev);
    return this.playUp(ev);
  }

  // ---------- 組立モード ----------
  buildDown(ev) {
    this.raycaster.setFromCamera(this.ndc(ev), this.camera);
    const hitsH = this.raycaster.intersectObjects(this.pick.handles.filter((h) => h.visible), false);
    if (hitsH.length) {
      const u = hitsH[0].object.userData;
      this.drag = { kind: 'handle', index: u.index, end: u.end };
      A.sfxPick();
      // 段階を選んでいる間はカメラを止め、バーとソケットを同時に見せ続ける
      this.director.freeze(1e4);
      return;
    }
    const hitsB = this.raycaster.intersectObjects(this.pick.bars, false);
    if (hitsB.length) {
      const i = hitsB[0].object.userData.index;
      const { a, b } = this.barEnds(i);
      const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
      // 「床の見取り図」の上で運ぶ。高さは奥へ進むほど自動で上がる。
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -center.y);
      const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      this.carry = {
        index: i, plane,
        offX: hit ? center.x - hit.x : 0,
        offZ: hit ? center.z - hit.z : 0,
        a: new THREE.Vector3(), b: new THREE.Vector3(),
      };
      this.layout.bars[i].placed = false;
      this.barSegs[i].active = false;
      this.updateCarry(center.x, center.z);
      A.sfxPick();
      this.director.set(SHOTS.buildCarry.pos, SHOTS.buildCarry.target, { speed: SHOTS.buildCarry.speed });
      this.updateUI();
      return;
    }
    this.drag = null;
  }

  updateCarry(x, z) {
    const c = this.carry;
    const t = clamp((0.300 - z) / 0.170, 0, 1);
    const y = TRAY.y + 0.020 + (SLOT_Y[SLOT_Y_DEFAULT] + 0.012 - TRAY.y - 0.020) * t;
    const ang = (Math.PI / 2) * t;
    const dir = _v.set(Math.cos(ang), 0, -Math.sin(ang)).multiplyScalar(BAR_LENGTH / 2);
    c.x = x; c.z = z; c.y = y;
    c.a.set(x, y, z).sub(dir);
    c.b.set(x, y, z).add(dir);
    // 吸着先の候補
    const other = this.otherSide(c.index);
    let side = x >= 0 ? 1 : -1;
    if (other === side) side = -side;
    const xi = nearestIndex(SLOT_X, Math.abs(x));
    const yi = SLOT_Y_DEFAULT;
    c.side = side; c.xi = xi; c.yi = yi;
    c.snapping = Math.abs(z) < 0.20 && Math.abs(x) > 0.012 && Math.abs(x) < CAB.hx - 0.02;
    this.stage.setSocketGlow((s) => {
      if (s.side !== side) return 0;
      if (c.snapping && s.xi === xi && s.yi === yi) return 1.7;
      return c.snapping ? 0.32 : 0.14;
    });
    this.refreshBars();
  }

  buildMove(ev) {
    if (this.carry) {
      this.raycaster.setFromCamera(this.ndc(ev), this.camera);
      const hit = this.raycaster.ray.intersectPlane(this.carry.plane, new THREE.Vector3());
      if (!hit) return;
      const x = clamp(hit.x + this.carry.offX, -CAB.hx + 0.02, CAB.hx - 0.02);
      const z = clamp(hit.z + this.carry.offZ, -0.12, 0.48);
      this.updateCarry(x, z);
      return;
    }
    if (this.drag && this.drag.kind === 'handle') {
      const bar = this.layout.bars[this.drag.index];
      if (!bar.placed) return;
      // 指で隠れないよう、接点を指より少し上に取る
      this.raycaster.setFromCamera(this.ndc(ev, 34), this.camera);
      const z = (this.drag.end === 0 ? BAR.z0 : BAR.z1) + HANDLE.dz;
      const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -z);
      const hit = this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
      if (!hit) return;
      const xi = nearestIndex(SLOT_X, Math.sign(hit.x) === bar.side ? Math.abs(hit.x) : 0);
      const yi = nearestIndex(SLOT_Y, hit.y - HANDLE.dy);
      const end = this.drag.end === 0 ? bar.front : bar.back;
      if (end.xi !== xi || end.yi !== yi) {
        end.xi = xi; end.yi = yi;
        A.sfxTick();
        this.refreshBars();
      }
      this.stage.setSocketGlow((s) => {
        if (s.side !== bar.side) return 0;
        if (s.end === (this.drag.end === 0 ? -1 : 1)) {
          return (s.xi === xi && s.yi === yi) ? 1.6 : 0.28;
        }
        return 0;
      });
    }
  }

  buildUp() {
    if (this.carry) {
      const c = this.carry;
      const bar = this.layout.bars[c.index];
      if (c.snapping) {
        bar.placed = true;
        bar.side = c.side;
        bar.front.xi = c.xi; bar.front.yi = c.yi;
        bar.back.xi = c.xi; bar.back.yi = c.yi;
        this.carry = null;
        this.refreshBars();
        A.sfxSnap();
        this.stage.flashBar(c.index);
        this.director.freeze(0.55);
      } else {
        this.carry = null;
        this.refreshBars();
      }
      this.stage.setSocketGlow(null);
      this.save();
      this.updateUI();
      if (!this.carry) {
        this.director.set(SHOTS.buildOverview.pos, SHOTS.buildOverview.target, { speed: 2.2 });
      }
      return;
    }
    if (this.drag && this.drag.kind === 'handle') {
      A.sfxSnap();
      this.stage.flashBar(this.drag.index);
      this.stage.setSocketGlow(null);
      this.director.freeze(0.45);
      this.director.set(SHOTS.buildOverview.pos, SHOTS.buildOverview.target, { speed: 2.2 });
      this.save();
    }
    this.drag = null;
  }

  // ---------- 試遊モード ----------
  playDown(ev) {
    if (this.play.phase !== 'aim') return;
    this.raycaster.setFromCamera(this.ndc(ev), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CAB.topY - 0.08));
    const hit = this.raycaster.ray.intersectPlane(plane, _v.clone());
    this.drag = { kind: 'claw', startX: this.play.clawX, hitX: hit ? hit.x : this.play.clawX, moved: false };
  }

  playMove(ev) {
    if (!this.drag || this.drag.kind !== 'claw') return;
    this.raycaster.setFromCamera(this.ndc(ev), this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CAB.topY - 0.08));
    const hit = this.raycaster.ray.intersectPlane(plane, _v.clone());
    if (!hit) return;
    const nx = clamp(this.drag.startX + (hit.x - this.drag.hitX), -CLAW.xLimit, CLAW.xLimit);
    if (Math.abs(nx - this.play.clawX) > 0.0005) this.drag.moved = true;
    this.play.clawX = nx;
  }

  playUp() {
    if (!this.drag || this.drag.kind !== 'claw') return;
    this.drag = null;
    if (this.play.phase !== 'aim') return;
    this.startDescent();
  }

  startDescent() {
    const p = this.play;
    p.phase = 'descend';
    p.t = 0;
    p.moved = 0;
    p.pulled = false;
    this.prize.centerWorld(_v);
    p.dir = p.clawX <= _v.x ? 1 : -1;
    p.targetTipY = this.descentTarget();
    const shot = contactShot(_v, p.dir);
    this.director.set(shot.pos, shot.target, { speed: shot.speed });
    A.motor(1);
  }

  enterPlay() {
    if (!this.bothPlaced() || !this.prize) return;
    this.mode = 'play';
    this.prevTrail = this.trail.length > 4 ? this.trail : this.prevTrail;
    this.trail = [];
    if (this.prevTrail.length > 4) {
      this.stage.setGhost(this.prevTrail);
      this.ghostTimer = 3.6;
    } else {
      this.ghostTimer = 0;
    }
    this.prize.frozen = false;
    this.chuteDone = false;
    const p = this.play;
    p.phase = 'intro';
    p.t = 0;
    p.clawX = 0;
    p.tipY = CLAW.homeTipY;
    this.prize.centerWorld(_v);
    p.gantryZ = clamp(_v.z, CLAW.gantryZMin, CLAW.gantryZMax);
    this.director.set(SHOTS.playOverview.pos, SHOTS.playOverview.target, { speed: 2.0 });
    this.refreshBars();
    A.sfxMode(true);
    this.updateUI();
  }

  enterBuild() {
    this.mode = 'build';
    this.prevTrail = this.trail.length > 4 ? this.trail.slice() : this.prevTrail;
    this.trail = [];
    if (this.prevTrail.length > 4) {
      this.stage.setGhost(this.prevTrail);
      this.ghostTimer = 2.6;
    }
    this.prize.frozen = true;
    this.updatePrizeStart();
    const p = this.play;
    p.phase = 'aim';
    p.tipY = CLAW.homeTipY;
    p.clawX = 0;
    for (const s of this.clawSegs) s.active = false;
    A.motor(0);
    this.director.set(SHOTS.buildOverview.pos, SHOTS.buildOverview.target, { speed: 2.4 });
    this.refreshBars();
    A.sfxMode(false);
    this.updateUI();
  }

  updateClaw(dt) {
    const p = this.play;
    const vel = _v2.set(0, 0, 0);
    this.prize.centerWorld(_v);

    // ガントリーは景品の奥行きへ寄る（一指で横だけ操作させるため）。
    // 降下を始めたら止める。追いかけ続けると景品を引きずってしまう。
    if (p.phase === 'intro' || p.phase === 'aim' || p.phase === 'lift') {
      p.gantryZ += (clamp(_v.z, CLAW.gantryZMin, CLAW.gantryZMax) - p.gantryZ) * Math.min(1, dt * 4.5);
    }

    if (p.phase === 'intro') {
      p.t += dt;
      if (p.t > 0.85) {
        p.phase = 'aim';
        this.director.set(SHOTS.playAim.pos, SHOTS.playAim.target, { speed: SHOTS.playAim.speed });
      }
    } else if (p.phase === 'aim') {
      A.motor(this.drag && this.drag.kind === 'claw' && this.drag.moved ? 0.6 : 0);
    } else if (p.phase === 'descend') {
      p.tipY -= CLAW.descendSpeed * dt;
      vel.set(0, -CLAW.descendSpeed, 0);
      if (p.tipY <= p.targetTipY) { p.tipY = p.targetTipY; p.phase = 'push'; }
    } else if (p.phase === 'push') {
      const step = CLAW.strokeSpeed * dt;
      p.clawX += p.dir * step;
      p.moved += step;
      vel.set(p.dir * CLAW.strokeSpeed, 0, 0);
      if (p.moved >= CLAW.stroke) { p.phase = 'settle'; p.t = 0; A.motor(0); }
    } else if (p.phase === 'settle') {
      p.t += dt;
      if ((p.t > 0.7 && this.prize.resting) || p.t > 2.4) { p.phase = 'lift'; A.motor(0.8); }
    } else if (p.phase === 'lift') {
      p.tipY += CLAW.liftSpeed * dt;
      vel.set(0, CLAW.liftSpeed, 0);
      if (p.tipY >= CLAW.homeTipY) {
        p.tipY = CLAW.homeTipY;
        p.phase = 'aim';
        p.moved = 0;
        A.motor(0);
        this.director.set(SHOTS.playAim.pos, SHOTS.playAim.target, { speed: 1.8 });
      }
    }

    const active = p.phase !== 'intro';
    for (let i = 0; i < 4; i++) {
      const seg = this.clawSegs[i];
      const sx = i < 2 ? -1 : 1;
      const sz = (i % 2) === 0 ? -1 : 1;
      const x = p.clawX + sx * CLAW.spacing;
      const z = p.gantryZ + sz * CLAW.bladeHalfZ * 0.55;
      seg.a.set(x, p.tipY, z);
      seg.b.set(x, p.tipY + CLAW.rodLength, z);
      seg.vel.copy(vel);
      seg.active = active;
    }
    this.stage.setClaw(p.clawX, p.tipY + CLAW.rodLength + 0.015, p.gantryZ);
  }

  // 爪が降りる高さ。景品の真上なら上面を少しだけ押す位置で止め、
  // 横なら景品の中ほどを押せる高さまで降りる。（めり込ませない）
  descentTarget() {
    const p = this.play;
    let barTop = SLOT_Y[0];
    for (const b of this.layout.bars) barTop = Math.max(barTop, barTopAt(b, p.gantryZ).y);
    const side = barTop + 0.014;
    const { min, max } = this.prize.aabb(_aabbMin, _aabbMax);
    const r = CLAW.bladeHalfX;
    const overlaps = [p.clawX - CLAW.spacing, p.clawX + CLAW.spacing]
      .some((x) => x + r > min.x && x - r < max.x)
      && p.gantryZ + CLAW.bladeHalfZ > min.z && p.gantryZ - CLAW.bladeHalfZ < max.z;
    return overlaps ? Math.max(side, max.y - 0.004) : side;
  }

  // ---------- ループ ----------
  update(dt) {
    this.frame++;
    this.idle += dt;

    if (this.mode === 'play' && this.prize) {
      this.updateClaw(dt);
      const before = this.prize.lastImpulse;
      this.world.step(dt);
      const j = this.prize.lastImpulse;
      if (j > 0.004 && j > before * 1.6 && !this.prize.resting) A.sfxClack(Math.min(0.12, j));
      this.syncPrizeMesh();

      if (this.frame % 2 === 0 && !this.prize.resting) {
        this.prize.centerWorld(_v);
        if (this.trail.length < 260) this.trail.push(_v.clone());
      }
      this.prize.centerWorld(_v);
      if (!this.play.pulled && _v.y < SLOT_Y[0] - 0.03) {
        this.play.pulled = true;
        const s = fallShot(_v, this.play.dir);
        this.director.set(s.pos, s.target, { speed: s.speed });
      }
      if (!this.chuteDone && inChute(_v)) {
        this.chuteDone = true;
        this.stage.flashChute();
        A.sfxChute();
      }
    } else if (this.prize) {
      this.syncPrizeMesh();
    }

    // カプセル内の小景品はゆれる（大きく転がるほど大きく）
    if (this.prize && this.prize.kind === 'capsule') {
      // カプセルから見た実効重力の向きへ寄る
      _v.set(0, -9.81, 0).sub(this.prize.accel)
        .applyQuaternion(_q.copy(this.prize.quat).invert())
        .multiplyScalar(0.0011);
      if (_v.length() > 0.016) _v.setLength(0.016);
      this.trinketVel.addScaledVector(_v.sub(this.trinketOffset), 900 * dt);
      this.trinketVel.multiplyScalar(Math.exp(-6 * dt));
      this.trinketOffset.addScaledVector(this.trinketVel, dt);
      if (this.trinketOffset.length() > 0.017) this.trinketOffset.setLength(0.017);
      this.stage.trinket.position.copy(this.trinketOffset);
    }

    if (this.ghostTimer > 0) {
      this.ghostTimer -= dt;
      this.stage.setGhostOpacity(Math.min(1, this.ghostTimer / 1.2) * 0.85);
    } else {
      this.stage.setGhostOpacity(0);
    }

    // まだ何も置いていないときは、工具台のバーがそっと上下する
    const hint = this.mode === 'build' && !this.carry && this.idle > 2.5;
    for (let i = 0; i < 2; i++) {
      if (this.layout.bars[i].placed || (this.carry && this.carry.index === i)) continue;
      const off = hint ? Math.sin(this.idle * 2.2 + i * 1.7) * 0.006 : 0;
      const { a, b } = this.barEnds(i);
      a.y += off; b.y += off;
      this.stage.setBarEnds(i, a, b, { handles: false });
    }

    this.stage.update(dt);
    this.director.update(dt);
    this.renderer.render(this.stage.scene, this.camera);
  }

  // ---------- UI ----------
  _bindUI() {
    this.ui.capsule.addEventListener('click', () => { A.initAudio(); this.spawnPrize('capsule'); });
    this.ui.box.addEventListener('click', () => { A.initAudio(); this.spawnPrize('box'); });
    this.ui.play.addEventListener('click', () => { A.initAudio(); this.enterPlay(); });
    this.ui.build.addEventListener('click', () => { A.initAudio(); this.enterBuild(); });
  }

  updateUI() {
    const build = this.mode === 'build';
    const ready = this.bothPlaced();
    this.ui.root.dataset.mode = this.mode;
    for (const [el, on] of [[this.ui.capsule, ready], [this.ui.box, ready], [this.ui.play, ready && !!this.prize]]) {
      el.classList.toggle('off', !on);
    }
    this.ui.capsule.classList.toggle('sel', this.layout.prizeKind === 'capsule');
    this.ui.box.classList.toggle('sel', this.layout.prizeKind === 'box');
    this.ui.capsule.classList.toggle('pulse', build && ready && !this.prize);
    this.ui.box.classList.toggle('pulse', build && ready && !this.prize);
    this.ui.play.classList.toggle('pulse', build && ready && !!this.prize);
  }

  // ---------- 保存 ----------
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layout));
    } catch (e) { /* 保存できなくても遊べる */ }
  }

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || !Array.isArray(d.bars) || d.bars.length !== 2) return;
      for (let i = 0; i < 2; i++) {
        const s = d.bars[i];
        const t = this.layout.bars[i];
        t.placed = !!s.placed;
        t.side = s.side === 1 || s.side === -1 ? s.side : 0;
        for (const k of ['front', 'back']) {
          const src = s[k] || {};
          t[k].xi = clamp(Number.isFinite(src.xi) ? src.xi | 0 : SLOT_X_DEFAULT, 0, SLOT_X.length - 1);
          t[k].yi = clamp(Number.isFinite(src.yi) ? src.yi | 0 : SLOT_Y_DEFAULT, 0, SLOT_Y.length - 1);
        }
        if (t.side === 0) t.placed = false;
      }
      if (this.layout.bars[0].placed && this.layout.bars[1].placed
        && this.layout.bars[0].side === this.layout.bars[1].side) {
        this.layout.bars[1].placed = false;
      }
      if (d.prizeKind === 'capsule' || d.prizeKind === 'box') this.layout.prizeKind = d.prizeKind;
    } catch (e) { /* 壊れていたら初期状態 */ }
  }

  // ---------- 画面 ----------
  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const portrait = h >= w;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = portrait ? 42 : 38;
    this.camera.updateProjectionMatrix();
    this.director.portrait = portrait;
    this.director.zoom = portrait ? 1.12 : 1.16;
    this.ui.root.dataset.orient = portrait ? 'portrait' : 'landscape';
  }
}
