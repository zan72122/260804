import * as THREE from 'three';
import { PALETTE, ROPE, WALK } from '../core/config.js';
import { audio } from '../core/audio.js';
import { clamp, clamp01, damp, lerp, smoothstep } from '../core/util.js';
import { hemp, polishedWood, woodPost } from '../core/textures.js';
import { RopeSystem } from '../rope/ropeSystem.js';
import { Whipping } from '../rope/whipping.js';
import { Environment } from '../world/environment.js';
import { FiberBundle, Jack, NearPost, Traveller } from '../world/hooks.js';
import { RopeTop } from '../world/top.js';
import { Payload, GANTRY_X, PULLEY } from '../world/payload.js';
import { Cat } from '../world/cat.js';

// ---------------------------------------------------------------------------
// 手順は七つ。どれも失敗しない。時間もない。点数もない。
// ---------------------------------------------------------------------------

export const STEPS = [
  { id: 'hook', text: 'あさの たばを<br>とおくの フックまで はこぼう', gesture: 'far', praise: 'かかった！' },
  { id: 'stretch', text: 'てまえに ひっぱって<br>ロープみちに ながく はろう', gesture: 'down', praise: 'ぴーん！' },
  { id: 'twist', text: 'ゆびで ぐるぐる まわして<br>3ぼんとも おなじむきに ねじろう', gesture: 'circle', praise: 'ねじれた！' },
  { id: 'place', text: 'みぞの ある きの トップを<br>3ぼんの あいだに おこう', gesture: 'down', praise: 'ぴったり！' },
  { id: 'lay', text: 'トップを ゆっくり すすめよう<br>うしろで ふとい いっぽんに なるよ', gesture: 'along', praise: 'よりあわさった！' },
  { id: 'whip', text: 'はしを ぐるぐる まいて<br>ほどけないように とめよう', gesture: 'circle', praise: 'とまった！' },
  { id: 'lift', text: 'うえに スワイプして<br>おおきな かねを もちあげよう', gesture: 'up', praise: 'ごーん！' },
];

const JACK_X = WALK.x0 + WALK.span;

export class Game {
  constructor(stage, input, ui) {
    this.stage = stage;
    this.input = input;
    this.ui = ui;
    this.scene = stage.scene;

    this.env = new Environment(this.scene);
    stage.onQuality = (level, q) => this.env.setQuality(level, q);
    this.env.setQuality(stage.level, { shafts: stage.level >= 1, dust: stage.level >= 1 });

    this.rope = new RopeSystem();
    this.scene.add(this.rope.group);

    this.jack = new Jack(JACK_X);
    this.scene.add(this.jack.group);
    this.nearPost = new NearPost(WALK.x0);
    this.scene.add(this.nearPost.group);
    this.traveller = new Traveller();
    this.scene.add(this.traveller.group);

    this.top = new RopeTop();
    this.scene.add(this.top.root);

    this.payload = new Payload();
    this.scene.add(this.payload.group);

    this.whipNear = new Whipping(this.rope, 0.26, 1);
    this.whipFar = new Whipping(this.rope, WALK.span - 0.26, -1);
    this.scene.add(this.whipNear.group, this.whipFar.group);

    this.cats = [
      new Cat({ x: 1.9, z: 1.72, rot: -1.9, color: 0xe0cbaa, seed: 0 }),
      new Cat({ x: 9.4, z: -1.8, rot: 1.2, color: 0x9c8468, seed: 2.4 }),
    ];
    this.cats.forEach((c) => this.scene.add(c.group));

    this._buildStartBench();

    // --- 進行の状態 -------------------------------------------------------
    this.step = -1;
    this.sub = null;
    this.t = 0;
    this.subT = 0;
    this.progress = 0;
    this.hookTurns = 0;
    this.twist01 = 0;
    this.place01 = 0;
    this.whip01 = 0;
    this.lift01 = 0;
    this.attached = 0;
    this.flying = [];
    this.closeSpeed = 0;
    this.wobble = 0;
    this.running = false;

    // --- 使い回す入れもの -------------------------------------------------
    this._v = new THREE.Vector3();
    this._v2 = new THREE.Vector3();
    this._camPos = new THREE.Vector3();
    this._camTar = new THREE.Vector3();
    this._frame = {};
    this._screen = { x: 0, y: 0, visible: true };
    this._hintWorld = new THREE.Vector3();
    this._anchor = new THREE.Vector3();
    this._rigPoints = [];
    for (let i = 0; i < 8; i++) this._rigPoints.push(new THREE.Vector3());
    this.rigCurve = new THREE.CatmullRomCurve3(this._rigPoints, false, 'catmullrom', 0.4);
    this.rigCurve.arcLengthDivisions = 120;

    this.fogOutdoor = new THREE.Color(PALETTE.haze);
    this.fogIndoorC = new THREE.Color(PALETTE.interiorHaze);

    this._frameStart();
  }

