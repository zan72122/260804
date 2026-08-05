// 看板となる 5 つの動作のうち、木を切るまでの工程。
//   1 巻き尺を「シャーッ」  2 鉛筆で「スーッ」  3 クランプで「カチッ」
//   4 のこぎりで「ギコギコ」  5 紙やすりで「サーッ」
import * as THREE from 'three';
import { Step, wiggle, popIn, popOut } from './step.js';
import { layTape } from '../world/tools.js';
import { makeLabelSprite } from '../core/fx.js';
import { clamp, lerp, damp, tween, wait, easeOutCubic, easeOutBack, easeInOutCubic, rand } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

/* =================================================================
 * 1. 巻き尺を伸ばす
 * ================================================================= */
export class MeasureStep extends Step {
  start() {
    const g = this.game;
    const p = this.opts.plank;
    this.plank = p;
    this.markX = this.opts.markX;
    this.hookX = -p.len / 2;
    this.topY = p.group.position.y + p.thick / 2;
    this.len = 0;              // 伸ばした長さ
    this.target = this.markX - this.hookX;
    this.maxLen = p.len + 0.04;
    this.snapped = false;
    this.snapHold = 0;
    this.speed = 0;

    g.hud.setStep('tape');
    g.focusOn(V(0, this.topY, 0.03), Math.max(0.27, p.len * 0.62), { yaw: -0.2, pitch: 0.5 });

    const t = g.tools.tape;
    this.rig = new THREE.Group();
    g.scene.add(this.rig);
    this.rig.add(t.group, t.tapeGroup, t.hook);
    t.group.visible = true; t.hook.visible = true; t.tapeGroup.visible = true;
    t.hook.position.set(this.hookX, this.topY - 0.006, 0);
    t.group.position.set(this.hookX + 0.055, this.topY + 0.038, 0);
    t.group.rotation.set(0, 0, 0);
    popIn(t.group, 1, 0.5);

    this.loop = g.audio.ready ? g.audio.tapeLoop() : null;
    g.robot.setGoggles(false);
    g.robot.lookAtWorld(V(this.hookX, this.topY, 0));
    g.say('のばしてみよう');
    this.hint();
  }

  hint() {
    const g = this.game;
    const from = V(this.hookX + 0.07, this.topY, 0);
    const to = V(this.markX, this.topY, 0);
    g.guides.show(from, to, { color: '#ff9f43' });
    g.robot.point(V(this.markX, this.topY, 0));
    wiggle(this.game.tools.tape.group, 0.12);
    g.audio.hint();
  }

  down() { this.dragging = true; this.game.guides.hide(); }
  move(e) {
    if (!this.dragging) return;
    const hit = this.game.input.rayToPlane(UP, V(0, this.topY, 0), _tmp);
    if (!hit) return;
    const want = clamp(hit.x - this.hookX, 0, this.maxLen);
    this.wanted = want;
  }
  up() {
    this.dragging = false;
    if (this.snapped) this.complete();
    else this.retract();
  }

  retract() {
    // ぴったりでなければ「シュルッ」と戻る。何度でも引っぱって遊べる。
    if (this._retracting || this.done) return;
    this._retracting = true;
    const from = this.len;
    this.game.audio.noiseBurst({ dur: 0.35, freq: 3000, gain: 0.22, sweep: -2200 });
    tween({
      from, to: 0.02, dur: 0.35, ease: easeOutCubic,
      onUpdate: (v) => { this.len = v; this.wanted = v; },
      onDone: () => { this._retracting = false; },
    });
  }

