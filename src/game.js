// The workshop itself: six steps, one finger, nothing to fail.
//
//   0  ふわっ   spread the cloth open
//   1  なぞる   trace the pattern in tailor's chalk
//   2  ちょきちょき  cut along the line
//   3  カタカタ  sew around the edge
//   4  くるん   turn it right side out — flat becomes a garment
//   5  かざる   decorate, then a fresh bundle of cloth arrives

import * as THREE from 'three';
import { Cloth, TABLE_Y } from './cloth.js';
import { makePattern } from './patterns.js';
import { makeFabricTexture } from './fabric.js';
import {
  makeScissors, makeSewingMachine, makeChalk, makeHanger,
  makeDecoration, makeGuideHand, DECO_KINDS, roundedBox,
} from './tools.js';
import { Sparkles, Flakes, Offcut, GuideDots, ChalkLine, Stitches } from './fx.js';
import { disposeTree } from './world.js';
import { PathTrack, insetPath, clamp, smoothstep, easeOutElastic, easeOutCubic } from './geom2d.js';

export const PHASE = { SPREAD: 0, TRACE: 1, CUT: 2, SEW: 3, TURN: 4, DECORATE: 5 };

const WORK_DIR = new THREE.Vector3(0, 0.80, 0.62).normalize();
// a tall screen fills much better from higher up: less empty wall, more table
const WORK_DIR_TALL = new THREE.Vector3(0, 0.95, 0.36).normalize();
const SHOW_DIR = new THREE.Vector3(0.08, 0.26, 1.0).normalize();

export class Game {
  constructor(world, audio, hud, input) {
    this.world = world;
    this.audio = audio;
    this.hud = hud;
    this.input = input;
    this.scene = world.scene;
    this.tier = world.tier;

    this.cloth = new Cloth(this.tier);
    this.sample = Cloth.makeSample();
    this.round = 0;
    this.phase = PHASE.SPREAD;
    this.phaseT = 0;
    this.progress = 0;
    this.locked = 0;              // brief pause between phases
    this.pendingPhase = null;

    this._buildMeshes();
    this._buildProps();
    this._buildFx();

    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
    this._pat = { x: 0, y: 0 };
    this._head = { x: 0, y: 0 };
    this._probe = { x: 0, y: 0 };
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._zAxis = new THREE.Vector3(0, 0, 1);

    this.decorations = [];
    this.flyAway = -1;
    this.decoKind = DECO_KINDS[0];
    this.decoIndex = 0;
    this.snipAt = 0;
    this.stitchAt = 0;
    this.chalkAt = 0;
    this.idle = 0;

    this.hud.buildDecoBar(DECO_KINDS, 0);
  }

  // ------------------------------------------------------------------ setup

  _buildMeshes() {
    const physical = this.tier.name !== 'low';
    const params = {
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
      side: THREE.DoubleSide,
      shadowSide: THREE.DoubleSide,
    };
    this.clothMat = physical
      ? new THREE.MeshPhysicalMaterial({
        ...params, sheen: 1.0, sheenRoughness: 0.72, sheenColor: new THREE.Color(0xffffff),
      })
      : new THREE.MeshStandardMaterial(params);

    this.clothMesh = new THREE.Mesh(this.cloth.geo, this.clothMat);
    this.clothMesh.castShadow = true;
    this.clothMesh.receiveShadow = true;
    this.clothMesh.frustumCulled = false;
    this.scene.add(this.clothMesh);
  }

  _buildProps() {
    this.chalkRig = new THREE.Group();
    this.chalk = makeChalk();
    this.chalk.scale.setScalar(0.8);
    this.chalk.position.set(0.02, 0.02, 0.02);
    this.chalkRig.add(this.chalk);
    this.chalkRig.visible = false;
    this.scene.add(this.chalkRig);

    this.scissorsRig = new THREE.Group();
    this.scissors = makeScissors();
    this.scissors.scale.setScalar(0.86);
    this.scissors.position.set(-0.36, 0.06, 0);
    this.scissorsRig.add(this.scissors);
    this.scissorsRig.visible = false;
    this.scene.add(this.scissorsRig);

    this.machineRig = new THREE.Group();
    this.machine = makeSewingMachine();
    this.machine.rotation.y = Math.PI;
    this.machine.scale.setScalar(0.72);
    this.machine.position.set(-0.34 * 0.72, 0, 0);
    this.machineRig.add(this.machine);
    this.machineRig.visible = false;
    this.scene.add(this.machineRig);

    this.hangerGroup = new THREE.Group();
    this.hangerGroup.visible = false;
    this.scene.add(this.hangerGroup);
    this.hanger = null;

    this.hand = makeGuideHand();
    this.hand.visible = false;
    this.scene.add(this.hand);

    this.bundle = new THREE.Group();
    this.bundle.visible = false;
    this.scene.add(this.bundle);
  }

