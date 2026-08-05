// 組み立て → 釘打ち → 塗装 → 飾り → 完成のおひろめ。
import * as THREE from 'three';
import { Step, wiggle, popIn, popOut } from './step.js';
import { makePartMesh, makeGhost } from '../world/workpiece.js';
import { makeNail } from '../world/tools.js';
import { makeDecalTexture, paintSystem } from '../core/materials.js';
import { makeLabelSprite, makeContactShadow } from '../core/fx.js';
import { makeTeddy, makeBird, makeBook, hopTo } from '../world/plush.js';
import { clamp, lerp, damp, tween, wait, easeOutCubic, easeOutBack, easeInOutCubic, easeOutBounce, rand } from '../core/util.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const UP = new THREE.Vector3(0, 1, 0);
const _tmp = new THREE.Vector3();

/** 部品を作業台に寝かせるときの向きと高さ */
export function layInfo(size) {
  const [w, h, d] = size;
  if (h <= w && h <= d) return { rot: [0, 0, 0], h };
  if (w <= d) return { rot: [0, 0, Math.PI / 2], h: w };
  return { rot: [-Math.PI / 2, 0, 0], h: d };
}

/* =================================================================
 * 6. 木材を大きな影へドラッグして組み立てる
 * ================================================================= */
export class AssembleStep extends Step {
  start() {
    const g = this.game;
    const proj = this.opts.project;
    this.proj = proj;
    g.hud.setStep('assemble');

    const asm = new THREE.Group();
    asm.position.set(0, 0, 0);
    g.scene.add(asm);
    g.assembly = asm;
    this.asm = asm;

    const view = proj.view;
    g.focusOn(V(view.center[0], view.center[1] * 0.85, view.center[2] + 0.12), Math.max(0.42, view.radius * 1.45), { yaw: -0.16, pitch: 0.4 });

    this.items = [];
    const n = proj.parts.length;
    proj.parts.forEach((part, i) => {
      const li = layInfo(part.size);
      // 完成形の半透明シルエット
      const ghost = makeGhost(part.size, part.hole || null);
      ghost.position.fromArray(part.pos);
      ghost.rotation.fromArray(part.rot);
      asm.add(ghost);

      // 実物
      const mesh = makePartMesh(part.size, g.wood, part.hole || null);
      const holder = new THREE.Group();
      holder.add(mesh);
      const shadow = makeContactShadow(Math.max(...part.size) * 1.3, 0.5);
      shadow.position.y = -li.h / 2 + 0.001;
      holder.add(shadow);
      holder.userData.shadow = shadow;
      g.scene.add(holder);

      const slot = this._slot(i, n);
      const src = this.opts.pieces && this.opts.pieces[part.from];
      if (src) {
        // 切って磨いた板がそのまま部品になる
        holder.position.copy(src.group.position);
        holder.rotation.set(0, src.group.rotation.y, 0);
        holder.rotation.set(li.rot[0], src.group.rotation.y, li.rot[2]);
        src.group.parent && src.group.parent.remove(src.group);
        tween({
          from: 0, to: 1, dur: 0.6, delay: 0.1 + i * 0.05, ease: easeInOutCubic,
          onUpdate: (v) => {
            holder.position.lerpVectors(holder.userData.from || (holder.userData.from = holder.position.clone()), slot, v);
            holder.rotation.y = lerp(holder.userData.fromY ?? (holder.userData.fromY = holder.rotation.y), 0, v);
          },
        });
      } else {
        holder.position.copy(slot);
        holder.rotation.fromArray(li.rot);
        holder.scale.setScalar(0.001);
        popIn(holder, 1, 0.45, 0.25 + i * 0.09);
        wait(0.25 + i * 0.09).then(() => g.audio.pop());
      }

      this.items.push({ part, ghost, holder, mesh, li, slot, placed: false });
    });

    this.index = 0;
    this._highlight();
    g.say('つみき みたいに くみたてよう');
    g.robot.lookAtWorld(V(0, 0.2, 0.1));
  }