  update(dt) {
    const g = this.game;
    const t = g.tools.tape;
    const prev = this.len;
    if (this.wanted !== undefined && !this._retracting) {
      // 吸着：ぴったりの位置に近づくと軽く引き寄せられる
      let w = this.wanted;
      const d = w - this.target;
      if (Math.abs(d) < 0.06) w = lerp(w, this.target, 0.55);
      this.len = damp(this.len, w, 16, dt);
    }
    this.speed = Math.abs(this.len - prev) / Math.max(0.0001, dt);

    const caseX = this.hookX + this.len + 0.052;
    t.group.position.x = caseX;
    t.group.position.y = this.topY + 0.038;
    const a = V(this.hookX + 0.008, this.topY + 0.012, 0);
    const b = V(caseX - 0.048, this.topY + 0.038, 0);
    layTape(t.tape, a, b, 0.05);
    t.tape.visible = this.len > 0.02;

    // ロボットが巻き尺を持つ
    g.robot.setHandWorld('R', V(caseX + 0.03, this.topY + 0.06, 0.05));
    g.robot.setHandWorld('L', V(this.hookX - 0.02, this.topY + 0.04, 0.03));

    if (this.loop) {
      const s = clamp(this.speed * 1.6, 0, 1);
      this.loop.set(s * 0.22, 1400 + this.speed * 900, 0.8 + clamp(this.speed, 0, 2) * 0.5);
    }

    // 吸着判定
    const near = Math.abs(this.len - this.target) < 0.022;
    if (near && !this.snapped) {
      this.snapped = true;
      this.snapHold = 0;
      g.audio.snap();
      g.rings.pop(V(this.markX, this.topY + 0.004, 0), { size: 0.16, color: '#ffd76e', dur: 0.7 });
      g.sparkles.burst(V(this.markX, this.topY + 0.03, 0), { radius: 0.06, count: 14, color: '#ffe9a8' });
      this.label = makeLabelSprite('ここ！');
      this.label.position.set(this.markX, this.topY + 0.16, 0);
      g.scene.add(this.label);
      popIn(this.label, 1, 0.4);
      this.label.scale.set(0.001, 0.001, 1);
      tween({ from: 0, to: 1, dur: 0.4, ease: easeOutBack, onUpdate: (v) => this.label.scale.set(0.30 * v, 0.15 * v, 1) });
      g.robot.lookAtWorld(V(this.markX, this.topY, 0));
      g.say('ここ！');
      g.stage.punch(0.012);
    } else if (!near && this.snapped && !this.done) {
      this.snapped = false;
      this.snapHold = 0;
      this.hideLabel();
    }
    if (this.snapped) {
      this.snapHold += dt;
      if (this.label) {
        this.label.position.y = this.topY + 0.16 + Math.sin(performance.now() * 0.006) * 0.008;
      }
      // 押さえたままでも少し待てば次へ進む
      if (this.snapHold > 1.1) this.complete();
    }
  }

  hideLabel() {
    if (this.label) {
      const l = this.label;
      this.label = null;
      tween({ from: 1, to: 0, dur: 0.2, onUpdate: (v) => l.scale.set(0.3 * v, 0.15 * v, 1), onDone: () => l.parent && l.parent.remove(l) });
    }
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    g.guides.hide();
    g.audio.chime(0);
    // しるしを付ける → 点線ガイドが現れる
    this.plank.addDashedGuide(this.markX);
    const guide = this.plank.guide;
    guide.material.opacity = 0;
    tween({ from: 0, to: 0.95, dur: 0.4, onUpdate: (v) => { guide.material.opacity = v; } });
    g.robot.cheer();
    wait(0.55).then(() => {
      this.retract();
      wait(0.4).then(() => this.finish());
    });
  }

  teardown() {
    const g = this.game;
    this.hideLabel();
    if (this.loop) this.loop.stop();
    g.guides.hide();
    const t = g.tools.tape;
    popOut(t.group, 0.25);
    t.tape.visible = false;
    t.hook.visible = false;
    wait(0.3).then(() => { if (this.rig.parent) this.rig.parent.remove(this.rig); });
    g.robot.releaseHands();
  }
}

/* =================================================================
 * 2. 鉛筆で線を引く
 * ================================================================= */
export class PencilStep extends Step {
  start() {
    const g = this.game;
    const p = this.opts.plank;
    this.plank = p;
    this.markX = this.opts.markX;
    this.topY = p.group.position.y + p.thick / 2;
    this.z0 = -p.wide / 2;
    this.z1 = p.wide / 2;
    this.progress = 0;
    this.speed = 0;

    g.hud.setStep('pencil');
    g.focusOn(V(this.markX, this.topY, 0.02), 0.24, { yaw: -0.15, pitch: 0.66 });
    p.ensurePencilLine(this.markX);
    p.setPencilProgress(0.0001);
    if (p.guide) p.guide.material.opacity = 0.5;

    const t = g.tools.pencil;
    g.scene.add(t.group);
    t.group.visible = true;
    t.group.rotation.set(0.34, 0, -0.24);
    this._place(0);
    popIn(t.group, 1, 0.4);
    this.loop = g.audio.ready ? g.audio.pencilLoop() : null;
    g.robot.lookAtWorld(V(this.markX, this.topY, 0));
    g.say('せんを ひこう');
    this.hint();
  }