  // -------------------------------------------------------------------------

  _buildStartBench() {
    const g = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ map: woodPost(9), roughness: 0.82 });
    const topMat = new THREE.MeshStandardMaterial({ map: polishedWood(), roughness: 0.55 });
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.075, 0.56), topMat);
    top.position.y = 0.79;
    top.castShadow = true;
    top.receiveShadow = true;
    g.add(top);
    for (const lx of [-0.62, 0.62]) {
      for (const lz of [-0.2, 0.2]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.79, 0.08), woodMat);
        leg.position.set(lx, 0.395, lz);
        leg.castShadow = true;
        g.add(leg);
      }
    }
    // 麻くずが少し落ちている
    const scrap = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 10, 7),
      new THREE.MeshStandardMaterial({ map: hemp(1), roughness: 1 })
    );
    scrap.scale.set(1.5, 0.28, 1.1);
    scrap.position.set(-0.5, 0.85, 0.12);
    g.add(scrap);
    g.position.set(-0.5, 0, 1.12);
    g.rotation.y = -0.16;
    this.scene.add(g);
    this.bench = g;

    this.bundles = [];
    for (let i = 0; i < ROPE.strands; i++) {
      const b = new FiberBundle(i + 1);
      b.group.position.set(-0.5 - 0.34 + i * 0.34, 0.9, 1.12 + (i - 1) * 0.06);
      b.group.rotation.set(0, -0.1 + i * 0.09, 0.02);
      b.home = b.group.position.clone();
      b.state = 'rest';
      this.bundles.push(b);
      this.scene.add(b.group);
    }
  }

  _frameStart() {
    this._camPos.set(-2.55, 1.48, 1.75);
    this._camTar.set(4.3, 1.06, 0.05);
    this.stage.frame(this._camPos, this._camTar, { fov: 40, snap: true });
  }

  // -------------------------------------------------------------------------
  // 進行
  // -------------------------------------------------------------------------

  start() {
    this.reset();
    this.running = true;
    this.setStep(0);
  }

  reset() {
    this.step = -1;
    this.sub = null;
    this.progress = 0;
    this.hookTurns = 0;
    this.twist01 = 0;
    this.place01 = 0;
    this.whip01 = 0;
    this.lift01 = 0;
    this.attached = 0;
    this.flying.length = 0;
    this.closeSpeed = 0;

    this.rope.extend = 0.02;
    this.rope.twist = 0;
    this.rope.tension = 0;
    this.rope.close = -1;
    this.rope.pathBlend = 0;
    this.rope._recordedTo = 0;
    this.rope.layPitch.fill(ROPE.layPitch);
    this.rope.layBulge.fill(0);
    this.rope.setVisible(false);

    this.jack.setSpin(0);
    this.jack.stubs.forEach((s) => (s.visible = false));
    this.traveller.group.visible = false;
    this.top.visible = false;
    this.payload.group.visible = false;
    this.payload.setLift(0);
    this.whipNear.setAmount(0);
    this.whipFar.setAmount(0);

    this.bundles.forEach((b) => {
      b.group.position.copy(b.home);
      b.group.visible = true;
      b.group.scale.setScalar(1);
      b.state = 'rest';
    });

    this._frameStart();
  }

  setStep(i) {
    this.step = i;
    this.sub = null;
    this.subT = 0;
    this.progress = 0;
    // 前の手順の「放置時間」と、余った指の勢いを持ち込まない
    this.input.idle = 0;
    this.input.lastRelease = null;
    this.ui.showStep(i);

    const id = STEPS[i]?.id;
    if (id === 'stretch') {
      this.rope.setVisible(true);
      this.rope.extend = 0.02;
      this.traveller.group.visible = true;
    }
    if (id === 'twist') {
      this.traveller.group.visible = false;
    }
    if (id === 'place') {
      this.top.visible = true;
      this.place01 = 0;
    }
    if (id === 'lay') {
      this.rope.close = 0.05;
      this.rope._recordedTo = 0.05;
    }
    if (id === 'whip') {
      this.jack.stubs.forEach((s) => (s.visible = false));
    }
    if (id === 'lift') {
      this.sub = 'carry';
      this.subT = 0;
      this.payload.group.visible = true;
      this.ui.setCardText('できた ロープを<br>そとへ はこぼう…');
      this.ui.hideHint();
    }
  }

  complete() {
    const s = STEPS[this.step];
    if (s) {
      this.ui.praise(s.praise);
      audio.chime();
    }
    if (this.step >= STEPS.length - 1) {
      this.finish();
    } else {
      this.setStep(this.step + 1);
    }
  }

  finish() {
    this.running = false;
    audio.silenceAll();
    this.ui.showEnd(
      'ほそい あさが 3ぼん、<br>ねじれて、よりあわさって、<br>おおきな かねを もちあげたね。'
    );
  }

  // -------------------------------------------------------------------------
  // 各手順の処理
  // -------------------------------------------------------------------------

  _stepHook(dt) {
    const input = this.input;
    // 束をつまむ
    if (input.justPressed && this.attached < ROPE.strands) {
      let best = null;
      let bestD = 150;
      for (const b of this.bundles) {
        if (b.state !== 'rest') continue;
        this.stage.project(b.group.position, this._screen);
        const d = Math.hypot(this._screen.x - input.pos.x, this._screen.y - input.pos.y);
        if (d < bestD) {
          bestD = d;
          best = b;
        }
      }
      // 近くに束がなくても、画面のどこを触っても次の束を持てる
      if (!best) best = this.bundles.find((b) => b.state === 'rest') || null;
      if (best) {
        best.state = 'held';
        this.held = best;
        audio.pop(1.15);
      }
    }

    if (this.held && input.isDown) {
      // 指の下へ、机の少し上を滑らせる
      const b = this.held;
      b.group.position.x += input.delta.y * -0.004 + input.delta.x * 0.002;
      b.group.position.z += input.delta.x * 0.004 + input.delta.y * 0.002;
      b.group.position.y = damp(b.group.position.y, 1.02, 8, dt);
      b.group.rotation.z = Math.sin(this.t * 6) * 0.04;
    }

    if (this.held && !input.isDown) {
      this._launchBundle(this.held);
      this.held = null;
    }

    // 手が止まっていたら、そっと手伝う
    if (input.idle > 11 && this.attached + this.flying.length < ROPE.strands) {
      const b = this.bundles.find((x) => x.state === 'rest');
      if (b) this._launchBundle(b);
      input.idle = 0;
    }

    this._updateFlights(dt);
    this.progress = this.attached / ROPE.strands;
    if (this.attached >= ROPE.strands && this.flying.length === 0) this.complete();
  }

  _launchBundle(b) {
    if (b.state !== 'rest' && b.state !== 'held') return;
    const idx = this.attached + this.flying.length;
    if (idx >= ROPE.strands) {
      b.state = 'rest';
      b.group.position.copy(b.home);
      return;
    }
    b.state = 'fly';
    b.from = b.group.position.clone();
    b.to = this.jack.hookWorld(idx, new THREE.Vector3());
    b.hookIndex = idx;
    b.t = 0;
    this.flying.push(b);
    audio.noise({ dur: 0.5, gain: 0.13, freq: 700, sweepTo: 2400, q: 1.4 });
  }

  _updateFlights(dt) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const b = this.flying[i];
      b.t = Math.min(1, b.t + dt / 0.95);
      const e = b.t * b.t * (3 - 2 * b.t);
      this._v.lerpVectors(b.from, b.to, e);
      this._v.y += Math.sin(e * Math.PI) * 0.75;
      b.group.position.copy(this._v);
      b.group.rotation.y = e * 1.4;
      b.group.scale.setScalar(lerp(1, 0.55, e));
      if (b.t >= 1) {
        b.group.visible = false;
        b.state = 'done';
        this.jack.attach(b.hookIndex);
        this.attached++;
        audio.hookOn();
        this.flying.splice(i, 1);
      }
    }
  }

  _stepStretch(dt) {
    const input = this.input;
    // 手前へ引く。よこの ゆれも すこしは 効く。
    let gain = 0;
    if (input.isDown) {
      gain += Math.max(0, input.delta.y) * 0.0012;
      gain += Math.abs(input.delta.x) * 0.0004;
    }
    if (input.idle > 9) gain += dt * 0.055;
    if (gain > 0) {
      this.rope.extend = clamp01(this.rope.extend + gain);
      audio.setLoop('stretch', Math.min(0.06, gain * 2.2), 420 + this.rope.extend * 700);
    } else {
      audio.setLoop('stretch', 0);
    }
    this.rope.tension = this.rope.extend * 0.35;
    this.progress = this.rope.extend;
    if (this.rope.extend >= 0.999) {
      audio.setLoop('stretch', 0);
      audio.stretch();
      this.complete();
    }
  }

  _stepTwist(dt) {
    const input = this.input;
    // 回し車の位置を画面へ落として、そのまわりの回転量をひろう
    this.jack.wheel.getWorldPosition(this._v);
    this.stage.project(this._v, this._screen);
    let d = Math.abs(input.angleAround(this._screen.x, this._screen.y));
    if (input.isDown) d += input.delta.length() * 0.0022; // まっすぐ動かしても少し進む
    if (input.idle > 9) d += dt * 0.42;

    if (d > 0) {
      this.hookTurns += d * 2.6;
      this.twist01 = clamp01(this.twist01 + d * 0.041);
      audio.setLoop('twist', Math.min(0.09, d * 0.5), 300 + this.twist01 * 900);
    } else {
      audio.setLoop('twist', 0);
    }
    this.rope.twist = this.twist01;
    this.rope.tension = 0.35 + this.twist01 * 0.65;
    this.progress = this.twist01;
    if (this.twist01 >= 0.999) {
      audio.setLoop('twist', 0);
      this.complete();
    }
  }

  _stepPlace(dt) {
    const input = this.input;
    let gain = 0;
    if (input.isDown) gain += Math.max(0, input.delta.y) * 0.0045 + Math.abs(input.delta.x) * 0.001;
    if (input.idle > 9) gain += dt * 0.22;
    this.place01 = clamp01(this.place01 + gain);
    this.progress = this.place01;
    if (this.place01 >= 0.999) {
      audio.knock(0.9);
      this.complete();
    }
  }

  _stepLay(dt) {
    const input = this.input;
    const rope = this.rope;
    // 画面上でのロープの向きを取り、その向きの成分だけを進みに使う
    rope.sampleFrame(rope.close, this._frame);
    this.stage.project(this._frame.p, this._screen);
    const ax = this._screen.x;
    const ay = this._screen.y;
    this._v.copy(this._frame.p).addScaledVector(this._frame.t, 0.6);
    const ahead = this.stage.project(this._v, { x: 0, y: 0, visible: true });
    let dirx = ahead.x - ax;
    let diry = ahead.y - ay;
    const dl = Math.hypot(dirx, diry) || 1;
    dirx /= dl;
    diry /= dl;

    let along = 0;
    let perp = 0;
    if (input.isDown) {
      along = input.delta.x * dirx + input.delta.y * diry;
      perp = -input.delta.x * diry + input.delta.y * dirx;
    }
    let adv = Math.max(0, along) * 0.0034;
    if (input.idle > 9) adv += dt * 0.28;

    this.closeSpeed = damp(this.closeSpeed, adv / Math.max(dt, 1e-3), 8, dt);
    this.wobble = damp(this.wobble, clamp(perp * 0.02, -1, 1), 6, dt);

    if (adv > 0) {
      rope.advanceClose(rope.close + adv, this.closeSpeed, this.wobble);
      audio.setLoop('lay', Math.min(0.1, this.closeSpeed * 0.13), 240 + this.closeSpeed * 500);
    } else {
      audio.setLoop('lay', 0);
    }

    this.progress = clamp01(rope.close / (WALK.span - 0.45));
    if (rope.close >= WALK.span - 0.45 && this.sub !== 'finish') {
      this.sub = 'finish';
      this.subT = 0;
      audio.setLoop('lay', 0);
    }

    if (this.sub === 'finish') {
      this.subT += dt;
      const k = clamp01(this.subT / 1.2);
      rope.close = lerp(WALK.span - 0.45, WALK.span + 0.1, smoothstep(0, 1, k));
      this.top.root.position.y = k * 0.8;
      this.top.root.scale.setScalar(1 - k * 0.4);
      if (k >= 1) {
        this.top.visible = false;
        this.complete();
      }
    }
  }

  _stepWhip(dt) {
    const input = this.input;
    this.rope.sampleFrame(0.34, this._frame);
    this.stage.project(this._frame.p, this._screen);
    let d = Math.abs(input.angleAround(this._screen.x, this._screen.y));
    if (input.isDown) d += input.delta.length() * 0.0022;
    if (input.idle > 9) d += dt * 0.4;
    if (d > 0) {
      const before = this.whip01;
      this.whip01 = clamp01(this.whip01 + d * 0.05);
      if (Math.floor(before * 17) !== Math.floor(this.whip01 * 17)) audio.pop(1.5 + this.whip01);
    }
    this.whipNear.setAmount(this.whip01);
    this.whipFar.setAmount(this.whip01);
    this.progress = this.whip01;
    if (this.whip01 >= 0.999) this.complete();
  }

  _stepLift(dt) {
    const input = this.input;
    if (this.sub === 'carry') {
      this.subT += dt;
      const k = clamp01(this.subT / 2.8);
      this.rope.pathBlend = smoothstep(0, 1, k);
      if (k >= 1) {
        this.sub = null;
        this.ui.showStep(this.step);
      }
      return;
    }
    let gain = 0;
    if (input.isDown) gain += Math.max(0, -input.delta.y) * 0.0013 + Math.abs(input.delta.x) * 0.0002;
    const sw = input.takeSwipe(30);
    if (sw && sw.dy < 0) gain += Math.min(0.22, -sw.dy * 0.0006);
    if (input.idle > 9) gain += dt * 0.13;
    if (gain > 0) {
      this.lift01 = clamp01(this.lift01 + gain);
      audio.setLoop('lift', Math.min(0.07, gain * 1.4), 160 + this.lift01 * 260);
    } else {
      audio.setLoop('lift', 0);
    }
    this.payload.setLift(this.lift01);
    this.progress = this.lift01;
    if (this.lift01 >= 0.999 && this.sub !== 'ring') {
      this.sub = 'ring';
      this.subT = 0;
      audio.setLoop('lift', 0);
      audio.bell();
      this.payload.celebrate();
    }
    if (this.sub === 'ring') {
      this.subT += dt;
      if (this.subT > 1.8) this.complete();
    }
  }

  // -------------------------------------------------------------------------
  // カメラ
  // -------------------------------------------------------------------------

  _framing(dt) {
    const p = this._camPos;
    const t = this._camTar;
    // 縦画面で必ず画面に残ってほしい「主役」の位置
    const anchor = this._anchor;
    const portrait = this.stage.portrait;
    let fov = portrait ? 54 : 40;
    let lambda = 2.0;
    // 縦画面での寄せ方。手順ごとに変える。
    let pf = { x: 1.18, z: 0.7, s: 1.06, pull: 0.45 };
    const id = STEPS[this.step]?.id;

    anchor.set(4.0, 1.05, 0);
    if (id === 'hook') {
      p.set(-2.55, 1.48, 1.75);
      t.set(4.3, 1.06, 0.05);
      anchor.set(-0.5, 0.95, 1.12);
    } else if (id === 'stretch') {
      const x = WALK.x0 + this.rope.sMin;
      p.set(Math.min(x - 2.5, 2.2), 1.75, 2.35);
      t.set(Math.min(x + 3.2, 8.0), 1.05, 0.0);
      anchor.set(x, WALK.y - 0.1, 0);
    } else if (id === 'twist') {
      // 回し車が柱の陰に入らないよう、ほぼ通路の真ん中から見る
      p.set(JACK_X - 2.5, 1.68, 1.05);
      t.set(JACK_X + 0.2, 1.14, 0.0);
      this.jack.wheel.getWorldPosition(anchor);
      fov = portrait ? 58 : 44;
    } else if (id === 'place') {
      this.rope.sampleFrame(0.55, this._frame);
      p.copy(this._frame.p).add(new THREE.Vector3(-0.86, 0.5, 0.94));
      t.copy(this._frame.p).add(new THREE.Vector3(0.75, 0.0, -0.05));
      anchor.copy(this._frame.p).setY(this._frame.p.y + 0.18);
      fov = portrait ? 56 : 42;
      lambda = 2.6;
    } else if (id === 'lay') {
      this.rope.sampleFrame(this.rope.close, this._frame);
      p.copy(this._frame.p).add(new THREE.Vector3(-1.32, 0.44, 1.02));
      t.copy(this._frame.p).add(new THREE.Vector3(1.70, -0.02, -0.16));
      anchor.copy(this._frame.p);
      fov = portrait ? 58 : 44;
      lambda = 3.0;
    } else if (id === 'whip') {
      this.rope.sampleFrame(0.34, this._frame);
      p.copy(this._frame.p).add(new THREE.Vector3(0.66, 0.30, 0.60));
      t.copy(this._frame.p).add(new THREE.Vector3(-0.16, -0.03, 0.0));
      anchor.copy(this._frame.p);
      fov = portrait ? 52 : 38;
      lambda = 2.4;
    } else if (id === 'lift') {
      const k = this.sub === 'carry' ? clamp01(this.subT / 2.8) : 1;
      const from = this._v.set(WALK.x0 - 1.4, 1.6, 2.1);
      const to = this._v2.set(GANTRY_X + 3.7, 2.15, 4.05);
      p.copy(from).lerp(to, smoothstep(0, 1, k));
      const ft = new THREE.Vector3(WALK.x0 + 2.0, 1.1, 0);
      const tt = new THREE.Vector3(GANTRY_X + 0.25, 1.5 + this.lift01 * 0.55, 0);
      t.copy(ft).lerp(tt, smoothstep(0, 1, k));
      anchor.copy(t);
      // 外に出たら、小屋の角へ回り込まないよう、まっすぐ引くだけにする
      pf = { x: 1.0, z: 1.0, s: 1.22, pull: 0 };
      fov = portrait ? 58 : 46;
      lambda = this.sub === 'carry' ? 6 : 1.8;
    }

    if (portrait) {
      // 縦画面は横が狭い。横への振りを減らし、主役へ寄せ直してから、少し引く。
      this._v2.copy(p).sub(t);
      this._v2.x *= pf.x;
      this._v2.z *= pf.z;
      this._v2.multiplyScalar(pf.s);
      if (pf.pull > 0) t.lerp(anchor, pf.pull);
      p.copy(t).add(this._v2);
      p.y += 0.08;
    }
    this.stage.frame(p, t, { fov, lambda });
  }

  _hint() {
    const id = STEPS[this.step]?.id;
    if (!id || this.sub === 'carry' || this.sub === 'ring' || !this.running) {
      this.ui.hideHint();
      return;
    }
    const w = this._hintWorld;
    if (id === 'hook') {
      const b = this.bundles.find((x) => x.state === 'rest');
      if (!b) {
        this.ui.hideHint();
        return;
      }
      w.copy(b.group.position);
    } else if (id === 'stretch') {
      w.set(WALK.x0 + this.rope.sMin, WALK.y - 0.16, 0);
    } else if (id === 'twist') {
      this.jack.wheel.getWorldPosition(w);
    } else if (id === 'place') {
      this.rope.sampleFrame(0.55, this._frame);
      w.copy(this._frame.p).setY(this._frame.p.y + 0.34 * (1 - this.place01));
    } else if (id === 'lay') {
      this.rope.sampleFrame(this.rope.close, this._frame);
      w.copy(this._frame.p);
    } else if (id === 'whip') {
      this.rope.sampleFrame(0.34, this._frame);
      w.copy(this._frame.p);
    } else if (id === 'lift') {
      this.payload.crownWorld(w);
      w.y -= 0.6;
    }
    this.stage.project(w, this._screen);
    if (!this._screen.visible) {
      this.ui.hideHint();
      return;
    }
    // 指が触れている間は、ヒントは引っ込む
    if (this.input.isDown && this.input.travel > 40) this.ui.hideHint();
    else this.ui.showHint(this._screen.x, this._screen.y);
  }

  _updateRig() {
    const crown = this.payload.crownWorld(this._v);
    const p = this._rigPoints;
    const pull = this.lift01 * 1.35;
    p[0].copy(crown);
    p[1].set(PULLEY.x, lerp(crown.y, PULLEY.y - 0.16, 0.6), 0);
    p[2].set(PULLEY.x - 0.02, PULLEY.y - 0.14, 0);
    p[3].set(PULLEY.x + 0.14, PULLEY.y + 0.02, 0);
    p[4].set(PULLEY.x + 0.5, PULLEY.y - 0.55, 0.02);
    p[5].set(GANTRY_X + 2.6, 2.1, 0.12);
    p[6].set(GANTRY_X + 6.4, 1.25, 0.16);
    p[7].set(GANTRY_X + 11.2 - pull, WALK.y - 0.06, 0.02);
    this.rigCurve.updateArcLengths();
    this.rope.setRigCurve(this.rigCurve, this.rope.pathBlend);
  }

  // -------------------------------------------------------------------------

  update(dt) {
    this.t += dt;
    const id = STEPS[this.step]?.id;

    if (this.running) {
      if (id === 'hook') this._stepHook(dt);
      else if (id === 'stretch') this._stepStretch(dt);
      else if (id === 'twist') this._stepTwist(dt);
      else if (id === 'place') this._stepPlace(dt);
      else if (id === 'lay') this._stepLay(dt);
      else if (id === 'whip') this._stepWhip(dt);
      else if (id === 'lift') this._stepLift(dt);
    }

    // --- 見た目へ反映 ------------------------------------------------------
    this.rope.material.userData.uniforms.uTurns.value = lerp(0.5, 6.2, this.twist01);
    this.rope.setFuzzVisible(true);

    if (this.rope.visible) {
      if (this.rope.pathBlend > 0 || this.step === STEPS.length - 1) this._updateRig();
      this.rope.update(dt, this.stage.camera.position.x);
    }

    // 遠方フックの回転。ロープの撚りの総量と、手で回した分。
    this.jack.setSpin(this.hookTurns + (this.rope.visible ? this.rope.thetaEnd || 0 : 0));

    // 引き出し台
    if (this.traveller.group.visible) {
      this.traveller.group.position.x = WALK.x0 + this.rope.sMin;
    }

    // トップ
    if (this.top.visible && this.rope.visible) {
      if (id === 'place') {
        this.rope.sampleFrame(0.55, this._frame);
        this.top.place(this._frame, this.rope.theta[this.rope._indexOf(0.55)] || 0);
        this.top.root.position.y = lerp(0.42, 0, this.place01);
      } else {
        this.rope.sampleFrame(this.rope.close, this._frame);
        this.top.place(this._frame, this._frame.theta);
      }
    }

    if (this.whip01 > 0) {
      this.whipNear.rebuild();
      this.whipFar.rebuild();
    }

    this.payload.update(dt);
    this.env.update(dt, this.stage.camera.position.x);
    this.cats.forEach((c) => c.update(this.t));

    // 外へ出たら、空気の色と濃さが変わる
    const outside = smoothstep(WALK.shedFrom + 1.5, WALK.shedFrom - 2.5, this.stage.camera.position.x);
    const fog = this.scene.fog;
    fog.color.copy(this.fogIndoorC).lerp(this.fogOutdoor, outside);
    fog.density = lerp(0.028, 0.0075, outside);
    this.stage.renderer.setClearColor(fog.color);

    this._framing(dt);
    this._hint();
  }
}