  _buildFx() {
    const pr = Math.min(window.devicePixelRatio || 1, this.tier.maxPR);
    this.sparks = new Sparkles(this.scene, this.tier.sparkles, pr, true);
    this.dust = new Sparkles(this.scene, Math.floor(this.tier.sparkles * 0.6), pr, false);
    this.bits = new Flakes(this.scene, 70);
    this.confetti = new Flakes(this.scene, this.tier.name === 'low' ? 70 : 120, true);
    this.guide = new GuideDots(this.scene, 72);
    this.chalkLine = new ChalkLine(this.scene, 210);
    this.stitches = new Stitches(this.scene, 150, 0xffffff);
    this.offcuts = [];
  }

  // ------------------------------------------------------------------ round

  startRound(n) {
    this.round = n;
    this.pattern = makePattern(n);
    const c = this.pattern.colour;

    if (this.fabricTex) this.fabricTex.dispose();
    this.fabricTex = makeFabricTexture(c, this.tier.tex);
    this.clothMat.map = this.fabricTex;
    this.clothMat.needsUpdate = true;
    this.bits.mesh.material.map = this.fabricTex;
    this.bits.mesh.material.color.set(0xffffff);
    this.bits.mesh.material.needsUpdate = true;
    this.stitches.setColour(c.thread);

    this.cloth.reset(this.pattern);
    this.S = this.cloth.S;
    this.clothMesh.position.set(0, 0, 0);
    this.clothMat.opacity = 1;
    this.clothMat.transparent = false;
    this.flyAway = -1;

    // paths, in pattern space
    const o = this.pattern.outline;
    const s0 = this.pattern.seamStart;
    const loop = o.slice(s0).concat(o.slice(0, s0));
    loop.push({ ...o[s0] });
    this.tracePath = new PathTrack(loop, false);
    this.sewPath = new PathTrack(o.slice(s0, this.pattern.seamEnd + 1), false);

    this.chalkLine.setPath(this._samplePath(this.tracePath, 210, 0));
    this.chalkLine.setRange(0, 0);
    this.stitches.setPath(this._samplePath(this.sewPath, 150, 0.055));
    this.stitches.setProgress(0);

    this._clearDecorations();

    this.hangerGroup.visible = false;
    if (this.hanger) {
      this.hangerGroup.remove(this.hanger);
      disposeTree(this.hanger);
      this.hanger = null;
    }
    this.bundle.visible = false;
    this.bundleReady = false;

    this.grabRadius = 0.34;
    this._setPhase(PHASE.SPREAD);
  }

  /** N evenly spaced points along a track, optionally pushed inside the shape. */
  _samplePath(track, n, inset) {
    const pts = [];
    const a = { x: 0, y: 0 };
    for (let i = 0; i < n; i++) {
      track.at(i / (n - 1), a);
      pts.push({ x: a.x, y: a.y });
    }
    return inset ? insetPath(pts, this.pattern.outline, inset) : pts;
  }

  _setPhase(p) {
    this.phase = p;
    this.pendingPhase = null;
    this.phaseT = 0;
    this.progress = 0;
    this.idle = 0;
    this.hud.setPhase(p);

    this.chalkRig.visible = p === PHASE.TRACE;
    this.scissorsRig.visible = p === PHASE.CUT;
    this.machineRig.visible = p === PHASE.SEW;
    this.hud.showDecoBar(p === PHASE.DECORATE);
    this.audio.motor(false);

    if (p === PHASE.TRACE) {
      this.guide.setPath(this._samplePath(this.tracePath, 72, 0));
      this.chalkLine.setRange(0, 0);
      this.chalkLine.mesh.visible = true;
    } else if (p === PHASE.CUT) {
      this.guide.setPath(this._samplePath(this.tracePath, 72, 0));
    } else if (p === PHASE.SEW) {
      this.guide.setPath(this._samplePath(this.sewPath, 72, 0.055));
    } else {
      this.guide.hide();
    }

    if (p === PHASE.TURN) {
      const b = this.pattern.bounds;
      const H = (b.maxY - b.minY) * this.S;
      this.garmentH = H;
      this.cloth.turnPivot.set(0, TABLE_Y, -b.maxY * this.S);
      this.cloth.turnLift.set(0, 0.66 + H, 0.5);
      this.cloth.mode = 'turn';
      this.cloth.turn = 0;
      this.audio.twirl();
    }

    if (p === PHASE.DECORATE) {
      this.hud.selectDeco(this.decoIndex);
    }
  }