  _place(t) {
    const z = lerp(this.z0, this.z1, t);
    const tool = this.game.tools.pencil.group;
    tool.position.set(this.markX + 0.012, this.topY + 0.002, z);
    this.game.robot.setHandWorld('R', V(this.markX + 0.05, this.topY + 0.10, z + 0.03));
  }

  hint() {
    const g = this.game;
    g.guides.show(V(this.markX, this.topY, this.z0), V(this.markX, this.topY, this.z1), { color: '#ff9f43' });
    wiggle(g.tools.pencil.group, 0.14);
    g.audio.hint();
    g.robot.point(V(this.markX, this.topY, this.z0));
  }

  down(e) { this.drawing = true; this.game.guides.hide(); this.move(e); }
  move() {
    if (!this.drawing || this.done) return;
    const hit = this.game.input.rayToPlane(UP, V(0, this.topY, 0), _tmp);
    if (!hit) return;
    // 線から少しはみ出しても、鉛筆の方を線へ寄せて成功させる
    if (Math.abs(hit.x - this.markX) > 0.22) return;
    const t = clamp((hit.z - this.z0) / (this.z1 - this.z0), 0, 1);
    if (t > this.progress) {
      const d = t - this.progress;
      this.progress = Math.min(1, this.progress + Math.min(d, 0.12));
      this.speed = d / 0.016;
      this.plank.setPencilProgress(Math.max(0.0001, this.progress));
      if (Math.random() < 0.35) {
        this.game.dust.spawn(V(this.markX, this.topY + 0.002, lerp(this.z0, this.z1, this.progress)), {
          count: 1, speed: 0.12, size: 0.008, life: 0.4, color: new THREE.Color('#6b5847'), gravity: 0.6,
        });
      }
    }
    this._place(this.progress);
    if (this.progress > 0.965) this.complete();
  }
  up() {
    this.drawing = false;
    // 半分以上引けていたら、残りはそっと引いてあげる（行き詰まらせない）
    if (!this.done && this.progress > 0.5) this.autoFinish();
  }
  autoFinish() {
    if (this._auto) return;
    this._auto = true;
    const from = this.progress;
    tween({
      from, to: 1, dur: 0.5 * (1 - from) + 0.15, ease: easeOutCubic,
      onUpdate: (v) => {
        this.progress = v;
        this.plank.setPencilProgress(v);
        this._place(v);
      },
      onDone: () => this.complete(),
    });
  }

  update(dt) {
    this.speed = damp(this.speed, 0, 8, dt);
    if (this.loop) this.loop.set(clamp(this.speed * 0.02, 0, 0.2), 2600 + this.speed * 10, 1);
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    this.plank.setPencilProgress(1);
    if (this.plank.guide) {
      const gm = this.plank.guide.material;
      tween({ from: gm.opacity, to: 0.18, dur: 0.5, onUpdate: (v) => { gm.opacity = v; } });
    }
    g.guides.hide();
    g.audio.chime(1);
    g.sparkles.burst(V(this.markX, this.topY + 0.02, 0), { radius: 0.08, count: 16, color: '#ffe9a8' });
    g.robot.cheer();
    this.finish(0.6);
  }

  teardown() {
    const g = this.game;
    if (this.loop) this.loop.stop();
    g.guides.hide();
    popOut(g.tools.pencil.group, 0.25);
    g.robot.releaseHands();
  }
}

/* =================================================================
 * 3. クランプで固定する
 * ================================================================= */