  _slot(i, n) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = lerp(-0.31, 0.31, t);
    const z = 0.235 + (i % 2) * 0.105;
    const li = layInfo(this.proj.parts[i].size);
    return V(x, li.h / 2 + 0.004, z);
  }

  _highlight() {
    this.items.forEach((it, i) => {
      it.ghost.material.opacity = it.placed ? 0 : (i === this.index ? 0.5 : 0.16);
      it.ghost.material.color.set(i === this.index ? '#ffe9a8' : '#ffffff');
      it.ghost.visible = !it.placed;
    });
    const cur = this.items[this.index];
    if (cur) this.game.robot.lookAtWorld(cur.holder.position.clone());
  }

  hint() {
    const cur = this.items[this.index];
    if (!cur) return;
    const g = this.game;
    const to = new THREE.Vector3().fromArray(cur.part.pos);
    g.guides.show(cur.holder.position.clone().add(V(0, 0.02, 0)), to, { color: '#8ff0c0' });
    wiggle(cur.holder, 0.1);
    g.audio.hint();
    g.robot.point(cur.holder.position.clone());
  }

  update(dt) {
    // 今おく場所の影をゆっくり明滅させる
    this._pt = (this._pt || 0) + dt;
    const cur = this.items && this.items[this.index];
    if (cur && !cur.placed && !this.drag) {
      const k = 0.42 + Math.sin(this._pt * 3.2) * 0.16;
      cur.ghost.material.opacity = k;
      const sc = 1 + Math.sin(this._pt * 3.2) * 0.02;
      cur.ghost.scale.setScalar(sc);
    }
  }

  down(e) {
    const g = this.game;
    g.guides.hide();
    const meshes = this.items.filter((i) => !i.placed).map((i) => i.mesh);
    const hits = g.input.intersect(meshes, false);
    let item = null;
    if (hits.length) item = this.items.find((i) => i.mesh === hits[0].object);
    if (!item) item = this.items[this.index];         // 外しても今の部品をつかめる
    if (!item || item.placed) return;
    this.index = this.items.indexOf(item);
    this._highlight();
    this.drag = item;
    this.dragY = item.holder.position.y;
    const hit = g.input.rayToPlane(UP, V(0, this.dragY, 0), _tmp);
    this.grabOff = hit ? item.holder.position.clone().sub(hit) : V();
    this.grabOff.y = 0;
    g.audio.uiTap();
    tween({ from: item.holder.position.y, to: item.holder.position.y + 0.05, dur: 0.2, onUpdate: (v) => { this.dragY = v; } });
  }

  move() {
    const it = this.drag;
    if (!it || this.done) return;
    const g = this.game;
    const hit = g.input.rayToPlane(UP, V(0, this.dragY, 0), _tmp);
    if (!hit) return;
    const want = hit.clone().add(this.grabOff);
    want.y = this.dragY;
    const target = new THREE.Vector3().fromArray(it.part.pos);
    const dxz = Math.hypot(want.x - target.x, want.z - target.z);
    // 近づくと吸い寄せられ、向きも自然に直る
    const k = 1 - clamp(dxz / 0.22, 0, 1);
    it.holder.position.lerpVectors(want, target, k * 0.85);
    const qLay = new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.li.rot));
    const qFin = new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.part.rot));
    it.holder.quaternion.slerpQuaternions(qLay, qFin, k);
    it.ghost.material.opacity = 0.34 + k * 0.4;
    g.robot.lookAtWorld(it.holder.position.clone());
  }

  up() {
    const it = this.drag;
    this.drag = null;
    if (!it || this.done) return;
    const target = new THREE.Vector3().fromArray(it.part.pos);
    const d = it.holder.position.distanceTo(target);
    if (d < 0.30) this._place(it);
    else this._returnHome(it);
  }

  _place(it) {
    const g = this.game;
    it.placed = true;
    const from = it.holder.position.clone();
    const qFrom = it.holder.quaternion.clone();
    const target = new THREE.Vector3().fromArray(it.part.pos);
    const qTo = new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.part.rot));
    tween({
      from: 0, to: 1, dur: 0.34, ease: easeOutBack,
      onUpdate: (v) => {
        it.holder.position.lerpVectors(from, target, v);
        it.holder.quaternion.slerpQuaternions(qFrom, qTo, v);
      },
      onDone: () => {
        g.audio.fit();
        g.stage.punch(0.014);
        g.rings.pop(target.clone(), { size: 0.12, color: '#8ff0c0', dur: 0.5 });
        g.sparkles.burst(target, { radius: 0.08, count: 12, color: '#d8ffe8' });
        // 組み上がったものは 1 つのまとまりになる
        this.asm.attach(it.holder);
        if (it.holder.userData.shadow) it.holder.userData.shadow.visible = false;
        it.ghost.visible = false;
        this._next();
      },
    });
  }

  _returnHome(it) {
    const from = it.holder.position.clone();
    const qFrom = it.holder.quaternion.clone();
    const qTo = new THREE.Quaternion().setFromEuler(new THREE.Euler(...it.li.rot));
    tween({
      from: 0, to: 1, dur: 0.4, ease: easeOutCubic,
      onUpdate: (v) => {
        it.holder.position.lerpVectors(from, it.slot, v);
        it.holder.quaternion.slerpQuaternions(qFrom, qTo, v);
      },
      onDone: () => this.game.audio.thunk(0.35),
    });
  }

  _next() {
    const remaining = this.items.findIndex((i) => !i.placed);
    if (remaining < 0) {
      this.complete();
      return;
    }
    this.index = remaining;
    this._highlight();
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    g.audio.chime(2);
    g.robot.cheer();
    g.say('かたちに なったね');
    const c = new THREE.Vector3().fromArray(this.proj.view.center);
    g.sparkles.burst(c, { radius: this.proj.view.radius, count: 30, color: '#fff2b0' });
    this.finish(1.0);
  }

  teardown() {
    this.game.guides.hide();
    this.items.forEach((it) => {
      if (it.ghost.parent) it.ghost.parent.remove(it.ghost);
    });
  }
}