  // ------------------------------------------------------------------ frame

  update(dt, time) {
    const input = this.input;
    this.phaseT += dt;
    if (this.locked > 0) this.locked = Math.max(0, this.locked - dt);
    if (input.down) this.idle = 0; else this.idle += dt;

    this._readPointer();

    switch (this.phase) {
      case PHASE.SPREAD: this._spread(dt); break;
      case PHASE.TRACE: this._trace(dt); break;
      case PHASE.CUT: this._cut(dt); break;
      case PHASE.SEW: this._sew(dt); break;
      case PHASE.TURN: this._turn(dt); break;
      case PHASE.DECORATE: this._decorate(dt); break;
    }

    this.cloth.step(dt);
    this._updateAttachments(dt, time);
    this._updateFx(dt);
    this._updateHand(time);
    this._frameCamera();
  }

  _readPointer() {
    const hit = this.world.pointerToPlane(this.input.ndc, TABLE_Y + 0.03, this._tmp);
    if (hit) {
      this._pat.x = hit.x / this.S;
      this._pat.y = -hit.z / this.S;
      this.pointerOk = true;
    } else {
      this.pointerOk = false;
    }
  }

  /**
   * Forgiving path following: the head creeps forward whenever a finger is
   * anywhere near it, so a wobbly line still gets all the way around.
   */
  _advance(track, dt, speed = 1.15) {
    if (!this.input.down || !this.pointerOk || this.locked > 0) return 0;
    track.at(this.progress, this._head);
    const dHead = Math.hypot(this._pat.x - this._head.x, this._pat.y - this._head.y);
    if (dHead > this.grabRadius * 1.9) return 0;

    let gained = 0;
    const r = track.search(this._pat, this.progress, 0.02, 0.12);
    if (r.dist < this.grabRadius && r.s > this.progress) {
      const step = Math.min(r.s - this.progress, dt * speed);
      this.progress += step;
      gained += step;
    }
    const assist = dt * 0.055;
    this.progress = Math.min(1, this.progress + assist);
    gained += assist;
    return gained;
  }

  /** World position + surface frame at a pattern point. */
  _surface(px, py, lift = 0) {
    this.cloth.sampleSurface(px, py, this.sample);
    this._tmp.copy(this.sample.pos).addScaledVector(this.sample.nrm, this.sample.puff + lift);
    return this._tmp;
  }

  _pathYaw(track, s) {
    const a = { x: 0, y: 0 }, b = { x: 0, y: 0 };
    track.at(Math.max(0, s - 0.008), a);
    track.at(Math.min(1, s + 0.008), b);
    const dx = (b.x - a.x) * this.S;
    const dz = -(b.y - a.y) * this.S;
    if (Math.abs(dx) + Math.abs(dz) < 1e-6) return 0;
    return Math.atan2(-dz, dx);
  }

  // ------------------------------------------------------------- phase 0 ふわっ

  _spread(dt) {
    const cloth = this.cloth;
    if (this.input.down && this.locked <= 0) {
      if (cloth.mode === 'fold') {
        cloth.mode = 'unfurl';
        this.audio.fluff(1);
      }
      const gain = this.input.moved * 0.85 + dt * 0.13;
      const before = cloth.unfurl;
      cloth.unfurl = Math.min(1.06, cloth.unfurl + gain);
      if (Math.floor(before * 5) !== Math.floor(cloth.unfurl * 5)) {
        this.audio.fluff(0.5);
        this._tmp.set((Math.random() - 0.5) * 2, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 2);
        this.sparks.burst(this._tmp, 8, { colour: '#fff2d6', speed: 0.6, life: 0.9, size: 0.13 });
      }
      this.progress = cloth.unfurl;
    } else if (cloth.mode === 'unfurl') {
      cloth.unfurl = Math.min(1.06, cloth.unfurl + dt * 0.16);
      this.progress = cloth.unfurl;
    }

    if (cloth.unfurl >= 1.04 && this.locked <= 0) {
      if (!this._queuePhase(0.85, PHASE.TRACE)) return;
      cloth.mode = 'flat';
      this.audio.chime();
      this._tmp.set(0, TABLE_Y + 0.1, 0);
      this.sparks.burst(this._tmp, 34, { colour: '#ffffff', spread: 1.5, speed: 1.1, life: 1.2, size: 0.14 });
    }
  }