export class ClampStep extends Step {
  start() {
    const g = this.game;
    const p = this.opts.plank;
    this.plank = p;
    this.topY = p.group.position.y + p.thick / 2;
    this.turn = 0;
    this.needed = Math.PI * 2 * 1.15;
    this.tick = 0;

    g.hud.setStep('clamp');
    const cx = -p.len / 2 + 0.075;
    this.cx = cx;
    g.focusOn(V(cx, this.topY + 0.03, 0.02), 0.2, { yaw: -0.12, pitch: 0.42 });

    const c = g.tools.clamp;
    g.scene.add(c.group);
    c.group.visible = true;
    c.group.position.set(cx, this.topY - 0.02, 0.0);
    c.jaw.position.y = 0.075;
    popIn(c.group, 1, 0.45);

    // 反対側は自動で締まる（片手操作を優先）
    const c2 = g.tools.clamp2;
    g.scene.add(c2.group);
    c2.group.visible = true;
    c2.group.position.set(p.len / 2 - 0.075, this.topY - 0.02, 0.0);
    c2.jaw.position.y = 0.075;
    popIn(c2.group, 1, 0.45, 0.15);
    wait(0.7).then(() => {
      if (this.done) return;
      tween({
        from: 0.075, to: 0.028, dur: 0.7, ease: easeOutCubic,
        onUpdate: (v) => { c2.jaw.position.y = v; c2.knob.rotation.y += 0.16; },
        onDone: () => { g.audio.clampClick(); },
      });
    });

    g.robot.lookAtWorld(V(cx, this.topY + 0.1, 0));
    g.say('ぎゅっと とめよう');
    this.hint();
  }

  hint() {
    const g = this.game;
    const knob = this._knobWorld();
    g.guides.show(knob.clone().add(V(-0.07, 0.0, 0.04)), knob.clone().add(V(0.07, 0.0, -0.04)), { pingPong: true, color: '#ff6b8a' });
    wiggle(g.tools.clamp.knob, 0.2);
    g.audio.hint();
  }

  _knobWorld() {
    const c = this.game.tools.clamp;
    return c.knob.getWorldPosition(new THREE.Vector3());
  }

  down(e) {
    this.turning = true;
    this.game.guides.hide();
    this._prevAngle = null;
    this._center = this.game.worldToScreen(this._knobWorld());
  }
  move(e) {
    if (!this.turning || this.done) return;
    const s = e.screen;
    const c = this._center || this.game.worldToScreen(this._knobWorld());
    const dx = s.x - c.x, dy = s.y - c.y;
    const r = Math.hypot(dx, dy);
    let add = 0;
    if (r > 18) {
      const a = Math.atan2(dy, dx);
      if (this._prevAngle !== null) {
        let d = a - this._prevAngle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        add += Math.abs(d);
      }
      this._prevAngle = a;
    }
    // ぐるぐる回さず、ただ指を動かしただけでも締まる
    add += Math.hypot(e.velocity.x, e.velocity.y) * 0.012;
    this.addTurn(Math.min(add, 0.5));
  }
  up() { this.turning = false; this._prevAngle = null; }

  addTurn(a) {
    if (a <= 0 || this.done) return;
    const g = this.game;
    this.turn = Math.min(this.needed, this.turn + a);
    const t = this.turn / this.needed;
    const c = g.tools.clamp;
    c.knob.rotation.y -= a * 1.6;
    c.jaw.position.y = lerp(0.075, 0.028, t);
    this.tick += a;
    if (this.tick > 0.55) { this.tick = 0; g.audio.clampTick(); }
    if (t >= 1) this.complete();
  }

  update(dt) {}

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    const p = this.plank;
    g.audio.clampClick();
    g.audio.chime(2);
    g.stage.punch(0.02);
    g.rings.pop(V(this.cx, this.topY + 0.005, 0), { size: 0.14, color: '#8ff0c0', dur: 0.6 });
    // 板が「ぎゅっ」と締まる手応え
    tween({
      from: 0, to: 1, dur: 0.45,
      onUpdate: (v) => {
        const s = 1 - Math.sin(v * Math.PI) * 0.06;
        p.mesh.scale.y = s;
      },
      onDone: () => { p.mesh.scale.y = 1; },
    });
    p.clampedBy = true;
    g.say('とまったよ');
    g.robot.cheer();
    this.finish(0.7);
  }

  teardown() {
    this.game.guides.hide();
  }
}

/* =================================================================
 * 4. のこぎりで切る
 * ================================================================= */