/* =================================================================
 * 7. 釘を「トントン」打ち込む
 * ================================================================= */
export class NailStep extends Step {
  start() {
    const g = this.game;
    const proj = this.opts.project;
    this.proj = proj;
    g.hud.setStep('hammer');
    const view = proj.view;
    g.focusOn(V(view.center[0], view.center[1], view.center[2]), view.radius * 1.15, { yaw: -0.2, pitch: 0.44 });

    if (!g.assembly) { this.finish(); return; }
    this.nails = proj.nails.map((n, i) => {
      const nail = makeNail();
      const axis = new THREE.Vector3().fromArray(n.axis).normalize();
      const pos = new THREE.Vector3().fromArray(n.pos);
      nail.group.quaternion.setFromUnitVectors(UP, axis.clone().negate());
      const depth0 = 0.012;
      nail.group.position.copy(pos).addScaledVector(axis, depth0);
      nail.group.visible = false;
      g.assembly.add(nail.group);
      return { obj: nail.group, axis, pos, depth: depth0, taps: 0, done: false };
    });
    this.nails.forEach((n, i) => {
      wait(0.15 + i * 0.08).then(() => {
        if (this.done) return;
        n.obj.visible = true;
        popIn(n.obj, 1, 0.3);
        g.audio.uiTap();
      });
    });

    const h = g.tools.hammer;
    g.scene.add(h.group);
    h.group.visible = true;
    popIn(h.group, 1, 0.5, 0.4);
    this.index = 0;
    this.cool = 0;
    this._aim();
    g.say('トントン しよう');
  }