  // ------------------------------------------------------------- phase 1 なぞる

  _trace(dt) {
    const gained = this._advance(this.tracePath, dt, 1.15);
    this.chalkLine.setRange(0, this.progress);

    this.tracePath.at(this.progress, this._head);
    const p = this._surface(this._head.x, this._head.y, 0.02);
    this.chalkRig.position.copy(p);
    this.chalkRig.rotation.y = this._pathYaw(this.tracePath, this.progress);
    this.chalkRig.position.y += 0.02 + Math.sin(this.phaseT * 9) * 0.006;

    if (gained > 0) {
      this.chalkAt += gained;
      if (this.chalkAt > 0.055) {
        this.chalkAt = 0;
        this.audio.chalk();
        this.dust.burst(p, 3, { colour: '#fffdf0', spread: 0.05, speed: 0.28, life: 0.5, size: 0.07, gravity: -0.4 });
      }
    }

    if (this.progress >= 0.999 && this.locked <= 0) {
      if (!this._queuePhase(0.7, PHASE.CUT)) return;
      this.audio.chime();
      this.sparks.burst(p, 26, { colour: '#fff6d0', spread: 0.3, speed: 1.0, life: 1.0, size: 0.14 });
    }
  }

  // -------------------------------------------------------- phase 2 ちょきちょき

  _cut(dt) {
    const gained = this._advance(this.tracePath, dt, 1.0);
    this.chalkLine.setRange(this.progress, 1);

    this.tracePath.at(this.progress, this._head);
    const p = this._surface(this._head.x, this._head.y, 0.03);
    this.scissorsRig.position.copy(p);
    this.scissorsRig.rotation.y = this._pathYaw(this.tracePath, this.progress);

    this.snipAt += gained;
    const beat = (this.progress * 26) % 1;
    this.scissors.setOpen(0.18 + 0.72 * Math.abs(Math.sin(beat * Math.PI)));
    if (this.snipAt > 0.038) {
      this.snipAt = 0;
      this.audio.snip();
      this.bits.spawn(p, 2, { speed: 0.55, up: 0.8, life: 1.5, spread: 0.06, scale: 0.6 });
      this.dust.burst(p, 2, { colour: '#ffffff', spread: 0.04, speed: 0.4, life: 0.45, size: 0.06, gravity: -0.6 });
    }

    if (this.progress >= 0.999 && this.locked <= 0) {
      if (!this._queuePhase(1.15, PHASE.SEW)) return;
      this.chalkLine.hide();
      this.guide.hide();
      this.scissorsRig.visible = false;
      const startPt = this.tracePath.at(0, { x: 0, y: 0 });
      const origin = this._surface(startPt.x, startPt.y, 0).clone();
      const geo = this.cloth.cut();
      this.offcuts.push(new Offcut(this.scene, geo, this.clothMat, origin));
      this.audio.chime();
      this.audio.fluff(0.7);
      this._tmp.set(0, TABLE_Y + 0.05, 0);
      this.sparks.burst(this._tmp, 30, { colour: '#ffffff', spread: 1.2, speed: 0.9, life: 1.1, size: 0.13 });
    }
  }

  // ------------------------------------------------------------- phase 3 カタカタ

  _sew(dt) {
    const gained = this._advance(this.sewPath, dt, 0.85);
    this.stitches.setProgress(this.progress);

    this.sewPath.at(this.progress, this._head);
    const p = this._surface(this._head.x, this._head.y, 0);
    this.machineRig.position.set(p.x, 0, p.z);
    this.machineRig.rotation.y = this._pathYaw(this.sewPath, this.progress);

    this.sewPhase = (this.sewPhase || 0) + (gained > 0 ? dt * 22 : dt * 1.4);
    this.machine.setStitch(this.sewPhase);
    this.audio.motor(gained > 0);

    if (gained > 0) {
      this.stitchAt += gained;
      if (this.stitchAt > 0.016) {
        this.stitchAt = 0;
        this.audio.stitch();
        if (Math.random() < 0.4) {
          this.dust.burst(p, 1, { colour: '#fff8e0', spread: 0.03, speed: 0.25, life: 0.4, size: 0.05, gravity: -0.3 });
        }
      }
    }

    if (this.progress >= 0.999 && this.locked <= 0) {
      if (!this._queuePhase(1.0, PHASE.TURN)) return;
      this.audio.motor(false);
      this.audio.chime();
      this.machineRig.visible = false;
      this.guide.hide();
      this.sparks.burst(p, 28, { colour: '#fff2c8', spread: 0.4, speed: 1.0, life: 1.1, size: 0.14 });
    }
  }