export class SawStep extends Step {
  start() {
    const g = this.game;
    const p = this.opts.plank;
    this.plank = p;
    this.markX = this.opts.markX;
    this.topY = p.group.position.y + p.thick / 2;
    this.depth = 0;
    this.zPos = -p.wide * 0.55;
    this.strokeDir = 1;
    this.speed = 0;
    this.travel = 0;

    g.hud.setStep('saw');
    g.focusOn(V(this.markX, this.topY + 0.02, 0.02), 0.24, { yaw: -0.22, pitch: 0.6 });
    g.robot.setGoggles(true);

    const s = g.tools.saw;
    g.scene.add(s.group);
    s.group.visible = true;
    s.group.rotation.set(0, -Math.PI / 2, 0);
    this._place();
    popIn(s.group, 1, 0.5);
    p.ensureKerf(this.markX);
    p.setKerfDepth(0.0001);

    this.loop = g.audio.ready ? g.audio.sawLoop() : null;
    g.robot.lookAtWorld(V(this.markX, this.topY, 0));
    g.say('ギコギコ しよう');
    this.hint();
  }

  _place() {
    const s = this.game.tools.saw;
    const y = this.topY + 0.045 - this.depth * this.plank.thick;
    s.group.position.set(this.markX, y, this.zPos);
    this.game.robot.setHandWorld('R', V(this.markX + 0.02, y + 0.02, this.zPos + 0.22));
    this.game.robot.setHandWorld('L', V(this.markX - 0.14, this.topY + 0.03, -0.02));
  }

  hint() {
    const g = this.game;
    const w = this.plank.wide;
    g.guides.show(V(this.markX, this.topY + 0.02, -w * 0.6), V(this.markX, this.topY + 0.02, w * 0.6), { pingPong: true, color: '#5ac8fa' });
    wiggle(g.tools.saw.group, 0.06);
    g.audio.hint();
  }

  down(e) { this.sawing = true; this.game.guides.hide(); this._prev = null; }
  move(e) {
    if (!this.sawing || this.done) return;
    const hit = this.game.input.rayToPlane(UP, V(0, this.topY, 0), _tmp);
    if (!hit) return;
    const z = clamp(hit.z, -this.plank.wide * 0.75, this.plank.wide * 0.75);
    if (this._prev === null) { this._prev = z; this._prevX = hit.x; return; }
    const dz = z - this._prev;
    const dx = hit.x - this._prevX;
    this._prev = z;
    this._prevX = hit.x;
    // 指の向きが少しずれても切れるよう、横の動きも少しだけ足す
    const travel = Math.abs(dz) + Math.abs(dx) * 0.3;
    if (travel <= 0.00001) return;
    this.zPos = z;
    this.speed = travel / 0.016;
    this.travel += travel;
    if (Math.sign(dz) !== 0 && Math.sign(dz) !== this.strokeDir) {
      this.strokeDir = Math.sign(dz);
      this.game.audio.blip({ freq: 180 + Math.random() * 40, dur: 0.06, type: 'sawtooth', gain: 0.06 });
    }
    this.addDepth(travel * 1.05);
    this._place();
  }
  up() { this.sawing = false; this._prev = null; }

  addDepth(a) {
    const g = this.game;
    const p = this.plank;
    const before = this.depth;
    this.depth = clamp(this.depth + a * 0.9, 0, 1);
    p.setKerfDepth(this.depth * p.thick);
    // 木くずと粉
    const contact = V(this.markX, this.topY - this.depth * p.thick, this.zPos);
    if (this.depth > before) {
      g.dust.spawn(contact, { count: 2, speed: 0.45, size: 0.014, life: rand(0.4, 0.9), color: new THREE.Color(p.wood.chip || '#e8c68e'), gravity: 2.0 });
      if (Math.random() < 0.55) {
        g.chips.spawn(contact, { count: 1, speed: 0.35, floor: p.group.position.y - p.thick / 2, scale: 0.9 });
      }
    }
    if (this.depth >= 0.995) this.complete();
  }