  _cur() { return this.nails[this.index]; }
  _nailWorld(n) {
    const a = this.game.assembly;
    return a ? a.localToWorld(n.pos.clone()) : n.pos.clone();
  }
  _aim() {
    const n = this._cur();
    if (!n || !this.game.assembly) return;
    const g = this.game;
    const w = this._nailWorld(n);
    const axis = n.axis.clone().applyQuaternion(g.assembly.quaternion);
    const up = axis.clone().negate();
    const h = g.tools.hammer.group;
    h.position.copy(w).addScaledVector(up, 0.16);
    h.quaternion.setFromUnitVectors(UP, up);
    h.rotateZ(-0.5);
    g.robot.lookAtWorld(w);
    g.robot.setHandWorld('R', h.position.clone().addScaledVector(up, -0.02).add(V(0.02, 0, 0.06)));
    this.ringT = 0;
  }

  hint() {
    const n = this._cur();
    if (!n || !this.game.assembly) return;
    const g = this.game;
    const w = this._nailWorld(n);
    g.rings.pop(w.clone(), { size: 0.09, color: '#ffd76e', dur: 0.8, normal: n.axis.clone().negate() });
    wiggle(g.tools.hammer.group, 0.14);
    g.audio.hint();
    g.robot.point(w);
  }

  down(e) {
    if (this.done || this.cool > 0) return;
    const g = this.game;
    // 釘をねらってタップできるが、外しても今の釘を打つ
    const hits = g.input.intersect(this.nails.filter((n) => !n.done).map((n) => n.obj), true);
    if (hits.length) {
      const found = this.nails.findIndex((n) => n.obj === hits[0].object || n.obj === hits[0].object.parent);
      if (found >= 0) { this.index = found; this._aim(); }
    }
    this.strike();
  }

  strike() {
    const n = this._cur();
    if (!n || !this.game.assembly) return;
    const g = this.game;
    this.cool = 0.26;
    const h = g.tools.hammer.group;
    const up = n.axis.clone().negate().applyQuaternion(g.assembly.quaternion);
    const w = this._nailWorld(n);
    const high = w.clone().addScaledVector(up, 0.2);
    const low = w.clone().addScaledVector(up, 0.055);
    tween({
      from: 0, to: 1, dur: 0.24,
      onUpdate: (v) => {
        // 振り上げ → 振り下ろし
        const k = v < 0.34 ? v / 0.34 : 1 - (v - 0.34) / 0.66;
        h.position.lerpVectors(low, high, k * 0.9 + 0.1);
        g.robot.setHandWorld('R', h.position.clone().addScaledVector(up, -0.02).add(V(0.03, 0, 0.07)));
      },
      onDone: () => this._impact(n),
    });
  }

  _impact(n) {
    const g = this.game;
    n.taps++;
    const total = 3;
    const t = clamp(n.taps / total, 0, 1);
    const from = n.depth;
    const to = lerp(0.012, 0.052, t);
    tween({
      from, to, dur: 0.12, ease: easeOutCubic,
      onUpdate: (v) => {
        n.depth = v;
        n.obj.position.copy(n.pos).addScaledVector(n.axis, v);
      },
    });
    const w = this._nailWorld(n);
    g.audio.hammer(n.taps - 1);
    g.stage.punch(0.026);
    g.rings.pop(w.clone(), { size: 0.07, color: '#ffffff', dur: 0.45, normal: n.axis.clone().negate() });
    g.dust.spawn(w, { count: 6, speed: 0.5, size: 0.01, life: 0.5, color: new THREE.Color('#f0dcb4'), gravity: 2.2 });
    if (n.taps >= total) {
      n.done = true;
      g.audio.sparkle();
      g.sparkles.burst(w, { radius: 0.05, count: 10, color: '#ffffff' });
      const next = this.nails.findIndex((x) => !x.done);
      if (next < 0) { this.complete(); return; }
      this.index = next;
      wait(0.25).then(() => { if (!this.done) this._aim(); });
    }
  }