  // -------------------------------------------------------------- phase 4 くるん

  _turn(dt) {
    const cloth = this.cloth;
    if (this.locked <= 0) {
      let gain = 0;
      // no table-plane hit needed here: by now the camera is near eye level,
      // so a ray aimed above the horizon would simply miss it
      if (this.input.down) gain = this.input.moved * 0.8 + dt * 0.16;
      else if (cloth.turn > 0.02) gain = dt * 0.2;
      if (gain > 0) {
        const before = cloth.turn;
        cloth.turn = Math.min(1, cloth.turn + gain);
        this.progress = cloth.turn;
        if (Math.floor(before * 8) !== Math.floor(cloth.turn * 8)) {
          this._tmp.copy(cloth.turnLift);
          this._tmp.y -= this.garmentH * (0.3 + Math.random() * 0.5);
          this._tmp.x += (Math.random() - 0.5) * 1.2;
          this.sparks.burst(this._tmp, 10, { colour: '#fff4dc', spread: 0.3, speed: 0.7, life: 1.0, size: 0.15 });
        }
      }
    }

    // the hanger fades in as the garment rises
    if (!this.hanger && cloth.turn > 0.42) {
      this.hanger = makeHanger(this.pattern.clipHanger);
      this.hangerGroup.add(this.hanger);
      this.hangerGroup.visible = true;
      this.hangerGroup.scale.setScalar(0.001);
    }
    if (this.hanger) {
      const t = smoothstep(0.42, 0.95, cloth.turn);
      const half = Math.max(0.3, (this.pattern.bounds.maxX) * this.S * 0.72);
      const s = (half / 0.72) * easeOutCubic(t);
      this.hangerGroup.scale.setScalar(Math.max(0.001, s));
      this.hangerGroup.position.set(
        cloth.turnLift.x,
        cloth.turnLift.y + 0.1,
        cloth.turnLift.z
      );
      this.hangerGroup.rotation.y = (1 - t) * 1.6;
    }

    if (cloth.turn >= 1 && this.locked <= 0) {
      if (!this._queuePhase(1.2, PHASE.DECORATE)) return;
      cloth.pinTop();
      cloth.mode = 'hang';
      this._placeHanger();
      this.audio.fanfare();
      this._tmp.copy(cloth.turnLift);
      this._tmp.y -= this.garmentH * 0.4;
      this.sparks.burst(this._tmp, 46, { colour: '#ffffff', spread: 0.9, speed: 1.5, life: 1.4, size: 0.17 });
      this.confetti.spawn(
        new THREE.Vector3(cloth.turnLift.x, cloth.turnLift.y + 0.4, cloth.turnLift.z),
        this.tier.name === 'low' ? 44 : 70,
        {
          speed: 1.6, up: 1.3, life: 2.6, spread: 0.8, scale: 1.0,
          colours: [this.pattern.colour.ink, this.pattern.colour.accent, '#ffffff', '#ffd76a'],
        }
      );
    }
  }