  update(dt) {
    this.speed = damp(this.speed, 0, 6, dt);
    if (this.loop) {
      const s = clamp(this.speed * 0.05, 0, 1);
      this.loop.set(s * 0.3, 620 + s * 900, 0.7 + s * 0.8);
    }
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    const p = this.plank;
    g.audio.thunk(1.0);
    g.stage.punch(0.03);
    g.dust.spawn(V(this.markX, this.topY - p.thick / 2, this.zPos), {
      count: 22, speed: 0.7, size: 0.02, life: 1.1, color: new THREE.Color(p.wood.chip || '#e8c68e'), gravity: 2.2,
    });
    g.chips.spawn(V(this.markX, this.topY - p.thick / 2, 0), { count: 8, speed: 0.5, floor: p.group.position.y - p.thick / 2 });

    // 2 本に分かれる
    const [left, right] = p.split(this.markX);
    g.scene.add(left.group);
    g.scene.add(right.group);
    p.group.parent && p.group.parent.remove(p.group);
    left.addRoughFace(+1);
    this.result = { keeper: left, offcut: right };
    g.tools.saw.group.visible = false;

    // 端材はころんと転がって端材入れへ
    const startY = right.group.position.y;
    tween({
      from: 0, to: 1, dur: 0.8, ease: easeOutCubic,
      onUpdate: (v) => {
        right.group.rotation.z = -v * 0.28;
        right.group.position.y = startY - v * 0.012;
        right.group.position.x += v * 0.0012;
      },
    });
    wait(0.35).then(() => g.audio.thunk(0.6));
    g.audio.chime(0);
    g.sparkles.burst(V(this.markX, this.topY + 0.02, 0), { radius: 0.12, count: 20, color: '#ffe9a8' });
    g.robot.cheer();
    g.say('きれた！');
    this.finish(1.0);
  }

  teardown() {
    const g = this.game;
    if (this.loop) this.loop.stop();
    g.guides.hide();
    popOut(g.tools.saw.group, 0.25);
    popOut(g.tools.clamp.group, 0.3);
    popOut(g.tools.clamp2.group, 0.3);
    g.robot.setGoggles(false);
    g.robot.releaseHands();
  }
}

/* =================================================================
 * 5. 紙やすりで磨く
 * ================================================================= */
export class SandStep extends Step {
  start() {
    const g = this.game;
    const p = this.opts.plank;
    this.plank = p;
    this.coverage = 0;
    this.speed = 0;

    g.hud.setStep('sand');
    // 切り口がこちらを向くように板をくるりと回す
    this.baseRotY = p.group.rotation.y;
    this.startX = p.group.position.x;
    tween({
      from: 0, to: 1, dur: 0.7, ease: easeInOutCubic,
      onUpdate: (v) => {
        p.group.rotation.y = lerp(this.baseRotY, this.baseRotY - Math.PI / 2 + 0.35, v);
        p.group.position.x = lerp(this.startX, 0, v);
      },
    });

    const face = p.rough;
    this.face = face;
    this._settle = 0;
    const center = p.localToWorld(p.len / 2 + 0.002, 0, 0);
    g.focusOn(center.clone().add(V(0, 0.01, 0)), 0.13, { yaw: 0.35, pitch: 0.3 });

    const s = g.tools.sander;
    g.scene.add(s.group);
    s.group.visible = true;
    const f0 = this._faceFrame();
    s.group.position.copy(f0.c).addScaledVector(f0.n, 0.03);
    s.group.quaternion.setFromUnitVectors(UP, f0.n);
    popIn(s.group, 1, 0.45);
    this.loop = g.audio.ready ? g.audio.sandLoop() : null;
    g.robot.lookAtWorld(center);
    g.say('つるつるに しよう');
    wait(0.8).then(() => { if (!this.done) this.hint(); });
  }

  _faceFrame() {
    const p = this.plank;
    const c = p.localToWorld(p.len / 2 + 0.01, 0, 0);
    const n = new THREE.Vector3(1, 0, 0).applyQuaternion(p.group.quaternion);
    const u = new THREE.Vector3(0, 0, 1).applyQuaternion(p.group.quaternion); // 幅方向
    const v = new THREE.Vector3(0, 1, 0).applyQuaternion(p.group.quaternion); // 厚み方向
    return { c, n, u, v };
  }

  hint() {
    const g = this.game;
    const f = this._faceFrame();
    const a = f.c.clone().addScaledVector(f.u, -this.plank.wide * 0.35).addScaledVector(f.n, 0.02);
    const b = f.c.clone().addScaledVector(f.u, this.plank.wide * 0.35).addScaledVector(f.n, 0.02);
    g.guides.show(a, b, { pingPong: true, color: '#8ff0c0' });
    wiggle(g.tools.sander.group, 0.16);
    g.audio.hint();
  }