  update(dt) {
    this.cool = Math.max(0, this.cool - dt);
    this.ringT = (this.ringT || 0) + dt;
    const n = this._cur();
    if (n && !this.done && this.game.assembly && this.ringT > 1.4) {
      this.ringT = 0;
      const w = this._nailWorld(n);
      this.game.rings.pop(w.clone(), { size: 0.055, color: '#ffd76e', dur: 0.9, normal: n.axis.clone().negate() });
    }
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    g.audio.chime(0);
    g.robot.cheer();
    g.say('しっかり ついたよ');
    this.finish(0.9);
  }

  teardown() {
    const g = this.game;
    popOut(g.tools.hammer.group, 0.25);
    g.robot.releaseHands();
  }
}

/* =================================================================
 * 8. 刷毛で塗る
 * ================================================================= */
export class PaintStep extends Step {
  start() {
    const g = this.game;
    const proj = this.opts.project;
    this.proj = proj;
    g.hud.setStep('paint');
    const view = proj.view;
    this.center = V(view.center[0], view.center[1], view.center[2]);
    g.focusOn(this.center, view.radius * 1.2, { yaw: -0.24, pitch: 0.42 });

    if (!g.assembly) { this.finish(); return; }
    // 塗りは固定方向から投影する（画面を回しても塗った跡は動かない）
    paintSystem.clear();
    const dir = V(Math.sin(-0.26) * Math.cos(0.5), Math.sin(0.5), Math.cos(-0.26) * Math.cos(0.5));
    paintSystem.setProjection({ position: this.center.clone().addScaledVector(dir, 1) }, this.center, view.radius * 1.35);
    paintSystem.enabled = 1;
    this.setFinish(g.finish);

    const b = g.tools.brush;
    g.scene.add(b.group);
    b.group.visible = true;
    b.group.position.copy(this.center).add(V(0.2, 0.16, 0.2));
    popIn(b.group, 1, 0.45);

    this.can = g.tools.can;
    g.scene.add(this.can.group);
    this.can.group.visible = true;
    this.can.group.position.set(0.42, 0.0, 0.30);
    popIn(this.can.group, 1, 0.45, 0.1);

    this.loop = g.audio.ready ? g.audio.brushLoop() : null;
    this.coverage = 0;
    this.speed = 0;
    this.workTime = 0;
    this.box = new THREE.Box3().setFromObject(g.assembly);
    this.rect = paintSystem.rectFor(this.box);
    g.hud.showPalette(true, (f) => this.setFinish(f));
    g.say('すきな いろで ぬろう');
  }

  setFinish(f) {
    const g = this.game;
    g.finish = f;
    paintSystem.color.set(f.color);
    paintSystem.gloss = f.gloss;
    paintSystem.rainbow = f.rainbow;
    if (this.can) {
      this.can.paint.material.color.set(f.rainbow ? '#ffd0e8' : f.color);
      this.can.label.material.color.set(f.rainbow ? '#ffd0e8' : f.color);
    }
    if (g.tools.brush) g.tools.brush.tip.material.color.set(f.rainbow ? '#ffd0e8' : f.color);
  }

  hint() {
    const g = this.game;
    const r = this.proj.view.radius;
    g.guides.show(this.center.clone().add(V(-r * 0.7, r * 0.5, r * 0.7)), this.center.clone().add(V(r * 0.7, r * 0.5, r * 0.7)), { pingPong: true, color: '#ff9ec4' });
    wiggle(g.tools.brush.group, 0.18);
    g.audio.hint();
  }