  _placeHanger() {
    if (!this.hanger) {
      this.hanger = makeHanger(this.pattern.clipHanger);
      this.hangerGroup.add(this.hanger);
      this.hangerGroup.visible = true;
    }
    const c = this.cloth.pinCentre(new THREE.Vector3());
    let minX = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let p = 0; p < this.cloth.P; p++) {
      if (!this.cloth.pinned[p]) continue;
      const x = this.cloth.pinPos[p * 3];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, this.cloth.pinPos[p * 3 + 1]);
    }
    const half = Math.max(0.32, (maxX - minX) * 0.5 + 0.05);
    this.hangerGroup.scale.setScalar(half / 0.72);
    this.hangerGroup.rotation.y = 0;
    this.hangerGroup.position.set(c.x, maxY + 0.1 * (half / 0.72), c.z);
  }

  // -------------------------------------------------------------- phase 5 かざる

  _decorate(dt) {
    if (this.input.justDown && this.locked <= 0) {
      const hit = this._raycastGarment();
      if (hit) {
        this._placeDecoration(hit);
      } else if (this.bundleReady) {
        this._finishRound();
        return;
      }
    }

    if (!this.bundleReady && this.decorations.length >= 3) {
      this._showBundle();
    }
    if (this.bundleReady) {
      const t = this.phaseT;
      this.bundle.position.y = 0.06 + Math.abs(Math.sin(t * 1.9)) * 0.06;
      this.bundle.rotation.y = Math.sin(t * 0.7) * 0.25;
      const s = 1 + Math.sin(t * 3.1) * 0.03;
      this.bundle.scale.setScalar(this.bundleScale * s);
    }
  }

  _raycastGarment() {
    this.world.raycaster.setFromCamera(this.input.ndc, this.world.camera);
    const hits = this.world.raycaster.intersectObject(this.clothMesh, false);
    if (!hits.length || !hits[0].uv) return null;
    const { W, D } = this.cloth;
    const u = hits[0].uv.x, v = hits[0].uv.y;
    return {
      px: (u * W - W * 0.5) / this.S,
      py: -(v * D - D * 0.5) / this.S,
      point: hits[0].point,
    };
  }

  _placeDecoration(hit) {
    if (this.decorations.length >= 12) return;
    const mesh = makeDecoration(this.decoKind, this.pattern.colour);
    mesh.scale.setScalar(0.001);
    this.scene.add(mesh);

    this.cloth.sampleSurface(hit.px, hit.py, this.sample);
    this._tmp.copy(this.world.camera.position).sub(this.sample.pos);
    const sign = this.sample.nrm.dot(this._tmp) >= 0 ? 1 : -1;

    this.decorations.push({
      mesh, px: hit.px, py: hit.py, sign,
      roll: Math.random() * Math.PI * 2,
      size: 0.42 + Math.random() * 0.18,
      t: 0,
    });
    this.audio.pop(this.decorations.length);
    this.sparks.burst(hit.point, 16, {
      colour: this.pattern.colour.accent, spread: 0.16, speed: 0.8, life: 0.8, size: 0.12,
    });
  }

  _clearDecorations() {
    for (const d of this.decorations) {
      this.scene.remove(d.mesh);
      disposeTree(d.mesh);
    }
    this.decorations.length = 0;
  }

  _showBundle() {
    this.bundleReady = true;
    const next = makePattern(this.round + 1);
    if (this.bundleTex) this.bundleTex.dispose();
    this.bundleTex = makeFabricTexture(next.colour, 256);
    while (this.bundle.children.length) {
      const c = this.bundle.children[0];
      this.bundle.remove(c);
      disposeTree(c);
    }

    const m = new THREE.MeshStandardMaterial({ map: this.bundleTex, roughness: 0.9 });
    const sizes = [[0.86, 0.66, 0.1], [0.74, 0.56, 0.09], [0.6, 0.44, 0.08]];
    let y = 0;
    sizes.forEach((s, i) => {
      const b = roundedBox(s[0], s[1], s[2], 0.05, m);
      b.rotation.x = -Math.PI / 2;
      b.rotation.z = (i - 1) * 0.16;
      b.position.y = y + s[2] * 0.5;
      y += s[2] * 0.86;
      b.receiveShadow = true;
      this.bundle.add(b);
    });

    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.62, 0.78, 40),
      new THREE.MeshBasicMaterial({ color: 0xfff0bb, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.005;
    this.bundle.add(halo);

    this.bundleScale = 1;
    this.bundle.position.set(0, 0.06, 1.55);
    this.bundle.visible = true;
    this.audio.tick();
    this.sparks.burst(this.bundle.position, 22, {
      colour: '#ffffff', spread: 0.5, speed: 0.8, life: 1.1, size: 0.13,
    });
  }

  _finishRound() {
    this.locked = 2.0;
    this.bundleReady = false;
    this.bundle.visible = false;
    this.hud.showDecoBar(false);
    this.audio.fanfare();
    this.confetti.spawn(
      new THREE.Vector3(0, this.cloth.turnLift.y + 0.3, this.cloth.turnLift.z),
      this.tier.name === 'low' ? 60 : 100,
      {
        speed: 2.0, up: 1.6, life: 3.0, spread: 1.2, scale: 1.1,
        colours: [this.pattern.colour.ink, this.pattern.colour.accent, '#ffffff', '#ffd76a', '#a8e6d3'],
      }
    );
    // the finished piece goes up on the workshop rail
    this.world.hangOnRack(
      this.pattern.outline, this.pattern.bounds,
      makeFabricTexture(this.pattern.colour, 256)   // the rail owns its own copy
    );

    this.flyAway = 0;
    this._queue(2.0, () => {
      this.flyAway = -1;
      this._clearDecorations();
      this.stitches.clear();
      this.hangerGroup.visible = false;
      this.hangerGroup.position.y = 0;
      this.startRound(this.round + 1);
    });
  }

  // ------------------------------------------------------------- attachments

  _updateAttachments(dt, time) {
    this.chalkLine.update(this.cloth);
    this.stitches.update(this.cloth, dt);
    this.guide.update(this.cloth, this.progress, time);

    for (const d of this.decorations) {
      d.t = Math.min(1, d.t + dt * 2.6);
      this.cloth.sampleSurface(d.px, d.py, this.sample);
      this._tmp.copy(this.sample.nrm).multiplyScalar(d.sign);
      this._tmp2.copy(this.sample.pos).addScaledVector(this._tmp, this.sample.puff + 0.052);
      d.mesh.position.copy(this._tmp2);
      this._q.setFromUnitVectors(this._zAxis, this._tmp);
      d.mesh.quaternion.copy(this._q);
      d.mesh.rotateZ(d.roll);
      const pop = easeOutElastic(d.t);
      d.mesh.scale.setScalar(Math.max(0.001, d.size * pop));
    }

    if (this.flyAway >= 0) {
      this.flyAway += dt;
      const t = this.flyAway;
      const lift = t * t * 1.6;
      this.hangerGroup.position.y += lift * dt * 3;
      this.clothMesh.position.y = lift;
      this.clothMat.opacity = clamp(1.4 - t * 0.9, 0, 1);
      this.clothMat.transparent = this.clothMat.opacity < 0.999;
      for (const d of this.decorations) d.mesh.position.y += lift;
    } else if (this.clothMesh.position.y !== 0) {
      this.clothMesh.position.y = 0;
      this.clothMat.opacity = 1;
      this.clothMat.transparent = false;
    }
  }

  _updateFx(dt) {
    this.sparks.update(dt);
    this.dust.update(dt);
    this.bits.update(dt, TABLE_Y + 0.02);
    this.confetti.update(dt, TABLE_Y + 0.02);
    for (let i = this.offcuts.length - 1; i >= 0; i--) {
      if (!this.offcuts[i].update(dt)) this.offcuts.splice(i, 1);
    }
  }

  // -------------------------------------------------------------- guide hand

  _updateHand(time) {
    const show = !this.input.down && this.idle > 0.7 && this.locked <= 0;
    this.hand.visible = show;
    if (!show) return;

    const loop = (time * 0.28) % 1;
    const fade = Math.sin(Math.min(1, loop * 1.02) * Math.PI);
    this.hand.userData.hand.material.opacity = 0.25 + 0.7 * fade;
    this.hand.userData.halo.material.opacity = 0.12 + 0.26 * fade;
    this.hand.userData.hand.scale.setScalar(0.5);
    this.hand.userData.halo.scale.setScalar(0.44);

    switch (this.phase) {
      case PHASE.SPREAD: {
        const a = -1.0 + loop * 2.0;
        this.hand.position.set(a, TABLE_Y + 0.42, 0.2 + Math.sin(loop * Math.PI) * -0.5);
        break;
      }
      case PHASE.TRACE:
      case PHASE.CUT: {
        const s = clamp(this.progress + 0.02 + loop * 0.2, 0, 1);
        this.tracePath.at(s, this._head);
        this.hand.position.copy(this._surface(this._head.x, this._head.y, 0.24));
        break;
      }
      case PHASE.SEW: {
        const s = clamp(this.progress + 0.02 + loop * 0.2, 0, 1);
        this.sewPath.at(s, this._head);
        this.hand.position.copy(this._surface(this._head.x, this._head.y, 0.24));
        break;
      }
      case PHASE.TURN: {
        const a = loop * Math.PI * 2;
        this.hand.position.set(
          Math.cos(a) * 0.5,
          this.cloth.turnLift.y - this.garmentH * 0.5 + Math.sin(a) * 0.4,
          this.cloth.turnLift.z + 0.5
        );
        this.hand.userData.hand.material.opacity = 0.85;
        this.hand.userData.halo.material.opacity = 0.3;
        break;
      }
      case PHASE.DECORATE: {
        if (this.bundleReady) {
          this.hand.position.set(this.bundle.position.x, this.bundle.position.y + 0.5, this.bundle.position.z + 0.1);
        } else {
          this.hand.position.set(
            0.1,
            this.cloth.turnLift.y - this.garmentH * 0.45,
            this.cloth.turnLift.z + 0.45
          );
        }
        const pulse = 0.9 + Math.sin(time * 4.5) * 0.16;
        this.hand.userData.hand.scale.setScalar(0.5 * pulse);
        this.hand.userData.halo.scale.setScalar(0.44 * pulse);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ camera

  /** Box corners the camera has to keep on screen, per phase. */
  _framePoints(t) {
    const pts = this._framePool;
    const portrait = window.innerHeight > window.innerWidth;

    // the flat working area: the whole piece of cloth on the table
    const wx = this.cloth.W * 0.5 * 1.06;
    const wz = this.cloth.D * 0.5 * 1.06;
    // the cloth flies high while it is being shaken open, so the camera
    // pulls back for that step and moves in once it settles
    const wy = TABLE_Y + (this.phase === PHASE.SPREAD ? 1.15 : 0.45);

    // the finished garment, its hanger, and clear space for the picker bar
    const H = this.garmentH || 2.4;
    const halfW = Math.max(0.7, this.pattern.bounds.maxX * this.S) * 1.16;
    const top = this.cloth.turnLift.y + 0.62;     // the hanger hook
    const bottom = this.cloth.turnLift.y - H - (portrait ? 0.20 : 0.13) * H;
    const gz = this.cloth.turnLift.z;

    let k = 0;
    const put = (x, y, z) => pts[k++].set(x, y, z);
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        // work-area corner blended toward the garment-box corner
        put(
          (-sx * wx) + t * (sx * halfW - (-sx * wx)),
          TABLE_Y + t * (bottom - TABLE_Y),
          (sz * wz) + t * (gz + sz * 0.4 - sz * wz)
        );
        put(
          (-sx * wx) + t * (sx * halfW - (-sx * wx)),
          wy + t * (top - wy),
          (sz * wz) + t * (gz + sz * 0.4 - sz * wz)
        );
      }
    }
    // the fresh bundle of cloth waiting on the table has to be visible too
    if (this.bundleReady) {
      // extra room underneath keeps the bundle clear of the picker bar
      put(-0.75, -0.55, this.bundle.position.z + 0.8);
      put(0.75, 0.6, this.bundle.position.z + 0.5);
    } else {
      pts[8].copy(pts[0]);
      pts[9].copy(pts[1]);
    }
    return pts;
  }

  _frameCamera() {
    if (!this._framePool) {
      this._framePool = Array.from({ length: 10 }, () => new THREE.Vector3());
    }
    const H = this.garmentH || 2.4;
    const t = this.phase <= PHASE.SEW
      ? 0
      : (this.phase === PHASE.TURN ? smoothstep(0, 0.6, this.cloth.turn) : 1);

    const showY = this.cloth.turnLift.y - H * 0.5;
    const y = (TABLE_Y + 0.25) + (showY - TABLE_Y - 0.25) * t;
    const z = 0.05 + (this.cloth.turnLift.z - 0.05) * t;
    this._tmp.set(0, y, z);
    const work = window.innerHeight > window.innerWidth * 1.25 ? WORK_DIR_TALL : WORK_DIR;
    this._tmp2.copy(work).lerp(SHOW_DIR, t).normalize();
    this.world.fit(this._tmp, this._framePoints(t), this._tmp2);
  }

  // ------------------------------------------------------------------ helpers

  /** Schedules the next step once, even if the finish condition re-fires. */
  _queuePhase(delay, phase) {
    if (this.pendingPhase != null) return false;
    this.pendingPhase = phase;
    this.locked = delay;
    this._queue(delay, () => {
      this.pendingPhase = null;
      this._setPhase(phase);
    });
    return true;
  }

  _queue(delay, fn) {
    setTimeout(() => { try { fn(); } catch (e) { console.error(e); } }, delay * 1000);
  }

  onDecoPicked(kind, index) {
    this.decoKind = kind;
    this.decoIndex = index;
    this.audio.tick();
  }
}