  down(e) { this.rubbing = true; this.rubTime = this.rubTime || 0; this.game.guides.hide(); this.move(e); }
  move() {
    if (!this.rubbing || this.done) return;
    const g = this.game;
    const f = this._faceFrame();
    const hit = g.input.rayToPlane(f.n, f.c, _tmp);
    if (!hit) return;
    const d = hit.clone().sub(f.c);
    // 面からはみ出しても、いちばん近い場所を磨いてあげる
    const uu = clamp(d.dot(f.u) / (this.plank.wide * 0.48), -1, 1);
    const vv = clamp(d.dot(f.v) / (this.plank.thick * 0.48), -1, 1);
    const move = Math.hypot(uu - (this._pu ?? uu), vv - (this._pv ?? vv));
    this._pu = uu; this._pv = vv;
    this.speed = move / 0.016;

    const pos = f.c.clone().addScaledVector(f.u, uu * this.plank.wide * 0.48).addScaledVector(f.v, vv * this.plank.thick * 0.48);
    const s = g.tools.sander.group;
    s.position.copy(pos).addScaledVector(f.n, 0.028);
    s.quaternion.setFromUnitVectors(UP, f.n);
    g.robot.setHandWorld('R', pos.clone().addScaledVector(f.n, 0.1).add(V(0, 0.05, 0)));

    if (move > 0.0005) {
      const cov = this.plank.sandAt(uu * 0.5 + 0.5, vv * 0.5 + 0.5, 0.19);
      this.coverage = cov;
      g.dust.spawn(pos.clone().addScaledVector(f.n, 0.01), {
        count: 2, speed: 0.22, size: 0.008, life: 0.5,
        color: new THREE.Color('#f2e0c0'), gravity: 1.2,
      });
      // だんだん艶が出る
      this.plank.mat.userData.uniforms && (this.plank.mat.userData.uniforms.uSand.value = Math.min(1, cov * 1.2));
      if (cov > 0.55 || this.rubTime > 7) this.complete();
    }
  }
  up() { this.rubbing = false; this._pu = this._pv = undefined; }

  update(dt) {
    // 板が回っている間、切り口を追いかけてカメラを寄せる
    this._settle += dt;
    if (this._settle < 1.4 && !this._completing) {
      const f = this._faceFrame();
      this.game.focusOn(f.c.clone().addScaledVector(f.n, 0.02), 0.13, { yaw: 0.35, pitch: 0.3 });
      if (!this.rubbing) {
        const s = this.game.tools.sander.group;
        s.position.copy(f.c).addScaledVector(f.n, 0.035);
        s.quaternion.setFromUnitVectors(UP, f.n);
      }
    }
    if (this.rubbing) this.rubTime = (this.rubTime || 0) + dt;
    this.speed = damp(this.speed, 0, 8, dt);
    if (this.loop) this.loop.set(clamp(this.speed * 0.06, 0, 1) * 0.16, 2400, 1);
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    this.plank.finishSanding();
    const f = this._faceFrame();
    g.audio.chime(1);
    g.audio.sparkle();
    g.sparkles.burst(f.c.clone().addScaledVector(f.n, 0.02), { radius: 0.07, count: 22, color: '#ffffff' });
    g.rings.pop(f.c.clone().addScaledVector(f.n, 0.01), { size: 0.1, color: '#ffffff', dur: 0.7, normal: f.n });
    g.say('つるつる！');
    g.robot.cheer();
    // 板を元の向きへ
    const p = this.plank;
    const fromY = p.group.rotation.y;
    tween({
      from: 0, to: 1, dur: 0.6, delay: 0.35, ease: easeInOutCubic,
      onUpdate: (v) => { p.group.rotation.y = lerp(fromY, this.baseRotY, v); },
    });
    this.finish(1.2);
  }

  teardown() {
    const g = this.game;
    if (this.loop) this.loop.stop();
    g.guides.hide();
    this.plank.removeRough();
    popOut(g.tools.sander.group, 0.25);
    g.robot.releaseHands();
  }
}

const UP = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();