  down(e) { this.painting = true; this.game.guides.hide(); this.move(e); }
  move() {
    if (!this.painting || this.done || !this.game.assembly) return;
    const g = this.game;
    const targets = [];
    g.assembly.traverse((o) => { if (o.isMesh && o.material && o.material.userData.isWood) targets.push(o); });
    const hits = g.input.intersect(targets, false);
    let p = null, nrm = null;
    if (hits.length) { p = hits[0].point; nrm = hits[0].face ? hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld) : UP.clone(); }
    if (!p) {
      // 少し外れても、いちばん近い所を塗ってあげる
      const hit = g.input.rayToViewPlane(this.center, _tmp);
      if (!hit) return;
      if (hit.distanceTo(this.center) > this.proj.view.radius * 1.25) return;
      p = hit.clone();
      nrm = UP.clone();
    }
    const prev = this._prevP;
    this._prevP = p.clone();
    if (prev) {
      const d = prev.distanceTo(p);
      this.speed = d / 0.016;
      // 途切れないよう間を補間して塗る
      const steps = clamp(Math.ceil(d / 0.02), 1, 8);
      for (let i = 1; i <= steps; i++) {
        paintSystem.paintAt(prev.clone().lerp(p, i / steps), 0.055);
      }
    } else {
      paintSystem.paintAt(p, 0.055);
    }
    const b = g.tools.brush.group;
    b.position.copy(p).addScaledVector(nrm, 0.03);
    b.quaternion.setFromUnitVectors(UP, nrm);
    g.robot.setHandWorld('R', p.clone().addScaledVector(nrm, 0.14));

    if (Math.random() < 0.25) {
      g.dust.spawn(p, { count: 1, speed: 0.1, size: 0.01, life: 0.4, color: new THREE.Color(g.finish.rainbow ? '#ffd0e8' : g.finish.color), gravity: 0.4 });
    }
    this._check();
  }
  up() { this.painting = false; this._prevP = null; }

  _check() {
    if (this._checkCool > 0) return;
    this._checkCool = 0.25;
    this.coverage = paintSystem.coverage(this.rect);
    // 塗り残しで詰まらないよう、しばらく塗ったらそこで仕上げに入る
    if (this.coverage > 0.52 || this.workTime > 6.5) this.complete();
  }

  update(dt) {
    this._checkCool = Math.max(0, (this._checkCool || 0) - dt);
    if (this.painting) this.workTime += dt;
    this.speed = damp(this.speed, 0, 8, dt);
    if (this.loop) this.loop.set(clamp(this.speed * 0.05, 0, 1) * 0.12, 900, 1);
  }

  complete() {
    if (this.done || this._completing) return;
    this._completing = true;
    const g = this.game;
    // 残りはすうっと塗り上がる
    tween({
      from: 0, to: 1, dur: 0.8, ease: easeOutCubic,
      onUpdate: (v) => { paintSystem.fill = v; },
    });
    g.audio.chime(1);
    g.audio.sparkle();
    g.sparkles.burst(this.center, { radius: this.proj.view.radius, count: 34, color: '#ffffff' });
    g.robot.cheer();
    g.say('きれいに なったね');
    this.finish(1.4);
  }

  teardown() {
    const g = this.game;
    if (this.loop) this.loop.stop();
    g.guides.hide();
    g.hud.showPalette(false);
    popOut(g.tools.brush.group, 0.25);
    popOut(this.can.group, 0.25);
    g.robot.releaseHands();
  }
}

/* =================================================================
 * 9. 飾りつけ（やってもやらなくてもよい）
 * ================================================================= */
export class DecorateStep extends Step {
  start() {
    const g = this.game;
    this.proj = this.opts.project;
    g.hud.setStep('sticker');
    const view = this.proj.view;
    this.center = V(view.center[0], view.center[1], view.center[2]);
    g.focusOn(this.center, view.radius * 1.15, { yaw: -0.2, pitch: 0.4 });
    this.count = 0;
    this.sticker = g.hud.stickerList[0];
    g.hud.showStickers(true, (s) => { this.sticker = s; }, () => this.complete());
    g.say('シールを はろう');
  }
  hint() {
    const g = this.game;
    g.rings.pop(this.center.clone().add(V(0, 0.02, this.proj.view.radius * 0.7)), { size: 0.1, color: '#ffd76e', dur: 0.9 });
    g.audio.hint();
  }
  down() {
    if (this.done || !this.game.assembly) return;
    const g = this.game;
    const targets = [];
    g.assembly.traverse((o) => { if (o.isMesh && o.material && o.material.userData.isWood) targets.push(o); });
    const hits = g.input.intersect(targets, false);
    if (!hits.length) return;
    const h = hits[0];
    const n = h.face ? h.face.normal.clone().transformDirection(h.object.matrixWorld) : UP.clone();
    const tex = makeDecalTexture(this.sticker.id, this.sticker.color);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.06),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.45, metalness: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    m.position.copy(h.point).addScaledVector(n, 0.0025);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    m.renderOrder = 5;
    g.assembly.attach(m);
    popIn(m, 1, 0.35);
    g.audio.pop();
    g.sparkles.burst(h.point, { radius: 0.04, count: 8, color: this.sticker.color });
    this.count++;
    if (this.count >= 8) this.complete();
  }
  complete() {
    if (this.done) return;
    this.game.audio.chime(2);
    this.finish(0.2);
  }
  teardown() {
    this.game.hud.showStickers(false);
    this.game.guides.hide();
  }
}

/* =================================================================
 * 10. 完成したものを、だれかが実際に使う
 * ================================================================= */
export class FinaleStep extends Step {
  start() {
    const g = this.game;
    const proj = this.opts.project;
    this.proj = proj;
    g.hud.setStep('done');
    const view = proj.view;
    this.center = V(view.center[0], view.center[1], view.center[2]);
    g.focusOn(this.center.clone().add(V(0, 0.04, 0)), view.radius * 1.65, { yaw: -0.3, pitch: 0.36 });
    g.audio.fanfare();
    g.robot.cheer();
    g.say('できたー！');
    g.sparkles.burst(this.center, { radius: view.radius * 1.2, count: 60, color: '#fff2b0' });
    this.actors = [];
    wait(0.9).then(() => { if (!this.done) this._perform(); });
  }

  _perform() {
    const g = this.game;
    const kind = this.proj.finale;
    if (kind === 'sit') this._teddySits();
    else if (kind === 'books') this._books();
    else this._bird();
  }

  _teddySits() {
    const g = this.game;
    const t = makeTeddy('#d8a06a');
    g.scene.add(t.group);
    this.actors.push(t.group);
    const seatY = 0.27;
    const start = V(-0.62, 0.0, 0.30);
    t.group.position.copy(start);
    t.group.scale.setScalar(0.001);
    popIn(t.group, 1, 0.4);
    const steps = [V(-0.4, 0, 0.26), V(-0.22, 0, 0.2), V(-0.06, 0, 0.16)];
    let p = Promise.resolve();
    steps.forEach((s, i) => {
      p = p.then(() => {
        g.audio.blip({ freq: 420 + i * 60, dur: 0.12, type: 'sine', gain: 0.14 });
        return hopTo(t.group, t.group.position.clone(), s, { height: 0.06, dur: 0.42 });
      });
    });
    p.then(() => {
      g.audio.pop();
      return hopTo(t.group, t.group.position.clone(), V(0, seatY, 0.01), { height: 0.16, dur: 0.6 });
    }).then(() => {
      g.audio.thunk(0.5);
      g.audio.sparkle();
      g.stage.punch(0.02);
      g.sparkles.burst(V(0, seatY + 0.06, 0), { radius: 0.12, count: 18, color: '#ffe9a8' });
      // ゆらゆら喜ぶ
      tween({
        from: 0, to: 1, dur: 2.4,
        onUpdate: (v) => {
          t.group.rotation.z = Math.sin(v * Math.PI * 6) * 0.06;
          t.head.rotation.z = Math.sin(v * Math.PI * 6 + 0.6) * 0.12;
        },
      });
      this._offerChoices();
    });
  }