/* =================================================================
 * 0. 木材を作業台へ置く
 * ================================================================= */
export class PlaceStep extends Step {
  start() {
    const g = this.game;
    const p = this.opts.plank;
    this.plank = p;
    this.homeY = p.thick / 2;
    g.hud.setStep('wood');
    g.focusOn(V(0, this.homeY, 0.06), Math.max(0.3, p.len * 0.72), { yaw: -0.18, pitch: 0.56 });

    // 置き場所の光る枠
    const geo = new THREE.PlaneGeometry(p.len * 1.08, p.wide * 1.35);
    const mat = new THREE.MeshBasicMaterial({
      color: '#ffe9a8', transparent: true, opacity: 0.35, depthWrite: false, toneMapped: false,
    });
    this.spot = new THREE.Mesh(geo, mat);
    this.spot.rotation.x = -Math.PI / 2;
    this.spot.position.set(0, 0.002, 0);
    this.spot.renderOrder = 1;
    g.scene.add(this.spot);

    p.group.position.set(-0.62, this.homeY + 0.02, 0.34);
    p.group.rotation.set(0, 0.42, 0.04);
    p.group.scale.setScalar(0.001);
    popIn(p.group, 1, 0.5);
    g.audio.pop();
    g.robot.lookAtWorld(p.group.position.clone());
    g.say('きを おこう');
    this.moved = false;
  }

  hint() {
    const g = this.game;
    g.guides.show(this.plank.group.position.clone(), V(0, this.homeY + 0.02, 0), { color: '#ffd166' });
    wiggle(this.plank.group, 0.08);
    g.audio.hint();
    g.robot.point(V(0, this.homeY, 0));
  }

  down(e) {
    this.dragging = true;
    this.moved = false;
    this.game.guides.hide();
    const hit = this.game.input.rayToPlane(UP, V(0, this.homeY, 0), _tmp);
    this.grabOff = hit ? this.plank.group.position.clone().sub(hit) : V();
    this.grabOff.y = 0;
  }
  move() {
    if (!this.dragging || this.done) return;
    const hit = this.game.input.rayToPlane(UP, V(0, this.homeY, 0), _tmp);
    if (!hit) return;
    this.moved = true;
    const want = hit.clone().add(this.grabOff);
    const k = 1 - clamp(Math.hypot(want.x, want.z) / 0.3, 0, 1);
    const p = this.plank.group;
    p.position.x = lerp(want.x, 0, k * 0.9);
    p.position.z = lerp(want.z, 0, k * 0.9);
    p.position.y = this.homeY + 0.02;
    p.rotation.y = lerp(p.rotation.y, 0, 0.2);
    p.rotation.z = lerp(p.rotation.z, 0, 0.2);
    this.spot.material.opacity = 0.35 + k * 0.4;
  }
  up() {
    this.dragging = false;
    if (this.done) return;
    const p = this.plank.group;
    const d = Math.hypot(p.position.x, p.position.z);
    // タップだけでも置ける
    if (!this.moved || d < 0.34) this.complete();
    else this.complete();
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    const p = this.plank.group;
    const from = p.position.clone();
    const fromRot = new THREE.Euler().copy(p.rotation);
    tween({
      from: 0, to: 1, dur: 0.45, ease: easeOutCubic,
      onUpdate: (v) => {
        p.position.lerpVectors(from, V(0, this.homeY, 0), v);
        p.rotation.set(lerp(fromRot.x, 0, v), lerp(fromRot.y, 0, v), lerp(fromRot.z, 0, v));
      },
      onDone: () => {
        g.audio.thunk(0.9);
        g.stage.punch(0.018);
        g.dust.spawn(V(0, 0.004, 0), { count: 10, speed: 0.35, size: 0.012, life: 0.6, color: new THREE.Color('#f0dcb4'), gravity: 1.4 });
        g.rings.pop(V(0, 0.004, 0), { size: 0.2, color: '#ffe9a8', dur: 0.5 });
      },
    });
    tween({
      from: 0.75, to: 0, dur: 0.5, onUpdate: (v) => { this.spot.material.opacity = v; },
    });
    this.finish(0.7);
  }

  teardown() {
    this.game.guides.hide();
    if (this.spot.parent) this.spot.parent.remove(this.spot);
  }
}