  _books() {
    const g = this.game;
    const colors = ['#e0685f', '#5aa9e6', '#7ac7a5', '#f2b23c', '#b58cff'];
    const rows = [
      { y: 0.06 + 0.055, xs: [-0.10, -0.05, 0.0] },
      { y: 0.185 + 0.055, xs: [0.02, 0.07] },
      { y: 0.31 + 0.055, xs: [-0.08] },
    ];
    let i = 0;
    let p = Promise.resolve();
    rows.forEach((r) => {
      r.xs.forEach((x) => {
        const b = makeBook(colors[i % colors.length]);
        g.scene.add(b.group);
        this.actors.push(b.group);
        const to = V(x, r.y, 0);
        b.group.position.copy(to).add(V(0.5, 0.35, 0.35));
        b.group.scale.setScalar(0.001);
        const idx = i++;
        p = p.then(() => {
          popIn(b.group, 1, 0.2);
          g.audio.blip({ freq: 500 + idx * 40, dur: 0.14, type: 'triangle', gain: 0.14 });
          return hopTo(b.group, b.group.position.clone(), to, { height: 0.1, dur: 0.45 });
        }).then(() => { g.audio.thunk(0.35); });
      });
    });
    p.then(() => {
      g.audio.sparkle();
      g.sparkles.burst(V(0, 0.2, 0), { radius: 0.2, count: 22, color: '#ffe9a8' });
      this._offerChoices();
    });
  }

  _bird() {
    const g = this.game;
    const b = makeBird('#7fc6f5');
    g.scene.add(b.group);
    this.actors.push(b.group);
    b.group.position.set(-0.7, 0.55, 0.5);
    let flap = 0;
    this._flap = (dt) => {
      flap += dt * 18;
      b.wings.forEach((w, i) => { w.rotation.z = Math.sin(flap) * 0.7 * (i ? -1 : 1); });
    };
    hopTo(b.group, b.group.position.clone(), V(0.06, 0.345, 0.06), { height: 0.22, dur: 1.1 })
      .then(() => {
        g.audio.blip({ freq: 1400, dur: 0.1, type: 'sine', gain: 0.14 });
        g.audio.blip({ freq: 1800, dur: 0.12, type: 'sine', gain: 0.12, at: 0.12 });
        return hopTo(b.group, b.group.position.clone(), V(0.0, 0.32, 0.16), { height: 0.05, dur: 0.4 });
      })
      .then(() => hopTo(b.group, b.group.position.clone(), V(0.0, 0.205, 0.175), { height: 0.03, dur: 0.5 }))
      .then(() => {
        this._flap = null;
        b.wings.forEach((w) => (w.rotation.z = 0));
        g.audio.sparkle();
        g.sparkles.burst(V(0, 0.2, 0.12), { radius: 0.1, count: 18, color: '#ffe9a8' });
        tween({
          from: 0, to: 1, dur: 2.0,
          onUpdate: (v) => { b.group.position.y = 0.20 + Math.sin(v * Math.PI * 4) * 0.012; },
        });
        this._offerChoices();
      });
  }

  _offerChoices() {
    if (this.done) return;
    this.game.hud.showEndChoices((choice) => {
      this.choice = choice;
      this.finish();
    });
  }

  update(dt) {
    if (this._flap) this._flap(dt);
    // 完成したものの周りをゆっくり回り込んで見せる
    this._t = (this._t || 0) + dt;
    this.game.stage.yawBase = -0.3 + Math.sin(this._t * 0.28) * 0.30;
  }

  teardown() {
    const g = this.game;
    g.hud.hideEndChoices();
    this.actors.forEach((a) => a.parent && a.parent.remove(a));
  }
}
